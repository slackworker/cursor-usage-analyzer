# Cursor Usage Calculator

根据 Cursor 导出的用量 CSV，推算 token 费用与套餐池使用率。

## 能做什么

1. **计费模型** — 以 [Cursor 官方定价](https://cursor.com/docs/models-and-pricing) 为基础，用本地校准 CSV 验证（详见 [`docs/spec.md`](docs/spec.md)）。
2. **费用推算** — 用户提供 CSV，输出 **standard**（标准口径）与 **official**（官方口径）两种合计。
3. **池使用率** — 按 Auto+Composer / API 两池推算使用百分比；可指定额度（正向）或从 Dashboard 使用率反推额度（反推）。
4. **Web 可视化** — 浏览器上传 CSV，本地生成交互式报告（见 [`web/README.md`](web/README.md)）。

## 安装

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

也可运行 `scripts/init.sh` 完成 Python 环境初始化。

## Web 可视化

```bash
cd web && npm install && npm run dev
```

默认打开 http://localhost:5173，上传 CSV 即可。开发与构建说明见 [`web/README.md`](web/README.md)。

## 本地校准 CSV

从 [Cursor Usage 页面](https://cursor.com/dashboard/USAGE) 导出的 CSV 放在 [`examples/`](examples/) 目录，**不纳入版本库**（可随时增删替换）。说明见 [`examples/README.md`](examples/README.md)；用例定义与预期金额以 [`tests/calibration.py`](tests/calibration.py) 为准。

## 用法

### 费用推算

```bash
cursor-usage path/to/usage-events.csv                    # standard（标准口径，默认）
cursor-usage path/to/usage-events.csv --billing-mode official  # 官方口径
```

对齐官方 Usage 页面 **Total spend** 时用 `official`（官方口径）；要看 Included + On-demand + Free 全量时用 `standard`（标准口径，默认）。两种口径说明见 [`docs/spec.md`](docs/spec.md#4-两种计费口径)。

### 池使用率

默认按 **$145 / $45** 池额度（**$20/月 Pro** 套餐经验值）、**official** 口径计算（每次运行均输出）：

```bash
cursor-usage path/to/usage-events.csv
cursor-usage target.csv --auto-composer-limit 150 --api-limit 50
```

从 Dashboard 使用率反推额度（基准 CSV 默认同主文件）：

```bash
cursor-usage target.csv --auto-composer-usage 1.0 --api-usage 1.0
cursor-usage target.csv --baseline baseline.csv --auto-composer-usage 0.95 --api-usage 0.99
```

### 其他

```bash
cursor-usage file.csv --json                              # JSON 输出
cursor-usage file.csv --reconcile                         # Cost 列为美元时逐行对账
python -m unittest discover -s tests -v                   # 回归测试（缺本地 CSV 时相关用例 skip）
```

## 文档

| 文件 | 内容 |
|------|------|
| [`docs/spec.md`](docs/spec.md) | 计费模型、CSV 格式、两种口径、池使用率、样例验证 |
| [`cursor_usage/pricing.py`](cursor_usage/pricing.py) | 模型费率（代码即源） |
| [`cursor_usage/pricing_sources.py`](cursor_usage/pricing_sources.py) | 非官方项置信度 |
| [`examples/README.md`](examples/README.md) | 本地校准 CSV 说明 |
| [`tests/calibration.py`](tests/calibration.py) | 校准用例与预期金额 |
| [`web/README.md`](web/README.md) | Web 前端开发与使用 |

## 项目结构

```
├── cursor_usage/       # CLI：pricing, calculator, cli, reconcile
├── web/                # Web 可视化（React + Vite）
├── examples/           # 本地校准 CSV（gitignore，见 examples/README.md）
├── tests/
├── docs/spec.md
└── tools/              # 早期校准脚本（日常请用 cursor-usage）
```

## 许可

[MIT](LICENSE)
