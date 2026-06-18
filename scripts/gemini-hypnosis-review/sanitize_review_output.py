#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""merge 前に review_output.md を正規化（禁止語・CLI メタ・eval 由来ブロック）。"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(SCRIPT_DIR))

from review_prose_rules import find_forbidden_in_text, validate_prose_keys  # noqa: E402

EVAL_DIR = SCRIPT_DIR / "eval_results"
REVIEWS_DIR = ROOT / "src" / "content" / "レビュー"

# 台詞引用（>）以外の散文のみ。writer_forbidden.md / §7.1 と整合。
PROSE_REPLACEMENTS: list[tuple[str, str]] = [
    ("快感設計", "快感の組み立て"),
    ("誘導設計", "誘導の組み立て"),
    ("設計", "組み立て"),
    ("頭の奥や芯", "頭の奥"),
    ("の芯が", "の奥が"),
    ("の芯に", "の奥に"),
    ("多段誘導", "古典的な深化の重ね"),
    ("多段深化", "深化の重ね"),
    ("段階的に", "順を追って"),
    ("解除手順", "解除の流れ"),
    ("誘導手順", "誘導の流れ"),
    ("回収手順", "回収の流れ"),
    ("手順どおり", "流れどおり"),
    ("手順的", "流れとして"),
    ("手順", "流れ"),
    ("積み重ね", "重ね"),
    ("積み上げ", "重ね"),
    ("を積み", "を重ね"),
    ("立ち上がり", "高まり"),
    ("立ち上がる", "高まる"),
    ("導線", "流れ"),
    ("主軸", "要"),
    ("密度", "厚み"),
]

SCORE_AXIS = (
    ("trance", "SCORE_TRANSE", "トランス度"),
    ("pleasure", "SCORE_PLEASURE", "快楽度"),
    ("satisfaction", "SCORE_SATISFACTION", "満足度"),
)


def parse_gemini_keys(text: str) -> dict[str, str]:
    from auto_review import parse_gemini_keys as _parse

    return _parse(text)


def sale_date_display(iso: str) -> str:
    try:
        d = datetime.strptime(iso.strip()[:10], "%Y-%m-%d")
        return f"{d.year}年{d.month}月{d.day}日（販売ページ表記）"
    except ValueError:
        return iso


def load_product_meta(analysis_dir: str | Path | None, slug: str) -> dict:
    candidates: list[Path] = []
    if analysis_dir:
        candidates.append(Path(analysis_dir) / "product-meta.json")
    candidates.append(REVIEWS_DIR / slug / "product-meta.json")
    for path in candidates:
        if path.is_file():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                pass
    return {}


def apply_scalar_line(text: str, key: str, value: str) -> str:
    if not value.strip():
        return text
    pat = re.compile(rf"^{re.escape(key)}:\s*.+$", re.MULTILINE)
    if pat.search(text):
        return pat.sub(f"{key}: {value}", text, count=1)
    return f"{key}: {value}\n{text}"


def build_tags_yaml(meta: dict, args: argparse.Namespace) -> str:
    tags: list[str] = ["催眠音声"]
    extra = meta.get("tags") or []
    if isinstance(extra, list):
        tags.extend(str(t).strip() for t in extra if str(t).strip())
    circle = (meta.get("circle") or args.circle or "").strip()
    if circle and circle not in ("（記入）",):
        tags.append(circle)
    cv_list = meta.get("cv") or []
    if isinstance(cv_list, str):
        cv_list = [cv_list]
    cv = meta.get("cvFemale") or meta.get("cv_female")
    if cv:
        cv_list = list(cv_list) + ([cv] if isinstance(cv, str) else cv)
    if not cv_list and args.cv:
        cv_list = [args.cv]
    for name in cv_list:
        n = str(name).strip()
        if n and n not in tags:
            tags.append(n)
    if meta.get("binaural") or "バイノーラル" in extra:
        if "バイノーラル" not in tags:
            tags.append("バイノーラル")
    lines = "\n".join(f"  - {t}" for t in tags)
    return lines


def replace_block(text: str, key: str, body: str) -> str:
    body = body.strip("\n")
    block = f"[{key}]\n{body}\n[/{key}]"
    pat = re.compile(rf"\[{re.escape(key)}\]\s*\n.*?\[/{re.escape(key)}\]\s*", re.DOTALL)
    if pat.search(text):
        return pat.sub(block + "\n", text, count=1)
    return text.rstrip() + "\n\n" + block + "\n"


def format_package_files(meta: dict) -> str:
    pkg = meta.get("packageFiles") or meta.get("package_files") or []
    lines: list[str] = []
    for item in pkg:
        if isinstance(item, str):
            lines.append(f"- **{item}**")
        elif isinstance(item, dict):
            name = str(item.get("name", "")).strip()
            dur = str(item.get("duration", "")).strip()
            if name and dur:
                lines.append(f"- **{name}** … **{dur}**")
            elif name:
                lines.append(f"- **{name}**")
    return "\n".join(lines)


