"""Core data models for Cursor usage events and reports."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

PoolKind = Literal["auto_composer", "api"]
EventKind = Literal["Included", "Free", "OnDemand", "Skipped"]
BillingMode = Literal["official", "standard"]
DateRangePreset = Literal[
    "all", "1d", "7d", "30d", "mtd", "last_month", "custom"
]


@dataclass(frozen=True)
class TokenCounts:
    icw: int
    icwo: int
    cache_read: int
    output: int
    total: int


@dataclass(frozen=True)
class EventCosts:
    included: float
    free: float
    on_demand: float
    annotated: float | None = None


@dataclass
class UsageEvent:
    id: str
    timestamp: str
    local_date: str
    local_hour: int
    model: str
    pool: PoolKind | str
    kind: EventKind | str
    skip_reason: str | None
    max_mode: bool
    tokens: TokenCounts
    costs: EventCosts
    cloud_agent_id: str | None = None
    automation_id: str | None = None
    billable: bool = True


@dataclass
class FilterState:
    date_range: DateRangePreset | tuple[str, str] = "all"
    billing_mode: BillingMode = "standard"
    models: list[str] | Literal["all"] = "all"
    timezone: str = "UTC"


@dataclass
class RowCost:
    """Legacy row summary kept for CLI backward compatibility."""

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
    free_rows: int = 0
    free_tokens: int = 0
    free_cost: float = 0.0


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
    billing_mode: str = "standard"
    events: list[UsageEvent] = field(default_factory=list)

    @property
    def total_cost_with_free(self) -> float:
        return self.total_cost + self.free_cost

    @property
    def total_spend(self) -> float:
        if self.billing_mode == "official":
            return self.total_cost
        return self.total_cost_with_free

    @property
    def data_max_date(self) -> str | None:
        return self.date_to


DEFAULT_AUTO_COMPOSER_LIMIT = 145.0
DEFAULT_API_LIMIT = 45.0
DEFAULT_POOL_PLAN_LABEL = "Cursor Pro ($20/mo)"


@dataclass
class PoolLimits:
    auto_composer: float
    api: float

    @property
    def total(self) -> float:
        return self.auto_composer + self.api


DEFAULT_POOL_LIMITS = PoolLimits(
    auto_composer=DEFAULT_AUTO_COMPOSER_LIMIT,
    api=DEFAULT_API_LIMIT,
)


@dataclass
class UsageWithLimits:
    report: UsageReport
    limits: PoolLimits
    auto_composer_pct: float
    api_pct: float
    total_pct: float


@dataclass
class ReportMeta:
    file_name: str
    row_count: int
    date_from: str | None
    date_to: str | None
    data_max_date: str | None
    unknown_models: dict[str, int]
    skipped_rows: dict[str, int]
    pricing_caveats: list[str] = field(default_factory=list)
    pool_limits: PoolLimits = field(default_factory=lambda: DEFAULT_POOL_LIMITS)
