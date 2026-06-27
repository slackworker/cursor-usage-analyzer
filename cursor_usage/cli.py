#!/usr/bin/env python3
"""CLI for Cursor usage CSV cost estimation."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from cursor_usage.calculator import (
    PoolLimits,
    UsageReport,
    analyze_csv,
    apply_limits,
    infer_limits_from_baseline,
    pool_cost,
    pool_cost_with_free,
    pool_free_cost,
)
from cursor_usage.pricing import (
    AGENT_REVIEW_DISCOUNT_RATIO,
    BILLABLE_KIND,
    FREE_KIND,
    FREE_STATUS_ONLY_SKIP,
)
from cursor_usage.pricing_sources import MODEL_SOURCES, RULE_SOURCES, PricingConfidence
from cursor_usage.reconcile import DISCOUNT_NOTE, reconcile_csv


def _print_pricing_caveats(report: UsageReport) -> None:
    """Warn when the report uses rates or rules not from official docs."""
    used_models = set(report.by_model) | {
        r.model for r in report.row_costs if r.model and not r.billable and r.cost > 0
    }
    caveats: list[str] = []
    for model in sorted(used_models):
        src = MODEL_SOURCES.get(model)
        if src and src.confidence in (
            PricingConfidence.CSV_INFERRED,
            PricingConfidence.UNCONFIRMED,
        ):
            caveats.append(f"  {model}: [{src.confidence.value}] {src.doc_ref} — {src.note}")

    if "agent_review" in used_models:
        agent_src = MODEL_SOURCES["agent_review"]
        if agent_src.confidence in (
            PricingConfidence.CSV_INFERRED,
            PricingConfidence.UNCONFIRMED,
        ):
            caveats.append(
                f"  agent_review: [{agent_src.confidence.value}] {agent_src.note}"
            )
        if AGENT_REVIEW_DISCOUNT_RATIO != 1.0:
            src = RULE_SOURCES["AGENT_REVIEW_DISCOUNT_RATIO"]
            caveats.append(
                f"  AGENT_REVIEW_DISCOUNT_RATIO={AGENT_REVIEW_DISCOUNT_RATIO}: "
                f"[{src.confidence.value}] {src.note}"
            )

    if caveats:
        print("费率置信度提示（非官方文档项，详见 docs/spec.md §3.1 / pricing_sources.py）:")
        print("\n".join(caveats))
        print()


def _print_report(report: UsageReport) -> None:
    print(f"文件: {report.source}")
    if report.date_from and report.date_to:
        print(f"日期范围: {report.date_from} ~ {report.date_to}")
    print(f"总行数: {report.total_rows}，计费行 ({BILLABLE_KIND}): {report.billable_rows}")
    if report.skipped_rows:
        skipped = ", ".join(f"{k}={v}" for k, v in sorted(report.skipped_rows.items()))
        print(f"跳过行: {skipped}")
    if report.unknown_models:
        unknown = ", ".join(f"{k}={v}" for k, v in sorted(report.unknown_models.items()))
        print(f"未识别模型: {unknown}")
    print()
    print(f"计费模式: {report.billing_mode}")
    if report.billing_mode == "official" and report.skipped_rows.get(FREE_STATUS_ONLY_SKIP):
        print(
            f"  （{FREE_STATUS_ONLY_SKIP} 行已排除，"
            f"Cost 有金额的 {FREE_KIND} 行已并入 {BILLABLE_KIND}）"
        )
    print()

    print("按模型:")
    for model, summary in sorted(
        report.by_model.items(), key=lambda x: -(x[1].cost + x[1].free_cost)
    ):
        line = (
            f"  {model:40} ${summary.cost:8.2f}  "
            f"({summary.rows} 行, {summary.tokens:,} tokens, pool={summary.pool})"
        )
        if summary.free_rows:
            line += (
                f"  |  {FREE_KIND}: ${summary.free_cost:.2f}  "
                f"({summary.free_rows} 行, {summary.free_tokens:,} tokens)"
            )
        print(line)
    print()

    print("按用量池:")
    for pool, summary in sorted(report.by_pool.items()):
        line = (
            f"  {pool:20} ${summary.cost:8.2f}  "
            f"({summary.rows} 行, {summary.tokens:,} tokens)"
        )
        if summary.free_cost:
            line += f"  |  {FREE_KIND}: ${summary.free_cost:.2f}"
        print(line)
    print()

    print(f"合计 Token: {report.total_tokens:,}")
    if report.billing_mode == "strict":
        print(f"{BILLABLE_KIND} 费用:              ${report.total_cost:.2f}")
        if report.free_rows:
            print(
                f"{FREE_KIND} 费用:                  ${report.free_cost:.2f}  "
                f"({report.free_rows} 行)"
            )
        print(f"Total（Included+Free）:    ${report.total_spend:.2f}")
    else:
        print(f"Total（Included+On-demand）: ${report.total_spend:.2f}")
    print(
        "注：按文档全价推算；未建模的限时折扣或活动价可能使 Dashboard 低于推算值，"
        "差异幅度不固定。"
    )


def _print_reconcile(path: Path) -> int:
    result = reconcile_csv(path)
    if not result.has_official_costs:
        print("官方对账: Cost 列无美元金额（仅为 Included/Free 状态），跳过逐行比对。")
        return 0

    print()
    print("官方对账（Cost 列为美元金额的行）:")
    print(f"  可比行数: {result.official_rows}")
    print(
        f"  官方合计: ${result.official_total:.2f}  "
        f"推算合计(逐行四舍五入): ${result.calculated_total_rounded:.2f}  "
        f"差额: ${result.calculated_total_rounded - result.official_total:+.2f}"
    )
    mismatches = result.mismatch_rows
    if mismatches:
        print(f"  超差行数: {len(mismatches)}（容差 ±$0.01/行）")
        for row in mismatches:
            print(
                f"    {row.date} {row.model} ({row.kind}): "
                f"官方 ${row.official_cost:.2f}  推算 ${row.calculated_cost_rounded:.2f}  "
                f"Δ {row.delta:+.2f}"
            )
            if row.note:
                print(f"      → {row.note}")
    else:
        print("  逐行比对: 全部在容差内")

    discounts = result.possible_discount_rows
    if discounts and not mismatches:
        print(f"  注: {DISCOUNT_NOTE}")
    return 1 if mismatches else 0


def _reconcile_to_json(path: Path) -> dict:
    result = reconcile_csv(path)
    return {
        "has_official_costs": result.has_official_costs,
        "official_rows": result.official_rows,
        "official_total": round(result.official_total, 4),
        "calculated_total_rounded": round(result.calculated_total_rounded, 4),
        "delta": round(result.calculated_total_rounded - result.official_total, 4),
        "mismatch_count": len(result.mismatch_rows),
        "rows": [
            {
                "date": r.date,
                "model": r.model,
                "kind": r.kind,
                "official_cost": r.official_cost,
                "calculated_cost": round(r.calculated_cost, 4),
                "calculated_cost_rounded": r.calculated_cost_rounded,
                "delta": round(r.delta, 4),
                "within_tolerance": r.within_tolerance,
                "possible_discount": r.possible_discount,
                "note": r.note,
            }
            for r in result.rows
        ],
    }


def _print_limits(result) -> None:
    limits = result.limits
    report = result.report
    ac_used = pool_cost(report, "auto_composer")
    api_used = pool_cost(report, "api")
    ac_free = pool_free_cost(report, "auto_composer")
    api_free = pool_free_cost(report, "api")
    ac_with_free = pool_cost_with_free(report, "auto_composer")
    api_with_free = pool_cost_with_free(report, "api")

    print()
    print("套餐额度与使用率:")
    print(f"  Auto+Composer 额度: ${limits.auto_composer:.2f}")
    print(f"  API 额度:           ${limits.api:.2f}")
    print(f"  合计额度:           ${limits.total:.2f}")
    print()
    print(f"  Auto+Composer 已用（不含 {FREE_KIND}）: ${ac_used:.2f}  ({result.auto_composer_pct:.1f}%)")
    print(f"  API 已用（不含 {FREE_KIND}）:           ${api_used:.2f}  ({result.api_pct:.1f}%)")
    print(f"  合计已用（不含 {FREE_KIND}）:           ${report.total_cost:.2f}  ({result.total_pct:.1f}%)")
    if report.free_rows:
        ac_pct_free = (ac_with_free / limits.auto_composer * 100) if limits.auto_composer else 0.0
        api_pct_free = (api_with_free / limits.api * 100) if limits.api else 0.0
        total_pct_free = (
            report.total_cost_with_free / limits.total * 100
        ) if limits.total else 0.0
        print()
        print(f"  Auto+Composer 已用（含 {FREE_KIND}）:   ${ac_with_free:.2f}  ({ac_pct_free:.1f}%)")
        print(f"  API 已用（含 {FREE_KIND}）:             ${api_with_free:.2f}  ({api_pct_free:.1f}%)")
        print(
            f"  合计已用（含 {FREE_KIND}）:             "
            f"${report.total_cost_with_free:.2f}  ({total_pct_free:.1f}%)"
        )


def _to_json(report: UsageReport, limits_result=None) -> dict:
    payload = {
        "source": report.source,
        "date_from": report.date_from,
        "date_to": report.date_to,
        "total_rows": report.total_rows,
        "billable_rows": report.billable_rows,
        "skipped_rows": report.skipped_rows,
        "unknown_models": report.unknown_models,
        "total_tokens": report.total_tokens,
        "billing_mode": report.billing_mode,
        "free_pricing_mode": report.billing_mode,
        "total_cost": round(report.total_cost, 4),
        "free_rows": report.free_rows,
        "free_cost": round(report.free_cost, 4),
        "total_cost_with_free": round(report.total_cost_with_free, 4),
        "total_spend": round(report.total_spend, 4),
        "by_model": {
            k: {
                "pool": v.pool,
                "rows": v.rows,
                "tokens": v.tokens,
                "cost": round(v.cost, 4),
                "free_rows": v.free_rows,
                "free_tokens": v.free_tokens,
                "free_cost": round(v.free_cost, 4),
            }
            for k, v in report.by_model.items()
        },
        "by_pool": {
            k: {
                "rows": v.rows,
                "tokens": v.tokens,
                "cost": round(v.cost, 4),
                "free_cost": round(v.free_cost, 4),
                "cost_with_free": round(v.cost + v.free_cost, 4),
            }
            for k, v in report.by_pool.items()
        },
    }
    if limits_result is not None:
        payload["limits"] = {
            "auto_composer": round(limits_result.limits.auto_composer, 4),
            "api": round(limits_result.limits.api, 4),
            "total": round(limits_result.limits.total, 4),
        }
        payload["usage_percent"] = {
            "auto_composer": round(limits_result.auto_composer_pct, 2),
            "api": round(limits_result.api_pct, 2),
            "total": round(limits_result.total_pct, 2),
        }
    return payload


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cursor-usage",
        description="根据 Cursor 导出的 CSV 推算 token 费用与套餐池使用率。",
    )
    parser.add_argument("csv", type=Path, help="要分析的 CSV 文件路径")
    parser.add_argument(
        "--baseline",
        type=Path,
        help="用于推测套餐额度的基准 CSV（例如整月账单）",
    )
    parser.add_argument(
        "--auto-composer-usage",
        type=float,
        metavar="RATIO",
        help="基准 CSV 中 Auto+Composer 池使用率，如 0.95 表示 95%%",
    )
    parser.add_argument(
        "--api-usage",
        type=float,
        metavar="RATIO",
        help="基准 CSV 中 API 池使用率，如 0.99 表示 99%%",
    )
    parser.add_argument(
        "--auto-composer-limit",
        type=float,
        metavar="USD",
        help="直接指定 Auto+Composer 池总额度（美元）",
    )
    parser.add_argument(
        "--api-limit",
        type=float,
        metavar="USD",
        help="直接指定 API 池总额度（美元）",
    )
    parser.add_argument(
        "--billing-mode",
        "--free-pricing-mode",
        dest="billing_mode",
        choices=("official", "strict"),
        default="strict",
        help=(
            "计费模式：strict=Total=Included+Free（Free 含金额行与 token 推算行，默认）；"
            "official=Total=Included+On-demand（Cost 有金额的 Free 并入 Included，"
            "status-only Free 不计入）"
        ),
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="以 JSON 格式输出结果",
    )
    parser.add_argument(
        "--reconcile",
        action="store_true",
        help="与 Cost 列美元金额逐行对账（若有）；超差时 exit 1",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if not args.csv.exists():
        parser.error(f"文件不存在: {args.csv}")

    report = analyze_csv(args.csv, billing_mode=args.billing_mode)
    limits_result = None

    has_limit_flags = args.auto_composer_limit is not None or args.api_limit is not None
    has_baseline_flags = args.baseline is not None or args.auto_composer_usage is not None or args.api_usage is not None

    if has_limit_flags and has_baseline_flags:
        parser.error("请只使用 --baseline 或 --*-limit 其中一种方式指定额度")

    if has_limit_flags:
        if args.auto_composer_limit is None or args.api_limit is None:
            parser.error("使用额度模式时需同时提供 --auto-composer-limit 和 --api-limit")
        limits = PoolLimits(
            auto_composer=args.auto_composer_limit,
            api=args.api_limit,
        )
        limits_result = apply_limits(report, limits)
    elif has_baseline_flags:
        if args.baseline is None or args.auto_composer_usage is None or args.api_usage is None:
            parser.error("基准模式需同时提供 --baseline、--auto-composer-usage、--api-usage")
        if not args.baseline.exists():
            parser.error(f"基准文件不存在: {args.baseline}")
        # Pool limit inference aligns with Dashboard spend (official Free rules).
        baseline = analyze_csv(args.baseline, billing_mode="official")
        limits = infer_limits_from_baseline(
            baseline,
            auto_composer_usage=args.auto_composer_usage,
            api_usage=args.api_usage,
        )
        limits_result = apply_limits(report, limits)

    if args.json:
        payload = _to_json(report, limits_result)
        if args.reconcile:
            payload["reconcile"] = _reconcile_to_json(args.csv)
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        if args.reconcile and payload.get("reconcile", {}).get("mismatch_count", 0) > 0:
            return 1
        return 0

    _print_report(report)
    _print_pricing_caveats(report)
    if limits_result is not None:
        if args.baseline is not None:
            print()
            print(
                f"额度来源: 基准文件 {args.baseline} "
                f"(Auto+Composer {args.auto_composer_usage:.0%}, API {args.api_usage:.0%})"
            )
        _print_limits(limits_result)

    exit_code = 0
    if args.reconcile:
        exit_code = _print_reconcile(args.csv)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
