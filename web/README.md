# Web 可视化

浏览器端上传 Cursor 用量 CSV，生成交互式报告。解析在本地完成，不上传文件。

## 快速开始

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物在 dist/
npm run test
```

## 功能

- 费用 KPI、standard / official 口径切换
- 费用构成、按池分布、模型分布、Token 结构
- 按日 / 时活动、年度热力图、池使用率投影
- 图表 PNG 导出

计费与池逻辑对齐 [`docs/spec.md`](../docs/spec.md)；实现见 `src/lib/`（`parser`、`aggregation`、`pricing`）。

## 目录

```
web/src/
├── pages/          # 报告页
├── components/     # UI 与图表
├── store/          # 状态
└── lib/            # 解析与聚合
```
