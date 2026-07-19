"""
トランス度の過大採点を抑える後処理（再発防止）。

典型パターン: acceptance レーン＋「深さは浅い／RP・報酬が主」と自認しつつ
入り・暗示の効き・維持を高く付け、エロ命令の刺さりを催眠暗示と混同する。

要素欠如帯（eval_trance_rubric.md §要素欠如時）… 該当次元は 0.0〜1.0。

再発防止（2026-07・mesugaki 耳責め催眠）:
- 「限定的」「浅い」など**評価文の一言**だけで作品を薄い催眠と判定しない。
- 催眠は物語の積み重ね。カウント・感覚転移・無意識誘導などが根拠にあれば、
  後半が快楽パートでも sensory / acceptance を minimal へ潰さない。
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

# 強い欠如シグナルのみ（「限定的」「浅い」単体は禁止・物語の注釈で誤爆する）
REWARD_PRIMARY_DEPTH = re.compile(
    r"報酬.*主|RP.*主|ロールプレイ.*主|性的興奮.*主|エロ報酬|"
    r"快感命令.*主|本能.*主|支配.*主|"
    r"多段深化.*(ない|読み取れない|欠如)|"
    r"往復.*(ない|読み取れない|欠如)|"
    r"夢混線.*(ない|読み取れない|欠如)|"
    r"変性意識.*(読み取れない|ほぼなく|ほとんどない|欠如)|"
    r"(読み取れない|ほぼなく|ほとんどない).{0,12}(変性意識|多段深化)|"
    r"RPに割|本編の大半が性的|エロ命令のみ|催眠体裁のみ",
    re.I,
)

# 手続きとして使われた催眠技法（肯定根拠）
HYPNOTIC_DEPTH_TECHNIQUES = re.compile(
    r"カウント(?:ダウン|アップ)|10\s*(?:から|→|〜|～|-).{0,12}0|"
    r"再深化|無意識|変性意識|半覚醒|夢混線|現実混線|"
    r"コンフュージョン|意識と無意識|深い催眠|もっと深く|θ帯|多段深化|"
    r"一気に深い|さらに深い催眠|深化へと入り|催眠状態のまま|"
    r"感覚転移|性感帯化|脱力誘導|深呼吸",
    re.I,
)

# 技法が「無い」と明示されている場合のみ（単語「限定的」は含めない）
HYPNOTIC_TECHNIQUE_ABSENT = re.compile(
    r"(変性意識|多段深化|夢混線|半覚醒|再深化|カウント(?:ダウン)?|無意識).{0,24}"
    r"(読み取れない|ほぼなく|ほとんどない|ないため|欠如|無い|ない)|"
    r"(読み取れない|ほぼなく|ほとんどない|欠如).{0,24}"
    r"(変性意識|多段深化|夢混線|半覚醒|再深化)",
    re.I,
)

LANES_RECLASSIFY_TO_MINIMAL = frozenset({"acceptance", "deepening", "trigger", "sensory"})


def has_hypnotic_depth_techniques(eval_text: str) -> bool:
    """
    評価文全体で催眠技法の**肯定的な手続き根拠**があるか。
    「深さは限定的」などの注釈があっても、カウント等の積み重ねがあれば True。
    「変性意識は読み取れない」など欠如明示の中の語は肯定根拠に数えない。
    """
    # 欠如フレーズを除いたうえで肯定技法を探す（否定文中の語の誤カウント防止）
    cleaned = HYPNOTIC_TECHNIQUE_ABSENT.sub(" ", eval_text)
    if not HYPNOTIC_DEPTH_TECHNIQUES.search(cleaned):
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
    """
    本当に「催眠の積み重ねがなく報酬・RPだけ」かの検出。
    評価文の「限定的」一言では True にしない。
    """
    depth_r = extract_table_row_rationale(eval_text, "深さ")
    if not REWARD_PRIMARY_DEPTH.search(depth_r) and not REWARD_PRIMARY_DEPTH.search(
        eval_text
    ):
        return False

    # 催眠技法の物語的積み重ねがあるなら、薄い催眠扱いにしない
    if has_hypnotic_depth_techniques(eval_text):
        return False

    # 深さ点が高くても、技法欠如／RP主が明示されていれば候補のまま
    # （点だけ高く根拠が「読み取れない」の矛盾を拾う）
    return bool(REWARD_PRIMARY_DEPTH.search(depth_r) or REWARD_PRIMARY_DEPTH.search(eval_text))


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
    has_hypno_tech = has_hypnotic_depth_techniques(eval_text)
    depth_r = extract_table_row_rationale(eval_text, "深さ")
    reward_primary = detect_reward_primary_thin_hypnosis(eval_text, dims)
    weights = TRANCE_LANE_WEIGHTS[original_lane]
    base_score = compute_weighted_score(dims, weights)

    # sensory / acceptance で技法の積み重ねがある作品はレーン維持（耳責め催眠の誤爆防止）
    if has_hypno_tech and original_lane in ("sensory", "acceptance", "deepening", "trigger"):
        return TranceGuardResult(
            score=base_score,
            lane=original_lane,
            dimensions=dims,
            guard_notes=(
                [
                    "催眠技法の積み重ねありのため minimal 潰しをスキップ"
                    + ("（reward_primary 文言は注釈扱い）" if reward_primary else "")
                ]
                if reward_primary or "限定的" in depth_r or "浅い" in depth_r
                else []
            ),
            applied=bool(reward_primary or "限定的" in depth_r or "浅い" in depth_r),
        )

    if not reward_primary:
        return TranceGuardResult(
            score=base_score,
            lane=original_lane,
            dimensions=dims,
        )

    # ここから先は「技法なし＋報酬主」の薄い催眠のみ
    notes: list[str] = []
    lane = "minimal"
    if original_lane != "minimal":
        notes.append(f"レーン {original_lane}→minimal（報酬・RP主・催眠技法なし）")

    new_dims = _apply_absent_element_caps(
        dims,
        has_hypno_tech=False,
        depth_r=depth_r,
        notes=notes,
    )

    score = compute_weighted_score(new_dims, TRANCE_LANE_WEIGHTS[lane])

    if score is not None:
        capped = min(score, REWARD_PRIMARY_COMPOSITE_MAX_STRICT)
        if capped < score:
            notes.append(
                f"合成 {score}→{capped}（報酬主・要素欠如帯の合成上限）"
            )
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


def detect_score_cascade_anomaly(
    trance: float | None,
    pleasure: float | None,
    rating: float | None = None,
) -> list[str]:
    """
    高トランスなのに快楽・星だけ極端に低い＝ガード連鎖の疑い。
    auto_review / 人手再採点の監査用。
    """
    warnings: list[str] = []
    if trance is None or pleasure is None:
        return warnings
    if trance >= 7.5 and pleasure <= 3.5:
        warnings.append(
            f"異常: トランス{trance:.1f}なのに快楽{pleasure:.1f}。"
            " ガード誤爆またはトランスありきの過剰圧縮を疑う。"
        )
    if rating is not None and trance >= 7.5 and rating <= 5:
        warnings.append(
            f"異常: トランス{trance:.1f}なのに総合★{rating:.0f}。"
            " 採点連鎖の再確認が必要。"
        )
    return warnings
