# Cursor Usage Calculator — 规格说明

**最后更新**：2026-06-27

---

## 1. 工具目标

| 能力 | 说明 |
|------|------|
| 计费模型 | 官方文档费率 + 样例 CSV 校准；不为拟合 Dashboard 而改价 |
| 费用推算 | 用户 CSV → 按模型/池汇总；支持 **strict** 与 **official** 两种 Total |
| 池使用率 | Auto+Composer / API 两池使用百分比；正向（给定额度）或反推（给定 Dashboard 使用率） |

实现：`cursor_usage/pricing.py`（费率）、`calculator.py`（解析与合计）、`cli.py`（入口）。

---

## 2. 计费模型

### 2.1 推断原则

1. **费率** — [Cursor Models & Pricing](https://cursor.com/docs/models-and-pricing) 为准；勿混用 Auto+Composer 表与 API Model pricing 表。
2. **验证** — 官方文档 > CSV 逐行对账（`--reconcile`）> 月度总量对照；样例见 [`examples/`](../examples/)。
3. **不改价拟合** — 限时折扣、活动价、历史口径变更可能导致 Dashboard 与推算偏差；记录差异，不为此调整 `PRICING`。

### 2.2 Token 公式

每行按四列 token 计费（单位：$/M）：

```
cost = icw×input + icwo×input + cr×cache_read + out×output
```

- `Cost` 列有美元金额时，合计优先用标注价（见 [`calculator.py`](../cursor_usage/calculator.py) `_resolve_row_cost()`）。
- 完整费率表见 [`pricing.py`](../cursor_usage/pricing.py) 的 `PRICING`。
- 非官方文档项的置信度见 [`pricing_sources.py`](../cursor_usage/pricing_sources.py)。

### 2.3 模型与池（摘要）

| 模型 | 池 | 费率来源 |
|------|-----|----------|
| auto | auto_composer | Auto pricing 表 |
| composer-1/2, composer-2-fast, composer-2.5-fast | auto_composer | API 表或 Composer pricing 表；`-fast` 为 slug 映射（见 pricing_sources） |
| gpt-*, claude-*-thinking | api | API Model pricing；slug 后缀为 thinking 变体，费率同基座 |
| agent_review | api | 基数同 Auto 四列；官方可能有未文档化折扣 |

### 2.4 Max Mode

| 模型 | `Max Mode=Yes` |
|------|----------------|
| gpt-5.3-codex / gpt-5.3-codex-high | 四列 token ×2（Fast） |
| gpt-5.4-medium / gpt-5.5-medium | 仅当 input（icw+icwo+cr）> 272k：input 侧 ×2，output ×1.5 |
| 其他 | 样例中无 Yes 行，暂不调整 |

工具按**当前文档口径向前推算**；2026 年 2 月 Dashboard 可能仍用旧 Codex Max Mode 口径（见 §6 已知偏差）。

---

## 3. CSV 输入

来源：Cursor Dashboard → Export usage events CSV。

**表头**：

```
Date, Cloud Agent ID, Automation ID, Kind, Model, Max Mode,
Input (w/ Cache Write), Input (w/o Cache Write), Cache Read,
Output Tokens, Total Tokens, Cost
```

**Kind**（大小写不敏感）：

| Kind | 处理 |
|------|------|
| `Included` | 计入 Included（`total_cost`） |
| `Free` / `free` | 见 §4 两种口径 |
| `Errored, No Charge` / `Aborted, Not Charged` | 跳过（`skipped_rows`）；`Cost=Free` 仅为展示残留，不代表免费额度 |
| On-demand | 尚未在样例中出现；出现后需扩展 `normalize_kind()` |

**Cost 列两种格式**：

| 格式 | `Cost` 含义 | 样例 |
|------|-------------|------|
| A | 状态（`Included`、`Free`、`-`） | February |
| B | 逐行美元（如 `0.21`） | January；可用 `--reconcile` 逐行对账 |

Dashboard：**Total spend = Included + On-demand + Free**（样例中 On-demand 均为 0）。

---

## 4. 两种计费口径

| 模式 | Total 公式 | Free 处理 | 用途 |
|------|-----------|-----------|------|
| **strict**（默认） | Included + On-demand + Free | Free 单独统计；status-only 行按 token 公式推算 | 自然理解的全量费用 |
| **official** | Included + On-demand | Cost 有美元的 Free → 并入 Included；status-only Free → 不纳入 | 对齐 Dashboard Total spend |

CLI：`--billing-mode strict|official`（`--free-pricing-mode` 为别名）。

输出字段：`total_spend` 为当前模式的 Dashboard 风格合计；`total_cost_with_free` = `total_cost + free_cost`（strict 语义下的 Included+Free）。

池使用率（§5）固定用 **official** 口径的 Included 费用，与 `--billing-mode` 无关。

---

## 5. 套餐池使用率

两池：**auto_composer**、**api**（模型归属见 `PRICING`）。

### 正向（默认）

```
使用率 = 该池 Included 费用 / 池总额度
```

默认额度：**$145**（Auto+Composer）、**$45**（API）。可覆盖：

```bash
cursor-usage file.csv --auto-composer-limit 150 --api-limit 50
```

### 反推

```
池额度 = 基准 CSV 该池 Included 费用 / Dashboard 使用率
```

```bash
cursor-usage target.csv --auto-composer-usage 0.95 --api-usage 0.99
cursor-usage target.csv --baseline baseline.csv --auto-composer-usage 1.0 --api-usage 1.0
```

- 基准 CSV 未指定时默认同主 CSV。
- 反推与正向不能同时使用（`--*-limit` vs `--*-usage`）。
- 基准分析固定 **official** 模式；分子仅 `pool.cost`（不含 `free_cost`）。
- Free 是否消耗池额度：**未知**（待样本）。

实现：`infer_limits_from_baseline()`、`apply_limits()`（[`calculator.py`](../cursor_usage/calculator.py)）。

---

## 6. 样例验证

`examples/` 文件名中的金额为 Dashboard **Total spend**。回归测试：`tests/test_golden.py`。

| 样例 | 模式 | 对账字段 | 官方 | 推算 | 差额 | 备注 |
|------|------|----------|------|------|------|------|
| January | strict | `total_spend` | $1.61 | $1.73 | +$0.12 | 全 Free；auto 逐行 ±$0.01 |
| February | strict | `total_cost` | $46.57 | $48.04 | -$1.47 | 2 月 Codex Max Mode 历史口径，见下 |
| March | official | `total_spend` | $69.94 | $70.79 | +$0.85 | 混合格式 A/B |
| April | strict | `total_cost` | $137.09 | $139.26 | +$2.17 | |
| May | official | `total_spend` | $92.01 | $91.45 | -$0.56 | 验证 status-only Free 不计入 official |
| June | official | `total_spend` | $137.62 | $139.81 | +$2.19 | |
| 账单周期 5/27–6/26 | official | `total_cost` | $191.60 | $187.08 | -$4.52 | 约 2.4%；原因未明 |

**样例文件**：

| 文件 | 官方 Total |
|------|-----------|
| [`January - US$1.61.csv`](../examples/January%20-%20US$1.61.csv) | $1.61 |
| [`February - US$46.57.csv`](../examples/February%20-%20US$46.57.csv) | $46.57 |
| [`March - US$69.94.csv`](../examples/March%20-%20US$69.94.csv) | $69.94 |
| [`April - US$137.09.csv`](../examples/April%20-%20US$137.09.csv) | $137.09 |
| [`May - US$92.01.csv`](../examples/May%20-%20US$92.01.csv) | $92.01 |
| [`June - US$137.62.csv`](../examples/June%20-%20US$137.62.csv) | $137.62 |
| [`May 27 - Jun 27 …`](../examples/May%2027%20-%20Jun%2027%20US$191.60%20100%25%20%2B%20100%25.csv) | $191.60 |

### 已知偏差（不为拟合而改价）

- **February / Codex Max Mode**：9 行 `gpt-5.3-codex` + `Max Mode=Yes`；官方 Total 介于标准价与文档 ×2 之间，疑为 2 月尚未切换 Fast 2×。
- **agent_review**：官方日合计稳定低于 token 全价（约 53%–61%）；维持 `AGENT_REVIEW_DISCOUNT_RATIO=1.0`。
- **composer-2-fast / composer-2.5-fast**：slug 映射经日级验证，见 `pricing_sources.py`。
- **账单周期**：5/30–6/1 日级与 Dashboard 按模型日合计不一致，且周期 Total 仍差 $4.52；不能仅用日切/时区解释。
- **活动价**：如 2026-05 GPT-5.5 按日半价；不硬编码进 `PRICING`。

---

## 7. 已知局限

- 推算按文档全价；未建模折扣/活动价时 Dashboard 可能低于推算（月度样例多在 1–2%，活动期间可更大）。
- On-demand Kind 未遇；出现后需扩展。
- 池使用率默认 $145/$45 为经验值；应用 `--*-limit` 或反推覆盖。
- Free 是否占用 Included 池额度未确认。
