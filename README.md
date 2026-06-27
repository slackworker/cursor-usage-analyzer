# Cursor Usage Calculator

根据 Cursor 导出的用量 CSV，推算 token 费用与套餐池使用率。

## 能做什么

1. **计费模型** — 以 [Cursor 官方定价](https://cursor.com/docs/models-and-pricing) 为基础，用 `examples/` 样例 CSV 校准与验证（详见 [`docs/spec.md`](docs/spec.md)）。
2. **费用推算** — 用户提供 CSV，输出 **standard**（标准口径）与 **official**（官方口径）两种合计。
3. **池使用率** — 按 Auto+Composer / API 两池推算使用百分比；可指定额度（正向）或从 Dashboard 使用率反推额度（反推）。

## 安装

```bash
cd ~/projects/cursor-usage-calculator
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

## 用法

### 费用推算

```bash
cursor-usage "examples/February - US\$46.57.csv"              # standard（标准口径，默认）
cursor-usage "examples/May - US\$92.01.csv" --billing-mode official  # 官方口径
```

对齐官方 Usage 页面 **Total spend** 时用 `official`（官方口径）；要看 Included + On-demand + Free 全量时用 `standard`（标准口径，默认）。两种口径说明见 [`docs/spec.md`](docs/spec.md#4-两种计费口径)。

### 池使用率

默认按 **$145 / $45** 池额度（**$20/月 Pro** 套餐经验值）、**official** 口径计算（每次运行均输出）：

```bash
cursor-usage "examples/June - US\$137.62.csv"
cursor-usage target.csv --auto-composer-limit 150 --api-limit 50
```

从 Dashboard 使用率反推额度（基准 CSV 默认同主文件）：

```bash
cursor-usage "examples/May 27 - Jun 27 US\$191.60 100% + 100%.csv" \
  --auto-composer-usage 1.0 --api-usage 1.0
```

### 其他

```bash
cursor-usage file.csv --json                              # JSON 输出
cursor-usage "examples/January - US\$1.61.csv" --reconcile  # Cost 列为美元时逐行对账
python -m unittest discover -s tests -v                   # 回归测试
```

## 文档

| 文件 | 内容 |
|------|------|
| [`docs/spec.md`](docs/spec.md) | 计费模型、CSV 格式、两种口径、池使用率、样例验证 |
| [`cursor_usage/pricing.py`](cursor_usage/pricing.py) | 模型费率（代码即源） |
| [`cursor_usage/pricing_sources.py`](cursor_usage/pricing_sources.py) | 非官方项置信度 |
| [`examples/`](examples/) | Golden 样例 CSV |

## 项目结构

```
cursor-usage-calculator/
├── cursor_usage/       # pricing, calculator, cli, reconcile
├── examples/           # Golden CSV
├── tests/
├── docs/spec.md
└── tools/              # 早期校准脚本（日常请用 cursor-usage）
```

## 许可

MIT
