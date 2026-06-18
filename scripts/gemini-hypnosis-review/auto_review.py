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

sys.path.insert(0, str(SCRIPT_DIR))
from trance_scoring_guards import (  # noqa: E402
    apply_trance_scoring_guards,
    cap_pleasure_for_trance,
)
from review_prose_rules import (  # noqa: E402
    load_forbidden_rules,
    load_guide_excerpts_for_writer,
    validate_index_md,
    validate_prose_keys,
)
from merge_preserve_sections import (  # noqa: E402
    count_part_analysis_headings,
    extract_preserved_sections,
    inject_preserved_sections,
)

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
TRANCE_RUBRIC_FILE = SCRIPT_DIR / "eval_trance_rubric.md"
PLEASURE_RUBRIC_FILE = SCRIPT_DIR / "eval_pleasure_rubric.md"
SATISFACTION_RUBRIC_FILE = SCRIPT_DIR / "eval_satisfaction_rubric.md"
SCENARIO_RUBRIC_FILE = SCRIPT_DIR / "eval_scenario_rubric.md"
SCORING_DEF_FILE = ROOT / "docs" / "レビュー三軸評価定義.md"
SCORING_OPS_FILE = ROOT / "docs" / "レビュー執筆・採点運用ガイド.md"
WRITER_SYSTEM_FILE = Path(
    os.environ.get(
        "HYPNOSIS_WRITER_SYSTEM",
        SCRIPT_DIR / "writer_system_amatori.md",
    )
)
HYPNOSIS_WRITING_GUIDE = ROOT / "docs" / "催眠音声執筆ガイド.md"
SCENARIO_VOICE_WRITING_GUIDE = ROOT / "docs" / "シチュエーションボイス執筆ガイド.md"
ALL_AGES_SCENARIO_WRITING_GUIDE = (
    ROOT / "docs" / "全年齢シチュエーションボイス執筆ガイド.md"
)
ALL_AGES_SCORING_DEF = ROOT / "docs" / "全年齢シチュボイス五軸評価定義.md"
WRITER_OUTPUT_KEYS_SCENARIO = SCRIPT_DIR / "writer_output_keys_scenario.md"
SCENARIO_SAMPLE_SLUG = "dakimakura-kanojo-pretty-holic-yurukawa-kouhai"
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

SCENARIO_GEMINI_KEYS = [
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
    "ORGASM_SCENE_COUNT",
    "SCORE_IMMERSION",
    "SCORE_SCENARIO",
    "SCORE_PLEASURE",
    "SCORE_ACOUSTIC",
    "SCORE_SATISFACTION",
    "MAJOR_FETISH",
    "SITUATION_TYPE",
    "GRAPH_BREAKDOWN",
    "CONCLUSION_DESIGN",
    "CONCLUSION_ACOUSTIC",
    "CONCLUSION_FINAL",
]


def scenario_voice_mode(args: argparse.Namespace) -> bool:
    return bool(getattr(args, "scenario_voice", False))


def active_gemini_keys(args: argparse.Namespace) -> list[str]:
    return SCENARIO_GEMINI_KEYS if scenario_voice_mode(args) else GEMINI_KEYS


def all_ages_scenario_mode(args: argparse.Namespace) -> bool:
    return scenario_voice_mode(args) and bool(getattr(args, "all_ages", False))


def writing_guide_path(args: argparse.Namespace) -> Path:
    if all_ages_scenario_mode(args):
        return ALL_AGES_SCENARIO_WRITING_GUIDE
    return (
        SCENARIO_VOICE_WRITING_GUIDE
        if scenario_voice_mode(args)
        else HYPNOSIS_WRITING_GUIDE
    )


def writer_keys_path(args: argparse.Namespace) -> Path:
    return (
        WRITER_OUTPUT_KEYS_SCENARIO
        if scenario_voice_mode(args)
        else SCRIPT_DIR / "writer_output_keys.md"
    )


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
        r"最終(?:トランス|快楽|満足|シナリオ|音響|没入)(?:度|スコア)[：:]\s*\*?\*?\s*(\d+(?:\.\d+)?)\s*/\s*10",
        eval_text,
    )
    if stage:
        return float(stage.group(1))
    heading = re.search(
        r"##\s*(?:トランス|快楽|満足)度[：:]\s*(\d+(?:\.\d+)?)",
        eval_text,
    )
    if heading:
        return float(heading.group(1))
    heading2 = re.search(
        r"###\s*(?:シナリオ|音響|没入度|快楽度|満足度|Acoustic|Scenario)[^\n:]*:\s*(\d+(?:\.\d+)?)",
        eval_text,
        re.I,
    )
    if heading2:
        return float(heading2.group(1))
    nums = re.findall(r"(?:合計|総合|最終|スコア)[^\d]{0,20}(\d+(?:\.\d+)?)", eval_text)
    if nums:
        return float(nums[-1])
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*[/／]\s*10", eval_text)
    if nums:
        return float(nums[0])
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*点", eval_text)
    return float(nums[-1]) if nums else None


TRANCE_LANES: dict[str, dict[str, object]] = {
    "deepening": {
        "label": "深化型",
        "weights": [("入り", 0.20), ("深さ", 0.35), ("暗示の効き", 0.20), ("維持", 0.25)],
    },
    "acceptance": {
        "label": "受容・支配型",
        "weights": [("入り", 0.25), ("深さ", 0.20), ("暗示の効き", 0.30), ("維持", 0.25)],
    },
    "sensory": {
        "label": "感覚・ASMR型",
        "weights": [("入り", 0.25), ("深さ", 0.15), ("暗示の効き", 0.30), ("維持", 0.30)],
    },
    "trigger": {
        "label": "トリガー型",
        "weights": [("入り", 0.20), ("深さ", 0.20), ("暗示の効き", 0.35), ("維持", 0.25)],
    },
    "minimal": {
        "label": "薄い催眠型",
        "weights": [("入り", 0.25), ("深さ", 0.25), ("暗示の効き", 0.25), ("維持", 0.25)],
    },
}

PLEASURE_C0: dict[str, dict[str, object]] = {
    "brain": {
        "label": "脳イキ寄り",
        "weights": [
            ("コンセプト整合", 0.25),
            ("刺激・報酬", 0.30),
            ("クライマックス", 0.25),
            ("起伏・焦らし", 0.20),
        ],
    },
    "emotional": {
        "label": "情緒・幸せ寄り",
        "weights": [
            ("コンセプト整合", 0.30),
            ("刺激・報酬", 0.25),
            ("クライマックス", 0.20),
            ("起伏・焦らし", 0.25),
        ],
    },
    "corruption": {
        "label": "堕落・背徳寄り",
        "weights": [
            ("コンセプト整合", 0.25),
            ("刺激・報酬", 0.25),
            ("クライマックス", 0.25),
            ("起伏・焦らし", 0.25),
        ],
    },
    "dry": {
        "label": "ドライ寄り",
        "weights": [
            ("コンセプト整合", 0.30),
            ("刺激・報酬", 0.30),
            ("クライマックス", 0.25),
            ("起伏・焦らし", 0.15),
        ],
    },
    "trigger": {
        "label": "トリガー寄り",
        "weights": [
            ("コンセプト整合", 0.20),
            ("刺激・報酬", 0.35),
            ("クライマックス", 0.25),
            ("起伏・焦らし", 0.20),
        ],
    },
    "other": {
        "label": "その他・複合",
        "weights": [
            ("コンセプト整合", 0.25),
            ("刺激・報酬", 0.25),
            ("クライマックス", 0.25),
            ("起伏・焦らし", 0.25),
        ],
    },
}

