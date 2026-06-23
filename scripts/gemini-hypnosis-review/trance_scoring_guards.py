"""
トランス度の過大採点を抑える後処理（再発防止）。

典型パターン: acceptance レーン＋「深さは浅い／RP・報酬が主」と自認しつつ
入り・暗示の効き・維持を高く付け、エロ命令の刺さりを催眠暗示と混同する。

要素欠如帯（eval_trance_rubric.md §要素欠如時）… 該当次元は 0.0〜1.0。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

TRANCE_LANE_WEIGHTS: dict[str, list[tuple[str, float]]] = {
    "deepening": [("入り", 0.20), ("深さ", 0.35), ("暗示の効き", 0.20), ("維持", 0.25)],
    "acceptance": [("入り", 0.25), ("深さ", 0.20), ("暗示の効き", 0.30), ("維持", 0.25)],
    "sensory": [("入り", 0.25), ("深さ", 0.15), ("暗示の効き", 0.30), ("維持", 0.30)],
    "trigger": [("入り", 0.20), ("深さ", 0.20), ("暗示の効き", 0.35), ("維持", 0.25)],
    "minimal": [("入り", 0.25), ("深さ", 0.25), ("暗示の効き", 0.25), ("維持", 0.25)],
}

TRANCE_DIM_LABELS = ["入り", "深さ", "暗示の効き", "維持"]

# 要素欠如帯（eval_trance_rubric.md §要素欠如時）
ABSENT_ELEMENT_MAX = 1.0
FRAGMENT_ENTRY_MAX = 2.0
REWARD_PRIMARY_COMPOSITE_MAX = 2.0
REWARD_PRIMARY_COMPOSITE_MAX_STRICT = 1.5

REWARD_PRIMARY_DEPTH = re.compile(
    r"報酬|RP|ロールプレイ|性的興奮|性的実行|淫語|エロ報酬|快感命令|"
    r"本能.*主|支配.*主|限定的|浅い|多段深化.*(ない|弱|限|読み取れない)|"
    r"往復.*(ない|弱|限)|夢混線.*(ない|弱|限)|深化.*浅|報酬側|頭側飽和|"
    r"性的興奮.*命令|RPに割|ほぼなく|ほとんどない",
    re.I,
)

HYPNOTIC_DEPTH_TECHNIQUES = re.compile(
    r"カウント(?:ダウン|アップ)|再深化|無意識|変性意識|半覚醒|夢混線|現実混線|"
    r"コンフュージョン|意識と無意識|深い催眠|もっと深く|θ帯|多段深化|"
    r"一気に深い|さらに深い催眠|深化へと入り|催眠状態のまま",
    re.I,
)

HYPNOTIC_TECHNIQUE_NEGATED = re.compile(
    r"(変性意識|多段深化|夢混線|半覚醒|再深化|無意識).{0,24}"
    r"(読み取れない|限定的|ほぼなく|ほとんどない|ないため|欠如|薄い)|"
    r"(読み取れない|限定的|ほぼなく|ほとんどない).{0,24}"
    r"(変性意識|多段深化|夢混線|半覚醒|再深化)",
    re.I,
)

LANES_RECLASSIFY_TO_MINIMAL = frozenset({"acceptance", "deepening", "trigger", "sensory"})


def has_hypnotic_depth_techniques(eval_text: str) -> bool:
    if not HYPNOTIC_DEPTH_TECHNIQUES.search(eval_text):
        return False
    if HYPNOTIC_TECHNIQUE_NEGATED.search(eval_text):
        return False
    return True


@dataclass
class TranceGuardResult:
    score: float | None
    lane: str
    dimensions: dict[str, float]
    guard_notes: list[str] = field(default_factory=list)
    applied: bool = False


def extract_dimension_scores(eval_text: str, labels: list[str]) -> dict[str, float]:
    scores: dict[str, float] = {}
    for label in labels:
        m = re.search(
            rf"\|\s*{re.escape(label)}\s*\|\s*(\d+(?:\.\d+)?)\s*\|",
            eval_text,
        )
        if m:
            scores[label] = float(m.group(1))
    return scores


def extract_table_row_rationale(eval_text: str, label: str) -> str:
    m = re.search(
        rf"\|\s*{re.escape(label)}\s*\|\s*\d+(?:\.\d+)?\s*\|\s*(.+?)\s*\|",
        eval_text,
    )
    return m.group(1) if m else ""


def extract_trance_lane_id(eval_text: str) -> str:
    m = re.search(r"トランスレーン[：:]\s*(\w+)", eval_text, re.I)
    if m:
        key = m.group(1).lower()
        if key in TRANCE_LANE_WEIGHTS:
            return key
    lane_labels = {
        "deepening": "深化型",
        "acceptance": "受容・支配型",
        "sensory": "感覚・ASMR型",
        "trigger": "トリガー型",
        "minimal": "薄い催眠型",
    }
    for key, label in lane_labels.items():
        if label in eval_text:
            return key
    return "minimal"


def compute_weighted_score(
    dimensions: dict[str, float],
    weights: list[tuple[str, float]],
) -> float | None:
    if any(label not in dimensions for label, _ in weights):
        return None
    total = sum(dimensions[label] * weight for label, weight in weights)
    return round(total, 1)


def detect_reward_primary_thin_hypnosis(
    eval_text: str,
    dims: dict[str, float],
) -> bool:
    depth_r = extract_table_row_rationale(eval_text, "深さ")
    if REWARD_PRIMARY_DEPTH.search(depth_r):
        return True
    depth = dims.get("深さ")
    if depth is not None and depth <= 7.0:
        if REWARD_PRIMARY_DEPTH.search(eval_text) and (
            "限定的" in depth_r or "報酬" in depth_r or "RP" in depth_r
        ):
            return True
    return False


def _apply_absent_element_caps(
    dims: dict[str, float],
    *,
    has_hypno_tech: bool,
    depth_r: str,
    notes: list[str],
) -> dict[str, float]:
    """報酬主・薄い催眠: 要素欠如次元は 0〜1、入り断片のみ 2 以下。"""
    out = dict(dims)

    if not has_hypno_tech:
        if out.get("深さ", 10) > ABSENT_ELEMENT_MAX:
            out["深さ"] = ABSENT_ELEMENT_MAX
            notes.append(f"深さ→{ABSENT_ELEMENT_MAX}（深化要素なし・0〜1帯）")
        if "読み取れない" in depth_r or "ほぼなく" in depth_r:
            out["深さ"] = min(out.get("深さ", 1.0), 0.5)
            notes.append("深さ→0.5（変性意識の作劇が読み取れない）")

        if out.get("暗示の効き", 10) > ABSENT_ELEMENT_MAX:
            out["暗示の効き"] = ABSENT_ELEMENT_MAX
            notes.append(
                f"暗示の効き→{ABSENT_ELEMENT_MAX}（催眠暗示なし・エロ命令は快楽軸）"
            )

        if out.get("維持", 10) > ABSENT_ELEMENT_MAX:
            out["維持"] = ABSENT_ELEMENT_MAX
            notes.append(f"維持→{ABSENT_ELEMENT_MAX}（トランス維持なし・興奮維持のみ）")

    if out.get("入り", 10) > FRAGMENT_ENTRY_MAX:
        out["入り"] = FRAGMENT_ENTRY_MAX
        notes.append(f"入り→{FRAGMENT_ENTRY_MAX}（断片的入口のみ・深化に未接続）")

    return out


def apply_trance_scoring_guards(eval_text: str) -> TranceGuardResult:
    """次元表が揃っている eval のみ補正。それ以外はそのまま。"""
    dims = extract_dimension_scores(eval_text, TRANCE_DIM_LABELS)
    if len(dims) < 4:
        return TranceGuardResult(
            score=None,
            lane=extract_trance_lane_id(eval_text),
            dimensions=dims,
        )

    original_lane = extract_trance_lane_id(eval_text)
    reward_primary = detect_reward_primary_thin_hypnosis(eval_text, dims)
    has_hypno_tech = has_hypnotic_depth_techniques(eval_text)
    depth_r = extract_table_row_rationale(eval_text, "深さ")

    if not reward_primary:
        weights = TRANCE_LANE_WEIGHTS[original_lane]
        return TranceGuardResult(
            score=compute_weighted_score(dims, weights),
            lane=original_lane,
            dimensions=dims,
        )

    # カウントダウン・呼吸・無意識等が eval 根拠にある作品は、
    # 「快楽パートへ移行する」だけで 2.0 上限に落とさない（生放送型古典誘導の誤判定防止）。
    if has_hypno_tech:
        weights = TRANCE_LANE_WEIGHTS[original_lane]
        return TranceGuardResult(
            score=compute_weighted_score(dims, weights),
            lane=original_lane,
            dimensions=dims,
            guard_notes=(
                ["reward_primary 判定だが深化技法ありのため 2.0 上限ガードをスキップ"]
                if reward_primary
                else []
            ),
            applied=reward_primary,
        )

    notes: list[str] = []
    lane = "minimal"
    if original_lane != "minimal":
        notes.append(f"レーン {original_lane}→minimal（報酬・RP主）")

    new_dims = _apply_absent_element_caps(
        dims,
        has_hypno_tech=has_hypno_tech,
        depth_r=depth_r,
        notes=notes,
    )

    weights = TRANCE_LANE_WEIGHTS[lane]
    score = compute_weighted_score(new_dims, weights)

    if score is not None:
        cap = REWARD_PRIMARY_COMPOSITE_MAX
        if not has_hypno_tech:
            cap = min(cap, REWARD_PRIMARY_COMPOSITE_MAX_STRICT)
        capped = min(score, cap)
        if capped < score:
            notes.append(f"合成 {score}→{capped}（報酬主・要素欠如帯の合成上限）")
        score = capped

    return TranceGuardResult(
        score=score,
        lane=lane,
        dimensions=new_dims,
        guard_notes=notes,
        applied=True,
    )


def cap_pleasure_for_trance(pleasure: float | None, trance: float | None) -> float | None:
    """トランスありき: 低トランス作品の快楽度上限。"""
    if pleasure is None or trance is None:
        return pleasure
    if trance < 2.0:
        return min(pleasure, round(trance + 3.5, 1))
    if trance < 4.0:
        return min(pleasure, round(trance + 4.0, 1))
    if trance < 5.5:
        return min(pleasure, round(trance + 4.5, 1))
    if trance < 7.0:
        return min(pleasure, round(trance + 3.5, 1))
    return pleasure
