# Cursor Usage Analyzer

在浏览器里解析 Cursor 导出的用量 CSV，本地生成交互式费用报告。文件不上传服务器。

**在线使用**：https://slackworker.github.io/cursor-usage-analyzer/

## 怎么用

1. 打开 [Cursor Usage](https://cursor.com/dashboard/USAGE) 页面，点击 **Export CSV**
2. 打开上方在线地址，上传 CSV
3. 查看费用 KPI、图表与池使用率

## 报告内容

- 费用 KPI；**standard** / **official** 两种口径切换（对齐官方 Total spend 选 official，详见 [`docs/spec.md` §4](docs/spec.md#4-两种计费口径)）
- 费用构成、按池 / 模型分布、Token 结构
- 按日 / 时活动、年度热力图、池使用率投影
- 图表 PNG 导出

## 设计原则

- 费率以 [Cursor 官方定价](https://cursor.com/docs/models-and-pricing) 为准，用样例 CSV 校准；**不为拟合 Dashboard 而改价**
- 推算按文档全价；与官方 Total 的常见偏差约 1–2%（活动期间可能更大），详见 [`docs/spec.md` §6–§7](docs/spec.md#6-样例验证)
- Auto+Composer / API 两池使用率按 Included **费用**计（非 Token），默认额度为 $20/月 Pro 经验值

想深入了解计费规则与 CSV 语义，见 [`docs/spec.md`](docs/spec.md)。

## 架构

```
用户 → Web 页 (web/, TypeScript)     ← 对外产品
         └─ 解析与计费：web/src/lib/

维护 → docs/spec.md（规则契约）
         ├─ Python CLI (cursor_usage/)   ← 早期原型 + 回归对照
         └─ tests/calibration_cases.json + examples/
```

当前对外产品是 **Web**；Python CLI 供开发与回归，普通用户无需安装。本地开发与 CLI 说明见 [`docs/dev.md`](docs/dev.md)。

## 文档

| 文档 | 读者 |
|------|------|
| [`docs/spec.md`](docs/spec.md) | 计费模型、CSV 格式、口径、池、已知偏差 |
| [`docs/dev.md`](docs/dev.md) | 环境、CLI、测试、校准 |
| [`web/README.md`](web/README.md) | 前端 dev / build |

## 许可

[MIT](LICENSE)
