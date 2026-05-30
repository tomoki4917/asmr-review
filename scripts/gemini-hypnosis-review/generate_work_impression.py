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

from auto_review import gemini_generate, get_api_key, require_api_key  # noqa: E402
from review_prose_rules import (  # noqa: E402
    load_forbidden_rules,
    load_guide_excerpts_for_impression,
    find_forbidden_in_text,
)

load_dotenv(SCRIPT_DIR / ".env")

SYSTEM = """あなたは催眠音声を専門に扱うプロレビュアーです。クイック解析タブ用の「作品感想」を書きます。

## 出力形式（JSON のみ・前置き禁止）
{"paragraphs": ["段落1", "段落2", ...]}

## 文体の正本（docs/催眠音声執筆ガイド.md §8.4・2026-05）
- **聴き終わったあとの生きた所感**。カタログ説明・仕様書・AI予言調ではない。
- 作品固有の**場面・言葉・音**から入る。段落ごと**2文前後**・接続で1本の流れ（短文三連禁止）。
- 語尾は `です` `ます` `と思いました` を混ぜる。**`でしょう` は全文0〜1回**。`はずです` `きっと` 禁止。
- 主観（`と思いました` `個人的に`）は**全体で1〜2回**。
- **毎回構成を変える**（他 slug・グリム童話型の決まり文句の使い回し禁止）。

## 段落数
**2〜4段落**（長尺は4可）。各 **100〜170字**。です・ます調。

## 避ける表現
- 解説カタログ … `見どころ` `要素となり` `段階的に深め` `描かれています`
- グリム型のコピー … 毎回 `〜わけですが` `〜となっておりました` `おすすめですね` `上手く出ていて没入度は高い`
- 禁止語 … `設計` `導線` `密度` `主軸` **`芯`** **`手順`**・三軸数値・★

## 内容
- 聴き終わりの手触り・本作の売り・向く人（段落役割はプロンプトの「今回の構成指示」に従う）。
- 解析記事の事実と矛盾させない。
- サークル・声優はプロンプトに除外指示がなければ1段落まで可。

## 禁止
箇条書き、Markdown、HTML、キーワード羅列だけの段落
"""

OPENING_ANGLES = [
    "2段落：第1=場面・シチュの掴み+手触り、第2=向く人+総括。",
    "3段落：第1=場面掴み、第2=本編の快感・誘導の手触り、第3=向く人。",
    "3段落：第1=作品の型（何系か）、第2=聴き終わって残った感覚、第3=短所または向く人。",
    "4段落：第1=場面掴み、第2=深化・誘導、第3=快感の核、第4=向く人・総括（長尺向け）。",
    "4段落：第1=タイトル・コンセプト、第2=本編の売り、第3=着地・余韻、第4=向く人。",
    "第1段落は「尺・長さ」から入る（短い／長いの感想）。",
    "第1段落は「二声・掛け合い・左右」の驚きから入る。",
    "第1段落は「カウント・数字・反復」の追いやすさから入る。",
    "第1段落は「終わり方・解除・余韻」から入る（作品に解除がある場合のみ）。",
    "第1段落は「向く人・向かない人」のどちらか一方から入る。",
    "第1段落は「実験的・矛盾文・変わった所」から入る。",
    "第2段落を「聴き方・初回の聞き方」にする（作品が聴き分けを要する場合のみ）。",
    "締めは `と思いました` か `一本です` か `〜タイプです` を作品ごとに1つ選ぶ（毎回同じにしない）。",
]

GRIM_CLICHE_BAN = (
    "今回禁止の決まり文句（使わない）: "
    "「〜わけですが」「〜となっておりました」「おすすめですね」で締める、"
    "「上手く出ていて没入度は高いです」のセット。"
)


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
        f"【{GRIM_CLICHE_BAN}】\n\n"
        f"【作品情報】\n{ctx}\n\n"
        "JSON で paragraphs を出力してください。"
    )

    require_api_key()
    model = os.environ.get("GEMINI_HUMANIZE_MODEL", "gemini-2.5-flash")
    client = genai.Client(api_key=get_api_key())
    print(f"[impression] Gemini ({model}) … 構成: {angle[:40]}…")
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
        if para.count("でしょう") > 1:
            print(f"[警告] 段落{i} でしょう が多い")

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
