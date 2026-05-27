"""
レビュー用レーダー画像生成。
_分析データ.json を読み、review_triangle.png を出力する（各軸 10.0 満点）。

- schemaVersion 1 … 3軸（催眠／旧同人）
- schemaVersion 2 … 5軸（同人音声・没入度／シナリオ／快楽度／音響／満足度）
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

BG = "#121212"
NEON = "#00f2ff"
FILL = (0, 242 / 255, 1.0, 0.3)
GRID = "#3a3a3a"
LABEL_COLOR = "#ffffff"


def format_axis_score(val: float) -> str:
    """レーダー・グラフ評価内訳用。必ず小数点を含む（7 → 7.0、7.25 → 7.25、9.7 → 9.7）。"""
    v = float(val)
    text = f"{v:.2f}".rstrip("0").rstrip(".")
    if "." not in text:
        text = f"{v:.1f}"
    return text

# v1 三軸: 上=第1軸、右下=第2軸、左下=第3軸（label_specs と radii の順を一致させる）
THETA_TRI = np.array([np.pi / 2, 11 * np.pi / 6, 7 * np.pi / 6, np.pi / 2])

# v2 R18同人: 没入度→シナリオ→快楽度→音響→満足度
DOUJIN_AXIS_KEYS_PLEASURE = ("immersion", "scenario", "pleasure", "acoustic", "satisfaction")
# v2 全年齢同人: 第4軸は入眠・覚醒（scores.sleepWake）
DOUJIN_AXIS_KEYS_SLEEP_WAKE = ("immersion", "scenario", "sleepWake", "acoustic", "satisfaction")
DOUJIN_AXIS_DEFAULT_LABELS = {
    "immersion": "没入度",
    "scenario": "シナリオ",
    "pleasure": "快楽度",
    "sleepWake": "睡眠・覚醒",
    "acoustic": "音響",
    "satisfaction": "満足度",
}


def resolve_doujin_axis_keys(scores: dict) -> tuple[str, ...]:
    if "sleepWake" in scores:
        return DOUJIN_AXIS_KEYS_SLEEP_WAKE
    return DOUJIN_AXIS_KEYS_PLEASURE


def _setup_font() -> None:
    plt.rcParams.update(
        {
            "font.family": "sans-serif",
            "font.sans-serif": [
                "Yu Gothic UI",
                "Yu Gothic",
                "Meiryo",
                "MS Gothic",
                "Hiragino Sans",
                "sans-serif",
            ],
        }
    )


def load_v1(json_path: Path) -> tuple[str, float, float, float, str, str, str]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1:
        raise ValueError(f"expected schemaVersion 1: {json_path}")

    work_name = str(data.get("workName", "")).strip()
    scores = data.get("scores")
    if not isinstance(scores, dict):
        raise ValueError(f"missing scores object: {json_path}")

    try:
        trans = float(scores["trance"])
        pleasure = float(scores["pleasure"])
        satisfaction = float(scores["satisfaction"])
    except (KeyError, TypeError, ValueError) as e:
        raise ValueError(f"scores.trance/pleasure/satisfaction must be numbers: {json_path}") from e

    third_label = str(data.get("thirdAxisLabel") or "").strip() or "満足度"
    radar = data.get("radarAxisLabels")
    if isinstance(radar, dict):
        lab1 = str(radar.get("first") or "").strip() or "トランス度"
        lab2 = str(radar.get("second") or "").strip() or "快楽度"
        lab3 = str(radar.get("third") or "").strip() or third_label
    else:
        lab1, lab2, lab3 = "トランス度", "快楽度", third_label

    return work_name, trans, pleasure, satisfaction, lab1, lab2, lab3


def load_v2(json_path: Path) -> tuple[str, list[tuple[str, float]]]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 2:
        raise ValueError(f"expected schemaVersion 2: {json_path}")

    work_name = str(data.get("workName", "")).strip()
    scores = data.get("scores")
    if not isinstance(scores, dict):
        raise ValueError(f"missing scores object: {json_path}")

    radar = data.get("radarAxisLabels") if isinstance(data.get("radarAxisLabels"), dict) else {}
    axis_keys = resolve_doujin_axis_keys(scores)
    axes: list[tuple[str, float]] = []
    for key in axis_keys:
        try:
            val = float(np.clip(float(scores[key]), 0.0, 10.0))
        except (KeyError, TypeError, ValueError) as e:
            raise ValueError(f"scores.{key} must be a number: {json_path}") from e
        label = str(radar.get(key) or "").strip() or DOUJIN_AXIS_DEFAULT_LABELS[key]
        axes.append((label, val))
    return work_name, axes


def _draw_polar(fig_h: float, ax: plt.Axes, theta: np.ndarray, radii: np.ndarray, labels: list[tuple[str, float]]) -> None:
    r_max = 10.0
    ax.set_rlim(0, r_max)
    ax.set_rticks([2, 4, 6, 8, 10])
    ax.set_yticklabels([])
    ax.grid(True, color=GRID, linestyle="-", linewidth=0.6, alpha=0.85)
    ax.set_thetagrids([])

    ax.plot(theta, radii, color=NEON, linewidth=3.2, antialiased=True, zorder=3)
    ax.fill(theta, radii, color=FILL, zorder=2)

    for ang, (lab, val) in zip(theta[:-1], labels):
        ax.text(
            ang,
            r_max * 1.22,
            f"{lab}\n{format_axis_score(val)}",
            ha="center",
            va="center",
            color=LABEL_COLOR,
            fontsize=12 if len(labels) > 3 else 13,
            fontweight="bold",
            linespacing=1.25,
        )


def render_triangle(out_path: Path, trans: float, body: float, third: float, lab1: str, lab2: str, lab3: str) -> None:
    r_max = 10.0
    trans = float(np.clip(trans, 0.0, r_max))
    body = float(np.clip(body, 0.0, r_max))
    third = float(np.clip(third, 0.0, r_max))
    # THETA_TRI と同順: 上=lab1、右下=lab2、左下=lab3
    r_ccw = np.array([trans, body, third, trans])
    axis_labels = [(lab1, trans), (lab2, body), (lab3, third)]

    _setup_font()
    fig = plt.figure(figsize=(10.0, 16.0), dpi=150, facecolor=BG)
    fig.subplots_adjust(left=0.1, right=0.9, top=0.9, bottom=0.1)
    ax = fig.add_subplot(111, projection="polar", facecolor=BG)
    ax.set_facecolor(BG)

    _draw_polar(16.0, ax, THETA_TRI, r_ccw, axis_labels)
    fig.savefig(out_path, facecolor=BG, edgecolor="none", bbox_inches="tight")
    plt.close(fig)


def render_pentagon(out_path: Path, axes: list[tuple[str, float]]) -> None:
    n = len(axes)
    angles = [np.pi / 2 - (2 * np.pi * i / n) for i in range(n)]
    values = [v for _, v in axes]
    theta = np.array(angles + [angles[0]])
    radii = np.array(values + [values[0]])

    _setup_font()
    fig = plt.figure(figsize=(10.0, 16.0), dpi=150, facecolor=BG)
    fig.subplots_adjust(left=0.08, right=0.92, top=0.92, bottom=0.08)
    ax = fig.add_subplot(111, projection="polar", facecolor=BG)
    ax.set_facecolor(BG)
    _draw_polar(16.0, ax, theta, radii, axes)
    fig.savefig(out_path, facecolor=BG, edgecolor="none", bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    slug = sys.argv[1] if len(sys.argv) > 1 else "kyoku-mugen-zekkyou-count-chikuni"
    data_path = root / "src" / "content" / "レビュー" / slug / "_分析データ.json"
    out_path = data_path.parent / "review_triangle.png"

    if not data_path.is_file():
        print(
            f"Missing {data_path}\n"
            "分析データは _分析データ.json に置いてください。",
            file=sys.stderr,
        )
        sys.exit(1)

    data = json.loads(data_path.read_text(encoding="utf-8"))
    version = data.get("schemaVersion", 1)

    if version == 2:
        _, axes = load_v2(data_path)
        render_pentagon(out_path, axes)
    elif version == 1:
        _, trans, body, third, lab1, lab2, lab3 = load_v1(data_path)
        render_triangle(out_path, trans, body, third, lab1, lab2, lab3)
    else:
        print(f"unsupported schemaVersion {version} in {data_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
