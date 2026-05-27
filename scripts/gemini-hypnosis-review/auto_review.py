#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
催眠音声レビュー自動執筆（Gemini API）→ サイト用 B 型 index.md へマージ

使い方:
  cd scripts/gemini-hypnosis-review
  pip install -r requirements.txt
  copy .env.example .env   # GEMINI_API_KEY

  py -3 auto_review.py --slug my-work --item-name "【ASMR×催○音声】作品名" \\
      --circle "サークル名" --rj RJ312554

  # whisper/librosa は同フォルダか .env でパス指定
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
from pathlib import Path

from google import genai
from google.genai import types

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent

try:
    from dotenv import load_dotenv

    load_dotenv(SCRIPT_DIR / ".env", override=True)
except ImportError:
    pass

EVAL_SYSTEM_FILE = Path(
    os.environ.get(
        "HYPNOSIS_EVAL_SYSTEM",
        SCRIPT_DIR / "eval_system_repo.md",
    )
)
SCORING_DEF_FILE = ROOT / "docs" / "レビュー三軸評価定義.md"
SCORING_OPS_FILE = ROOT / "docs" / "レビュー執筆・採点運用ガイド.md"
WRITER_SYSTEM_FILE = Path(
    os.environ.get(
        "HYPNOSIS_WRITER_SYSTEM",
        SCRIPT_DIR / "writer_system_amatori.md",
    )
)
HYPNOSIS_WRITING_GUIDE = ROOT / "docs" / "催眠音声執筆ガイド.md"
MERGE_TEMPLATE_FILE = Path(
    os.environ.get(
        "HYPNOSIS_MERGE_TEMPLATE",
        ROOT / "templates" / "催眠音声記事原紙" / "index.gemini-merge.template.md",
    )
)
WHISPER_FILE = Path(os.environ.get("HYPNOSIS_WHISPER_FILE", SCRIPT_DIR / "whisper_output.txt"))
LIBROSA_FILE = Path(os.environ.get("HYPNOSIS_LIBROSA_FILE", SCRIPT_DIR / "librosa_output.txt"))
REVIEWS_DIR = ROOT / "src" / "content" / "レビュー"

EVAL_MODEL = os.environ.get("GEMINI_EVAL_MODEL", "gemini-2.5-flash")
WRITER_MODEL = os.environ.get("GEMINI_WRITER_MODEL", "gemini-2.5-flash")

SENSITIVITY_LEVELS = [
    (1, "トランス未経験", "トランス感覚がまだ掴めない"),
    (2, "初級トランス", "重感・深い脱力まで導入できる"),
    (3, "中級トランス", "暗示を受け入れられる（絶頂反応は未達）"),
    (4, "上級トランス", "脳イキは可能（ドライ絶頂は未達）"),
    (5, "開発済", "脳イキ・ドライを高再現で自律発生できる"),
]

ANALYSIS_TABLE_KEYS = (
    "INDUCTION_TABLE_ROWS",
    "STRONG_INDUCTION_ROWS",
    "SUGGESTION_TABLE_ROWS",
    "STRONG_SUGGESTION_ROWS",
)

TABLE_PATCH_SPEC: list[tuple[str, str, str]] = [
    ("INDUCTION_TABLE_ROWS", "### 誘導構成比", "### 本作で特に強い誘導特性"),
    ("STRONG_INDUCTION_ROWS", "### 本作で特に強い誘導特性", "### 暗示構成比"),
    ("SUGGESTION_TABLE_ROWS", "### 暗示構成比", "### 本作で特に強い暗示特性"),
    ("STRONG_SUGGESTION_ROWS", "### 本作で特に強い暗示特性", "### 主要誘導の流れ"),
]

GEMINI_KEYS = [
    "SUMMARY",
    "ITEM_DESCRIPTION",
    "TAGS_YAML",
    "SALE_DATE_DISPLAY",
    "GENRE_TYPE",
    "CV_MALE",
    "CV_FEMALE",
    "ILLUSTRATOR",
    "LOGO",
    "PACKAGE_FILES",
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
    "RATING_VALUE",
    "DRY_SCENE_COUNT",
    "WET_SCENE_COUNT",
    "SCORE_TRANSE",
    "SCORE_PLEASURE",
    "SCORE_SATISFACTION",
    "INDUCTION_TABLE_ROWS",
    "STRONG_INDUCTION_ROWS",
    "SUGGESTION_TABLE_ROWS",
    "STRONG_SUGGESTION_ROWS",
    "INDUCTION_FLOW",
    "CONCLUSION_INDUCTION",
    "CONCLUSION_PLEASURE",
    "CONCLUSION_FINAL",
]


def load_file(path: Path, description: str) -> str:
    if not path.is_file():
        print(f"[エラー] {description}（{path}）が見つかりません。")
        sys.exit(1)
    return path.read_text(encoding="utf-8")


def get_api_key() -> str:
    return os.environ.get("GEMINI_API_KEY", "").strip()


def review_safety_settings() -> list[types.SafetySetting]:
    """催眠・R18 レビュー執筆用（台詞・絶頂描写で PROHIBITED_CONTENT になりやすい）。"""
    categories = (
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    )
    return [
        types.SafetySetting(category=cat, threshold="BLOCK_NONE") for cat in categories
    ]


def gemini_generate(
    client: genai.Client,
    *,
    model: str,
    contents: str,
    system_instruction: str,
    temperature: float,
    label: str,
    max_attempts: int = 5,
) -> str:
    last_err: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            resp = client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=temperature,
                    safety_settings=review_safety_settings(),
                ),
            )
            text = resp.text or ""
            if not text.strip() and resp.prompt_feedback:
                fb = resp.prompt_feedback
                print(
                    f"[警告] {label} 空応答（prompt block: {getattr(fb, 'block_reason', fb)}）"
                )
            return text
        except Exception as exc:  # noqa: BLE001 — API 503 等を再試行
            last_err = exc
            wait = min(2**attempt, 60)
            print(f"[警告] {label} 失敗 ({attempt}/{max_attempts}): {exc}\n  {wait}s 後に再試行...")
            time.sleep(wait)
    raise last_err  # type: ignore[misc]


