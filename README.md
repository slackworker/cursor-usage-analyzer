# Cursor Usage Calculator

根据 Cursor 导出的用量 CSV，推算 token 费用，并可结合基准账单推测套餐池使用率。

定价规则以 [Cursor Models & Pricing](https://cursor.com/docs/models-and-pricing) 为准；月度 CSV 用于验证总量。非官方文档项见 [`cursor_usage/pricing_sources.py`](cursor_usage/pricing_sources.py) 与 [`docs/spec.md`](docs/spec.md) §3.1。

Dashboard **Total spend** = Included + On-demand + Free（当前样例中 On-demand 均为 0）。详见 [`docs/spec.md`](docs/spec.md)。

## 功能

- 解析 Cursor 用量 CSV
- 按 `Kind` 拆分：`Included` → `total_cost`，`Free` 支持两种模式（`official`/`strict`），合计 → `total_cost_with_free`
- 跳过 `Errored, No Charge`、`Aborted, Not Charged`
- 按模型、用量池（Auto+Composer / API）汇总费用
- 可选：根据基准 CSV + 池使用率推测套餐额度，并计算目标 CSV 的使用百分比

## 安装

```bash
cd ~/projects/cursor-usage-calculator
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

Windows（WSL 挂载路径）:

```powershell
cd V:\home\slackworker\projects\cursor-usage-calculator
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

## 用法

### 基础费用推算

```bash
cursor-usage "examples/February - US\$46.57.csv"
```

Free 费用口径切换：

```bash
cursor-usage "examples/May - US\$92.01.csv" --free-pricing-mode official  # 默认
cursor-usage "examples/May - US\$92.01.csv" --free-pricing-mode strict
```

或:

```bash
python -m cursor_usage.cli "examples/January - US\$1.61.csv"
```

### 与官方逐行对账（Cost 列为美元金额时）

```bash
cursor-usage "examples/January - US\$1.61.csv" --reconcile
```

### 推测套餐额度并计算使用率

```bash
cursor-usage target.csv \
  --baseline "examples/February - US\$46.57.csv" \
  --auto-composer-usage 0.95 \
  --api-usage 0.99
```

### JSON 输出

```bash
cursor-usage "examples/February - US\$46.57.csv" --json
```

## 计费规则摘要

| 模型 | Input | Cache Read | Output | 池 |
|------|-------|------------|--------|-----|
| auto | $1.25/M | $0.25/M | $6/M | Auto+Composer（Auto pricing 表） |
| composer-1 | $1.25/M | $0.125/M | $10/M | Auto+Composer（API Model pricing 表） |
| composer-2 | $0.5/M | $0.2/M | $2.5/M | Auto+Composer（API Model pricing 表） |
| composer-2-fast | $1/M | $0.4/M | $5/M | Auto+Composer（2× Composer 2） |
| composer-2.5-fast | $3/M | $0.5/M | $15/M | Auto+Composer（[Composer pricing 表](https://cursor.com/docs/models-and-pricing#composer-pricing) → Composer 2.5 **Fast**） |
| gpt-5.2-codex / gpt-5.3-codex | $1.75/M | $0.175/M | $14/M | API |
| gpt-5.4-medium | $2.5/M | $0.25/M | $15/M | API |
| gpt-5.5-medium | $5/M | $0.5/M | $30/M | API |
| gpt-5.3-codex-high | 同上 | 同上 | 同上 | API |
| claude-4.5/4.6 sonnet thinking | $3/$3.75 CW | $0.3/M | $15/M | API |
| claude-4.6-opus / claude-opus-4-7 thinking-high | $5/$6.25 CW | $0.5/M | $25/M | API |
| agent_review (Bugbot) | 同 Auto 池四列计费；可选 `AGENT_REVIEW_DISCOUNT_RATIO` | | | API |

## 项目结构

```
cursor-usage-calculator/
├── cursor_usage/
│   ├── pricing.py
│   ├── calculator.py
│   └── cli.py
├── examples/          # 月度 golden CSV（January–June，后续追加）
├── docs/spec.md
├── tools/
├── pyproject.toml
└── README.md
```

## 许可

MIT
