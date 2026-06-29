"""Calibration fixtures for examples/*.csv.

Case data lives in calibration_cases.json (shared with web golden tests).
Pinned totals are documentation-rate calculations, not fitted to Dashboard.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_DATA_PATH = Path(__file__).resolve().parent / "calibration_cases.json"
EXAMPLES_DIR = Path(__file__).resolve().parent.parent / "examples"


def example_path(filename: str) -> Path:
    return EXAMPLES_DIR / filename


def has_example(filename: str) -> bool:
    return example_path(filename).is_file()


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
    segment_companion: str | None = None
    segment_prefix_cost: float | None = None


@dataclass(frozen=True)
class DailySpot:
    case: str
    model: str
    day: str
    official: float
    tolerance: float = 0.02


def _mode_expect(raw: dict[str, Any] | None) -> ModeExpect | None:
    if raw is None:
        return None
    return ModeExpect(
        total_cost=float(raw["total_cost"]),
        total_spend=raw.get("total_spend"),
        free_cost=float(raw.get("free_cost", 0.0)),
        billable_rows=raw.get("billable_rows"),
        free_rows=raw.get("free_rows"),
        status_only_skip=raw.get("status_only_skip"),
        errored_skip=raw.get("errored_skip"),
        total_delta=float(raw.get("total_delta", 0.05)),
    )


def _load_cases() -> tuple[CalibrationCase, ...]:
    payload = json.loads(_DATA_PATH.read_text(encoding="utf-8"))
    cases: list[CalibrationCase] = []
    for raw in payload["cases"]:
        cases.append(
            CalibrationCase(
                name=raw["name"],
                filename=raw["filename"],
                official_total=float(raw["official_total"]),
                official_tolerance_pct=raw.get("official_tolerance_pct"),
                official=_mode_expect(raw.get("official")),
                standard=_mode_expect(raw.get("standard")),
                calc_above_official=bool(raw.get("calc_above_official", False)),
                calc_below_official=bool(raw.get("calc_below_official", False)),
                segment_companion=raw.get("segment_companion"),
                segment_prefix_cost=raw.get("segment_prefix_cost"),
            )
        )
    return tuple(cases)


def _load_daily_spots() -> tuple[DailySpot, ...]:
    payload = json.loads(_DATA_PATH.read_text(encoding="utf-8"))
    return tuple(
        DailySpot(
            spot["case"],
            spot["model"],
            spot["day"],
            float(spot["official"]),
            float(spot.get("tolerance", 0.02)),
        )
        for spot in payload["daily_spots"]
    )


CALIBRATION_CASES = _load_cases()
DAILY_SPOTS = _load_daily_spots()
CASE_BY_NAME = {c.name: c for c in CALIBRATION_CASES}

JANUARY = CASE_BY_NAME["january"]
FEBRUARY = CASE_BY_NAME["february"]
MARCH = CASE_BY_NAME["march"]
MAY = CASE_BY_NAME["may"]
JUNE = CASE_BY_NAME["june"]
CYCLE = CASE_BY_NAME["cycle"]