def require_api_key() -> None:
    if not get_api_key():
        print("[エラー] GEMINI_API_KEY が未設定です。.env を確認してください。")
        sys.exit(1)


def today_jst_ymd() -> str:
    from datetime import datetime
    from zoneinfo import ZoneInfo

    return datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y-%m-%d")


def dlsite_rj_folder(rj: str) -> str:
    m = re.match(r"^RJ(\d+)$", rj.strip(), re.I)
    if not m:
        return ""
    n = int(m.group(1))
    bucket = math.ceil(n / 1000) * 1000
    # RJ01546680 等（7桁以上）は RJ01547000 形式。従来 RJ215569 は RJ216000。
    if bucket >= 1_000_000:
        return f"RJ0{bucket:07d}"
    return f"RJ{bucket:06d}"


def build_dlsite_urls(rj: str) -> dict[str, str]:
    if not rj:
        return {
            "COVER_IMAGE": "（RJ 未指定）",
            "COVER_AFFILIATE_HREF": "（記入）",
            "AFFILIATE_HREF": "（記入）",
            "DLSITE_PRODUCT_ID": "（記入）",
        }
    folder = dlsite_rj_folder(rj)
    rid = rj.upper()
    return {
        "COVER_IMAGE": f"https://img.dlsite.jp/modpub/images2/work/doujin/{folder}/{rid}_img_main.jpg",
        "COVER_AFFILIATE_HREF": f"https://dlaf.jp/maniax/dlaf/=/t/i/link/work/aid/reviewLab/id/{rid}.html",
        "AFFILIATE_HREF": f"https://dlaf.jp/maniax/dlaf/=/t/n/link/work/aid/reviewLab/id/{rid}.html",
        "DLSITE_PRODUCT_ID": rid,
    }


def build_sensitivity_cards_html(pick_lv: int) -> str:
    lines = [
        '<div class="review-sensitivity-lv-cards" role="list" aria-label="体験感度Lv一覧">',
        "",
    ]
    for lv, grade, desc in SENSITIVITY_LEVELS:
        pick = lv == pick_lv
        cls = " review-sensitivity-lv-card--pick" if pick else ""
        small = "<small>推奨</small>" if pick else ""
        lines.extend(
            [
                f'<div class="review-sensitivity-lv-card{cls}" role="listitem">',
                f'<span class="review-sensitivity-lv-card__lv">Lv{lv}{small}</span>',
                '<div class="review-sensitivity-lv-card__main">',
                f'<span class="review-sensitivity-lv-card__grade">{grade}</span>',
                f'<span class="review-sensitivity-lv-card__desc">{desc}</span>',
                "</div>",
                "</div>",
                "",
            ]
        )
    lines.append("</div>")
    return "\n".join(lines)


def apply_mustache(template: str, variables: dict[str, str]) -> str:
    out = template
    for key, value in variables.items():
        out = out.replace(f"{{{{{key}}}}}", value)
    return out


def normalize_writer_value(key: str, val: object) -> str:
    """Gemini JSON / ブロックの値を B 型テンプレ用の文字列へ。"""
    if val is None:
        return ""
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, (int, float)):
        if key in {"RATING_VALUE", "DRY_SCENE_COUNT", "WET_SCENE_COUNT"}:
            return str(int(val))
        if key.startswith("SCORE_"):
            return str(val) if isinstance(val, float) and not val.is_integer() else str(int(val))
        return str(val)
    if isinstance(val, list):
        if key == "TAGS_YAML":
            return "\n".join(f"  - {item}" for item in val)
        if key == "PACKAGE_FILES":
            lines: list[str] = []
            for item in val:
                s = str(item).strip()
                if " … " in s:
                    name, dur = s.split(" … ", 1)
                    lines.append(f"- **{name.strip()}** … **{dur.strip()}**")
                elif "..." in s:
                    name, dur = s.split("...", 1)
                    lines.append(f"- **{name.strip()}** … **{dur.strip()}**")
                else:
                    lines.append(f"- {s}")
            return "\n".join(lines)
        if key.endswith("_ROWS"):
            return "\n".join(str(row).strip() for row in val)
        return "\n".join(str(x) for x in val)
    return str(val).strip()


def _strip_code_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*\n?", "", t, count=1)
        t = re.sub(r"\n?```\s*$", "", t)
    return t.strip()


def parse_gemini_keys(text: str) -> dict[str, str]:
    """[KEY]: 値、[KEY]ブロック、JSON オブジェクトのいずれも解析。"""
    result: dict[str, str] = {}

    json_text = _strip_code_fence(text)
    try:
        data = json.loads(json_text)
        if isinstance(data, dict):
            for k, v in data.items():
                key = str(k).strip().upper()
                if key:
                    result[key] = normalize_writer_value(key, v)
            if result:
                return result
    except json.JSONDecodeError:
        pass

    block_pat = re.compile(r"^\[([A-Z0-9_]+)\]\s*$\n(.*?)^\[/\1\]\s*$", re.MULTILINE | re.DOTALL)
    for m in block_pat.finditer(text):
        result[m.group(1)] = m.group(2).strip("\n")

    scalar_keys = {
        "SALE_DATE_DISPLAY",
        "GENRE_TYPE",
        "CV_MALE",
        "CV_FEMALE",
        "ILLUSTRATOR",
        "LOGO",
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
        "RATING_VALUE",
        "DRY_SCENE_COUNT",
        "WET_SCENE_COUNT",
        "SCORE_TRANSE",
        "SCORE_PLEASURE",
        "SCORE_SATISFACTION",
    }
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("[") and "]: " in stripped:
            key_part, val = stripped.split("]: ", 1)
            key = key_part[1:].strip()
            if key and key not in result:
                result[key] = val.strip()
            continue
        m = re.match(r"^([A-Z][A-Z0-9_]*):\s*(.+)$", stripped)
        if m and m.group(1) in scalar_keys and m.group(1) not in result:
            result[m.group(1)] = m.group(2).strip()

    # 執筆ガイド形式のクイック解析（・**ラベル**）をおすすめ欄へフォールバック
    if not result.get("RECOMMENDED_1"):
        oshi = re.findall(r"【こんな人におすすめ】\s*\n(.*?)(?:【合わない|$)", text, re.DOTALL)
        if oshi:
            labels = re.findall(r"・\*\*(.+?)\*\*", oshi[0])
            for i, label in enumerate(labels[:3], start=1):
                result[f"RECOMMENDED_{i}"] = label.strip()
    if not result.get("NOT_RECOMMENDED_1"):
        ng = re.findall(r"【合わない可能性のある方】\s*\n(.*?)(?:##|$)", text, re.DOTALL)
        if ng:
            labels = re.findall(r"・\*\*(.+?)\*\*", ng[0])
            for i, label in enumerate(labels[:2], start=1):
                result[f"NOT_RECOMMENDED_{i}"] = label.strip()

    # 主要誘導：#### 見出しブロック群
    if not result.get("INDUCTION_FLOW"):
        flow = re.search(
            r"(####\s+\d+\..*?)(?:\n##\s+総評|\n\[CONCLUSION_|\Z)",
            text,
            re.DOTALL,
        )
        if flow:
            result["INDUCTION_FLOW"] = flow.group(1).strip()

    return result


