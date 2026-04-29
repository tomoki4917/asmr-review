# -*- coding: utf-8 -*-
"""解析後\\投稿完了 の各フォルダから自動補助 JSON を生成する（記事本文は変更しない）。"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTED = Path(r"c:\Users\tomok\Desktop\解析後\投稿完了")
SCRIPT = ROOT / "scripts" / "analyze_review_auto.py"

# フォルダ名（投稿完了直下）→ src/content/レビュー/<slug>
PAIRS: list[tuple[str, str]] = [
    ("Reリミットマリオネット", "re-limit-marionette"),
    ("⚠悪用厳禁⚠催眠心理テスト～彼女に絶対エロいことをシてはいけない～_本体", "saimin-shinri-test-dame-iwakareru"),
    ("【ASMR×催○音声】甘とろリップ", "asmr-saimin-aman-toro-lip"),
    ("【ASMR催眠音声】スライム娘のグチュクチュ失神オーガズム調教【耳穴責め・脳イキ】", "slime-musume-guchu-nouiki"),
    ("【催眠誘導】口腔催眠カウントトリップ【脳イキ音声】", "kuchikou-saimin-count-trip-nouiki"),
    ("【催眠誘導】私と子作りしてください♡一夜限りの濃蜜孕ませ植物SEX種孕【連続∞メスイキ】", "kurayami-kodzukuri-noumitsu-shokubutsu-mesuiki"),
    ("【催眠音声】脳イキ妖狐～悦楽至極の脳耳絶頂～", "nouiki-youko-noumimi"),
    ("ふたりがけ催眠メルティオーガズム編", "futarigake-saimin-melty-orgasm"),
    ("ふたりがけ催眠ラブハピオーガズム編", "futarigake-saimin-love-happy-orgasm"),
    ("アンノウンヒプノ ～大丈夫、私の声に委ねて～", "unknown-hypno-daijobu-koe-ni-yudanete"),
    ("アンリアルヒプノ", "unreal-hypno"),
    ("スキスキ刷り込み♡ちゅーどくおなにー催眠", "sukisuki-surikomi-chudoku-onanie-saimin"),
    ("ノーハンド射精魔法少女", "nohand-shasei-mahou-shoujo-mesuiki"),
    ("ヒプノマルチレイプ", "hypno-multi-rape"),
    ("天使と悪魔の相反催眠", "tenshi-akuma-souhan-saimin"),
    ("極_無限絶頂カウントチクニー", "kyoku-mugen-zekkyou-count-chikuni"),
    ("魔法少女は敗北しない", "ts-mahou-shoujo-haiboku-shinai"),
    ("【犬化暗示】あまあまタイムだと思ってたらおしおき脳イキで徹底わからせ", "inuka-anji-amatime-oshioki-wakarase"),
]


def main() -> int:
    exe = sys.executable
    for folder, slug in PAIRS:
        src = POSTED / folder
        if not src.is_dir():
            print(f"SKIP missing: {folder}", file=sys.stderr)
            continue
        if not list(src.glob("*_waveform.csv")) or not list(src.glob("*.srt")):
            print(f"SKIP no waveform/srt: {folder}", file=sys.stderr)
            continue
        print(f"=== {slug}")
        subprocess.run([exe, str(SCRIPT), str(src), slug], cwd=str(ROOT), check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
