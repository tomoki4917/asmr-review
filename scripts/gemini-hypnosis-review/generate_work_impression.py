#!/usr/bin/env python3
"""クイック解析用 workImpressionParagraphs を Gemini で生成。"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from auto_review import gemini_generate, get_api_key, load_file, require_api_key  # noqa: E402

load_dotenv(SCRIPT_DIR / ".env")

SYSTEM = """あなたは催眠音声レビューサイトの管理人です。クイック解析タブ用の「作品感想」を書きます。

## 出力形式（JSON のみ・前置き禁止）
{"paragraphs": ["段落1", "段落2", "段落3"]}

## 段落数
2〜3段落。各段落80〜160字。です・ます調。

## 内容
- 聴き終わった印象・誰向けか・作品の強み（カウント口腔・脳イキ・手順の追いやすさ等）。
- サークル処女作・声優への言及は1段落まで可（礼儀正しく短く）。
- 解析記事の事実と矛盾させない（淫語控えめ・解除短め等も正直に触れてよい）。

## 文体
- サイト管理人の感想。**説明・紹介調を基本**に、主観は**全体で1〜2フレーズ**（`個人的に` `私は思います` 等）にとどめる。各段落へ主観を詰め込まない。
- 熱量は中程度（煽り過ぎない）。
- 日常の日本語。論文調・AI語（一方で／つまり／設計／導線／密度／主軸／報酬系／神経学的／存分に堪能／〇.X水準）禁止。
- `注意を固定` 系の言い回し禁止（催眠音声執筆ガイド §6）。
- 三軸の数値・★点数は書かない。

## 禁止
箇条書き、Markdown、HTML、キーワードの羅列だけの段落
"""


def gather_context(slug: str) -> str:
    index_path = ROOT / "src" / "content" / "レビュー" / slug / "index.md"
    text = index_path.read_text(encoding="utf-8")
    parts: list[str] = []

    if m := re.search(r"^summary:\s*\|\s*\n([\s\S]*?)(?=\n\w|\n---)", text, re.MULTILINE):
        parts.append(f"【summary】\n{m.group(1).strip()}")

    if m := re.search(
        r"\*\*グラフ評価内訳\*\*.*?(?=## 解析結論)",
        text,
        re.DOTALL,
    ):
        parts.append(f"【グラフ内訳】\n{m.group(0).strip()}")

    if m := re.search(
        r"## 総評：本作品の構造的結論.*?(?=\n---|\Z)",
        text,
        re.DOTALL,
    ):
        parts.append(f"【総評】\n{m.group(0).strip()[:1200]}")

    if m := re.search(r"itemName:\s*(.+)", text):
        parts.append(f"【作品名】{m.group(1).strip()}")

    return "\n\n".join(parts)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("slug")
    p.add_argument("--write-tsx", action="store_true", help="page.tsx の quickGuide に追記")
    args = p.parse_args()

    ctx = gather_context(args.slug)
    if not ctx:
        print("[エラー] index.md から文脈を取得できませんでした")
        sys.exit(1)

    guide = load_file(ROOT / "docs" / "催眠音声執筆ガイド.md", "guide")
    prompt = f"【執筆ガイド抜粋（文体）】\n{guide[:2000]}\n\n【作品情報】\n{ctx}\n\nJSON で paragraphs を出力してください。"

    require_api_key()
    model = os.environ.get("GEMINI_HUMANIZE_MODEL", "gemini-2.5-flash")
    client = genai.Client(api_key=get_api_key())
    print(f"[impression] Gemini ({model}) …")
    raw = gemini_generate(
        client,
        model=model,
        contents=prompt,
        system_instruction=SYSTEM,
        temperature=0.35,
        label="作品感想",
    ).strip()

    # extract JSON
    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        print(raw)
        sys.exit(1)
    data = json.loads(m.group(0))
    paragraphs: list[str] = data.get("paragraphs", [])
    if not paragraphs:
        sys.exit(1)

    out_path = SCRIPT_DIR / f"work_impression_{args.slug}.json"
    out_path.write_text(
        json.dumps({"paragraphs": paragraphs}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"[impression] 保存: {out_path}\n")
    for i, para in enumerate(paragraphs, 1):
        print(f"--- {i} ---\n{para}\n")

    if args.write_tsx:
        tsx_path = ROOT / "src" / "app" / "(public)" / "reviews" / "[slug]" / "page.tsx"
        tsx = tsx_path.read_text(encoding="utf-8")
        key = f'"{args.slug}"'
        if key not in tsx:
            print("[エラー] slug が page.tsx にありません")
            sys.exit(1)
        # slug ブロック内の workImpressionParagraphs を置換（既存は上書き）
        lines = ",\n".join(f'        "{p.replace(chr(34), chr(92)+chr(34))}"' for p in paragraphs)
        block = f"      workImpressionParagraphs: [\n{lines},\n      ],"
        slug_pat = rf'"{re.escape(args.slug)}": \{{'
        m = re.search(slug_pat, tsx)
        if not m:
            print("[エラー] slug が page.tsx にありません")
            sys.exit(1)
        depth = 0
        end = m.start()
        for i in range(m.end() - 1, len(tsx)):
            if tsx[i] == "{":
                depth += 1
            elif tsx[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        entry = tsx[m.start() : end]
        existing = re.search(r"workImpressionParagraphs: \[[\s\S]*?\],", entry)
        if existing:
            new_entry = (
                entry[: existing.start()]
                + block
                + entry[existing.end() :]
            )
        else:
            new_entry, n = re.subn(
                r"(notRecommendedFor: \[[\s\S]*?\],)",
                rf"\1\n{block}",
                entry,
                count=1,
            )
            if n != 1:
                print("[エラー] page.tsx への挿入に失敗（notRecommendedFor が見つかりません）")
                sys.exit(1)
        new_tsx = tsx[: m.start()] + new_entry + tsx[end:]
        tsx_path.write_text(new_tsx, encoding="utf-8")
        print(f"[impression] 更新: {tsx_path}")


if __name__ == "__main__":
    main()
