"""Pricing confidence and provenance for each model / billing rule.

Official rates: https://cursor.com/docs/models-and-pricing

When the doc shows "-" for cache write, we bill cache write at the input rate
(same convention as GPT-5.2, Composer 1, etc. in this codebase).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class PricingConfidence(str, Enum):
    """How we know a rate or billing rule."""

    OFFICIAL_DOC = "official_doc"
    """Listed in Cursor models-and-pricing table (or Auto/Composer pool table)."""

    CSV_RECONCILED = "csv_reconciled"
    """Verified against per-row USD Cost in a sample CSV (--reconcile)."""

    CSV_INFERRED = "csv_inferred"
    """Inferred from monthly aggregate vs official Total; not in docs."""

    SLUG_MAPPED = "slug_mapped"
    """CSV model slug mapped to an official doc row (name differs, rates from doc)."""

    UNCONFIRMED = "unconfirmed"
    """Needs user clarification — do not treat as ground truth."""


@dataclass(frozen=True)
class PricingSource:
    confidence: PricingConfidence
    doc_ref: str
    note: str = ""


# Per-model token rates (PRICING dict keys).
MODEL_SOURCES: dict[str, PricingSource] = {
    "auto": PricingSource(
        PricingConfidence.OFFICIAL_DOC,
        "Auto + Composer pool → Auto pricing",
    ),
    "composer-1": PricingSource(
        PricingConfidence.OFFICIAL_DOC,
        "Composer 1",
    ),
    "composer-2": PricingSource(
        PricingConfidence.OFFICIAL_DOC,
        "Composer 2",
    ),
    "composer-2-fast": PricingSource(
        PricingConfidence.SLUG_MAPPED,
        "Composer 2",
        'CSV slug "composer-2-fast" → Composer 2 doc row ($0.5 / $0.2 / $2.5)',
    ),
    "composer-2.5-fast": PricingSource(
        PricingConfidence.CSV_INFERRED,
        "(no separate doc row)",
        "Doc lists Composer 2.5 standard only ($0.5 / $0.2 / $2.5); "
        "$3 / $0.5 / $15 fast-tier rates not in models table — needs confirmation",
    ),
    "gpt-5.2": PricingSource(
        PricingConfidence.OFFICIAL_DOC,
        "GPT-5.2",
    ),
    "gpt-5.2-codex": PricingSource(
        PricingConfidence.OFFICIAL_DOC,
        "GPT-5.2 Codex",
    ),
    "gpt-5.3-codex": PricingSource(
        PricingConfidence.OFFICIAL_DOC,
        "GPT-5.3 Codex",
    ),
    "gpt-5.3-codex-high": PricingSource(
        PricingConfidence.SLUG_MAPPED,
        "GPT-5.3 Codex",
        'CSV slug "gpt-5.3-codex-high" → GPT-5.3 Codex doc row (high effort variant)',
    ),
    "gpt-5.4-medium": PricingSource(
        PricingConfidence.SLUG_MAPPED,
        "GPT-5.4",
        'CSV slug "gpt-5.4-medium" → GPT-5.4 doc row',
    ),
    "gpt-5.5-medium": PricingSource(
        PricingConfidence.SLUG_MAPPED,
        "GPT-5.5",
        'CSV slug "gpt-5.5-medium" → GPT-5.5 doc row ($5 / $0.5 / $30)',
    ),
    "claude-4.5-sonnet-thinking": PricingSource(
        PricingConfidence.SLUG_MAPPED,
        "Claude 4.5 Sonnet",
        'CSV slug; thinking output split uses CLAUDE_THINKING_OUTPUT_RATIO (csv_inferred)',
    ),
    "claude-4.6-sonnet-medium-thinking": PricingSource(
        PricingConfidence.SLUG_MAPPED,
        "Claude 4.6 Sonnet",
        'CSV slug "claude-4.6-sonnet-medium-thinking"; thinking split csv_inferred',
    ),
    "claude-4.6-opus-high-thinking": PricingSource(
        PricingConfidence.SLUG_MAPPED,
        "Claude 4.6 Opus",
        'CSV slug; thinking split csv_inferred',
    ),
    "claude-opus-4-7-thinking-high": PricingSource(
        PricingConfidence.SLUG_MAPPED,
        "Claude 4.7 Opus",
        'CSV slug "claude-opus-4-7-thinking-high" → Claude 4.7 Opus doc row',
    ),
    "agent_review": PricingSource(
        PricingConfidence.CSV_INFERRED,
        "(Bugbot; no per-token row in models table)",
        "Uses Auto pool rates × BUGBOT_AUTO_MULTIPLIER (Included) or cache-read-only (Free)",
    ),
}

# Billing rules that are not plain per-model token rates.
RULE_SOURCES: dict[str, PricingSource] = {
    "CLAUDE_THINKING_OUTPUT_RATIO": PricingSource(
        PricingConfidence.CSV_INFERRED,
        "(not in models table)",
        "~31% of output tokens billed at input rate; fitted from Jan–Feb 2026 samples",
    ),
    "BUGBOT_AUTO_MULTIPLIER": PricingSource(
        PricingConfidence.CSV_INFERRED,
        "(not in models table)",
        "Included agent_review = Auto pool × 0.849; fitted from January reconcile",
    ),
    "BUGBOT_FREE_CACHE_READ_ONLY": PricingSource(
        PricingConfidence.CSV_RECONCILED,
        "(not in models table)",
        "Free agent_review bills cache_read only; verified January --reconcile (1 row)",
    ),
}


def unconfirmed_items() -> list[tuple[str, PricingSource]]:
    """Models and rules that are not official_doc or csv_reconciled."""
    items: list[tuple[str, PricingSource]] = []
    for key, src in {**MODEL_SOURCES, **RULE_SOURCES}.items():
        if src.confidence not in (
            PricingConfidence.OFFICIAL_DOC,
            PricingConfidence.CSV_RECONCILED,
        ):
            items.append((key, src))
    return items
