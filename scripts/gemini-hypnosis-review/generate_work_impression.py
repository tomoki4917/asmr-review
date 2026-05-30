#!/usr/bin/env python3
"""クイック解析用 workImpressionParagraphs を Gemini で生成。"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from auto_review import gemini_generate, get_api_key, load_file, require_api_key  # noqa: E402
from review_prose_rules import (  # noqa: E402
    load_forbidden_rules,
    load_guide_excerpts_for_impression,
    find_forbidden_in_text,
)

load_dotenv(SCRIPT_DIR / ".env")

SYSTEM = """あなたは催眠音声レビューサイトの管理人です。クイック解析タブ用の「作品感想」を書きます。

## 出力形式（JSON のみ・前置き禁止）
{"paragraphs": ["段落1", "段落2", "段落3"]}

## 段落数
2〜3段落。各段落80〜160字。です・ます調。

## 内容
- 聴き終わった印象・誰向けか・作品の強み（カウント口腔・脳イキ・流れの追いやすさ等）。
- サークル処女作・声優への言及は1段落まで可（礼儀正しく短く）。
- 解析記事の事実と矛盾させない（淫語控えめ・解除短め等も正直に触れてよい）。

## 構成バリエーション（毎回必須・最重要）
- **他作品と同型にしない**。毎回、段落の役割と入り方を変える。
- **禁止の固定型** … 「〜が特徴／印象だと感じました」→「初回は〜聴く」→「解除まで〜戻りやすい」の3段テンプレ。
- **入り方の例**（毎回1つ選び、他と被らせない） … 尺の感想／二声・掛け合いの驚き／カウントの追いやすさ／終わり方の余韻／向く人／実験的な一面 等。
- **2段落** … 印象+強み、聴感+向く人、など配分を作品ごとに変える。
- **3段落** … 各段の役割をずらす（第2段落を「向く人」にしない／第1段落を聴き方にしない、等）。
- **語尾** … `です` `ます` `でしょう` `と思います` を混ぜ、同じ締めを連続させない。
- **禁止の書き出し** … `聴き終わった印象としては` `この作品いちばんの特徴だと感じました` `〜が印象的です` を使いすぎない（1本につき1回まで）。

## 文体
- サイト管理人の感想。**説明・紹介調を基本**に、主観は**全体で1〜2フレーズ**（`個人的に` `私は思います` 等）にとどめる。各段落へ主観を詰め込まない。
- 熱量は中程度（煽り過ぎない）。
- 日常の日本語。論文調・AI語（一方で／つまり／設計／導線／密度／主軸／報酬系／神経学的／存分に堪能／〇.X水準）禁止。
- **`芯` 禁止** … `この作品の芯` `快感の芯` `芯だと感じました` 等。
- **`手順` 禁止** … `手順どおり` `解除手順` `誘導手順` `回収手順` `手順的` 等（代用：**流れ**・**進め方**・**段階**・**順番**・**想定どおり**）。
- `注意を固定` 系の言い回し禁止（催眠音声執筆ガイド §6）。
- 三軸の数値・★点数は書かない。

## 禁止
箇条書き、Markdown、HTML、キーワードの羅列だけの段落
"""

OPENING_ANGLES = [
    "第1段落は「尺・長さ」から入る（短い／長いの感想）。",
    "第1段落は「二声・掛け合い・左右」の驚きから入る。",
    "第1段落は「カウント・数字・反復」の追いやすさから入る。",
    "第1段落は「終わり方・解除・余韻」から入る（逆順の入り）。",
    "第1段落は「向く人・向かない人」のどちらか一方から入る。",
    "第1段落は「実験的・矛盾文・変わった所」から入る。",
    "2段落構成：第1=聴感、第2=強み+向く人をまとめる。",
    "3段落構成：第1=没入、第2=快感の売り、第3=聴き方または余韻（初回の聞き方段落は任意）。",
]


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

    guide = load_guide_excerpts_for_impression()
    forbidden = load_forbidden_rules()
    angle = random.choice(OPENING_ANGLES)
    prompt = (
        f"【禁止語・執筆ルール（正本抜粋）】\n{forbidden}\n\n{guide}\n\n"
        f"【今回の構成指示】\n{angle}\n\n"
        f"【作品情報】\n{ctx}\n\n"
        "JSON で paragraphs を出力してください。"
    )

    require_api_key()
    model = os.environ.get("GEMINI_HUMANIZE_MODEL", "gemini-2.5-flash")
    client = genai.Client(api_key=get_api_key())
    print(f"[impression] Gemini ({model}) …")
    raw = gemini_generate(
        client,
        model=model,
        contents=prompt,
        system_instruction=SYSTEM,
        temperature=0.55,
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

    for i, para in enumerate(paragraphs, 1):
        hits = find_forbidden_in_text(para)
        if hits:
            print(f"[警告] 段落{i} に禁止語: {', '.join(hits)}")

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
        # 重複ブロックをすべて除去してから1件だけ挿入
        cleaned = re.sub(r"\n      workImpressionParagraphs: \[[\s\S]*?\],", "", entry)
        new_entry, n = re.subn(
            r"(notRecommendedFor: \[[\s\S]*?\],)",
            rf"\1\n{block}",
            cleaned,
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
