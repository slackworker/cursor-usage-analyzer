# Cursor Usage Calculator — Spec

本文档记录经冒烟测试与官方数据对比后**已确认**的结论，供 Web 化各模块实现时引用。未确认项标注为「待决」。

**最后更新**：2026-06-27（确认 status-only Free 不计费；补充 May/June 校准）

---

## 1. 产品约束（已确认）

| 项 | 结论 |
|----|------|
| 认证 | 无登录、无密码 |
| 输入方式 | 本地上传 CSV；可选粘贴 Cursor 导出 URL（服务端拉取可能因 Cookie 失败，上传为主路径） |
| 报告生成 | 实时：上传/导入 → 即时分析 → 生成报告页 |
| 报告 URL | `/r/{uuid}`，知道链接即可访问 |
| 报告存储 | 临时（TTL 待决，见 §8） |

---

## 2. CSV 格式

来源：Cursor Dashboard → Export usage events CSV。

**样例文件**（`examples/` 目录，文件名中的金额为 Dashboard **Total spend**）：

| 文件 | 官方 Total | 说明 |
|------|-----------|------|
| [`January - US$1.61.csv`](../examples/January%20-%20US$1.61.csv) | $1.61 | 全 `free`，格式 B |
| [`February - US$46.57.csv`](../examples/February%20-%20US$46.57.csv) | $46.57 | 全 `Included`，格式 A |
| [`March - US$69.94.csv`](../examples/March%20-%20US$69.94.csv) | $69.94 | 混有 `Included` + `free`，格式 A/B |
| [`April - US$137.09.csv`](../examples/April%20-%20US$137.09.csv) | $137.09 | 全 `Included`，格式 A |
| [`May - US$92.01.csv`](../examples/May%20-%20US$92.01.csv) | $92.01 | 含活动价、空档与混合格式；见 §8 |

后续将追加更多月度样例（命名约定：`{Month} - US${total}.csv`）。

### 列名（首行表头）

```
Date, Cloud Agent ID, Automation ID, Kind, Model, Max Mode,
Input (w/ Cache Write), Input (w/o Cache Write), Cache Read,
Output Tokens, Total Tokens, Cost
```

### Total spend 与 Kind

Dashboard **Total spend** 由三类用量相加：

```
Total spend = Included + On-demand + Free
```

| Kind（CSV） | 含义 | 代码字段 | 当前样例 |
|-------------|------|----------|----------|
| `Included` | 套餐额度内计费 | `total_cost` | February（455 行） |
| `Free` / `free` | 免费额度消耗 | `free_cost` | January（8 行） |
| On-demand | 超额按量付费 | *待实现* | **尚未遇到** |
| `Errored, No Charge` | 错误，不计费 | 跳过 → `skipped_rows` | — |
| `Aborted, Not Charged` | 中止，不计费 | 跳过 → `skipped_rows` | — |

- 对账官方 Total：使用 `total_cost_with_free`（= `total_cost` + `free_cost`）；纯 Included 月可与 `total_cost` 等同
- `Kind` 匹配**大小写不敏感**（`normalize_kind()`）
- On-demand 出现后需在 `normalize_kind()` 增加归一化并计入合计

### Cost 列（两种导出格式）

| 格式 | 样例 | `Kind` | `Cost` 列含义 |
|------|------|--------|---------------|
| A | February | `Included` / `Free`（首字母大写） | 计费**状态**（`Included`、`Free`、`-`） |
| B | January | `free`（小写亦支持） | 逐行**美元金额**（如 `0.21`） |

格式 B 可用于 golden 逐行对账：`cursor-usage file.csv --reconcile`（见 [`reconcile.py`](../cursor_usage/reconcile.py)）。

**Cost 列有美元金额时**：合计与按模型汇总**优先采用该行标注金额**，不再对该行做 token 公式推算（见 [`calculator.py`](../cursor_usage/calculator.py) 的 `_resolve_row_cost()`）。`--reconcile` 仍会用 token 公式与标注价比对，用于发现折扣或活动价。

