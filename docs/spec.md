# Cursor Usage Calculator — Spec

本文档记录经冒烟测试与官方数据对比后**已确认**的结论，供 Web 化各模块实现时引用。未确认项标注为「待决」。

**最后更新**：2026-06-26（Total spend 模型 + January/February/March 校准）

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

后续将追加 April、May 等月度样例（命名约定：`{Month} - US${total}.csv`）。

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

### 计费过滤规则

- `Kind = Included` → `total_cost`
- `Kind = Free` → `free_cost`；与 Included 合计为 `total_cost_with_free`
- 跳过：`Errored, No Charge`、`Aborted, Not Charged`（计入 `skipped_rows`）
- 模型必须在 [`cursor_usage/pricing.py`](../cursor_usage/pricing.py) 的 `PRICING` 中，否则记入 `unknown_models`

### 官方折扣（待决）

官方可能对部分用量打折；CSV 中**未必有独立折扣列**，仅体现为 `Cost` 低于 token 公式推算。对账时若 `官方 < 推算`，可能是折扣、不同计费规则或逐行四舍五入，**不能单凭一行断定**（`reconcile` 模块会标注 `possible_discount`）。

---

## 3. 定价规则

详见 [`cursor_usage/pricing.py`](../cursor_usage/pricing.py)。校准来源：Cursor 官方文档 + January–March 2026 导出。

| 模型 | 池 | 备注 |
|------|-----|------|
| auto, composer-1, composer-2-fast, composer-2.5-fast | auto_composer | 标准按百万 token 计价 |
| gpt-5.2, gpt-5.2-codex, gpt-5.3-codex, gpt-5.3-codex-high | api | 同费率（$1.75 / $0.175 / $14 per M） |
| gpt-5.4-medium | api | GPT-5.4 费率（$2.5 / $0.25 / $15 per M） |
| claude-4.5-sonnet-thinking, claude-4.6-sonnet-medium-thinking | api | Claude：约 31% output 按 input 价 |
| claude-4.6-opus-high-thinking | api | Opus 费率（$5 / $6.25 CW / $0.5 / $25）；thinking 规则同上 |
| agent_review | api | `Included`：Auto 池 × 0.849；`Free`：仅 Cache Read @ Auto 池费率（January 校准） |

---

## 4. January 校准（`examples/January - US$1.61.csv`）

官方 **Total spend $1.61**（Cost 列求和 $1.60，差 $0.01 为四舍五入）。当月 On-demand = 0，Total 即 Free 部分。

| 指标 | 值 |
|------|-----|
| 行数 / Free 行 | 8 / 8 |
| 推算 `free_cost` | **$1.59** |
| 推算 `total_cost_with_free` | **$1.59** |
| 与官方差额 | **$0.02**（约 1.2%） |

| 模型 | 结论 |
|------|------|
| **auto**（6 行） | 文档费率完全对齐，逐行 ±$0.01 |
| **agent_review**（1 行） | `Free` 行仅计 Cache Read；若用 Included 规则会高估 +$0.08 |

```bash
cursor-usage "examples/January - US\$1.61.csv" --reconcile
# 8 行全部在 ±$0.01 容差内
```

---

## 5. February 校准（`examples/February - US$46.57.csv`）

官方 **Total spend $46.57**。当月全部为 `Included`（On-demand = 0、Free = 0），故 Total = Included。Cost 列为 `Included` 状态（格式 A），无法逐行对账，仅做**总量校准**。

| 指标 | 值 |
|------|-----|
| 日期范围 | 2026-02-03 ~ 2026-02-28 |
| 总行数 / Included 行 | 455 / 455 |
| 推算 `total_cost` | **$46.32** |
| 与官方差额 | **$0.25**（约 **0.5%**，官方略高） |

### 按模型（推算 Included 费用）

| 模型 | 行数 | 推算费用 | 池 |
|------|------|----------|-----|
| auto | 290 | $24.75 | auto_composer |
| gpt-5.3-codex | 89 | $9.42 | api |
| gpt-5.2-codex | 58 | $7.74 | api |
| claude-4.5-sonnet-thinking | 8 | $1.75 | api |
| claude-4.6-sonnet-medium-thinking | 8 | $1.74 | api |
| claude-4.6-opus-high-thinking | 1 | $0.87 | api |
| composer-1 | 1 | $0.05 | auto_composer |

