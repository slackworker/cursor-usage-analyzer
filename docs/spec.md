# Cursor Usage Calculator — Spec

本文档记录经冒烟测试与官方数据对比后**已确认**的结论，供 Web 化各模块实现时引用。未确认项标注为「待决」。

**最后更新**：2026-06-27（账单周期样例 §8.4；周期 Total 偏差原因未明）

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
| [`June - US$137.62.csv`](../examples/June%20-%20US$137.62.csv) | $137.62 | 全 `Included`；含 composer-2.5-fast 日级验证；见 §8 |
| [`May 27 - Jun 27 US$191.60 100% + 100%.csv`](../examples/May%2027%20-%20Jun%2027%20US$191.60%20100%25%20%2B%20100%25.csv) | $191.60 | **账单周期**（5/27–6/26）；双池 100%；见 §8.4 |

月度样例命名：`{Month} - US${total}.csv`。账单周期样例命名：`{Start} - {End} US${total} {auto%} + {api%}.csv`。

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

**Errored + Cost=Free（已确认）**：`Kind=Errored, No Charge` 时 `Cost` 列可能出现 `Free`、`-` 或空（June 样例 13 行）。这与 `Kind=Free` **无关**，仅为 Dashboard 导出中的展示残留，**不代表**免费额度消耗。此类行**彻底排除**：不计入 `total_cost`、`free_cost`、`total_tokens` 及按模型/池汇总；仅在 `skipped_rows` 中计数供审计。`Cost` 列值对跳过逻辑无影响（一律按 `Kind` 判定）。

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
| 与 Dashboard 偏差 | 未建模的限时折扣/活动价、**历史 Max Mode 口径变更**等可能使 Dashboard 与文档推算不一致；January–June 样例多在 1–2% 内（February 因 Max Mode 切换除外）。工具报文档口径下的费用估算，不逐条拟合历史折扣 |

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
| `composer-2.5-fast` 费率 | **csv_reconciled** | Composer **pricing** 表 → Composer 2.5 **(Fast)**（$3 / $0.5 / $15）；June 22–25 按模型日合计验证（见下） |
| `agent_review` 计费 | **csv_inferred** | 基数似 Auto 池四列公式；无官方 Bugbot per-token 行（见下） |
| `AGENT_REVIEW_DISCOUNT_RATIO` | **unconfirmed** | 默认 **1.0（全价）**；样本显示存在折扣但无稳定系数，**暂不改** |
| CSV slug 映射（如 `gpt-5.4-medium` → GPT-5.4、`claude-4.6-sonnet-medium-thinking` → Claude 4.6 Sonnet） | **slug_mapped** | 费率来自文档对应行，slug 为 thinking effort / 档位变体 |
| `gpt-5.3-codex-high` → GPT-5.3 Codex | **slug_mapped** | June 仅 8 行 Included；**未**单独做日级验证；见下 |

**slug_mapped** 项费率本身来自官方表，仅模型 ID 映射需留意；**csv_inferred** 项在 CLI 输出中会附加「费率置信度提示」。

#### thinking effort 与费率（已确认）

CSV slug 中的 `-high`、`-medium-thinking` 等后缀表示 **thinking effort / 档位变体**，**不影响计费费率**（费率同基座模型文档行）；仅影响出 token 的时间与数量。`gpt-5.3-codex-high` 与 `gpt-5.3-codex` 同价（**slug_mapped** → GPT-5.3 Codex）；June 样例 8 行、未做日级验证，置信度与同类 thinking 变体一致。

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

#### composer-2.5-fast 按模型日合计验证（2026-06-27）

Dashboard 按模型日合计与 token 公式（Composer pricing 表 → Composer 2.5 **Fast**：$3 / $0.5 / $15）对比；样本来自 [`June - US$137.62.csv`](../examples/June%20-%20US$137.62.csv) 全部 82 行 Included（当次校验聚焦 6/22–6/25 四日）。

| 日期 | 行数 | 官方 | 公式推算 | 偏差 |
|------|------|------|----------|------|
| 2026-06-22 | 1 | $2.15 | $2.14 | -0.5% |
| 2026-06-23 | 1 | $1.96 | $1.96 | **-0.1%** |
| 2026-06-24 | 11 | $10.32 | $10.36 | +0.4% |
| 2026-06-25 | 69 | $23.61 | $23.75 | +0.6% |
| **合计** | **82** | **$38.04** | **$38.21** | **+0.4%** |

