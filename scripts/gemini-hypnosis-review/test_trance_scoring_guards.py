"""trance_scoring_guards の回帰テスト（acceptance 過大の再発防止）。"""
from __future__ import annotations

import unittest

from trance_scoring_guards import (
    REWARD_PRIMARY_COMPOSITE_MAX_STRICT,
    apply_trance_scoring_guards,
    cap_pleasure_for_trance,
)

OLD_ACCEPTANCE_INFLATED = """
## トランス度: 8.6
### トランスレーン: acceptance（受容・支配型）
| 次元 | スコア | 根拠 |
| 入り | 9.0 | 身を任せて |
| 深さ | 7.0 | 本編の大半が性的興奮の指摘と命令、RPに割かれているため、変性意識としての多段深化は読み取れない。 |
| 暗示の効き | 9.5 | イッていいよ等の命令 |
| 維持 | 8.5 | 二声が続く |
### 最終トランス度: 8.6 / 10.0
"""


class TranceScoringGuardsTest(unittest.TestCase):
    def test_reward_primary_acceptance_capped_to_absent_band(self) -> None:
        result = apply_trance_scoring_guards(OLD_ACCEPTANCE_INFLATED)
        self.assertTrue(result.applied)
        self.assertEqual(result.lane, "minimal")
        self.assertIsNotNone(result.score)
        assert result.score is not None
        self.assertLessEqual(result.score, REWARD_PRIMARY_COMPOSITE_MAX_STRICT)
        self.assertLessEqual(result.score, 2.0)
        self.assertLessEqual(result.dimensions.get("深さ", 10), 1.0)
        self.assertLessEqual(result.dimensions.get("暗示の効き", 10), 1.0)
        self.assertLessEqual(result.dimensions.get("維持", 10), 1.0)

    def test_pleasure_cap_for_very_low_trance(self) -> None:
        self.assertEqual(cap_pleasure_for_trance(9.2, 0.8), 4.3)
        self.assertEqual(cap_pleasure_for_trance(6.0, 8.0), 6.0)

    def test_reward_primary_with_hypno_tech_not_capped_to_two(self) -> None:
        """生放送型: 深化技法あり＋快楽移行は 2.0 に落とさない。"""
        eval_text = """
## トランス度: 7.0
### トランスレーン: minimal（薄い催眠型）
| 次元 | スコア | 根拠 |
| 入り | 6.0 | ラジオ導入 |
| 深さ | 4.5 | カウントダウンと呼吸誘導はあるが、その後の展開が刺激追求に移行するため、深さの持続性は限定的。 |
| 暗示の効き | 7.0 | 無意識への働きかけ |
| 維持 | 5.5 | セルフ指示以降は興奮維持 |
### 最終トランス度: 7.0 / 10.0
"""
        result = apply_trance_scoring_guards(eval_text)
        self.assertIsNotNone(result.score)
        assert result.score is not None
        self.assertGreaterEqual(result.score, 5.5)
        self.assertGreater(result.score, 2.0)


if __name__ == "__main__":
    unittest.main()
