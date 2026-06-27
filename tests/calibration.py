"""Calibration fixtures for examples/*.csv.

Replace or extend entries here when updating calibration exports.
Pinned totals are documentation-rate calculations, not fitted to Dashboard.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

EXAMPLES_DIR = Path(__file__).resolve().parent.parent / "examples"


def example_path(filename: str) -> Path:
    return EXAMPLES_DIR / filename


@dataclass(frozen=True)
class ModeExpect:
    total_cost: float
    total_spend: float | None = None
    free_cost: float = 0.0
    billable_rows: int | None = None
    free_rows: int | None = None
    status_only_skip: int | None = None
    errored_skip: int | None = None
    total_delta: float = 0.05


@dataclass(frozen=True)
class CalibrationCase:
    name: str
    filename: str
    official_total: float
    official_tolerance_pct: float | None = None
    official: ModeExpect | None = None
    standard: ModeExpect | None = None
    calc_above_official: bool = False
    calc_below_official: bool = False
    # cycle total ≈ companion official total + prefix (same billing window).
    segment_companion: str | None = None
    segment_prefix_cost: float | None = None


@dataclass(frozen=True)
class DailySpot:
    case: str
    model: str
    day: str
    official: float
    tolerance: float = 0.02


CALIBRATION_CASES: tuple[CalibrationCase, ...] = (
    CalibrationCase(
        name="january",
        filename="January - US$1.61.csv",
        official_total=1.61,
        official_tolerance_pct=0.10,
        official=ModeExpect(total_cost=1.60, billable_rows=8, free_rows=0),
        standard=ModeExpect(
            total_cost=0.0,
            total_spend=1.60,
            free_cost=1.60,
            billable_rows=0,
            free_rows=8,
        ),
    ),
    CalibrationCase(
        name="february",
        filename="February - US$46.57.csv",
        official_total=46.57,
        standard=ModeExpect(total_cost=48.04, billable_rows=455, total_delta=0.05),
        calc_above_official=True,
    ),
    CalibrationCase(
        name="march",
        filename="March - US$69.94.csv",
        official_total=69.94,
        official_tolerance_pct=0.012,
        official=ModeExpect(
            total_cost=70.78,
            billable_rows=649,
            free_rows=0,
            errored_skip=13,
        ),
        standard=ModeExpect(
            total_cost=67.74,
            total_spend=70.78,
            free_cost=3.04,
            billable_rows=618,
            free_rows=31,
        ),
    ),
    CalibrationCase(
        name="april",
        filename="April - US$137.09.csv",
        official_total=137.09,
        official_tolerance_pct=0.016,
        official=ModeExpect(total_cost=139.26, billable_rows=1256, free_rows=0),
    ),
    CalibrationCase(
        name="may",
        filename="May - US$92.01.csv",
        official_total=92.01,
        official_tolerance_pct=0.007,
        official=ModeExpect(
            total_cost=91.45,
            billable_rows=670,
            free_rows=0,
            status_only_skip=74,
        ),
        standard=ModeExpect(
            total_cost=89.40,
            total_spend=98.46,
            free_cost=9.06,
        ),
    ),
    CalibrationCase(
        name="june",
        filename="June - US$141.24.csv",
        official_total=141.24,
        official_tolerance_pct=0.016,
        official=ModeExpect(
            total_cost=143.42,
            billable_rows=683,
            free_rows=0,
            status_only_skip=46,
        ),
        standard=ModeExpect(
            total_cost=143.42,
            total_spend=159.14,
            free_cost=15.72,
        ),
    ),
    CalibrationCase(
        name="cycle",
        filename="May 27 - Jun 27 US$195.22 100% + 100% .csv",
        official_total=195.22,
        official_tolerance_pct=0.025,
        official=ModeExpect(
            total_cost=190.68,
            billable_rows=1059,
            free_rows=0,
            status_only_skip=120,
        ),
        calc_below_official=True,
        segment_companion="june",
        segment_prefix_cost=47.26,
    ),
)

DAILY_SPOTS: tuple[DailySpot, ...] = (
    DailySpot("june", "composer-2.5-fast", "2026-06-22", 2.15, 0.15),
    DailySpot("june", "composer-2.5-fast", "2026-06-23", 1.96, 0.15),
    DailySpot("june", "composer-2.5-fast", "2026-06-24", 10.32, 0.15),
    DailySpot("june", "composer-2.5-fast", "2026-06-25", 23.61, 0.15),
    DailySpot("cycle", "auto", "2026-05-28", 5.10),
    DailySpot("cycle", "auto", "2026-05-29", 13.69),
    DailySpot("cycle", "auto", "2026-06-02", 13.23),
    DailySpot("cycle", "auto", "2026-06-03", 12.68),
    DailySpot("cycle", "auto", "2026-06-04", 0.11),
    DailySpot("cycle", "auto", "2026-06-05", 0.31),
    DailySpot("cycle", "auto", "2026-06-06", 0.30),
)

CASE_BY_NAME = {c.name: c for c in CALIBRATION_CASES}

# Convenience aliases for tests that need a single fixture.
JANUARY = CASE_BY_NAME["january"]
FEBRUARY = CASE_BY_NAME["february"]
MARCH = CASE_BY_NAME["march"]
MAY = CASE_BY_NAME["may"]
JUNE = CASE_BY_NAME["june"]
CYCLE = CASE_BY_NAME["cycle"]
