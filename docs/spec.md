# Cursor Usage Calculator — Spec

本文档记录经冒烟测试与官方数据对比后**已确认**的结论，供 Web 化各模块实现时引用。未确认项标注为「待决」。

**最后更新**：2026-06-26（February 校准 + 新模型定价）

---

## 1. 产品约束（已确认）

| 项 | 结论 |
|----|------|
| 认证 | 无登录、无密码 |
| 输入方式 | 本地上传 CSV；可选粘贴 Cursor 导出 URL（服务端拉取可能因 Cookie 失败，上传为主路径） |
| 报告生成 | 实时：上传/导入 → 即时分析 → 生成报告页 |
| 报告 URL | `/r/{uuid}`，知道链接即可访问 |
| 报告存储 | 临时（TTL 待决，见 §6） |

---

## 2. CSV 格式

来源：Cursor Dashboard → Export usage events CSV。

**样例文件**：[`examples/User1.csv`](../examples/User1.csv)、[`examples/User2.csv`](../examples/User2.csv)、[`examples/January - US$1.61.csv`](../examples/January%20-%20US$1.61.csv)、[`examples/February - US$46.57.csv`](../examples/February%20-%20US$46.57.csv)

### 列名（首行表头）

```
Date, Cloud Agent ID, Automation ID, Kind, Model, Max Mode,
Input (w/ Cache Write), Input (w/o Cache Write), Cache Read,
Output Tokens, Total Tokens, Cost
```

### Kind 与 Cost 列（两种导出格式）

| 格式 | 样例 | `Kind` | `Cost` 列含义 |
|------|------|--------|---------------|
| A | User1 / User2 / February | `Included` / `Free`（首字母大写） | 计费**状态**（`Included`、`Free`、`-`） |
| B | January | `free`（小写亦支持） | 逐行**美元金额**（如 `0.21`） |

- `Kind` 匹配**大小写不敏感**（`normalize_kind()`）
- 格式 B 可用于 golden 对账：`cursor-usage file.csv --reconcile`（见 [`reconcile.py`](../cursor_usage/reconcile.py)）

### 计费过滤规则

- 仅统计 `Kind = Included` 的行（常量 `BILLABLE_KIND`）→ `total_cost`（套餐付费额度）
- `Kind = Free`：计入 `free_cost`（免费额度消耗推算），汇总为 `total_cost_with_free`
- 跳过：`Errored, No Charge`、`Aborted, Not Charged`（计入 `skipped_rows`）
- 模型必须在 [`cursor_usage/pricing.py`](../cursor_usage/pricing.py) 的 `PRICING` 中，否则记入 `unknown_models`

### 官方折扣（待决）

官方可能对部分用量打折；CSV 中**未必有独立折扣列**，仅体现为 `Cost` 低于 token 公式推算。对账时若 `官方 < 推算`，可能是折扣、不同计费规则或逐行四舍五入，**不能单凭一行断定**（`reconcile` 模块会标注 `possible_discount`）。

---

## 3. 定价规则

详见 [`cursor_usage/pricing.py`](../cursor_usage/pricing.py)。校准来源：Cursor 官方文档 + 2026-06 User1/User2 导出。

| 模型 | 池 | 备注 |
|------|-----|------|
| auto, composer-1, composer-2.5-fast | auto_composer | 标准按百万 token 计价 |
| gpt-5.2-codex, gpt-5.3-codex, gpt-5.3-codex-high | api | 同费率（$1.75 / $0.175 / $14 per M） |
| claude-4.5-sonnet-thinking, claude-4.6-sonnet-medium-thinking | api | Claude：约 31% output 按 input 价 |
| claude-4.6-opus-high-thinking | api | Opus 费率（$5 / $6.25 CW / $0.5 / $25）；thinking 规则同上 |
| agent_review | api | `Included`：Auto 池 × 0.849；`Free`：仅 Cache Read @ Auto 池费率（January 校准，待更多样本） |

---

## 4. January 校准（`examples/January - US$1.61.csv`）

官方合计 **$1.61**（Cost 列求和 $1.60，差 $0.01 为四舍五入）。

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

官方合计 **$46.57**（Dashboard 月度 on-demand / Included 用量）。Cost 列为 `Included` 状态（格式 A），无法逐行对账，仅能做**总量校准**。

| 指标 | 值 |
|------|-----|
| 日期范围 | 2026-02-03 ~ 2026-02-28 |
| 总行数 / 计费行 | 455 / 455 |
| 推算总费用 | **$46.32** |
| 与官方差额 | **$0.25**（约 **0.5%**，官方略高） |

### 新发现模型（此前未覆盖，占差额主体）

| 模型 | 行数 | 推算费用 | 池 | 费率来源 |
|------|------|----------|-----|----------|
| gpt-5.2-codex | 58 | $7.74 | API | 同 gpt-5.3-codex |
| claude-4.5-sonnet-thinking | 8 | $1.75 | API | 同 Sonnet thinking |
| claude-4.6-opus-high-thinking | 1 | $0.87 | API | Opus $5/$25 + thinking 规则 |
| composer-1 | 1 | $0.05 | Auto+Composer | $1.25 / $0.125 / $10 |

