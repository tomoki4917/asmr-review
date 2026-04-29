# -*- coding: utf-8 -*-
"""
解析フォルダ（SRT + waveform.csv）から、レビュー用の自動補助データを生成する。

出力先: src/content/レビュー/<slug>/
  - derived_metrics.json
  - sections.auto.json
  - events.auto.json
  - （任意）_分析データ.json の notes に自動補助根拠を差し込み

例:
  py -3 scripts/analyze_review_auto.py "C:\\path\\to\\解析後\\作品フォルダ" futarigake-saimin-love-happy-orgasm
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from statistics import mean, pstdev

ROOT = Path(__file__).resolve().parent.parent
REVIEW_ROOT = ROOT / "src" / "content" / "レビュー"


def _pctl(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    arr = sorted(values)
    k = (len(arr) - 1) * p
    i = int(k)
    j = min(i + 1, len(arr) - 1)
    frac = k - i
    return arr[i] * (1 - frac) + arr[j] * frac


def _pick_source_files(source_dir: Path) -> tuple[list[Path], list[Path]]:
    wave_candidates = sorted(source_dir.glob("*_waveform.csv"))
    srt_candidates = sorted(source_dir.glob("*.srt"))
    if not wave_candidates or not srt_candidates:
        raise FileNotFoundError("waveform.csv または .srt が見つかりません。")
    return wave_candidates, srt_candidates


def _read_wave_metrics(wave_csv: Path) -> tuple[list[float], list[float]]:
    rms: list[float] = []
    centroid: list[float] = []
    with wave_csv.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rms.append(float(row["amplitude_rms"]))
            centroid.append(float(row["frequency_centroid_hz"]))
    return rms, centroid


def _read_srt_entries(srt_path: Path) -> list[tuple[float, float, str]]:
    text = srt_path.read_text(encoding="utf-8")
    blocks = [b.strip().splitlines() for b in re.split(r"\n\s*\n", text.strip())]
    entries: list[tuple[float, float, str]] = []
    for b in blocks:
        if len(b) < 3 or "-->" not in b[1]:
            continue
        m = re.match(
            r"(\d\d):(\d\d):(\d\d),(\d\d\d)\s+-->\s+(\d\d):(\d\d):(\d\d),(\d\d\d)",
            b[1],
        )
        if not m:
            continue
        st = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3)) + int(m.group(4)) / 1000
        en = int(m.group(5)) * 3600 + int(m.group(6)) * 60 + int(m.group(7)) + int(m.group(8)) / 1000
        tx = " ".join(b[2:]).strip()
        entries.append((st, en, tx))
    return entries


def _first_time(entries: list[tuple[float, float, str]], needle: str) -> float | None:
    for st, _, tx in entries:
        if needle in tx:
            return st
    return None


def _build_events(entries: list[tuple[float, float, str]]) -> list[dict]:
    pat_count = [
        re.compile(r"3\s*[、,・]?\s*2\s*[、,・]?\s*1"),
        re.compile(r"10\s*から\s*0"),
        re.compile(r"数えて"),
    ]
    pat_trigger = [
        re.compile(r"可愛い"),
        re.compile(r"泣"),
        re.compile(r"行け"),
        re.compile(r"気持ちよく"),
        re.compile(r"暗示"),
    ]
    pat_release = [
        re.compile(r"解除"),
        re.compile(r"目を覚ま"),
        re.compile(r"戻って"),
        re.compile(r"おはよう"),
    ]
    events: list[dict] = []
    for st, _, tx in entries:
        event_type = None
        if any(p.search(tx) for p in pat_release):
            event_type = "release"
        elif any(p.search(tx) for p in pat_count):
            event_type = "countdown"
        elif any(p.search(tx) for p in pat_trigger):
            event_type = "trigger"
        if event_type:
            events.append({"t": round(st, 3), "type": event_type, "text": tx[:140]})
    return events


def _build_sections(entries: list[tuple[float, float, str]], duration: float) -> list[dict]:
    t_intro = 0.0
    t_deepen = _first_time(entries, "暗示を入れていきますね") or _first_time(entries, "暗示を入れていきます") or 300.0
    t_pleasure = _first_time(entries, "完全に犬になってみましょう") or 650.0
    t_release = _first_time(entries, "それじゃあ解除していく") or _first_time(entries, "解除していく") or max(duration - 160, 0)
    s1_end = max(t_deepen, t_intro)
    s2_end = max(t_pleasure, s1_end)
    s3_end = max(t_release, s2_end)
    return [
        {"name": "導入", "start": round(t_intro, 3), "end": round(s1_end, 3), "confidence": 0.83},
        {"name": "深化", "start": round(s1_end, 3), "end": round(s2_end, 3), "confidence": 0.76},
        {"name": "快楽", "start": round(s2_end, 3), "end": round(s3_end, 3), "confidence": 0.79},
        {"name": "解除", "start": round(s3_end, 3), "end": round(duration, 3), "confidence": 0.90},
    ]


def _update_analysis_notes(review_dir: Path, metrics: dict, sections: list[dict]) -> None:
    analysis_path = review_dir / "_分析データ.json"
    if not analysis_path.exists():
        return
    obj = json.loads(analysis_path.read_text(encoding="utf-8"))
    notes = obj.get("notes")
    if not isinstance(notes, list):
        return
    notes = [n for n in notes if not (isinstance(n, str) and n.startswith("【自動補助根拠】"))]
    notes.extend(
        [
            (
                f"【自動補助根拠】derived_metrics.json: duration={metrics['duration_sec']}s / "
                f"rms_mean={metrics['rms_mean']} / silence_ratio={metrics['silence_ratio_rms_lt_0_002']} / "
                f"surge_events_per_min={metrics['surge_events_per_min_rms_gt_p95']}。"
            ),
            (
                "【自動補助根拠】keyword_counts: "
                f"可愛い={metrics['keyword_counts']['可愛い']}, ワン={metrics['keyword_counts']['ワン']}, "
                f"行け={metrics['keyword_counts']['行け']}, 泣={metrics['keyword_counts']['泣']}。"
                "event_counts: "
                f"countdown={metrics['event_counts']['countdown']}, "
                f"trigger={metrics['event_counts']['trigger']}, "
                f"release={metrics['event_counts']['release']}。"
            ),
            (
                "【自動補助根拠】sections.auto.json: "
                + " / ".join(f"{s['name']}{s['start']}-{s['end']}" for s in sections)
                + "。"
            ),
        ]
    )
    obj["notes"] = notes
    analysis_path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def analyze(source_dir: Path, slug: str, update_notes: bool) -> int:
    review_dir = REVIEW_ROOT / slug
    review_dir.mkdir(parents=True, exist_ok=True)

    wave_files, srt_files = _pick_source_files(source_dir)
    rms: list[float] = []
    centroid: list[float] = []
    for wf in wave_files:
        r, c = _read_wave_metrics(wf)
        rms.extend(r)
        centroid.extend(c)

    # 複数トラックはファイル名順で連結し、時刻を加算して単一タイムライン化する
    entries: list[tuple[float, float, str]] = []
    offset = 0.0
    for sf in srt_files:
        part = _read_srt_entries(sf)
        if not part:
            continue
        entries.extend([(st + offset, en + offset, tx) for st, en, tx in part])
        offset += max(en for _, en, _ in part)

    duration = max((e[1] for e in entries), default=0.0)
    all_text = " ".join(t for _, _, t in entries)
    keyword_counts = {
        "可愛い": all_text.count("可愛い"),
        "泣": all_text.count("泣"),
        "気持ちいい": all_text.count("気持ちいい"),
        "暗示": all_text.count("暗示"),
        "解除": all_text.count("解除"),
        "ワン": all_text.count("ワン"),
        "行け": all_text.count("行け"),
        "お仕置き": all_text.count("お仕置き"),
    }
    p95 = _pctl(rms, 0.95)
    events = _build_events(entries)
    sections = _build_sections(entries, duration)
    metrics = {
        "version": "v0.1-auto",
        "source": {
            "waveforms": [p.name for p in wave_files],
            "srts": [p.name for p in srt_files],
        },
        "duration_sec": round(duration, 3),
        "rms_mean": round(mean(rms), 8),
        "rms_std": round(pstdev(rms), 8),
        "rms_p95": round(p95, 8),
        "centroid_mean_hz": round(mean(centroid), 3),
        "centroid_std_hz": round(pstdev(centroid), 3),
        "silence_ratio_rms_lt_0_002": round(sum(1 for x in rms if x < 0.002) / len(rms), 4),
        "surge_events_per_min_rms_gt_p95": round((sum(1 for x in rms if x > p95) / (duration / 60)) if duration else 0, 3),
        "keyword_counts": keyword_counts,
        "keyword_density_per_min": {
            k: round(v / (duration / 60), 3) if duration else 0 for k, v in keyword_counts.items()
        },
        "event_counts": {
            "countdown": sum(1 for e in events if e["type"] == "countdown"),
            "trigger": sum(1 for e in events if e["type"] == "trigger"),
            "release": sum(1 for e in events if e["type"] == "release"),
        },
    }

    (review_dir / "derived_metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (review_dir / "sections.auto.json").write_text(json.dumps(sections, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (review_dir / "events.auto.json").write_text(json.dumps(events, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if update_notes:
        _update_analysis_notes(review_dir, metrics, sections)

    print(f"generated: {review_dir / 'derived_metrics.json'}")
    print(f"generated: {review_dir / 'sections.auto.json'}")
    print(f"generated: {review_dir / 'events.auto.json'}")
    if update_notes:
        print(f"updated:   {review_dir / '_分析データ.json'} (notes)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate auto review-analysis helper JSON files from analysis folder.")
    ap.add_argument("source", type=Path, help="解析フォルダ（*.srt, *_waveform.csv を含む）")
    ap.add_argument("slug", help="レビューの slug（src/content/レビュー/<slug>）")
    ap.add_argument("--no-update-notes", action="store_true", help="_分析データ.json の notes を更新しない")
    args = ap.parse_args()
    return analyze(args.source.resolve(), args.slug, update_notes=not args.no_update_notes)


if __name__ == "__main__":
    raise SystemExit(main())
