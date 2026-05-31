#!/usr/bin/env python3
"""review_output.md の人間味改稿キーを既存 index.md に部分反映（merge-only は使わない）。"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from auto_review import normalize_induction_flow, parse_gemini_keys  # noqa: E402


def extract_block(draft: str, key: str) -> str:
    m = re.search(rf"\[{re.escape(key)}\]\s*\n(.*?)\[/{re.escape(key)}\]", draft, re.DOTALL)
    return m.group(1).strip() if m else ""


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: patch_humanize_to_index.py <slug>")
        sys.exit(1)
    slug = sys.argv[1]
    draft = (SCRIPT_DIR / "review_output.md").read_text(encoding="utf-8")
    index_path = ROOT / "src" / "content" / "レビュー" / slug / "index.md"
    idx = index_path.read_text(encoding="utf-8")
    keys = parse_gemini_keys(draft)

    if keys.get("SUMMARY"):
        idx = re.sub(
            r"(?ms)(^summary: \|\n)(.*?)(?=^tags:)",
            lambda m: m.group(1) + indent_yaml(keys["SUMMARY"]) + "\n",
            idx,
            count=1,
            flags=re.DOTALL,
        )
    if keys.get("ITEM_DESCRIPTION"):
        idx = re.sub(
            r"(?ms)(^itemDescription: \|\n)(.*?)(?=^authorName:)",
            lambda m: m.group(1) + indent_yaml(keys["ITEM_DESCRIPTION"]) + "\n",
            idx,
            count=1,
            flags=re.DOTALL,
        )

    for n in (1, 2, 3):
        lab, rea = f"RECOMMENDED_{n}", f"RECOMMENDED_{n}_REASON"
        if keys.get(lab) and keys.get(rea):
            block = idx.split("**【こんな人におすすめ】**", 1)
            if len(block) < 2:
                continue
            chunk = block[1].split("**【合わない可能性がある人】**", 1)[0]
            new_item = f"- **{keys[lab]}**  \n  {keys[rea]}"
            chunk_new = re.sub(
                r"- \*\*.*?\*\*\s*\n\s*.*?(?=\n\n- \*\*|\n\n\*\*【合わない)",
                new_item,
                chunk,
                count=1,
                flags=re.DOTALL,
            )
            rest = block[1][len(chunk):]
            idx = block[0] + "**【こんな人におすすめ】**" + chunk_new + rest
    for n in (1, 2):
        lab, rea = f"NOT_RECOMMENDED_{n}", f"NOT_RECOMMENDED_{n}_REASON"
        if keys.get(lab) and keys.get(rea):
            block = idx.split("**【合わない可能性がある人】**", 1)
            if len(block) < 2:
                continue
            tail = block[1].split("\n\n---", 1)[0]
            new_item = f"- **{keys[lab]}**  \n  {keys[rea]}"
            tail_new = re.sub(
                r"- \*\*.*?\*\*\s*\n\s*.*?(?=\n\n---|\Z)",
                new_item,
                tail,
                count=1,
                flags=re.DOTALL,
            )
            idx = block[0] + "**【合わない可能性がある人】**" + tail_new + block[1][len(tail):]

    if keys.get("STRONG_INDUCTION_ROWS"):
        idx = replace_table_rows(idx, "本作で特に強い誘導特性", keys["STRONG_INDUCTION_ROWS"])
    if keys.get("STRONG_SUGGESTION_ROWS"):
        idx = replace_table_rows(idx, "本作で特に強い暗示特性", keys["STRONG_SUGGESTION_ROWS"])

    if keys.get("INDUCTION_FLOW"):
        flow = normalize_induction_flow(keys["INDUCTION_FLOW"])
        replaced = re.sub(
            r"(### 主要誘導の流れ（作品の流れ）\s*\n)(.*?)(---\s*\n\s*\n## パート別解析)",
            rf"\1{flow}\n\n\3",
            idx,
            count=1,
            flags=re.DOTALL,
        )
        if replaced != idx:
            idx = replaced
        else:
            idx = re.sub(
                r"(### 主要誘導の流れ（作品の流れ）\s*\n)(.*?)(---\s*\n\s*\n## 総評[^\n]*\n)",
                rf"\1{flow}\n\n\3",
                idx,
                count=1,
                flags=re.DOTALL,
            )

    for ck, heading in (
        ("CONCLUSION_INDUCTION", "【誘導の組み立て】"),
        ("CONCLUSION_PLEASURE", "【快感が発生する仕組み】"),
        ("CONCLUSION_FINAL", "【結論】"),
    ):
        if keys.get(ck):
            idx = re.sub(
                rf"(### {re.escape(heading)}\s*\n\n)(.*?)(?=\n\n### |\n\n## |\Z)",
                rf"\1{keys[ck].strip()}\n",
                idx,
                count=1,
                flags=re.DOTALL,
            )

    index_path.write_text(idx, encoding="utf-8")
    print(f"[patch] 更新: {index_path}")


def indent_yaml(text: str) -> str:
    lines = text.strip().splitlines()
    return "\n".join("  " + ln if ln.strip() else ln for ln in lines)


def replace_table_rows(idx: str, section: str, rows: str) -> str:
    pat = rf"(### {re.escape(section)}.*?^\| 特性 \| スコア \| 誘導で起きる効果 \|\n\|---\|--:|---\|\n)(.*?)(?=\n\n### |\n\n<!--)"
    if "暗示" in section:
        pat = rf"(### {re.escape(section)}.*?^\| 特性 \| スコア \| 暗示で起きる効果 \|\n\|---\|--:|---\|\n)(.*?)(?=\n\n### |\n\n<!--)"
    m = re.search(pat, idx, re.DOTALL | re.MULTILINE)
    if not m:
        return idx
    body = rows.strip()
    if not body.startswith("|"):
        body = rows.strip()
    return idx[: m.start(2)] + body + "\n" + idx[m.end(2) :]


if __name__ == "__main__":
    main()