SATISFACTION_WEIGHTS: list[tuple[str, float]] = [
    ("約束の着地", 0.30),
    ("解除・戻し", 0.25),
    ("余韻・情緒", 0.25),
    ("尺対密度", 0.20),
]

SCENARIO_LANES: dict[str, dict[str, object]] = {
    "pure_progression": {
        "label": "純愛・関係進展型",
        "scenario_weights": [
            ("心理", 0.30),
            ("一貫性", 0.25),
            ("ギミック", 0.20),
            ("フック", 0.25),
        ],
        "immersion_weights": [("定位", 0.45), ("親密距離", 0.55)],
    },
    "taboo_corruption": {
        "label": "背徳・NTR型",
        "scenario_weights": [
            ("心理", 0.30),
            ("一貫性", 0.25),
            ("ギミック", 0.25),
            ("フック", 0.20),
        ],
        "immersion_weights": [("定位", 0.50), ("親密距離", 0.50)],
    },
    "gimmick_driven": {
        "label": "ギミック驱动型",
        "scenario_weights": [
            ("心理", 0.20),
            ("一貫性", 0.20),
            ("ギミック", 0.35),
            ("フック", 0.25),
        ],
        "immersion_weights": [("定位", 0.45), ("親密距離", 0.55)],
    },
    "intimate_asmr": {
        "label": "密着ASMR型",
        "scenario_weights": [
            ("心理", 0.25),
            ("一貫性", 0.15),
            ("ギミック", 0.30),
            ("フック", 0.30),
        ],
        "immersion_weights": [("定位", 0.35), ("親密距離", 0.65)],
    },
    "healing_allages": {
        "label": "癒し・安眠型",
        "scenario_weights": [
            ("心理", 0.35),
            ("一貫性", 0.25),
            ("ギミック", 0.15),
            ("フック", 0.25),
        ],
        "immersion_weights": [("定位", 0.40), ("親密距離", 0.60)],
    },
}

SCENARIO_AXIS_DEFAULT_WEIGHTS: dict[str, list[tuple[str, float]]] = {
    "acoustic": [("台詞", 0.55), ("情景音", 0.45)],
    "immersion": [("定位", 0.50), ("親密距離", 0.50)],
    "pleasure": [("声色", 0.50), ("峰と間", 0.50)],
    "pleasure_all_ages": [("入眠", 0.55), ("覚醒", 0.45)],
    "satisfaction": [("回収", 0.55), ("終端", 0.45)],
}

SCENARIO_FINAL_SCORE_HEADERS: dict[str, str] = {
    "scenario": "最終シナリオ度",
    "acoustic": "最終音響度",
    "immersion": "最終没入度",
    "pleasure": "最終快楽度",
    "satisfaction": "最終満足度",
}


def apply_weak_factor_cap(composite: float, dimensions: dict[str, float]) -> float:
    if not dimensions:
        return composite
    min_factor = min(dimensions.values())
    max_factor = max(dimensions.values())
    if min_factor <= 6.0:
        composite = min(composite, min_factor + 1.5)
    elif min_factor <= 7.0 and (max_factor - min_factor) >= 2.0:
        composite = min(composite, round(composite * 0.85 + min_factor * 0.15, 1))
    return round(composite, 1)


def extract_scenario_lane(eval_text: str) -> str:
    lane = extract_lane_id(eval_text, SCENARIO_LANES, "シチュレーン")
    return lane or "gimmick_driven"


def get_scenario_axis_weights(
    axis: str,
    lane: str,
    *,
    all_ages: bool = False,
) -> list[tuple[str, float]]:
    if axis == "scenario":
        return list(SCENARIO_LANES[lane]["scenario_weights"])  # type: ignore[arg-type]
    if axis == "immersion":
        return list(SCENARIO_LANES[lane]["immersion_weights"])  # type: ignore[arg-type]
    if axis == "pleasure" and all_ages:
        return SCENARIO_AXIS_DEFAULT_WEIGHTS["pleasure_all_ages"]
    if axis in SCENARIO_AXIS_DEFAULT_WEIGHTS:
        return SCENARIO_AXIS_DEFAULT_WEIGHTS[axis]
    return []


def extract_scenario_axis_score(
    axis: str,
    eval_text: str,
    *,
    lane: str | None = None,
    all_ages: bool = False,
) -> float | None:
    header = SCENARIO_FINAL_SCORE_HEADERS.get(axis, f"最終{axis}")
    if axis == "pleasure" and all_ages:
        explicit = re.search(
            r"最終(?:睡眠・覚醒|睡眠覚醒)度[：:]\s*\*?\*?\s*(\d+(?:\.\d+)?)\s*/\s*10",
            eval_text,
        )
    else:
        explicit = re.search(
            rf"{re.escape(header)}[：:]\s*\*?\*?\s*(\d+(?:\.\d+)?)\s*/\s*10",
            eval_text,
        )
    if explicit:
        return float(explicit.group(1))
    resolved_lane = lane or extract_scenario_lane(eval_text)
    weights = get_scenario_axis_weights(axis, resolved_lane, all_ages=all_ages)
    if not weights:
        return extract_score_number(eval_text)
    labels = [label for label, _ in weights]
    dims = extract_dimension_scores(eval_text, labels)
    weighted = compute_weighted_score(dims, weights)
    if weighted is None:
        return extract_score_number(eval_text)
    return apply_weak_factor_cap(weighted, dims)


def build_scenario_scoring_metadata(
    axis: str,
    eval_text: str,
    *,
    lane: str | None = None,
    all_ages: bool = False,
) -> dict[str, object]:
    resolved_lane = lane or extract_scenario_lane(eval_text)
    weights = get_scenario_axis_weights(axis, resolved_lane, all_ages=all_ages)
    labels = [label for label, _ in weights]
    dims = extract_dimension_scores(eval_text, labels)
    meta: dict[str, object] = {
        "dimensions": dims,
        "rubricVersion": "eval_scenario_rubric.md",
    }
    if axis == "scenario":
        meta["lane"] = resolved_lane
        meta["laneLabel"] = SCENARIO_LANES[resolved_lane]["label"]
    if axis == "pleasure" and all_ages:
        meta["axisLabel"] = "睡眠・覚醒"
    return meta


def extract_dimension_scores(eval_text: str, labels: list[str]) -> dict[str, float]:
    scores: dict[str, float] = {}
    for label in labels:
        table_row = re.search(
            rf"\|\s*{re.escape(label)}\s*\|\s*(\d+(?:\.\d+)?)\s*\|",
            eval_text,
        )
        if table_row:
            scores[label] = float(table_row.group(1))
            continue
        m = re.search(
            rf"{re.escape(label)}[^\d]{{0,28}}(\d+(?:\.\d+)?)",
            eval_text,
        )
        if m:
            scores[label] = float(m.group(1))
    return scores


def extract_lane_id(eval_text: str, lanes: dict[str, dict[str, object]], header: str) -> str:
    m = re.search(rf"{re.escape(header)}[：:]\s*(\w+)", eval_text, re.I)
    if m:
        key = m.group(1).lower()
        if key in lanes:
            return key
    for key, meta in lanes.items():
        if str(meta.get("label", "")) in eval_text:
            return key
    return ""


def compute_weighted_score(
    dimensions: dict[str, float],
    weights: list[tuple[str, float]],
) -> float | None:
    if len(dimensions) < len(weights):
        return None
    total = sum(dimensions[label] * weight for label, weight in weights)
    return round(total, 1)


def extract_trance_lane(eval_text: str) -> str:
    lane = extract_lane_id(eval_text, TRANCE_LANES, "トランスレーン")
    return lane or "minimal"


