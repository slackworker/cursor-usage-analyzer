"""Compare token-based estimates against official per-row Cost when available."""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

from cursor_usage.calculator import _parse_int, _row_cost
from cursor_usage.pricing import PRICING, normalize_kind, parse_official_row_cost

# Per-row tolerance when official Cost is a USD amount (penny rounding).
ROW_TOLERANCE_USD = 0.01

DISCOUNT_NOTE = (
    "官方 Cost 低于 token 推算时，可能是折扣、不同计费规则或逐行四舍五入，"
    "不能单凭一行断定原因"
)


@dataclass
class RowReconciliation:
    date: str
    model: str
    kind: str
    official_cost: float
    calculated_cost: float
    calculated_cost_rounded: float
    delta: float
    within_tolerance: bool
    possible_discount: bool
    note: str | None = None


@dataclass
class ReconciliationReport:
    source: str
    has_official_costs: bool
    official_rows: int
    rows: list[RowReconciliation] = field(default_factory=list)

    @property
    def official_total(self) -> float:
        return sum(r.official_cost for r in self.rows)

    @property
    def calculated_total(self) -> float:
        return sum(r.calculated_cost for r in self.rows)

    @property
    def calculated_total_rounded(self) -> float:
        return sum(r.calculated_cost_rounded for r in self.rows)

    @property
    def mismatch_rows(self) -> list[RowReconciliation]:
        return [r for r in self.rows if not r.within_tolerance]

    @property
    def possible_discount_rows(self) -> list[RowReconciliation]:
        return [r for r in self.rows if r.possible_discount]


def reconcile_csv(path: str | Path) -> ReconciliationReport:
    path = Path(path)
    with path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    reconciled: list[RowReconciliation] = []
    official_rows = 0

    for row in rows:
        official = parse_official_row_cost(row.get("Cost"))
        if official is None:
            continue

        model = row.get("Model", "")
        if model not in PRICING:
            continue

        kind = normalize_kind(row.get("Kind", ""))
        date = (row.get("Date") or "")[:10]
        icw = _parse_int(row.get("Input (w/ Cache Write)"))
        icwo = _parse_int(row.get("Input (w/o Cache Write)"))
        cr = _parse_int(row.get("Cache Read"))
        out = _parse_int(row.get("Output Tokens"))
        calculated = _row_cost(model, icw, icwo, cr, out, kind=kind)
        calculated_rounded = round(calculated, 2)
        delta = calculated_rounded - official
        within = abs(delta) <= ROW_TOLERANCE_USD
        possible_discount = calculated > official + ROW_TOLERANCE_USD

        note = None
        if possible_discount:
            note = DISCOUNT_NOTE

        official_rows += 1
        reconciled.append(
            RowReconciliation(
                date=date,
                model=model,
                kind=kind,
                official_cost=official,
                calculated_cost=calculated,
                calculated_cost_rounded=calculated_rounded,
                delta=delta,
                within_tolerance=within,
                possible_discount=possible_discount,
                note=note,
            )
        )

    return ReconciliationReport(
        source=str(path),
        has_official_costs=official_rows > 0,
        official_rows=official_rows,
        rows=reconciled,
    )
