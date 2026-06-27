"""Golden tests against example CSVs with known official costs."""

from __future__ import annotations

import unittest
from pathlib import Path

import csv

from cursor_usage.calculator import _parse_int, _row_cost, analyze_csv
from cursor_usage.pricing import (
    BILLABLE_KIND,
    FREE_KIND,
    is_billable_kind,
    is_free_kind,
    normalize_kind,
    parse_max_mode,
)
from cursor_usage.reconcile import ROW_TOLERANCE_USD, reconcile_csv

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"
JANUARY_CSV = EXAMPLES / "January - US$1.61.csv"
FEBRUARY_CSV = EXAMPLES / "February - US$46.57.csv"
MARCH_CSV = EXAMPLES / "March - US$69.94.csv"
APRIL_CSV = EXAMPLES / "April - US$137.09.csv"
MAY_CSV = EXAMPLES / "May - US$92.01.csv"
JUNE_CSV = EXAMPLES / "June - US$137.62.csv"
CYCLE_CSV = EXAMPLES / "May 27 - Jun 27 US$191.60 100% + 100%.csv"

# Official dashboard Total spend (filename amounts).
JANUARY_OFFICIAL_TOTAL = 1.61
FEBRUARY_OFFICIAL_TOTAL = 46.57
MARCH_OFFICIAL_TOTAL = 69.94
APRIL_OFFICIAL_TOTAL = 137.09
MAY_OFFICIAL_TOTAL = 92.01
JUNE_OFFICIAL_TOTAL = 137.62
CYCLE_OFFICIAL_TOTAL = 191.60
# Max relative gap vs official after adding Feb-discovered models (Jun 2026 calibration).
MARCH_TOTAL_TOLERANCE_PCT = 0.012
APRIL_TOTAL_TOLERANCE_PCT = 0.016
MAY_TOTAL_TOLERANCE_PCT = 0.007
JUNE_TOTAL_TOLERANCE_PCT = 0.016
# Billing cycle: ~2.4% gap vs official Total; cause unknown (docs/spec.md §8.4).
CYCLE_TOTAL_TOLERANCE_PCT = 0.025

# Dashboard 按模型日合计（composer-2.5-fast，June CSV）。
COMPOSER_25_FAST_DAILY_OFFICIAL = {
    "2026-06-22": 2.15,
    "2026-06-23": 1.96,
    "2026-06-24": 10.32,
    "2026-06-25": 23.61,
}
COMPOSER_25_FAST_DAILY_TOLERANCE = 0.15

# Dashboard auto 日合计（5/30–6/1 日级异常见 spec §8.3；以下为可对齐日）。
CYCLE_AUTO_DAILY_OFFICIAL = {
    "2026-05-28": 5.10,
    "2026-05-29": 13.69,
    "2026-06-02": 13.23,
    "2026-06-03": 12.68,
    "2026-06-04": 0.11,
    "2026-06-05": 0.31,
    "2026-06-06": 0.30,
}
CYCLE_AUTO_DAILY_TOLERANCE = 0.02


