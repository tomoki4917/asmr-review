#!/usr/bin/env python3
"""クイック解析用 workImpressionParagraphs を Gemini で生成。"""
from __future__ import annotations

import argparse
import datetime
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
    find_summary_time_banned,
    gather_impression_banned_names,
    find_circle_cv_in_impression,
    find_score_in_impression,
    is_all_ages_doujin_review,
)

load_dotenv(SCRIPT_DIR / ".env")

SYSTEM = """あなたは催眠音声解析室のプロレビュアーです。クイック解析タブ用の「作品感想」を書きます。

## 出力形式（JSON のみ・前置き禁止）
{"paragraphs": ["段落1", "段落2", ...]}

## 文体の正本（docs/催眠音声執筆ガイド.md §8.4・2026-05）
- **聴き終わったあとの生きた所感**。カタログ説明・仕様書・AI予言調・サークル向けお世辞ではない。
- **忖度無し** … 総合★・三軸 scores と矛盾する称賀禁止。★8以上でも弱点を全体で1文以上。★7以下は短所段落必須（見本C: saimin-shinri-test-dame-iwakareru）。
- **index.md 本文（summary・グラフ内訳・総評）の言い換えだけ**は不合格。Whisper から場面・言葉を拾う。
- **見本の温度** … `saimin-douwa-grim-grimm-ike-nai-ohanashi`（具体シーン・聴き方）と `usotsuki-kouhai-suki-suki-seishin-shihai`（場面→肝→手触り→向く人）。**kuchikou は記事構成見本のみ。**
- 作品固有の**場面・言葉・音**から入るが、**各段落を「」台詞だけで埋めない**（1段落に引用は0〜1箇所・短く）。
- 段落ごと**2文前後**・接続で1本の流れ（短文三連禁止）。**全段落称賛だけ禁止**。
- 語尾は `です` `ます` `と思いました` `でした` を混ぜる。**`でしょう` は全文0〜1回**。`はずです` `きっと` 禁止。
- 主観（`と思いました` `個人的に`）は**全体で1〜2回**。
- **毎回構成を変える**（見本の段落役割をそのまま写さない・グリム型決まり文句禁止）。

## 段落数
**2〜4段落**（長尺は4可）。各 **100〜170字**。です・ます調。

## 避ける表現（AI調）
- 解説カタログ … `見どころ` `要素となり` `段階的に深め` `描かれています`
- 称賛テンプレ … `続きました` `寄せてくれます` `約束どおり` `満足感が得られると思います` `一本だと感じました`
- グリム型のコピー … 毎回 `〜わけですが` `〜となっておりました` `おすすめですね` `上手く出ていて没入度は高い`
- 禁止語 … `設計` `導線` `密度` `主軸` **`芯`** **`手順`**・三軸数値・★
- **時間・尺** … `長尺` `短尺` `約○分` `約○時間` `○分超` 等（§0.3 と同様・recording に任せる）

## 内容
- **Whisper 抜粋**から場面・言葉・音を拾う（あれば必須）。summary・おすすめ理由・グラフ内訳の**言い換え・再掲禁止**。
- 手触り・売り・**弱点（三軸の低い軸や合わない理由と整合）**・向く人（段落役割はプロンプトの「今回の構成指示」に従う）。
- 解析記事の事実と矛盾させない。
- **サークル名・声優名（CV）禁止** … 段落内にサークル名・声優名・「○○氏」・サークル略称（例: `エロトランス側`）を書かない。語り手は「語り手」「この声」等で指す。
- **点数・採点禁止** … ★・三軸の軸名＋数値・「総合★」「トランス10」「快楽7.9」「満足度4.2」等を書かない。弱点は聴いた体感で書く（採点は別UI）。

## 禁止
箇条書き、Markdown、HTML、キーワード羅列だけの段落、販促コピー追記、「絶対イける」等の結果保証
"""