**Free 行特例（已确认）**：`Kind=Free` 且 `Cost` 仅为状态值（`Free`/`free`/`-`）时，该行按 **$0.00** 处理，不做 token 推算；只有 `Cost` 为美元金额时才计入 `free_cost`。
工具同时支持 `strict` 口径（无论 `Cost` 是否有金额，Free 都按 token 计入），用于「真实消耗」视角分析。

### 计费过滤规则

- `Kind = Included` → `total_cost`
- `Kind = Free`：`Cost` 有美元金额 → 计入 `free_cost`；`Cost` 为状态值（无金额）→ 按 $0 处理
- 跳过：`Errored, No Charge`、`Aborted, Not Charged`（计入 `skipped_rows`）
- 模型必须在 [`cursor_usage/pricing.py`](../cursor_usage/pricing.py) 的 `PRICING` 中，否则记入 `unknown_models`

CLI `--free-pricing-mode`：
- `official`（默认）：对齐官方展示口径（status-only Free 记 0）
- `strict`：统一 token 口径（status-only Free 也计入）

### 官方折扣与活动价

官方可能对部分用量打折或做短期活动（如 2026 年 5 月初 **GPT-5.5 按日半价**，并非整月统一）；CSV 中**未必有独立折扣列**，可能仅体现为 Dashboard Total 低于按文档费率的 token 推算。

