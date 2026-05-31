#!/usr/bin/env python3
"""B型 merge-only 時に既存 index.md の A型拡張ブロックを失わない（§1 再発防止）。

全面再生成（--force --no-preserve-sections）では使わない。
.cursor/rules/review-no-past-article-reference.mdc 参照。
"""
from __future__ import annotations

import re

PRESERVE_KEYS = ("graph_breakdown", "part_analysis")


def extract_preserved_sections(index_md: str) -> dict[str, str]:
    """既存 index からマージ原紙に無いブロックを抽出。"""
    out: dict[str, str] = {}

    m = re.search(
        r"(\*\*グラフ評価内訳\*\*\s*\n(?:.*?\n)*?)(?=\n## 解析結論)",
        index_md,
        re.DOTALL,
    )
    if m:
        out["graph_breakdown"] = m.group(1).strip() + "\n"

    m = re.search(
        r"(## パート別解析\s*\n(?:.*?\n)*?)(?=\n---\s*\n\s*\n## 総評|\n## 総評)",
        index_md,
        re.DOTALL,
    )
    if m:
        out["part_analysis"] = m.group(1).strip() + "\n"

    return out


def _strip_block(text: str, pattern: str) -> str:
    return re.sub(pattern, "", text, count=1, flags=re.DOTALL)


def inject_preserved_sections(merged_md: str, preserved: dict[str, str]) -> str:
    """マージ後 index に保持ブロックを差し込む（重複は除去してから1回だけ）。"""
    if not preserved:
        return merged_md

    out = merged_md

    if preserved.get("graph_breakdown"):
        out = _strip_block(
            out,
            r"\*\*グラフ評価内訳\*\*\s*\n(?:.*?\n)*?(?=\n## 解析結論)",
        )
        out = re.sub(
            r"(!\[作品評価グラフ[^\n]*\n)\n(## 解析結論)",
            rf"\1\n\n{preserved['graph_breakdown']}\n\2",
            out,
            count=1,
        )

    if preserved.get("part_analysis"):
        out = _strip_block(
            out,
            r"## パート別解析\s*\n(?:.*?\n)*?(?=\n---\s*\n\s*\n## 総評|\n## 総評)",
        )
        out = re.sub(
            r"(### 主要誘導の流れ（作品の流れ）\s*\n.*?\n---\s*\n)\n(## 総評[^\n]*\n)",
            rf"\1\n{preserved['part_analysis']}\n\n---\n\n\2",
            out,
            count=1,
            flags=re.DOTALL,
        )

    return out


def count_part_analysis_headings(text: str) -> int:
    body = re.sub(r"^---[\s\S]*?---\n?", "", text)
    return len(re.findall(r"^## パート別解析\s*$", body, re.MULTILINE))
