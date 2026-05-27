#!/usr/bin/env python3
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
load_dotenv(SCRIPT_DIR / ".env")

from restore_body_changes import SYSTEM, extract_steps, parse_bodies  # noqa: E402
from auto_review import gemini_generate, get_api_key, require_api_key  # noqa: E402

ROOT = SCRIPT_DIR.parents[1]
slug = "edm-trip-orgasm-saimin"
index_md = (ROOT / "src/content/レビュー" / slug / "index.md").read_text(encoding="utf-8")
steps = extract_steps(index_md)
guide_excerpt = (ROOT / "docs/催眠音声執筆ガイド.md").read_text(encoding="utf-8")
guide_45 = guide_excerpt.split("### 4.5 身体の変化", 1)[1].split("### 4.6", 1)[0]
n_steps = len(steps)
prompt_parts = [f"【執筆ルール抜粋】\n{guide_45}\n", f"【{n_steps}手順・現状】\n"]
for s in steps:
    quote_line = f"台詞抜粋: {s['quote']}\n" if s["quote"] else ""
    prompt_parts.append(
        f"### 手順{s['n']}: {s['title']}\n"
        f"{quote_line}誘導方法: {s['method']}\n"
        f"現状の身体の変化: {s['body']}\n"
    )
prompt_parts.append(f"\n{n_steps}件すべての [BODY_N]…[/BODY_N] を出力（N=1〜{n_steps}）。")
prompt = "\n".join(prompt_parts)
system = SYSTEM.replace(
    "N はプロンプトで指定された件数ぶん **すべて** 出力。",
    f"N は 1〜{n_steps}。**{n_steps}件すべて**出力。",
)
print("prompt chars:", len(prompt))
require_api_key()
model = os.environ.get("GEMINI_HUMANIZE_MODEL", "gemini-2.5-flash")
client = genai.Client(api_key=get_api_key())
from google.genai import types

r = client.models.generate_content(
    model=model,
    contents=prompt,
    config=types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.2,
    ),
)
print("finish:", r.candidates[0].finish_reason if r.candidates else "none")
print("text len:", len(r.text or ""))
if r.prompt_feedback:
    print("feedback:", r.prompt_feedback)
out = r.text or ""
print("out len:", len(out))
if out:
    (SCRIPT_DIR / "_body_debug_edm-trip-orgasm-saimin.txt").write_text(out, encoding="utf-8")
    bodies = parse_bodies(out)
    print("parsed:", len(bodies), "/", n_steps)
    for n in sorted(bodies, key=int):
        print(f"\n--- {n} ---\n{bodies[n]}")