def sanitize_prose_text(text: str) -> str:
    out_lines: list[str] = []
    for line in text.splitlines():
        if line.strip().startswith(">"):
            out_lines.append(line)
            continue
        s = line
        for old, new in PROSE_REPLACEMENTS:
            s = s.replace(old, new)
        out_lines.append(s)
    return "\n".join(out_lines)


def normalize_block_closers(text: str) -> str:
    """Gemini が [/KEY] を同一行に付けると parse_gemini_keys が失敗するため改行を挿入。"""
    return re.sub(r"(\S)(\[/[A-Z0-9_]+\])", r"\1\n\2", text)


def sanitize_blocks(text: str) -> str:
    text = normalize_block_closers(text)
    block_pat = re.compile(r"^(\[[A-Z0-9_]+\]\s*\n)(.*?)(^\[/[A-Z0-9_]+\]\s*$)", re.MULTILINE | re.DOTALL)

    def repl(m: re.Match[str]) -> str:
        body = sanitize_prose_text(m.group(2).strip("\n"))
        return f"{m.group(1)}{body}\n{m.group(3)}"

    text = block_pat.sub(repl, text)
    for key in (
        "SALE_DATE_DISPLAY",
        "GENRE_TYPE",
        "CV_FEMALE",
        "RECOMMENDED_1_REASON",
        "RECOMMENDED_2_REASON",
        "RECOMMENDED_3_REASON",
        "NOT_RECOMMENDED_1_REASON",
        "NOT_RECOMMENDED_2_REASON",
    ):
        pat = re.compile(rf"^({re.escape(key)}:\s*)(.+)$", re.MULTILINE)

        def scalar_repl(sm: re.Match[str]) -> str:
            return sm.group(1) + sanitize_prose_text(sm.group(2))

        text = pat.sub(scalar_repl, text)
    return text


def score_from_eval(slug: str, axis: str) -> float | None:
    path = EVAL_DIR / f"{slug}_{axis}.md"
    if not path.is_file():
        return None
    head = path.read_text(encoding="utf-8").splitlines()[:3]
    for line in head:
        m = re.search(r"([\d.]+)\s*/\s*10", line)
        if m:
            return float(m.group(1))
    return None


