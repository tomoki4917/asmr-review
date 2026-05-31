#!/usr/bin/env python3
"""既存 review_output.md の散文を Gemini で人間味改稿し、--merge-only で index に反映。"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from auto_review import (  # noqa: E402
    WRITER_MODEL,
    build_writer_prompt,
    gemini_generate,
    get_api_key,
    load_eval_results,
    load_file,
    parse_gemini_keys,
    replace_key_block,
)
from google import genai

HUMANIZE_KEYS = [
    "SUMMARY",
    "ITEM_DESCRIPTION",
    "RECOMMENDED_1",
    "RECOMMENDED_1_REASON",
    "RECOMMENDED_2",
    "RECOMMENDED_2_REASON",
    "RECOMMENDED_3",
    "RECOMMENDED_3_REASON",
    "NOT_RECOMMENDED_1",
    "NOT_RECOMMENDED_1_REASON",
    "NOT_RECOMMENDED_2",
    "NOT_RECOMMENDED_2_REASON",
    "STRONG_INDUCTION_ROWS",
    "STRONG_SUGGESTION_ROWS",
    "INDUCTION_FLOW",
    "CONCLUSION_INDUCTION",
    "CONCLUSION_PLEASURE",
    "CONCLUSION_FINAL",
]


def extract_block(draft: str, key: str) -> str:
    m = re.search(rf"\[{re.escape(key)}\]\s*\n(.*?)\[/{re.escape(key)}\]", draft, re.DOTALL)
    return m.group(1).strip() if m else ""


def build_humanize_prompt(
    slug: str,
    draft: str,
    res_t: str,
    res_p: str,
    res_s: str,
    graph_excerpt: str,
) -> str:
    parts = []
    for key in HUMANIZE_KEYS:
        body = extract_block(draft, key)
        if not body:
            scalar = re.search(rf"^\[{re.escape(key)}\]:\s*(.+)$", draft, re.MULTILINE)
            if scalar:
                body = scalar.group(1).strip()
        if body:
            parts.append(f"### 現在の [{key}]\n{body}\n")

    current = "\n".join(parts)
    base = build_writer_prompt(res_t, res_p, res_s, "", "（改稿のみ）", only_keys=HUMANIZE_KEYS)
    return (
        f"{base}\n\n"
        "【改稿タスク】上記キーを**すべて**出力し直す。事実・数値・引用・表のスコア列は維持。\n"
        f"slug: {slug}\n\n"
        f"【作品評価グラフ内訳（index.md・参考。キー出力には含めないが文体を揃える）】\n{graph_excerpt}\n\n"
        f"【現在の文案】\n{current}\n"
    )


def main() -> None:
    p = argparse.ArgumentParser(description="review_output の散文を人間味改稿")
    p.add_argument("slug", help="レビュー slug")
    p.add_argument("--merge", action="store_true", help="改稿後に patch_humanize_to_index.py で index に部分反映（merge-only 禁止）")
    p.add_argument("--item-name", default="", help="--merge 時の商品名")
    args = p.parse_args()

    slug = args.slug
    draft_path = SCRIPT_DIR / "review_output.md"
    index_path = ROOT / "src" / "content" / "レビュー" / slug / "index.md"
    if not draft_path.is_file():
        print(f"[エラー] {draft_path} がありません")
        sys.exit(1)

    draft = draft_path.read_text(encoding="utf-8")
    graph_excerpt = ""
    audience_excerpt = ""
    if index_path.is_file():
        idx = index_path.read_text(encoding="utf-8")
        m = re.search(
            r"\*\*グラフ評価内訳\*\*.*?(?=## 解析結論)",
            idx,
            re.DOTALL,
        )
        graph_excerpt = m.group(0).strip() if m else ""
        a = re.search(
            r"\*\*【こんな人におすすめ】\*\*.*?(?=---\s*\n\s*\n## 総合評価)",
            idx,
            re.DOTALL,
        )
        audience_excerpt = a.group(0).strip() if a else ""

    res_t, res_p, res_s = load_eval_results(slug)
    humanize_system = load_file(SCRIPT_DIR / "writer_system_humanize.md", "humanize")
    keys_doc = load_file(SCRIPT_DIR / "writer_output_keys.md", "keys")
    from review_prose_rules import load_forbidden_rules, load_guide_excerpts_for_writer, validate_prose_keys

    forbidden = load_forbidden_rules()
    guide_excerpt = load_guide_excerpts_for_writer()

    client = genai.Client(api_key=get_api_key())
    prompt = build_humanize_prompt(slug, draft, res_t, res_p, res_s, graph_excerpt)
    if audience_excerpt:
        prompt += f"\n\n【index.md のおすすめ／合わない（参考）】\n{audience_excerpt}\n"
    print("[humanize] Gemini 改稿中...")
    model = os.environ.get("GEMINI_HUMANIZE_MODEL", WRITER_MODEL)
    out = gemini_generate(
        client,
        model=model,
        contents=prompt,
        system_instruction="\n\n".join(
            p
            for p in (
                humanize_system,
                forbidden,
                guide_excerpt,
                keys_doc,
            )
            if p.strip()
        ),
        temperature=0.35,
        label="人間味改稿",
    )

    keys = parse_gemini_keys(out)
    for w in validate_prose_keys(keys):
        print(f"[警告] 改稿出力の執筆ルール違反: {w}")
    updated = draft
    missing = []
    for key in HUMANIZE_KEYS:
        if key in keys and keys[key].strip():
            updated = replace_key_block(updated, key, keys[key])
            # スカラー行も更新
            updated = re.sub(
                rf"^\[{re.escape(key)}\]:.*$",
                f"[{key}]: {keys[key].split(chr(10))[0][:80]}",
                updated,
                count=1,
                flags=re.MULTILINE,
            )
        else:
            missing.append(key)

    if missing:
        print("[警告] 未返却キー（旧文案を維持）:", ", ".join(missing))

    draft_path.write_text(updated, encoding="utf-8")
    print(f"[humanize] 保存: {draft_path}")

    if args.merge:
        patch_script = SCRIPT_DIR / "patch_humanize_to_index.py"
        print("[humanize] patch_humanize_to_index（merge-only は使わない）...")
        subprocess.run(
            [sys.executable, str(patch_script), slug],
            cwd=str(SCRIPT_DIR),
            check=True,
        )


if __name__ == "__main__":
    main()
