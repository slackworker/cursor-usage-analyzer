"""Golden tests against example CSVs with known official costs."""

from __future__ import annotations

import unittest
from pathlib import Path

from cursor_usage.calculator import analyze_csv
from cursor_usage.pricing import (
    BILLABLE_KIND,
    FREE_KIND,
    is_billable_kind,
    is_free_kind,
    normalize_kind,
)
from cursor_usage.reconcile import ROW_TOLERANCE_USD, reconcile_csv

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"
JANUARY_CSV = EXAMPLES / "January - US$1.61.csv"
FEBRUARY_CSV = EXAMPLES / "February - US$46.57.csv"
MARCH_CSV = EXAMPLES / "March - US$69.94.csv"
APRIL_CSV = EXAMPLES / "April - US$137.09.csv"

# Official dashboard Total spend (filename amounts).
JANUARY_OFFICIAL_TOTAL = 1.61
FEBRUARY_OFFICIAL_TOTAL = 46.57
MARCH_OFFICIAL_TOTAL = 69.94
APRIL_OFFICIAL_TOTAL = 137.09
# Max relative gap vs official after adding Feb-discovered models (Jun 2026 calibration).
FEBRUARY_TOTAL_TOLERANCE_PCT = 0.01
MARCH_TOTAL_TOLERANCE_PCT = 0.005
APRIL_TOTAL_TOLERANCE_PCT = 0.015


class TestKindNormalization(unittest.TestCase):
    def test_free_case_insensitive(self) -> None:
        self.assertEqual(normalize_kind("free"), FREE_KIND)
        self.assertEqual(normalize_kind("Free"), FREE_KIND)
        self.assertTrue(is_free_kind("free"))

    def test_included_case_insensitive(self) -> None:
        self.assertEqual(normalize_kind("included"), BILLABLE_KIND)
        self.assertTrue(is_billable_kind("Included"))


class TestJanuaryGolden(unittest.TestCase):
    def test_analyze_picks_up_lowercase_free_rows(self) -> None:
        report = analyze_csv(JANUARY_CSV)
        self.assertEqual(report.billable_rows, 0)
        self.assertEqual(report.free_rows, 8)
        self.assertAlmostEqual(report.free_cost, 1.5868, places=2)

    def test_total_aligns_with_official(self) -> None:
        report = analyze_csv(JANUARY_CSV)
        self.assertAlmostEqual(
            report.total_cost_with_free,
            JANUARY_OFFICIAL_TOTAL,
            delta=0.03,
        )

    def test_reconcile_all_rows_within_tolerance(self) -> None:
        result = reconcile_csv(JANUARY_CSV)
        self.assertTrue(result.has_official_costs)
        self.assertEqual(result.official_rows, 8)
        self.assertEqual(len(result.mismatch_rows), 0)
        self.assertAlmostEqual(result.official_total, 1.60, places=2)

    def test_auto_rows_match_official(self) -> None:
        result = reconcile_csv(JANUARY_CSV)
        auto_rows = [r for r in result.rows if r.model == "auto" and r.official_cost > 0]
        self.assertEqual(len(auto_rows), 6)
        for row in auto_rows:
            with self.subTest(date=row.date, official=row.official_cost):
                self.assertLessEqual(abs(row.delta), ROW_TOLERANCE_USD)

    def test_agent_review_matches_official(self) -> None:
        result = reconcile_csv(JANUARY_CSV)
        bugbot = [r for r in result.rows if r.model == "agent_review" and r.official_cost > 0]
        self.assertEqual(len(bugbot), 1)
        self.assertAlmostEqual(bugbot[0].official_cost, 0.21, places=2)
        self.assertLessEqual(abs(bugbot[0].delta), ROW_TOLERANCE_USD)