| 原则 | 说明 |
|------|------|
| 推算费率 | **始终以 [官方文档](https://cursor.com/docs/models-and-pricing) 费率为准**，不为拟合 Dashboard Total 而改价 |
| 高于官方 | 活动期间推算 **高于** 官方 Total 属**正常**；样例文件须在 § 校准节注明差异原因 |
| Cost 有金额 | 以 CSV 标注价计入合计；`--reconcile` 可与 token 公式对比标注 `possible_discount` |
| 不能单凭一行断定 | 官方低于 token 推算时，可能是折扣、活动价或逐行四舍五入 |

---

## 3. 定价规则

详见 [`cursor_usage/pricing.py`](../cursor_usage/pricing.py)。**费率以 [Cursor 官方文档](https://cursor.com/docs/models-and-pricing) 为准**；月度 CSV 仅用于验证总量，不得为拟合差额而扭曲文档费率。

置信度与出处见 [`cursor_usage/pricing_sources.py`](../cursor_usage/pricing_sources.py) 与下方 §3.1。

官方文档有**两张费率表**，勿混用：[Auto + Composer 池](https://cursor.com/docs/models-and-pricing#composer-pricing)（含 Auto pricing、**Composer pricing**）与 [API 池 Model pricing](https://cursor.com/docs/models-and-pricing)。

| 模型 | 池 | 备注 |
|------|-----|------|
| auto | auto_composer | Auto pricing 表（$1.25 / $0.25 / $6） |
| composer-1 | auto_composer | API Model pricing 表 → Composer 1 |
| composer-2 | auto_composer | API Model pricing 表 → Composer 2（$0.5 / $0.2 / $2.5） |
| composer-2-fast | auto_composer | CSV slug → **2× Composer 2**（$1 / $0.4 / $5）；API 表无独立 Fast 行 |
| composer-2.5-fast | auto_composer | **Composer pricing 表** → **Composer 2.5 (Fast)**（$3 / $0.5 / $15）；非 API 表 Composer 2.5 行 |
| gpt-5.2, gpt-5.2-codex, gpt-5.3-codex, gpt-5.3-codex-high | api | 官方 GPT-5.2 / 5.3 Codex |
| gpt-5.4-medium | api | CSV slug → 官方 **GPT-5.4**（$2.5 / $0.25 / $15） |
| gpt-5.5-medium | api | CSV slug → 官方 **GPT-5.5**（$5 / $0.5 / $30） |
| claude-*-thinking, claude-opus-4-7-thinking-high | api | CSV slug → 官方 Claude 行（thinking effort 变体，费率同基座模型） |
| agent_review | api | 同 Auto 池四列计费；可选 `AGENT_REVIEW_DISCOUNT_RATIO`（默认 1.0） |

### 3.1 费率置信度（非官方文档项须警惕）

原则：**官方 models 表 > CSV 逐行对账 > CSV 总量拟合**。下列项尚未达到「官方文档」置信度，需你确认或补充样本：

| 项 | 置信度 | 说明 |
|----|--------|------|
| `composer-2-fast` 费率 2× Composer 2 | **csv_reconciled** | slug 映射自 Composer 2；Dashboard 按模型日合计 7 日验证（见下） |
| `composer-2.5-fast` 费率 | **official_doc** | Composer **pricing** 表（`#composer-pricing`）→ Composer 2.5 **(Fast)**（$3 / $0.5 / $15）；勿与 API 表 Composer 2.5（$0.5 / $0.2 / $2.5）混淆 |
| `agent_review` 计费 | **csv_inferred** | 基数似 Auto 池四列公式；无官方 Bugbot per-token 行（见下） |
| `AGENT_REVIEW_DISCOUNT_RATIO` | **unconfirmed** | 默认 **1.0（全价）**；样本显示存在折扣但无稳定系数，**暂不改** |
| CSV slug 映射（如 `gpt-5.4-medium` → GPT-5.4、`claude-4.6-sonnet-medium-thinking` → Claude 4.6 Sonnet） | **slug_mapped** | 费率来自文档对应行，slug 为 thinking effort / 档位变体 |

**slug_mapped** 项费率本身来自官方表，仅模型 ID 映射需留意；**csv_inferred** 项在 CLI 输出中会附加「费率置信度提示」。

#### composer-2-fast 按模型日合计验证（2026-06-27）

Dashboard 按模型日合计（非 CSV Cost 列）与 token 公式（2× Composer 2：$1 / $0.4 / $5）对比；样本来自 March–May CSV 全部 26 行 Included。

| 日期 | 官方 | 公式推算 | 偏差 |
|------|------|----------|------|
| 2026-03-28 | $0.22 | $0.24 | +9.9% |
| 2026-03-30 | $0.36 | $0.42 | +17.9% |
| 2026-04-01 | $0.46 | $0.52 | +14.0% |
| 2026-04-02 | $0.61 | $0.61 | **-0.4%** |
| 2026-04-18 | $0.09 | $0.11 | +20.7% |
| 2026-05-03 | $0.33 | $0.31 | -6.4% |
| 2026-05-04 | $0.07 | $0.05 | -23.4% |
| **合计** | **$2.14** | **$2.27** | **+6.0%** |

**已确认**：四分量 token 公式正确；**2× Composer 2** 为正确档位（1× 合计仅 ~$1.13，可排除）。4/02 八行几乎完全吻合，为强验证点。  
**仍存噪声**：逐日偏差无统一折扣系数（0.83–1.31×），更像 Dashboard 日合计舍入；全样本 +6% 在容差内。  
**当前策略**：维持 `PRICING` 不变（$1 / $0.4 / $5）；不为拟合而加全局折扣。

#### agent_review（Bugbot）逐行验证（2026-06-27）

Dashboard 按模型日合计（非 CSV Cost 列）与 token 公式（Auto 四列 ×1.0）对比：

| 日期 | Kind | 官方 | 公式全价 | 官方/公式 |
|------|------|------|----------|-----------|
| 2026-01-27 | Free | $0.21 | $0.35 | ~61% |
| 2026-03-10 | Included | $0.81 | $1.54 | ~53% |
| 2026-03-31 | Included | $0.49 | $0.83 | ~59% |

**已确认**：官方价稳定低于全价推算，Auto 四列作**基数**合理。  
**仍不明确**：折算比例在 53%–61% 间波动，无法用单一固定乘数精确拟合三行；Free / Included 与用量均不能单独解释差异。  
**当前策略**：合计与报告仍按**文档全价**（`AGENT_REVIEW_DISCOUNT_RATIO = 1.0`）；Cost 有美元时以标注价为准；`--reconcile` 对低于推算的行标注 `possible_discount`。**待更多样本后再考虑校正系数**，不为拟合而改 `PRICING`。

完整注册表：[`pricing_sources.py`](../cursor_usage/pricing_sources.py) 中的 `MODEL_SOURCES` / `RULE_SOURCES`。

---

## 4. January 校准（`examples/January - US$1.61.csv`）

官方 **Total spend $1.61**（Cost 列求和 $1.60，差 $0.01 为四舍五入）。当月 On-demand = 0，Total 即 Free 部分。

| 指标 | 值 |
|------|-----|
| 行数 / Free 行 | 8 / 8 |
| 推算 `free_cost` | **$1.73** |
| 推算 `total_cost_with_free` | **$1.73** |
| 与官方差额 | **$0.12**（约 7.5%，推算略高） |

| 模型 | 结论 |
|------|------|
| **auto**（6 行） | 文档费率完全对齐，逐行 ±$0.01 |
| **agent_review**（1 行） | 同 Auto 四列计费；官方 $0.21 < 推算 $0.35，`--reconcile` 标注 `possible_discount` |

```bash
cursor-usage "examples/January - US\$1.61.csv" --reconcile
# 7/8 行在 ±$0.01 容差内；agent_review 1 行官方低于推算（可能折扣）
```

---

## 5. February 校准（`examples/February - US$46.57.csv`）

官方 **Total spend $46.57**。当月全部为 `Included`（On-demand = 0、Free = 0），故 Total = Included。Cost 列为 `Included` 状态（格式 A），无法逐行对账，仅做**总量校准**。

| 指标 | 值 |
|------|-----|
| 日期范围 | 2026-02-03 ~ 2026-02-28 |
| 总行数 / Included 行 | 455 / 455 |
| 推算 `total_cost` | **$46.49** |
| 与官方差额 | **$0.08**（约 **0.2%**，官方略高） |

### 按模型（推算 Included 费用）

| 模型 | 行数 | 推算费用 | 池 |
|------|------|----------|-----|
| auto | 290 | $24.75 | auto_composer |
| gpt-5.3-codex | 89 | $9.42 | api |
| gpt-5.2-codex | 58 | $7.74 | api |
| claude-4.5-sonnet-thinking | 8 | $1.81 | api |
| claude-4.6-sonnet-medium-thinking | 8 | $1.81 | api |
| claude-4.6-opus-high-thinking | 1 | $0.91 | api |
| composer-1 | 1 | $0.05 | auto_composer |

```bash
cursor-usage "examples/February - US\$46.57.csv"
# 推算费用: $46.49，无 unknown_models
```

---

## 6. March 校准（`examples/March - US$69.94.csv`）

官方 **Total spend $69.94**。当月含 `Included`（618 行）与 `free`（31 行，Cost 列逐行美元，合计 $3.04）；On-demand = 0。Cost 列混用格式 A（Included 状态）与格式 B（Free 金额）。

| 指标 | 值 |
|------|-----|
| 日期范围 | 2026-03-01 ~ 2026-03-31 |
| 总行数 / Included / Free | 662 / 618 / 31 |
| 跳过行 | Errored, No Charge=13 |
| 推算 `total_cost` | **$67.74** |
| 推算 `free_cost` | **$3.05** |
| 推算 `total_cost_with_free` | **$70.79** |
| 与官方差额 | **$0.85**（约 **1.2%**，推算略高） |

### 新增模型（March 首次出现）

| 模型 | 行数（Included） | 推算费用 | 池 | 费率来源 |
|------|------------------|----------|-----|----------|
| gpt-5.4-medium | 93 | $17.77 | api | 官方 GPT-5.4（$2.5 / $0.25 / $15） |
| gpt-5.2 | 34 | $6.20 | api | 官方 GPT-5.2 |
| composer-2-fast | 6 | $0.67 | auto_composer | 2× Composer 2（$1 / $0.4 / $5） |

### 按模型（推算 Included 费用，节选）

| 模型 | 行数 | 推算费用 | 池 |
|------|------|----------|-----|
| auto | 468 | $38.54 | auto_composer |
| gpt-5.4-medium | 93 | $17.77 | api |
| gpt-5.2 | 34 | $6.20 | api |
| gpt-5.3-codex | 15 | $2.19 | api |
| agent_review | 2 | $2.37（全价） | api |
| composer-2-fast | 6 | $0.67 | auto_composer |

**agent_review**：Dashboard 日合计 $0.81 + $0.49 = **$1.30**（见 §3.1）；工具仍报全价 $2.37，差额计入 `possible_discount` 类不确定性。

```bash
cursor-usage "examples/March - US\$69.94.csv"
# 推算 total_cost_with_free: $70.79，无 unknown_models
```

---

## 7. April 校准（`examples/April - US$137.09.csv`）

官方 **Total spend $137.09**。当月全部为 `Included`（1256 行）；On-demand = 0、Free = 0。Cost 列为 `Included` 状态（格式 A），仅做**总量校准**。

| 指标 | 值 |
|------|-----|
| 日期范围 | 2026-04-01 ~ 2026-04-30 |
| 总行数 / Included | 1266 / 1256 |
| 跳过行 | Errored, No Charge=6、Aborted, Not Charged=4 |
| 推算 `total_cost` | **$139.26** |
| 与官方差额 | **$2.17**（约 **1.6%**，推算略高） |

### 新增模型（April 首次出现）

| 模型 | 行数（Included） | 推算费用 | 池 | 费率来源 |
|------|------------------|----------|-----|----------|
| gpt-5.5-medium | 10 | $4.95 | api | 官方 **GPT-5.5**（$5 / $0.5 / $30） |
| composer-2 | 5 | $0.73 | auto_composer | 官方 **Composer 2**（$0.5 / $0.2 / $2.5） |
| claude-opus-4-7-thinking-high | 1 | $1.28 | api | 官方 **Claude 4.7 Opus**（thinking effort 变体） |

> 此前曾将 `gpt-5.5-medium` 误按 GPT-5.4 费率拟合（$2.48），已改回官方文档。差额 $1.55 可能来自折扣或逐行四舍五入，**不以拟合掩盖**。

### 按模型（推算 Included 费用，节选）

| 模型 | 行数 | 推算费用 | 池 |
|------|------|----------|-----|
| auto | 1049 | $87.58 | auto_composer |
| gpt-5.4-medium | 176 | $43.49 | api |
| gpt-5.5-medium | 10 | $4.95 | api |
| composer-2-fast | 15 | $1.24 | auto_composer |
| composer-2 | 5 | $0.73 | auto_composer |
| claude-opus-4-7-thinking-high | 1 | $1.28 | api |

```bash
cursor-usage "examples/April - US\$137.09.csv"
# 推算 total_cost: $139.26，无 unknown_models
```

---

## 8. May/June 校准（`examples/May - US$92.01.csv`、`examples/June - US$137.62.csv`）

### 8.1 May（官方 Total：$92.01）

May 结构特殊：5/1–5/4 集中使用后出现 **23 天空档**（5/6–5/26 无 Included），5/28 起恢复；并出现大量 `Free` 状态行（`Cost=Free`、无美元）。

**已确认规则**（由 5/27 官方 auto 日值 $0.00 直接验证）：

- `Kind=Free` 且 `Cost` 无美元金额（仅状态值）→ **不计入** Dashboard spend
- `Kind=Free` 且 `Cost` 为美元金额 → 计入 `free_cost`

按该规则更新后：

| 指标 | 数值 |
|------|------|
| `total_cost`（Included） | $89.40 |
| `free_cost`（仅美元金额 Free） | $2.05 |
| `total_cost_with_free` | **$91.45** |
| 与官方差额 | **-$0.56**（约 0.6%） |

> 仍保留「文档全价」原则：不把按日活动价硬编码进 `PRICING`。

### 8.2 June（官方 Total：$137.62）

June 出现 24 行 `Free`，全部为 `Cost=Free` 状态、无美元。按新规则它们都按 $0 处理。

| 指标 | 数值 |
|------|------|
| `total_cost`（Included） | **$139.81** |
| `free_cost` | **$0.00** |
| `total_cost_with_free` | **$139.81** |
| 与官方差额 | **+$2.19**（约 1.6%） |

该差额量级与 April（+1.6%）一致，可归入文档全价 + 逐行舍入/活动价差异。

### 8.3 边界日说明（5/31 ↔ 6/1）

May/June 两份导出在 `2026-05-31T16:25:18Z` 到 `2026-06-01T04:11:25Z` 之间有约 12 小时空档。  
因此 5/31 与 6/1 的日级对账不稳定，建议在 spec/报告中标记为「导出不完整，仅供参考」；6/2–6/6 的日级对账可作为稳定验证窗口。

---

## 9. 回归 Golden Values

| 样例 | 对账字段 | 官方 Total | 推算值 | 差额 |
|------|----------|-----------|--------|------|
| January | `total_cost_with_free` | $1.61 | $1.73 | $0.12 |
| February | `total_cost` | $46.57 | $46.49 | $0.08 |
| March | `total_cost_with_free` | $69.94 | $70.79 | $0.85 |
| April | `total_cost` | $137.09 | $139.26 | $2.17 |
| May | `total_cost_with_free` | $92.01 | $91.45 | -$0.56 |
| June | `total_cost` | $137.62 | $139.81 | +$2.19 |

January 另经 `--reconcile` 验证：auto 6/6 行在 ±$0.01 容差内；agent_review 1 行官方低于推算（`possible_discount`）。

---

## 10. M0 冒烟结论

| 检查项 | 结果 |
|--------|------|
| CSV 解析 | 通过 |
| 模型覆盖（February） | 通过（无 unknown_models） |
| January Total vs $1.61 | 通过（$1.73，差 $0.12；agent_review 可能折扣） |
| January `--reconcile` | auto 6/6 行通过；agent_review 1 行 `possible_discount` |
| February Total vs $46.57 | 通过（$46.49，差 0.2%） |
| March Total vs $69.94 | 通过（$70.79，差 1.2%） |
| March 模型覆盖 | 通过（无 unknown_models） |
| April Total vs $137.09 | 通过（$139.26，差 1.6%，文档费率） |
| April 模型覆盖 | 通过（无 unknown_models） |
| Kind 大小写 | 通过（`free` / `Free` / `Included`） |
| JSON 输出 | 通过（`--json` 结构完整） |
| baseline / 池使用率 CLI | 保留（待后续月度样例补充全链路 golden） |

**M0 状态：通过**（January–April 与官方几乎对齐），可进入 M1。

---

## 11. Web 阶段待决

| 项 | 状态 |
|----|------|
| 报告 TTL（24h / 7d / 其他） | 待决 |
| Cursor URL 拉取失败文案 | 待决（建议：引导用户下载后上传） |
| UI 是否展示文件名官方 Total 对比 | 待决 |
| daily 时间序列 JSON 字段名 | M1 定义 |
| On-demand Kind 出现后的处理 | 待样本 |

---

## 12. 模块路线图

```
M0 冒烟 + spec（January–June，已落地 Free 状态行不计费规则）  ← 当前
     → 持续补充边界日样本（5/31–6/1 类空档）
M1  daily 聚合 + 统一 JSON schema
M2  FastAPI POST/GET
M3  临时存储 + TTL
M4  React 上传页
M5  React 报告页 + ECharts
M6  Cursor URL + Docker 部署
```