未覆盖时仅统计已知模型合计 **$35.91**，差额 **$10.66**（22.9%）——主要来自上述 68 行 `Included` 被跳过。

```bash
cursor-usage "examples/February - US\$46.57.csv"
# 推算费用: $46.32，无 unknown_models
```

**附注**：[`examples/February - US$48.18.csv`](../examples/February%20-%20US$48.18.csv) 为同月数据末尾追加 January 8 行 `free`（$1.61），合计 $46.57 + $1.61 ≈ $48.18。

---

## 6. 基准校准（User1）

### 官方参考（Cursor 控制台）

| 指标 | 值 |
|------|-----|
| 合计费用 | **US$186.99** |
| Auto + Composer 池使用率 | **95%** |
| API 池使用率 | **99%** |

### CLI 推算结果（`examples/User1.csv`）

| 指标 | CLI 值 |
|------|--------|
| 日期范围 | 2026-05-28 ~ 2026-06-25 |
| 总行数 / 计费行 | 1053 / 1003 |
| 未识别模型 | 无 |
| **推算总费用** | **$181.69** |
| Auto+Composer 池费用 | $137.29 |
| API 池费用 | $44.39 |

### 与官方偏差

- 差额：$186.99 − $181.69 = **$5.30**（约 **+2.8%**）
- **结论**：核心流程可用；总费用与官方存在已知偏差，Web 展示时需注明「推算值，可能与账单略有差异」。后续 M1+ 可考虑按模型/池微调定价或排查未覆盖计费类型。

### 反推套餐额度（baseline 参数 0.95 / 0.99）

```
auto_composer_limit = 137.29 / 0.95 = $144.52
api_limit           = 44.39 / 0.99 = $44.84
合计额度             = $189.36
```

与 README 示例一致。

---

## 7. 回归 Golden Values

### User1 按模型费用（USD）

| 模型 | 费用 | 行数 | 池 |
|------|------|------|-----|
| auto | 99.08 | 793 | auto_composer |
| composer-2.5-fast | 38.21 | 82 | auto_composer |
| gpt-5.3-codex | 31.14 | 116 | api |
| gpt-5.3-codex-high | 6.91 | 8 | api |
| claude-4.6-sonnet-medium-thinking | 5.98 | 3 | api |
| agent_review | 0.36 | 1 | api |

### User2 独立分析（`examples/User2.csv`）

| 指标 | 值 |
|------|-----|
| 日期范围 | 2026-06-26（单日） |
| 总行数 / 计费行 | 115 / 114 |
| 推算总费用 | **$25.72** |
| Auto+Composer 池 | $12.02 |
| API 池 | $13.70 |

### User2 + User1 baseline 全链路

命令：

```bash
cursor-usage examples/User2.csv \
  --baseline examples/User1.csv \
  --auto-composer-usage 0.95 \
  --api-usage 0.99
```

| 指标 | 值 |
|------|-----|
| Auto+Composer 额度 | $144.52 |
| API 额度 | $44.84 |
| Auto+Composer 已用 | $12.02 (**8.3%**) |
| API 已用 | $13.70 (**30.5%**) |
| 合计已用 | $25.72 (**13.6%**) |

User2 官方对比数据：待用户补充后可追加本表。

---

## 8. M0 冒烟结论

| 检查项 | 结果 |
|--------|------|
| CSV 解析 | 通过 |
| 模型覆盖 | 通过（无 unknown_models） |
| User1 总费用 vs $186.99 | **有偏差**（$181.69，−2.8%），可接受并记录 |
| baseline → 额度反推 | 通过（$144.52 / $44.84） |
| User2 全链路使用率 | 通过（CLI 可输出双池 %） |
| JSON 输出 | 通过（`--json` 结构完整） |
| January golden + `--reconcile` | 通过（8/8 行） |
| February golden（$46.57 总量） | 通过（推算 $46.32，差 0.5%） |
| Kind 大小写 | 通过（`free` / `Free`） |

**M0 状态：通过**（含已知定价偏差），可进入 M1。

---

## 9. Web 阶段待决

| 项 | 状态 |
|----|------|
| 报告 TTL（24h / 7d / 其他） | 待决 |
| Cursor URL 拉取失败文案 | 待决（建议：引导用户下载后上传） |
| 是否在 UI 展示官方 $186.99 对比 | 待决 |
| daily 时间序列 JSON 字段名 | M1 定义 |

---

## 10. 模块路线图

```
M0 冒烟 + spec  ← 当前
M1  daily 聚合 + 统一 JSON schema
M2  FastAPI POST/GET
M3  临时存储 + TTL
M4  React 上传页
M5  React 报告页 + ECharts
M6  Cursor URL + Docker 部署
```
