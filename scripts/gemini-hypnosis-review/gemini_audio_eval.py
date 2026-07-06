#!/usr/bin/env python3
"""Gemini に音声そのものを聴かせて三軸採点する（高精度測定用）。

Whisper 文字起こしでは測れない要素（演技・間・囁きの距離・ミックス・
非言語音）を評価に入れるため、WAV を 16kHz mono MP3 に圧縮して
Files API でアップロードし、軸ごとに採点させる。

使い方:
  cd scripts/gemini-hypnosis-review
  py -3 gemini_audio_eval.py --slug <slug> --analysis-dir "C:\\path\\to\\解析フォルダ"

出力: eval_results/<slug>_audio_{trance,pleasure,satisfaction}.md
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(SCRIPT_DIR))

from google import genai  # noqa: E402
from google.genai import types  # noqa: E402

try:
    from dotenv import load_dotenv

    load_dotenv(SCRIPT_DIR / ".env", override=True)
except ImportError:
    pass

AUDIO_EVAL_MODEL = os.environ.get(
    "GEMINI_AUDIO_EVAL_MODEL", os.environ.get("GEMINI_EVAL_MODEL", "gemini-2.5-flash")
)

AXIS_FILES = {
    "trance": SCRIPT_DIR / "eval_trance_rubric.md",
    "pleasure": SCRIPT_DIR / "eval_pleasure_rubric.md",
    "satisfaction": SCRIPT_DIR / "eval_satisfaction_rubric.md",
}
SCORING_DEF_FILE = ROOT / "docs" / "レビュー三軸評価定義.md"
EVAL_SYSTEM_FILE = SCRIPT_DIR / "eval_system_repo.md"

AXIS_MANUAL_FILES = {
    "trance": "催眠トランス度採点マニュアル.txt",
    "pleasure": "催眠快楽採点マニュアル.txt",
    "satisfaction": "催眠満足度採点マニュアル.txt",
}
DEFAULT_MANUAL_DIR = Path(
    os.environ.get("HYPNOSIS_MANUAL_DIR", r"C:\Users\tomok\Desktop\作成マニュアル")
)

FINAL_LINE = {
    "trance": "最終トランス",
    "pleasure": "最終快楽",
    "satisfaction": "最終満足",
}

AUDIO_EVIDENCE_INSTRUCTION = """
## 音声直接評価（このセッション固有・必須）

あなたには文字起こしではなく **音声ファイルそのもの** が渡されている。
Whisper では測れない次の要素を、各次元の根拠に **必ず** 含めること:

- **演技の質** … 声のトーン・感情の乗り・喘ぎや抵抗の生々しさ・キャラの演じ分け
- **間（ま）の設計** … 沈黙の長さと置き方、暗示後の余白、テンポの緩急
- **囁き・距離感** … マイクとの距離、耳元感、音量ダイナミクス
- **非言語音** … 吐息・キス音・水音・環境音・SE の質と使い方
- **ミックス・収録品質** … ノイズ、音量バランス、定位、編集の破綻の有無