def indent_yaml_block(text: str, spaces: int = 2) -> str:
    prefix = " " * spaces
    return "\n".join(prefix + line if line else "" for line in text.splitlines())


def is_blank_meta(val: str) -> bool:
    v = (val or "").strip()
    if not v:
        return True
    if v.startswith("[") and v.endswith("]"):
        return True
    return v in {
        "—",
        "－",
        "-",
        "―",
        "なし",
        "無",
        "N/A",
        "n/a",
        "不明",
        "（なし）",
        "記載なし",
    }


OPTIONAL_BASIC_INFO: dict[str, str] = {
    "CV_MALE": "CV（男性向け本編）",
    "CV_FEMALE": "CV（女性向け）",
    "ILLUSTRATOR": "イラスト",
    "LOGO": "ロゴ",
}


def format_sale_date_display_jp(iso: str) -> str:
    """saleDate (YYYY-MM-DD) → 基本情報の販売日表示。"""
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", (iso or "").strip())
    if not m:
        return ""
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return f"{y}年{mo}月{d}日（販売ページ表記）"


def normalize_optional_meta_keys(keys: dict[str, str]) -> dict[str, str]:
    out = dict(keys)
    for key in OPTIONAL_BASIC_INFO:
        if is_blank_meta(out.get(key, "")):
            out[key] = ""
    return out


def build_cv_lines(keys: dict[str, str]) -> str:
    """CV 1名は「CV：」のみ。男性向け本編＋女性向けの2名あるときだけ向け別ラベル。"""
    male = keys.get("CV_MALE", "").strip()
    female = keys.get("CV_FEMALE", "").strip()
    if is_blank_meta(male):
        male = ""
    if is_blank_meta(female):
        female = ""
    if male and female:
        return (
            f"- **CV（男性向け本編）：** {male}\n"
            f"- **CV（女性向け）：** {female}"
        )
    sole = male or female
    if sole:
        return f"- **CV：** {sole}"
    return ""


def omit_optional_basic_info_lines(md: str) -> str:
    """DLsite に無い任意項目は行ごと削除（— や空欄・未置換 [KEY] を出さない）。"""
    blank_tail = r"(?:—|－|-|―|なし|無|\[[A-Z0-9_]+\])?\s*$"
    for label in OPTIONAL_BASIC_INFO.values():
        md = re.sub(
            rf"\n- \*\*{re.escape(label)}：\*\*\s*{blank_tail}",
            "",
            md,
            flags=re.MULTILINE,
        )
    return md


def normalize_induction_flow(flow: str) -> str:
    """主要誘導の流れ: 引用直後に誘導方法・身体の変化が blockquote に吸われないよう空行を補う（kuchikou 見本）。"""
    s = flow.replace("\r\n", "\n").strip()
    if not s:
        return s
    s = re.sub(r"(#### \d+\.[^\n]+)\n(?=>)", r"\1\n\n", s)
    s = re.sub(r"(\n>[^\n]*(?:\n>[^\n]*)*)\n(?!\n)(\*\*誘導方法)", r"\1\n\n\2", s)
    s = re.sub(r"(\*\*誘導方法:\*\*[^\n]+)\n(?!\n)(\*\*身体の変化)", r"\1\n\n\2", s)
    return s


def merge_keys(template: str, keys: dict[str, str]) -> str:
    keys = normalize_optional_meta_keys(keys)
    if keys.get("INDUCTION_FLOW"):
        keys["INDUCTION_FLOW"] = normalize_induction_flow(keys["INDUCTION_FLOW"])
    keys = {**keys, "CV_LINES": build_cv_lines(keys)}
    out = template
    yaml_block_keys = {"SUMMARY", "ITEM_DESCRIPTION"}
    for key, val in sorted(keys.items(), key=lambda x: -len(x[0])):
        token = f"[{key}]"
        if key in yaml_block_keys:
            val = indent_yaml_block(val)
        out = out.replace(token, val)
    return omit_optional_basic_info_lines(out)


def extract_score_number(eval_text: str) -> float | None:
    """評価脳テキストから最終スコアらしき数値を拾う（フォールバック）。"""
    stage = re.search(
        r"最終(?:トランス|快楽|満足)スコア[：:]\s*\*?\*?\s*(\d+(?:\.\d+)?)\s*/\s*10",
        eval_text,
    )
    if stage:
        return float(stage.group(1))
    nums = re.findall(r"(?:合計|総合|最終|スコア)[^\d]{0,20}(\d+(?:\.\d+)?)", eval_text)
    if nums:
        return float(nums[-1])
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*[/／]\s*10", eval_text)
    if nums:
        return float(nums[0])
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*点", eval_text)
    return float(nums[-1]) if nums else None


EVAL_AXIS_LABELS = {
    "trance": "トランス度（没入・誘導の深さ）",
    "pleasure": "快楽度（快感設計・絶頂シーン）",
    "satisfaction": "満足度（着地・余韻・尺対密度）",
}