def extract_pleasure_c0(eval_text: str) -> str:
    c0 = extract_lane_id(eval_text, PLEASURE_C0, "快楽C-0")
    return c0 or "other"


def guarded_trance_result(eval_text: str) -> tuple[float | None, dict[str, object], list[str]]:
    """eval 本文からガード適用後のトランス度・メタデータを返す。"""
    guarded = apply_trance_scoring_guards(eval_text)
    if guarded.score is not None:
        meta: dict[str, object] = {
            "lane": guarded.lane,
            "laneLabel": TRANCE_LANES[guarded.lane]["label"],
            "dimensions": guarded.dimensions,
            "rubricVersion": "eval_trance_rubric.md",
        }
        if guarded.guard_notes:
            meta["guardNotes"] = guarded.guard_notes
        return guarded.score, meta, guarded.guard_notes
    if explicit:
        score: float | None = float(explicit.group(1))
    else:
        lane = extract_trance_lane(eval_text)
        weights = list(TRANCE_LANES[lane]["weights"])  # type: ignore[arg-type]
        labels = [label for label, _ in weights]
        score = compute_weighted_score(extract_dimension_scores(eval_text, labels), weights)
        if score is None:
            raw = extract_score_number(eval_text)
            score = float(raw) if raw is not None else None
    lane = extract_trance_lane(eval_text)
    weights = list(TRANCE_LANES[lane]["weights"])  # type: ignore[arg-type]
    labels = [label for label, _ in weights]
    meta: dict[str, object] = {
        "lane": lane,
        "laneLabel": TRANCE_LANES[lane]["label"],
        "dimensions": extract_dimension_scores(eval_text, labels),
        "rubricVersion": "eval_trance_rubric.md",
    }
    return score, meta, []


def extract_trance_score(eval_text: str) -> float | None:
    score, _, _ = guarded_trance_result(eval_text)
    return score


def extract_pleasure_score(eval_text: str) -> float | None:
    explicit = re.search(
        r"最終快楽度[：:]\s*\*?\*?\s*(\d+(?:\.\d+)?)\s*/\s*10",
        eval_text,
    )
    if explicit:
        return float(explicit.group(1))
    c0 = extract_pleasure_c0(eval_text)
    weights = list(PLEASURE_C0[c0]["weights"])  # type: ignore[arg-type]
    labels = [label for label, _ in weights]
    weighted = compute_weighted_score(extract_dimension_scores(eval_text, labels), weights)
    if weighted is not None:
        return weighted
    return extract_score_number(eval_text)


def extract_satisfaction_score(eval_text: str) -> float | None:
    explicit = re.search(
        r"最終満足度[：:]\s*\*?\*?\s*(\d+(?:\.\d+)?)\s*/\s*10",
        eval_text,
    )
    if explicit:
        return float(explicit.group(1))
    labels = [label for label, _ in SATISFACTION_WEIGHTS]
    weighted = compute_weighted_score(
        extract_dimension_scores(eval_text, labels),
        SATISFACTION_WEIGHTS,
    )
    if weighted is not None:
        return weighted
    return extract_score_number(eval_text)


def build_axis_scoring_metadata(eval_text: str, axis: str) -> dict[str, object]:
    if axis == "trance":
        _, meta, _ = guarded_trance_result(eval_text)
        return meta
    if axis == "pleasure":
        c0 = extract_pleasure_c0(eval_text)
        weights = list(PLEASURE_C0[c0]["weights"])  # type: ignore[arg-type]
        labels = [label for label, _ in weights]
        dims = extract_dimension_scores(eval_text, labels)
        return {
            "c0": c0,
            "c0Label": PLEASURE_C0[c0]["label"],
            "dimensions": dims,
            "rubricVersion": "eval_pleasure_rubric.md",
        }
    if axis == "satisfaction":
        labels = [label for label, _ in SATISFACTION_WEIGHTS]
        dims = extract_dimension_scores(eval_text, labels)
        return {
            "dimensions": dims,
            "rubricVersion": "eval_satisfaction_rubric.md",
        }
    return {}


EVAL_AXIS_LABELS = {
    "trance": "トランス度（レーン別4次元：入り・深さ・暗示の効き・維持）",
    "pleasure": "快楽度（C-0別4次元：整合・刺激・クライマックス・起伏）",
    "satisfaction": "満足度（4次元：着地・戻し・余韻・密度）",
    "scenario": "シナリオ",
    "acoustic": "音響",
    "immersion": "没入度",
}

SCENARIO_EVAL_SYSTEM_FILE = SCRIPT_DIR / "eval_system_scenario_repo.md"
SCENARIO_SCORING_DEF = ROOT / "docs" / "シチュボイス五軸評価定義.md"
SCENARIO_EVAL_AXIS_ORDER: list[tuple[str, str]] = [
    ("scenario", "シナリオ"),
    ("acoustic", "音響"),
    ("immersion", "没入度"),
    ("pleasure", "快楽度"),
    ("satisfaction", "満足度"),
]

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


def load_eval_repo_context() -> str:
    """リポジトリ採点正本（eval_system_repo + 三軸定義 + 運用ガイド）。Gemini 採点に必須。"""
    parts: list[str] = []
    for path in (EVAL_SYSTEM_FILE, SCORING_OPS_FILE, SCORING_DEF_FILE):
        if path.is_file():
            parts.append(path.read_text(encoding="utf-8"))
    return "\n\n".join(parts)


def build_axis_eval_instruction(axis_manual: str) -> str:
    return "\n\n".join(p for p in (load_eval_repo_context(), axis_manual) if p.strip())


def build_trance_eval_instruction(trance_manual: str) -> str:
    rubric = ""
    if TRANCE_RUBRIC_FILE.is_file():
        rubric = TRANCE_RUBRIC_FILE.read_text(encoding="utf-8")
    return "\n\n".join(
        p for p in (load_eval_repo_context(), rubric, trance_manual) if p.strip()
    )


def build_pleasure_eval_instruction(pleasure_manual: str) -> str:
    rubric = ""
    if PLEASURE_RUBRIC_FILE.is_file():
        rubric = PLEASURE_RUBRIC_FILE.read_text(encoding="utf-8")
    return "\n\n".join(
        p for p in (load_eval_repo_context(), rubric, pleasure_manual) if p.strip()
    )


def build_satisfaction_eval_instruction(satisfaction_manual: str) -> str:
    rubric = ""
    if SATISFACTION_RUBRIC_FILE.is_file():
        rubric = SATISFACTION_RUBRIC_FILE.read_text(encoding="utf-8")
    return "\n\n".join(
        p for p in (load_eval_repo_context(), rubric, satisfaction_manual) if p.strip()
    )


def load_desktop_writer_guide() -> str:
    path = manual_dir() / DESKTOP_WRITER_GUIDE
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return ""


