# 本地校准 CSV

本目录用于存放从 [Cursor Usage 页面](https://cursor.com/dashboard/USAGE) 导出的 usage events CSV，**不纳入版本库**（见根目录 `.gitignore`）。

可随时增删、替换导出文件；文件名通常含官方 **Total spend**（如 `June - US$141.24.csv`），仅作本地识别用。

## 用法

1. 将导出的 CSV 放入本目录（路径任意，文件名自定）。
2. 运行 CLI：`cursor-usage path/to/your-export.csv`
3. 若要与既有校准用例对照，在 [`tests/calibration.py`](../tests/calibration.py) 中维护 `CALIBRATION_CASES`（`filename` 指向本目录下的文件），然后运行：

```bash
python -m unittest discover -s tests -v
```

缺少对应 CSV 时，相关回归测试会自动 **skip**，不影响定价规则等不依赖样例的测试。

## 当前校准用例（代码为准）

| 用例 | 预期文件（`examples/` 下） |
|------|---------------------------|
| january | `January - US$1.61.csv` |
| february | `February - US$46.57.csv` |
| march | `March - US$69.94.csv` |
| april | `April - US$137.09.csv` |
| may | `May - US$92.01.csv` |
| june | `June - US$141.24.csv` |
| cycle | `May 27 - Jun 27 US$195.22 100% + 100% .csv` |

完整官方/推算金额与容差见 `tests/calibration.py`；规格说明见 [`docs/spec.md`](../docs/spec.md#6-样例验证)。
