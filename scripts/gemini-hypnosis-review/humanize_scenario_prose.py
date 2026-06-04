#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""シチュボイス index 用散文を Gemini で人間化（採点・PACKAGE は維持）。"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import auto_review as ar  # noqa: E402
from sanitize_review_output import apply_scalar_line  # noqa: E402

ROOT = ar.ROOT
STYLE_REF = (
    ROOT
    / "src/content/レビュー/shinitagari-junai-maid-yogarekake/index.md"
)


def whisper_sample(analysis_dir: Path, limit: int = 12000) -> str:
    chunks: list[str] = []
    for path in sorted(analysis_dir.glob("tr_*.txt")):
        try:
            chunks.append(path.read_text(encoding="utf-8")[:4000])
        except OSError:
            pass
    return "\n---\n".join(chunks)[:limit]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--slug", required=True)
    p.add_argument("--analysis-dir", required=True)
    p.add_argument("--all-ages", action="store_true")
    args = p.parse_args()

    ar.require_api_key()
    draft_path = SCRIPT_DIR / "review_output.md"
    draft = draft_path.read_text(encoding="utf-8")
    keys = ar.parse_gemini_keys(draft)
    index_path = ROOT / "src/content/レビュー" / args.slug / "index.md"
    current_index = index_path.read_text(encoding="utf-8") if index_path.is_file() else ""
    style = STYLE_REF.read_text(encoding="utf-8")
    style_graph = style[style.find("**グラフ評価内訳**") : style.find("**【こんな人")]
    forbidden = (SCRIPT_DIR / "writer_forbidden.md").read_text(encoding="utf-8")
    guide = (ROOT / "docs/全年齢シチュエーションボイス執筆ガイド.md").read_text(
        encoding="utf-8"
    )[:6000]
    whisper = whisper_sample(Path(args.analysis_dir))
    pleasure_label = "睡眠・覚醒" if args.all_ages else "快楽度"

    prompt = f"""あなたは同人音声レビュー室の編集者。以下の記事散文がAI調なので、**人間のレビュアーが聴いた体験談**に全面書き換えせよ。

## 採点（変更禁止）
- シナリオ 9.3 / 音響 9.2 / 没入度 9.5 / {pleasure_label} 9.5 / 満足度 9.7
- 総合★10

## 文体見本（shinitagari・グラフ内訳のみ・文言コピー禁止）
{style_graph}

## 禁止（writer_forbidden 抜粋）
{forbidden[:3500]}

## 全年齢差分
{guide[:2500]}

## 台本抜粋（Whisper）
{whisper}

## 現状のAI調テキスト（置き換え対象）
summary: {keys.get("SUMMARY", "")}
itemDescription: {keys.get("ITEM_DESCRIPTION", "")}
graph: {keys.get("GRAPH_BREAKDOWN", "")}
おすすめ1-3: {keys.get("RECOMMENDED_1", "")} / {keys.get("RECOMMENDED_2", "")} / {keys.get("RECOMMENDED_3", "")}
合わない1-2: {keys.get("NOT_RECOMMENDED_1", "")} / {keys.get("NOT_RECOMMENDED_2", "")}
総評: {keys.get("CONCLUSION_DESIGN", "")} {keys.get("CONCLUSION_ACOUSTIC", "")} {keys.get("CONCLUSION_FINAL", "")}

## 書き方
- 敬体「です・ます」。口語で自然に。論文・マーケ・解説カタログ調禁止
- 各グラフ軸は `- **シナリオ 9.3**` の次行から2〜3文（見出し行のあと空行してから本文）
- 公式パート名は使ってよい。トラック番号・タイムスタンプ禁止
- R18欠如を合わない理由にしない。性描写期待の合わない禁止
- 禁止語: 芯, 手順, 積み, 設計, 導線, 密度, 主軸, 固定, 機能します, 見応え, ギミック, 当事者, 約束どおり, 両立, 体験のピーク
- 弱点も各軸1文は入れる（忖度なし・数値は書かない）
- workImpressionは4段落・§8.4・サークル名声優名タグ名（耳舐め等単独タグ）禁止・★禁止

## 出力（このブロックのみ）
[SUMMARY]
（2文以内）
[/SUMMARY]
[ITEM_DESCRIPTION]
（2段落）
[/ITEM_DESCRIPTION]
[GRAPH_BREAKDOWN]
（5軸・数値は上記のまま）
[/GRAPH_BREAKDOWN]
RECOMMENDED_1: ラベル一行
RECOMMENDED_1_REASON: 理由
RECOMMENDED_2: ...
RECOMMENDED_2_REASON: ...
RECOMMENDED_3: ...
RECOMMENDED_3_REASON: ...
NOT_RECOMMENDED_1: ...
NOT_RECOMMENDED_1_REASON: ...
NOT_RECOMMENDED_2: ...
NOT_RECOMMENDED_2_REASON: ...
[CONCLUSION_DESIGN]
### 【設計の要点】
（2〜3文）
[/CONCLUSION_DESIGN]
[CONCLUSION_ACOUSTIC]
### 【音響面の精度】
（2〜3文）
[/CONCLUSION_ACOUSTIC]
[CONCLUSION_FINAL]
### 【結論】
（2〜3文）
[/CONCLUSION_FINAL]
[WORK_IMPRESSION_JSON]
{{"paragraphs": ["...", "...", "...", "..."]}}
[/WORK_IMPRESSION_JSON]
"""
    client = ar.genai.Client(api_key=ar.get_api_key())
    out = ar.gemini_generate(
        client,
        model=ar.WRITER_MODEL,
        contents=prompt,
        system_instruction="同人音声レビュー編集。指定ブロックのみ。生きた所感。",
        temperature=0.35,
        label="シチュ散文人間化",
        max_attempts=6,
    )
    new_keys = ar.parse_gemini_keys(out)
    # scalars from RECOMMENDED lines in raw out
    for line in out.splitlines():
        for key in (
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
        ):
            prefix = f"{key}:"
            if line.startswith(prefix):
                new_keys[key] = line.split(":", 1)[1].strip()

    required = (
        "SUMMARY",
        "ITEM_DESCRIPTION",
        "GRAPH_BREAKDOWN",
        "CONCLUSION_DESIGN",
        "CONCLUSION_ACOUSTIC",
        "CONCLUSION_FINAL",
    )
    missing = [k for k in required if not new_keys.get(k, "").strip()]
    if missing:
        print(f"[エラー] 不足キー: {missing}")
        print(out[:2000])
        sys.exit(1)

    for k in required:
        draft = ar.replace_key_block(draft, k, new_keys[k])
    for i in range(1, 4):
        for suffix in ("", "_REASON"):
            key = f"RECOMMENDED_{i}{suffix}"
            if new_keys.get(key):
                draft = apply_scalar_line(draft, key, new_keys[key])
    for i in range(1, 3):
        for suffix in ("", "_REASON"):
            key = f"NOT_RECOMMENDED_{i}{suffix}"
            if new_keys.get(key):
                draft = apply_scalar_line(draft, key, new_keys[key])

    draft_path.write_text(draft, encoding="utf-8")
    print("[OK] review_output.md 更新")

    m = __import__("re").search(
        r"\[WORK_IMPRESSION_JSON\]\s*(\{.*?\})\s*\[/WORK_IMPRESSION_JSON\]",
        out,
        __import__("re").DOTALL,
    )
    if m:
        imp_path = SCRIPT_DIR / f"work_impression_{args.slug}.json"
        data = json.loads(m.group(1))
        imp_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"[OK] {imp_path.name}")


if __name__ == "__main__":
    main()
