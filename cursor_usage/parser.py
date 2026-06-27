"""CSV parsing into normalized UsageEvent records."""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path
from typing import Literal

from cursor_usage.models import DEFAULT_POOL_LIMITS, EventCosts, ReportMeta, TokenCounts, UsageEvent
from cursor_usage.pricing import (
    BILLABLE_KIND,
    FREE_KIND,
    ON_DEMAND_KIND,
    PRICING,
    is_billable_kind,
    is_free_kind,
    is_on_demand_kind,
    max_mode_adjusted_cost,
    normalize_kind,
    parse_max_mode,
    parse_official_row_cost,
    token_row_cost,
    AGENT_REVIEW_DISCOUNT_RATIO,
    ModelPricing,
)


def _parse_int(value: str | None) -> int:
    if not value:
        return 0
    return int(value)


def _row_cost(
    model: str,
    icw: int,
    icwo: int,
    cr: int,
    out: int,
    *,
    kind: str = BILLABLE_KIND,
    max_mode: bool = False,
) -> float:
    kind = normalize_kind(kind)

    if model == "agent_review":
        p = PRICING["auto"]
        base = token_row_cost(p, icw, icwo, cr, out)
        return base * AGENT_REVIEW_DISCOUNT_RATIO

    pricing: ModelPricing = PRICING[model]
    adjusted = max_mode_adjusted_cost(
        model, pricing, icw, icwo, cr, out, max_mode=max_mode
    )
    if adjusted is not None:
        return adjusted
    return token_row_cost(pricing, icw, icwo, cr, out)


def _resolve_row_cost(
    row_cost_value: str | None,
    model: str,
    icw: int,
    icwo: int,
    cr: int,
    out: int,
    *,
    kind: str = BILLABLE_KIND,
    max_mode: bool = False,
) -> float:
    annotated = parse_official_row_cost(row_cost_value)
    if annotated is not None:
        return annotated
    return _row_cost(model, icw, icwo, cr, out, kind=kind, max_mode=max_mode)


def _official_free_row_cost(row_cost_value: str | None) -> float | None:
    return parse_official_row_cost(row_cost_value)


def _local_date_hour(timestamp: str, timezone: str = "UTC") -> tuple[str, int]:
    """Extract local date and hour; defaults to UTC slice of ISO timestamp."""
    if not timestamp:
        return "", 0
    # Simple UTC fallback: YYYY-MM-DDTHH:...
    date_part = timestamp[:10]
    hour = 0
    if len(timestamp) >= 13 and timestamp[10] in {"T", " "}:
        try:
            hour = int(timestamp[11:13])
        except ValueError:
            hour = 0
    return date_part, hour


def parse_csv_rows(
    rows: list[dict[str, str]],
    *,
    source: str = "",
    timezone: str = "UTC",
) -> tuple[list[UsageEvent], dict[str, int], dict[str, int]]:
    """Parse CSV dict rows into UsageEvent list with dual billing costs."""
    events: list[UsageEvent] = []
    skipped_rows: dict[str, int] = defaultdict(int)
    unknown_models: dict[str, int] = defaultdict(int)

    for idx, row in enumerate(rows):
        model = row.get("Model", "")
        raw_kind = row.get("Kind", "")
        kind = normalize_kind(raw_kind)
        timestamp = row.get("Date") or ""
        local_date, local_hour = _local_date_hour(timestamp, timezone)

        tokens = _parse_int(row.get("Total Tokens"))
        icw = _parse_int(row.get("Input (w/ Cache Write)"))
        icwo = _parse_int(row.get("Input (w/o Cache Write)"))
        cr = _parse_int(row.get("Cache Read"))
        out = _parse_int(row.get("Output Tokens"))
        max_mode = parse_max_mode(row.get("Max Mode"))
        annotated = parse_official_row_cost(row.get("Cost"))

        token_counts = TokenCounts(icw=icw, icwo=icwo, cache_read=cr, output=out, total=tokens)
        pool: str = PRICING[model].pool if model in PRICING else "unknown"
        cloud_agent_id = row.get("Cloud Agent ID") or None
        automation_id = row.get("Automation ID") or None

        included_cost = 0.0
        free_cost = 0.0
        on_demand_cost = 0.0
        event_kind: str = kind
        skip_reason: str | None = None
        billable = False

        if is_on_demand_kind(kind) and model in PRICING:
            event_kind = ON_DEMAND_KIND
            on_demand_cost = _resolve_row_cost(
                row.get("Cost"), model, icw, icwo, cr, out, kind=kind, max_mode=max_mode
            )
            billable = True
        elif is_free_kind(kind) and model in PRICING:
            event_kind = FREE_KIND
            official_free = _official_free_row_cost(row.get("Cost"))
            free_cost = _resolve_row_cost(
                row.get("Cost"), model, icw, icwo, cr, out, kind=kind, max_mode=max_mode
            )
            if official_free is not None:
                included_cost = official_free
            billable = False
        elif not is_billable_kind(kind):
            event_kind = "Skipped"
            skip_reason = kind or "(empty)"
            skipped_rows[skip_reason] += 1
            billable = False
        elif model not in PRICING:
            event_kind = "Skipped"
            skip_reason = "unknown_model"
            unknown_models[model or "(empty)"] += 1
            billable = False
        else:
            event_kind = BILLABLE_KIND
            included_cost = _resolve_row_cost(
                row.get("Cost"), model, icw, icwo, cr, out, kind=kind, max_mode=max_mode
            )
            billable = True

        events.append(
            UsageEvent(
                id=str(idx),
                timestamp=timestamp,
                local_date=local_date,
                local_hour=local_hour,
                model=model,
                pool=pool,
                kind=event_kind,
                skip_reason=skip_reason,
                max_mode=max_mode,
                tokens=token_counts,
                costs=EventCosts(
                    included=included_cost,
                    free=free_cost,
                    on_demand=on_demand_cost,
                    annotated=annotated,
                ),
                cloud_agent_id=cloud_agent_id,
                automation_id=automation_id,
                billable=billable,
            )
        )

    return events, dict(skipped_rows), dict(unknown_models)


def parse_csv_file(
    path: str | Path,
    *,
    timezone: str = "UTC",
) -> tuple[list[UsageEvent], dict[str, int], dict[str, int]]:
    path = Path(path)
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return parse_csv_rows(rows, source=str(path), timezone=timezone)


def parse_csv(
    path: str | Path,
    *,
    timezone: str = "UTC",
) -> tuple[list[UsageEvent], ReportMeta]:
    """Parse a CSV file into events and report metadata."""
    path = Path(path)
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    events, skipped_rows, unknown_models = parse_csv_rows(
        rows, source=str(path), timezone=timezone
    )
    dates = sorted(e.local_date for e in events if e.local_date)
    meta = ReportMeta(
        file_name=path.name,
        row_count=len(rows),
        date_from=dates[0] if dates else None,
        date_to=dates[-1] if dates else None,
        data_max_date=dates[-1] if dates else None,
        unknown_models=unknown_models,
        skipped_rows=skipped_rows,
        pricing_caveats=[],
        pool_limits=DEFAULT_POOL_LIMITS,
    )
    return events, meta


# Re-export for tests that import _parse_int / _row_cost from calculator
parse_int = _parse_int
row_cost = _row_cost
