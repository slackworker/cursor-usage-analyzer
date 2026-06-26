import csv
from collections import defaultdict

CSV_PATH = r"path/to/usage-events.csv"

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

BUGBOT_FACTOR = 0.849
CLAUDE_THINKING_RATIO = 0.31


def row_cost(row):
    model = row["Model"]
    icw = int(row["Input (w/ Cache Write)"] or 0)
    icwo = int(row["Input (w/o Cache Write)"] or 0)
    cr = int(row["Cache Read"] or 0)
    out = int(row["Output Tokens"] or 0)

    if model == "claude-4.6-sonnet-medium-thinking":
        p = PRICING[model]
        think = int(out * CLAUDE_THINKING_RATIO)
        reg = out - think
        return (
            icw / 1e6 * p["cache_write"]
            + icwo / 1e6 * p["input"]
            + cr / 1e6 * p["cache_read"]
            + think / 1e6 * p["input"]
            + reg / 1e6 * p["output"]
        )

    if model == "agent_review":
        p = PRICING["auto"]
        base = (
            icw / 1e6 * p["cache_write"]
            + icwo / 1e6 * p["input"]
            + cr / 1e6 * p["cache_read"]
            + out / 1e6 * p["output"]
        )
        return base * BUGBOT_FACTOR

    if model not in PRICING:
        raise ValueError(f"Unknown model: {model}")

    p = PRICING[model]
    return (
        icw / 1e6 * p["cache_write"]
        + icwo / 1e6 * p["input"]
        + cr / 1e6 * p["cache_read"]
        + out / 1e6 * p["output"]
    )


def main():
    rows = list(csv.DictReader(open(CSV_PATH, newline="", encoding="utf-8")))

    by_model = defaultdict(lambda: {"cost": 0.0, "rows": 0, "tokens": 0})
    skipped = defaultdict(int)
    dates = []

    for row in rows:
        dates.append(row["Date"][:10])
        if row["Kind"] != "Included":
            skipped[row["Kind"]] += 1
            continue

        cost = row_cost(row)
        model = row["Model"]
        by_model[model]["cost"] += cost
        by_model[model]["rows"] += 1
        by_model[model]["tokens"] += int(row["Total Tokens"] or 0)

    total_cost = sum(v["cost"] for v in by_model.values())
    total_tokens = sum(v["tokens"] for v in by_model.values())

    print("=== usage-events.csv 费用推算 ===\n")
    print(f"数据范围: {min(dates)} ~ {max(dates)}")
    print(f"总行数: {len(rows)}，计费行 (Included): {sum(v['rows'] for v in by_model.values())}")
    if skipped:
        print(f"跳过行: {dict(skipped)}")
    print()

    for model, data in sorted(by_model.items(), key=lambda x: -x[1]["cost"]):
        print(f"{model}:")
        print(f"  请求数: {data['rows']}")
        print(f"  Token 数: {data['tokens']:,}")
        print(f"  费用: ${data['cost']:.2f}")
        print()

    print(f"合计 Token: {total_tokens:,}")
    print(f"推算总费用: ${total_cost:.2f}")


if __name__ == "__main__":
    main()
