import csv
from collections import defaultdict

OFFICIAL = {
    "2026-06-22": {"auto": 6.64, "composer-2.5-fast": 2.15, "gpt-5.3-codex": 6.79},
    "2026-06-23": {"auto": 8.01, "composer-2.5-fast": 1.96, "gpt-5.3-codex": 7.66},
    "2026-06-24": {"auto": 4.36, "composer-2.5-fast": 10.32, "gpt-5.3-codex": 6.72},
    "2026-06-25": {"auto": 2.21, "composer-2.5-fast": 23.61, "gpt-5.3-codex": 9.98},
}

PRICING = {
    "auto": {"input": 1.25, "cache_write": 1.25, "cache_read": 0.25, "output": 6.00},
    "composer-2.5-fast": {"input": 3.0, "cache_write": 3.0, "cache_read": 0.5, "output": 15.0},
    "gpt-5.3-codex": {"input": 1.75, "cache_write": 1.75, "cache_read": 0.175, "output": 14.0},
    "gpt-5.3-codex-high": {"input": 1.75, "cache_write": 1.75, "cache_read": 0.175, "output": 14.0},
    "claude-4.6-sonnet-medium-thinking": {
        "input": 3.0,
        "cache_write": 3.75,
        "cache_read": 0.3,
        "output": 15.0,
    },
}


def row_cost(row, pricing, model=None):
    model = model or row["Model"]
    icw = int(row["Input (w/ Cache Write)"] or 0)
    icwo = int(row["Input (w/o Cache Write)"] or 0)
    cr = int(row["Cache Read"] or 0)
    out = int(row["Output Tokens"] or 0)

    if model == "claude-4.6-sonnet-medium-thinking":
        think = int(out * 0.31)
        reg = out - think
        return (
            icw / 1e6 * pricing["cache_write"]
            + icwo / 1e6 * pricing["input"]
            + cr / 1e6 * pricing["cache_read"]
            + think / 1e6 * pricing["input"]
            + reg / 1e6 * pricing["output"]
        )

    if model == "agent_review":
        auto = PRICING["auto"]
        base = (
            icw / 1e6 * auto["cache_write"]
            + icwo / 1e6 * auto["input"]
            + cr / 1e6 * auto["cache_read"]
            + out / 1e6 * auto["output"]
        )
        return base * 0.849

    return (
        icw / 1e6 * pricing["cache_write"]
        + icwo / 1e6 * pricing["input"]
        + cr / 1e6 * pricing["cache_read"]
        + out / 1e6 * pricing["output"]
    )


def main():
    rows = list(
        csv.DictReader(
            open(r"path/to/usage-events.csv", newline="", encoding="utf-8")
        )
    )

    print("=== DAILY (Included only, Composer 2.5 Fast: $3 / $0.5 / $15) ===\n")
    totals = defaultdict(lambda: {"official": 0.0, "calc": 0.0})

    for day in sorted(OFFICIAL):
        for model in ["auto", "composer-2.5-fast", "gpt-5.3-codex"]:
            official = OFFICIAL[day][model]
            calc = sum(
                row_cost(row, PRICING[model])
                for row in rows
                if row["Model"] == model
                and row["Date"][:10] == day
                and row["Kind"] == "Included"
            )
            delta = calc - official
            ratio = calc / official if official else 0
            totals[model]["official"] += official
            totals[model]["calc"] += calc
            print(
                f"{day}  {model:22}  official={official:7.2f}  "
                f"calc={calc:7.2f}  delta={delta:+7.2f}  ratio={ratio:.4f}"
            )
        print()

    print("4-day totals:")
    for model in ["auto", "composer-2.5-fast", "gpt-5.3-codex"]:
        official = totals[model]["official"]
        calc = totals[model]["calc"]
        print(
            f"  {model}: official={official:.2f}, calc={calc:.2f}, "
            f"delta={calc - official:+.2f}, ratio={calc / official:.4f}"
        )

    print("\n=== FULL CSV (Included only) ===")
    by_model = defaultdict(float)
    for row in rows:
        if row["Kind"] != "Included":
            continue
        model = row["Model"]
        if model in PRICING:
            by_model[model] += row_cost(row, PRICING[model])
        elif model == "agent_review":
            by_model[model] += row_cost(row, {}, model)

    for model, cost in sorted(by_model.items(), key=lambda item: -item[1]):
        print(f"  {model}: {cost:.2f}")
    print(f"  TOTAL: {sum(by_model.values()):.2f}  (official 186.64)")


if __name__ == "__main__":
    main()
