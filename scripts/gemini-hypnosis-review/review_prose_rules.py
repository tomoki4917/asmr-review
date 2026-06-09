"""執筆ガイド抜粋・禁止語検証（Gemini パイプライン共通）。"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
GUIDE_PATH = ROOT / "docs" / "催眠音声執筆ガイド.md"
ALL_AGES_SCENARIO_GUIDE_PATH = (
    ROOT / "docs" / "全年齢シチュエーションボイス執筆ガイド.md"
)
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

PLEASURE_URGE_NOT_RECOMMENDED_PATTERNS = (
    "すぐに快感を求め",
    "快感を急い",
    "すぐに絶頂へ",
    "じれった",
    "深化に時間をかけ",
)

# 全年齢同人：R18 前提の当たり前を合わない理由にしない（全年齢シチュガイド §5.1）
ALL_AGES_R18_NOT_RECOMMENDED_PATTERNS = (
    "直接的な性的描写",
    "露骨な性的描写",
    "性描写を期待",
    "性描写がない",
    "エロ描写",
    "R18向け",
    "R18向",
    "全年齢なのに",
)

SUMMARY_TIME_BANNED_SUBSTRINGS = (
    "長尺",
    "短尺",
    "中尺",
    "約1時間",
    "約2時間",
    "約3時間",
    "約50分",
    "約40分",
    "約30分",
    "約60分",
    "約90分",
    "分超",
    "時間超",
    "長時間の",
    "短時間の",
    "時間がかか",
    "尺が",
)

SUMMARY_TIME_BANNED_REGEX = (
    re.compile(r"約\d+分"),
    re.compile(r"約\d+時間"),
    re.compile(r"\d+時間\d+分"),
    re.compile(r"\d+分の催眠"),
    re.compile(r"\d+時間の催眠"),
)

FORBIDDEN_IN_PROSE = (
    ("芯", "芯"),
    ("設計", "設計"),
    ("手順", "手順"),
    ("積み", "積み"),
    ("立ち上が", "立ち上が"),
    ("ほどく", "ほど[くけき]"),
    ("固定", "固定"),
)

# 論文・Gemini 典型の抽象積み上げ（§7.1 AI調・総評三柱）
AI_PHRASE_PATTERNS = (
    ("上位帯の厚み", "上位帯の厚み"),
    ("融合と重なり", "融合と重なり"),
    ("畳みかけとして", "畳みかけとして"),
    ("体験を提供", "体験を提供"),
    ("多角的に組み合わせ", "多角的に組み合わせ"),
    ("緻密な構成が特徴", "緻密な構成が特徴"),
    ("成功した体験", "成功した体験"),
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


def load_guide_excerpts_for_impression(slug: str | None = None) -> str:
    """作品感想用: 催眠 §8.4 または全年齢 §10 + 禁止語。"""
    index_text = ""
    if slug:
        index_path = ROOT / "src" / "content" / "レビュー" / slug / "index.md"
        if index_path.is_file():
            index_text = index_path.read_text(encoding="utf-8")

    if index_text and is_all_ages_doujin_review(index_text):
        if not ALL_AGES_SCENARIO_GUIDE_PATH.is_file():
            return load_forbidden_rules()
        guide = ALL_AGES_SCENARIO_GUIDE_PATH.read_text(encoding="utf-8")
        sec10 = extract_guide_section(
            guide,
            "## 10. 作品感想",
            ("## 11.", "---"),
        )
        parts = [load_forbidden_rules(), sec10]
        return "\n\n".join(p for p in parts if p.strip())

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


def _plain_without_kotei_exceptions(plain: str) -> str:
    """表内特性ラベル【…固定…】を除いた検査用テキスト。"""
    return re.sub(r"【[^】]*固定[^】]*】", "", plain)


def _plain_without_official_headings(plain: str) -> str:
    """同人総評の公式見出し（設計の要点 等）は禁止語検査から除外。"""
    lines = []
    for line in plain.splitlines():
        if re.match(r"^### 【設計の要点】\s*$", line.strip()):
            continue
        lines.append(line)
    return "\n".join(lines)


def find_ai_phrases_in_text(text: str) -> list[str]:
    """論文調・説明書調の AI 典型句（場面・身体感で書き直す）。"""
    warnings: list[str] = []
    plain = _plain_without_official_headings(strip_block_quotes(text))
    for label, pattern in AI_PHRASE_PATTERNS:
        if pattern in plain:
            warnings.append(f"AI調「{label}」")
    return warnings


def find_forbidden_in_text(text: str) -> list[str]:
    warnings: list[str] = []
    plain = _plain_without_official_headings(strip_block_quotes(text))
    for label, pattern in FORBIDDEN_IN_PROSE:
        if label == "ほどく":
            if re.search(pattern, plain):
                warnings.append(f"禁止語「{label}」系")
        elif label == "固定":
            if "固定" in _plain_without_kotei_exceptions(plain):
                warnings.append(f"禁止語「{label}」")
        elif pattern in plain:
            warnings.append(f"禁止語「{label}」")
    warnings.extend(find_ai_phrases_in_text(text))
    return warnings


def find_time_not_recommended(text: str) -> list[str]:
    warnings: list[str] = []
    plain = strip_block_quotes(text)
    for pattern in TIME_NOT_RECOMMENDED_PATTERNS:
        if pattern in plain:
            warnings.append(f"合わない: 時間／尺理由「{pattern}」")
    return warnings


def find_pleasure_urge_not_recommended(text: str) -> list[str]:
    warnings: list[str] = []
    plain = strip_block_quotes(text)
    for pattern in PLEASURE_URGE_NOT_RECOMMENDED_PATTERNS:
        if pattern in plain:
            warnings.append(f"合わない: 快感欲求理由「{pattern}」")
    return warnings


def is_all_ages_doujin_review(text: str) -> bool:
    return bool(re.search(r"^\s*-\s+全年齢同人\s*$", text, re.MULTILINE))


def find_all_ages_r18_not_recommended(text: str) -> list[str]:
    """全年齢同人：性描写の有無を合わない理由にしない。"""
    warnings: list[str] = []
    plain = strip_block_quotes(text)
    for pattern in ALL_AGES_R18_NOT_RECOMMENDED_PATTERNS:
        if pattern in plain:
            warnings.append(f"全年齢合わない禁止「{pattern}」")
    if re.search(r"肉体的な刺激を求める", plain):
        warnings.append("全年齢合わない禁止「肉体的な刺激を求める」")
    return warnings


def find_summary_time_banned(text: str) -> list[str]:
    """§0.3 summary リード: 時間・尺を連想させる語を禁止。"""
    warnings: list[str] = []
    plain = strip_block_quotes(text)
    for pattern in SUMMARY_TIME_BANNED_SUBSTRINGS:
        if pattern in plain:
            warnings.append(f"リード: 時間／尺禁止「{pattern}」")
    for rx in SUMMARY_TIME_BANNED_REGEX:
        if rx.search(plain):
            warnings.append(f"リード: 時間／尺禁止（{rx.pattern}）")
    return warnings


def extract_index_summary(text: str) -> str:
    m = re.search(r"^summary:\s*\|\s*\n([\s\S]*?)(?=\n\w|\n---)", text, re.MULTILINE)
    return m.group(1).strip() if m else ""


def gather_impression_banned_names(slug: str) -> list[str]:
    """作品感想に書いてはいけないサークル名・声優名のみ（index / quickGuide）。

    tags のフェチ・作品タグ（耳舐め・添い寝・神様 等）は禁止しない。
    """
    index_path = REVIEWS_DIR / slug / "index.md"
    if not index_path.is_file():
        return []
    text = index_path.read_text(encoding="utf-8")
    names: list[str] = []
    seen: set[str] = set()

    def add(name: str) -> None:
        n = name.strip().strip('"').strip("'")
        if not n or len(n) < 2 or n in seen:
            return
        seen.add(n)
        names.append(n)

    if m := re.search(r"^circleName:\s*(.+)$", text, re.MULTILINE):
        add(m.group(1))

    if m := re.search(r"\*\*CV：\*\* (.+)", text):
        for part in re.split(r"[／/、,]", m.group(1)):
            add(part.strip())

    page_path = ROOT / "src" / "app" / "(public)" / "reviews" / "[slug]" / "page.tsx"
    if page_path.is_file():
        tsx = page_path.read_text(encoding="utf-8")
        block_m = re.search(
            rf'"{re.escape(slug)}"\s*:\s*\{{([\s\S]*?)\n    \}},',
            tsx,
        )
        if block_m:
            va_m = re.search(r'voiceActor:\s*"([^"]+)"', block_m.group(1))
            if va_m:
                for part in re.split(r"[／/、,]", va_m.group(1)):
                    add(part.strip())

    return names


def find_circle_cv_in_impression(text: str, names: list[str]) -> list[str]:
    warnings: list[str] = []
    for name in names:
        if name in text:
            warnings.append(f"作品感想: サークル名・声優名禁止「{name}」")
        if f"{name}氏" in text:
            warnings.append(f"作品感想: 声優名禁止「{name}氏」")
    return warnings


SCORE_IN_IMPRESSION_SUBSTRINGS = (
    "★",
    "総合★",
    "トランス度",
    "快楽度",
    "満足度",
    "三軸",
)
SCORE_IN_IMPRESSION_REGEX = (
    re.compile(r"トランス度?\s*[\d\.]+"),
    re.compile(r"快楽度?\s*[\d\.]+"),
    re.compile(r"満足度?\s*[\d\.]+"),
    re.compile(r"★\s*[\d]+"),
    re.compile(r"[\d]+台"),
)


def find_score_in_impression(text: str) -> list[str]:
    warnings: list[str] = []
    for s in SCORE_IN_IMPRESSION_SUBSTRINGS:
        if s in text:
            warnings.append(f"作品感想: 点数・採点禁止「{s}」")
    for rx in SCORE_IN_IMPRESSION_REGEX:
        for m in rx.finditer(text):
            warnings.append(f"作品感想: 点数・採点禁止「{m.group(0)}」")
    return warnings


def extract_work_impression_paragraphs_from_page(slug: str) -> list[str]:
    page_path = ROOT / "src" / "app" / "(public)" / "reviews" / "[slug]" / "page.tsx"
    if not page_path.is_file():
        return []
    tsx = page_path.read_text(encoding="utf-8")
    block_m = re.search(
        rf'"{re.escape(slug)}"\s*:\s*\{{([\s\S]*?)\n    \}},',
        tsx,
    )
    if not block_m:
        return []
    paras: list[str] = []
    in_block = False
    for line in block_m.group(1).splitlines():
        if "workImpressionParagraphs:" in line:
            in_block = True
            continue
        if in_block:
            if line.strip() == "],":
                break
            m = re.match(r'\s+"((?:\\.|[^"\\])*)"', line)
            if m:
                paras.append(
                    m.group(1)
                    .replace('\\"', '"')
                    .replace("\\n", "\n")
                )
    return paras


def validate_work_impression_for_slug(slug: str) -> list[str]:
    paras = extract_work_impression_paragraphs_from_page(slug)
    if not paras:
        return []
    blob = "\n".join(paras)
    warnings = find_circle_cv_in_impression(blob, gather_impression_banned_names(slug))
    warnings.extend(find_score_in_impression(blob))
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
        if key == "SUMMARY":
            for w in find_summary_time_banned(val):
                warnings.append(f"{key}: {w}")
        if key in ("NOT_RECOMMENDED_1", "NOT_RECOMMENDED_2") or key.endswith("_REASON") and key.startswith("NOT_RECOMMENDED"):
            for w in find_time_not_recommended(val):
                warnings.append(f"{key}: {w}")
            for w in find_pleasure_urge_not_recommended(val):
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
        for w in find_pleasure_urge_not_recommended(section):
            errors.append(f"index.md: {w}")
        if is_all_ages_doujin_review(text):
            for w in find_all_ages_r18_not_recommended(section):
                errors.append(f"index.md: {w}")
    from merge_preserve_sections import count_part_analysis_headings  # noqa: PLC0415

    if count_part_analysis_headings(text) > 1:
        errors.append("index.md: ## パート別解析 が2回以上（merge 重複）")
    summary = extract_index_summary(text)
    if summary:
        for w in find_summary_time_banned(summary):
            errors.append(f"index.md summary: {w}")
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
    index_text = index_path.read_text(encoding="utf-8") if index_path.is_file() else ""
    if draft.is_file():
        errors.extend(validate_prose_keys(parse_review_output_keys(draft)))
        if is_all_ages_doujin_review(index_text):
            for key, val in parse_review_output_keys(draft).items():
                if not key.startswith("NOT_RECOMMENDED") or not val.strip():
                    continue
                for w in find_all_ages_r18_not_recommended(val):
                    errors.append(f"{key}: {w}")
    if index_path.is_file():
        errors.extend(validate_index_md(index_text))
    errors.extend(validate_work_impression_for_slug(slug))
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