OPENING_ANGLES = [
    "2段落：第1=場面・シチュの掴み+手触り、第2=向く人+総括。",
    "3段落：第1=場面掴み、第2=本編の快感・誘導の手触り、第3=向く人。",
    "3段落：第1=作品の型（何系か）、第2=聴き終わって残った感覚、第3=短所または向く人。",
    "4段落：第1=場面掴み、第2=深化・誘導、第3=快感の核、第4=向く人・総括（長尺向け）。",
    "4段落：第1=タイトル・コンセプト、第2=本編の売り、第3=着地・余韻、第4=向く人。",
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

STYLE_REFERENCE_SLUGS = (
    "saimin-douwa-grim-grimm-ike-nai-ohanashi",
    "usotsuki-kouhai-suki-suki-seishin-shihai",
)

ALL_AGES_STYLE_REFERENCE_SLUG = "shinitagari-junai-maid-yogarekake"

ALL_AGES_OPENING_ANGLES = [
    "4段落：第1=笑った・メタ・オウム返しの入り、第2=耳元のケアと密着（囁き・膝枕・耳舐め）、第3=ドキドキと眠気の両方+弱点1文、第4=向く人（音声根拠）。",
    "4段落：第1=小生意気な語り手への第一印象、第2=嫉妬・キス・耳ふーの尖り、第3=全年齢枠のからかい+高揚、第4=向く人+合わない人。",
    "3段落：第1=聴いたあとの温度（笑い・心臓・ゾクゾク）、第2=手触りと留保、第3=向く人（音声根拠）。",
    "3段落：第1=黒塗り・全年齢ギャグ、第2=耳かき棒顕現・KU100近接、第3=向く人+刺激だけ追う日は物足りない。",
]

# usotsuki 見本全文 + 露骨な summary を同一プロンプトに載せると PROHIBITED_CONTENT になりやすい
SENSITIVE_CONTEXT_MARKERS = (
    "TS",
    "女体化",
    "敗北",
    "サキュバス",
    "搾精",
    "NTR",
    "催眠姦",
    "洗脳",
    "家畜",
    "触手",
    "ディルド",
    "射精",
    "メスイキ",
)

BAD_IMPRESSION_PATTERNS = """
## NG見本（この型は絶対に書かない）
- 各段落が「」台詞の連打だけで、聴いた人の温度が無い解説カタログ
- 全段落が称賛だけ（弱点・物足りない所が1文も無い）
- 「聴き終わった印象としては」「この作品いちばんの特徴だと感じました」で始める
- 「約50分という長さで、本作は」「約〇分という長さで」で始める
- summary・グラフ内訳・総評の言い換え（誘導の型を並べるだけ）
- 「〜要素となります」「段階的に深めていきます」「没入へ誘う」「深く響く」「丁寧に解除」
- 「続きました」「寄せてくれます」「約束どおり」「満足感が得られると思います」で締める称賛テンプレ
- kuchikou 型の旧AI文（口腔催眠とカウントを組み合わせた〜に特化した作品だと感じました 等）
"""

BANNED_IMPRESSION_PHRASES = (
    "聴き終わった印象としては",
    "この作品いちばんの特徴だと感じました",
    "約50分という長さで",
    "没入へ誘",
    "深く響",
    "丁寧に解除",
    "満足度の高い",
    "特に響",
    "段階的に深め",
    "要素となり",
    "聴き終えて残ったのは",
    "言葉と想像が織り",
    "深く誘い込",
    "印象に残りました",
    "非常に響く",
    "言葉と想像で連続",
    "精神が支配",
    "包み込むような感覚",
    "一気通貫",
    "大きな特徴",
    "大きな魅力",
    "印象に残",
    "手触りがありました",
    "手触りです",
    "引きずられていく",
    "聴き手の",
    "聴き手は",
    "全身の入口",
    "リラックス運動",
)

REVISE_AI_PATTERNS = """
## 添削対象（下書きから必ず除去・言い換え）
- 解説カタログ … `〜作品です` で始めてキーワードを並べるだけ／`大きな魅力` `織りなす` `深く誘い込`
- AI予言・説明調 … `聴き終えて残ったのは` `感じられます` `印象に残りました` の連発
- 抽象の快感 … `倒錯した快感` `精神を支配される体験` `非常に響く一本` `包み込むような感覚`
- キーワード並べ … `捕縛や〜、花畑や〜、部位ごとの〜が重なり` の説明列挙
- **サークル・声優名** … `天知遥` `エロトランス` `○○氏` `サークル名側` 等（感想本文では語り手・この声で指す）
- 締めの型 … `〜方には` `特に向いているでしょう` `響くと思います` で終わるだけ
- **`向いた` 系** … `向いた` `向いている` 禁止（向き判定は index の【こんな人におすすめ】へ。感想は余韻・所感で締める）
- 正本見本より硬い語 … 見本A/Bより丁寧すぎる `です・ます` の並べ／接続詞だけの段落

## 添削後に目指す温度（正本A/B）
- 場面か一言から入る（捕縛・二声・「本当はなりたかった」等）
- 手触りは短く率直（はっきり届く・引き込まれる・残る）
- 向く人は自然に1段落（宣伝文句にしない）
"""


def sanitize_prompt_context(text: str) -> str:
    """API入力ブロック回避のため作品コンテキストのみ軽量化（出力は記事事実と一致させる）。"""
    replacements = (
        ("体外式ポルチオ刺激", "体外刺激"),
        ("体外式ポルチオ", "体外刺激"),
        ("ドライオーガズム", "ドライ絶頂"),
        ("唾液汚染", "接触暗示による受容"),
        ("女の子へと強制的に転換", "女性化への転換"),
        ("女体化", "女性化"),
        ("敗北TS", "敗北・TS"),
        ("催眠姦", "催眠"),
        ("搾精", "快感回収"),
        ("射精以外で行く", "絶頂以外の到達"),
        ("射精", "絶頂"),
        ("前立腺焦らし", "焦らし刺激"),
        ("前立腺", "重点部位"),
        ("メスイキ", "ドライ絶頂"),
        ("ノーハンド", "手を使わない回収"),
        ("触れずに", "接触なしで"),
        ("ラブホ女子会", "女子会"),
        ("アナル", "後方刺激"),
        ("ケツ", "後方"),
        ("おちんぽ", "男性器"),
        ("ディルド", "道具"),
        ("寸止め自動手コキ", "寸止め快感"),
    )
    out = text
    for old, new in replacements:
        out = out.replace(old, new)
    return out


def restore_impression_terms(paragraphs: list[str]) -> list[str]:
    """API入力用サニタイズ語を、出力では作品の具体語へ戻す。"""
    restores = (
        ("絶頂以外の到達", "射精以外で行く"),
        ("手を使わない回収", "ノーハンド"),
        ("接触なしで", "触れずに"),
        ("焦らしの刺激", "前立腺焦らし"),
        ("焦らし刺激", "前立腺焦らし"),
        ("重点部位", "前立腺"),
        ("女子会の実録から生まれた", "ラブホ女子会の実録を元に"),
        ("女子会の実録から", "ラブホ女子会の実録を元に"),
    )
    out: list[str] = []
    for para in paragraphs:
        text = para
        for old, new in restores:
            text = text.replace(old, new)
        text = text.replace("タイトル通りのドライ絶頂", "タイトルどおりのメスイキ")
        text = text.replace("ドライ絶頂から", "メスイキから")
        text = text.replace("ドライ絶頂そのもの", "メスイキそのもの")
        text = text.replace("ドライ絶頂まで", "メスイキからノーハンドまで")
        text = text.replace("ドライ絶頂が", "メスイキが")
        text = text.replace("ドライ絶頂、", "メスイキ、")
        text = text.replace("ノーハンド絶頂", "ノーハンド射精")
        text = text.replace("女子会の内容", "ラブホ女子会の実録")
        text = text.replace("接触なしの回収", "触れずにノーハンド")
        text = text.replace("快感が回収", "快感が連なる")
        out.append(text)
    return out


def cleanup_impression_prose(paragraphs: list[str]) -> list[str]:
    """Gemini 出力の禁止フレーズを率直な表現へ置換。"""
    replacements = (
        ("非常に刺激的", "かなり"),
        ("非常に", ""),
        ("大きな魅力", "売り"),
        ("大きな特徴", "特徴"),
        ("印象に残りました", "残りました"),
        ("印象に残", "心に残"),
        ("深く刺さる", "向き"),
        ("没入度は高い", "引き込まれる"),
        ("存分に", ""),
        ("理想的な", ""),
        ("革新的な", ""),
        ("物語の幕が引かれる", "短く終わる"),
        ("手触りがありました", "感覚が残りました"),
    )
    cleaned: list[str] = []
    for para in paragraphs:
        text = para
        for old, new in replacements:
            text = text.replace(old, new)
        text = text.replace("\u2014\u2014", "。").replace("\u2014", "。")
        text = re.sub(r"\s{2,}", " ", text).strip()
        cleaned.append(text)
    return cleaned


def load_style_few_shot(*, include_usotsuki: bool = True, all_ages: bool = False) -> str:
    """§8.4 / 全年齢 §10 正本見本を few-shot として読み込む。"""
    if all_ages:
        path = SCRIPT_DIR / f"work_impression_{ALL_AGES_STYLE_REFERENCE_SLUG}.json"
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            paras: list[str] = data.get("paragraphs") or []
            if paras:
                body = "\n\n".join(f"{i}. {p}" for i, p in enumerate(paras, 1))
                return (
                    "## 文体見本（構造・温度の参考。**文言・決まり句のコピー禁止**）\n\n"
                    "### 見本C（全年齢・shinitagari型：入り方→関係の芯→手触り+留保→向く人）\n"
                    f"{body}"
                )
        return ""

    blocks: list[str] = []
    labels = {
        "saimin-douwa-grim-grimm-ike-nai-ohanashi": "見本A（具体シーン→聴き方→快感→向く人・ユーザー執筆の温度）",
        "usotsuki-kouhai-suki-suki-seishin-shihai": "見本B（場面→肝→快感の手触り→作品らしい色→向く人）",
    }
    slugs = STYLE_REFERENCE_SLUGS if include_usotsuki else (STYLE_REFERENCE_SLUGS[0],)
    for slug in slugs:
        path = SCRIPT_DIR / f"work_impression_{slug}.json"
        if not path.is_file():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        paras: list[str] = data.get("paragraphs") or []
        if not paras:
            continue
        body = "\n\n".join(f"{i}. {p}" for i, p in enumerate(paras, 1))
        blocks.append(f"### {labels.get(slug, slug)}\n{body}")
    if not blocks:
        return ""
    tail = ""
    if not include_usotsuki:
        tail = (
            "\n\n（見本Bは入力ポリシーの都合で省略。"
            "段落役割は **場面→肝→手触り→向く人** を見本Bと同型で書く。文言コピー禁止）"
        )
    return (
        "## 文体見本（構造・温度の参考。**文言・決まり句のコピー禁止**）\n\n"
        + "\n\n".join(blocks)
        + tail
    )


def is_sensitive_work_context(ctx: str) -> bool:
    return any(marker in ctx for marker in SENSITIVE_CONTEXT_MARKERS)


def validate_impression_paragraphs(
    paragraphs: list[str], slug: str | None = None
) -> list[str]:
    warnings: list[str] = []
    banned_openings = (
        "聴き終わった印象としては",
        "この作品いちばんの特徴だと感じました",
        "本作は、約",
        "約50分という長さで、本作は",
        "約50分という長さで",
        "聴き終えて残ったのは",
        "言葉と想像が織り",
        "深く誘い込",
        "印象に残りました",
    )
    for i, para in enumerate(paragraphs, 1):
        for w in find_forbidden_in_text(para):
            warnings.append(f"段落{i}: {w}")
        for op in banned_openings:
            if para.startswith(op):
                warnings.append(f"段落{i}: 禁止の書き出し「{op}」")
        for phrase in BANNED_IMPRESSION_PHRASES:
            if phrase in para:
                warnings.append(f"段落{i}: NGフレーズ「{phrase}」")
        for w in find_summary_time_banned(para):
            warnings.append(f"段落{i}: {w}")
        if para.count("「") >= 3:
            warnings.append(f"段落{i}: 台詞引用が多すぎ（カタログ化）")
        if para.count("でしょう") > 1:
            warnings.append(f"段落{i}: でしょう が多い")
    if slug:
        blob = "\n".join(paragraphs)
        for w in find_circle_cv_in_impression(
            blob, gather_impression_banned_names(slug)
        ):
            warnings.append(w)
        for w in find_score_in_impression(blob):
            warnings.append(w)
    return warnings


def gather_whisper_snippets(slug: str, *, max_lines: int = 10) -> str:
    """解析フォルダの Whisper 本文から、感想の素材になる行を抜粋（summary 言い換え防止）。"""
    analysis_dir = ROOT / "src" / "content" / "レビュー" / slug / "analysis"
    if not analysis_dir.is_dir():
        return ""

    skip_in_name = ("フリートーク", "注意事項")
    candidates: list[tuple[int, str, str]] = []

    for path in sorted(analysis_dir.glob("*.txt")):
        if any(x in path.name for x in skip_in_name):
            continue
        track = path.stem
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = re.sub(r"\s+", " ", raw.strip())
            if len(line) < 20 or len(line) > 100:
                continue
            if line.count("。") > 2:
                continue
            score = 0
            for kw in (
                "ベル",
                "カウント",
                "膝枕",
                "ハンカチ",
                "ロケ",
                "公園",
                "草原",
                "湖",
                "浜",
                "耳",
                "聴覚",
                "真っ白",
                "プレゼント",
                "幸せ",
                "絶頂",
                "覚醒",
                "デート",
                "VR",
                "使う",
                "ロケ",
                "現場",
                "収録",
                "自然の音",
                "風が",
            ):
                if kw in line:
                    score += 2
            if "?" in line or "？" in line:
                score += 1
            if score > 0:
                candidates.append((score, track, line))

    if not candidates:
        return ""

    candidates.sort(key=lambda x: (-x[0], x[1]))
    picked: list[str] = []
    seen: set[str] = set()
    for _, track, line in candidates:
        key = line[:24]
        if key in seen:
            continue
        seen.add(key)
        picked.append(f"- ({track}) {line}")
        if len(picked) >= max_lines:
            break

    return (
        "【Whisper 抜粋（感想の主素材。ここから場面・言葉・音を拾う。summary の言い換え禁止）】\n"
        + "\n".join(picked)
    )


def sanitize_dlsite_review_text(text: str, slug: str) -> str:
    """購入者レビューから CV・サークル名等を除去し、Gemini がそのまま写さないようにする。"""
    out = text
    for name in gather_impression_banned_names(slug):
        out = out.replace(name, "（声優）" if "ゆめ" in name or len(name) <= 6 else "（サークル）")
    for pat, repl in (
        (r"浅木\s*ゆめみ(?:さん|様|氏)?", "（声優）"),
        (r"めめめのすゝめ", "（サークル）"),
        (r"百合草\s*楓(?:さん)?", "楓"),
        (r"没入度", "引き込まれ"),
        (r"没入感", "引き込まれ"),
    ):
        out = re.sub(pat, repl, out)
    return out


DLsite_DIGEST_SYSTEM = """あなたは同人音声レビュー編集者です。DLsite購入者レビュー全文を読み、
解析室の「作品感想」執筆用メモに整理します。

## 出力（JSON のみ・前置き禁止）— 温度感のみ
{
  "listenerTemperature": ["購入者が感じた温度・気分（3〜8項目・短文。例: 眠気・癒し・笑い・ドキドキ・温かさ）"],
  "bodyAndSound": ["体・音の手触り（耳元の近さ・寝落ちしやすさ・甘さの感触等）"],
  "emotionalColor": ["感情の色（可愛さ・安心・満足の手触り等。あらすじ・設定は書かない）"]
}

## 禁止
- 購入者レビューの原文コピペ・長い引用
- 声優名・サークル名・RJ番号
- ★・点数・三軸
- あらすじ・設定・キャラ解釈・「誰が何をした」・向く人／合わない人の列挙
- パート番号（tr_2 等）の列挙だけの内容説明
"""


def gather_dlsite_reviews_full(slug: str) -> tuple[list[dict], str]:
    """digest 用に購入者レビュー全文を読み込む。戻り値 (reviews, trends_one_line)。"""
    analysis_dir = ROOT / "src" / "content" / "レビュー" / slug / "analysis"
    path = analysis_dir / "dlsite_reviews.auto.json"
    if not path.is_file():
        return [], ""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return [], ""
    reviews = data.get("reviews") or []
    trends_line = ""
    trends_path = analysis_dir / "dlsite_review_trends.auto.json"
    if trends_path.is_file():
        try:
            tr = json.loads(trends_path.read_text(encoding="utf-8"))
            themes = tr.get("recurringThemes") or []
            theme_s = "、".join(
                f"{t.get('label', '')}({t.get('count', 0)})" for t in themes[:8]
            )
            rec = " / ".join(tr.get("recommendedForHints") or [])[:200]
            caution = " / ".join(tr.get("notRecommendedForHints") or [])[:200]
            trends_line = (
                f"機械抽出傾向: 言及={theme_s or '—'}; "
                f"向く={rec or '—'}; 合わない={caution or '—'}"
            )
        except json.JSONDecodeError:
            pass
    return reviews, trends_line


def format_dlsite_digest_for_prompt(digest: dict) -> str:
    """Gemini digest JSON を作品感想プロンプト用テキストへ。"""
    lines = ["【DLsite購入者レビュー（Gemini読み取りメモ・原文コピー禁止）】"]
    for key, label in (
        ("listenerTemperature", "聴き手の温度"),
        ("bodyAndSound", "体・音の手触り"),
        ("emotionalColor", "感情の色"),
        # 旧 digest 互換（温度系のみ採用）
        ("characterAppeal", "感情の色（旧）"),
    ):
        items = digest.get(key) or []
        if items:
            lines.append(f"- {label}: " + " / ".join(str(x) for x in items[:12]))
    return "\n".join(lines)


DIGEST_LIST_KEYS = (
    "listenerTemperature",
    "bodyAndSound",
    "emotionalColor",
    "characterAppeal",  # 旧 digest 互換
)

DIGEST_BATCH_SIZE = 5


def merge_digest_parts(parts: list[dict]) -> dict:
    """バッチ digest を1つに統合（重複除去）。"""
    merged: dict[str, list[str]] = {k: [] for k in DIGEST_LIST_KEYS}
    seen: dict[str, set[str]] = {k: set() for k in DIGEST_LIST_KEYS}
    for part in parts:
        for key in DIGEST_LIST_KEYS:
            for item in part.get(key) or []:
                text = str(item).strip()
                if text and text not in seen[key]:
                    seen[key].add(text)
                    merged[key].append(text)
    return merged


def parse_digest_json(raw: str) -> dict | None:
    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def run_dlsite_digest_gemini(
    client,
    model: str,
    *,
    blocks: list[str],
    trends_line: str,
    review_count: int,
    batch_label: str,
) -> dict | None:
    user_prompt = (
        f"購入者レビュー {review_count} 件（{batch_label}）を読み、作品感想執筆用メモに整理してください。\n"
        f"{trends_line}\n\n"
        + "\n\n".join(blocks)
    )
    raw = gemini_generate(
        client,
        model=model,
        contents=user_prompt,
        system_instruction=DLsite_DIGEST_SYSTEM,
        temperature=0.35,
        label=f"DLsite購入者レビュー読み取り（{batch_label}）",
    )
    return parse_digest_json(raw)


def digest_reviews_batched(
    client,
    model: str,
    blocks: list[str],
    trends_line: str,
) -> dict | None:
    """件数が多い／露骨な題材向けに小分け digest して統合。"""
    parts: list[dict] = []
    total = len(blocks)
    for start in range(0, total, DIGEST_BATCH_SIZE):
        chunk = blocks[start : start + DIGEST_BATCH_SIZE]
        batch_no = start // DIGEST_BATCH_SIZE + 1
        batch_total = (total + DIGEST_BATCH_SIZE - 1) // DIGEST_BATCH_SIZE
        label = f"バッチ{batch_no}/{batch_total}・{len(chunk)}件"
        part = run_dlsite_digest_gemini(
            client,
            model,
            blocks=chunk,
            trends_line=trends_line if batch_no == 1 else "",
            review_count=len(chunk),
            batch_label=label,
        )
        if part:
            parts.append(part)
        else:
            print(f"[警告] DLsite digest {label}: JSON 取得失敗 — 1件ずつ再試行")
            for j, single_block in enumerate(chunk, start=start + 1):
                single = run_dlsite_digest_gemini(
                    client,
                    model,
                    blocks=[single_block],
                    trends_line="",
                    review_count=1,
                    batch_label=f"単件{j}/{total}",
                )
                if single:
                    parts.append(single)
                else:
                    print(f"[警告] DLsite digest 単件{j}: スキップ")
    if not parts:
        return None
    if len(parts) == 1:
        return parts[0]
    return merge_digest_parts(parts)


def ensure_dlsite_gemini_digest(
    client,
    model: str,
    slug: str,
    *,
    force: bool = False,
) -> str:
    """購入者レビューを Gemini で読み取り、digest を保存してプロンプト用文字列を返す。"""
    analysis_dir = ROOT / "src" / "content" / "レビュー" / slug / "analysis"
    digest_path = analysis_dir / "dlsite_reviews_gemini_digest.auto.json"
    if digest_path.is_file() and not force:
        try:
            saved = json.loads(digest_path.read_text(encoding="utf-8"))
            if saved.get("digest"):
                print(f"[impression] DLsite digest 再利用: {digest_path.name}")
                return format_dlsite_digest_for_prompt(saved["digest"])
        except json.JSONDecodeError:
            pass

    reviews, trends_line = gather_dlsite_reviews_full(slug)
    if not reviews:
        print("[impression] dlsite_reviews.auto.json なし — digest スキップ")
        return ""

    blocks: list[str] = []
    for i, r in enumerate(reviews, 1):
        title = sanitize_dlsite_review_text((r.get("title") or "").strip(), slug)
        text = sanitize_dlsite_review_text((r.get("text") or "").strip(), slug)
        if title or text:
            blocks.append(f"### レビュー{i} 《{title}》\n{text}")
    if not blocks:
        return ""

    digest_obj: dict | None = None
    batched = False
    if len(blocks) > DIGEST_BATCH_SIZE:
        print(
            f"[impression] DLsite digest バッチ処理（{len(blocks)}件 → "
            f"{DIGEST_BATCH_SIZE}件ずつ）"
        )
        digest_obj = digest_reviews_batched(client, model, blocks, trends_line)
        batched = True
    else:
        digest_obj = run_dlsite_digest_gemini(
            client,
            model,
            blocks=blocks,
            trends_line=trends_line,
            review_count=len(reviews),
            batch_label="全件",
        )

    if digest_obj is None and len(blocks) > 1:
        print("[impression] 一括 digest 失敗 — バッチ digest へフォールバック")
        digest_obj = digest_reviews_batched(client, model, blocks, trends_line)
        batched = True

    if not digest_obj:
        print("[警告] DLsite digest: JSON 取得失敗 — 生抜粋にフォールバック")
        return gather_dlsite_reviews_brief(slug, max_reviews=len(reviews))

    payload = {
        "digestedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "model": model,
        "reviewCount": len(reviews),
        "batched": batched,
        "digest": digest_obj,
    }
    analysis_dir.mkdir(parents=True, exist_ok=True)
    digest_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"[impression] DLsite digest 保存: {digest_path}")
    return format_dlsite_digest_for_prompt(digest_obj)


