"""Core cost calculation from Cursor usage CSV exports."""

from __future__ import annotations

import csv
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from cursor_usage.pricing import (
    AGENT_REVIEW_DISCOUNT_RATIO,
    BILLABLE_KIND,
    FREE_KIND,
    PRICING,
    ModelPricing,
    is_billable_kind,
    is_free_kind,
    normalize_kind,
    parse_official_row_cost,
)


@dataclass
class RowCost:
    date: str
    model: str
    kind: str
    cost: float
    total_tokens: int
    billable: bool


@dataclass
class ModelSummary:
    model: str
    pool: str
    rows: int = 0
    tokens: int = 0
    cost: float = 0.0


@dataclass
class PoolSummary:
    pool: str
    cost: float = 0.0
    free_cost: float = 0.0
    rows: int = 0
    tokens: int = 0
    models: dict[str, ModelSummary] = field(default_factory=dict)


@dataclass
class UsageReport:
    source: str
    date_from: str | None
    date_to: str | None
    total_rows: int
    billable_rows: int
    skipped_rows: dict[str, int]
    unknown_models: dict[str, int]
    total_tokens: int
    total_cost: float
    free_rows: int
    free_cost: float
    by_model: dict[str, ModelSummary]
    by_pool: dict[str, PoolSummary]
    row_costs: list[RowCost]

    @property
    def total_cost_with_free(self) -> float:
        return self.total_cost + self.free_cost


@dataclass
class PoolLimits:
    auto_composer: float
    api: float

    @property
    def total(self) -> float:
        return self.auto_composer + self.api


@dataclass
class UsageWithLimits:
    report: UsageReport
    limits: PoolLimits
    auto_composer_pct: float
    api_pct: float
    total_pct: float


def _parse_int(value: str | None) -> int:
    if not value:
        return 0
    return int(value)


def _resolve_row_cost(
    row_cost_value: str | None,
    model: str,
    icw: int,
    icwo: int,
    cr: int,
    out: int,
    *,
    kind: str = BILLABLE_KIND,
) -> float:
    """Use per-row USD in Cost when present; otherwise token formula."""
    annotated = parse_official_row_cost(row_cost_value)
    if annotated is not None:
        return annotated
    return _row_cost(model, icw, icwo, cr, out, kind=kind)


def _row_cost(
    model: str,
    icw: int,
    icwo: int,
    cr: int,
    out: int,
    *,
    kind: str = BILLABLE_KIND,
) -> float:
    kind = normalize_kind(kind)

    if model == "agent_review":
        p = PRICING["auto"]
        base = (
            icw / 1e6 * p.cache_write
            + icwo / 1e6 * p.input
            + cr / 1e6 * p.cache_read
            + out / 1e6 * p.output
        )
        return base * AGENT_REVIEW_DISCOUNT_RATIO

    pricing: ModelPricing = PRICING[model]
    return (
        icw / 1e6 * pricing.cache_write
        + icwo / 1e6 * pricing.input
        + cr / 1e6 * pricing.cache_read
        + out / 1e6 * pricing.output
    )