**已确认**：文档费率 $3 / $0.5 / $15 正确；勿与 API 表 Composer 2.5（$0.5 / $0.2 / $2.5）混淆。6/23 几乎完全吻合，6/22 差 $0.01。  
**仍存噪声**：6/25 行数多（69 行）时推算略高 +$0.14，与 Included 月常见的「先算后舍入 vs 官方日合计舍入」一致，非独立折扣系数。  
**当前策略**：维持 `PRICING` 不变；按官方文档计费，不为拟合而改价。

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

### 3.2 Max Mode 计费（已确认，向前看口径）

CSV **`Max Mode`** 列（`Yes` / `No`）与 UI 中 Max Mode 开关对应。不同模型开启 Max Mode 时行为不同，**勿混用**：

| 模型 | Max Mode 在 UI 上的含义 | 计费规则（`Max Mode=Yes`） |
|------|------------------------|---------------------------|
| **gpt-5.3-codex** / **gpt-5.3-codex-high** | 开启 **Fast**（priority processing，即 high fast） | 四列 token **全部 ×2** |
| **gpt-5.4-medium** / **gpt-5.5-medium** | 开启**长上下文**能力（不开启 Fast） | 仅当 **input（icw + icwo + cr）> 272k** 时：Input（含 Cache Write / w/o Cache Write）与 Cache Read **×2**，Output **×1.5**；否则标准价 |
| 其他模型 | 视模型而定 | 当前样例无 `Max Mode=Yes` 行，暂不调整 |

实现：[`cursor_usage/pricing.py`](../cursor_usage/pricing.py) 中 `max_mode_adjusted_cost()`；[`calculator.py`](../cursor_usage/calculator.py) 解析 CSV `Max Mode` 列并传入 `_row_cost()`。