def build_eval_prompt(
    source_context: str,
    axis: str,
    manual_text: str,
    *,
    trance_score: float | None = None,
    pleasure_score: float | None = None,
) -> str:
    label = EVAL_AXIS_LABELS.get(axis, axis)
    anchor_note = (
        "\n比較アンカー（必ず参照）: "
        "下限 saimin-shinri-test-dame-iwakareru（★3・トランス3.0） / "
        "上限 unknown-hypno-daijobu-koe-ni-yudanete（★10・三軸10）。"
        "約30分で本編大半が報酬・RPの作品は深さを甘く見ない（運用ガイド §2）。"
    )
    trance_note = ""
    if axis == "trance":
        trance_note = (
            "\n【必須】eval_trance_rubric.md … ①トランスレーン5種を1つ決定 "
            "②4次元（入り・深さ・暗示の効き・維持）③レーン別重み合成 "
            "④レーン内アンカー比較。出力フォーマット厳守。"
            "\n【再発防止】導入後すぐ性的命令・耳責めが本編大半なら acceptance ではなく "
            "**minimal**（または sensory）。エロ命令が刺さる＝暗示の効き高い、とトランスに載せない。"
            "深さ根拠に「報酬・RP主・深化限定的／読み取れない」と書くなら該当次元は **0〜1**、"
            "入り断片のみ **1〜2**、合成 **2.0 超禁止**（8.0 台は構造上あり得ない）。"
        )
    pleasure_note = ""
    if axis == "pleasure":
        pleasure_note = (
            "\n【必須】eval_pleasure_rubric.md … ①快楽C-0を1つ "
            "②4次元 ③C-0別重み合成。最終快楽度: x.x / 10.0 を必ず出力。"
        )
    satisfaction_note = ""
    if axis == "satisfaction":
        satisfaction_note = (
            "\n【必須】eval_satisfaction_rubric.md … 4次元（約束の着地・解除・戻し・"
            "余韻・情緒・尺対密度）→ 固定重み合成。"
            "最終満足度: x.x / 10.0 を必ず出力。"
        )
    prior = ""
    if axis == "pleasure" and trance_score is not None:
        prior = (
            f"\n【前提・トランスありき】既決トランス度 {trance_score:.1f}。"
            "催眠として届く深さを超える快楽度は付けない。"
        )
    if axis == "satisfaction" and trance_score is not None and pleasure_score is not None:
        prior = (
            f"\n【前提・トランスありき】トランス {trance_score:.1f} / 快楽 {pleasure_score:.1f}。"
            "着地・余韻・尺対密度。快楽だけ高いのに満足だけ極端に低い／高い偏りは理由を明示。"
        )
    return (
        f"{source_context}\n\n"
        "--------------------------------------------------\n"
        f"今回採点する軸: **{label}**\n"
        "上記の WhisperX / Librosa と、system 指示（リポジトリ採点正本＋デスクトップ採点マニュアル）"
        "のみに基づき採点してください。"
        "マニュアル指定の出力フォーマットに従い、最終スコアを明示してください。"
        f"{anchor_note}{trance_note}{pleasure_note}{satisfaction_note}{prior}"
        + (
            " 快楽軸: ドライオーガズムと脳イキは別物。C-0がドライ型なら【ドライ型】目安で判定し、同一視しない。"
            if axis == "pleasure"
            else ""
        )
    )


def load_scenario_eval_repo_context(*, all_ages: bool = False) -> str:
    parts: list[str] = []
    scoring = ALL_AGES_SCORING_DEF if all_ages else SCENARIO_SCORING_DEF
    writing = ALL_AGES_SCENARIO_WRITING_GUIDE if all_ages else SCENARIO_VOICE_WRITING_GUIDE
    for path in (
        SCENARIO_EVAL_SYSTEM_FILE,
        scoring,
        writing,
        SCORING_OPS_FILE,
    ):
        if path.is_file():
            parts.append(path.read_text(encoding="utf-8"))
    return "\n\n".join(parts)


def build_scenario_eval_instruction(*, all_ages: bool = False) -> str:
    rubric = ""
    if SCENARIO_RUBRIC_FILE.is_file():
        rubric = SCENARIO_RUBRIC_FILE.read_text(encoding="utf-8")
    return "\n\n".join(
        p for p in (load_scenario_eval_repo_context(all_ages=all_ages), rubric) if p.strip()
    )


def build_scenario_eval_prompt(
    source_context: str,
    axis: str,
    *,
    prior: dict[str, float | None],
    lane: str = "",
    all_ages: bool = False,
) -> str:
    label = EVAL_AXIS_LABELS.get(axis, axis)
    if all_ages and axis == "pleasure":
        label = "睡眠・覚醒"
    prior_lines: list[str] = []
    if lane:
        prior_lines.append(
            f"【シチュレーン】{lane}（{SCENARIO_LANES[lane]['label']}）— シナリオ軸で確定済み。"
        )
    if axis == "acoustic" and prior.get("scenario") is not None:
        prior_lines.append(f"【前提】シナリオ {prior['scenario']:.1f}")
    if axis == "immersion" and prior.get("acoustic") is not None:
        prior_lines.append(
            f"【前提】シナリオ {prior.get('scenario') or '—'} / 音響 {prior['acoustic']:.1f}"
        )
    if axis == "pleasure" and prior.get("scenario") is not None:
        prior_lines.append(
            f"【前提】シナリオ {prior['scenario']:.1f} / "
            f"没入 {prior.get('immersion') or '—'}"
        )
    if axis == "satisfaction":
        bits = [
            f"{EVAL_AXIS_LABELS[k]} {prior[k]:.1f}"
            for k in ("scenario", "pleasure", "acoustic")
            if prior.get(k) is not None
        ]
        if bits:
            prior_lines.append(f"【前提】{' / '.join(bits)}")
    rubric_notes = {
        "scenario": (
            "【必須】eval_scenario_rubric.md … ①シチュレーン5種を1つ "
            "②4要因（心理・一貫性・ギミック・フック）に点数 "
            "③レーン別重み合成 ④弱い要因引きずり "
            "⑤最終シナリオ度: x.x / 10.0"
        ),
        "acoustic": (
            "【必須】要因2つ（台詞・情景音）に点数 → 重み合成 → 弱い要因引きずり → "
            "最終音響度: x.x / 10.0"
        ),
        "immersion": (
            "【必須】要因2つ（定位・親密距離）に点数 → レーン別重み → 引きずり → "
            "最終没入度: x.x / 10.0"
        ),
        "pleasure": (
            "【必須】要因2つ（"
            + ("入眠・覚醒" if all_ages else "声色・峰と間")
            + "）に点数 → 重み合成 → 引きずり → 最終"
            + ("睡眠・覚醒度" if all_ages else "快楽度")
            + ": x.x / 10.0"
        ),
        "satisfaction": (
            "【必須】要因2つ（回収・終端）に点数 → 重み合成 → 引きずり → "
            "最終満足度: x.x / 10.0"
        ),
    }.get(axis, "")
    return (
        f"{source_context}\n\n"
        f"今回採点: **{label}**\n"
        "正本: eval_scenario_rubric.md ＋ シチュボイス五軸評価定義。Whisper のみ根拠。\n"
        f"{rubric_notes}\n"
        "比較: dakimakura（★9） / michikusa（★10） / shinitagari-junai-maid-yogarekake。\n"
        + "\n".join(prior_lines)
    )


def eval_axis_label(axis: str, *, all_ages: bool = False) -> str:
    if all_ages and axis == "pleasure":
        return "睡眠・覚醒"
    for key, label in SCENARIO_EVAL_AXIS_ORDER:
        if key == axis:
            return label
    return EVAL_AXIS_LABELS.get(axis, axis)


