# Cursor Usage Calculator — Spec

本文档记录经冒烟测试与官方数据对比后**已确认**的结论，供 Web 化各模块实现时引用。未确认项标注为「待决」。

**最后更新**：2026-06-26（M0 冒烟）

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

**样例文件**：[`examples/User1.csv`](../examples/User1.csv)、[`examples/User2.csv`](../examples/User2.csv)

### 列名（首行表头）

```
Date, Cloud Agent ID, Automation ID, Kind, Model, Max Mode,
Input (w/ Cache Write), Input (w/o Cache Write), Cache Read,
Output Tokens, Total Tokens, Cost
```

### 计费过滤规则

- 仅统计 `Kind = Included` 的行（常量 `BILLABLE_KIND`）
- 跳过：`Free`、`Errored, No Charge`、`Aborted, Not Charged`（计入 `skipped_rows`，不计费）
- 模型必须在 [`cursor_usage/pricing.py`](../cursor_usage/pricing.py) 的 `PRICING` 中，否则记入 `unknown_models`

---

## 3. 定价规则

详见 [`cursor_usage/pricing.py`](../cursor_usage/pricing.py)。校准来源：Cursor 官方文档 + 2026-06 User1/User2 导出。

| 模型 | 池 | 备注 |
|------|-----|------|
| auto, composer-2.5-fast | auto_composer | 标准按百万 token 计价 |
| gpt-5.3-codex, gpt-5.3-codex-high, claude-4.6-sonnet-medium-thinking | api | Claude：约 31% output 按 input 价 |
| agent_review | api | Bugbot：Auto 池费率 × 0.849 |

---

## 4. 基准校准（User1）

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

## 5. 回归 Golden Values

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

## 6. M0 冒烟结论

| 检查项 | 结果 |
|--------|------|
| CSV 解析 | 通过 |
| 模型覆盖 | 通过（无 unknown_models） |
| User1 总费用 vs $186.99 | **有偏差**（$181.69，−2.8%），可接受并记录 |
| baseline → 额度反推 | 通过（$144.52 / $44.84） |
| User2 全链路使用率 | 通过（CLI 可输出双池 %） |
| JSON 输出 | 通过（`--json` 结构完整） |

**M0 状态：通过**（含已知定价偏差），可进入 M1。

---

## 7. Web 阶段待决

| 项 | 状态 |
|----|------|
| 报告 TTL（24h / 7d / 其他） | 待决 |
| Cursor URL 拉取失败文案 | 待决（建议：引导用户下载后上传） |
| 是否在 UI 展示官方 $186.99 对比 | 待决 |
| daily 时间序列 JSON 字段名 | M1 定义 |

---

## 8. 模块路线图

```
M0 冒烟 + spec  ← 当前
M1  daily 聚合 + 统一 JSON schema
M2  FastAPI POST/GET
M3  临时存储 + TTL
M4  React 上传页
M5  React 报告页 + ECharts
M6  Cursor URL + Docker 部署
```
