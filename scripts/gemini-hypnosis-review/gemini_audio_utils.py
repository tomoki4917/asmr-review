"""Gemini 音声 API 用の共通ユーティリティ。"""
from __future__ import annotations

import subprocess
import time
from pathlib import Path

from google.genai import types

SKIP_STEM_FRAGMENTS = ("_waveform",)


def safety_settings() -> list[types.SafetySetting]:
    cats = (
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    )
    return [types.SafetySetting(category=c, threshold="BLOCK_NONE") for c in cats]


def is_analysis_audio(path: Path) -> bool:
    if not path.is_file():
        return False
    stem = path.stem.lower()
    return path.suffix.lower() in {".wav", ".mp3"} and not any(
        frag in stem for frag in SKIP_STEM_FRAGMENTS
    )


def collect_audio_tracks(analysis_dir: Path) -> list[tuple[Path, str]]:
    """解析フォルダ内の音声をトラック順に列挙。同一 stem は WAV 優先。"""
    picked: dict[str, Path] = {}
    order: list[str] = []

    for path in sorted(analysis_dir.rglob("*")):
        if not is_analysis_audio(path):
            continue
        stem = path.stem
        ext = path.suffix.lower()
        if stem in picked:
            if ext == ".wav" and picked[stem].suffix.lower() == ".mp3":
                picked[stem] = path
            continue
        picked[stem] = path
        order.append(stem)

    return [(picked[stem], stem) for stem in order if stem in picked]


def convert_to_upload_mp3(source: Path, dest: Path) -> Path:
    """アップロード用 16kHz mono 64kbps MP3。"""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file() and dest.stat().st_mtime >= source.stat().st_mtime:
        return dest
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-b:a",
            "64k",
            str(dest),
        ],
        check=True,
    )
    return dest


def upload_files(client, paths: list[Path]) -> list:
    uploaded = []
    for p in paths:
        print(f"[アップロード] {p.name} ({p.stat().st_size / 1e6:.1f} MB)")
        f = client.files.upload(file=str(p))
        uploaded.append(f)
    for i, f in enumerate(uploaded):
        while f.state and f.state.name == "PROCESSING":
            time.sleep(3)
            f = client.files.get(name=f.name)
            uploaded[i] = f
        if f.state and f.state.name != "ACTIVE":
            raise RuntimeError(f"アップロード失敗: {f.name} state={f.state.name}")
    return uploaded