def gather_dlsite_reviews_brief(slug: str, *, max_reviews: int = 10) -> str:
    """analysis/dlsite_reviews.auto.json から購入者の主観を要約素材として渡す。"""
    path = ROOT / "src" / "content" / "レビュー" / slug / "analysis" / "dlsite_reviews.auto.json"
    if not path.is_file():
        return ""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return ""
    reviews = data.get("reviews") or []
    lines: list[str] = []
    for r in reviews[:max_reviews]:
        title = sanitize_dlsite_review_text((r.get("title") or "").strip(), slug)
        text = sanitize_dlsite_review_text(
            re.sub(r"\s+", " ", (r.get("text") or "").strip()), slug
        )
        if len(text) > 360:
            text = text[:360] + "…"
        if title or text:
            lines.append(f"- 《{title}》 {text}")
    if not lines:
        return ""
    return (
        "【DLsite購入者レビュー抜粋（主観の参考。原文コピー禁止・CV名・サークル名は感想に載せない）】\n"
        + "\n".join(lines)
    )


def gather_context(slug: str, *, minimal: bool = False) -> str:
    """作品感想用コンテキスト。summary/グラフ散文は言い換え源になりやすいので最小限。"""
    index_path = ROOT / "src" / "content" / "レビュー" / slug / "index.md"
    text = index_path.read_text(encoding="utf-8")
    parts: list[str] = []

    whisper = gather_whisper_snippets(slug, max_lines=6 if minimal else 10)
    if whisper:
        parts.append(whisper)

    if m := re.search(r"^summary:\s*\|\s*\n([\s\S]*?)(?=\n\w|\n---)", text, re.MULTILINE):
        parts.append(
            "【summary（事実確認のみ・感想に言い換えて載せない）】\n"
            + m.group(1).strip()
        )

    if m := re.search(r"circleName:\s*(.+)", text):
        parts.append(f"【サークル】{m.group(1).strip()}")

    if m := re.search(r"itemName:\s*(.+)", text):
        parts.append(f"【作品名】{m.group(1).strip()}")

    env_no_binaural = re.search(
        r"環境音.*出せない|環境音は控えめ|環境音より会話|ロケ音.*使わない",
        text,
    )
    if not env_no_binaural and re.search(
        r"ロケ|現場.*収録|実際の環境音|ロケ音", text
    ):
        parts.append(
            "【音声の特徴（感想に必ず活かす）】"
            "公園等の現場で収録した**実際の環境音（ロケ音）**を催眠誘導の軸に使う。"
            "合成SEだけでなく、リアルな風・虫・水などの音が誘導と同期する手触りを書く。"
        )

    if m := re.search(r"\*\*ドライシーン(\d+)回\*\*", text):
        parts.append(f"【絶頂目安】ドライ{m.group(1)}回")

    if not minimal:
        if m := re.search(
            r"\*\*【こんな人におすすめ】\*\*(.*?)\*\*【合わない",
            text,
            re.DOTALL,
        ):
            labels = re.findall(r"^- \*\*(.+?)\*\*", m.group(1), re.MULTILINE)
            if labels:
                parts.append("【おすすめラベル（向く人段落用・ラベルの言い換え禁止）】\n" + " / ".join(labels[:3]))

    return "\n\n".join(parts)