AXIS_MANUAL_FILES = {
    "trance": "催眠トランス度採点マニュアル.txt",
    "pleasure": "催眠快楽採点マニュアル.txt",
    "satisfaction": "催眠満足度採点マニュアル.txt",
}
DESKTOP_WRITER_GUIDE = "催眠音声執筆ガイド.txt"
DEFAULT_MANUAL_DIR = Path(
    os.environ.get(
        "HYPNOSIS_MANUAL_DIR",
        r"C:\Users\tomok\Desktop\催眠音声記事作成マニュアル",
    )
)


def manual_dir() -> Path:
    return Path(os.environ.get("HYPNOSIS_MANUAL_DIR", str(DEFAULT_MANUAL_DIR)))


def load_axis_manual(axis: str) -> str:
    path = manual_dir() / AXIS_MANUAL_FILES[axis]
    if not path.is_file():
        print(f"[エラー] 採点マニュアルが見つかりません: {path}")
        sys.exit(1)
    return path.read_text(encoding="utf-8")


def load_desktop_writer_guide() -> str:
    path = manual_dir() / DESKTOP_WRITER_GUIDE
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return ""


def build_eval_prompt(source_context: str, axis: str, manual_text: str) -> str:
    label = EVAL_AXIS_LABELS.get(axis, axis)
    return (
        f"{source_context}\n\n"
        "--------------------------------------------------\n"
        f"今回採点する軸: **{label}**\n"
        "上記の WhisperX / Librosa と、system 指示の採点マニュアルのみに基づき採点してください。"
        "マニュアル指定の出力フォーマットに従い、最終スコアを明示してください。"
        + (
            " 快楽軸: ドライオーガズムと脳イキは別物。C-0がドライ型なら【ドライ型】目安で判定し、同一視しない。"
            if axis == "pleasure"
            else ""
        )
    )


def build_writer_prompt(
    res_t: str,
    res_p: str,
    res_s: str,
    keys_doc: str,
    product_facts: str,
    only_keys: list[str] | None = None,
) -> str:
    keys_section = keys_doc
    if only_keys:
        keys_section = (
            f"今回出力するキーは次のみ: {', '.join(only_keys)}\n"
            f"該当する [KEY] ブロックだけを出力すること。他キー・挨拶・説明は禁止。\n\n"
            f"{keys_doc}"
        )
    return (
        f"【作品メタ（創作禁止・この事実を優先）】\n{product_facts}\n\n"
        f"【評価脳の解析結果 — 必ず反映】\n\n"
        f"■ トランス度:\n{res_t or '（省略）'}\n\n"
        f"■ 快楽度:\n{res_p or '（省略）'}\n\n"
        f"■ 満足度:\n{res_s or '（省略）'}\n\n"
        f"--------------------------------------------------\n"
        f"【執筆指示 — 厳守】\n"
        f"・既存の当サイトレビュー・過去原稿の文章を参照・模倣・流用してはならない。\n"
        f"・事実は今回渡した Whisper / Librosa / 作品メタ のみ。台詞引用は Whisper に実在する文だけ。\n"
        f"・執筆正本は `docs/催眠音声執筆ガイド.md` §0 ライター脳と `writer_output_keys.md`。\n"
        f"・SUMMARY=コンセプトのみ簡潔（批評禁止）、ITEM_DESCRIPTION=時刻根拠の肉付け、INDUCTION_FLOW=§4。\n"
        f"・デスクトップ `催眠音声執筆ガイド.txt` は system 短縮版。\n"
        f"サイト掲載用は出力キー（[KEY]）／JSON のみ。\n"
        f"・SCORE_* / RATING_VALUE / 表の行名は keys 定義どおり。捏造の CV・販売日・トラック名禁止。\n"
        f"・DRY_SCENE_COUNT / WET_SCENE_COUNT は Whisper の到達回収のみ数える（§0.1.2）。1回と決め打ち禁止。\n"
        f"・## 見出しや「クイック解析」セクション形式での出力は禁止（[KEY] のみ）。\n\n"
        f"【出力形式 — 厳守】\n{keys_section}\n"
    )


def replace_key_block(draft_text: str, key: str, new_content: str) -> str:
    block = f"[{key}]\n{new_content.strip()}\n[/{key}]"
    pattern = rf"\[{re.escape(key)}\][\s\S]*?\[/{re.escape(key)}\]"
    if re.search(pattern, draft_text):
        return re.sub(pattern, block, draft_text, count=1)
    return draft_text.rstrip() + "\n\n" + block + "\n"


def load_eval_results(slug: str) -> tuple[str, str, str]:
    eval_dir = SCRIPT_DIR / "eval_results"
    paths = {
        "trance": eval_dir / f"{slug}_trance.md",
        "pleasure": eval_dir / f"{slug}_pleasure.md",
        "satisfaction": eval_dir / f"{slug}_satisfaction.md",
    }
    out: list[str] = []
    for axis in ("trance", "pleasure", "satisfaction"):
        p = paths[axis]
        out.append(p.read_text(encoding="utf-8") if p.is_file() else "")
    return tuple(out)  # type: ignore[return-value]


def normalize_table_rows_block(raw: str) -> str:
    """四表のデータ行のみ（| で始まる行。ヘッダ・区切りは除く）。"""
    lines: list[str] = []
    for line in raw.replace("\r\n", "\n").split("\n"):
        s = line.strip()
        if not s.startswith("|"):
            continue
        if re.match(r"^\|\s*[-:]+\s*\|", s):
            continue
        if "項目" in s and "数値" in s:
            continue
        if s.startswith("| 特性 |") or s.startswith("| 項目 |"):
            continue
        lines.append(s)
    return "\n".join(lines)


def parse_table_rows_markdown(rows_md: str) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for line in normalize_table_rows_block(rows_md).splitlines():
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) < 3:
            continue
        out.append({"label": parts[0], "value": parts[1], "detail": parts[2]})
    return out


