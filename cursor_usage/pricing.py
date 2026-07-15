"""Cursor model pricing rules (per million tokens, USD).

Primary source: https://cursor.com/docs/models-and-pricing
Provenance / confidence: cursor_usage.pricing_sources

Official doc has two pricing tables — do not conflate them:
- First-party models pool → Auto pricing + Composer pricing (#composer-pricing)
- API pool → Model pricing (GPT, Claude, Composer 1/2/2.5 base rows, etc.)

CSV slug composer-2.5-fast maps to Composer 2.5 (Fast) in the Composer pricing
table ($3 / $0.5 / $15), NOT the Composer 2.5 row in the API model table.

Monthly CSV samples validate totals but must not override documented rates.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class ModelPricing:
    input: float
    cache_write: float
    cache_read: float
    output: float
    pool: str


# Included rows count against the paid plan allowance.
BILLABLE_KIND = "Included"

# Free rows represent free allowance usage.
# Strict mode: all Free rows count (USD in Cost or token formula).
# Official mode: Free with USD merges into Included; status-only Free is excluded.
FREE_KIND = "Free"
FREE_STATUS_ONLY_SKIP = "Free (status-only)"

# On-demand spend (pay-as-you-go beyond plan allowance).
ON_DEMAND_KIND = "On-demand"

ERRORED_KIND = "Errored, No Charge"
ABORTED_KIND = "Aborted, Not Charged"

SKIP_KINDS = frozenset({FREE_KIND, ERRORED_KIND, ABORTED_KIND})

# Canonical Kind values (case-insensitive match in normalize_kind).
_KIND_ALIASES: dict[str, str] = {
    "included": BILLABLE_KIND,
    "free": FREE_KIND,
    "on-demand": ON_DEMAND_KIND,
    "ondemand": ON_DEMAND_KIND,
    "errored, no charge": ERRORED_KIND,
    "aborted, not charged": ABORTED_KIND,
}


def normalize_kind(kind: str) -> str:
    """Return canonical Kind; matching is case-insensitive for known values."""
    key = (kind or "").strip().casefold()
    return _KIND_ALIASES.get(key, (kind or "").strip())


def is_billable_kind(kind: str) -> bool:
    return normalize_kind(kind) == BILLABLE_KIND


def is_free_kind(kind: str) -> bool:
    return normalize_kind(kind) == FREE_KIND


def is_on_demand_kind(kind: str) -> bool:
    return normalize_kind(kind) == ON_DEMAND_KIND


def is_skip_kind(kind: str) -> bool:
    return normalize_kind(kind) in SKIP_KINDS


# Max Mode billing (see docs/spec.md §2.4).
LONG_CONTEXT_INPUT_THRESHOLD = 272_000

CODEX_MAX_MODE_FAST_MODELS = frozenset({"gpt-5.3-codex", "gpt-5.3-codex-high"})
GPT_LONG_CONTEXT_MODELS = frozenset({"gpt-5.4-medium", "gpt-5.5-medium"})

CODEX_MAX_MODE_MULTIPLIER = 2.0
LONG_CONTEXT_INPUT_MULTIPLIER = 2.0
LONG_CONTEXT_OUTPUT_MULTIPLIER = 1.5


def parse_max_mode(value: str | None) -> bool:
    """True when CSV Max Mode column is Yes (case-insensitive)."""
    return (value or "").strip().casefold() == "yes"


def token_row_cost(
    pricing: ModelPricing,
    icw: int,
    icwo: int,
    cr: int,
    out: int,
    *,
    input_mult: float = 1.0,
    cache_write_mult: float | None = None,
    cache_read_mult: float | None = None,
    output_mult: float = 1.0,
) -> float:
    cwm = cache_write_mult if cache_write_mult is not None else input_mult
    crm = cache_read_mult if cache_read_mult is not None else input_mult
    return (
        icw / 1e6 * pricing.cache_write * cwm
        + icwo / 1e6 * pricing.input * input_mult
        + cr / 1e6 * pricing.cache_read * crm
        + out / 1e6 * pricing.output * output_mult
    )


def max_mode_adjusted_cost(
    model: str,
    pricing: ModelPricing,
    icw: int,
    icwo: int,
    cr: int,
    out: int,
    *,
    max_mode: bool,
) -> float | None:
    """Return Max Mode adjusted row cost, or None to use standard pricing."""
    if not max_mode:
        return None

    if model in CODEX_MAX_MODE_FAST_MODELS:
        m = CODEX_MAX_MODE_MULTIPLIER
        return token_row_cost(pricing, icw, icwo, cr, out, input_mult=m, output_mult=m)

    if model in GPT_LONG_CONTEXT_MODELS:
        if icw + icwo + cr <= LONG_CONTEXT_INPUT_THRESHOLD:
            return None
        return token_row_cost(
            pricing,
            icw,
            icwo,
            cr,
            out,
            input_mult=LONG_CONTEXT_INPUT_MULTIPLIER,
            cache_read_mult=LONG_CONTEXT_INPUT_MULTIPLIER,
            output_mult=LONG_CONTEXT_OUTPUT_MULTIPLIER,
        )

    return None


def parse_official_row_cost(value: str | None) -> float | None:
    """Parse Cost column when it holds a USD amount (not Included/Free status)."""
    if not value:
        return None
    text = value.strip()
    if not text or text in {BILLABLE_KIND, FREE_KIND, "-"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None

AUTO_COMPOSER_MODELS = frozenset(
    {
        "auto",
        "composer-1",
        "composer-2",
        "composer-2-fast",
        "composer-2.5",
        "composer-2.5-fast",
    }
)
API_MODELS = frozenset(
    {
        "gpt-5.2",
        "gpt-5.2-codex",
        "gpt-5.3-codex",
        "gpt-5.3-codex-high",
        "gpt-5.4-medium",
        "gpt-5.5-medium",
        "claude-4.5-sonnet-thinking",
        "claude-4.6-sonnet-medium-thinking",
        "claude-4.6-opus-high-thinking",
        "claude-opus-4-7-thinking-high",
        "agent_review",
    }
)

# Bugbot agent_review: same token formula as Auto pool, optional discount (see RULE_SOURCES).
AGENT_REVIEW_DISCOUNT_RATIO = 1.0

PRICING: Mapping[str, ModelPricing] = {
    "auto": ModelPricing(
        input=1.25,
        cache_write=1.25,
        cache_read=0.25,
        output=6.0,
        pool="auto_composer",
    ),
    "composer-1": ModelPricing(
        input=1.25,
        cache_write=1.25,
        cache_read=0.125,
        output=10.0,
        pool="auto_composer",
    ),
    "composer-2": ModelPricing(
        input=0.5,
        cache_write=0.5,
        cache_read=0.2,
        output=2.5,
        pool="auto_composer",
    ),
    "composer-2-fast": ModelPricing(
        input=1.0,
        cache_write=1.0,
        cache_read=0.4,
        output=5.0,
        pool="auto_composer",
    ),
    # Composer pricing table → Composer 2.5 ($0.5 / $0.2 / $2.5); cache write at input rate.
    "composer-2.5": ModelPricing(
        input=0.5,
        cache_write=0.5,
        cache_read=0.2,
        output=2.5,
        pool="auto_composer",
    ),
    # Composer pricing table → Composer 2.5 (Fast); not the API-table Composer 2.5 row.
    "composer-2.5-fast": ModelPricing(
        input=3.0,
        cache_write=3.0,
        cache_read=0.5,
        output=15.0,
        pool="auto_composer",
    ),
    "gpt-5.2": ModelPricing(
        input=1.75,
        cache_write=1.75,
        cache_read=0.175,
        output=14.0,
        pool="api",
    ),
    "gpt-5.2-codex": ModelPricing(
        input=1.75,
        cache_write=1.75,
        cache_read=0.175,
        output=14.0,
        pool="api",
    ),
    "gpt-5.3-codex": ModelPricing(
        input=1.75,
        cache_write=1.75,
        cache_read=0.175,
        output=14.0,
        pool="api",
    ),
    "gpt-5.3-codex-high": ModelPricing(
        input=1.75,
        cache_write=1.75,
        cache_read=0.175,
        output=14.0,
        pool="api",
    ),
    "gpt-5.4-medium": ModelPricing(
        input=2.5,
        cache_write=2.5,
        cache_read=0.25,
        output=15.0,
        pool="api",
    ),
    "gpt-5.5-medium": ModelPricing(
        input=5.0,
        cache_write=5.0,
        cache_read=0.5,
        output=30.0,
        pool="api",
    ),
    "claude-4.5-sonnet-thinking": ModelPricing(
        input=3.0,
        cache_write=3.75,
        cache_read=0.3,
        output=15.0,
        pool="api",
    ),
    "claude-4.6-sonnet-medium-thinking": ModelPricing(
        input=3.0,
        cache_write=3.75,
        cache_read=0.3,
        output=15.0,
        pool="api",
    ),
    "claude-4.6-opus-high-thinking": ModelPricing(
        input=5.0,
        cache_write=6.25,
        cache_read=0.5,
        output=25.0,
        pool="api",
    ),
    "claude-opus-4-7-thinking-high": ModelPricing(
        input=5.0,
        cache_write=6.25,
        cache_read=0.5,
        output=25.0,
        pool="api",
    ),
    "agent_review": ModelPricing(
        input=1.25,
        cache_write=1.25,
        cache_read=0.25,
        output=6.0,
        pool="api",
    ),
}