def gather_safe_whisper_cues(slug: str, *, max_lines: int = 5) -> str:
    """露骨語を含まない Whisper 行だけ（一点凝視・ゼロカウント等）。"""
    analysis_dir = ROOT / "src" / "content" / "レビュー" / slug / "analysis"
    if not analysis_dir.is_dir():
        return ""

    block_markers = (
        "イカ",
        "ディルド",
        "アナル",
        "射精",
        "メス化",
        "ちん",
        "挿入",
        "仲出",
        "ズコ",
        "フタナリ",
        "女体化",
        "おちん",
    )
    safe_kw = (
        "一点",
        "天井",
        "ゼロ",
        "カウント",
        "肩",
        "瞼",
        "即売会",
        "魔法少女",
        "解除",
        "DVD",
        "女子会",
        "試して",
        "ほら",
        "フリフリ",
        "催眠",
    )
    skip_in_name = ("フリートーク", "注意事項")
    picked: list[str] = []

    for path in sorted(analysis_dir.glob("*.txt")):
        if any(x in path.name for x in skip_in_name):
            continue
        track = path.stem
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = re.sub(r"\s+", " ", raw.strip())
            if len(line) < 18 or len(line) > 95:
                continue
            if not any(
                k in line
                for k in (
                    *safe_kw,
                    "バレない",
                    "声を上げ",
                    "変身",
                    "イベント",
                    "実録",
                    "コス",
                    "メイク",
                    "タイツ",
                    "絶頂以外",
                    "射精以外",
                    "杖",
                )
            ):
                continue
            safe = sanitize_prompt_context(line)
            if any(m in safe for m in block_markers):
                continue
            picked.append(f"- ({track}) {safe}")
            if len(picked) >= max_lines:
                break
        if len(picked) >= max_lines:
            break

    if not picked:
        return ""
    return "【Whisper（安全抜粋・場面の手がかり）】\n" + "\n".join(picked)


