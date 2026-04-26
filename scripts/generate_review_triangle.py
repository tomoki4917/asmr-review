"""
「催眠音声レビュー室」アイアン・トライアングル（3軸レーダー）生成。
_分析データ.json を読み、review_triangle.png を出力する。
各軸は 10.0 満点。

軸配置（上から時計回り）: 12時=トランス度, 4時=快楽度, 8時=第三軸
第三軸のラベル: JSON の thirdAxisLabel、省略時は「満足度」
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

# matplotlib 既定: 0 ラジアン=右(3時)、反時計回りが正
# 12時=π/2, 4時=11π/6(-30°), 8時=7π/6(210°)
# 反時計回りの周回順: π/2 → 7π/6 → 11π/6 → π/2（12→8→4）
THETA_CCW = np.array([np.pi / 2, 7 * np.pi / 6, 11 * np.pi / 6, np.pi / 2])


def load_scores(json_path: Path) -> tuple[str, float, float, float, str]:
    raw = json_path.read_text(encoding="utf-8")
    data = json.loads(raw)

    if data.get("schemaVersion") != 1:
        raise ValueError(f"unsupported schemaVersion in {json_path}")

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

    third_label = data.get("thirdAxisLabel")
    if third_label is not None and str(third_label).strip():
        third_label = str(third_label).strip()
    else:
        third_label = "満足度"

    return (work_name, trans, pleasure, satisfaction, third_label)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    slug = sys.argv[1] if len(sys.argv) > 1 else "kyoku-mugen-zekkyou-count-chikuni"
    data_path = root / "src" / "content" / "レビュー" / slug / "_分析データ.json"
    out_path = data_path.parent / "review_triangle.png"

    if not data_path.is_file():
        print(
            f"Missing {data_path}\n"
            "分析データは _分析データ.json に置いてください（docs/schemas/review-analysis.v1.schema.json 参照）。",
            file=sys.stderr,
        )
        sys.exit(1)

    _, trans, body, third, third_label = load_scores(data_path)
    r_max = 10.0
    trans = float(np.clip(trans, 0.0, r_max))
    body = float(np.clip(body, 0.0, r_max))
    third = float(np.clip(third, 0.0, r_max))

    # 12→8→4 の反時計回りで閉じる（第三軸は 8 時位置）
    r_ccw = np.array([trans, third, body, trans])

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

    # 16:10 縦型（幅:高さ = 10:16）
    fig_w, fig_h = 10.0, 16.0
    fig = plt.figure(figsize=(fig_w, fig_h), dpi=150, facecolor=BG)
    fig.subplots_adjust(left=0.1, right=0.9, top=0.9, bottom=0.1)

    ax = fig.add_subplot(111, projection="polar", facecolor=BG)
    ax.set_facecolor(BG)

    ax.set_rlim(0, r_max)
    ax.set_rticks([2, 4, 6, 8, 10])
    ax.set_yticklabels([])
    ax.grid(True, color=GRID, linestyle="-", linewidth=0.6, alpha=0.85)
    ax.set_thetagrids([])

    ax.plot(
        THETA_CCW,
        r_ccw,
        color=NEON,
        linewidth=3.2,
        antialiased=True,
        zorder=3,
    )
    ax.fill(THETA_CCW, r_ccw, color=FILL, zorder=2)

    # ラベル（12 / 4 / 8 の位置）
    label_specs = [
        (np.pi / 2, "トランス度", trans),
        (11 * np.pi / 6, "快楽度", body),
        (7 * np.pi / 6, third_label, third),
    ]
    for ang, lab, val in label_specs:
        ax.text(
            ang,
            r_max * 1.2,
            f"{lab}\n{val:.1f}",
            ha="center",
            va="center",
            color=LABEL_COLOR,
            fontsize=13,
            fontweight="bold",
            linespacing=1.25,
        )

    fig.savefig(out_path, facecolor=BG, edgecolor="none", bbox_inches="tight")
    plt.close(fig)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