def eval_prose_for_axis(slug: str, axis: str) -> str:
    path = EVAL_DIR / f"{slug}_{axis}.md"
    if not path.is_file():
        return ""
    lines = [ln.strip() for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    if len(lines) < 2:
        return ""
    body = lines[1]
    if body.startswith("###"):
        body = lines[2] if len(lines) > 2 else body
    parts = [p.strip() for p in re.split(r"(?<=[。！？])", body) if p.strip()]
    picked: list[str] = []
    for part in parts:
        if part.startswith("しかし"):
            break
        picked.append(part)
        if len(picked) >= 2:
            break
    text = "".join(picked) if picked else body[:180]
    text = strip_eval_timestamps(text)
    return sanitize_prose_text(text)[:320]


def strip_eval_timestamps(text: str) -> str:
    """採点ログの SRT・トラック連番を読者向けグラフ内訳から除去。"""
    text = re.sub(r"（\d{2}:\d{2}:\d{2}[^）]*）", "", text)
    text = re.sub(r"（00:[^）]+）", "", text)
    text = re.sub(r"「0\d\.[^」]+」", "", text)
    text = re.sub(r"続く「0\d\.[^」]+」", "本編", text)
    text = re.sub(r"まず「0\d\.[^」]+」", "「リラックス運動」", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def build_graph_breakdown(slug: str, keys: dict[str, str]) -> str:
    lines: list[str] = []
    for axis, score_key, label in SCORE_AXIS:
        score = keys.get(score_key, "").strip()
        if not score:
            ev = score_from_eval(slug, axis)
            if ev is not None:
                score = str(ev)
        prose = eval_prose_for_axis(slug, axis)
        if not score or not prose:
            continue
        lines.append(f"- **{label} {score}** … {prose}")
    return "\n".join(lines)


def whisper_texts(analysis_dir: Path) -> str:
    chunks: list[str] = []
    for pat in ("*.txt", "*.srt"):
        for path in sorted(analysis_dir.glob(pat)):
            if path.name.lower().startswith("info"):
                continue
            try:
                chunks.append(path.read_text(encoding="utf-8"))
            except OSError:
                pass
    return "\n".join(chunks)


def count_dry_scenes(analysis_dir: Path | None) -> int | None:
    if not analysis_dir or not Path(analysis_dir).is_dir():
        return None
    text = whisper_texts(Path(analysis_dir))
    if not text.strip():
        return None
    peaks = 0
    if re.search(r"0[.、．\s]*(?:ほら[、,]?\s*)?いっちゃえ|0いっちゃえ|0\s*いっちゃえ", text):
        peaks += 1
    if re.search(r"3210", text) and re.search(r"またいっちゃえ|握り潰|絞りカス", text):
        peaks += 1
    if re.search(r"せーの[^\n]{0,40}いっちゃえ|最後[^\n]{0,20}いっちゃえ", text):
        peaks += 1
    # 吸盤剥がし系（3-2-1→0 / 321ゼロ の到達回収）
    if re.search(r"3・2・1[^\n]{0,80}0[^\n]{0,80}(?:引き剥が|剥が)", text):
        peaks += 1
    peaks += len(re.findall(r"321\s*ゼロ", text))
    return peaks if peaks > 0 else 0


def apply_metadata(
    text: str,
    args: argparse.Namespace,
    meta: dict,
    slug: str,
) -> tuple[str, list[str]]:
    log: list[str] = []
    sale = meta.get("saleDate") or meta.get("sale_date") or args.sale_date
    if sale and sale != "2000-01-01":
        disp = sale_date_display(str(sale))
        text = apply_scalar_line(text, "SALE_DATE_DISPLAY", disp)
        log.append(f"SALE_DATE_DISPLAY ← {disp}")

    genre = meta.get("genreType") or meta.get("genre_type")
    if genre:
        text = apply_scalar_line(text, "GENRE_TYPE", str(genre))

    cv = meta.get("cvFemale") or meta.get("cv_female")
    if isinstance(meta.get("cv"), list) and meta["cv"]:
        cv = "、".join(str(x).strip() for x in meta["cv"] if str(x).strip())
    if not cv and args.cv:
        cv = args.cv
    if cv:
        text = apply_scalar_line(text, "CV_FEMALE", str(cv).strip())
        log.append(f"CV_FEMALE ← {cv}")

    tags_body = build_tags_yaml(meta, args)
    if tags_body.strip():
        text = replace_block(text, "TAGS_YAML", tags_body)
        log.append("TAGS_YAML を product-meta / CLI から更新")

    pkg_body = format_package_files(meta)
    if pkg_body.strip():
        text = replace_block(text, "PACKAGE_FILES", pkg_body)
        log.append("PACKAGE_FILES を product-meta から挿入")

    keys = parse_gemini_keys(text)
    if not keys.get("GRAPH_BREAKDOWN", "").strip():
        gb = build_graph_breakdown(slug, keys)
        if gb.strip():
            text = replace_block(text, "GRAPH_BREAKDOWN", gb)
            log.append("GRAPH_BREAKDOWN を eval_results から生成")

    dry = count_dry_scenes(Path(args.analysis_dir) if args.analysis_dir else None)
    if dry is not None:
        text = apply_scalar_line(text, "DRY_SCENE_COUNT", str(dry))
        log.append(f"DRY_SCENE_COUNT ← Whisper 回収 {dry}")

    return text, log


def sanitize_draft(
    text: str,
    args: argparse.Namespace,
    *,
    slug: str | None = None,
    write_back: bool = False,
    draft_path: Path | None = None,
) -> tuple[str, list[str]]:
    slug = slug or args.slug
    meta = load_product_meta(args.analysis_dir, slug)
    log: list[str] = []

    text, meta_log = apply_metadata(text, args, meta, slug)
    log.extend(meta_log)

    text = normalize_block_closers(text)

    before_v = validate_prose_keys(parse_gemini_keys(text))
    text = sanitize_blocks(text)
    after_keys = parse_gemini_keys(text)
    after_v = validate_prose_keys(after_keys)

    if len(before_v) > len(after_v):
        log.append(f"禁止語を自動置換（{len(before_v) - len(after_v)} 件改善）")
    if after_v:
        log.append(f"残る禁止語: {len(after_v)} 件（要人手修正）")

    if write_back and draft_path:
        draft_path.write_text(text, encoding="utf-8")

    return text, log


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="review_output.md を merge 前に正規化")
    p.add_argument("--slug", required=True)
    p.add_argument("--draft-file", default="", help="既定: review_output.md")
    p.add_argument("--circle", default="")
    p.add_argument("--cv", default="", help="CV（単一）")
    p.add_argument("--sale-date", default="2000-01-01")
    p.add_argument("--analysis-dir", default="")
    p.add_argument("--check-only", action="store_true", help="書き込まず検証のみ")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    draft_path = Path(args.draft_file) if args.draft_file else SCRIPT_DIR / "review_output.md"
    if not draft_path.is_file():
        print(f"[エラー] 見つかりません: {draft_path}")
        sys.exit(1)

    text = draft_path.read_text(encoding="utf-8")
    text, log = sanitize_draft(text, args, slug=args.slug)

    for line in log:
        print(f"  [sanitize] {line}")

    keys = parse_gemini_keys(text)
    violations = validate_prose_keys(keys)
    if violations:
        print("\n[警告] 執筆ルール違反が残っています:")
        for v in violations[:15]:
            print(f"  - {v}")
        if len(violations) > 15:
            print(f"  …他 {len(violations) - 15} 件")

    if not args.check_only:
        draft_path.write_text(text, encoding="utf-8")
        print(f"\n[OK] 更新: {draft_path}")
    else:
        print("\n[check-only] ファイルは未更新")

    sys.exit(1 if violations else 0)


if __name__ == "__main__":
    main()