def patch_analysis_tables_in_index(index_md: str, keys: dict[str, str]) -> str:
    """index.md の四表データ行だけ差し替え（見出し・注記・主要誘導は維持）。"""
    md = index_md
    for key, start_h3, end_h3 in TABLE_PATCH_SPEC:
        rows = normalize_table_rows_block(keys.get(key, ""))
        if not rows:
            raise ValueError(f"空の表行: {key}")
        pat = (
            rf"({re.escape(start_h3)}[\s\S]*?"
            rf"\| [^\n]+ \|\n\|---\|[^\n]+\|\n)"
            rf"[\s\S]*?"
            rf"(\n{re.escape(end_h3)})"
        )
        md, n = re.subn(pat, rf"\1{rows}\n\2", md, count=1)
        if n != 1:
            raise ValueError(f"表セクションの置換に失敗: {key} ({start_h3})")
    return md


def validate_analysis_tables(keys: dict[str, str]) -> list[str]:
    """合計10・特性名・禁止語の簡易検証。警告文のリストを返す。"""
    warnings: list[str] = []
    comp_keys = ("INDUCTION_TABLE_ROWS", "SUGGESTION_TABLE_ROWS")
    for ck in comp_keys:
        rows = parse_table_rows_markdown(keys.get(ck, ""))
        total = 0.0
        for r in rows:
            m = re.search(r"([\d.]+)", r["value"])
            if m:
                total += float(m.group(1))
        if rows and abs(total - 10.0) > 0.15:
            warnings.append(f"{ck}: 数値合計が10.0付近ではありません（合計≈{total:.1f}）")
    for sk in ("STRONG_INDUCTION_ROWS", "STRONG_SUGGESTION_ROWS"):
        for r in parse_table_rows_markdown(keys.get(sk, "")):
            if r["label"] in ("特性名", "（特性名）"):
                warnings.append(f"{sk}: 特性名がプレースホルダのままです")
    banned = ("Librosa", "同相バインド", "ステージ4", "CFバイパス")
    blob = "\n".join(keys.get(k, "") for k in ANALYSIS_TABLE_KEYS)
    for b in banned:
        if b in blob:
            warnings.append(f"四表に禁止メタ語: {b}")
    return warnings


