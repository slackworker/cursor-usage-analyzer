# 开发说明

面向维护者与贡献者。计费规则见 [`spec.md`](spec.md)；用户使用见 [`README.md`](../README.md)。

## 环境

### Web（主实现）

```bash
cd web && npm install && npm run dev   # http://localhost:5173
npm run build && npm test
```

详见 [`web/README.md`](../web/README.md)。

### Python CLI（回归对照）

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
# 或 scripts/init.sh
```

## CLI

```bash
cursor-usage file.csv                                    # standard（默认）
cursor-usage file.csv --billing-mode official            # 对齐官方 Total spend
cursor-usage file.csv --json
cursor-usage file.csv --reconcile                        # Cost 为美元时逐行对账

# 池使用率（默认 $145 / $45，official 口径）
cursor-usage file.csv --auto-composer-limit 150 --api-limit 50
cursor-usage target.csv --auto-composer-usage 0.95 --api-usage 0.99
cursor-usage target.csv --baseline baseline.csv --auto-composer-usage 1.0 --api-usage 1.0
```

口径与池逻辑见 [`spec.md`](spec.md) §4–§5。`--free-pricing-mode` 已弃用。

## 测试

```bash
python -m unittest discover -s tests -v    # 缺本地 CSV 时 golden 用例 skip
cd web && npm test
```

## 校准

1. 将导出的 CSV 放入 [`examples/`](../examples/)（gitignore，见 [`examples/README.md`](../examples/README.md)）
2. 在 [`tests/calibration_cases.json`](../tests/calibration_cases.json) 维护用例与预期金额
3. 跑上述测试；样例差额记录见 [`spec.md` §6](spec.md#6-样例验证)

改费率时同步更新 `web/src/lib/pricing.ts` 与 `cursor_usage/pricing.py`；非官方项置信度见 `cursor_usage/pricing_sources.py`。

## 仓库结构

```
web/src/lib/        # 产品：parser, aggregation, pricing
cursor_usage/       # CLI：pricing, calculator, cli, reconcile
tests/              # Python 回归
examples/           # 本地校准 CSV（不入库）
docs/spec.md        # 规则契约
```