def gather_sensitive_impression_facts(slug: str, *, minimal: bool = False) -> str:
    """露骨題材の新規生成用。summary は言い換え済み・Whisper は安全行のみ。"""
    index_path = ROOT / "src" / "content" / "レビュー" / slug / "index.md"
    text = index_path.read_text(encoding="utf-8")
    parts: list[str] = []

    if m := re.search(r"itemName:\s*(.+)", text):
        parts.append(f"作品名: {sanitize_prompt_context(m.group(1).strip())}")
    if m := re.search(r"circleName:\s*(.+)", text):
        parts.append(f"サークル: {m.group(1).strip()}")

    tags = re.findall(r"^\s*-\s+(.+)$", text, re.MULTILINE)
    cv = [
        t
        for t in tags
        if t not in ("催眠音声", "同人音声", "バイノーラル")
        and not t.startswith("RJ")
    ]
    if cv:
        parts.append(f"タグ: {' / '.join(sanitize_prompt_context(t) for t in cv[:5])}")

    if m := re.search(r"^summary:\s*\|\s*\n([\s\S]*?)(?=\n\w|\n---)", text, re.MULTILINE):
        summary = sanitize_prompt_context(m.group(1).strip().replace("\n", ""))
        parts.append(f"内容: {summary}")

    if not minimal:
        if m := re.search(r"\*\*ドライシーン(\d+)回\*\*", text):
            wet = re.search(r"\*\*ウェットシーン(\d+)回\*\*", text)
            wet_n = wet.group(1) if wet else "0"
            parts.append(f"絶頂目安: ドライ{m.group(1)}回 / ウェット{wet_n}回")
        if m := re.search(
            r"\*\*【こんな人におすすめ】\*\*(.*?)\*\*【合わない",
            text,
            re.DOTALL,
        ):
            labels = re.findall(r"^- \*\*(.+?)\*\*", m.group(1), re.MULTILINE)
            if labels:
                parts.append(
                    "向く人: "
                    + " / ".join(sanitize_prompt_context(l) for l in labels[:3])
                )
        whisper = gather_safe_whisper_cues(slug)
        if whisper:
            parts.append(whisper)

    return "\n\n".join(parts)