def update_analysis_json(
    path: Path,
    item_name: str,
    keys: dict[str, str],
    res_t: str,
    res_p: str,
    res_s: str,
) -> None:
    def pick_score(key: str, fallback_text: str) -> float:
        raw = keys.get(key, "").strip()
        if raw:
            try:
                return float(raw)
            except ValueError:
                pass
        fb = extract_score_number(fallback_text)
        return fb if fb is not None else 0.0

    trance = pick_score("SCORE_TRANSE", res_t)
    pleasure = pick_score("SCORE_PLEASURE", res_p)
    satisfaction = pick_score("SCORE_SATISFACTION", res_s)
    dry = keys.get("DRY_SCENE_COUNT", "0").strip() or "0"
    wet = keys.get("WET_SCENE_COUNT", "0").strip() or "0"

    if path.is_file():
        data = json.loads(path.read_text(encoding="utf-8"))
    else:
        data = {"schemaVersion": 1, "workName": item_name, "notes": []}

    data["workName"] = item_name
    data["scores"] = {
        "trance": round(trance, 1),
        "pleasure": round(pleasure, 1),
        "satisfaction": round(satisfaction, 1),
    }
    data["orgasmSummary"] = (
        f"絶頂目安（本文総合評価と同期）: ドライシーン{dry}回・ウェットシーン{wet}回"
    )
    if any(keys.get(k, "").strip() for k in ANALYSIS_TABLE_KEYS):
        data["analysisTables"] = {
            "optimizedAt": today_jst_ymd(),
            "inductionComposition": parse_table_rows_markdown(
                keys.get("INDUCTION_TABLE_ROWS", "")
            ),
            "strongInduction": parse_table_rows_markdown(
                keys.get("STRONG_INDUCTION_ROWS", "")
            ),
            "suggestionComposition": parse_table_rows_markdown(
                keys.get("SUGGESTION_TABLE_ROWS", "")
            ),
            "strongSuggestion": parse_table_rows_markdown(
                keys.get("STRONG_SUGGESTION_ROWS", "")
            ),
        }
    gemini_note = (
        f"Gemini auto_review.py 生成（{today_jst_ymd()}）"
        " — 採点:デスクトップ採点マニュアル3種。本文:催眠音声執筆ガイド+B型原紙。旧稿未参照。"
    )
    notes = data.get("notes") or []
    if not isinstance(notes, list):
        notes = [str(notes)]
    if not any("Gemini auto_review" in str(n) for n in notes):
        notes.insert(0, gemini_note)
    table_note = f"四表最適化（{today_jst_ymd()}）— Gemini + Whisper/Librosa（§3.1）"
    if not any("四表最適化" in str(n) for n in notes):
        notes.append(table_note)
    data["notes"] = notes

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Gemini で B 型 index.md を生成")
    p.add_argument("--slug", required=True, help="レビュー slug（英小文字・ハイフン）")
    p.add_argument("--item-name", required=True, help="商品名")
    p.add_argument("--circle", default="（記入）", help="サークル名")
    p.add_argument("--rj", default="", help="DLsite RJ 番号")
    p.add_argument("--sale-date", default="2000-01-01", help="saleDate YYYY-MM-DD")
    p.add_argument("--published-at", default="", help="publishedAt YYYY-MM-DD")
    p.add_argument("--recommended-lv", type=int, default=2, choices=range(1, 6))
    p.add_argument("--force", action="store_true", help="既存 index.md を上書き")
    p.add_argument(
        "--merge-only",
        action="store_true",
        help="review_output.md を B 型へマージのみ（Gemini API 呼び出しなし）",
    )
    p.add_argument(
        "--draft-file",
        default="",
        help="--merge-only 時に読む Gemini 生出力（既定: review_output.md）",
    )
    p.add_argument(
        "--output",
        default="",
        help="index.md の出力先（省略時は src/content/レビュー/<slug>/index.md）",
    )
    p.add_argument(
        "--analysis-dir",
        default="",
        help="解析フォルダ（指定時 whisper/librosa を自動生成）",
    )
    p.add_argument(
        "--info-file",
        default="",
        help="info.txt（作品メタ。未指定時は analysis-dir/info.txt）",
    )
    p.add_argument(
        "--keys",
        default="",
        help="執筆するキーのみ（カンマ区切り。例: INDUCTION_FLOW）。既存 review_output にマージ",
    )
    p.add_argument(
        "--optimize-tables",
        action="store_true",
        help="四表のみ Gemini 再生成し index.md の表行を差し替え（_分析データ.json に analysisTables）",
    )
    p.add_argument(
        "--skip-eval",
        action="store_true",
        help="採点をスキップ（eval_results/<slug>_*.md を利用。無い場合は空）",
    )
    p.add_argument(
        "--writer-only",
        action="store_true",
        help="--skip-eval と併用。本文執筆のみ（採点 API 呼び出しなし）",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.slug):
        print(f"[エラー] slug が不正です: {args.slug}")
        sys.exit(1)

    out_dir = REVIEWS_DIR / args.slug
    index_path = Path(args.output) if args.output else out_dir / "index.md"
    analysis_path = out_dir / "_分析データ.json"
    draft_path = Path(args.draft_file) if args.draft_file else SCRIPT_DIR / "review_output.md"

    if index_path.exists() and not args.force and not args.optimize_tables:
        print(f"[エラー] 既に存在します: {index_path}\n  --force で上書き")
        sys.exit(1)
    if args.optimize_tables and not index_path.is_file():
        print(f"[エラー] --optimize-tables には既存 index.md が必要です: {index_path}")
        sys.exit(1)

    print("--------------------------------------------------")
    print(" 催眠音声レビュー -> B型 index.md 自動生成 ")
    print("--------------------------------------------------")

    only_keys = [k.strip() for k in args.keys.split(",") if k.strip()]
    if args.optimize_tables:
        only_keys = list(ANALYSIS_TABLE_KEYS)
        args.skip_eval = True
    for k in only_keys:
        if k not in GEMINI_KEYS:
            print(f"[エラー] 未知のキー: {k}")
            sys.exit(1)

    print("[1/6] 正本・原紙テンプレートを読み込み...")
    print(f"       採点: デスクトップ採点マニュアル（{manual_dir()}）")
    print("       本文: B型原紙 + docs/催眠音声執筆ガイド.md + 執筆ガイド.txt")
    merge_template = load_file(MERGE_TEMPLATE_FILE, "B型マージ原紙")

    res_t = res_p = res_s = ""
    generated = ""

    if args.merge_only:
        print("[2-4/6] スキップ（--merge-only）")
        generated = load_file(draft_path, "Gemini 生出力")
    elif only_keys:
        require_api_key()
        desktop_writer = load_desktop_writer_guide()
        writer_system = load_file(WRITER_SYSTEM_FILE, "執筆ガイド（ライター脳）")
        hypnosis_guide = load_file(HYPNOSIS_WRITING_GUIDE, "催眠音声執筆ガイド")
        keys_doc = load_file(SCRIPT_DIR / "writer_output_keys.md", "出力キー定義")
        res_t, res_p, res_s = load_eval_results(args.slug)

        if args.analysis_dir:
            import subprocess

            ad = Path(args.analysis_dir)
            subprocess.run(
                [sys.executable, str(SCRIPT_DIR / "prepare_analysis_inputs.py"), str(ad)],
                check=True,
            )

        info_path = Path(args.info_file) if args.info_file else None
        if info_path is None and args.analysis_dir:
            cand = Path(args.analysis_dir) / "info.txt"
            if cand.is_file():
                info_path = cand
        product_facts = (
            info_path.read_text(encoding="utf-8")
            if info_path and info_path.is_file()
            else "（info.txt なし）"
        )

        whisper_data = load_file(WHISPER_FILE, "WhisperX")
        librosa_data = load_file(LIBROSA_FILE, "Librosa")
        source_context = f"【WhisperX】\n{whisper_data}\n\n【Librosa】\n{librosa_data}"

        client = genai.Client(api_key=get_api_key())
        print(f"[2-3/6] スキップ（--keys {','.join(only_keys)}）")
        print("[4/6] 部分執筆（Gemini）...")
        writer_prompt = build_writer_prompt(
            res_t, res_p, res_s, keys_doc, product_facts, only_keys=only_keys
        )
        extra_flow = ""
        if "INDUCTION_FLOW" in only_keys:
            extra_flow = (
                "【追加】INDUCTION_FLOW: 催眠音声執筆ガイド §4 厳守。"
                "見出しは工程名のみ禁止。各手順は #### →空行→引用→空行→**誘導方法:**→空行→**身体の変化:**（kuchikou 見本）。"
                "引用は Whisper から1〜3文・80〜200字に切り出し（連結全文禁止）。"
            )
        if "DRY_SCENE_COUNT" in only_keys or "WET_SCENE_COUNT" in only_keys:
            extra_flow = (
                (extra_flow or "")
                + "【追加】DRY_SCENE_COUNT/WET_SCENE_COUNT: Whisper 全トラックを走査。"
                "ドライシーン＝射精を伴わない明確な到達回収（0/ゼロ合図・弾ける・ドライオーガズム宣言後の回収）。"
                "予告・焦らし・同一波内の繰り返しは含めない。とろとろ本編・乳首・亀頭・耳など別峰は別カウント。"
            )
        if set(only_keys) & set(ANALYSIS_TABLE_KEYS):
            extra_flow = (
                (extra_flow or "")
                + "【追加・四表】docs/催眠音声執筆ガイド.md §3.1 厳守。"
                "見本: asmr-saimin-aman-toro-lip の四表（特性名は具体名・特性名禁止）。"
                "誘導5行・暗示7行は数値合計10.0。全行2.0の均一配分禁止。"
                "使用技法は【】内・台本の手続き名（CFバイパス等の論文語禁止）。"
                "Librosa・採点・ステージ・同相バインド等のメタ語禁止。"
            )
        writer_prompt = f"{source_context}\n\n{writer_prompt}\n{extra_flow}"
        table_hint = ""
        if set(only_keys) & set(ANALYSIS_TABLE_KEYS):
            table_hint = (
                "見本: asmr-saimin-aman-toro-lip の四表（特性名は具体名）。"
            )
        writer_instruction_parts = [
            writer_system,
            desktop_writer,
            "【執筆正本】\n" + hypnosis_guide,
            table_hint
            or "見本: kuchikou-saimin-count-trip-nouiki の主要誘導の流れ（型のみ・文言コピー禁止）。",
            "出力は指定 [KEY] のみ。",
        ]
        partial = gemini_generate(
            client,
            model=WRITER_MODEL,
            contents=writer_prompt,
            system_instruction="\n\n".join(p for p in writer_instruction_parts if p.strip()),
            temperature=0.2,
            label=f"部分執筆 ({','.join(only_keys)})",
        )
        base_draft = (
            draft_path.read_text(encoding="utf-8") if draft_path.is_file() else ""
        )
        partial_keys = parse_gemini_keys(partial)
        generated = base_draft
        for k in only_keys:
            if k not in partial_keys or not partial_keys[k].strip():
                print(f"[エラー] Gemini がキーを返しませんでした: {k}")
                sys.exit(1)
            generated = replace_key_block(generated, k, partial_keys[k])
        draft_path.write_text(generated, encoding="utf-8")
    elif args.skip_eval or args.writer_only:
        require_api_key()
        desktop_writer = load_desktop_writer_guide()
        writer_system = load_file(WRITER_SYSTEM_FILE, "執筆ガイド（ライター脳）")
        hypnosis_guide = load_file(HYPNOSIS_WRITING_GUIDE, "催眠音声執筆ガイド")
        keys_doc = load_file(SCRIPT_DIR / "writer_output_keys.md", "出力キー定義")
        res_t, res_p, res_s = load_eval_results(args.slug)

        if args.analysis_dir:
            import subprocess

            ad = Path(args.analysis_dir)
            subprocess.run(
                [sys.executable, str(SCRIPT_DIR / "prepare_analysis_inputs.py"), str(ad)],
                check=True,
            )

        info_path = Path(args.info_file) if args.info_file else None
        if info_path is None and args.analysis_dir:
            cand = Path(args.analysis_dir) / "info.txt"
            if cand.is_file():
                info_path = cand
        product_facts = (
            info_path.read_text(encoding="utf-8")
            if info_path and info_path.is_file()
            else "（info.txt なし）"
        )

        whisper_data = load_file(WHISPER_FILE, "WhisperX")
        librosa_data = load_file(LIBROSA_FILE, "Librosa")
        source_context = f"【WhisperX】\n{whisper_data}\n\n【Librosa】\n{librosa_data}"

        client = genai.Client(api_key=get_api_key())
        print("[3/6] スキップ（--skip-eval / --writer-only）")
        print("[4/6] 記事本文執筆（Gemini）...")
        writer_prompt = build_writer_prompt(
            res_t, res_p, res_s, keys_doc, product_facts, only_keys=None
        )
        writer_prompt = f"{source_context}\n\n{writer_prompt}"
        writer_instruction_parts = [
            writer_system,
            desktop_writer,
            "【執筆正本（§0 ライター脳含む）】\n" + hypnosis_guide,
            "見本記事: kuchikou-saimin-count-trip-nouiki（完成系・SUMMARY・おすすめ理由・主要誘導・身体の変化の型のみ。文言コピー禁止）。",
            "【追加厳守】出力は writer_output_keys の [KEY] ブロックまたは単一 JSON のみ。",
            "Markdown の ## 見出し・クイック解析セクション形式は禁止。",
            "既存の当該 slug の index.md・旧 review_output は参照しない。Whisper 実データのみ根拠に。",
            "【用語】ドライオーガズムと脳イキは別物。同一視・括弧併記（ドライオーガズム（脳イキ）等）禁止。台本がドライと言う箇所はドライオーガズムと書く（§0.1.1）。",
        ]
        generated = gemini_generate(
            client,
            model=WRITER_MODEL,
            contents=writer_prompt,
            system_instruction="\n\n".join(p for p in writer_instruction_parts if p.strip()),
            temperature=0.2,
            label="記事本文執筆",
        )
        draft_path.write_text(generated, encoding="utf-8")
    else:
        require_api_key()
        trance_manual = load_axis_manual("trance")
        pleasure_manual = load_axis_manual("pleasure")
        satisfaction_manual = load_axis_manual("satisfaction")
        desktop_writer = load_desktop_writer_guide()
        writer_system = load_file(WRITER_SYSTEM_FILE, "執筆ガイド（ライター脳）")
        hypnosis_guide = load_file(HYPNOSIS_WRITING_GUIDE, "催眠音声執筆ガイド")
        keys_doc = load_file(SCRIPT_DIR / "writer_output_keys.md", "出力キー定義")

        if args.analysis_dir:
            import subprocess

            ad = Path(args.analysis_dir)
            subprocess.run(
                [sys.executable, str(SCRIPT_DIR / "prepare_analysis_inputs.py"), str(ad)],
                check=True,
            )

        info_path = Path(args.info_file) if args.info_file else None
        if info_path is None and args.analysis_dir:
            cand = Path(args.analysis_dir) / "info.txt"
            if cand.is_file():
                info_path = cand
        if info_path is None:
            repo_info = REVIEWS_DIR / args.slug / "analysis" / "info.txt"
            if repo_info.is_file():
                info_path = repo_info
        product_facts = (
            info_path.read_text(encoding="utf-8")
            if info_path and info_path.is_file()
            else "（info.txt なし）"
        )

        print("[2/6] Whisper / Librosa を読み込み...")
        whisper_data = load_file(WHISPER_FILE, "WhisperX")
        librosa_data = load_file(LIBROSA_FILE, "Librosa")
        source_context = f"【WhisperX】\n{whisper_data}\n\n【Librosa】\n{librosa_data}"

        client = genai.Client(api_key=get_api_key())

        print("[3/6] 三軸採点（Gemini・デスクトップ採点マニュアル）...")
        res_t = gemini_generate(
            client,
            model=EVAL_MODEL,
            contents=build_eval_prompt(source_context, "trance", trance_manual),
            system_instruction=trance_manual,
            temperature=0.0,
            label="トランス度採点",
        )
        trance_score = extract_score_number(res_t)

        pleasure_sys = pleasure_manual
        if trance_score is not None:
            pleasure_sys = pleasure_sys.replace("[TRANS_SCORE]", f"{trance_score:.1f}")

        res_p = gemini_generate(
            client,
            model=EVAL_MODEL,
            contents=build_eval_prompt(source_context, "pleasure", pleasure_manual),
            system_instruction=pleasure_sys,
            temperature=0.0,
            label="快楽度採点",
        )

        res_s = gemini_generate(
            client,
            model=EVAL_MODEL,
            contents=build_eval_prompt(source_context, "satisfaction", satisfaction_manual),
            system_instruction=satisfaction_manual,
            temperature=0.0,
            label="満足度採点",
        )
        eval_dir = SCRIPT_DIR / "eval_results"
        eval_dir.mkdir(exist_ok=True)
        (eval_dir / f"{args.slug}_trance.md").write_text(res_t, encoding="utf-8")
        (eval_dir / f"{args.slug}_pleasure.md").write_text(res_p, encoding="utf-8")
        (eval_dir / f"{args.slug}_satisfaction.md").write_text(res_s, encoding="utf-8")

        print("[4/6] 記事本文執筆（Gemini・B型原紙 + 執筆ガイド）...")
        writer_prompt = build_writer_prompt(res_t, res_p, res_s, keys_doc, product_facts)
        writer_instruction_parts = [
            writer_system,
            desktop_writer,
            "【執筆正本（§0 ライター脳含む）】\n" + hypnosis_guide,
            "見本記事: kuchikou-saimin-count-trip-nouiki（完成系・SUMMARY・おすすめ理由・主要誘導・身体の変化の型のみ。文言コピー禁止）。",
            "【追加厳守】出力は writer_output_keys の [KEY] ブロックまたは単一 JSON のみ。",
            "Markdown の ## 見出し・クイック解析セクション形式は禁止。",
            "既存の当該 slug の index.md・旧 review_output は参照しない。Whisper 実データのみ根拠に。",
            "【用語】ドライオーガズムと脳イキは別物。同一視・括弧併記（ドライオーガズム（脳イキ）等）禁止。台本がドライと言う箇所はドライオーガズムと書く（§0.1.1）。",
        ]
        generated = gemini_generate(
            client,
            model=WRITER_MODEL,
            contents=writer_prompt,
            system_instruction="\n\n".join(p for p in writer_instruction_parts if p.strip()),
            temperature=0.2,
            label="記事本文執筆",
        )

        draft_path.write_text(generated, encoding="utf-8")

    keys = parse_gemini_keys(generated)

    if args.optimize_tables:
        print("[5/6] 四表のみ index.md へ差し替え...")
        for k in ANALYSIS_TABLE_KEYS:
            if not keys.get(k, "").strip():
                print(f"[エラー] 四表キーが空です: {k}")
                sys.exit(1)
        for w in validate_analysis_tables(keys):
            print(f"[警告] {w}")
        try:
            index_md = patch_analysis_tables_in_index(
                index_path.read_text(encoding="utf-8"), keys
            )
        except ValueError as e:
            print(f"[エラー] {e}")
            sys.exit(1)
        print("[6/6] 保存...")
        index_path.write_text(index_md, encoding="utf-8")
        update_analysis_json(analysis_path, args.item_name, keys, res_t, res_p, res_s)
    else:
        print("[5/6] B型原紙へマージ...")
        pick = next((g for lv, g, _ in SENSITIVITY_LEVELS if lv == args.recommended_lv), "初級トランス")
        pub = args.published_at.strip() or today_jst_ymd()
        dlsite = build_dlsite_urls(args.rj.strip().upper())

        shell_vars = {
            "SLUG": args.slug,
            "ITEM_NAME": args.item_name,
            "CIRCLE_NAME": args.circle,
            "SALE_DATE": args.sale_date,
            "PUBLISHED_AT": pub,
            "RECOMMENDED_LV": str(args.recommended_lv),
            "RECOMMENDED_LV_GRADE": pick,
            "SENSITIVITY_CARDS_HTML": build_sensitivity_cards_html(args.recommended_lv),
            **dlsite,
        }
        shell = apply_mustache(merge_template, shell_vars)
        for opt in OPTIONAL_BASIC_INFO:
            if opt not in keys or is_blank_meta(keys.get(opt, "")):
                keys[opt] = ""
        sale_disp = format_sale_date_display_jp(args.sale_date)
        if sale_disp and (
            not keys.get("SALE_DATE_DISPLAY", "").strip()
            or keys.get("SALE_DATE_DISPLAY", "").strip().startswith("[")
        ):
            keys["SALE_DATE_DISPLAY"] = sale_disp
        index_md = merge_keys(shell, keys)

        print("[6/6] 保存...")
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text(index_md, encoding="utf-8")
        update_analysis_json(analysis_path, args.item_name, keys, res_t, res_p, res_s)

    if not args.optimize_tables:
        optional_empty = {k for k in OPTIONAL_BASIC_INFO if not keys.get(k, "").strip()}
        missing = [
            k
            for k in GEMINI_KEYS
            if f"[{k}]" in index_md and k not in optional_empty
        ]
    else:
        missing = []
    if missing:
        print("\n[エラー] 未置換のプレースホルダ（甘とろB型の必須キー）:")
        for k in missing:
            print(f"  - [{k}]")
        print(f"  Gemini 生出力: {draft_path}")
        sys.exit(1)

    triangle_script = ROOT / "scripts" / "generate_review_triangle.py"
    if analysis_path.is_file() and triangle_script.is_file():
        import subprocess

        print("\n[7/7] review_triangle.png を生成（_分析データ.json・小数表示）...")
        subprocess.run(
            [sys.executable, str(triangle_script), args.slug],
            cwd=str(ROOT),
            check=True,
        )

    print("\n【完了】")
    print(f"  index.md      → {index_path}")
    print(f"  _分析データ.json → {analysis_path}")
    print(f"  Gemini生出力  → {draft_path}")
    print("\n残作業（必須）:")
    print(f"  py -3 scripts/gemini-hypnosis-review/restore_body_changes.py {args.slug}")
    print(f"  py -3 scripts/gemini-hypnosis-review/generate_work_impression.py {args.slug} --write-tsx")
    print("  quickGuideBySlug のその他フィールド / products.json / audit-kansei")
    print("  （dev 時は npm run dev で画像同期）")


if __name__ == "__main__":
    main()
