#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Whisper 解析からドライ／ウェットシーン本数を数える（§0.1.2）。"""
from __future__ import annotations

import re
from pathlib import Path

# リスナーへの自慰・オナサポ指示（部分一致・台詞内）
WET_INSTRUCTION_FRAGMENTS: tuple[str, ...] = (
    "自動手コキ",
    "手コキして",
    "手コキし",
    "手コキを",
    "手コキで",
    "手コキ",
    "オナニー",
    "シコって",
    "シコれ",
    "シコり",
    "シゴいて",
    "シゴイ",
    "扱いて",
    "扱いなさい",
    "扱く",
    "弄って",
    "弄り",
    "しごいて",
    "しごき",
    "自分で触",
    "自分の手で",
    "自分の手を",
    "手を動かして",
    "手を動かし",
    "手を上下",
    "上下に動か",
    "上下へ動か",
    "握って上下",
    "速く扱",
    "もっと扱",
    "抜き差し",
    "抜いてください",
    "抜いてちゃえ",
)

# 自慰指示と無関係な「手・動か」文脈（行単位で除外）
WET_LINE_SKIP_FRAGMENTS: tuple[str, ...] = (
    "動かせません",
    "動かせない",
    "手を叩",
    "手を縛",
    "ベルト",
    "拘束",
    "手をマッサージ",
    "手にすり込",
    "粉を手に",
    "両手にすり込",
    "手のひらが静観",
)


def analysis_dir_for_slug(slug: str, root: Path) -> Path | None:
    p = root / "src" / "content" / "レビュー" / slug / "analysis"
    return p if p.is_dir() else None


def resolve_analysis_dir(
    slug: str,
    cli_dir: str | Path | None,
    root: Path,
) -> Path | None:
    """CLI の --analysis-dir を優先し、無ければ src/content/レビュー/<slug>/analysis。"""
    if cli_dir:
        p = Path(cli_dir)
        if p.is_dir():
            return p
    return analysis_dir_for_slug(slug, root)


def iter_whisper_track_files(analysis_dir: Path) -> list[Path]:
    paths: list[Path] = []
    for pat in ("*.txt", "*.srt"):
        for path in sorted(analysis_dir.glob(pat)):
            name = path.name.lower()
            if name.startswith("info") or "dlsite" in name:
                continue
            paths.append(path)
    # 同一トラックの txt / srt 重複を stem で統一
    seen: set[str] = set()
    out: list[Path] = []
    for path in paths:
        stem = path.stem.strip()
        if stem in seen:
            continue
        seen.add(stem)
        out.append(path)
    return out


def line_has_wet_instruction(line: str) -> bool:
    compact = re.sub(r"\s+", "", line)
    if any(skip in compact for skip in WET_LINE_SKIP_FRAGMENTS):
        return False
    return any(frag in compact for frag in WET_INSTRUCTION_FRAGMENTS)


def track_has_wet_instruction(text: str) -> bool:
    for raw in text.splitlines():
        line = raw.strip()
        if len(line) < 4:
            continue
        if line_has_wet_instruction(line):
            return True
    return False


def count_wet_scenes(analysis_dir: Path | None) -> int | None:
    """トラック単位で自慰指示がある区間を数える。無ければ 0。"""
    if not analysis_dir or not analysis_dir.is_dir():
        return None
    n = 0
    for path in iter_whisper_track_files(analysis_dir):
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        if track_has_wet_instruction(text):
            n += 1
    return n


def whisper_texts(analysis_dir: Path) -> str:
    chunks: list[str] = []
    for path in iter_whisper_track_files(analysis_dir):
        try:
            chunks.append(path.read_text(encoding="utf-8"))
        except OSError:
            pass
    return "\n".join(chunks)


_COUNTDOWN_10_TO_0_ARRIVAL = (
    r"10.{0,200}?9.{0,200}?8.{0,200}?7"
    r".{0,200}?6.{0,200}?5.{0,200}?4.{0,200}?3"
    r".{0,200}?2.{0,200}?1.{0,80}?0[.、．]?"
    r"(?:\s*\n[^\n]{0,120})?(?:愛して|行っ|幸福感|真っ白|ビクビク|いっちゃえ|射精|絶頂|気持ちい)"
)

_ARRIVAL_TAIL = r"(?:愛して|行っ|幸福感|真っ白|ビクビク|気持ちい)"