def run_scenario_five_axis_eval(
    client: genai.Client,
    source_context: str,
    slug: str,
    *,
    all_ages: bool = False,
) -> tuple[dict[str, str], dict[str, float | None]]:
    eval_dir = SCRIPT_DIR / "eval_results"
    eval_dir.mkdir(exist_ok=True)
    results: dict[str, str] = {}
    scores: dict[str, float | None] = {}
    sys_instruction = build_scenario_eval_instruction(all_ages=all_ages)
    lane = ""
    for axis, _ in SCENARIO_EVAL_AXIS_ORDER:
        label = eval_axis_label(axis, all_ages=all_ages)
        print(f"[eval] {label} 採点...")
        res = gemini_generate(
            client,
            model=EVAL_MODEL,
            contents=build_scenario_eval_prompt(
                source_context,
                axis,
                prior=scores,
                lane=lane,
                all_ages=all_ages,
            ),
            system_instruction=sys_instruction,
            temperature=0.0,
            label=f"{label}採点",
        )
        results[axis] = res
        if axis == "scenario" and not lane:
            lane = extract_scenario_lane(res)
        scores[axis] = extract_scenario_axis_score(
            axis,
            res,
            lane=lane or None,
            all_ages=all_ages,
        )
        (eval_dir / f"{slug}_{axis}.md").write_text(res, encoding="utf-8")
    print(
        "[eval] 五軸完了: "
        + " ".join(
            f"{eval_axis_label(a, all_ages=all_ages)}={scores[a]}"
            for a, _ in SCENARIO_EVAL_AXIS_ORDER
        )
        + (f" lane={lane}" if lane else "")
    )
    return results, scores


def patch_analysis_scores_scenario(
    path: Path,
    results: dict[str, str],
    *,
    note: str = "",
    all_ages: bool = False,
) -> None:
    lane = extract_scenario_lane(results.get("scenario", ""))
    scores_out: dict[str, float] = {}
    for axis, _ in SCENARIO_EVAL_AXIS_ORDER:
        val = extract_scenario_axis_score(
            axis,
            results.get(axis, ""),
            lane=lane,
            all_ages=all_ages,
        )
        if val is not None:
            scores_out[axis] = round(val, 1)
    if path.is_file():
        data = json.loads(path.read_text(encoding="utf-8"))
    else:
        data = {"schemaVersion": 2, "notes": []}
    data["schemaVersion"] = 2
    prev = data.get("scores") or {}
    data["scores"] = {
        "immersion": scores_out.get("immersion", prev.get("immersion", 0)),
        "scenario": scores_out.get("scenario", prev.get("scenario", 0)),
        "pleasure": scores_out.get("pleasure", prev.get("pleasure", 0)),
        "acoustic": scores_out.get("acoustic", prev.get("acoustic", 0)),
        "satisfaction": scores_out.get("satisfaction", prev.get("satisfaction", 0)),
    }
    data["scenarioLane"] = lane
    data["scenarioLaneLabel"] = SCENARIO_LANES[lane]["label"]
    for axis, _ in SCENARIO_EVAL_AXIS_ORDER:
        key = f"{axis}Scoring"
        if results.get(axis):
            data[key] = build_scenario_scoring_metadata(
                axis,
                results[axis],
                lane=lane,
                all_ages=all_ages,
            )
    notes = list(data.get("notes") or [])
    stamp = (
        f"五軸再採点（{today_jst_ymd()}）— eval_scenario_rubric.md 経由 Gemini"
    )
    if stamp not in notes:
        notes.insert(0, stamp)
    factor_stamp = (
        "scenario-v2-four-factor-lane-weighted（心理・一貫性・ギミック・フック）"
        "— eval_scenario_rubric.md"
    )
    if factor_stamp not in notes:
        notes.insert(1, factor_stamp)
    if note and note not in notes:
        notes.insert(2, note)
    if all_ages:
        data["radarAxisLabels"] = {"pleasure": "睡眠・覚醒"}
    data["notes"] = notes
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_three_axis_eval(
    client: genai.Client,
    source_context: str,
    slug: str,
) -> tuple[str, str, str, float | None, float | None, float | None]:
    """Gemini 三軸採点（リポジトリ正本＋デスクトップマニュアル）。eval_results に保存。"""
    trance_manual = load_axis_manual("trance")
    pleasure_manual = load_axis_manual("pleasure")
    satisfaction_manual = load_axis_manual("satisfaction")

    print("[eval] トランス度採点（レーン別4次元）...")
    res_t = gemini_generate(
        client,
        model=EVAL_MODEL,
        contents=build_eval_prompt(source_context, "trance", trance_manual),
        system_instruction=build_trance_eval_instruction(trance_manual),
        temperature=0.0,
        label="トランス度採点",
    )
    trance_score = extract_trance_score(res_t)
    _, _, guard_notes = guarded_trance_result(res_t)
    if guard_notes:
        print(f"[eval] trance_scoring_guards: {'; '.join(guard_notes)}")

    pleasure_sys = pleasure_manual
    if trance_score is not None:
        pleasure_sys = pleasure_sys.replace("[TRANS_SCORE]", f"{trance_score:.1f}")

    print("[eval] 快楽度採点（C-0別4次元）...")
    res_p = gemini_generate(
        client,
        model=EVAL_MODEL,
        contents=build_eval_prompt(
            source_context, "pleasure", pleasure_manual, trance_score=trance_score
        ),
        system_instruction=build_pleasure_eval_instruction(pleasure_sys),
        temperature=0.0,
        label="快楽度採点",
    )
    pleasure_score = extract_pleasure_score(res_p)
    pleasure_capped = cap_pleasure_for_trance(pleasure_score, trance_score)
    if (
        pleasure_score is not None
        and pleasure_capped is not None
        and pleasure_capped != pleasure_score
    ):
        print(f"[eval] 快楽度をトランスありきで上限: {pleasure_score}→{pleasure_capped}")
        pleasure_score = pleasure_capped

    print("[eval] 満足度採点（4次元）...")
    res_s = gemini_generate(
        client,
        model=EVAL_MODEL,
        contents=build_eval_prompt(
            source_context,
            "satisfaction",
            satisfaction_manual,
            trance_score=trance_score,
            pleasure_score=pleasure_score,
        ),
        system_instruction=build_satisfaction_eval_instruction(satisfaction_manual),
        temperature=0.0,
        label="満足度採点",
    )
    satisfaction_score = extract_satisfaction_score(res_s)

    eval_dir = SCRIPT_DIR / "eval_results"
    eval_dir.mkdir(exist_ok=True)
    (eval_dir / f"{slug}_trance.md").write_text(res_t, encoding="utf-8")
    (eval_dir / f"{slug}_pleasure.md").write_text(res_p, encoding="utf-8")
    (eval_dir / f"{slug}_satisfaction.md").write_text(res_s, encoding="utf-8")
    print(
        f"[eval] 完了: トランス={trance_score} 快楽={pleasure_score} 満足={satisfaction_score}"
    )
    return res_t, res_p, res_s, trance_score, pleasure_score, satisfaction_score


