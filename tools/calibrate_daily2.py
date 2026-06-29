import argparse
import csv
from collections import Counter, defaultdict
from pathlib import Path

DEFAULT_CSV = (
    Path(__file__).resolve().parent.parent
    / "examples"
    / "May 27 - Jun 27 US$195.22 100% + 100% .csv"
)

OFFICIAL = {
    "2026-06-22": {"auto": 6.64, "composer-2.5-fast": 2.15, "gpt-5.3-codex": 6.79},
    "2026-06-23": {"auto": 8.01, "composer-2.5-fast": 1.96, "gpt-5.3-codex": 7.66},
    "2026-06-24": {"auto": 4.36, "composer-2.5-fast": 10.32, "gpt-5.3-codex": 6.72},
    "2026-06-25": {"auto": 2.21, "composer-2.5-fast": 23.61, "gpt-5.3-codex": 9.98},
}

PRICING = {
    "auto": {"input": 1.25, "cache_write": 1.25, "cache_read": 0.25, "output": 6.00},
    "composer-2.5-fast": {"input": 3.5, "cache_write": 3.5, "cache_read": 0.35, "output": 17.5},
    "gpt-5.3-codex": {"input": 1.75, "cache_write": 1.75, "cache_read": 0.175, "output": 14.0},
}

BILLABLE_KINDS = {"Included"}
SKIP_KINDS = {"Free", "Errored, No Charge", "Aborted, Not Charged"}


def row_cost(row, pricing):
    icw = int(row["Input (w/ Cache Write)"] or 0)
    icwo = int(row["Input (w/o Cache Write)"] or 0)
    cr = int(row["Cache Read"] or 0)
    out = int(row["Output Tokens"] or 0)
    return (
        icw / 1e6 * pricing["cache_write"]
        + icwo / 1e6 * pricing["input"]
        + cr / 1e6 * pricing["cache_read"]
        + out / 1e6 * pricing["output"]
    )


def parse_args():
    parser = argparse.ArgumentParser(
        description="Compare revised pricing scenarios against official dashboard benchmarks."
    )
    parser.add_argument(
        "csv",
        nargs="?",
        type=Path,
        default=DEFAULT_CSV,
        help="Cursor usage export CSV (default: bundled example)",
    )
    return parser.parse_args()


def load_rows(csv_path: Path):
    with open(csv_path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def daily_cost(rows, model, day, pricing, kind_filter=None):
    total = 0.0
    n = 0
    for row in rows:
        if row["Model"] != model or row["Date"][:10] != day:
            continue
        if kind_filter and row["Kind"] not in kind_filter:
            continue
        total += row_cost(row, pricing)
        n += 1
    return total, n


def main():
    rows = load_rows(parse_args().csv)

    print("=== REVISED MODEL ===")
    print("auto: Auto pool doc rates")
    print("composer-2.5-fast: Composer 1.5 rates (NOT Composer 2.5 doc rates)")
    print("gpt-5.3-codex: GPT-5.3 Codex API rates")
    print()

    scenarios = [
        ("all_rows", None),
        ("Included_only", BILLABLE_KINDS),
        ("exclude_Free+Errored+Aborted", lambda k: k not in SKIP_KINDS),
    ]

    for scen_name, kind_filter in scenarios:
        print(f"--- Scenario: {scen_name} ---")
        print(f"{'Date':<12} {'Model':<22} {'Official':>8} {'Calc':>8} {'Delta':>8} {'Ratio':>7}")
        totals = defaultdict(lambda: {"o": 0.0, "c": 0.0})
        for day in sorted(OFFICIAL):
            for model in PRICING:
                official = OFFICIAL[day][model]
                if callable(kind_filter):
                    calc, n = 0.0, 0
                    for row in rows:
                        if row["Model"] != model or row["Date"][:10] != day:
                            continue
                        if not kind_filter(row["Kind"]):
                            continue
                        calc += row_cost(row, PRICING[model])
                        n += 1
                else:
                    calc, n = daily_cost(rows, model, day, PRICING[model], kind_filter)
                delta = calc - official
                ratio = calc / official if official else 0
                totals[model]["o"] += official
                totals[model]["c"] += calc
                print(
                    f"{day:<12} {model:<22} {official:8.2f} {calc:8.2f} "
                    f"{delta:+8.2f} {ratio:7.3f}"
                )
            print()
        print("Totals:")
        for model in PRICING:
            o, c = totals[model]["o"], totals[model]["c"]
            print(f"  {model}: official={o:.2f}, calc={c:.2f}, delta={c-o:+.2f}, ratio={c/o:.4f}")
        print()

    # June 22 deep dive
    print("=== JUNE 22 DEEP DIVE ===")
    for model in PRICING:
        day = "2026-06-22"
        print(f"\n{model}:")
        by_kind = defaultdict(float)
        counts = Counter()
        for row in rows:
            if row["Model"] != model or row["Date"][:10] != day:
                continue
            by_kind[row["Kind"]] += row_cost(row, PRICING[model])
            counts[row["Kind"]] += 1
        for kind in sorted(by_kind):
            print(f"  {kind}: {counts[kind]} rows, cost={by_kind[kind]:.4f}")

    # Grand total check with revised model for Jun 22-25
    print("\n=== GRAND TOTAL Jun 22-25 (Included only, revised pricing) ===")
    grand_official = sum(sum(d.values()) for d in OFFICIAL.values())
    grand_calc = 0.0
    for day in OFFICIAL:
        for model in PRICING:
            c, _ = daily_cost(rows, model, day, PRICING[model], BILLABLE_KINDS)
            grand_calc += c
    print(f"Official subtotal (3 models, 4 days): {grand_official:.2f}")
    print(f"Revised calc (Included only): {grand_calc:.2f}")
    print(f"Delta: {grand_calc - grand_official:+.2f}")


if __name__ == "__main__":
    main()
