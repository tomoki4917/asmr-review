#!/usr/bin/env python3
"""主要誘導の流れ：身体の変化のみ、体内メカニズム→体感（§4.5）で Gemini 改稿。"""
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

from auto_review import gemini_generate, get_api_key, load_file, require_api_key  # noqa: E402

load_dotenv(SCRIPT_DIR / ".env")

SYSTEM = """あなたは催眠音声レビューの編集者です。**身体の変化**行だけを書き直します。

## 形式（厳守）
各手順ごとに1行:
[BODY_N]
（**身体の変化:** から始める1〜3文・です／ます調）
[/BODY_N]

N は 1〜7。7件すべて出力。前置き禁止。

## 因果順（必須）
1. **体内メカニズム**（副交感神経・前頭の思考抑制・筋緊張・注意の向き・**ドーパミン**・**エンドルフィン**・**GABA** 等、手順に合うもの）
2. **その結果、** リスナーが感じる体感（重さ・脱力・口唇の熱・頭内の締まり・覚醒など）

## 手順別の目安
- 1（呼吸）: 副交感神経優位 → 心拍・肩の脱力
- 2〜4（深化）: 注意の内向き・筋緊張低下・トランス固定（無理にドーパミン不要）
- 5（開眼比較）: 覚醒と催眠の落差・再深化の期待
- 6（口唇・ゼロ）: **ドーパミン**必須（作品台詞にドーパミン言及あり）。絶頂手順なら**エンドルフィン**も可
- 7（解除）: 交感神経側へ戻る → 現実感

## 禁止
体感だけで終わる文、くっつい、整えきれない、設計、導線、押し寄せられる、感覚がある

## 物質名
快感・口唇・ゼロ合図の手順では **ドーパミン** を太字 `**ドーパミン**` で1回以上。
"""


def extract_steps(index_md: str) -> list[dict[str, str]]:
    m = re.search(
        r"### 主要誘導の流れ.*?(?=\n---\s*\n\s*\n## 総評)",
        index_md,
        re.DOTALL,
    )
    if not m:
        return []
    section = m.group(0)
    steps: list[dict[str, str]] = []
    for block in re.split(r"\n#### ", section):
        if not block.strip().startswith(("1.", "2.", "3.", "4.", "5.", "6.", "7.")):
            continue
        title_m = re.match(r"(\d+)\.\s+(.+?)\n", block)
        method_m = re.search(r"\*\*誘導方法:\*\*\s*(.+)", block)
        body_m = re.search(r"\*\*身体の変化:\*\*\s*(.+)", block, re.DOTALL)
        if title_m and method_m and body_m:
            steps.append(
                {
                    "n": title_m.group(1),
                    "title": title_m.group(2).strip(),
                    "method": method_m.group(1).strip(),
                    "body": body_m.group(1).strip().split("\n\n")[0],
                }
            )
    return steps


def parse_bodies(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in re.finditer(r"\[BODY_(\d+)\]\s*\n(.*?)\[/BODY_\1\]", text, re.DOTALL):
        body = m.group(2).strip()
        if not body.startswith("**身体の変化:**"):
            body = "**身体の変化:** " + body.lstrip("*身体の変化:* ").strip()
        out[m.group(1)] = body
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("slug")
    args = p.parse_args()

    index_path = ROOT / "src" / "content" / "レビュー" / args.slug / "index.md"
    index_md = index_path.read_text(encoding="utf-8")
    steps = extract_steps(index_md)
    if len(steps) != 7:
        print(f"[エラー] 手順7件を抽出できませんでした ({len(steps)})")
        sys.exit(1)

    guide_excerpt = load_file(ROOT / "docs" / "催眠音声執筆ガイド.md", "guide")
    guide_45 = ""
    if "### 4.5 身体の変化" in guide_excerpt:
        guide_45 = guide_excerpt.split("### 4.5 身体の変化", 1)[1].split("### 4.6", 1)[0]

    prompt_parts = [f"【執筆ルール抜粋】\n{guide_45}\n", "【7手順・現状】\n"]
    for s in steps:
        prompt_parts.append(
            f"### 手順{s['n']}: {s['title']}\n"
            f"誘導方法: {s['method']}\n"
            f"現状の身体の変化: {s['body']}\n"
        )
    prompt_parts.append("\n7件の [BODY_N]…[/BODY_N] を出力してください。")
    prompt = "\n".join(prompt_parts)

    require_api_key()
    model = os.environ.get("GEMINI_HUMANIZE_MODEL", "gemini-2.5-flash")
    client = genai.Client(api_key=get_api_key())
    print(f"[body] Gemini ({model}) …")
    out = gemini_generate(
        client,
        model=model,
        contents=prompt,
        system_instruction=SYSTEM,
        temperature=0.2,
        label="身体の変化",
    )
    bodies = parse_bodies(out)
    if len(bodies) != 7:
        debug = SCRIPT_DIR / f"_body_debug_{args.slug}.txt"
        debug.write_text(out, encoding="utf-8")
        print(f"[エラー] パース失敗 ({len(bodies)}/7) → {debug}")
        sys.exit(1)

    new_md = index_md
    for s in steps:
        old_body_line = f"**身体の変化:** {s['body']}"
        new_body = bodies[s["n"]]
        if old_body_line not in new_md:
            print(f"[警告] 手順{s['n']} の置換失敗")
            continue
        new_md = new_md.replace(old_body_line, new_body, 1)

    index_path.write_text(new_md, encoding="utf-8")
    print(f"[body] 更新: {index_path}")
    for n in sorted(bodies, key=int):
        print(f"\n--- {n} ---\n{bodies[n][:120]}…")


if __name__ == "__main__":
    main()