class TestFebruaryGolden(unittest.TestCase):
    def test_all_models_recognized(self) -> None:
        report = analyze_csv(FEBRUARY_CSV)
        self.assertEqual(report.unknown_models, {})
        self.assertEqual(report.billable_rows, 455)
        self.assertEqual(report.total_rows, 455)

    def test_total_within_official_tolerance(self) -> None:
        report = analyze_csv(FEBRUARY_CSV)
        gap = FEBRUARY_OFFICIAL_TOTAL - report.total_cost
        self.assertGreater(gap, 0.0)
        self.assertLess(
            gap / FEBRUARY_OFFICIAL_TOTAL,
            FEBRUARY_TOTAL_TOLERANCE_PCT,
        )
        self.assertAlmostEqual(report.total_cost, 46.32, delta=0.05)

    def test_by_model_breakdown(self) -> None:
        report = analyze_csv(FEBRUARY_CSV)
        self.assertAlmostEqual(report.by_model["auto"].cost, 24.75, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.2-codex"].cost, 7.74, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.3-codex"].cost, 9.42, delta=0.05)
        self.assertEqual(report.by_model["gpt-5.2-codex"].rows, 58)
        self.assertEqual(report.by_model["claude-4.5-sonnet-thinking"].rows, 8)


class TestMarchGolden(unittest.TestCase):
    def test_all_models_recognized(self) -> None:
        report = analyze_csv(MARCH_CSV)
        self.assertEqual(report.unknown_models, {})
        self.assertEqual(report.billable_rows, 618)
        self.assertEqual(report.free_rows, 31)

    def test_total_within_official_tolerance(self) -> None:
        report = analyze_csv(MARCH_CSV)
        gap = report.total_cost_with_free - MARCH_OFFICIAL_TOTAL
        self.assertGreater(gap, -0.02)
        self.assertLess(
            abs(gap) / MARCH_OFFICIAL_TOTAL,
            MARCH_TOTAL_TOLERANCE_PCT,
        )
        self.assertAlmostEqual(report.total_cost, 67.05, delta=0.05)
        self.assertAlmostEqual(report.free_cost, 3.05, delta=0.02)

    def test_by_model_breakdown(self) -> None:
        report = analyze_csv(MARCH_CSV)
        self.assertAlmostEqual(report.by_model["auto"].cost, 38.54, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.4-medium"].cost, 17.77, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.2"].cost, 6.20, delta=0.05)
        self.assertAlmostEqual(report.by_model["composer-2-fast"].cost, 0.33, delta=0.02)
        self.assertEqual(report.by_model["gpt-5.4-medium"].rows, 93)


class TestAprilGolden(unittest.TestCase):
    def test_all_models_recognized(self) -> None:
        report = analyze_csv(APRIL_CSV)
        self.assertEqual(report.unknown_models, {})
        self.assertEqual(report.billable_rows, 1256)
        self.assertEqual(report.free_rows, 0)

    def test_total_within_official_tolerance(self) -> None:
        report = analyze_csv(APRIL_CSV)
        gap = report.total_cost - APRIL_OFFICIAL_TOTAL
        self.assertGreater(gap, -0.05)
        self.assertLess(
            abs(gap) / APRIL_OFFICIAL_TOTAL,
            APRIL_TOTAL_TOLERANCE_PCT,
        )
        self.assertAlmostEqual(report.total_cost, 138.49, delta=0.05)

    def test_by_model_breakdown(self) -> None:
        report = analyze_csv(APRIL_CSV)
        self.assertAlmostEqual(report.by_model["auto"].cost, 87.58, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.4-medium"].cost, 43.49, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.5-medium"].cost, 4.95, delta=0.02)
        self.assertAlmostEqual(report.by_model["composer-2-fast"].cost, 0.62, delta=0.02)
        self.assertAlmostEqual(report.by_model["composer-2"].cost, 0.73, delta=0.02)
        self.assertAlmostEqual(
            report.by_model["claude-opus-4-7-thinking-high"].cost, 1.12, delta=0.02
        )
        self.assertEqual(report.by_model["gpt-5.5-medium"].rows, 10)
        self.assertEqual(report.by_model["composer-2"].rows, 5)


if __name__ == "__main__":
    unittest.main()