根拠には **「どのファイルの何分何秒ごろ」** を必ず添える。
台本上の文言だけで採点せず、**実際に聴こえる音**を優先根拠とすること。
性癖中立（題材そのものによる加点・減点の禁止）は文字起こし採点と同一に適用する。
"""


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def safety_settings() -> list[types.SafetySetting]:
    cats = (
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    )
    return [types.SafetySetting(category=c, threshold="BLOCK_NONE") for c in cats]


def waveform_timeseries(analysis_dir: Path, bin_sec: int = 60) -> str:
    """*_waveform.csv を1分ビンの時系列に要約（盛り上がりカーブを可視化）。"""
    lines = ["# 波形時系列（1分ビン・RMS平均/RMS最大/無音率/重心Hz）", ""]
    for wf in sorted(analysis_dir.glob("*_waveform.csv")):
        bins: dict[int, list[tuple[float, float]]] = {}
        with wf.open(encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                try:
                    ts = float(row["timestamp_sec"])
                    rms = float(row["amplitude_rms"])
                    cent = float(row["frequency_centroid_hz"])
                except (KeyError, ValueError):
                    continue
                bins.setdefault(int(ts // bin_sec), []).append((rms, cent))
        name = wf.stem.replace("_waveform", "")
        lines.append(f"## {name}")
        for b in sorted(bins):
            vals = bins[b]
            rmss = [v[0] for v in vals]
            cents = [v[1] for v in vals]
            silence = sum(1 for v in rmss if v < 0.01) / len(rmss)
            lines.append(
                f"- {b}分台: rms_mean={statistics.mean(rmss):.4f} "
                f"rms_max={max(rmss):.4f} silence={silence:.2f} "
                f"centroid={statistics.mean(cents):.0f}Hz"
            )
        lines.append("")
    return "\n".join(lines)


def convert_audio(analysis_dir: Path, out_dir: Path) -> list[tuple[Path, str]]:
    """WAV → 16kHz mono 64kbps MP3。戻り値は (mp3_path, 表示用トラック名)。"""
    outs: list[tuple[Path, str]] = []
    for i, wav in enumerate(sorted(analysis_dir.glob("*.wav")), start=1):
        display_name = wav.stem
        mp3 = out_dir / f"track{i:02d}.mp3"
        if not mp3.is_file():
            print(f"[変換] {wav.name} → {mp3.name} ({display_name})")
            subprocess.run(
                [
                    "ffmpeg", "-y", "-loglevel", "error",
                    "-i", str(wav),
                    "-ac", "1", "-ar", "16000", "-b:a", "64k",
                    str(mp3),
                ],
                check=True,
            )
        outs.append((mp3, display_name))
    return outs


def upload_files(client: genai.Client, paths: list[Path]) -> list:
    uploaded = []
    for p in paths:
        print(f"[アップロード] {p.name} ({p.stat().st_size / 1e6:.1f} MB)")
        f = client.files.upload(file=str(p))
        uploaded.append(f)
    # ACTIVE 待ち
    for i, f in enumerate(uploaded):
        while f.state and f.state.name == "PROCESSING":
            time.sleep(3)
            f = client.files.get(name=f.name)
            uploaded[i] = f
        if f.state and f.state.name != "ACTIVE":
            raise RuntimeError(f"アップロード失敗: {f.name} state={f.state.name}")
    return uploaded


def extract_score(text: str, axis: str) -> float | None:
    m = re.search(rf"{FINAL_LINE[axis]}[^\d]*(\d+(?:\.\d+)?)", text)
    return float(m.group(1)) if m else None


def run_axis(
    client: genai.Client,
    axis: str,
    files: list,
    file_names: list[str],
    timeseries: str,
    trance_score: float | None,
) -> str:
    manual = read_text(DEFAULT_MANUAL_DIR / AXIS_MANUAL_FILES[axis])
    if axis == "pleasure" and trance_score is not None:
        manual = manual.replace("[TRANS_SCORE]", f"{trance_score:.1f}")
    system = "\n\n---\n\n".join(
        [
            read_text(EVAL_SYSTEM_FILE),
            AUDIO_EVIDENCE_INSTRUCTION,
            read_text(SCORING_DEF_FILE),
            read_text(AXIS_FILES[axis]),
            manual,
        ]
    )
    prompt = (
        "添付の音声ファイル（トラック順: "
        + " / ".join(file_names)
        + "）を全編聴き、ルーブリックに従ってこの軸だけを採点してください。\n\n"
        + "補助データ（Librosa 波形時系列）:\n\n"
        + timeseries
    )
    contents = list(files) + [prompt]
    for attempt in range(1, 6):
        try:
            resp = client.models.generate_content(
                model=AUDIO_EVAL_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    temperature=0,
                    safety_settings=safety_settings(),
                ),
            )
            text = resp.text or ""
            if not text.strip():
                fb = resp.prompt_feedback
                print(f"[警告] {axis} 空応答 (block: {getattr(fb, 'block_reason', fb)})")
            return text
        except Exception as exc:  # noqa: BLE001
            wait = min(2**attempt, 60)
            print(f"[警告] {axis} 失敗 ({attempt}/5): {exc} — {wait}s 待機")
            time.sleep(wait)
    raise RuntimeError(f"{axis} 採点が5回失敗")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--slug", required=True)
    p.add_argument("--analysis-dir", type=Path, required=True)
    p.add_argument("--work-dir", type=Path, default=None, help="MP3変換先（既定: temp）")
    args = p.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("[エラー] GEMINI_API_KEY 未設定")
        sys.exit(1)

    ad = args.analysis_dir
    work = args.work_dir or Path(tempfile.gettempdir()) / f"audio-eval-{args.slug}"
    work.mkdir(parents=True, exist_ok=True)

    print(f"[モデル] {AUDIO_EVAL_MODEL}")
    print("[1/4] 波形時系列を集計...")
    timeseries = waveform_timeseries(ad)

    print("[2/4] 音声を 16kHz mono MP3 に変換...")
    mp3_pairs = convert_audio(ad, work)
    if not mp3_pairs:
        print("[エラー] WAV が見つかりません")
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    print("[3/4] Files API にアップロード...")
    mp3s = [p for p, _ in mp3_pairs]
    files = upload_files(client, mp3s)
    names = [display for _, display in mp3_pairs]

    print("[4/4] 三軸採点（音声直接・トランスありき）...")
    out_dir = SCRIPT_DIR / "eval_results"
    out_dir.mkdir(exist_ok=True)
    trance_score: float | None = None
    for axis in ("trance", "pleasure", "satisfaction"):
        print(f"  - {axis} ...")
        text = run_axis(client, axis, files, names, timeseries, trance_score)
        out = out_dir / f"{args.slug}_audio_{axis}.md"
        out.write_text(text, encoding="utf-8")
        score = extract_score(text, axis)
        if axis == "trance":
            trance_score = score
        print(f"    → {score} ({out.name})")

    print("[完了] eval_results/<slug>_audio_*.md を確認してください。")


if __name__ == "__main__":
    main()
