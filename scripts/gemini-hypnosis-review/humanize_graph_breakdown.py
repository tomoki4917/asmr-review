#!/usr/bin/env python3
"""グラフ評価内訳3行を Gemini で平易化（スコアは維持）。"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from auto_review import gemini_generate, get_api_key, require_api_key  # noqa: E402

load_dotenv(SCRIPT_DIR / ".env")

AXIS_RE = re.compile(
    r"^- \*\*(トランス度|快楽度|満足度)\s+([\d.]+)\*\*\s+…\s*(.+)$",
    re.MULTILINE,
)

SYSTEM_DEFAULT = """あなたは催眠音声レビューの編集者です。**グラフ評価内訳**の3行を、**点数の要因**が伝わるよう書き直します。

## 形式（厳守）
- **トランス度 7.2** … （2文）
- **快楽度 9.2** … （2文）
- **満足度 7.5** … （2文）
スコア数字は変えない。各軸合計70〜110字。

## 各軸の書き分け
**トランス（1文目）** … ペーシング、逆カウント、分画法、覚醒比較、三拍脱力など**技法名**＋作中手順。
**トランス（2文目）** … なぜ満点でないか（深度の持続・固定の厚みなど）。

**快楽（1文目）** … 口唇幻触・トリガー暗示等＋**どこが**（唇・舌先・頭の奥・こめかみ・背筋）**どう気持ちいいか**。
**快楽（2文目）** … 下半身を使わない脳内高揚など、9.2の強さの要約（任意で短く）。

**満足（1文目）** … 覚醒誘導・解除カウントの明確さ。
**満足（2文目）** … 尺が短い・余韻が急ぎめなど7.5の理由。

## 禁止
くっつい、整えきれない、効いている、押し寄せられる、〜おり、設計、導線、密度、主軸、〇.X水準、〇.X帯

## 出力
前置きなし。3行だけ。
"""

SYSTEM_SOFT = """あなたは催眠音声レビューの編集者です。**グラフ評価内訳**3行を、**簡単で柔らかい**日本語に添削します。

## 形式
- **トランス度 7.2** … （1〜2文）
- **快楽度 9.2** … （1〜2文）
- **満足度 7.5** … （1〜2文）
スコアは変えない。各軸 **50〜90字**・やさしい口調（です・ます）。

## トーン
- 読者にそっと説明する感じ。論文調・説教調は避ける。
- 技法名は**1つまで**、難しい語は言い換え可（例：分画法→いったん目を開けて深さを確かめる／ペーシング→吸う息を声に合わせる）。
- 「暗転」「固定」「段取り」「着地」「高揚」「幻触」など硬い語は使わない。

## 内容は残す
- トランス：吸気とカウント・開眼してまた落ちる・深くは落ちるが最後までとろっと続く感はやや弱い
- 快楽：唇・舌先・「0」で頭の奥が締まる・背筋のゾクゾク・下半身なしの脳イキ
- 満足：解除は分かりやすいが短め・口の余韻をゆっくり味わうには少し急

## 禁止
設計、導線、密度、主軸、押し寄せられる、くっつい、整えきれない

## 出力
3行だけ。
"""


def extract_lines(index_md: str) -> list[tuple[str, str, str]]:
    m = re.search(
        r"\*\*グラフ評価内訳\*\*\s*\n+(.*?)(?=\n## )",
        index_md,
        re.DOTALL,
    )
    if not m:
        return []
    out: list[tuple[str, str, str]] = []
    for line in m.group(1).strip().splitlines():
        line = line.strip()
        hit = AXIS_RE.match(line)
        if hit:
            out.append((hit.group(1), hit.group(2), hit.group(3)))
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("slug")
    p.add_argument(
        "--soft",
        action="store_true",
        help="簡易・柔らかい文体で添削（§7.1 やわらかめ）",
    )
    args = p.parse_args()

    index_path = ROOT / "src" / "content" / "レビュー" / args.slug / "index.md"
    index_md = index_path.read_text(encoding="utf-8")
    rows = extract_lines(index_md)
    if len(rows) != 3:
        print(f"[エラー] グラフ3行を抽出できませんでした ({len(rows)} 行)")
        sys.exit(1)

    prompt = "【現在の3行】\n" + "\n".join(
        f"- **{name} {score}** … {body}" for name, score, body in rows
    )
    if args.soft:
        prompt += "\n\n上記を**簡単で柔らかい**文章に添削し、3行だけ出力してください。"
        system = SYSTEM_SOFT
        temp = 0.25
    else:
        prompt += "\n\n上記をルールに沿って書き直し、3行だけ出力してください。"
        system = SYSTEM_DEFAULT
        temp = 0.15

    require_api_key()
    model = os.environ.get("GEMINI_HUMANIZE_MODEL", "gemini-2.5-flash")
    client = genai.Client(api_key=get_api_key())
    print(f"[graph] Gemini ({model}) …")
    out = gemini_generate(
        client,
        model=model,
        contents=prompt,
        system_instruction=system,
        temperature=temp,
        label="グラフ評価内訳",
    ).strip()

    new_rows: list[tuple[str, str, str]] = []
    for line in out.splitlines():
        line = line.strip()
        hit = AXIS_RE.match(line)
        if hit:
            new_rows.append((hit.group(1), hit.group(2), hit.group(3)))

    if len(new_rows) != 3:
        debug = SCRIPT_DIR / f"_graph_debug_{args.slug}.txt"
        debug.write_text(out, encoding="utf-8")
        print(f"[エラー] パース失敗 → {debug}")
        sys.exit(1)

    name_to_score = {n: s for n, s, _ in rows}
    name_to_body = {n: b for n, _, b in new_rows}
    lines_out = [
        f"- **{name} {name_to_score[name]}** … {name_to_body[name]}"
        for name in ("トランス度", "快楽度", "満足度")
    ]

    block_old = re.search(
        r"(\*\*グラフ評価内訳\*\*\s*\n+)(.*?)(?=\n## )",
        index_md,
        re.DOTALL,
    )
    if not block_old:
        sys.exit(1)
    new_block = block_old.group(1) + "\n".join(lines_out) + "\n"
    index_path.write_text(
        index_md[: block_old.start()] + new_block + index_md[block_old.end() :],
        encoding="utf-8",
    )
    print(f"[graph] 更新: {index_path}")
    for ln in lines_out:
        print(ln)


if __name__ == "__main__":
    main()
