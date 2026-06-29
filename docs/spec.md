# Cursor Usage Analyzer — 规格说明

**受众**：实现与维护；想理解「为什么这么算」的用户可读 §4、§5、§7。使用方式见 [`README.md`](../README.md)，开发流程见 [`dev.md`](dev.md)。

**最后更新**：2026-06-29

**术语**：**官方 Usage 页面** 指 [Dashboard → Usage](https://cursor.com/dashboard/USAGE)——查看 Total spend、池使用率并导出 CSV。勿与 [`dev.md`](dev.md) 中的 CLI 混淆。

---

## 1. 范围

分析官方 Usage 页面导出的 usage events CSV，呈现使用洞察。费用推算（§4）与池使用率（§5）是核心能力之一；报告以费用视图为主，Token 视图为补充。

**非目标**：不为拟合官方 Usage 页面而调整费率；未文档化的折扣/活动价记录差异即可。

| 原则 | 说明 |
|------|------|
| 费率 | 官方文档 + 样例校准（§2、§6） |
| 口径 | standard / official 两种合计（§4） |
| 池 | Auto+Composer / API，按 Included 费用（§5） |

**实现**：产品逻辑在 `web/src/lib/`（`parser.ts`、`aggregation.ts`、`pricing.ts`）。`cursor_usage/` 为早期 Python 对照实现，共享 [`calibration_cases.json`](../tests/calibration_cases.json) 回归。架构见 §8。

---

## 2. 计费模型

### 2.1 推断原则

1. **费率** — [Cursor Models & Pricing](https://cursor.com/docs/models-and-pricing) 为准；勿混用 Auto+Composer 表与 API Model pricing 表。
2. **验证** — 官方文档 > CSV 逐行对账（CLI `--reconcile`，见 [`dev.md`](dev.md)）> 月度总量对照；校准见 [`examples/README.md`](../examples/README.md)、[`calibration_cases.json`](../tests/calibration_cases.json)。
3. **不改价拟合** — 限时折扣、活动价、历史口径变更可能导致偏差；记录差异，不调整 `PRICING`。

### 2.2 Token 公式

每行按四列 token 计费（单位：$/M）：

```
cost = icw×input + icwo×input + cr×cache_read + out×output
```

- `Cost` 列有美元金额时，合计优先用标注价（Web：`aggregation.ts`；Python：`calculator.py` `_resolve_row_cost()`）。
- 费率表：`web/src/lib/pricing.ts`、`cursor_usage/pricing.py` 的 `PRICING`。
- 非官方项置信度：`cursor_usage/pricing_sources.py`。

### 2.3 缓存命中率

| 列 | 含义 | 计入命中？ |
|----|------|-----------|
| Cache Read（`cr`） | 从 prompt 缓存读出 | 是 |
| Input w/ Cache Write（`icw`） | 写入/更新缓存 | 否 |
| Input w/o Cache Write（`icwo`） | 未走缓存读的新输入 | 否 |

```
命中率 = cr / (icw + icwo + cr)
```

**未命中 = icw + icwo**；Output 不参与。不宜用 `cr / (icwo + cr)`——Claude 系 `icwo` 可接近 0，会虚高命中率。

### 2.4 模型与池（摘要）

| 模型 | 池 | 费率来源 |
|------|-----|----------|
| auto | auto_composer | Auto pricing 表 |
| composer-1/2, composer-2.5, composer-2-fast, composer-2.5-fast | auto_composer | Composer pricing 表；`-fast` 为 Fast 变体 slug 映射 |
| gpt-*, claude-*-thinking | api | API Model pricing |
| agent_review | api | 基数同 Auto 四列；官方可能有未文档化折扣 |

### 2.5 Max Mode

| 模型 | `Max Mode=Yes` |
|------|----------------|
| gpt-5.3-codex / gpt-5.3-codex-high | 四列 token ×2（Fast） |
| gpt-5.4-medium / gpt-5.5-medium | input（icw+icwo+cr）> 272k：input 侧 ×2，output ×1.5 |
| 其他 | 样例中无 Yes 行，暂不调整 |

按**当前文档口径**向前推算；2026 年 2 月官方页面可能仍用旧 Codex Max Mode 口径（§6）。

---

## 3. CSV 输入

来源：官方 Usage 页面 → Export usage events CSV。

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
| `Free` / `free` | 见 §4 |
| `Errored, No Charge` / `Aborted, Not Charged` | 跳过（`skipped_rows`） |
| On-demand | 样例未出现；需扩展 `normalize_kind()` |

**Cost 列**：

| 格式 | 含义 | 样例 |
|------|------|------|
| A | 状态（`Included`、`Free`、`-`） | February |
| B | 逐行美元 | January |

官方：**Total spend = Included + On-demand**（与本工具 `official` 一致；样例 On-demand 均为 0）。

---

## 4. 两种计费口径

| 模式 | Total 公式 | Free 处理 | 用途 |
|------|-----------|-----------|------|
| **standard**（默认） | Included + On-demand + Free | Free 单独统计；status-only 按 token 推算 | 三分项全量 |
| **official** | Included + On-demand | 有美元金额的 Free → Included；status-only Free 不纳入 | 对齐官方 Total spend |

Web 报告可切换两种口径。CLI：`--billing-mode`（见 [`dev.md`](dev.md)）。

池使用率（§5）固定用 **official** 的 Included 费用，与 `--billing-mode` 无关。

---

## 5. 套餐池使用率

两池：**auto_composer**、**api**（模型归属见 `PRICING`）。

**正向**：`使用率 = 该池 Included 费用 / 池总额度`。默认 **$145** / **$45**（$20/月 Pro 经验值）。

**反推**：`池额度 = 基准 CSV 该池 Included 费用 / 官方页面使用率`。基准未指定时默认同主 CSV；反推与正向额度参数互斥。

- 基准分析固定 **official**；分子仅 `pool.cost`（不含 `free_cost`）
- Free 是否消耗池额度：**未知**

CLI 参数见 [`dev.md`](dev.md)。Python 实现：`calculator.py` 的 `infer_limits_from_baseline()`、`apply_limits()`。

---

## 6. 样例验证

校准 CSV 放 `examples/`（不入库）。用例与预期见 [`calibration_cases.json`](../tests/calibration_cases.json)；流程见 [`dev.md`](dev.md)。Python `tests/test_golden.py`、Web `golden.test.ts` 缺文件时 skip。

| 样例 | 模式 | 官方 | 推算 | 差额 | 备注 |
|------|------|------|------|------|------|
| January | standard | $1.61 | $1.73 | +$0.12 | 全 Free |
| February | standard | $46.57 | $48.04 | -$1.47 | Codex Max Mode 历史口径 |
| March | official | $69.94 | $70.79 | +$0.85 | |
| April | official | $137.09 | $139.26 | +$2.17 | |
| May | official | $92.01 | $91.45 | -$0.56 | status-only Free |
| June | official | $141.24 | $143.42 | +$2.18 | |
| 账单周期 5/27–6/27 | official | $195.22 | $190.68 | -$4.54 | |

### 已知偏差（不为拟合而改价）

- **February / Codex Max Mode**：官方 Total 介于标准价与文档 ×2 之间
- **agent_review**：官方日合计低于 token 全价（约 53%–61%）
- **composer-2-fast / composer-2.5-fast**：slug 映射经日级验证
- **账单周期**：周期 Total 差约 $4.54，非日切/时区可完全解释
- **活动价**：如 2026-05 GPT-5.5 半价；不硬编码

---

## 7. 已知局限

- 未建模折扣/活动时官方页面可能低于推算（月度多在 1–2%）
- On-demand Kind 待扩展
- 池默认额度为 Pro 经验值；其他套餐需自定义
- Free 是否占用 Included 池额度未确认

---

## 8. 架构

```
web/                    # 产品（React + Vite）
  src/lib/              # parser, aggregation, pricing
  src/pages/            # 报告页
cursor_usage/           # Python CLI（回归对照）
tests/                  # Python 回归 + calibration_cases.json
examples/               # 本地校准 CSV（gitignore）
```

改计费逻辑时以本 spec 为准，同步 Web 与 Python 实现，并更新校准用例。
