"""
既存の _分析データ.txt を _分析データ.json に移行する（一回限りの補助）。
移行後は generate_review_triangle.py は JSON のみを読む。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

THIRD_AXIS_KEYS = ("ストーリー性", "満足度", "充実度")


def parse_txt(txt_path: Path) -> dict:
    text = txt_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    notes: list[str] = []
    work_name = ""
    trance: float | None = None
    pleasure: float | None = None
    satisfaction: float | None = None
    third_axis_label: str | None = None
    orgasm_summary: str | None = None

    def one_key(key: str, val: str) -> float:
        return float(val.strip())

    for raw in lines:
        line = raw.rstrip("\r")
        stripped = line.strip()
        if stripped.startswith("#"):
            body = stripped[1:].lstrip()
            if body:
                notes.append(body)
            if "絶頂目安" in body:
                orgasm_summary = body
            continue
        if ":" not in stripped:
            continue
        key, _, rest = stripped.partition(":")
        key = key.strip()
        val = rest.strip()
        if key == "作品名":
            work_name = val
        elif key == "トランス度":
            trance = one_key(key, val)
        elif key == "快楽度":
            pleasure = one_key(key, val)
        elif key in THIRD_AXIS_KEYS:
            satisfaction = one_key(key, val)
            third_axis_label = key

    if not work_name or trance is None or pleasure is None or satisfaction is None:
        raise ValueError(f"必須フィールド不足: {txt_path}")

    out: dict = {
        "schemaVersion": 1,
        "workName": work_name,
        "scores": {
            "trance": trance,
            "pleasure": pleasure,
            "satisfaction": satisfaction,
        },
    }
    if third_axis_label and third_axis_label != "満足度":
        out["thirdAxisLabel"] = third_axis_label
    if orgasm_summary:
        out["orgasmSummary"] = orgasm_summary
    if notes:
        out["notes"] = notes
    return out


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    review_dir = root / "src" / "content" / "レビュー"
    delete_txt = "--delete-txt" in sys.argv

    paths = sorted(review_dir.glob("*/_分析データ.txt"))
    if not paths:
        print("No _分析データ.txt found", file=sys.stderr)
        sys.exit(1)

    for txt_path in paths:
        data = parse_txt(txt_path)
        json_path = txt_path.with_name("_分析データ.json")
        json_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote {json_path}")
        if delete_txt:
            txt_path.unlink()
            print(f"Deleted {txt_path}")


if __name__ == "__main__":
    main()
