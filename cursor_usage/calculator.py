"""Core cost calculation from Cursor usage CSV exports."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, Literal

from cursor_usage.aggregation import (
    apply_limits,
    build_usage_report,
    infer_limits_from_baseline,
    pool_cost,
    pool_cost_with_free,
    pool_free_cost,
    resolve_pool_limits,
)
from cursor_usage.models import (
    DEFAULT_API_LIMIT,
    DEFAULT_AUTO_COMPOSER_LIMIT,
    DEFAULT_POOL_LIMITS,
    DEFAULT_POOL_PLAN_LABEL,
    ModelSummary,
    PoolLimits,
    PoolSummary,
    ReportMeta,
    RowCost,
    UsageEvent,
    UsageReport,
    UsageWithLimits,
)
from cursor_usage.parser import parse_csv, parse_int, row_cost

# Backward-compatible aliases for tests and reconcile.
_parse_int = parse_int
_row_cost = row_cost


def analyze_csv(
    path: str | Path,
    *,
    billing_mode: Literal["official", "standard"] = "standard",
    free_pricing_mode: Literal["official", "standard"] | None = None,
) -> UsageReport:
    if free_pricing_mode is not None:
        billing_mode = free_pricing_mode
    if billing_mode not in {"official", "standard"}:
        raise ValueError("billing_mode must be 'official' or 'standard'")
    path = Path(path)
    events, meta = parse_csv(path)
    return build_usage_report(
        events,
        source=str(path),
        skipped_rows=meta.skipped_rows,
        unknown_models=meta.unknown_models,
        billing_mode=billing_mode,
    )


def analyze_many(
    paths: Iterable[str | Path],
    *,
    billing_mode: Literal["official", "standard"] = "standard",
    free_pricing_mode: Literal["official", "standard"] | None = None,
) -> list[UsageReport]:
    return [
        analyze_csv(path, billing_mode=billing_mode, free_pricing_mode=free_pricing_mode)
        for path in paths
    ]


__all__ = [
    "DEFAULT_API_LIMIT",
    "DEFAULT_AUTO_COMPOSER_LIMIT",
    "DEFAULT_POOL_LIMITS",
    "DEFAULT_POOL_PLAN_LABEL",
    "ModelSummary",
    "PoolLimits",
    "PoolSummary",
    "ReportMeta",
    "RowCost",
    "UsageEvent",
    "UsageReport",
    "UsageWithLimits",
    "analyze_csv",
    "analyze_many",
    "apply_limits",
    "build_usage_report",
    "infer_limits_from_baseline",
    "pool_cost",
    "pool_cost_with_free",
    "pool_free_cost",
    "resolve_pool_limits",
]