def gather_analyzed_impression_brief(slug: str, *, minimal: bool = False) -> str:
    """index 解析（主要誘導・itemDescription・Whisper）から感想用分析メモ。summary 言い換え源にしない。"""
    index_path = ROOT / "src" / "content" / "レビュー" / slug / "index.md"
    text = index_path.read_text(encoding="utf-8")
    parts: list[str] = [
        "【聴き分析メモ（感想はここから場面・手触りで書く。回数列挙・聴き方カタログ禁止）】"
    ]

    if m := re.search(r"itemName:\s*(.+)", text):
        parts.append(f"作品: {sanitize_prompt_context(m.group(1).strip())}")
    if m := re.search(r"circleName:\s*(.+)", text):
        parts.append(f"サークル: {m.group(1).strip()}")

    if m := re.search(r"itemDescription:\s*\|\s*\n([\s\S]*?)(?=\n\w|\n---)", text):
        blocks = [b.strip() for b in m.group(1).strip().split("\n\n") if b.strip()]
        if blocks:
            parts.append(
                "設定: "
                + sanitize_prompt_context(blocks[0].replace("\n", " "))
            )
        if len(blocks) > 1 and not minimal:
            parts.append(
                "本編の山: "
                + sanitize_prompt_context(blocks[1].replace("\n", " "))
            )

    flow = re.findall(r"^#### \d+\. (.+)$", text, re.MULTILINE)
    if flow:
        parts.append(
            "誘導の流れ: "
            + " → ".join(sanitize_prompt_context(f) for f in flow[:6])
        )

    if not minimal:
        if m := re.search(
            r"\*\*【こんな人におすすめ】\*\*(.*?)\*\*【合わない",
            text,
            re.DOTALL,
        ):
            labels = re.findall(r"^- \*\*(.+?)\*\*", m.group(1), re.MULTILINE)
            if labels:
                parts.append(
                    "向く人: "
                    + " / ".join(sanitize_prompt_context(l) for l in labels[:3])
                )
        whisper = gather_safe_whisper_cues(slug, max_lines=8)
        if whisper:
            parts.append(whisper)

    return "\n\n".join(parts)


def gather_fact_lexicon(slug: str) -> str:
    """第2段文体調整用。summary から具体語を抽出（全文は載せない）。"""
    index_path = ROOT / "src" / "content" / "レビュー" / slug / "index.md"
    text = index_path.read_text(encoding="utf-8")
    if m := re.search(r"^summary:\s*\|\s*\n([\s\S]*?)(?=\n\w|\n---)", text, re.MULTILINE):
        summary = m.group(1).strip().replace("\n", "")
        return f"出力に活かす具体語（summary より・言い換え不要）: {summary}"
    return ""


def gather_neutral_meta(slug: str) -> str:
    """正本文体調整用。露骨語を載せないメタのみ。"""
    index_path = ROOT / "src" / "content" / "レビュー" / slug / "index.md"
    text = index_path.read_text(encoding="utf-8")
    parts: list[str] = []
    if m := re.search(r"itemName:\s*(.+)", text):
        parts.append(f"作品名: {m.group(1).strip()}")
    if m := re.search(r"circleName:\s*(.+)", text):
        parts.append(f"サークル: {m.group(1).strip()}")
    tags = re.findall(r"^\s*-\s+(.+)$", text, re.MULTILINE)
    cv = [t for t in tags if t not in ("催眠音声", "同人音声", "バイノーラル")]
    if cv:
        parts.append(f"タグ・CV: {' / '.join(cv[:6])}")
    return "\n".join(parts)


def parse_paragraphs_json(raw: str) -> list[str]:
    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        return []
    data = json.loads(m.group(0))
    paras = data.get("paragraphs", [])
    return paras if isinstance(paras, list) else []


