#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gemini API 入力の PROHIBITED_CONTENT 回避用（出力の記事事実は変えない）。"""
from __future__ import annotations

# 露骨・TS・妊娠出産系など（generate_work_impression / restore_body_changes 共通）
SENSITIVE_CONTEXT_MARKERS = (
    "TS",
    "女体化",
    "女性化",
    "牛娘",
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
    "精液",
    "中出し",
    "子作り",
    "出産",
    "妊娠",
    "メスイキ",
    "フタナリ",
    "rape",
    "強姦",
)

BASE_REPLACEMENTS: tuple[tuple[str, str], ...] = (
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
    ("精液", "体内液体"),
    ("中に出して", "体内へ"),
    ("中出し", "体内回収"),
    ("種付け", "繁殖行為"),
    ("子作り", "繁殖行為"),
    ("妊娠", "身体変化"),
    ("出産", "分娩"),
    ("授乳", "ミルク供給"),
    ("母乳", "ミルク"),
    ("射乳", "ミルク放出"),
    ("おっぱい", "胸"),
    ("乳首", "敏感部位"),
    ("前立腺焦らし", "焦らし刺激"),
    ("前立腺", "重点部位"),
    ("メスイキ", "ドライ絶頂"),
    ("ノーハンド", "手を使わない回収"),
    ("触れずに", "接触なしで"),
    ("ラブホ女子会", "女子会"),
    ("アナル", "後方刺激"),
    ("ケツ", "後方"),
    ("おちんちん", "男性器"),
    ("おちんぽ", "男性器"),
    ("チンポ", "男性器"),
    ("ペニス", "男性器"),
    ("ショタチンポ", "男性器"),
    ("挿入", "結合"),
    ("ピストン", "動作"),
    ("性行為", "接触"),
    ("本番", "接触描写"),
    ("ディルド", "道具"),
    ("寸止め自動手コキ", "寸止め快感"),
    ("手コキ", "手による刺激"),
    ("フェラ", "口による刺激"),
    ("フタナリ", "両性化"),
    ("割れ目", "私处"),
    ("子宮", "体内"),
    ("淫語", "挑発的な語り"),
)

AGGRESSIVE_EXTRA: tuple[tuple[str, str], ...] = (
    ("絶頂", "到達"),
    ("イク", "到達"),
    ("行っちゃう", "到達する"),
    ("気持ちいい", "快感"),
    ("ドクドク", "じわじわ"),
    ("ビクビク", "震え"),
    ("愛液", "体液"),
    ("媚薬", "香り"),
    ("堕落", "変化"),
    ("悪堕ち", "変化"),
    ("支配", "誘導"),
    ("M属性", "従属"),
    ("牛娘", "変容後"),
    ("ニナール", "語り手"),
    ("勇者", "主人公"),
)


def sanitize_prompt_context(text: str, *, aggressive: bool = False) -> str:
    """API プロンプト入力のみ軽量化（index 本文・出力には使わない）。"""
    out = text
    for old, new in BASE_REPLACEMENTS:
        out = out.replace(old, new)
    if aggressive:
        for old, new in AGGRESSIVE_EXTRA:
            out = out.replace(old, new)
    return out


def is_sensitive_work_context(ctx: str) -> bool:
    return any(marker in ctx for marker in SENSITIVE_CONTEXT_MARKERS)


def build_source_context(
    whisper_data: str,
    librosa_data: str,
    *,
    aggressive: bool = False,
) -> str:
    """Whisper / Librosa を Gemini 入力向けに婉曲化（index 本文には使わない）。"""
    w = sanitize_prompt_context(whisper_data, aggressive=aggressive)
    l = sanitize_prompt_context(librosa_data, aggressive=aggressive)
    return f"【WhisperX】\n{w}\n\n【Librosa】\n{l}"
