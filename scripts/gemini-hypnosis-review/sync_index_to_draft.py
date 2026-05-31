#!/usr/bin/env python3
"""index.md から humanize 対象キーを review_output.md に反映（メタ・採点は維持）。"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from auto_review import replace_key_block  # noqa: E402


def yaml_block(text: str, key: str) -> str:
    m = re.search(rf"^{key}: \|\n((?:  .*\n?)*)", text, re.MULTILINE)
    if not m:
        m = re.search(rf"^{key}:\s*(.+)$", text, re.MULTILINE)
        return m.group(1).strip() if m else ""
    return "\n".join(ln[2:] if ln.startswith("  ") else ln for ln in m.group(1).rstrip().splitlines())


def rec_block(text: str, n: int, not_: bool = False) -> tuple[str, str]:
    prefix = "合わない" if not_ else "おすすめ"
    items = re.findall(
        r"- \*\*(.+?)\*\*\s*\n\s*(.+?)(?=\n\n- \*\*|\n\n---|\n\n## )",
        text,
        re.DOTALL,
    )
    if not_:
        start = text.find("**【合わない可能性がある人】**")
        chunk = text[start:] if start >= 0 else ""
        items = re.findall(
            r"- \*\*(.+?)\*\*\s*\n\s*(.+?)(?=\n\n---|\n\n## )",
            chunk,
            re.DOTALL,
        )
    else:
        start = text.find("**【こんな人におすすめ】**")
        end = text.find("**【合わない")
        chunk = text[start:end] if start >= 0 else ""
        items = re.findall(
            r"- \*\*(.+?)\*\*\s*\n\s*(.+?)(?=\n\n- \*\*|\n\n\*\*【合わない)",
            chunk,
            re.DOTALL,
        )
    if len(items) < n:
        return "", ""
    lab, reason = items[n - 1]
    return lab.strip(), reason.strip()


def table_rows(text: str, heading: str) -> str:
    m = re.search(
        rf"### {re.escape(heading)}.*?^\| 特性 \| スコア \| .*?\n\|---\|--:|---\|\n(.*?)(?=\n\n### |\n\n<!--|\n\n## )",
        text,
        re.DOTALL | re.MULTILINE,
    )
    return m.group(1).strip() if m else ""


def section_after(text: str, heading: str) -> str:
    m = re.search(
        rf"### {re.escape(heading)}\s*\n\n(.*?)(?=\n\n### |\n\n## |\Z)",
        text,
        re.DOTALL,
    )
    return m.group(1).strip() if m else ""


def main() -> None:
    slug = sys.argv[1]
    index_path = ROOT / "src" / "content" / "レビュー" / slug / "index.md"
    draft_path = SCRIPT_DIR / "review_output.md"
    idx = index_path.read_text(encoding="utf-8")
    draft = draft_path.read_text(encoding="utf-8")

    mapping = {
        "SUMMARY": yaml_block(idx, "summary"),
        "ITEM_DESCRIPTION": yaml_block(idx, "itemDescription"),
        "INDUCTION_FLOW": section_after(idx, "主要誘導の流れ（作品の流れ）"),
        "CONCLUSION_INDUCTION": section_after(idx, "【誘導の組み立て】"),
        "CONCLUSION_PLEASURE": section_after(idx, "【快感が発生する仕組み】"),
        "CONCLUSION_FINAL": section_after(idx, "【結論】"),
        "STRONG_INDUCTION_ROWS": table_rows(idx, "本作で特に強い誘導特性"),
        "STRONG_SUGGESTION_ROWS": table_rows(idx, "本作で特に強い暗示特性"),
    }
    for i in (1, 2, 3):
        lab, rea = rec_block(idx, i, not_=False)
        mapping[f"RECOMMENDED_{i}"] = lab
        mapping[f"RECOMMENDED_{i}_REASON"] = rea
    for i in (1, 2):
        lab, rea = rec_block(idx, i, not_=True)
        mapping[f"NOT_RECOMMENDED_{i}"] = lab
        mapping[f"NOT_RECOMMENDED_{i}_REASON"] = rea

    # スカラー更新
    draft = re.sub(r"^SALE_DATE_DISPLAY:.*$", "SALE_DATE_DISPLAY: 2026年2月28日（販売ページ表記）", draft, flags=re.M)
    draft = re.sub(r"^GENRE_TYPE:.*$", "GENRE_TYPE: 催眠音声（メスイキ・人外・身体変容）", draft, flags=re.M)
    draft = re.sub(r"^DRY_SCENE_COUNT:.*$", "DRY_SCENE_COUNT: 複数", draft, flags=re.M)

    for key, val in mapping.items():
        if val:
            draft = replace_key_block(draft, key, val)
            draft = re.sub(
                rf"^\[{re.escape(key)}\]:.*$",
                f"[{key}]: {val.split(chr(10))[0][:80]}",
                draft,
                count=1,
                flags=re.MULTILINE,
            )

    draft_path.write_text(draft, encoding="utf-8")
    print(f"[sync] {draft_path} ← {index_path}")


if __name__ == "__main__":
    main()
