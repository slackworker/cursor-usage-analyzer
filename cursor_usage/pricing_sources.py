"""Pricing confidence and provenance for each model / billing rule.

Official rates: https://cursor.com/docs/models-and-pricing

Two doc tables: (1) Auto + Composer pool — Auto pricing + Composer pricing
(#composer-pricing); (2) API pool — Model pricing. composer-2.5-fast is in (1).

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
        PricingConfidence.CSV_RECONCILED,
        "Composer 2 (2×)",
        'CSV slug → 2× Composer 2 ($1 / $0.4 / $5); dashboard 按模型日合计 7 日验证，见 spec §3.1',
    ),
    "composer-2.5-fast": PricingSource(
        PricingConfidence.CSV_RECONCILED,
        "Composer pricing → Composer 2.5 (Fast)",
        'CSV slug → #composer-pricing ($3 / $0.5 / $15); June 22–25 dashboard 按模型日合计验证，4 日合计偏差 +0.4%，见 spec §3.1',
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
        'CSV slug "claude-4.5-sonnet-thinking" → Claude 4.5 Sonnet doc row (thinking effort variant)',
    ),
    "claude-4.6-sonnet-medium-thinking": PricingSource(
        PricingConfidence.SLUG_MAPPED,
        "Claude 4.6 Sonnet",
        'CSV slug "claude-4.6-sonnet-medium-thinking" → Claude 4.6 Sonnet doc row ($3 / $3.75 / $0.3 / $15)',
    ),
    "claude-4.6-opus-high-thinking": PricingSource(
        PricingConfidence.SLUG_MAPPED,
        "Claude 4.6 Opus",
        'CSV slug "claude-4.6-opus-high-thinking" → Claude 4.6 Opus doc row (thinking effort variant)',
    ),
    "claude-opus-4-7-thinking-high": PricingSource(
        PricingConfidence.SLUG_MAPPED,
        "Claude 4.7 Opus",
        'CSV slug "claude-opus-4-7-thinking-high" → Claude 4.7 Opus doc row',
    ),
    "agent_review": PricingSource(
        PricingConfidence.CSV_INFERRED,
        "(Bugbot; no per-token row in models table)",
        "Auto-pool 4-column base; 3 dashboard samples show ~53–61% of full price — no stable ratio yet",
    ),
}

# Billing rules that are not plain per-model token rates.
RULE_SOURCES: dict[str, PricingSource] = {
    "AGENT_REVIEW_DISCOUNT_RATIO": PricingSource(
        PricingConfidence.UNCONFIRMED,
        "(not in models table)",
        "Default 1.0 (full price); samples show discount but ratio varies — do not calibrate until more data",
    ),
    "MAX_MODE_CODEX_FAST": PricingSource(
        PricingConfidence.OFFICIAL_DOC,
        "GPT-5.3 Codex / Max Mode",
        "Max Mode=Yes on gpt-5.3-codex* → Fast priority, all token types ×2; see spec §3.2",
    ),
    "MAX_MODE_GPT_LONG_CONTEXT": PricingSource(
        PricingConfidence.OFFICIAL_DOC,
        "GPT-5.4 / GPT-5.5",
        "Max Mode=Yes and input (icw+icwo+cr) > 272k → input side ×2, output ×1.5; see spec §3.2",
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
