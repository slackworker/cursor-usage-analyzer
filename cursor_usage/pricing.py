"""Cursor model pricing rules (per million tokens, USD).

Sources:
- https://cursor.com/docs/models-and-pricing
- Calibrated against User1/User2 CSV exports (Jun 2026).
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

# Free rows consume the promotional/free allowance (still has token cost).
FREE_KIND = "Free"

ERRORED_KIND = "Errored, No Charge"
ABORTED_KIND = "Aborted, Not Charged"

SKIP_KINDS = frozenset({FREE_KIND, ERRORED_KIND, ABORTED_KIND})

# Canonical Kind values (case-insensitive match in normalize_kind).
_KIND_ALIASES: dict[str, str] = {
    "included": BILLABLE_KIND,
    "free": FREE_KIND,
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


def is_skip_kind(kind: str) -> bool:
    return normalize_kind(kind) in SKIP_KINDS


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

AUTO_COMPOSER_MODELS = frozenset({"auto", "composer-1", "composer-2.5-fast"})
API_MODELS = frozenset(
    {
        "gpt-5.2-codex",
        "gpt-5.3-codex",
        "gpt-5.3-codex-high",
        "claude-4.5-sonnet-thinking",
        "claude-4.6-sonnet-medium-thinking",
        "claude-4.6-opus-high-thinking",
        "agent_review",
    }
)

# Claude thinking variants: share of output billed at input rate (see calculator).
CLAUDE_THINKING_MODELS = frozenset(
    {
        "claude-4.5-sonnet-thinking",
        "claude-4.6-sonnet-medium-thinking",
        "claude-4.6-opus-high-thinking",
    }
)

# Claude thinking: share of output tokens billed at input rate.
CLAUDE_THINKING_OUTPUT_RATIO = 0.31

# Bugbot agent_review (Included): Auto pool rates with this multiplier (User1 calibrated).
BUGBOT_AUTO_MULTIPLIER = 0.849

# Bugbot agent_review (Free): January 2026 sample bills cache_read only at Auto pool rate.
# If reconcile still shows a gap, official discount may be the cause — not a different rule.
BUGBOT_FREE_CACHE_READ_ONLY = True

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
    "composer-2.5-fast": ModelPricing(
        input=3.0,
        cache_write=3.0,
        cache_read=0.5,
        output=15.0,
        pool="auto_composer",
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
    "agent_review": ModelPricing(
        input=1.25,
        cache_write=1.25,
        cache_read=0.25,
        output=6.0,
        pool="api",
    ),
}