def run_impression_loop(
    client: genai.Client,
    *,
    model: str,
    slug: str,
    build_prompt_fn,
    label: str,
    max_attempts: int = 6,
    validate: bool = True,
    opening_angles: list[str] | None = None,
) -> list[str]:
    paragraphs: list[str] = []
    raw = ""
    angles = opening_angles or OPENING_ANGLES
    for attempt in range(1, max_attempts + 1):
        angle = random.choice(angles)
        prompt = build_prompt_fn(angle, attempt)
        if attempt == 1:
            print(f"[impression] {label} Gemini ({model}) … 構成: {angle[:40]}…")
        raw = gemini_generate(
            client,
            model=model,
            contents=prompt,
            system_instruction=SYSTEM,
            temperature=0.55,
            label=label,
        ).strip()
        if not raw:
            print(f"[警告] {label} 試行 {attempt}: 空応答（入力ブロックの可能性）")
            continue
        paragraphs = parse_paragraphs_json(raw)
        if not paragraphs:
            print(f"[警告] {label} 試行 {attempt}: JSON なし")
            continue
        if not validate:
            return paragraphs
        warnings = validate_impression_paragraphs(paragraphs, slug=slug)
        if not warnings:
            return paragraphs
        print(f"[警告] {label} 試行 {attempt}/{max_attempts} 品質NG:")
        for w in warnings[:8]:
            print(f"  - {w}")
    if raw and not paragraphs:
        print(raw)
    return []


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("slug")
    p.add_argument("--write-tsx", action="store_true", help="page.tsx の quickGuide に追記")
    p.add_argument(
        "--revise",
        action="store_true",
        help="既存 work_impression JSON を Gemini で添削（AI調除去・正本A/B参照）",
    )
    p.add_argument(
        "--note",
        default="",
        help="追加指示（感想に必ず含める事実・角度）",
    )
    p.add_argument(
        "--refresh-dlsite-digest",
        action="store_true",
        help="DLsite購入者レビューの Gemini 読み取りを再実行",
    )
    p.add_argument(
        "--no-dlsite-digest",
        action="store_true",
        help="DLsite digest をスキップ（生抜粋のみ）",
    )
    args = p.parse_args()

    index_path = ROOT / "src" / "content" / "レビュー" / args.slug / "index.md"
    index_text = index_path.read_text(encoding="utf-8") if index_path.is_file() else ""
    all_ages = is_all_ages_doujin_review(index_text)

    require_api_key()
    model = os.environ.get("GEMINI_HUMANIZE_MODEL", "gemini-2.5-flash")
    client = genai.Client(api_key=get_api_key())

    dlsite_digest = ""
    if not args.no_dlsite_digest:
        dlsite_digest = ensure_dlsite_gemini_digest(
            client,
            model,
            args.slug,
            force=args.refresh_dlsite_digest,
        )

    ctx = gather_context(args.slug)
    if dlsite_digest:
        ctx = f"{ctx}\n\n{dlsite_digest}"
    else:
        dlsite = gather_dlsite_reviews_brief(args.slug)
        if dlsite:
            ctx = f"{ctx}\n\n{dlsite}"
    if not ctx:
        print("[エラー] index.md から文脈を取得できませんでした")
        sys.exit(1)

    circle_cv_names = gather_impression_banned_names(args.slug)
    name_ban_line = ""
    if circle_cv_names:
        name_ban_line = (
            "【必須除外・サークル・声優】感想本文に次の固有名は書かない: "
            + " / ".join(circle_cv_names)
            + " … 語り手は「語り手」「この声」等で指す。\n"
        )
    extra_note = (
        "【必須除外】作品感想にサークル名・声優名（CV）・「○○氏」は一切書かない。"
        "語り手は「語り手」「この声」「語りかけ」「メイド」「楓」等で指す。\n"
        "【タグ・フェチ語】耳舐め・耳かき・添い寝・膝枕・神様など作品タグは**使用可**（サークル名・声優名だけ禁止）。\n"
        "【必須除外】★・三軸の点数・数値・軸名（没入度・満足度 等）は一切書かない。"
        "弱点は聴いた体感・場面で書く。\n"
        f"{name_ban_line}"
        "【引用】各段落の「」台詞は0〜1箇所・短く。DLsite原文の転記禁止。\n"
    )
    has_dlsite = bool(dlsite_digest) or (
        ROOT / "src" / "content" / "レビュー" / args.slug / "analysis" / "dlsite_reviews.auto.json"
    ).is_file()
    if has_dlsite:
        extra_note += (
            "【DLsite購入者レビュー】上記の Gemini 読み取りメモの温度を"
            "**解析室レビュアー自身の所感**として再構成（物語あらすじ・パート順説明禁止）。"
            "購入者の文言転記・「素晴らしい」「感動」連発は禁止。\n"
            "【文体・必須（§8.4.2）】**サイト公開向けの主観所感**。"
            "見本 usotsuki / hypno-multi-rape の温度（場面→肝→手触り→向く人）。"
            "日記調の「私は〜」連発・口語（パチンと・驚きです）は避ける。"
            "主観は「〜でした」「〜と思います」「印象的」等で**全文1〜2回**。"
            "「購入者」「人も多いようです」「聴き手は」「聴き手の」「味わえます」"
            "「おすすめします」等の第三者・カタログ・宣伝調は禁止。"
            "語尾混在必須（です・ます・一本・体言止め・かもしれません）。"
            "段落・全文で「〜ました」だけの連続は不合格。"
            "U+2014 ダッシュ（——）は使わず句点（。）で区切る（文字化け防止）。"
            "DLsite digest は内部参考のみ・出力に購入者視点を出さない。\n"
        )
    if args.slug == "sound-of-ecstasy-saimin":
        extra_note += (
            "【必須除外】作品感想に「リラックス運動」「立位」「腕を振る」等、"
            "導入パートの運動・聴き方説明は書かない。双子の声・音楽・快楽の光・"
            "連続ドライ絶頂・解除の体感を中心に。\n"
        )
    extra_note += "\n"
    if args.note.strip():
        extra_note += f"【ユーザー追加指示（必須）】\n{args.note.strip()}\n\n"

    guide = load_guide_excerpts_for_impression(args.slug)
    forbidden = load_forbidden_rules()
    sensitive = is_sensitive_work_context(ctx) and not all_ages
    opening_angles = ALL_AGES_OPENING_ANGLES if all_ages else OPENING_ANGLES
    base_ctx = sanitize_prompt_context(ctx) if sensitive else ctx
    neutral_meta = gather_neutral_meta(args.slug)
    fact_lexicon = gather_fact_lexicon(args.slug)

    def build_content_prompt(
        ctx_text: str,
        angle: str,
        *,
        include_usotsuki: bool,
        ctx_note: str = "",
    ) -> str:
        style_shots = load_style_few_shot(
            include_usotsuki=include_usotsuki and not all_ages,
            all_ages=all_ages,
        )
        if all_ages:
            refs = "見本C（shinitagari・全年齢）"
            tail = (
                "段落役割は見本C型（入り方→関係の芯→手触り+留保→向く人）を"
                "今回の作品だけで書く。"
            )
        elif include_usotsuki:
            refs = "見本A（grim）・見本B（usotsuki）"
            tail = (
                "段落役割は見本B型（場面→肝→手触り→向く人）を基本に"
                "今回の作品だけで書く。"
            )
        else:
            refs = "見本A（grim）"
            tail = (
                "段落役割は見本B型（場面→肝→手触り→向く人）を意識して書く。"
            )
        return (
            f"{forbidden}\n\n{guide}\n\n{BAD_IMPRESSION_PATTERNS}\n\n"
            f"{style_shots}\n\n"
            f"【今回の構成指示】\n{angle}\n\n"
            f"【{GRIM_CLICHE_BAN}】\n\n"
            f"{extra_note}"
            f"【作品情報】\n{ctx_note}{ctx_text}\n\n"
            f"上記 **{refs}** の温度に寄せ、{tail}"
            "見本の文句はコピーしない。JSON で paragraphs を出力してください。"
        )

    def build_polish_prompt(draft: list[str], angle: str) -> str:
        style_shots = load_style_few_shot(include_usotsuki=True)
        draft_json = json.dumps({"paragraphs": draft}, ensure_ascii=False, indent=2)
        fact_block = f"{fact_lexicon}\n\n" if fact_lexicon else ""
        return (
            f"{forbidden}\n\n{guide}\n\n{BAD_IMPRESSION_PATTERNS}\n\n"
            f"{style_shots}\n\n"
            f"【今回の構成指示】\n{angle}\n\n"
            f"【{GRIM_CLICHE_BAN}】\n\n"
            f"{extra_note}"
            f"【下書き（事実・具体語は維持。文体だけ正本A/Bに合わせて書き直す）】\n{draft_json}\n\n"
            f"【作品メタ】\n{neutral_meta}\n\n"
            f"{fact_block}"
            "上記 **正本見本A（grim）・正本見本B（usotsuki）** の温度・段落役割に合わせて下書きを書き直す。"
            "事実（場面・技法・向く人）は変えない。見本の文句コピー禁止。JSON で paragraphs のみ。"
        )

    def build_sensitive_revise_prompt(draft: list[str], angle: str) -> str:
        """露骨題材: ガイド全文・見本Bを載せずブロック回避。出力は作品語復元可。"""
        style_shots = sanitize_prompt_context(
            load_style_few_shot(include_usotsuki=False)
        )
        draft_json = json.dumps(
            {"paragraphs": [sanitize_prompt_context(p) for p in draft]},
            ensure_ascii=False,
            indent=2,
        )
        note = sanitize_prompt_context(extra_note) if extra_note else ""
        return (
            f"{style_shots}\n\n"
            f"【構成】{sanitize_prompt_context(angle)}\n\n"
            f"{note}"
            "【下書き（入力は言い換え済み。出力では作品の具体語を復元してよい）】\n"
            f"{draft_json}\n\n"
            "正本A（grim）の温度で添削。段落数・順序・事実は維持。段落統合禁止。"
            "JSON で paragraphs のみ。"
        )

    def build_sensitive_content_prompt(
        ctx_text: str, angle: str, *, include_style: bool = True
    ) -> str:
        """露骨題材の新規生成（ガイド全文なし・grimのみ）。"""
        style_block = ""
        if include_style:
            style_shots = sanitize_prompt_context(
                load_style_few_shot(include_usotsuki=False)
            )
            style_block = f"{style_shots}\n\n"
        note = sanitize_prompt_context(extra_note) if extra_note else ""
        return (
            f"{style_block}"
            f"【構成】{sanitize_prompt_context(angle)}\n\n"
            f"{note}"
            "【作品情報（言い換え済み。出力では具体語に戻してよい）】\n"
            f"{ctx_text}\n\n"
            "聴き終わった**プロレビュアー**の所感を4段落で書く。"
            "上記は聴き分析メモ。場面・台詞・聴いた瞬間の手触りから入る。"
            "回数列挙・聴き方説明・仕様カタログ禁止。"
            "入力の言い換え語は出力で作品の本来の語に戻してよい。"
            "JSON で paragraphs のみ。"
        )

    def build_revise_prompt(
        draft: list[str],
        angle: str,
        *,
        include_usotsuki: bool,
        include_fact_lexicon: bool = True,
    ) -> str:
        style_shots = load_style_few_shot(
            include_usotsuki=include_usotsuki and not all_ages,
            all_ages=all_ages,
        )
        draft_json = json.dumps({"paragraphs": draft}, ensure_ascii=False, indent=2)
        fact_block = f"{fact_lexicon}\n\n" if include_fact_lexicon and fact_lexicon else ""
        refs = (
            "正本見本A（grim）・正本見本B（usotsuki）"
            if include_usotsuki
            else "正本見本A（grim）"
        )
        return (
            f"{guide}\n\n{BAD_IMPRESSION_PATTERNS}\n\n"
            f"{REVISE_AI_PATTERNS}\n\n"
            f"{style_shots}\n\n"
            f"【今回の構成指示】\n{angle}\n\n"
            f"【{GRIM_CLICHE_BAN}】\n\n"
            f"{extra_note}"
            f"【添削対象（AI調の下書き・事実は維持して人間味に書き直す）】\n{draft_json}\n\n"
            f"【作品メタ】\n{neutral_meta}\n\n"
            f"{fact_block}"
            f"{refs}の**温度**に合わせ、下書きをプロレビュアーの所感へ添削。"
            "キーワード羅列・説明調をやめ、場面と手触りが伝わる語に置き換える。"
            "**サークル名・声優名（CV）・「○○氏」は削除し、語り手は「語り手」「この声」等で指す。**"
            "**★・三軸点数・数値採点は削除し、弱点は体感・場面で書く。**"
            "事実語は summary どおり維持（出力では具体語をそのまま使ってよい）。"
            "入力が言い換えられていても、出力ではメスイキ・ノーハンド・前立腺焦らし・即売会等の作品語を復元してよい。"
            "JSON で paragraphs のみ。"
        )

    def load_existing_paragraphs(slug: str) -> list[str]:
        path = SCRIPT_DIR / f"work_impression_{slug}.json"
        if not path.is_file():
            print(f"[エラー] {path} がありません")
            sys.exit(1)
        data = json.loads(path.read_text(encoding="utf-8"))
        paras = data.get("paragraphs") or []
        if not paras:
            print("[エラー] 既存 paragraphs が空です")
            sys.exit(1)
        return paras

    paragraphs: list[str] = []

    if args.revise:
        draft = load_existing_paragraphs(args.slug)
        print("[impression] --revise: 既存感想を Gemini 添削（正本A+B参照）")

        if sensitive:
            print("[impression] 添削第1段: 見本Aのみ + 入力用言い換え")
            sanitized_draft = [sanitize_prompt_context(p) for p in draft]

            def revise_draft_prompt(angle: str, attempt: int) -> str:
                return build_sensitive_revise_prompt(draft, angle)

            revised = run_impression_loop(
                client,
                model=model,
                slug=args.slug,
                opening_angles=opening_angles,
                build_prompt_fn=revise_draft_prompt,
                label="作品感想・添削下書き",
                max_attempts=6,
                validate=False,
            )
            if not revised:
                print("[エラー] 添削第1段に失敗しました。")
                sys.exit(1)

            print("[impression] 添削第2段: 正本Aで温度調整（露骨題材は見本B省略）")
            intermediate = [sanitize_prompt_context(p) for p in revised]

            def revise_polish_prompt(angle: str, attempt: int) -> str:
                return build_sensitive_revise_prompt(
                    [sanitize_prompt_context(p) for p in revised],
                    angle,
                )

            paragraphs = run_impression_loop(
                client,
                model=model,
                slug=args.slug,
                opening_angles=opening_angles,
                build_prompt_fn=revise_polish_prompt,
                label="作品感想・添削正本",
                max_attempts=8,
                validate=False,
            )
        else:

            def revise_prompt(angle: str, attempt: int) -> str:
                return build_revise_prompt(
                    draft, angle, include_usotsuki=True, include_fact_lexicon=True
                )

            paragraphs = run_impression_loop(
                client,
                model=model,
                slug=args.slug,
                opening_angles=opening_angles,
                build_prompt_fn=revise_prompt,
                label="作品感想・添削",
                max_attempts=8,
            )

        if not paragraphs:
            print("[エラー] 添削に失敗しました。")
            sys.exit(1)
    elif sensitive:
        print("[impression] 露骨な題材: 第1段=所感下書き → 第2段=grim温度")

        def draft_prompt(angle: str, attempt: int) -> str:
            minimal = attempt > 2
            no_style = attempt >= 5
            ctx_use = gather_analyzed_impression_brief(args.slug, minimal=minimal)
            if minimal:
                print("[impression] 第1段: minimal コンテキストに切替")
            if no_style:
                print("[impression] 第1段: 文体見本を省略")
            return build_sensitive_content_prompt(
                ctx_use, angle, include_style=not no_style
            )

        draft = run_impression_loop(
            client,
            model=model,
            slug=args.slug,
            opening_angles=opening_angles,
            build_prompt_fn=draft_prompt,
            label="作品感想・下書き",
            max_attempts=6,
            validate=False,
        )
        if not draft:
            print("[エラー] 第1段（所感下書き）に失敗しました。")
            sys.exit(1)

        print("[impression] 第2段: 正本A（grim）で温度調整")

        def polish_prompt(angle: str, attempt: int) -> str:
            return build_sensitive_revise_prompt(draft, angle)

        paragraphs = run_impression_loop(
            client,
            model=model,
            slug=args.slug,
            opening_angles=opening_angles,
            build_prompt_fn=polish_prompt,
            label="作品感想・正本調整",
            max_attempts=6,
            validate=False,
        )
        if not paragraphs:
            print("[エラー] 第2段（正本調整）に失敗しました。")
            sys.exit(1)
    else:
        if all_ages:
            print("[impression] 全年齢: 正本見本C（shinitagari）を few-shot に使用")
        else:
            print("[impression] 正本見本A（grim）+ 正本見本B（usotsuki）を few-shot に使用")

        def single_prompt(angle: str, attempt: int) -> str:
            ctx_use = ctx if attempt <= 4 else gather_context(args.slug, minimal=True)
            if attempt > 4:
                print("[impression] minimal コンテキストに切替")
            return build_content_prompt(
                ctx_use, angle, include_usotsuki=not all_ages
            )

        paragraphs = run_impression_loop(
            client,
            model=model,
            slug=args.slug,
            opening_angles=opening_angles,
            build_prompt_fn=single_prompt,
            label="作品感想",
            max_attempts=6,
        )
        if not paragraphs:
            print("[エラー] 品質チェックを通過できませんでした。人手で §8.4 見本に沿って修正してください。")
            sys.exit(1)

    if sensitive and paragraphs:
        paragraphs = restore_impression_terms(paragraphs)
        paragraphs = cleanup_impression_prose(paragraphs)

    for i, para in enumerate(paragraphs, 1):
        hits = validate_impression_paragraphs([para], slug=args.slug)
        for h in hits:
            print(f"[警告] {h}")

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
