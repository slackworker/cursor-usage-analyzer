"""Rollup and aggregation functions over UsageEvent collections."""

from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Literal

from cursor_usage.models import (
    DateRangePreset,
    DEFAULT_API_LIMIT,
    DEFAULT_AUTO_COMPOSER_LIMIT,
    FilterState,
    ModelSummary,
    PoolLimits,
    PoolSummary,
    RowCost,
    UsageEvent,
    UsageReport,
    UsageWithLimits,
)
from cursor_usage.pricing import (
    BILLABLE_KIND,
    FREE_KIND,
    FREE_STATUS_ONLY_SKIP,
    ON_DEMAND_KIND,
    is_billable_kind,
    is_free_kind,
    is_on_demand_kind,
)


def _event_cost(event: UsageEvent, mode: Literal["official", "standard"]) -> float:
    if mode == "official":
        return event.costs.included + event.costs.on_demand
    return event.costs.included + event.costs.free + event.costs.on_demand


def _data_max_date(events: list[UsageEvent]) -> str | None:
    dates = [e.local_date for e in events if e.local_date]
    return max(dates) if dates else None


def _resolve_date_bounds(
    events: list[UsageEvent],
    date_range: DateRangePreset | tuple[str, str],
) -> tuple[str | None, str | None]:
    if not events:
        return None, None

    data_max = _data_max_date(events)
    if data_max is None:
        return None, None

    if isinstance(date_range, tuple):
        return date_range[0], date_range[1]

    if date_range == "all":
        dates = sorted(e.local_date for e in events if e.local_date)
        return dates[0], dates[-1]

    max_dt = date.fromisoformat(data_max)

    if date_range == "1d":
        return data_max, data_max
    if date_range == "7d":
        start = max_dt - timedelta(days=6)
        return start.isoformat(), data_max
    if date_range == "30d":
        start = max_dt - timedelta(days=29)
        return start.isoformat(), data_max
    if date_range == "mtd":
        return max_dt.replace(day=1).isoformat(), data_max
    if date_range == "last_month":
        first_of_month = max_dt.replace(day=1)
        last_prev = first_of_month - timedelta(days=1)
        start = last_prev.replace(day=1)
        return start.isoformat(), last_prev.isoformat()

    dates = sorted(e.local_date for e in events if e.local_date)
    return dates[0], dates[-1]


def filter_events(
    events: list[UsageEvent],
    filters: FilterState,
) -> list[UsageEvent]:
    date_from, date_to = _resolve_date_bounds(events, filters.date_range)
    model_set: set[str] | None = None
    if filters.models != "all":
        model_set = set(filters.models)

    result: list[UsageEvent] = []
    for event in events:
        if date_from and event.local_date and event.local_date < date_from:
            continue
        if date_to and event.local_date and event.local_date > date_to:
            continue
        if model_set is not None and event.model not in model_set:
            continue
        result.append(event)
    return result


def rollup_billing_totals(
    events: list[UsageEvent],
    mode: Literal["official", "standard"],
) -> dict[str, float]:
    included = 0.0
    free = 0.0
    on_demand = 0.0

    for event in events:
        if event.skip_reason == "unknown_model":
            continue
        if is_free_kind(event.kind):
            if mode == "official":
                included += event.costs.included
            else:
                free += event.costs.free
            continue
        if is_on_demand_kind(event.kind):
            on_demand += event.costs.on_demand
            continue
        if is_billable_kind(event.kind):
            included += event.costs.included
            continue

    if mode == "official":
        total = included + on_demand
    else:
        total = included + free + on_demand

    return {
        "included": included,
        "free": free,
        "on_demand": on_demand,
        "total": total,
    }


def rollup_by_model(
    events: list[UsageEvent],
    view: Literal["cost", "token"],
    *,
    mode: Literal["official", "standard"] = "standard",
) -> dict[str, dict[str, float | int]]:
    totals: dict[str, dict[str, float | int]] = defaultdict(
        lambda: {"cost": 0.0, "tokens": 0}
    )
    for event in events:
        if event.skip_reason or not event.model:
            continue
        if is_free_kind(event.kind) and mode == "official" and event.costs.included <= 0:
            continue
        if is_free_kind(event.kind) and mode == "standard":
            totals[event.model]["cost"] += event.costs.free
        elif is_on_demand_kind(event.kind):
            totals[event.model]["cost"] += event.costs.on_demand
        elif is_billable_kind(event.kind) or (
            is_free_kind(event.kind) and mode == "official"
        ):
            totals[event.model]["cost"] += event.costs.included
        else:
            continue
        totals[event.model]["tokens"] += event.tokens.total
    return dict(totals)