def patch_analysis_scores_from_eval(
    path: Path,
    res_t: str,
    res_p: str,
    res_s: str,
    *,
    note: str = "",
) -> None:
    """eval_results から scores のみ更新（本文・表は触らない）。"""
    trance = extract_trance_score(res_t)
    pleasure = extract_pleasure_score(res_p)
    pleasure = cap_pleasure_for_trance(pleasure, trance)
    satisfaction = extract_satisfaction_score(res_s)
    if trance is None or pleasure is None or satisfaction is None:
        print("[警告] eval からスコアを抽出できませんでした。_分析データ.json は未更新。")
        return
    _, trance_meta, guard_notes = guarded_trance_result(res_t)
    if path.is_file():
        data = json.loads(path.read_text(encoding="utf-8"))
    else:
        data = {"schemaVersion": 1, "notes": []}
    data["scores"] = {
        "trance": round(trance, 1),
        "pleasure": round(pleasure, 1),
        "satisfaction": round(satisfaction, 1),
    }
    data["tranceScoring"] = trance_meta
    data["pleasureScoring"] = build_axis_scoring_metadata(res_p, "pleasure")
    data["satisfactionScoring"] = build_axis_scoring_metadata(res_s, "satisfaction")
    notes = list(data.get("notes") or [])
    stamp = f"三軸再採点（{today_jst_ymd()}）— リポジトリ採点正本＋デスクトップマニュアル経由 Gemini"
    if stamp not in notes:
        notes.insert(0, stamp)
    if guard_notes:
        guard_stamp = "トランス guard: " + "; ".join(guard_notes)
        if guard_stamp not in notes:
            notes.insert(1, guard_stamp)
    if note and note not in notes:
        notes.insert(1, note)
    data["notes"] = notes
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
        f"・SUMMARY=§0.3リード短文型（1段落・2文以内・100〜130字・時間尺禁止・見本 hypno-multi-rape。批評禁止）、ITEM_DESCRIPTION=時刻根拠の肉付け、INDUCTION_FLOW=§4。\n"
        f"・デスクトップ `催眠音声執筆ガイド.txt` は system 短縮版。\n"
        f"サイト掲載用は出力キー（[KEY]）／JSON のみ。\n"
        f"・SCORE_* / RATING_VALUE / 表の行名は keys 定義どおり。捏造の CV・販売日・トラック名禁止。\n"
        f"・DRY_SCENE_COUNT / WET_SCENE_COUNT は Whisper の到達回収のみ数える（§0.1.2）。1回と決め打ち禁止。\n"
        f"・読者向け散文の禁止語: `芯` `手順` `設計`（台詞引用 `> ` 行のみ可）。代用: 流れ・構成・進め方・段階・順番。\n"
        f"・## 見出しや「クイック解析」セクション形式での出力は禁止（[KEY] のみ）。\n\n"
        f"【出力形式 — 厳守】\n{keys_section}\n"
    )


def build_writer_prompt_scenario(
    eval_block: str,
    keys_doc: str,
    product_facts: str,
    only_keys: list[str] | None = None,
    *,
    all_ages: bool = False,
) -> str:
    keys_section = keys_doc
    if only_keys:
        keys_section = (
            f"今回出力するキーは次のみ: {', '.join(only_keys)}\n"
            f"該当する [KEY] ブロックだけを出力すること。他キー・挨拶・説明は禁止。\n\n"
            f"{keys_doc}"
        )
    orgasm_rule = (
        "・全年齢: ORGASM_SCENE_COUNT は出力禁止。総合評価に絶頂行なし。"
        "グラフ第4軸は睡眠・覚醒。\n"
        if all_ages
        else "・ORGASM_SCENE_COUNT は聴取の到達回収のみ（§0.2）。括弧注釈禁止。ドライ／ウェット表記禁止。\n"
    )
    return (
        f"【作品メタ（創作禁止・この事実を優先）】\n{product_facts}\n\n"
        f"【評価脳の解析結果 — 必ず反映】\n\n{eval_block}\n\n"
        f"--------------------------------------------------\n"
        f"【執筆指示 — 厳守】\n"
        f"・既存の当サイトレビュー・過去原稿の文章を参照・模倣・流用してはならない。\n"
        f"・事実は今回渡した Whisper / 作品メタ / 確定スコア のみ。台詞引用は実在する文だけ。\n"
        f"・執筆正本は `docs/シチュエーションボイス執筆ガイド.md` §0 と `writer_output_keys_scenario.md`。\n"
        f"・SUMMARY=1〜2段落・ITEM_DESCRIPTION=肉付け、おすすめ第1軸=心情（誘導主目的禁止）。\n"
        f"{orgasm_rule}"
        f"・四表・INDUCTION_FLOW・体験感度Lv・催眠三軸キーは出力禁止。\n"
        f"・読者向け散文の禁止語: `芯` `手順` `設計`（台詞引用 `> ` 行のみ可）。\n"
        f"・## 見出しや「クイック解析」セクション形式での出力は禁止（[KEY] のみ）。\n\n"
        f"【出力形式 — 厳守】\n{keys_section}\n"
    )


