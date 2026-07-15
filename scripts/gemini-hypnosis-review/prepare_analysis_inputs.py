#!/usr/bin/env python3
"""解析フォルダから whisper_output.txt / librosa_output.txt を生成。"""
from __future__ import annotations

import argparse
import csv
import statistics
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent

TRANSCRIPT_COMPANION_EXTS = (".srt", ".tsv", ".vtt", ".json", ".wav")


def read_text_any(path: Path) -> str:
    """UTF-8 → cp932 → UTF-8(ignore) の順で読む（注意事項が Shift-JIS のことがある）。"""
    for enc in ("utf-8", "cp932", "utf-8-sig"):
        try:
            return path.read_text(encoding=enc)
        except UnicodeDecodeError:
            continue
    return path.read_text(encoding="utf-8", errors="ignore")


def summarize_waveform(csv_path: Path) -> str:
    rms_vals: list[float] = []
    cent_vals: list[float] = []
    max_ts = 0.0
    with csv_path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                ts = float(row["timestamp_sec"])
                rms = float(row["amplitude_rms"])
                cent = float(row["frequency_centroid_hz"])
            except (KeyError, ValueError):
                continue
            max_ts = max(max_ts, ts)
            rms_vals.append(rms)
            cent_vals.append(cent)
    if not rms_vals:
        return f"{csv_path.stem}: （データなし）"
    silence = sum(1 for v in rms_vals if v < 0.01) / len(rms_vals)
    return (
        f"{csv_path.stem}: duration≈{max_ts:.1f}s, "
        f"rms_mean={statistics.mean(rms_vals):.6f}, rms_max={max(rms_vals):.4f}, "
        f"centroid_mean={statistics.mean(cent_vals):.1f}Hz, silence_ratio≈{silence:.3f}"
    )


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("analysis_dir", type=Path, help="解析フォルダ（txt / *_waveform.csv）")
    p.add_argument("--out-dir", type=Path, default=SCRIPT_DIR)
    args = p.parse_args()
    ad = args.analysis_dir
    if not ad.is_dir():
        print(f"[エラー] フォルダがありません: {ad}", file=sys.stderr)
        sys.exit(1)

    whisper_parts: list[str] = []
    # トップ直下＋ネスト（音声/トラック配下の Whisper 出力）
    candidate_files: list[Path] = []
    for pat in ("*.srt", "*.txt"):
        candidate_files.extend(ad.rglob(pat))

    seen_stems: set[str] = set()
    for path in sorted(candidate_files, key=lambda p: str(p).lower()):
        stem = path.stem
        low = path.name.lower()
        if low in ("info.txt", "readme.txt", "product-meta.json"):
            continue
        if stem.lower() in ("info", "product-meta", "readme"):
            continue
        # 波形CSVの相方だけなど除外済み。同一 stem の srt/txt は1回
        rel_key = str(path.with_suffix("").relative_to(ad)).lower()
        if rel_key in seen_stems:
            continue
        parent = path.parent
        has_companion = any(
            (parent / f"{stem}{ext}").is_file() for ext in TRANSCRIPT_COMPANION_EXTS
        )
        if path.suffix.lower() == ".txt" and not has_companion:
            continue
        seen_stems.add(rel_key)
        label = path.relative_to(ad).as_posix()
        if path.suffix.lower() == ".srt":
            whisper_parts.append(f"\n===== {label} (SRT) =====\n")
            whisper_parts.append(read_text_any(path))
        elif path.suffix.lower() == ".txt":
            # 同 stem の srt があれば txt はスキップ（重複）
            if (parent / f"{stem}.srt").is_file():
                continue
            whisper_parts.append(f"\n===== {label} (TXT) =====\n")
            whisper_parts.append(read_text_any(path))

    librosa_lines = ["# Librosa 波形サマリ（トラック別）", ""]
    for wf in sorted(ad.rglob("*_waveform.csv")):
        librosa_lines.append(summarize_waveform(wf))

    out_w = args.out_dir / "whisper_output.txt"
    out_l = args.out_dir / "librosa_output.txt"
    out_w.write_text("".join(whisper_parts), encoding="utf-8")
    out_l.write_text("\n".join(librosa_lines) + "\n", encoding="utf-8")
    print(f"whisper → {out_w} ({out_w.stat().st_size // 1024} KB)")
    print(f"librosa → {out_l}")


if __name__ == "__main__":
    main()
