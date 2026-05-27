#!/usr/bin/env python3
"""おすすめ／合わないの理由文だけ、Gemini で平易化（内容は維持・言い回しのみ）。"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from auto_review import gemini_generate, get_api_key, require_api_key  # noqa: E402

load_dotenv(SCRIPT_DIR / ".env")

KEYS = [
    "RECOMMENDED_1_REASON",
    "RECOMMENDED_2_REASON",
    "RECOMMENDED_3_REASON",
    "NOT_RECOMMENDED_1_REASON",
    "NOT_RECOMMENDED_2_REASON",
]

SYSTEM = """あなたは日本語の編集者です。ユーザーが渡す「原文」の理由段落を、**意味と事実は変えず**、**言い回しだけ**平易に直します。

## 厳守
- 原文にない作品説明・一般論を書かない（「導入からスムーズ」等の創作禁止）。
- 原文の数字・時刻・用語（例: 約2分、約24分、543210、ゼロ、吸って、約39分、約1分半）は削除・変更しない。
- 1項目1〜2文。中学生でも読める短い日本語。

## 禁止語
寄り道、噛み合い、温度が、主燃料、前面に、方向け、ぶれ、設計、導線、集約、回収、密度、核、寄せやすい、感じられる一本

## 出力
依頼された KEY だけ、次の形式のみ（前置き・解説・他KEY禁止）:

[KEY_NAME]
（理由文のみ）
[/KEY_NAME]
"""


_ITEM = re.compile(
    r"^- \*\*(.+?)\*\*\s{2,}\r?\n\s{2,}(.+?)(?=\r?\n\r?\n- \*\*|\r?\n\r?\n\*\*【|\r?\n\r?\n---|\Z)",
    re.DOTALL | re.MULTILINE,
)


def extract_reasons(index_md: str) -> dict[str, str]:
    """index のおすすめ／合わないから理由文を抽出。"""
    blocks: dict[str, str] = {}
    if "**【こんな人におすすめ】**" not in index_md:
        return blocks
    rec_section = index_md.split("**【こんな人におすすめ】**", 1)[1]
    rec_section = rec_section.split("**【合わない可能性がある人】**", 1)[0]
    for i, (_, body) in enumerate(_ITEM.findall(rec_section)[:3], 1):
        blocks[f"RECOMMENDED_{i}_REASON"] = body.strip()

    if "**【合わない可能性がある人】**" in index_md:
        not_section = index_md.split("**【合わない可能性がある人】**", 1)[1]
        not_section = not_section.split("\n\n---", 1)[0]
        for i, (_, body) in enumerate(_ITEM.findall(not_section)[:2], 1):
            blocks[f"NOT_RECOMMENDED_{i}_REASON"] = body.strip()
    return blocks


def parse_blocks(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in re.finditer(r"\[([A-Z0-9_]+)\]\s*\n(.*?)\[/\1\]", text, re.DOTALL):
        out[m.group(1)] = m.group(2).strip()
    return out


def patch_index(index_md: str, reasons: dict[str, str]) -> str:
    """各リスト項目の理由段落を差し替え。"""
    key_order = [
        ("RECOMMENDED_1_REASON", 0),
        ("RECOMMENDED_2_REASON", 1),
        ("RECOMMENDED_3_REASON", 2),
        ("NOT_RECOMMENDED_1_REASON", 0),
        ("NOT_RECOMMENDED_2_REASON", 1),
    ]

    def replace_section(section_name: str, start_key: str, count: int) -> None:
        nonlocal index_md
        if section_name not in index_md:
            return
        head, rest = index_md.split(section_name, 1)
        end = rest.find("**【合わない") if "おすすめ" in section_name else rest.find("\n\n---")
        if end == -1:
            end = len(rest)
        section = rest[:end]
        tail = rest[end:]

        items = re.findall(
            r"(^- \*\*.+?\*\*\s{2,}\n)(.+?)(?=\n\n- \*\*|\Z)",
            section,
            re.DOTALL,
        )
        new_items = []
        for idx, (prefix, body) in enumerate(items):
            key = f"{start_key.split('_')[0]}_{idx + 1}_REASON" if "RECOMMENDED" in start_key else (
                f"NOT_RECOMMENDED_{idx + 1}_REASON"
            )
            # map idx to key name
            if "おすすめ" in section_name:
                key = f"RECOMMENDED_{idx + 1}_REASON"
            else:
                key = f"NOT_RECOMMENDED_{idx + 1}_REASON"
            if key in reasons:
                body = reasons[key]
            new_items.append(prefix + body)
        new_section = "\n\n".join(new_items)
        if items:
            # rebuild: keep header lines before first item
            pre = section.split("- **", 1)[0]
            index_md = head + section_name + pre + new_section + tail

    # Simpler: replace by key content directly
    for key, new_body in reasons.items():
        old = extract_reasons(index_md).get(key, "")
        if old and old in index_md:
            index_md = index_md.replace(old, new_body, 1)
    return index_md


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("slug")
    p.add_argument(
        "--keys",
        nargs="*",
        choices=KEYS,
        help="平易化するキーのみ（省略時は5件すべて）",
    )
    args = p.parse_args()
    target_keys = args.keys or KEYS
    index_path = ROOT / "src" / "content" / "レビュー" / args.slug / "index.md"
    if not index_path.is_file():
        print(f"[エラー] {index_path}")
        sys.exit(1)

    index_md = index_path.read_text(encoding="utf-8")
    current = extract_reasons(index_md)
    if not current:
        print("[エラー] 理由文を抽出できませんでした")
        sys.exit(1)

    prompt_parts = [
        f"次の{len(target_keys)}件を平易化してください。各KEYの「原文」を必ずベースにし、事実は残してください。\n"
    ]
    for key in target_keys:
        if key in current:
            prompt_parts.append(f"[{key} の原文]\n{current[key]}\n")
    prompt_parts.append(
        "\n出力: 依頼された KEY ごとに [KEY]…[/KEY] のみ。KEY名は原文と同じにすること。"
    )
    prompt = "\n".join(prompt_parts)

    require_api_key()
    model = os.environ.get("GEMINI_HUMANIZE_MODEL") or os.environ.get(
        "GEMINI_WRITER_MODEL", "gemini-2.5-flash"
    )
    client = genai.Client(api_key=get_api_key())
    print(f"[simplify] Gemini ({model}) …")
    out = gemini_generate(
        client,
        model=model,
        contents=prompt,
        system_instruction=SYSTEM,
        temperature=0.1,
        label="理由文の平易化",
    )

    simplified = parse_blocks(out)
    if not simplified:
        # フォールバック: ``` や KEY: 形式
        for key in KEYS:
            m = re.search(
                rf"(?:\[{key}\]|{key}:)\s*\n?(.*?)(?=\n(?:\[|{KEYS[0]}:)|\Z)",
                out,
                re.DOTALL | re.IGNORECASE,
            )
            if m:
                simplified[key] = m.group(1).strip().strip("`")
    missing = [k for k in target_keys if k not in simplified]
    if missing:
        print("[警告] 未返却:", ", ".join(missing))
        debug_path = SCRIPT_DIR / f"_simplify_debug_{args.slug}.txt"
        debug_path.write_text(out, encoding="utf-8")
        print(f"[警告] 生出力: {debug_path}")

    if not simplified:
        print("[エラー] Gemini の応答をパースできませんでした")
        sys.exit(1)

    merged = {**current, **{k: simplified[k] for k in target_keys if k in simplified}}
    new_index = patch_index(index_md, merged)
    if new_index != index_md:
        index_path.write_text(new_index, encoding="utf-8")
    else:
        print("[警告] index.md に差分がありません（置換失敗の可能性）")
        sys.exit(1)
    print(f"[simplify] 更新: {index_path}")
    for key in target_keys:
        if key in simplified:
            print(f"\n--- {key} ---\n{simplified[key]}")


if __name__ == "__main__":
    main()
