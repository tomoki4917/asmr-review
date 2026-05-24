# -*- coding: utf-8 -*-
"""
解析フォルダ内の各 MP3 / WAV から、約 0.1 秒刻みのフレームで
  - 左右チャンネルの RMS とその差（定位の材料）
  - 合成モノラルに対するスペクトル重心（既存 waveform.csv の centroid と同系）
  - 高域（4 kHz 以上）エネルギー比（囁き・息多めの「質感」材料の一例）
  - 低域（100–250 Hz）エネルギー比（近接効果・低音ボイス密着の材料）
を算出し、レビュー slug 直下に spatial_spectral.auto.json を書く。

前提: pip install -r scripts/requirements-audio.txt（MP3 は ffmpeg 等が PATH にあることが多い。WAV は librosa のみで可。librosa 依存）

例:
  py -3 scripts/analyze_mp3_immersive_metrics.py "C:\\Users\\tomok\\Desktop\\解析後\\投稿完了【同人】\\作品フォルダ" michikusa-natsuna4-onsen-pokipoki-seitai
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from statistics import mean, pstdev

ROOT = Path(__file__).resolve().parent.parent
REVIEW_ROOT = ROOT / "src" / "content" / "レビュー"

_AUDIO_SUFFIXES = frozenset({".mp3", ".MP3", ".wav", ".WAV"})


def _require_librosa():
    try:
        import librosa  # noqa: F401
        import numpy as np  # noqa: F401
    except ImportError as e:
        print(
            "エラー: librosa / numpy が未インストールです。\n"
            "  py -3 -m pip install -r scripts/requirements-audio.txt\n"
            "（MP3 には ffmpeg 等が PATH に必要な場合があります。WAV は通常不要）",
            file=sys.stderr,
        )
        raise SystemExit(1) from e


def _analyze_one(path: Path, hop_sec: float) -> dict:
    import librosa
    import numpy as np

    y, sr = librosa.load(path.as_posix(), sr=None, mono=False)
    if y.ndim == 1:
        y = np.stack([y, y], axis=0)
    elif y.shape[0] == 1:
        y = np.concatenate([y, y], axis=0)
    hop = max(1, int(round(float(sr) * hop_sec)))
    n = y.shape[1]
    pad = (hop - n % hop) % hop
    if pad:
        y = np.pad(y, ((0, 0), (0, pad)))
    n_frames = y.shape[1] // hop
    if n_frames == 0:
        return {
            "file": path.name,
            "duration_sec": round(float(n) / sr, 3),
            "mono": True,
            "hop_sec": hop_sec,
            "frames": 0,
            "error": "signal_too_short",
        }

    frames = y[:, : n_frames * hop].reshape(2, n_frames, hop)
    rms = np.sqrt(np.mean(frames**2, axis=2) + 1e-18)
    L, R = rms[0], rms[1]
    pan = (L - R) / (L + R + 1e-12)
    mid = (y[0] + y[1]) / 2.0
    n_fft = min(2048, max(256, hop * 2))
    cent = librosa.feature.spectral_centroid(y=mid, sr=sr, hop_length=hop, n_fft=n_fft, center=False)[0]
    S = np.abs(librosa.stft(mid, hop_length=hop, n_fft=n_fft, center=False))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    total = S.sum(axis=0) + 1e-12
    hf = S[freqs >= 4000.0, :].sum(axis=0) / total
    lf = S[(freqs >= 100.0) & (freqs <= 250.0), :].sum(axis=0) / total
    m = min(len(pan), len(cent), len(hf), len(lf))
    pan = pan[:m]
    cent = cent[:m]
    hf = hf[:m]
    lf = lf[:m]

    return {
        "file": path.name,
        "duration_sec": round(float(n) / sr, 3),
        "mono": bool(np.allclose(y[0], y[1], rtol=1e-5, atol=1e-6)),
        "hop_sec": hop_sec,
        "frames": int(m),
        "pan_linear_mean": float(np.mean(pan)),
        "pan_linear_std": float(np.std(pan)),
        "pan_linear_mean_abs": float(np.mean(np.abs(pan))),
        "centroid_hz_mean": float(np.mean(cent)),
        "centroid_hz_std": float(np.std(cent)),
        "hf_ratio_ge_4khz_mean": float(np.mean(hf)),
        "hf_ratio_ge_4khz_std": float(np.std(hf)),
        "lf_ratio_100_250hz_mean": float(np.mean(lf)),
        "lf_ratio_100_250hz_std": float(np.std(lf)),
    }


def analyze(source_dir: Path, slug: str, hop_sec: float) -> int:
    _require_librosa()
    source_dir = source_dir.resolve()
    audio_files = sorted([p for p in source_dir.iterdir() if p.suffix in _AUDIO_SUFFIXES])
    if not audio_files:
        print(f"エラー: {source_dir} に .mp3 または .wav がありません。", file=sys.stderr)
        return 1

    review_dir = REVIEW_ROOT / slug
    review_dir.mkdir(parents=True, exist_ok=True)

    tracks: list[dict] = []
    for p in audio_files:
        tracks.append(_analyze_one(p, hop_sec=hop_sec))

    def _agg(key: str) -> float | None:
        vals = [t[key] for t in tracks if key in t and isinstance(t[key], (int, float))]
        if not vals:
            return None
        return round(float(mean(vals)), 8)

    agg = {
        "tracks_n": len(tracks),
        "total_duration_sec": round(sum(t.get("duration_sec", 0) or 0 for t in tracks), 3),
        "pan_linear_mean_abs_mean": _agg("pan_linear_mean_abs"),
        "pan_linear_std_mean": _agg("pan_linear_std"),
        "centroid_hz_mean_of_track_means": _agg("centroid_hz_mean"),
        "hf_ratio_ge_4khz_mean_of_track_means": _agg("hf_ratio_ge_4khz_mean"),
        "lf_ratio_100_250hz_mean_of_track_means": _agg("lf_ratio_100_250hz_mean"),
    }
    cstds = [t["centroid_hz_std"] for t in tracks if "centroid_hz_std" in t and isinstance(t["centroid_hz_std"], (int, float))]
    if cstds:
        agg["centroid_hz_std_pooled"] = round(float(pstdev(cstds)) if len(cstds) > 1 else float(cstds[0]), 6)

    out = {
        "schemaVersion": 1,
        "hop_sec": hop_sec,
        "source_dir": str(source_dir),
        "tracks": tracks,
        "aggregate": agg,
        "usage_note": (
            "定位の材料: pan_linear_mean_abs / pan_linear_std が大きいほど左右差の揺れが多い傾向。"
            "質感の材料: centroid / hf_ratio_ge_4khz は高域・息成分の目安。"
            "lf_ratio_100_250hz は近接効果・低音ボイス密着の目安（HF だけでは距離感を過小評価しうる）。"
        ),
    }
    dest = review_dir / "spatial_spectral.auto.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"written: {dest}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(
        description="MP3 / WAV から 0.1s 前後のフレームで左右 RMS 差・スペクトル特徴を抽出し spatial_spectral.auto.json を書く。"
    )
    ap.add_argument("source", type=Path, help="解析フォルダ（.mp3 または .wav を含む）")
    ap.add_argument("slug", help="レビュー slug（src/content/レビュー/<slug>/ へ出力）")
    ap.add_argument(
        "--hop-sec",
        type=float,
        default=0.1,
        help="フレーム間隔（秒）。既定 0.1",
    )
    args = ap.parse_args()
    return analyze(args.source.resolve(), args.slug, hop_sec=float(args.hop_sec))


if __name__ == "__main__":
    raise SystemExit(main())
