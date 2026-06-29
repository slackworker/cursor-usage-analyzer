# Web — 产品实现

浏览器端上传 Cursor 用量 CSV，生成交互式报告。解析在本地完成，不上传文件。

在线演示：https://slackworker.github.io/cursor-usage-analyzer/

## 开发

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
npm run test
```

## 功能

与 [`README.md`](../README.md#报告内容) 一致：费用 KPI、口径切换、构成与分布图、活动与热力图、池投影、PNG 导出。

计费规则见 [`docs/spec.md`](../docs/spec.md)；逻辑在 `src/lib/`（`parser`、`aggregation`、`pricing`）。

## 目录

```
src/
├── pages/          # 报告页
├── components/     # UI 与图表
├── store/          # 状态
└── lib/            # 解析与聚合
```
