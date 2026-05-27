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
各手順ごとに:
[BODY_N]
**身体の変化:** （1〜3文・です／ます調）
[/BODY_N]

N はプロンプトで指定された件数ぶん **すべて** 出力。前置き禁止。

## 因果順（必須・メルティ標本と同型）
1. **体内メカニズム** … 副交感／交感、前頭の思考抑制、筋緊張・血流、注意の内向き、**ドーパミン**・**オキシトシン**・**エンドルフィン**・**GABA** 等（手順に合うものだけ。根拠のない羅列禁止）
2. **その結果、** … リスナーが**実際に感じる**体感（肩の脱力・頭内の締まり・全身の振動・羞恥の熱・覚醒など）

**NG:** 体感だけで終わる文（メカニズムなし）。体内と体感の順序が逆。

## 手順別の目安
- 導入・リラックス: 副交感神経優位 → 心拍・肩の脱力
- 深化・音分離・階段: 注意の内向き・前頭抑制・筋緊張低下（無理にドーパミン不要）
- 快感・EDMビート・絶頂・ライブ配信: **ドーパミン** を太字で1回以上。連続絶頂なら **エンドルフィン** も可
- 解除: 交感神経側へ戻る → 呼吸・現実感

## 禁止
くっつい、整えきれない、設計、導線、押し寄せられる、感覚がある、立ち上が

## 見本（メルティ型）
**身体の変化:** ゆっくりとした呼吸が続くことで副交感神経が優位になり、覚醒系の緊張が下がります。その結果、心拍と呼吸が落ち着き、肩の力が抜けて、意識が日常のβ波からα波へと移行しやすくなります。
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
        if not re.match(r"\d+\.", block.strip()):
            continue
        title_m = re.match(r"(\d+)\.\s+(.+?)\n", block)
        quote_m = re.search(r"^>\s*(.+)", block, re.MULTILINE)
        method_m = re.search(r"\*\*誘導方法:\*\*\s*(.+)", block)
        body_m = re.search(r"\*\*身体の変化:\*\*\s*(.+)", block, re.DOTALL)
        if title_m and method_m and body_m:
            steps.append(
                {
                    "n": title_m.group(1),
                    "title": title_m.group(2).strip(),
                    "quote": quote_m.group(1).strip()[:200] if quote_m else "",
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


def write_compare_file(
    slug: str, steps: list[dict[str, str]], bodies: dict[str, str]
) -> Path:
    out_path = SCRIPT_DIR / f"body_compare_{slug}.md"
    lines = [f"# 身体の変化 比較: {slug}\n", "手編集（実行前） vs Gemini（今回）\n"]
    for s in steps:
        n = s["n"]
        lines.append(f"## 手順{n}: {s['title']}\n")
        lines.append("### 手編集（変更前）\n")
        lines.append(f"{s['body']}\n")
        lines.append("### Gemini\n")
        lines.append(bodies.get(n, "（なし）").replace("**身体の変化:** ", "") + "\n")
        lines.append("---\n")
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("slug")
    p.add_argument(
        "--compare-only",
        action="store_true",
        help="index.md は更新せず body_compare_<slug>.md に差分だけ出力",
    )
    args = p.parse_args()

    index_path = ROOT / "src" / "content" / "レビュー" / args.slug / "index.md"
    index_md = index_path.read_text(encoding="utf-8")
    steps = extract_steps(index_md)
    n_steps = len(steps)
    if n_steps < 5 or n_steps > 8:
        print(f"[エラー] 手順は5〜8件想定ですが {n_steps} 件抽出されました")
        sys.exit(1)

    guide_excerpt = load_file(ROOT / "docs" / "催眠音声執筆ガイド.md", "guide")
    guide_45 = ""
    if "### 4.5 身体の変化" in guide_excerpt:
        guide_45 = guide_excerpt.split("### 4.5 身体の変化", 1)[1].split("### 4.6", 1)[0]

    prompt_parts = [
        f"【執筆ルール抜粋】\n{guide_45}\n",
        f"【{n_steps}手順・現状】\n",
    ]
    for s in steps:
        # 台詞・現状文は入力ブロックされやすいため送らない（誘導方法・見出しのみ）
        prompt_parts.append(
            f"### 手順{s['n']}: {s['title']}\n"
            f"誘導方法: {s['method']}\n"
        )
    prompt_parts.append(
        f"\n{n_steps}件すべての [BODY_N]…[/BODY_N] を出力してください（N=1〜{n_steps}）。"
    )
    prompt = "\n".join(prompt_parts)

    system = SYSTEM.replace(
        "N はプロンプトで指定された件数ぶん **すべて** 出力。",
        f"N は 1〜{n_steps}。**{n_steps}件すべて**出力。",
    )

    require_api_key()
    model = os.environ.get("GEMINI_HUMANIZE_MODEL", "gemini-2.5-flash")
    client = genai.Client(api_key=get_api_key())
    print(f"[body] Gemini ({model}) … {n_steps}手順")
    out = gemini_generate(
        client,
        model=model,
        contents=prompt,
        system_instruction=system,
        temperature=0.2,
        label="身体の変化",
    )
    if not (out or "").strip():
        print("[エラー] Gemini が空応答を返しました（API キー・クォータを確認）")
        sys.exit(1)
    bodies = parse_bodies(out)
    if len(bodies) != n_steps:
        debug = SCRIPT_DIR / f"_body_debug_{args.slug}.txt"
        debug.write_text(out, encoding="utf-8")
        print(f"[エラー] パース失敗 ({len(bodies)}/{n_steps}) → {debug}")
        sys.exit(1)

    compare_path = write_compare_file(args.slug, steps, bodies)
    print(f"[body] 比較ファイル: {compare_path}")

    if args.compare_only:
        print("[body] --compare-only のため index.md は未更新")
        return

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
        print(f"\n--- {n} ---\n{bodies[n][:160]}…")


if __name__ == "__main__":
    main()