**文档来源**：[GPT-5.5 Pricing](https://cursor.com/docs/models/gpt-5-5)（272k cliff、input/cache read 2×、output 1.5×）；Codex 5.3 Max Mode = Fast 2× 来自 UI 与产品语义确认。

#### 样例验证

| 日期 | 场景 | 结论 |
|------|------|------|
| **2026-05-02** | gpt-5.5-medium 18 行，**全部 `Max Mode=No`**（含 8 行 input > 272k） | 标准价推算 **$15.666 ≈ 官方 $15.67**；**不**套用 272k cliff（cliff 需 `Max Mode=Yes`） |
| **2026-05-02** | auto 27 行 | 标准价 **$1.687 ≈ 官方 $1.69**；单日合计 **$17.35 ≈ 官方 $17.36** |
| **2026-02-10** | gpt-5.3-codex 9 行，**全部 `Max Mode=Yes`** | 见 §5「历史偏差」——官方日合计与当前 ×2 文档口径不一致 |

**原则**：工具按**当前文档费率 + Max Mode 规则**向前推算；历史 Dashboard Total 若低于文档口径（旧加价、活动等），在样例 § 中**说明原因**，不为拟合而改 `PRICING`。

### 3.3 池额度推断（`infer_limits_from_baseline`）

CLI `--baseline` + `--auto-composer-usage` / `--api-usage` 从基准 CSV 反推各池总额度：

```
池额度 = 基准 CSV 该池 Included 费用 / Dashboard 使用率
```

| 项 | 结论 |
|----|------|
| 计费口径 | **固定 official**（对齐 Dashboard Total spend）；即使用户对目标 CSV 传 `--free-pricing-mode strict`，基准分析仍用 official |
| 分子 | 仅 `pool.cost`（`Kind=Included`）；**不含** `free_cost` |
| Free 是否占池额度 | **未知**（待样本）；当前推断假设 Free 不消耗 Included 池额度 |
| 验证状态 | **部分验证**——[`May 27 - Jun 27 …`](../examples/May%2027%20-%20Jun%2027%20US$191.60%20100%25%20%2B%20100%25.csv) 双池 100% 可作基准；推断额度为文档推算值，与 Dashboard Total 存在 §8.4 已知偏差（原因未明） |

实现：[`cursor_usage/calculator.py`](../cursor_usage/calculator.py) 中 `infer_limits_from_baseline()`；CLI 基准文件解析见 [`cli.py`](../cursor_usage/cli.py)。

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

官方 **Total spend $46.57**。当月全部为 `Included`（On-demand = 0、Free = 0），故 Total = Included。Cost 列为 `Included` 状态（格式 A），无法逐行对账，仅做**总量对照**。

| 指标 | 值 |
|------|-----|
| 日期范围 | 2026-02-03 ~ 2026-02-28 |
| 总行数 / Included 行 | 455 / 455 |
| 推算 `total_cost`（**含 Max Mode ×2**） | **$48.04** |
| 与官方差额 | **-$1.47**（约 **3.2%**，推算高于官方） |

### 历史偏差说明（不为拟合而改价）

当月有 **9 行** `gpt-5.3-codex` 且 **`Max Mode=Yes`**（均在 2026-02-10）。按当前文档（Max Mode = Fast，全 token ×2）推算后，当月 Included 合计 **$48.04**，高于官方 **$46.57**。

**2026-02-10 日级对照**（Dashboard 按模型日合计 gpt-5.3-codex **$1.87**）：

| 假设 | 当日 gpt-5.3-codex 推算 |
|------|-------------------------|
| 标准价（忽略 Max Mode） | $1.55 |
| **当前文档口径（Max Mode ×2）** | **$3.10** |
| 官方 Dashboard | **$1.87**（介于两者之间，接近旧版 **1.2×** Max Mode 加价） |

**结论**：February 官方 Total 很可能仍按 **2026 年 2 月尚未完全切换到 Fast 2×** 的旧计费口径出账；工具自本版起按**向前看的文档全价 + Max Mode 规则**推算，故与 2 月官方 Total 存在已知偏差。**不为拟合 2 月数据而回退倍率**；新导出 CSV 按 §3.2 规则推断。

### 按模型（推算 Included 费用，含 Max Mode）

| 模型 | 行数 | 推算费用 | 池 |
|------|------|----------|-----|
| auto | 290 | $24.75 | auto_composer |
| gpt-5.3-codex | 89 | $10.97 | api |
| gpt-5.2-codex | 58 | $7.74 | api |
| claude-4.5-sonnet-thinking | 8 | $1.81 | api |
| claude-4.6-sonnet-medium-thinking | 8 | $1.81 | api |
| claude-4.6-opus-high-thinking | 1 | $0.91 | api |
| composer-1 | 1 | $0.05 | auto_composer |

```bash
cursor-usage "examples/February - US\$46.57.csv"
# 推算费用: $48.04（文档 Max Mode 口径），无 unknown_models
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

### 8.3 日级对账异常（5/30–6/1，原因未明）

账单周期 CSV 在 **5/30–6/1** 附近，Dashboard **按模型日合计**与工具按 CSV `Date`（UTC 日历日）聚合的 Included 费用**对不上**；其余多数日期（如 5/28–5/29、6/2–6/6 的 auto）可在 ±$0.01 内吻合。

| 日期（auto） | 官方日合计 | 推算日合计 | 差额 |
|--------------|-----------|-----------|------|
| 5/28 | $5.10 | $5.09 | -$0.01 |
| 5/29 | $13.69 | $13.68 | -$0.01 |
| **5/30** | **$13.56** | **$15.72** | **+$2.16** |
| **5/31** | **$21.27** | **$12.35** | **-$8.92** |
| **6/1** | **$2.71** | **$4.43** | **+$1.72** |
| 6/2–6/6 | 吻合 | 吻合 | ±$0.01 |

**重要**：若差异仅来自「日历日归属不同」（同一批事件划到不同日期），**整段周期 Total 仍应对齐**——事件集合不变，只是日分布变了。本样例在**已导出完整周期 CSV** 的前提下，周期 Total 仍差 **$4.52**（见 §8.4），故**不能**将 §8.3 的日级异常简单归因于时区或日切裁切。

CSV 中 5/30 末行与 5/31 首行、5/31 末行与 6/1 首行之间有时间空档（无事件行），仅为**已观测事实**；是否在 Dashboard 侧仍有对应计费、是否说明导出遗漏，**目前无法确认**。

### 8.4 账单周期（`examples/May 27 - Jun 27 US$191.60 100% + 100%.csv`）

官方 **Total spend $191.60**（文件名）。覆盖账单周期 **2026-05-27 ~ 2026-06-26**（导出末行 UTC 为 6/26）。

| 指标 | 数值 |
|------|------|
| 总行数 / Included / Free | 1155 / 1034 / 98 |
| 跳过行 | Errored, No Charge=20、Aborted, Not Charged=3 |
| On-demand | **0**（用户确认） |
| Free（`Cost=Free` 状态） | **不计入** Total（5/27 官方 $0.00 已验证） |
| 双池使用率 | Auto+Composer **100%**、API **100%**（无分池美元明细） |
| 推算 `total_cost`（official 口径） | **$187.08** |
| 与官方差额 | **-$4.52**（约 **2.4%**，推算低于官方） |

**结构**：本文件 Included 分段与月度样例重叠段一致（May 28–31 共 $47.26 + Jun 1–26 共 $139.81 = $187.08）；5/27 仅 Free 行。

#### 偏差说明（原因未明；不为拟合而改 `PRICING`）

- 用户已导出**完整账单周期** CSV，官方 Total **$191.60** 与按文档费率对全部 Included 行的推算 **$187.08** 仍差 **$4.52**。
- **未能确定**差额来源：不是单一模型费率错误（模型全覆盖、多数日级吻合），也不能用「仅日切口径不同」解释——那种情况只影响日分布，**不应改变周期 Total**。
- §8.3 中 5/30–6/1 的日级异常与上述周期 Total 偏差**同时存在**，二者是否同一根因、各自占比多少，**目前均不清楚**。
- 与其他月度样例类似，可能存在 Dashboard 侧未公开的舍入、折扣或计费细节；本周期偏差略大（2.4%），但**无足够证据**指向具体规则。

**当前策略**：工具仍报文档全价推算；在 spec / 测试中记录官方 Total 与推算值及容差；**不**为拟合 $191.60 调整 `PRICING` 或编造解释性系数。日级展示可对 5/30–6/1 标注「与 Dashboard 日合计不一致，原因未明」。

```bash
cursor-usage "examples/May 27 - Jun 27 US\$191.60 100% + 100%.csv"
# 推算 total_cost: $187.08（official 口径）

cursor-usage "examples/May 27 - Jun 27 US\$191.60 100% + 100%.csv" \
  --baseline "examples/May 27 - Jun 27 US\$191.60 100% + 100%.csv" \
  --auto-composer-usage 1.0 --api-usage 1.0
# 推断池额度（文档推算口径）: Auto+Composer $142.24, API $44.83
```

---

## 9. 回归 Golden Values

| 样例 | 对账字段 | 官方 Total | 推算值 | 差额 |
|------|----------|-----------|--------|------|
| January | `total_cost_with_free` | $1.61 | $1.73 | $0.12 |
| February | `total_cost` | $46.57 | $48.04 | -$1.47 |
| March | `total_cost_with_free` | $69.94 | $70.79 | $0.85 |
| April | `total_cost` | $137.09 | $139.26 | $2.17 |
| May | `total_cost_with_free` | $92.01 | $91.45 | -$0.56 |
| June | `total_cost` | $137.62 | $139.81 | +$2.19 |
| **May 27 – Jun 27 周期** | `total_cost` | $191.60 | $187.08 | **-$4.52**（§8.4，原因未明；约 2.4%） |

January 另经 `--reconcile` 验证：auto 6/6 行在 ±$0.01 容差内；agent_review 1 行官方低于推算（`possible_discount`）。

---

## 10. M0 冒烟结论

| 检查项 | 结果 |
|--------|------|
| CSV 解析 | 通过 |
| 模型覆盖（February） | 通过（无 unknown_models） |
| January Total vs $1.61 | 通过（$1.73，差 $0.12；agent_review 可能折扣） |
| January `--reconcile` | auto 6/6 行通过；agent_review 1 行 `possible_discount` |
| February Total vs $46.57 | 已知偏差（+$1.47）：2 月官方或仍为旧 Max Mode 口径；工具按 §3.2 向前推算 |
| March Total vs $69.94 | 通过（$70.79，差 1.2%） |
| March 模型覆盖 | 通过（无 unknown_models） |
| April Total vs $137.09 | 通过（$139.26，差 1.6%，文档费率） |
| April 模型覆盖 | 通过（无 unknown_models） |
| Kind 大小写 | 通过（`free` / `Free` / `Included`） |
| JSON 输出 | 通过（`--json` 结构完整） |
| baseline / 池使用率 CLI | 已实现；双池 100% 基准见 §8.4 |
| 账单周期 Total vs $191.60 | 已知偏差（-$4.52，原因未明）；工具按文档全价推算 |

**M0 状态：通过**（January–June + 账单周期样例），可进入 M1。

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
M0 冒烟 + spec（January–June + 账单周期，已落地 Free 状态行不计费规则）  ← 当前
     → 账单周期 Total 偏差已记录（§8.4，原因未明）；不拟合 PRICING
M1  daily 聚合 + 统一 JSON schema
M2  FastAPI POST/GET
M3  临时存储 + TTL
M4  React 上传页
M5  React 报告页 + ECharts
M6  Cursor URL + Docker 部署
```
