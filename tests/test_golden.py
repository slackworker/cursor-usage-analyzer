"""Regression tests: pricing rules + calibration examples."""

from __future__ import annotations

import csv
import unittest
from pathlib import Path

from cursor_usage.calculator import _parse_int, _row_cost, analyze_csv
from cursor_usage.pricing import (
    BILLABLE_KIND,
    FREE_KIND,
    FREE_STATUS_ONLY_SKIP,
    is_billable_kind,
    is_free_kind,
    normalize_kind,
    parse_max_mode,
)
from cursor_usage.reconcile import ROW_TOLERANCE_USD, reconcile_csv

from tests.calibration import (
    CALIBRATION_CASES,
    CASE_BY_NAME,
    DAILY_SPOTS,
    JANUARY,
    MAY,
    ModeExpect,
    example_path,
)


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


def _assert_mode(
    testcase: unittest.TestCase,
    path: Path,
    expect: ModeExpect,
    *,
    billing_mode: str | None = None,
) -> None:
    report = (
        analyze_csv(path, billing_mode=billing_mode)
        if billing_mode
        else analyze_csv(path)
    )
    spend = expect.total_spend if expect.total_spend is not None else expect.total_cost
    testcase.assertEqual(report.unknown_models, {})
    testcase.assertAlmostEqual(report.total_cost, expect.total_cost, delta=expect.total_delta)
    testcase.assertAlmostEqual(report.total_spend, spend, delta=expect.total_delta)
    if expect.free_cost:
        testcase.assertAlmostEqual(report.free_cost, expect.free_cost, delta=0.02)
    if expect.billable_rows is not None:
        testcase.assertEqual(report.billable_rows, expect.billable_rows)
    if expect.free_rows is not None:
        testcase.assertEqual(report.free_rows, expect.free_rows)
    if expect.status_only_skip is not None:
        testcase.assertEqual(
            report.skipped_rows.get(FREE_STATUS_ONLY_SKIP),
            expect.status_only_skip,
        )
    if expect.errored_skip is not None:
        testcase.assertEqual(
            report.skipped_rows.get("Errored, No Charge"),
            expect.errored_skip,
        )


class TestPricingRules(unittest.TestCase):
    def test_kind_normalization(self) -> None:
        self.assertEqual(normalize_kind("free"), FREE_KIND)
        self.assertEqual(normalize_kind("Free"), FREE_KIND)
        self.assertTrue(is_free_kind("free"))
        self.assertEqual(normalize_kind("included"), BILLABLE_KIND)
        self.assertTrue(is_billable_kind("Included"))

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

    def test_may_2_gpt55_standard_rate_without_cliff(self) -> None:
        """Max Mode=No stays at standard rate even when input > 272k."""
        total = 0.0
        with example_path(MAY.filename).open(newline="", encoding="utf-8") as f:
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


class TestCalibration(unittest.TestCase):
    def test_cases(self) -> None:
        for case in CALIBRATION_CASES:
            path = example_path(case.filename)
            with self.subTest(case=case.name):
                self.assertTrue(path.is_file(), f"missing calibration file: {path}")

                if case.official:
                    report = analyze_csv(path, billing_mode="official")
                    _assert_mode(self, path, case.official, billing_mode="official")
                    if case.official_tolerance_pct is not None:
                        gap = abs(report.total_cost - case.official_total) / case.official_total
                        self.assertLess(gap, case.official_tolerance_pct)

                if case.strict:
                    _assert_mode(self, path, case.strict)

                if case.calc_above_official and case.strict:
                    report = analyze_csv(path)
                    self.assertGreater(report.total_cost, case.official_total)

                if case.calc_below_official and case.official:
                    report = analyze_csv(path, billing_mode="official")
                    self.assertLess(report.total_cost, case.official_total)

                if case.segment_companion and case.segment_prefix_cost is not None:
                    companion = CASE_BY_NAME[case.segment_companion]
                    cycle = analyze_csv(path, billing_mode="official")
                    june = analyze_csv(
                        example_path(companion.filename),
                        billing_mode="official",
                    )
                    expected = case.segment_prefix_cost + june.total_cost
                    self.assertAlmostEqual(cycle.total_cost, expected, delta=0.05)

    def test_daily_spots(self) -> None:
        for spot in DAILY_SPOTS:
            case = CASE_BY_NAME[spot.case]
            calc = _daily_model_cost(example_path(case.filename), spot.model, spot.day)
            with self.subTest(case=spot.case, model=spot.model, day=spot.day):
                self.assertAlmostEqual(calc, spot.official, delta=spot.tolerance)


class TestJanuaryReconcile(unittest.TestCase):
    def test_strict_mode_free_rows(self) -> None:
        path = example_path(JANUARY.filename)
        report = analyze_csv(path)
        self.assertEqual(report.billing_mode, "strict")
        self.assertEqual(report.billable_rows, 0)
        self.assertEqual(report.free_rows, 8)
        self.assertEqual(report.by_model["auto"].free_rows, 6)
        self.assertEqual(report.by_model["agent_review"].free_rows, 2)

    def test_reconcile_auto_rows(self) -> None:
        path = example_path(JANUARY.filename)
        result = reconcile_csv(path)
        self.assertTrue(result.has_official_costs)
        self.assertEqual(result.official_rows, 8)
        auto_mismatches = [r for r in result.mismatch_rows if r.model == "auto"]
        self.assertEqual(auto_mismatches, [])
        auto_rows = [r for r in result.rows if r.model == "auto" and r.official_cost > 0]
        self.assertEqual(len(auto_rows), 6)
        for row in auto_rows:
            with self.subTest(date=row.date):
                self.assertLessEqual(abs(row.delta), ROW_TOLERANCE_USD)

    def test_agent_review_possible_discount(self) -> None:
        path = example_path(JANUARY.filename)
        result = reconcile_csv(path)
        rows = [r for r in result.rows if r.model == "agent_review" and r.official_cost > 0]
        self.assertEqual(len(rows), 1)
        self.assertAlmostEqual(rows[0].official_cost, 0.21, places=2)
        self.assertTrue(rows[0].possible_discount)
        self.assertGreater(rows[0].calculated_cost, rows[0].official_cost)


if __name__ == "__main__":
    unittest.main()