def _daily_model_cost(csv_path: Path, model: str, day: str) -> float:
    total = 0.0
    with csv_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("Model") != model or (row.get("Date") or "")[:10] != day:
                continue
            if not is_billable_kind(normalize_kind(row.get("Kind", ""))):
                continue
            total += _row_cost(
                model,
                _parse_int(row.get("Input (w/ Cache Write)")),
                _parse_int(row.get("Input (w/o Cache Write)")),
                _parse_int(row.get("Cache Read")),
                _parse_int(row.get("Output Tokens")),
                max_mode=parse_max_mode(row.get("Max Mode")),
            )
    return total


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
        self.assertEqual(report.skipped_rows, {})
        # Cost 列有美元金额时以标注价为准（合计 $1.60）
        self.assertAlmostEqual(report.free_cost, 1.60, places=2)
        self.assertEqual(report.by_model["auto"].free_rows, 6)
        self.assertEqual(report.by_model["agent_review"].free_rows, 2)
        self.assertGreater(report.total_tokens, 0)
        self.assertEqual(report.by_model["auto"].free_tokens, report.total_tokens - report.by_model["agent_review"].free_tokens)

    def test_total_aligns_with_official(self) -> None:
        report = analyze_csv(JANUARY_CSV)
        self.assertAlmostEqual(
            report.total_cost_with_free,
            JANUARY_OFFICIAL_TOTAL,
            delta=0.15,
        )

    def test_reconcile_auto_rows_within_tolerance(self) -> None:
        result = reconcile_csv(JANUARY_CSV)
        self.assertTrue(result.has_official_costs)
        self.assertEqual(result.official_rows, 8)
        auto_mismatches = [
            r for r in result.mismatch_rows if r.model == "auto"
        ]
        self.assertEqual(auto_mismatches, [])
        self.assertAlmostEqual(result.official_total, 1.60, places=2)

    def test_auto_rows_match_official(self) -> None:
        result = reconcile_csv(JANUARY_CSV)
        auto_rows = [r for r in result.rows if r.model == "auto" and r.official_cost > 0]
        self.assertEqual(len(auto_rows), 6)
        for row in auto_rows:
            with self.subTest(date=row.date, official=row.official_cost):
                self.assertLessEqual(abs(row.delta), ROW_TOLERANCE_USD)

    def test_agent_review_shows_possible_discount(self) -> None:
        result = reconcile_csv(JANUARY_CSV)
        bugbot = [r for r in result.rows if r.model == "agent_review" and r.official_cost > 0]
        self.assertEqual(len(bugbot), 1)
        self.assertAlmostEqual(bugbot[0].official_cost, 0.21, places=2)
        self.assertTrue(bugbot[0].possible_discount)
        self.assertGreater(bugbot[0].calculated_cost, bugbot[0].official_cost)


class TestMaxModePricing(unittest.TestCase):
    def test_parse_max_mode(self) -> None:
        self.assertTrue(parse_max_mode("Yes"))
        self.assertFalse(parse_max_mode("No"))
        self.assertFalse(parse_max_mode(""))

    def test_codex_max_mode_doubles_all_tokens(self) -> None:
        base = _row_cost("gpt-5.3-codex", 0, 100_000, 200_000, 1_000)
        fast = _row_cost("gpt-5.3-codex", 0, 100_000, 200_000, 1_000, max_mode=True)
        self.assertAlmostEqual(fast, base * 2, places=6)

    def test_gpt55_long_context_only_when_max_mode_and_over_threshold(self) -> None:
        icw, icwo, cr, out = 0, 100_000, 100_000, 1_000
        base = _row_cost("gpt-5.5-medium", icw, icwo, cr, out)
        self.assertAlmostEqual(
            _row_cost("gpt-5.5-medium", icw, icwo, cr, out, max_mode=True),
            base,
        )
        icw, icwo, cr, out = 0, 50_000, 250_000, 1_000
        base = _row_cost("gpt-5.5-medium", icw, icwo, cr, out)
        self.assertAlmostEqual(
            _row_cost("gpt-5.5-medium", icw, icwo, cr, out, max_mode=False),
            base,
        )
        long_ctx = _row_cost("gpt-5.5-medium", icw, icwo, cr, out, max_mode=True)
        self.assertGreater(long_ctx, base)

    def test_may_2_gpt55_matches_official_without_cliff(self) -> None:
        """Max Mode=No rows stay at standard rate even when input > 272k."""
        total = 0.0
        with MAY_CSV.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("Model") != "gpt-5.5-medium":
                    continue
                if (row.get("Date") or "")[:10] != "2026-05-02":
                    continue
                if not is_billable_kind(normalize_kind(row.get("Kind", ""))):
                    continue
                total += _row_cost(
                    "gpt-5.5-medium",
                    _parse_int(row.get("Input (w/ Cache Write)")),
                    _parse_int(row.get("Input (w/o Cache Write)")),
                    _parse_int(row.get("Cache Read")),
                    _parse_int(row.get("Output Tokens")),
                    max_mode=parse_max_mode(row.get("Max Mode")),
                )
        self.assertAlmostEqual(total, 15.67, delta=0.01)


