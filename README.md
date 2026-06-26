# Cursor Usage Calculator

根据 Cursor 导出的用量 CSV，推算 token 费用，并可结合基准账单推测套餐池使用率。

定价规则基于 [Cursor Models & Pricing](https://cursor.com/docs/models-and-pricing)，并经 2026-06 实际账单校准。

## 功能

- 解析 Cursor 用量 CSV
- 仅统计 `Kind = Included` 的计费行
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
cursor-usage /path/to/usage.csv
```

或:

```bash
python -m cursor_usage.cli /path/to/usage.csv
```

### 推测套餐额度并计算使用率

```bash
cursor-usage User2.csv \
  --baseline User1.csv \
  --auto-composer-usage 0.95 \
  --api-usage 0.99
```

### 直接指定套餐额度

```bash
cursor-usage User2.csv --auto-composer-limit 144.52 --api-limit 44.84
```

### JSON 输出

```bash
cursor-usage User2.csv --baseline User1.csv --auto-composer-usage 0.95 --api-usage 0.99 --json
```

## 计费规则摘要

| 模型 | Input | Cache Read | Output | 池 |
|------|-------|------------|--------|-----|
| auto | $1.25/M | $0.25/M | $6/M | Auto+Composer |
| composer-2.5-fast | $3/M | $0.5/M | $15/M | Auto+Composer |
| gpt-5.3-codex | $1.75/M | $0.175/M | $14/M | API |
| gpt-5.3-codex-high | 同上 | 同上 | 同上 | API |
| claude-4.6-sonnet-medium-thinking | $3/$3.75 CW | $0.3/M | $15/M* | API |
| agent_review (Bugbot) | Auto 池 x 0.849 | | | API |

\* Claude thinking：约 31% 的 output tokens 按 input 价计，其余按 output 价计。

## 项目结构

```
cursor-usage-calculator/
├── cursor_usage/
│   ├── pricing.py
│   ├── calculator.py
│   └── cli.py
├── tools/
├── pyproject.toml
└── README.md
```

## 许可

MIT
