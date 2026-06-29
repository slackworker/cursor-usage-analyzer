# 本地校准 CSV

本目录用于存放从 [Cursor Usage 页面](https://cursor.com/dashboard/USAGE) 导出的 usage events CSV，**不纳入版本库**（见根目录 `.gitignore`）。

可随时增删、替换导出文件；文件名通常含官方 **Total spend**（如 `June - US$141.24.csv`），仅作本地识别用。

## 用法

1. 将导出的 CSV 放入本目录（路径任意，文件名自定）。
2. 运行 CLI：`cursor-usage path/to/your-export.csv`
3. 若要与既有校准用例对照，在 [`tests/calibration_cases.json`](../tests/calibration_cases.json) 中维护用例（`filename` 指向本目录下的文件），然后运行：

```bash
python -m unittest discover -s tests -v
cd web && npm test
```

缺少对应 CSV 时，相关回归测试会自动 **skip**，不影响定价规则等不依赖样例的测试。

用例名称、预期金额与容差以 [`tests/calibration_cases.json`](../tests/calibration_cases.json) 为准；规格说明见 [`docs/spec.md`](../docs/spec.md#6-样例验证)。