class TestFebruaryGolden(unittest.TestCase):
    def test_all_models_recognized(self) -> None:
        report = analyze_csv(FEBRUARY_CSV)
        self.assertEqual(report.unknown_models, {})
        self.assertEqual(report.billable_rows, 455)
        self.assertEqual(report.total_rows, 455)

    def test_total_reflects_codex_max_mode_2x(self) -> None:
        report = analyze_csv(FEBRUARY_CSV)
        # 9 行 Max Mode=Yes（gpt-5.3-codex）按文档 ×2；当月官方 Total 仍按旧口径。
        self.assertAlmostEqual(report.total_cost, 48.04, delta=0.05)
        gap = FEBRUARY_OFFICIAL_TOTAL - report.total_cost
        self.assertLess(gap, 0.0)

    def test_by_model_breakdown(self) -> None:
        report = analyze_csv(FEBRUARY_CSV)
        self.assertAlmostEqual(report.by_model["auto"].cost, 24.75, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.2-codex"].cost, 7.74, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.3-codex"].cost, 10.97, delta=0.05)
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
        self.assertAlmostEqual(report.total_cost, 67.74, delta=0.05)
        self.assertAlmostEqual(report.free_cost, 3.05, delta=0.02)
        self.assertNotIn(FREE_KIND, report.skipped_rows)
        self.assertEqual(report.skipped_rows.get("Errored, No Charge"), 13)
        self.assertGreater(report.by_model["auto"].free_rows, 0)

    def test_by_model_breakdown(self) -> None:
        report = analyze_csv(MARCH_CSV)
        self.assertAlmostEqual(report.by_model["auto"].cost, 38.54, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.4-medium"].cost, 17.77, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.2"].cost, 6.20, delta=0.05)
        self.assertAlmostEqual(report.by_model["composer-2-fast"].cost, 0.67, delta=0.02)
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
        self.assertAlmostEqual(report.total_cost, 139.26, delta=0.05)

    def test_by_model_breakdown(self) -> None:
        report = analyze_csv(APRIL_CSV)
        self.assertAlmostEqual(report.by_model["auto"].cost, 87.58, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.4-medium"].cost, 43.49, delta=0.05)
        self.assertAlmostEqual(report.by_model["gpt-5.5-medium"].cost, 4.95, delta=0.02)
        self.assertAlmostEqual(report.by_model["composer-2-fast"].cost, 1.24, delta=0.02)
        self.assertAlmostEqual(report.by_model["composer-2"].cost, 0.73, delta=0.02)
        self.assertAlmostEqual(
            report.by_model["claude-opus-4-7-thinking-high"].cost, 1.28, delta=0.02
        )
        self.assertEqual(report.by_model["gpt-5.5-medium"].rows, 10)
        self.assertEqual(report.by_model["composer-2"].rows, 5)


class TestMayJuneGolden(unittest.TestCase):
    def test_may_status_only_free_rows_do_not_count(self) -> None:
        report = analyze_csv(MAY_CSV)
        self.assertEqual(report.billable_rows, 638)
        self.assertEqual(report.free_rows, 106)
        self.assertAlmostEqual(report.total_cost, 89.40, delta=0.05)
        # 仅统计 Cost 列有美元金额的 Free 行。
        self.assertAlmostEqual(report.free_cost, 2.05, delta=0.02)
        self.assertAlmostEqual(report.total_cost_with_free, 91.45, delta=0.05)
        self.assertLess(
            abs(report.total_cost_with_free - MAY_OFFICIAL_TOTAL) / MAY_OFFICIAL_TOTAL,
            MAY_TOTAL_TOLERANCE_PCT,
        )

    def test_june_status_only_free_rows_are_zero_cost(self) -> None:
        report = analyze_csv(JUNE_CSV)
        self.assertEqual(report.free_rows, 24)
        self.assertAlmostEqual(report.total_cost, 139.81, delta=0.05)
        self.assertEqual(report.free_cost, 0.0)
        self.assertAlmostEqual(report.total_cost_with_free, 139.81, delta=0.05)
        self.assertLess(
            abs(report.total_cost - JUNE_OFFICIAL_TOTAL) / JUNE_OFFICIAL_TOTAL,
            JUNE_TOTAL_TOLERANCE_PCT,
        )

    def test_strict_mode_counts_status_only_free_rows(self) -> None:
        may_report = analyze_csv(MAY_CSV, free_pricing_mode="strict")
        self.assertAlmostEqual(may_report.free_cost, 9.06, delta=0.02)
        self.assertAlmostEqual(may_report.total_cost_with_free, 98.46, delta=0.05)

        june_report = analyze_csv(JUNE_CSV, free_pricing_mode="strict")
        self.assertAlmostEqual(june_report.free_cost, 11.50, delta=0.02)
        self.assertAlmostEqual(june_report.total_cost_with_free, 151.31, delta=0.05)

    def test_composer_25_fast_daily_vs_official(self) -> None:
        official_total = sum(COMPOSER_25_FAST_DAILY_OFFICIAL.values())
        calc_total = 0.0
        for day, official in COMPOSER_25_FAST_DAILY_OFFICIAL.items():
            calc = _daily_model_cost(JUNE_CSV, "composer-2.5-fast", day)
            calc_total += calc
            with self.subTest(day=day):
                self.assertAlmostEqual(
                    calc,
                    official,
                    delta=COMPOSER_25_FAST_DAILY_TOLERANCE,
                )
        self.assertAlmostEqual(calc_total, official_total, delta=0.20)


class TestBillingCycleGolden(unittest.TestCase):
    """账单周期样例回归（docs/spec.md §8.3–8.4）。

    目的：
    - 解析与模型覆盖（不因 Total 偏差未明而省略）
    - 钉住文档费率推算值 $187.08（非拟合官方 $191.60）
    - 验证周期 CSV 与月度样例的结构一致性
    - 仅对「已与 Dashboard 对齐」的 auto 日级做 golden（刻意不测 5/30–6/1）

    周期 Total 与官方差 $4.52 的原因未明；测试不断言与官方相等，只断言推算值稳定且在记录容差内。
    """

    def test_all_models_recognized(self) -> None:
        report = analyze_csv(CYCLE_CSV)
        self.assertEqual(report.unknown_models, {})
        self.assertEqual(report.billable_rows, 1034)
        self.assertEqual(report.free_rows, 98)

    def test_total_within_official_tolerance(self) -> None:
        report = analyze_csv(CYCLE_CSV)
        gap = report.total_cost - CYCLE_OFFICIAL_TOTAL
        self.assertLess(gap, 0.0)
        self.assertLess(
            abs(gap) / CYCLE_OFFICIAL_TOTAL,
            CYCLE_TOTAL_TOLERANCE_PCT,
        )
        self.assertAlmostEqual(report.total_cost, 187.08, delta=0.05)
        self.assertEqual(report.free_cost, 0.0)

    def test_june_segment_matches_june_csv(self) -> None:
        cycle = analyze_csv(CYCLE_CSV)
        june = analyze_csv(JUNE_CSV)
        self.assertAlmostEqual(cycle.total_cost, 47.26 + june.total_cost, delta=0.05)

    def test_auto_daily_stable_days_vs_official(self) -> None:
        for day, official in CYCLE_AUTO_DAILY_OFFICIAL.items():
            calc = _daily_model_cost(CYCLE_CSV, "auto", day)
            with self.subTest(day=day):
                self.assertAlmostEqual(
                    calc,
                    official,
                    delta=CYCLE_AUTO_DAILY_TOLERANCE,
                )

if __name__ == "__main__":
    unittest.main()