def rollup_by_pool(
    events: list[UsageEvent],
    *,
    mode: Literal["official", "standard"] = "official",
) -> dict[str, dict[str, float | int]]:
    totals: dict[str, dict[str, float | int]] = defaultdict(
        lambda: {"included": 0.0, "free": 0.0, "on_demand": 0.0, "tokens": 0, "rows": 0}
    )
    for event in events:
        if not event.pool or event.skip_reason:
            continue
        bucket = totals[event.pool]
        bucket["rows"] = int(bucket["rows"]) + 1
        bucket["tokens"] = int(bucket["tokens"]) + event.tokens.total

        if is_free_kind(event.kind):
            if mode == "official":
                bucket["included"] = float(bucket["included"]) + event.costs.included
            else:
                bucket["free"] = float(bucket["free"]) + event.costs.free
        elif is_on_demand_kind(event.kind):
            bucket["on_demand"] = float(bucket["on_demand"]) + event.costs.on_demand
        elif is_billable_kind(event.kind):
            bucket["included"] = float(bucket["included"]) + event.costs.included
    return dict(totals)


def rollup_daily(
    events: list[UsageEvent],
    view: Literal["cost", "token"],
    models: list[str] | Literal["all"] = "all",
    *,
    mode: Literal["official", "standard"] = "standard",
) -> list[dict[str, object]]:
    model_set: set[str] | None = None if models == "all" else set(models)
    by_day: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for event in events:
        if not event.local_date:
            continue
        if model_set is not None and event.model not in model_set:
            continue
        if event.skip_reason:
            continue

        day = event.local_date
        if view == "token":
            by_day[day][event.model] += event.tokens.total
            continue

        if is_free_kind(event.kind):
            cost = event.costs.free if mode == "standard" else event.costs.included
        elif is_on_demand_kind(event.kind):
            cost = event.costs.on_demand
        elif is_billable_kind(event.kind):
            cost = event.costs.included
        else:
            continue
        if cost > 0 or view == "cost":
            by_day[day][event.model] += cost

    return [
        {"date": day, "by_model": dict(by_day[day])}
        for day in sorted(by_day)
    ]


def rollup_daily_cumulative(
    events: list[UsageEvent],
    view: Literal["cost", "token"],
    models: list[str] | Literal["all"] = "all",
    *,
    mode: Literal["official", "standard"] = "standard",
) -> list[dict[str, object]]:
    daily = rollup_daily(events, view, models, mode=mode)
    cumulative: list[dict[str, object]] = []
    running: dict[str, float] = defaultdict(float)
    total_running = 0.0

    for row in daily:
        day = str(row["date"])
        by_model = row["by_model"]
        assert isinstance(by_model, dict)
        day_total = 0.0
        for model, value in by_model.items():
            running[model] += float(value)
            day_total += float(value)
        total_running += day_total
        cumulative.append(
            {
                "date": day,
                "by_model": dict(running),
                "total": total_running,
            }
        )
    return cumulative


def rollup_token_structure(
    events: list[UsageEvent],
    view: Literal["cost", "token"],
) -> dict[str, float | int]:
    totals = {"icw": 0, "icwo": 0, "cache_read": 0, "output": 0, "total": 0}
    for event in events:
        if event.skip_reason:
            continue
        totals["icw"] += event.tokens.icw
        totals["icwo"] += event.tokens.icwo
        totals["cache_read"] += event.tokens.cache_read
        totals["output"] += event.tokens.output
        totals["total"] += event.tokens.total
    return totals


def cache_hit_rate_by_model(events: list[UsageEvent]) -> dict[str, float]:
    numer: dict[str, int] = defaultdict(int)
    denom: dict[str, int] = defaultdict(int)
    for event in events:
        if event.skip_reason:
            continue
        icw = event.tokens.icw
        icwo = event.tokens.icwo
        cr = event.tokens.cache_read
        denom[event.model] += icw + icwo + cr
        numer[event.model] += cr
    return {
        model: (numer[model] / denom[model] if denom[model] else 0.0)
        for model in denom
    }


def unit_price_by_model(
    events: list[UsageEvent],
    *,
    mode: Literal["official", "standard"] = "standard",
) -> dict[str, float]:
    cost_by_model: dict[str, float] = defaultdict(float)
    tokens_by_model: dict[str, int] = defaultdict(int)
    for event in events:
        if event.skip_reason:
            continue
        tokens_by_model[event.model] += event.tokens.total
        if is_free_kind(event.kind):
            cost_by_model[event.model] += (
                event.costs.free if mode == "standard" else event.costs.included
            )
        elif is_on_demand_kind(event.kind):
            cost_by_model[event.model] += event.costs.on_demand
        elif is_billable_kind(event.kind):
            cost_by_model[event.model] += event.costs.included
    return {
        model: (cost_by_model[model] / tokens_by_model[model] * 1_000_000)
        if tokens_by_model[model]
        else 0.0
        for model in tokens_by_model
    }


