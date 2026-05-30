"""執筆ガイド抜粋・禁止語検証（Gemini パイプライン共通）。"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
GUIDE_PATH = ROOT / "docs" / "催眠音声執筆ガイド.md"
FORBIDDEN_PATH = SCRIPT_DIR / "writer_forbidden.md"
REVIEWS_DIR = ROOT / "src" / "content" / "レビュー"

PROSE_KEY_SUFFIXES = (
    "SUMMARY",
    "ITEM_DESCRIPTION",
    "RECOMMENDED_1_REASON",
    "RECOMMENDED_2_REASON",
    "RECOMMENDED_3_REASON",
    "NOT_RECOMMENDED_1",
    "NOT_RECOMMENDED_2",
    "NOT_RECOMMENDED_1_REASON",
    "NOT_RECOMMENDED_2_REASON",
    "INDUCTION_FLOW",
    "CONCLUSION_INDUCTION",
    "CONCLUSION_PLEASURE",
    "CONCLUSION_FINAL",
)

TIME_NOT_RECOMMENDED_PATTERNS = (
    "短時間で完結",
    "短時間で終わ",
    "長尺が苦手",
    "時間がない方",
    "時間が長",
    "時間が短",
    "尺が長",
    "本編だけでも1時間",
    "要点だけ拾",
)

FORBIDDEN_IN_PROSE = (
    ("芯", "芯"),
    ("設計", "設計"),
    ("手順", "手順"),
    ("積み", "積み"),
    ("立ち上が", "立ち上が"),
    ("ほどく", "ほど[くけき]"),
    ("注意固定", "注意固定"),
)


def load_forbidden_rules() -> str:
    if FORBIDDEN_PATH.is_file():
        return FORBIDDEN_PATH.read_text(encoding="utf-8")
    return ""


def extract_guide_section(guide: str, start_marker: str, end_markers: tuple[str, ...]) -> str:
    """見出し文字列で区切って抜粋（見出し行を含む）。"""
    idx = guide.find(start_marker)
    if idx < 0:
        return ""
    rest = guide[idx:]
    end_idx = len(rest)
    for em in end_markers:
        pos = rest.find(em, len(start_marker))
        if pos > 0:
            end_idx = min(end_idx, pos)
    return rest[:end_idx].strip()


def load_guide_excerpts_for_writer() -> str:
    """本文執筆用: 禁止語 §7.1。"""
    if not GUIDE_PATH.is_file():
        return ""
    guide = GUIDE_PATH.read_text(encoding="utf-8")
    sec = extract_guide_section(
        guide,
        "**禁止語（発見したら即リライト）**",
        ("**NG → 代用の例**", "**見本（", "## "),
    )
    return sec


def load_guide_excerpts_for_impression() -> str:
    """作品感想用: §8.4 + 禁止語。"""
    if not GUIDE_PATH.is_file():
        return load_forbidden_rules()
    guide = GUIDE_PATH.read_text(encoding="utf-8")
    sec84 = extract_guide_section(
        guide,
        "### 8.4 作品感想",
        ("### 8.", "## 9.", "---"),
    )
    forbidden = extract_guide_section(
        guide,
        "**禁止語（発見したら即リライト）**",
        ("**NG → 代用の例**",),
    )
    parts = [load_forbidden_rules(), sec84, forbidden]
    return "\n\n".join(p for p in parts if p.strip())


def strip_block_quotes(text: str) -> str:
    """INDUCTION_FLOW 等の台詞引用行を検証対象から除外。"""
    lines = []
    for line in text.splitlines():
        if line.strip().startswith(">"):
            continue
        lines.append(line)
    return "\n".join(lines)


def find_forbidden_in_text(text: str) -> list[str]:
    warnings: list[str] = []
    plain = strip_block_quotes(text)
    for label, pattern in FORBIDDEN_IN_PROSE:
        if label == "ほどく":
            if re.search(pattern, plain):
                warnings.append(f"禁止語「{label}」系")
        elif label == "注意固定":
            if "注意固定" in plain or re.search(r"注意(?:を|が|へ)[^。\n]{0,24}固定", plain):
                warnings.append(f"禁止語「{label}」系")
        elif pattern in plain:
            warnings.append(f"禁止語「{label}」")
    return warnings


def find_time_not_recommended(text: str) -> list[str]:
    warnings: list[str] = []
    plain = strip_block_quotes(text)
    for pattern in TIME_NOT_RECOMMENDED_PATTERNS:
        if pattern in plain:
            warnings.append(f"合わない: 時間／尺理由「{pattern}」")
    return warnings


def validate_prose_keys(keys: dict[str, str]) -> list[str]:
    """[KEY] 散文の禁止語チェック（警告文リスト）。"""
    warnings: list[str] = []
    for key, val in keys.items():
        if not val.strip():
            continue
        if key in PROSE_KEY_SUFFIXES or key.endswith("_REASON"):
            for w in find_forbidden_in_text(val):
                warnings.append(f"{key}: {w}")
        if key in ("NOT_RECOMMENDED_1", "NOT_RECOMMENDED_2") or key.endswith("_REASON") and key.startswith("NOT_RECOMMENDED"):
            for w in find_time_not_recommended(val):
                warnings.append(f"{key}: {w}")
        for sk in ("STRONG_INDUCTION_ROWS", "STRONG_SUGGESTION_ROWS"):
            if key == sk and any(x in val for x in ("芯", "手順", "積み", "設計")):
                warnings.append(f"{sk}: 禁止語が含まれています")
    return warnings


def strip_frontmatter(text: str) -> str:
    return re.sub(r"^---[\s\S]*?---\n?", "", text)


def validate_index_md(text: str) -> list[str]:
    """index.md 本文の禁止語（台詞引用 > 行は除外）。"""
    body = strip_frontmatter(text)
    hits = find_forbidden_in_text(body)
    errors = [f"index.md: {h}" for h in hits]
    if "**【合わない可能性がある人】**" in body:
        section = body.split("**【合わない可能性がある人】**", 1)[1]
        section = section.split("\n\n---", 1)[0]
        for w in find_time_not_recommended(section):
            errors.append(f"index.md: {w}")
    return errors


def parse_review_output_keys(path: Path) -> dict[str, str]:
    """review_output.md から [KEY] ブロックとスカラー行を粗く抽出。"""
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8")
    keys: dict[str, str] = {}
    for m in re.finditer(r"\[([A-Z0-9_]+)\]\s*\n([\s\S]*?)\n\[/\1\]", text):
        keys[m.group(1)] = m.group(2).strip()
    for m in re.finditer(r"^([A-Z][A-Z0-9_]*):\s*(.+)$", text, re.MULTILINE):
        k = m.group(1)
        if k not in keys:
            keys[k] = m.group(2).strip()
    return keys


def validate_slug(slug: str, *, draft_path: Path | None = None) -> list[str]:
    errors: list[str] = []
    index_path = REVIEWS_DIR / slug / "index.md"
    draft = draft_path or SCRIPT_DIR / "review_output.md"
    if draft.is_file():
        errors.extend(validate_prose_keys(parse_review_output_keys(draft)))
    if index_path.is_file():
        errors.extend(validate_index_md(index_path.read_text(encoding="utf-8")))
    return errors


def main() -> None:
    p = argparse.ArgumentParser(description="催眠レビュー散文の禁止語検証（執筆ガイド §7.1）")
    p.add_argument("--slug", help="検証対象 slug")
    p.add_argument("--draft", type=Path, help="review_output.md のパス")
    p.add_argument("--index", type=Path, help="index.md のパス")
    args = p.parse_args()

    if not (args.slug or args.draft or args.index):
        p.error("--slug / --draft / --index のいずれかを指定してください")

    errors: list[str] = []
    if args.draft:
        errors.extend(validate_prose_keys(parse_review_output_keys(args.draft)))
    if args.index:
        errors.extend(validate_index_md(args.index.read_text(encoding="utf-8")))
    if args.slug:
        if not args.draft and not args.index:
            errors.extend(validate_slug(args.slug))
        elif not args.index:
            index_path = REVIEWS_DIR / args.slug / "index.md"
            if index_path.is_file():
                errors.extend(validate_index_md(index_path.read_text(encoding="utf-8")))

    if errors:
        print("執筆ルール違反（docs/催眠音声執筆ガイド.md §7.1 / writer_forbidden.md）:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)

    print("OK: 禁止語チェックを通過しました。")


if __name__ == "__main__":
    main()
