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

SKIP_KINDS = frozenset({FREE_KIND, "Errored, No Charge", "Aborted, Not Charged"})

AUTO_COMPOSER_MODELS = frozenset({"auto", "composer-2.5-fast"})
API_MODELS = frozenset(
    {
        "gpt-5.3-codex",
        "gpt-5.3-codex-high",
        "claude-4.6-sonnet-medium-thinking",
        "agent_review",
    }
)

# Claude thinking: share of output tokens billed at input rate.
CLAUDE_THINKING_OUTPUT_RATIO = 0.31

# Bugbot agent_review: Auto pool rates with this multiplier (calibrated).
BUGBOT_AUTO_MULTIPLIER = 0.849

PRICING: Mapping[str, ModelPricing] = {
    "auto": ModelPricing(
        input=1.25,
        cache_write=1.25,
        cache_read=0.25,
        output=6.0,
        pool="auto_composer",
    ),
    "composer-2.5-fast": ModelPricing(
        input=3.0,
        cache_write=3.0,
        cache_read=0.5,
        output=15.0,
        pool="auto_composer",
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
    "claude-4.6-sonnet-medium-thinking": ModelPricing(
        input=3.0,
        cache_write=3.75,
        cache_read=0.3,
        output=15.0,
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
