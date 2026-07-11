#!/usr/bin/env python3
"""パート（トラック）ごとに Gemini で声質・演技を解析する。

Whisper では拾えない甘さ・威圧感・距離感・間・非言語音を、
トラック単位で構造化し auto_review の執筆入力に渡す。

使い方:
  cd scripts/gemini-hypnosis-review
  py -3 gemini_vocal_tone_by_part.py --slug <slug> --analysis-dir "C:\\path\\解析フォルダ"

出力:
  <analysis-dir>/vocal_tone_by_part.md
  vocal_tone_output.txt（auto_review 同ディレクトリ）
"""
from __future__ import annotations

import argparse
import os
import sys
import tempfile
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from google import genai  # noqa: E402
from google.genai import types  # noqa: E402

from gemini_audio_utils import (  # noqa: E402
    collect_audio_tracks,
    convert_to_upload_mp3,
    safety_settings,
    upload_files,
)

try:
    from dotenv import load_dotenv

    load_dotenv(SCRIPT_DIR / ".env", override=True)
except ImportError:
    pass

VOCAL_TONE_MODEL = os.environ.get(
    "GEMINI_VOCAL_TONE_MODEL",
    os.environ.get("GEMINI_AUDIO_EVAL_MODEL", "gemini-2.5-flash"),
)

VOCAL_TONE_SYSTEM = """\
あなたは催眠音声・同人音声のレビュー用に、**音声そのもの**から声質と演技を分析する専門家です。

## 任務
渡された **1トラック分** の音声だけを全編聴き、レビュー執筆に使える **客観に近い聴感データ** を日本語で出力する。

## 必須（パートごと）
- **甘さ**（0.0〜10.0・小数1桁可）… 声の柔らかさ・甘やかさ・包容感
- **威圧感**（0.0〜10.0）… 支配・圧・命令の重さ（低いほど穏やか）
- **距離感**（0.0〜10.0）… 耳元・密着感（高いほど近い）
- **テンポ・間** … 沈黙の置き方、緩急、催眠向きの間か
- **演技** … 感情の乗り、キャラの一貫性、喘ぎ・吐息・非言語音の質

## 根拠
- 各スコアに **1文の理由**
- **タイムスタンプ付き根拠**を 3〜6 件（`MM:SS` 形式。例: `12:34 囁きが一段低くなり威圧が増す`）
- 台本の想像ではなく **実際に聴こえる音** のみ

## 禁止
- 他トラックの内容を推測しない
- 医学効果・催眠成功率の断定
- スコアだけ並べて理由を省略しない

## 出力形式（Markdown・この見出し構造を厳守）

### スコア
| 軸 | 点数 | 理由（1文） |
|---|---:|---|
| 甘さ | x.x | … |
| 威圧感 | x.x | … |
| 距離感 | x.x | … |

### 聴感サマリ
（2〜4文。散文。記事にそのまま織り込める具体性）

### タイムスタンプ根拠
- `MM:SS` … （短い具体描写）

### 演技・非言語
- （箇条書き 2〜5 件。吐息・キス・SE・ミックス等）
"""


def needs_refresh(analysis_dir: Path, out_path: Path) -> bool:
    if not out_path.is_file():
        return True
    out_mtime = out_path.stat().st_mtime
    for audio, _ in collect_audio_tracks(analysis_dir):
        if audio.stat().st_mtime > out_mtime:
            return True
    return False


def analyze_part(
    client: genai.Client,
    track_name: str,
    mp3_path: Path,
    part_index: int,
    part_total: int,
) -> str:
    uploaded = upload_files(client, [mp3_path])
    prompt = (
        f"【パート {part_index}/{part_total}】トラック名: {track_name}\n"
        "添付音声を全編聴き、指定フォーマットで声質・演技を分析してください。"
    )
    for attempt in range(1, 6):
        try:
            resp = client.models.generate_content(
                model=VOCAL_TONE_MODEL,
                contents=list(uploaded) + [prompt],
                config=types.GenerateContentConfig(
                    system_instruction=VOCAL_TONE_SYSTEM,
                    temperature=0,
                    safety_settings=safety_settings(),
                ),
            )
            text = (resp.text or "").strip()
            if text:
                return text
            fb = resp.prompt_feedback
            print(f"  [警告] 空応答 (block: {getattr(fb, 'block_reason', fb)})")
        except Exception as exc:  # noqa: BLE001
            wait = min(2**attempt, 60)
            print(f"  [警告] 失敗 ({attempt}/5): {exc} — {wait}s 待機")
            time.sleep(wait)
    raise RuntimeError(f"声質解析失敗: {track_name}")


def run(
    slug: str,
    analysis_dir: Path,
    *,
    force: bool = False,
    work_dir: Path | None = None,
) -> Path:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("[エラー] GEMINI_API_KEY 未設定")
        sys.exit(1)

    ad = analysis_dir.resolve()
    if not ad.is_dir():
        print(f"[エラー] 解析フォルダがありません: {ad}")
        sys.exit(1)

    tracks = collect_audio_tracks(ad)
    if not tracks:
        print("[エラー] MP3/WAV が見つかりません")
        sys.exit(1)

    out_md = ad / "vocal_tone_by_part.md"
    out_txt = SCRIPT_DIR / "vocal_tone_output.txt"

    if not force and not needs_refresh(ad, out_md):
        print(f"[スキップ] 既存の声質解析を利用: {out_md}")
        text = out_md.read_text(encoding="utf-8")
        out_txt.write_text(text, encoding="utf-8")
        return out_md

    work = work_dir or Path(tempfile.gettempdir()) / f"vocal-tone-{slug}"
    work.mkdir(parents=True, exist_ok=True)

    print(f"[モデル] {VOCAL_TONE_MODEL}")
    print(f"[対象] {len(tracks)} トラック（WAV 優先・重複形式は除外）")

    client = genai.Client(api_key=api_key)
    sections: list[str] = [
        f"# 声質解析（パート別） slug={slug}",
        "",
        "Whisper では測れない甘さ・威圧感・距離感・演技の正本。記事の声描写は本データを優先すること。",
        "",
    ]

    total = len(tracks)
    for i, (audio_path, display_name) in enumerate(tracks, start=1):
        print(f"\n[{i}/{total}] {display_name} ({audio_path.name})")
        mp3 = work / f"part{i:02d}.mp3"
        convert_to_upload_mp3(audio_path, mp3)
        body = analyze_part(client, display_name, mp3, i, total)
        sections.extend(
            [
                f"## パート {i}: {display_name}",
                "",
                body,
                "",
                "---",
                "",
            ]
        )

    full = "\n".join(sections).rstrip() + "\n"
    out_md.write_text(full, encoding="utf-8")
    out_txt.write_text(full, encoding="utf-8")
    print(f"\n[完了] {out_md}")
    print(f"       → {out_txt}")
    return out_md


def main() -> None:
    p = argparse.ArgumentParser(description="パート別 Gemini 声質解析")
    p.add_argument("--slug", required=True)
    p.add_argument("--analysis-dir", type=Path, required=True)
    p.add_argument("--force", action="store_true", help="既存 MD があっても再生成")
    p.add_argument("--work-dir", type=Path, default=None)
    args = p.parse_args()
    run(args.slug, args.analysis_dir, force=args.force, work_dir=args.work_dir)


if __name__ == "__main__":
    main()
