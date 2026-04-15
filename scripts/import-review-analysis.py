# -*- coding: utf-8 -*-
"""
解析フォルダから、音声を除いた分析成果物を src/content/レビュー/<slug>/analysis/ にコピーする。
除外: .mp3 / .wav / .m4a / .flac / .aac / .ogg（リポジトリ容量・静的配信のため元音声は置かない）。

例:
  py -3 scripts/import-review-analysis.py "C:\\path\\to\\解析フォルダ" kuchikou-saimin-count-trip-nouiki
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REVIEW = ROOT / "src" / "content" / "レビュー"

# 解析フォルダにあってもレビュー用 analysis/ には入れない（他レビューと同様、音声は同梱しない）
_SKIP_AUDIO_SUFFIXES = frozenset({".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg"})


def copy_analysis(src_dir: Path, slug: str) -> int:
    if not src_dir.is_dir():
        print(f"エラー: ソースがありません: {src_dir}", file=sys.stderr)
        return 1
    dest_dir = REVIEW / slug / "analysis"
    dest_dir.mkdir(parents=True, exist_ok=True)
    n = 0
    for p in src_dir.iterdir():
        if not p.is_file():
            continue
        if p.suffix.lower() in _SKIP_AUDIO_SUFFIXES:
            continue
        shutil.copy2(p, dest_dir / p.name)
        n += 1
    print(f"{n} files -> {dest_dir}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Copy analysis files (excluding audio) into review analysis/ folder.")
    ap.add_argument("source", type=Path, help="解析データのフォルダ（音声拡張子を除くファイルをコピー）")
    ap.add_argument("slug", help="レビューのスラッグ（index.md の slug と一致）")
    args = ap.parse_args()
    return copy_analysis(args.source.resolve(), args.slug)


if __name__ == "__main__":
    raise SystemExit(main())