```bash
cursor-usage "examples/February - US\$46.57.csv"
# 推算费用: $46.32，无 unknown_models
```

---

## 6. March 校准（`examples/March - US$69.94.csv`）

官方 **Total spend $69.94**。当月含 `Included`（618 行）与 `free`（31 行，Cost 列逐行美元，合计 $3.04）；On-demand = 0。Cost 列混用格式 A（Included 状态）与格式 B（Free 金额）。

| 指标 | 值 |
|------|-----|
| 日期范围 | 2026-03-01 ~ 2026-03-31 |
| 总行数 / Included / Free | 662 / 618 / 31 |
| 跳过行 | Errored, No Charge=13 |
| 推算 `total_cost` | **$67.05** |
| 推算 `free_cost` | **$3.05** |
| 推算 `total_cost_with_free` | **$70.09** |
| 与官方差额 | **$0.15**（约 **0.2%**，推算略高） |

### 新增模型（March 首次出现）

| 模型 | 行数（Included） | 推算费用 | 池 | 费率来源 |
|------|------------------|----------|-----|----------|
| gpt-5.4-medium | 93 | $17.77 | api | 官方 GPT-5.4（$2.5 / $0.25 / $15） |
| gpt-5.2 | 34 | $6.20 | api | 同 gpt-5.2-codex |
| composer-2-fast | 6 | $0.33 | auto_composer | 官方 Composer 2（$0.5 / $0.2 / $2.5） |

### 按模型（推算 Included 费用，节选）

| 模型 | 行数 | 推算费用 | 池 |
|------|------|----------|-----|
| auto | 468 | $38.54 | auto_composer |
| gpt-5.4-medium | 93 | $17.77 | api |
| gpt-5.2 | 34 | $6.20 | api |
| gpt-5.3-codex | 15 | $2.19 | api |
| agent_review | 2 | $2.01 | api |
| composer-2-fast | 6 | $0.33 | auto_composer |

```bash
cursor-usage "examples/March - US\$69.94.csv"
# 推算 total_cost_with_free: $70.09，无 unknown_models
```

---

## 7. 回归 Golden Values

| 样例 | 对账字段 | 官方 Total | 推算值 | 差额 |
|------|----------|-----------|--------|------|
| January | `total_cost_with_free` | $1.61 | $1.59 | $0.02 |
| February | `total_cost` | $46.57 | $46.32 | $0.25 |
| March | `total_cost_with_free` | $69.94 | $70.09 | $0.15 |

January 另经 `--reconcile` 验证 8/8 行在 ±$0.01 容差内。

---

## 8. M0 冒烟结论

| 检查项 | 结果 |
|--------|------|
| CSV 解析 | 通过 |
| 模型覆盖（February） | 通过（无 unknown_models） |
| January Total vs $1.61 | 通过（$1.59，差 $0.02） |
| January `--reconcile` | 通过（8/8 行） |
| February Total vs $46.57 | 通过（$46.32，差 0.5%） |
| March Total vs $69.94 | 通过（$70.09，差 0.2%） |
| March 模型覆盖 | 通过（无 unknown_models） |
| Kind 大小写 | 通过（`free` / `Free` / `Included`） |
| JSON 输出 | 通过（`--json` 结构完整） |
| baseline / 池使用率 CLI | 保留（待后续月度样例补充全链路 golden） |

**M0 状态：通过**（January + February + March 与官方几乎对齐），可进入 M1。

---

## 9. Web 阶段待决

| 项 | 状态 |
|----|------|
| 报告 TTL（24h / 7d / 其他） | 待决 |
| Cursor URL 拉取失败文案 | 待决（建议：引导用户下载后上传） |
| UI 是否展示文件名官方 Total 对比 | 待决 |
| daily 时间序列 JSON 字段名 | M1 定义 |
| On-demand Kind 出现后的处理 | 待样本 |

---

## 10. 模块路线图

```
M0 冒烟 + spec（January/February/March）  ← 当前
     → 追加 April / May 样例与 golden
M1  daily 聚合 + 统一 JSON schema
M2  FastAPI POST/GET
M3  临时存储 + TTL
M4  React 上传页
M5  React 报告页 + ECharts
M6  Cursor URL + Docker 部署
```