def load_scenario_eval_context(
    slug: str, analysis_path: Path, *, all_ages: bool = False
) -> str:
    eval_dir = SCRIPT_DIR / "eval_results"
    axes: list[tuple[str, str]] = [
        ("scenario", "シナリオ"),
        ("acoustic", "音響"),
        ("immersion", "没入度"),
        ("pleasure", "睡眠・覚醒" if all_ages else "快楽度"),
        ("satisfaction", "満足度"),
    ]
    parts: list[str] = []
    for suffix, label in axes:
        p = eval_dir / f"{slug}_{suffix}.md"
        if p.is_file():
            parts.append(f"■ {label}:\n{p.read_text(encoding='utf-8')}\n")
    if parts:
        return "\n".join(parts)
    if analysis_path.is_file():
        try:
            data = json.loads(analysis_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
        scores = data.get("scores") or {}
        notes_raw = data.get("notes") or []
        if isinstance(notes_raw, list):
            notes = "\n".join(str(n) for n in notes_raw)
        else:
            notes = str(notes_raw).strip()
        block = (
            "■ 確定スコア（_分析データ.json・採点完了後に執筆）:\n"
            + json.dumps(scores, ensure_ascii=False, indent=2)
        )
        if notes:
            block += f"\n\n■ notes:\n{notes}"
        return block
    return "（採点未確定 — eval_results または _分析データ.json scores を先に用意）"


def build_writer_instruction_parts(
    args: argparse.Namespace,
    *,
    table_hint: str = "",
) -> list[str]:
    guide_label = (
        "全年齢シチュエーションボイス執筆ガイド"
        if all_ages_scenario_mode(args)
        else (
            "シチュエーションボイス執筆ガイド"
            if scenario_voice_mode(args)
            else "催眠音声執筆ガイド"
        )
    )
    writing_guide = load_file(writing_guide_path(args), guide_label)
    if scenario_voice_mode(args):
        sample = (
            f"見本記事: {SCENARIO_SAMPLE_SLUG}（完成系・グラフ5軸要約文の型のみ。"
            "文言コピー禁止）。"
        )
        if all_ages_scenario_mode(args):
            sample += (
                " 全年齢トーン参考: shinitagari-junai-maid-yogarekake"
                "（記事グリッドは dakimakura と同一）。"
            )
        extras = [
            "【シチュボイス厳守】催眠の四表・主要誘導の流れ・体験感度Lv・ドライ/ウェット/脳イキ主語は禁止。",
            "【GRAPH_BREAKDOWN】各軸は `- **シナリオ n**` のあと2〜3文のみ。"
            "評価要因（心理・空間の生々しさ等）を太字見出しにしない。括弧サブ点禁止。要因は要約して織り込む。"
            + (
                " 全年齢: 総合評価に絶頂行なし。第4軸表示名は睡眠・覚醒。"
                if all_ages_scenario_mode(args)
                else " 総合評価の絶頂行は 絶頂シーン n回 のみ。"
            )
            + " **`## パート解析`／`[PART_ANALYSIS]` は出力禁止**（2026-06 廃止）。",
            "出力は writer_output_keys_scenario の [KEY] のみ。",
        ]
    else:
        sample = (
            "見本記事: kuchikou-saimin-count-trip-nouiki（完成系・SUMMARY・おすすめ理由・"
            "主要誘導・身体の変化の型のみ。文言コピー禁止）。"
        )
        extras = [
            "【追加厳守】出力は writer_output_keys の [KEY] ブロックまたは単一 JSON のみ。",
            "【用語】ドライオーガズムと脳イキは別物。同一視・括弧併記禁止（§0.1.1）。",
        ]
    parts = [
        load_file(WRITER_SYSTEM_FILE, "執筆ガイド（ライター脳）"),
        load_forbidden_rules(),
        load_guide_excerpts_for_writer(),
        load_desktop_writer_guide(),
        f"【執筆正本（§0 ライター脳含む）】\n{writing_guide}",
        table_hint or sample,
        *extras,
        "既存の当該 slug の index.md・旧 review_output は参照しない。",
        "Markdown の ## 見出し・クイック解析セクション形式は禁止。",
    ]
    return parts


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
    banned = ("Librosa", "同相バインド", "ステージ4", "CFバイパス", "芯", "手順", "設計")
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
    p.add_argument("--item-name", default="", help="商品名")
    p.add_argument("--circle", default="（記入）", help="サークル名")
    p.add_argument("--cv", default="", help="CV（単一・sanitize で TAGS/CV_FEMALE へ反映）")
    p.add_argument("--rj", default="", help="DLsite RJ 番号")
    p.add_argument(
        "--no-sanitize",
        action="store_true",
        help="merge 前の review_output 正規化（禁止語・メタ・GRAPH_BREAKDOWN）をスキップ",
    )
    p.add_argument(
        "--no-ship",
        action="store_true",
        help="merge 後の review:ship（triangle・restore・感想・監査）をスキップ",
    )
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
        "--no-preserve-sections",
        action="store_true",
        help="マージ時に既存 index の グラフ内訳／パート別解析 を保持しない（全面再生成の既定）",
    )
    p.add_argument(
        "--preserve-sections",
        action="store_true",
        help="--force 時でも旧 index から graph_breakdown / part_analysis を保持（部分改稿・明示時のみ）",
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
    p.add_argument(
        "--eval-only",
        action="store_true",
        help="三軸採点のみ（eval_results + _分析データ.json scores）。index.md は更新しない",
    )
    p.add_argument(
        "--scenario-voice",
        action="store_true",
        help="シチュエーションボイス（五軸・writer_output_keys_scenario.md）。B型マージは行わない",
    )
    p.add_argument(
        "--all-ages",
        action="store_true",
        help="全年齢シチュ（--scenario-voice と併用。睡眠・覚醒軸・絶頂行なし）",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    if args.force and not args.preserve_sections:
        args.no_preserve_sections = True
    elif args.force and args.preserve_sections:
        print(
            "[警告] --preserve-sections: 旧 index からグラフ内訳・パート別解析を差し戻します。"
            " 全面作り直しでは使わないでください。"
        )

    if scenario_voice_mode(args) and args.eval_only:
        pass  # eval_only 分岐で五軸採点

    if not args.eval_only and not args.item_name.strip():
        print("[エラー] --item-name が必要です（--eval-only 時は省略可）")
        sys.exit(1)

    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.slug):
        print(f"[エラー] slug が不正です: {args.slug}")
        sys.exit(1)

    out_dir = REVIEWS_DIR / args.slug
    index_path = Path(args.output) if args.output else out_dir / "index.md"
    analysis_path = out_dir / "_分析データ.json"
    draft_path = Path(args.draft_file) if args.draft_file else SCRIPT_DIR / "review_output.md"

    if index_path.exists() and not args.force and not args.optimize_tables and not args.eval_only:
        print(f"[エラー] 既に存在します: {index_path}\n  --force で上書き")
        sys.exit(1)
    if args.optimize_tables and not index_path.is_file():
        print(f"[エラー] --optimize-tables には既存 index.md が必要です: {index_path}")
        sys.exit(1)

    print("--------------------------------------------------")
    if scenario_voice_mode(args):
        print(" シチュエーションボイス -> review_output.md ([KEY]) ")
    else:
        print(" 催眠音声レビュー -> B型 index.md 自動生成 ")
    print("--------------------------------------------------")

    only_keys = [k.strip() for k in args.keys.split(",") if k.strip()]
    if args.optimize_tables:
        only_keys = list(ANALYSIS_TABLE_KEYS)
        args.skip_eval = True
    allowed_keys = active_gemini_keys(args)
    for k in only_keys:
        if k not in allowed_keys:
            print(f"[エラー] 未知のキー: {k}")
            sys.exit(1)

    print("[1/6] 正本・原紙テンプレートを読み込み...")
    if scenario_voice_mode(args):
        print("       採点: 人手五軸（_分析データ.json）または eval_results/<slug>_*.md")
        print("       本文: docs/シチュエーションボイス執筆ガイド.md + writer_output_keys_scenario.md")
        merge_template = ""
    else:
        print(f"       採点: リポジトリ採点正本 + デスクトップ採点マニュアル（{manual_dir()}）")
        print("       本文: B型原紙 + docs/催眠音声執筆ガイド.md + 執筆ガイド.txt")
        merge_template = load_file(MERGE_TEMPLATE_FILE, "B型マージ原紙")

    res_t = res_p = res_s = ""
    generated = ""

    if args.eval_only:
        require_api_key()
        if args.analysis_dir:
            import subprocess

            ad = Path(args.analysis_dir)
            subprocess.run(
                [sys.executable, str(SCRIPT_DIR / "prepare_analysis_inputs.py"), str(ad)],
                check=True,
            )
        print("[2/6] Whisper / Librosa を読み込み...")
        whisper_data = load_file(WHISPER_FILE, "WhisperX")
        librosa_data = load_file(LIBROSA_FILE, "Librosa")
        source_context = f"【WhisperX】\n{whisper_data}\n\n【Librosa】\n{librosa_data}"
        client = genai.Client(api_key=get_api_key())
        if scenario_voice_mode(args):
            print("[3/6] 五軸採点（--eval-only・シチュガイド）...")
            results, _ = run_scenario_five_axis_eval(
                client,
                source_context,
                args.slug,
                all_ages=all_ages_scenario_mode(args),
            )
            patch_analysis_scores_scenario(
                analysis_path,
                results,
                note="比較: dakimakura（★9） / michikusa（★10）",
                all_ages=all_ages_scenario_mode(args),
            )
            print(f"[完了] eval_results + {analysis_path} scores のみ更新。")
            print("       次: ratingValue・絶頂行確定 → --writer-only または --force")
            return
        print(f"       採点正本: eval_system_repo + 三軸定義 + 運用ガイド + {manual_dir()}")
        print("[3/6] 三軸採点（--eval-only）...")
        res_t, res_p, res_s, _, _, _ = run_three_axis_eval(client, source_context, args.slug)
        anchor_note = (
            "三軸: eval_trance/pleasure/satisfaction_rubric（レーン・C-0別4次元合成）。"
        )
        patch_analysis_scores_from_eval(
            analysis_path, res_t, res_p, res_s, note=anchor_note
        )
        print(f"[完了] eval_results + {analysis_path} scores のみ更新。index.md は未変更。")
        print("       次: 人手でトランスありき整合 → index グラフ内訳・★ を同期")
        return

    if args.merge_only:
        if scenario_voice_mode(args):
            print("[エラー] --scenario-voice では B型 --merge-only を使いません（review_output を Cursor が index に組み立て）")
            sys.exit(1)
        print("[2-4/6] スキップ（--merge-only）")
        generated = load_file(draft_path, "Gemini 生出力")
    elif only_keys:
        require_api_key()
        keys_doc = load_file(writer_keys_path(args), "出力キー定義")
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
        if scenario_voice_mode(args):
            eval_block = load_scenario_eval_context(
                args.slug, analysis_path, all_ages=all_ages_scenario_mode(args)
            )
            writer_prompt = build_writer_prompt_scenario(
                eval_block,
                keys_doc,
                product_facts,
                only_keys=only_keys,
                all_ages=all_ages_scenario_mode(args),
            )
        else:
            writer_prompt = build_writer_prompt(
                res_t, res_p, res_s, keys_doc, product_facts, only_keys=only_keys
            )
        extra_flow = ""
        if "INDUCTION_FLOW" in only_keys:
            extra_flow = (
                "【追加】INDUCTION_FLOW: 催眠音声執筆ガイド §4 厳守。"
                "見出しは工程名のみ禁止。各ブロックは #### →空行→引用→空行→**誘導方法:**→空行→**身体の変化:**（kuchikou 見本）。"
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
        writer_instruction_parts = build_writer_instruction_parts(
            args, table_hint=table_hint
        )
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
        keys_doc = load_file(writer_keys_path(args), "出力キー定義")
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
        if scenario_voice_mode(args):
            eval_block = load_scenario_eval_context(
                args.slug, analysis_path, all_ages=all_ages_scenario_mode(args)
            )
            writer_prompt = build_writer_prompt_scenario(
                eval_block,
                keys_doc,
                product_facts,
                only_keys=None,
                all_ages=all_ages_scenario_mode(args),
            )
        else:
            writer_prompt = build_writer_prompt(
                res_t, res_p, res_s, keys_doc, product_facts, only_keys=None
            )
        writer_prompt = f"{source_context}\n\n{writer_prompt}"
        writer_instruction_parts = build_writer_instruction_parts(args)
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
        keys_doc = load_file(writer_keys_path(args), "出力キー定義")

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

        if scenario_voice_mode(args):
            print("[3/6] 五軸採点（Gemini・シチュガイド）...")
            results, _ = run_scenario_five_axis_eval(
                client,
                source_context,
                args.slug,
                all_ages=all_ages_scenario_mode(args),
            )
            patch_analysis_scores_scenario(
                analysis_path,
                results,
                note="比較: dakimakura（★9） / michikusa（★10）",
                all_ages=all_ages_scenario_mode(args),
            )
            print("[4/6] 記事本文執筆（Gemini・シチュガイド）...")
            eval_block = load_scenario_eval_context(
                args.slug, analysis_path, all_ages=all_ages_scenario_mode(args)
            )
            writer_prompt = build_writer_prompt_scenario(
                eval_block,
                keys_doc,
                product_facts,
                only_keys=None,
                all_ages=all_ages_scenario_mode(args),
            )
            writer_prompt = f"{source_context}\n\n{writer_prompt}"
            writer_instruction_parts = build_writer_instruction_parts(args)
            generated = gemini_generate(
                client,
                model=WRITER_MODEL,
                contents=writer_prompt,
                system_instruction="\n\n".join(
                    p for p in writer_instruction_parts if p.strip()
                ),
                temperature=0.2,
                label="記事本文執筆",
            )
        else:
            print("[3/6] 三軸採点（Gemini・採点正本＋デスクトップマニュアル）...")
            res_t, res_p, res_s, _, _, _ = run_three_axis_eval(
                client, source_context, args.slug
            )
            print("[4/6] 記事本文執筆（Gemini・B型原紙 + 執筆ガイド）...")
            writer_prompt = build_writer_prompt(
                res_t, res_p, res_s, keys_doc, product_facts
            )
            writer_instruction_parts = build_writer_instruction_parts(args)
            generated = gemini_generate(
                client,
                model=WRITER_MODEL,
                contents=writer_prompt,
                system_instruction="\n\n".join(
                    p for p in writer_instruction_parts if p.strip()
                ),
                temperature=0.2,
                label="記事本文執筆",
            )

        draft_path.write_text(generated, encoding="utf-8")

    if not args.no_sanitize and not scenario_voice_mode(args):
        from sanitize_review_output import sanitize_draft

        generated, sanitize_log = sanitize_draft(
            generated,
            args,
            slug=args.slug,
            write_back=True,
            draft_path=draft_path,
        )
        for msg in sanitize_log:
            print(f"  [sanitize] {msg}")

    keys = parse_gemini_keys(generated)

    prose_violations = validate_prose_keys(keys)

    if scenario_voice_mode(args) and not args.optimize_tables:
        print("[5/6] シチュボイス - B型 index マージをスキップ（Cursor が review_output を index に組み立て）")
        if prose_violations:
            print("\n[エラー] 執筆ルール違反（review_output.md を修正して再実行）:")
            for w in prose_violations:
                print(f"  - {w}")
            print(
                "  正本: docs/シチュエーションボイス執筆ガイド.md / "
                "scripts/gemini-hypnosis-review/writer_forbidden.md"
            )
            print(f"  検証: npm run review:validate-prose -- --slug {args.slug}")
            sys.exit(1)
        print("\n【完了】Gemini 生出力のみ")
        print(f"  review_output  → {draft_path}")
        print("\n残作業（必須）:")
        print("  Cursor: [KEY] を dakimakura 型 index.md に組み立て")
        print(f"  py -3 scripts/generate_review_triangle.py {args.slug}")
        print(
            f"  py -3 scripts/gemini-hypnosis-review/generate_work_impression.py "
            f"{args.slug} --write-tsx"
        )
        print(f"  npm run review:validate-prose -- --slug {args.slug}")
        print(f"  npm run review:audit-scenario -- {args.slug}")
        print(f"  npm run review:audit-kansei -- --slug {args.slug}")
        return

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

        if index_path.is_file() and not args.no_preserve_sections:
            preserved = extract_preserved_sections(
                index_path.read_text(encoding="utf-8")
            )
            if preserved:
                index_md = inject_preserved_sections(index_md, preserved)
                print(
                    "[preserve] 既存 index から保持: "
                    + ", ".join(sorted(preserved.keys()))
                )

        print("[6/6] 保存...")
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text(index_md, encoding="utf-8")
        update_analysis_json(analysis_path, args.item_name, keys, res_t, res_p, res_s)

    if not args.optimize_tables:
        optional_empty = {k for k in OPTIONAL_BASIC_INFO if not keys.get(k, "").strip()}
        missing = [
            k
            for k in active_gemini_keys(args)
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

    prose_violations.extend(validate_index_md(index_md))
    if count_part_analysis_headings(index_md) > 1:
        prose_violations.append(
            "index.md: ## パート別解析 が2回以上（merge 重複。§1 再発防止）"
        )
    if prose_violations:
        print("\n[エラー] 執筆ルール違反（merge 前に review_output.md を修正）:")
        for w in prose_violations:
            print(f"  - {w}")
        print("  正本: docs/催眠音声執筆ガイド.md §7.1 / scripts/gemini-hypnosis-review/writer_forbidden.md")
        print(f"  検証: npm run review:validate-prose -- --slug {args.slug}")
        sys.exit(1)

    if not args.no_ship and not scenario_voice_mode(args):
        from review_ship import run_review_ship

        print("\n[8/8] review:ship（triangle・§4.5・感想・監査）...")
        if not run_review_ship(args.slug):
            print("\n[エラー] review:ship が失敗しました。修正後:")
            print(f"  npm run review:ship -- --slug {args.slug}")
            sys.exit(1)

    print("\n【完了】")
    print(f"  index.md      → {index_path}")
    print(f"  _分析データ.json → {analysis_path}")
    print(f"  Gemini生出力  → {draft_path}")
    if args.no_ship:
        print("\n残作業（--no-ship のため未実行）:")
        print(f"  npm run review:ship -- --slug {args.slug}")
    print("\n残作業（未自動化）:")
    print("  quickGuideBySlug（page.tsx）・scenario-facts.json（3パス）")
    print("  （dev 時は npm run dev で画像同期）")


if __name__ == "__main__":
    main()
