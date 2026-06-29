# 开发校准脚本

早期计费调查用的辅助脚本，含硬编码基准值（`OFFICIAL` 等）。

日常分析请使用主 CLI：`cursor-usage`。正式回归测试见 `tests/calibration.py`。

## 用法

三个脚本均接受可选的 CSV 路径参数；未指定时使用 `examples/` 中的本地校准导出（见 [`examples/README.md`](../examples/README.md)）：

```bash
python tools/calibrate_fast.py
python tools/calibrate_fast.py path/to/usage-events.csv

python tools/calibrate_daily2.py path/to/usage-events.csv
python tools/calc_user2_legacy.py path/to/usage-events.csv
```