# 本番RP末尾の到達（「いいって」等への部分一致を避ける）
DRY_RP_ARRIVAL_FRAGMENTS: tuple[str, ...] = (
    "一緒にいって",
    "いってください",
    "いってちゃえ",
    "いっちゃえ",
    "行っちゃえ",
)


def track_has_rp_dry_arrival(text: str) -> bool:
    compact = re.sub(r"\s+", "", text)
    for frag in DRY_RP_ARRIVAL_FRAGMENTS:
        idx = compact.find(frag)
        if idx < 0:
            continue
        tail = compact[idx : idx + 200]
        if re.search(_ARRIVAL_TAIL, tail):
            return True
    return False


def track_has_dry_arrival(text: str) -> bool:
    """トラック内に自慰指示を伴わない明確な到達回収があるか。"""
    if not text.strip():
        return False
    if re.search(r"0[.、．\s]*(?:ほら[、,]?\s*)?いっちゃえ|0いっちゃえ|0\s*いっちゃえ", text):
        return True
    if re.search(r"3210", text) and re.search(r"またいっちゃえ|握り潰|絞りカス", text):
        return True
    if re.search(r"せーの[^\n]{0,40}いっちゃえ|最後[^\n]{0,20}いっちゃえ", text):
        return True
    if re.search(r"3・2・1[^\n]{0,80}0[^\n]{0,80}(?:引き剥が|剥が)", text):
        return True
    if re.search(r"321\s*ゼロ", text):
        return True
    if re.search(_COUNTDOWN_10_TO_0_ARRIVAL, text, re.DOTALL):
        return True
    if not track_has_wet_instruction(text) and track_has_rp_dry_arrival(text):
        return True
    return False


def count_dry_scenes(analysis_dir: Path | None) -> int | None:
    """トラック単位で到達回収がある区間を数える。無ければ 0。"""
    if not analysis_dir or not analysis_dir.is_dir():
        return None
    n = 0
    for path in iter_whisper_track_files(analysis_dir):
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        if track_has_dry_arrival(text):
            n += 1
    return n


def extract_wet_count_from_index(text: str) -> int | None:
    m = re.search(r"\*\*ウェットシーン(\d+)回\*\*", text)
    if m:
        return int(m.group(1))
    if re.search(r"\*\*ウェットシーン複数回\*\*", text):
        return None
    if re.search(r"\*\*ウェットシーン0回\*\*", text):
        return 0
    return None


def extract_dry_count_from_index(text: str) -> int | None:
    m = re.search(r"\*\*ドライシーン(\d+)回\*\*", text)
    if m:
        return int(m.group(1))
    if re.search(r"\*\*ドライシーン複数回\*\*", text):
        return None
    return None


def validate_orgasm_counts_for_slug(slug: str, index_text: str, root: Path) -> list[str]:
    """index の絶頂行と Whisper 自慰指示の整合。"""
    errors: list[str] = []
    analysis_dir = resolve_analysis_dir(slug, None, root)
    if not analysis_dir:
        return errors
    wet_whisper = count_wet_scenes(analysis_dir)
    if wet_whisper is None:
        return errors
    wet_index = extract_wet_count_from_index(index_text)
    if wet_index is None:
        return errors
    if wet_index > 0 and wet_whisper == 0:
        errors.append(
            "絶頂行: ウェットシーン>0 だが Whisper に自慰指示（手コキ・シコ/扱/手を動かして等）なし"
        )
    if wet_index == 0 and wet_whisper > 0:
        errors.append(
            f"絶頂行: ウェット0 だが Whisper に自慰指示あり（{wet_whisper}トラック）→ ウェット{wet_whisper} を検討"
        )
    return errors


WET_SCENE_GEMINI_RULE = (
    "ウェットシーン＝Whisper 全トラック走査で **リスナーへの自慰指示**"
    "（手コキ・自動手コキ・シコ/扱/弄・手を動かして・自分で触る 等）"
    "がある **独立区間（通常はトラック）** の本数。"
    "中出し・挿入・本番RP・パート名・購入者レビューの「オナサポ寄り」だけでは数えない。"
    "指示が無ければ **0**。"
)

DRY_SCENE_GEMINI_RULE = (
    "ドライシーン＝射精・自慰指示を伴わない **明確な到達回収**がある **独立区間（通常はトラック）** の本数。"
    "（0/ゼロ合図・10→0カウント到達・本番RP末尾の「いって」回収等）。"
    "予告・焦らし・同一波の繰り返しは含めない。"
)
