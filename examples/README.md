# 本地校准 CSV

存放从 [Cursor Usage 页面](https://cursor.com/dashboard/USAGE) 导出的 CSV，**不纳入版本库**（见根目录 `.gitignore`）。

文件名可含官方 **Total spend**（如 `June - US$141.24.csv`），仅作本地识别。

## 用法

1. 将 CSV 放入本目录
2. 在 [`tests/calibration_cases.json`](../tests/calibration_cases.json) 维护用例（`filename` 指向本目录文件）
3. 按 [`docs/dev.md`](../docs/dev.md) 跑回归测试

缺 CSV 时相关用例自动 **skip**。预期金额与容差以 `calibration_cases.json` 为准；规则见 [`docs/spec.md` §6](../docs/spec.md#6-样例验证)。
