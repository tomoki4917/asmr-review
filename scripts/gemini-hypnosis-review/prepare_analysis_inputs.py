#!/usr/bin/env python3
"""解析フォルダから whisper_output.txt / librosa_output.txt を生成。"""
from __future__ import annotations

import argparse
import csv
import statistics
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


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
    stems = sorted({p.stem.replace("_waveform", "") for p in ad.glob("*")})
    for stem in stems:
        if stem.lower() == "info":
            continue
        srt = ad / f"{stem}.srt"
        txt = ad / f"{stem}.txt"
        if srt.is_file():
            whisper_parts.append(f"\n===== {stem} (SRT) =====\n")
            whisper_parts.append(srt.read_text(encoding="utf-8"))
        elif txt.is_file():
            whisper_parts.append(f"\n===== {stem} (TXT) =====\n")
            whisper_parts.append(txt.read_text(encoding="utf-8"))

    librosa_lines = ["# Librosa 波形サマリ（トラック別）", ""]
    for wf in sorted(ad.glob("*_waveform.csv")):
        librosa_lines.append(summarize_waveform(wf))

    out_w = args.out_dir / "whisper_output.txt"
    out_l = args.out_dir / "librosa_output.txt"
    out_w.write_text("".join(whisper_parts), encoding="utf-8")
    out_l.write_text("\n".join(librosa_lines) + "\n", encoding="utf-8")
    print(f"whisper → {out_w} ({out_w.stat().st_size // 1024} KB)")
    print(f"librosa → {out_l}")


if __name__ == "__main__":
    main()
