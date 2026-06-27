"""Tests for bidirectional pool usage percentage (forward / reverse)."""

from __future__ import annotations

import unittest
from pathlib import Path

from cursor_usage.calculator import (
    DEFAULT_API_LIMIT,
    DEFAULT_AUTO_COMPOSER_LIMIT,
    analyze_csv,
    apply_limits,
    infer_limits_from_baseline,
    pool_cost,
    resolve_pool_limits,
)

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"
CYCLE_CSV = EXAMPLES / "May 27 - Jun 27 US$195.22 100% + 100% .csv"
FEBRUARY_CSV = EXAMPLES / "February - US$46.57.csv"
MARCH_CSV = EXAMPLES / "March - US$69.94.csv"


class TestPoolUsageForward(unittest.TestCase):
    def test_default_limits_are_145_and_45(self) -> None:
        limits = resolve_pool_limits()
        self.assertEqual(limits.auto_composer, DEFAULT_AUTO_COMPOSER_LIMIT)
        self.assertEqual(limits.api, DEFAULT_API_LIMIT)
        self.assertEqual(limits.total, 190.0)

    def test_partial_limit_override(self) -> None:
        limits = resolve_pool_limits(auto_composer_limit=150.0)
        self.assertEqual(limits.auto_composer, 150.0)
        self.assertEqual(limits.api, DEFAULT_API_LIMIT)

    def test_forward_percent_with_defaults_official(self) -> None:
        report = analyze_csv(FEBRUARY_CSV, billing_mode="official")
        result = apply_limits(report, resolve_pool_limits())
        ac_used = pool_cost(report, "auto_composer")
        api_used = pool_cost(report, "api")
        self.assertAlmostEqual(result.auto_composer_pct, ac_used / 145.0 * 100, places=2)
        self.assertAlmostEqual(result.api_pct, api_used / 45.0 * 100, places=2)


class TestPoolUsageReverse(unittest.TestCase):
    def test_infer_limits_at_100_percent(self) -> None:
        report = analyze_csv(CYCLE_CSV, billing_mode="official")
        limits = infer_limits_from_baseline(report, 1.0, 1.0)
        self.assertAlmostEqual(limits.auto_composer, pool_cost(report, "auto_composer"), places=2)
        self.assertAlmostEqual(limits.api, pool_cost(report, "api"), places=2)
        self.assertAlmostEqual(limits.auto_composer, 145.20, delta=0.05)
        self.assertAlmostEqual(limits.api, 45.48, delta=0.05)

    def test_infer_limits_at_partial_usage(self) -> None:
        report = analyze_csv(CYCLE_CSV, billing_mode="official")
        limits = infer_limits_from_baseline(report, 0.5, 0.25)
        self.assertAlmostEqual(
            limits.auto_composer,
            pool_cost(report, "auto_composer") / 0.5,
            places=2,
        )
        self.assertAlmostEqual(limits.api, pool_cost(report, "api") / 0.25, places=2)

    def test_baseline_csv_can_differ_from_target(self) -> None:
        baseline = analyze_csv(FEBRUARY_CSV, billing_mode="official")
        target = analyze_csv(MARCH_CSV, billing_mode="official")
        limits = infer_limits_from_baseline(baseline, 0.95, 0.99)
        result = apply_limits(target, limits)
        ac_used = pool_cost(target, "auto_composer")
        api_used = pool_cost(target, "api")
        self.assertAlmostEqual(
            result.auto_composer_pct,
            ac_used / limits.auto_composer * 100,
            places=2,
        )
        self.assertAlmostEqual(result.api_pct, api_used / limits.api * 100, places=2)


if __name__ == "__main__":
    unittest.main()
