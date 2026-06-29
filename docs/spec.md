# Cursor Usage Analyzer — 规格说明

**最后更新**：2026-06-27

**术语**：**官方 Usage 页面** 指 Cursor 账户中的 [Dashboard → Usage](https://cursor.com/dashboard/USAGE)——用于查看 Total spend、池使用率，并导出 usage events CSV。下文简称 **官方 Usage 页面**（勿与本工具 CLI 混淆）。

---

## 1. 工具目标

| 能力 | 说明 |
|------|------|
| 计费模型 | 官方文档费率 + 样例 CSV 校准；不为拟合官方 Usage 页面而改价 |
| 费用推算 | 用户 CSV → 按模型/池汇总；支持 **standard**（标准口径）与 **official**（官方口径）两种 Total |
| 池使用率 | Auto+Composer / API 两池使用百分比；正向（给定额度）或反推（给定官方 Usage 页面使用率） |

实现：`cursor_usage/pricing.py`（费率）、`calculator.py`（解析与合计）、`cli.py`（入口）。

---

## 2. 计费模型

### 2.1 推断原则

1. **费率** — [Cursor Models & Pricing](https://cursor.com/docs/models-and-pricing) 为准；勿混用 Auto+Composer 表与 API Model pricing 表。
2. **验证** — 官方文档 > CSV 逐行对账（`--reconcile`）> 月度总量对照；本地校准 CSV 见 [`examples/README.md`](../examples/README.md)，用例定义见 [`tests/calibration_cases.json`](../tests/calibration_cases.json)。
3. **不改价拟合** — 限时折扣、活动价、历史口径变更可能导致官方 Usage 页面与推算偏差；记录差异，不为此调整 `PRICING`。

### 2.2 Token 公式

每行按四列 token 计费（单位：$/M）：

```
cost = icw×input + icwo×input + cr×cache_read + out×output
```

- `Cost` 列有美元金额时，合计优先用标注价（见 [`calculator.py`](../cursor_usage/calculator.py) `_resolve_row_cost()`）。
- 完整费率表见 [`pricing.py`](../cursor_usage/pricing.py) 的 `PRICING`。
- 非官方文档项的置信度见 [`pricing_sources.py`](../cursor_usage/pricing_sources.py)。

### 2.3 缓存命中率

CSV 每行输入侧三列语义（与 §2.2 计费列一致）：

| 列 | 含义 | 计入命中？ |
|----|------|-----------|
| Cache Read（`cr`） | 从 prompt 缓存读出 | 是 |
| Input w/ Cache Write（`icw`） | 写入/更新缓存 | 否 |
| Input w/o Cache Write（`icwo`） | 未走缓存读的新输入 | 否 |

跨模型统一公式（全模型同一口径，不按厂商分公式）：

```
命中率 = cr / (icw + icwo + cr)
```

等价于：`cr / (未命中 + cr)`，其中 **未命中 = icw + icwo**。Output 不参与。

**分列因模型而异，不宜只看 `icwo`：** Claude 系常把「写缓存」记在 `icw`（`icwo` 可接近 0）；GPT / `auto`（样例中 2026-03 起）常 `icw = 0`，写缓存可能合并进 `icwo`。跨模型比较时应把 `icw + icwo` 整体视为未命中，而非使用 `cr / (icwo + cr)`——后者在 Claude 上会因 `icwo ≈ 0` 虚高至接近 100%。

### 2.4 模型与池（摘要）

| 模型 | 池 | 费率来源 |
|------|-----|----------|
| auto | auto_composer | Auto pricing 表 |
| composer-1/2, composer-2.5, composer-2-fast, composer-2.5-fast | auto_composer | Composer pricing 表；`-fast` 为 Fast 变体 slug 映射（见 pricing_sources） |
| gpt-*, claude-*-thinking | api | API Model pricing；slug 后缀为 thinking 变体，费率同基座 |
| agent_review | api | 基数同 Auto 四列；官方可能有未文档化折扣 |

### 2.5 Max Mode

| 模型 | `Max Mode=Yes` |
|------|----------------|
| gpt-5.3-codex / gpt-5.3-codex-high | 四列 token ×2（Fast） |
| gpt-5.4-medium / gpt-5.5-medium | 仅当 input（icw+icwo+cr）> 272k：input 侧 ×2，output ×1.5 |
| 其他 | 样例中无 Yes 行，暂不调整 |

工具按**当前文档口径向前推算**；2026 年 2 月官方 Usage 页面可能仍用旧 Codex Max Mode 口径（见 §6 已知偏差）。

---

## 3. CSV 输入

来源：[官方 Usage 页面](https://cursor.com/dashboard/USAGE) → Export usage events CSV。

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

官方 Usage 页面：**Total spend = Included + On-demand**（`Free` 行：Cost 列有美元金额的并入 Included，仅状态为 `Free` 的不纳入；与本工具 `official` 模式一致。样例中 On-demand 均为 0）。

---

## 4. 两种计费口径

| 模式 | Total 公式 | Free 处理 | 用途 |
|------|-----------|-----------|------|
| **standard**（标准口径，默认） | Included + On-demand + Free | Free 单独统计；status-only 行按 token 公式推算 | 三分项全量合计 |
| **official**（官方口径） | Included + On-demand | Cost 有美元的 Free → 并入 Included；status-only Free → 不纳入 | 对齐官方 Usage 页面 Total spend |

CLI：`--billing-mode standard|official`（`--free-pricing-mode` 已弃用，仍可用但会打印警告）。

输出字段：`total_spend` 在 `official` 下对齐官方 Total spend（Included + On-demand）；在 `standard` 下为 Included + On-demand + Free。`total_cost_with_free` = `total_cost + free_cost`（standard 语义下的 Included + Free，不含 On-demand）。

池使用率（§5）固定用 **official** 口径的 Included 费用，与 `--billing-mode` 无关。

---

## 5. 套餐池使用率

两池：**auto_composer**、**api**（模型归属见 `PRICING`）。

### 正向（默认）

```
使用率 = 该池 Included 费用 / 池总额度
```

默认额度：**$145**（Auto+Composer）、**$45**（API）。此为 **$20/月 Cursor Pro** 套餐下、与官方 Usage 页面对照得到的经验值；其他套餐或定价变更时请用 `--*-limit` 或反推覆盖。可覆盖：

```bash
cursor-usage file.csv --auto-composer-limit 150 --api-limit 50
```

### 反推

```
池额度 = 基准 CSV 该池 Included 费用 / 官方 Usage 页面使用率
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

本地校准 CSV 放在 `examples/`（**不纳入版本库**，见 [`examples/README.md`](../examples/README.md)）。用例名称、文件名、官方/推算金额以 [`tests/calibration_cases.json`](../tests/calibration_cases.json) 为准；Python 回归 `tests/test_golden.py`、Web 回归 `web/src/lib/golden.test.ts` 在缺少对应文件时自动 skip。

已知样例与官方 Total 的差额（推算按文档全价，不为拟合 Dashboard 而改价）：

| 样例 | 模式 | 官方 | 推算 | 差额 | 备注 |
|------|------|------|------|------|------|
| January | standard | $1.61 | $1.73 | +$0.12 | 全 Free；auto 逐行 ±$0.01 |
| February | standard | $46.57 | $48.04 | -$1.47 | 2 月 Codex Max Mode 历史口径，见下 |
| March | official | $69.94 | $70.79 | +$0.85 | 混合格式 A/B |
| April | official | $137.09 | $139.26 | +$2.17 | |
| May | official | $92.01 | $91.45 | -$0.56 | 验证 status-only Free 不计入 official |
| June | official | $141.24 | $143.42 | +$2.18 | |
| 账单周期 5/27–6/27 | official | $195.22 | $190.68 | -$4.54 | 约 2.3%；原因未明 |

具体 pinned 金额、容差与日级 spot 见 `calibration_cases.json`。

### 已知偏差（不为拟合而改价）

- **February / Codex Max Mode**：9 行 `gpt-5.3-codex` + `Max Mode=Yes`；官方 Total 介于标准价与文档 ×2 之间，疑为 2 月尚未切换 Fast 2×。
- **agent_review**：官方日合计稳定低于 token 全价（约 53%–61%）；维持 `AGENT_REVIEW_DISCOUNT_RATIO=1.0`。
- **composer-2-fast / composer-2.5-fast**：slug 映射经日级验证，见 `pricing_sources.py`。
- **账单周期**：5/30–6/1 日级与官方 Usage 页面按模型日合计不一致，且周期 Total 仍差约 $4.54；不能仅用日切/时区解释。
- **活动价**：如 2026-05 GPT-5.5 按日半价；不硬编码进 `PRICING`。

---

## 7. 已知局限

- 推算按文档全价；未建模折扣/活动价时官方 Usage 页面可能低于推算（月度样例多在 1–2%，活动期间可更大）。
- On-demand Kind 未遇；出现后需扩展。
- 池使用率默认 $145/$45 为 **$20/月 Pro** 套餐经验值；其他套餐请用 `--*-limit` 或反推覆盖。
- Free 是否占用 Included 池额度未确认。