def rollup_hourly(
    events: list[UsageEvent],
    view: Literal["sessions", "tokens"],
) -> list[dict[str, int]]:
    buckets = [0] * 24
    for event in events:
        if event.skip_reason:
            continue
        hour = event.local_hour
        if view == "sessions":
            buckets[hour] += 1
        else:
            buckets[hour] += event.tokens.total
    return [{"hour": h, "value": buckets[h]} for h in range(24)]


def rollup_weekly_hourly(events: list[UsageEvent]) -> list[list[int]]:
    """7×24 matrix: rows Mon–Sun (ISO weekday 0=Mon), cols hour 0–23."""
    matrix = [[0] * 24 for _ in range(7)]
    for event in events:
        if event.skip_reason or not event.local_date:
            continue
        weekday = date.fromisoformat(event.local_date).weekday()
        matrix[weekday][event.local_hour] += 1
    return matrix


def rollup_year_heatmap(
    events: list[UsageEvent],
    metric: Literal["cost", "tokens", "sessions"] = "cost",
    *,
    mode: Literal["official", "standard"] = "standard",
) -> list[dict[str, object]]:
    by_day: dict[str, float] = defaultdict(float)
    for event in events:
        if event.skip_reason or not event.local_date:
            continue
        day = event.local_date
        if metric == "sessions":
            by_day[day] += 1
        elif metric == "tokens":
            by_day[day] += event.tokens.total
        else:
            by_day[day] += _event_cost(event, mode)
    return [{"date": day, "value": by_day[day]} for day in sorted(by_day)]


def _add_calendar_month(d: date) -> date:
    """Same calendar day next month, clamped to month end (e.g. Jan 31 → Feb 28)."""
    if d.month == 12:
        year, month = d.year + 1, 1
    else:
        year, month = d.year, d.month + 1
    last_day = monthrange(year, month)[1]
    return date(year, month, min(d.day, last_day))


def is_within_billing_cycle(start: date, end: date) -> bool:
    """True when end is on or before the same-day-next-month anniversary."""
    return end <= _add_calendar_month(start)


def project_usage_percent(
    events: list[UsageEvent],
    limits: PoolLimits,
    *,
    mode: Literal["official", "standard"] = "official",
) -> dict[str, float | int | str]:
    totals = rollup_billing_totals(events, mode)
    included = float(totals["included"])
    dates = sorted(e.local_date for e in events if e.local_date and not e.skip_reason)
    if not dates:
        return {
            "span_days": 0,
            "daily_avg": 0.0,
            "projected_30d": 0.0,
            "auto_composer_pct": 0.0,
            "api_pct": 0.0,
            "total_pct": 0.0,
            "usage_mode": "direct",
            "ac_used": 0.0,
            "api_used": 0.0,
            "start_date": "",
            "end_date": "",
        }

    start = date.fromisoformat(dates[0])
    end = date.fromisoformat(dates[-1])
    span_days = (end - start).days + 1
    daily_avg = included / span_days if span_days else 0.0
    projected_30d = daily_avg * 30

    pool_totals = rollup_by_pool(events, mode=mode)
    ac_included = float(pool_totals.get("auto_composer", {}).get("included", 0))
    api_included = float(pool_totals.get("api", {}).get("included", 0))

    if is_within_billing_cycle(start, end):
        return {
            "span_days": span_days,
            "daily_avg": daily_avg,
            "projected_30d": projected_30d,
            "auto_composer_pct": (ac_included / limits.auto_composer * 100)
            if limits.auto_composer
            else 0.0,
            "api_pct": (api_included / limits.api * 100) if limits.api else 0.0,
            "total_pct": (included / limits.total * 100) if limits.total else 0.0,
            "usage_mode": "direct",
            "ac_used": ac_included,
            "api_used": api_included,
            "start_date": dates[0],
            "end_date": dates[-1],
        }

    ac_daily = ac_included / span_days if span_days else 0.0
    api_daily = api_included / span_days if span_days else 0.0
    projected_ac = ac_daily * 30
    projected_api = api_daily * 30

    return {
        "span_days": span_days,
        "daily_avg": daily_avg,
        "projected_30d": projected_30d,
        "auto_composer_pct": (projected_ac / limits.auto_composer * 100)
        if limits.auto_composer
        else 0.0,
        "api_pct": (projected_api / limits.api * 100) if limits.api else 0.0,
        "total_pct": (projected_30d / limits.total * 100) if limits.total else 0.0,
        "usage_mode": "normalized",
        "ac_used": projected_ac,
        "api_used": projected_api,
        "start_date": dates[0],
        "end_date": dates[-1],
    }