def analyze_csv(path: str | Path) -> UsageReport:
    path = Path(path)
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    skipped_rows: dict[str, int] = defaultdict(int)
    unknown_models: dict[str, int] = defaultdict(int)
    by_model: dict[str, ModelSummary] = {}
    by_pool: dict[str, PoolSummary] = {}
    row_costs: list[RowCost] = []

    billable_rows = 0
    free_rows = 0
    total_tokens = 0
    total_cost = 0.0
    free_cost = 0.0
    dates: list[str] = []

    for row in rows:
        model = row.get("Model", "")
        raw_kind = row.get("Kind", "")
        kind = normalize_kind(raw_kind)
        date = (row.get("Date") or "")[:10]
        if date:
            dates.append(date)

        tokens = _parse_int(row.get("Total Tokens"))
        icw = _parse_int(row.get("Input (w/ Cache Write)"))
        icwo = _parse_int(row.get("Input (w/o Cache Write)"))
        cr = _parse_int(row.get("Cache Read"))
        out = _parse_int(row.get("Output Tokens"))

        if is_free_kind(kind) and model in PRICING:
            cost = _resolve_row_cost(
                row.get("Cost"), model, icw, icwo, cr, out, kind=kind
            )
            pool = PRICING[model].pool
            free_rows += 1
            free_cost += cost
            if pool not in by_pool:
                by_pool[pool] = PoolSummary(pool=pool)
            by_pool[pool].free_cost += cost
            skipped_rows[kind] += 1
            row_costs.append(RowCost(date, model, kind, cost, tokens, False))
            continue

        if not is_billable_kind(kind):
            skipped_rows[kind or "(empty)"] += 1
            row_costs.append(RowCost(date, model, kind, 0.0, tokens, False))
            continue

        if model not in PRICING:
            unknown_models[model or "(empty)"] += 1
            row_costs.append(RowCost(date, model, kind, 0.0, tokens, False))
            continue

        cost = _resolve_row_cost(
            row.get("Cost"), model, icw, icwo, cr, out, kind=kind
        )

        pool = PRICING[model].pool
        billable_rows += 1
        total_tokens += tokens
        total_cost += cost

        if model not in by_model:
            by_model[model] = ModelSummary(model=model, pool=pool)
        by_model[model].rows += 1
        by_model[model].tokens += tokens
        by_model[model].cost += cost

        if pool not in by_pool:
            by_pool[pool] = PoolSummary(pool=pool)
        by_pool[pool].rows += 1
        by_pool[pool].tokens += tokens
        by_pool[pool].cost += cost
        by_pool[pool].models[model] = by_model[model]

        row_costs.append(RowCost(date, model, kind, cost, tokens, True))

    return UsageReport(
        source=str(path),
        date_from=min(dates) if dates else None,
        date_to=max(dates) if dates else None,
        total_rows=len(rows),
        billable_rows=billable_rows,
        skipped_rows=dict(skipped_rows),
        unknown_models=dict(unknown_models),
        total_tokens=total_tokens,
        total_cost=total_cost,
        free_rows=free_rows,
        free_cost=free_cost,
        by_model=by_model,
        by_pool=by_pool,
        row_costs=row_costs,
    )


def pool_cost(report: UsageReport, pool: str) -> float:
    return report.by_pool.get(pool, PoolSummary(pool=pool)).cost


def pool_free_cost(report: UsageReport, pool: str) -> float:
    return report.by_pool.get(pool, PoolSummary(pool=pool)).free_cost


def pool_cost_with_free(report: UsageReport, pool: str) -> float:
    summary = report.by_pool.get(pool, PoolSummary(pool=pool))
    return summary.cost + summary.free_cost


def infer_limits_from_baseline(
    baseline: UsageReport,
    auto_composer_usage: float,
    api_usage: float,
) -> PoolLimits:
    if not 0 < auto_composer_usage <= 1:
        raise ValueError("auto_composer_usage must be between 0 and 1")
    if not 0 < api_usage <= 1:
        raise ValueError("api_usage must be between 0 and 1")

    ac_used = pool_cost(baseline, "auto_composer")
    api_used = pool_cost(baseline, "api")
    return PoolLimits(
        auto_composer=ac_used / auto_composer_usage,
        api=api_used / api_usage,
    )


def apply_limits(report: UsageReport, limits: PoolLimits) -> UsageWithLimits:
    ac_used = pool_cost(report, "auto_composer")
    api_used = pool_cost(report, "api")
    ac_pct = (ac_used / limits.auto_composer * 100) if limits.auto_composer else 0.0
    api_pct = (api_used / limits.api * 100) if limits.api else 0.0
    total_pct = (report.total_cost / limits.total * 100) if limits.total else 0.0
    return UsageWithLimits(
        report=report,
        limits=limits,
        auto_composer_pct=ac_pct,
        api_pct=api_pct,
        total_pct=total_pct,
    )


def analyze_many(paths: Iterable[str | Path]) -> list[UsageReport]:
    return [analyze_csv(path) for path in paths]