def build_usage_report(
    events: list[UsageEvent],
    *,
    source: str,
    skipped_rows: dict[str, int],
    unknown_models: dict[str, int],
    billing_mode: Literal["official", "standard"] = "standard",
) -> UsageReport:
    by_model: dict[str, ModelSummary] = {}
    by_pool: dict[str, PoolSummary] = {}
    row_costs: list[RowCost] = []

    billable_rows = 0
    free_rows = 0
    total_tokens = 0
    total_cost = 0.0
    free_cost = 0.0
    dates: list[str] = []
    status_only_skip = 0

    for event in events:
        date_str = event.local_date
        if date_str:
            dates.append(date_str)

        model = event.model
        kind = event.kind
        tokens = event.tokens.total
        pool = str(event.pool)

        if event.skip_reason == "unknown_model":
            row_costs.append(RowCost(date_str, model, kind, 0.0, tokens, False))
            continue

        if event.skip_reason:
            row_costs.append(RowCost(date_str, model, kind, 0.0, tokens, False))
            continue

        if is_free_kind(kind):
            if billing_mode == "official":
                if event.costs.annotated is not None:
                    cost = event.costs.included
                    billable_rows += 1
                    total_tokens += tokens
                    total_cost += cost
                    _add_included(
                        model, pool, tokens, cost, by_model, by_pool, row_costs, date_str, kind
                    )
                else:
                    status_only_skip += 1
                    row_costs.append(RowCost(date_str, model, kind, 0.0, tokens, False))
                continue

            cost = event.costs.free
            free_rows += 1
            free_cost += cost
            total_tokens += tokens
            _add_free(model, pool, tokens, cost, by_model, by_pool, row_costs, date_str, kind)
            continue

        if is_on_demand_kind(kind):
            cost = event.costs.on_demand
            billable_rows += 1
            total_tokens += tokens
            total_cost += cost
            _add_included(model, pool, tokens, cost, by_model, by_pool, row_costs, date_str, kind)
            continue

        if is_billable_kind(kind):
            cost = event.costs.included
            billable_rows += 1
            total_tokens += tokens
            total_cost += cost
            _add_included(model, pool, tokens, cost, by_model, by_pool, row_costs, date_str, kind)

    merged_skipped = dict(skipped_rows)
    if status_only_skip:
        merged_skipped[FREE_STATUS_ONLY_SKIP] = (
            merged_skipped.get(FREE_STATUS_ONLY_SKIP, 0) + status_only_skip
        )

    return UsageReport(
        source=source,
        date_from=min(dates) if dates else None,
        date_to=max(dates) if dates else None,
        total_rows=len(events),
        billable_rows=billable_rows,
        skipped_rows=merged_skipped,
        unknown_models=unknown_models,
        total_tokens=total_tokens,
        total_cost=total_cost,
        free_rows=free_rows,
        free_cost=free_cost,
        by_model=by_model,
        by_pool=by_pool,
        row_costs=row_costs,
        billing_mode=billing_mode,
        events=events,
    )


def _add_included(
    model: str,
    pool: str,
    tokens: int,
    cost: float,
    by_model: dict[str, ModelSummary],
    by_pool: dict[str, PoolSummary],
    row_costs: list[RowCost],
    date: str,
    kind: str,
) -> None:
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


def _add_free(
    model: str,
    pool: str,
    tokens: int,
    cost: float,
    by_model: dict[str, ModelSummary],
    by_pool: dict[str, PoolSummary],
    row_costs: list[RowCost],
    date: str,
    kind: str,
) -> None:
    if model not in by_model:
        by_model[model] = ModelSummary(model=model, pool=pool)
    by_model[model].free_rows += 1
    by_model[model].free_tokens += tokens
    by_model[model].free_cost += cost

    if pool not in by_pool:
        by_pool[pool] = PoolSummary(pool=pool)
    by_pool[pool].free_cost += cost
    by_pool[pool].rows += 1
    by_pool[pool].tokens += tokens
    by_pool[pool].models[model] = by_model[model]

    row_costs.append(RowCost(date, model, kind, cost, tokens, False))


def pool_cost(report: UsageReport, pool: str) -> float:
    return report.by_pool.get(pool, PoolSummary(pool=pool)).cost


def pool_free_cost(report: UsageReport, pool: str) -> float:
    return report.by_pool.get(pool, PoolSummary(pool=pool)).free_cost


def pool_cost_with_free(report: UsageReport, pool: str) -> float:
    summary = report.by_pool.get(pool, PoolSummary(pool=pool))
    return summary.cost + summary.free_cost


def resolve_pool_limits(
    *,
    auto_composer_limit: float | None = None,
    api_limit: float | None = None,
) -> PoolLimits:
    return PoolLimits(
        auto_composer=(
            auto_composer_limit
            if auto_composer_limit is not None
            else DEFAULT_AUTO_COMPOSER_LIMIT
        ),
        api=api_limit if api_limit is not None else DEFAULT_API_LIMIT,
    )


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
