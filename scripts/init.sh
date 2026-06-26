#!/usr/bin/env bash
# WSL / Linux 项目环境初始化（可重复执行）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MIN_PYTHON="3.10"

if ! command -v python3 >/dev/null 2>&1; then
  echo "错误: 未找到 python3，请先安装 Python >= ${MIN_PYTHON}" >&2
  exit 1
fi

PYTHON_VERSION="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" || {
  echo "错误: 需要 Python >= ${MIN_PYTHON}，当前为 ${PYTHON_VERSION}" >&2
  exit 1
}

echo "==> 项目目录: $ROOT"
echo "==> Python: $(python3 --version)"

if [[ ! -d .venv ]]; then
  echo "==> 创建虚拟环境 .venv"
  python3 -m venv .venv
else
  echo "==> 虚拟环境已存在，跳过创建"
fi

echo "==> 升级 pip / setuptools / wheel"
.venv/bin/python -m pip install -U pip setuptools wheel

echo "==> 以可编辑模式安装本项目"
.venv/bin/pip install -e .

echo ""
echo "初始化完成。"
echo "激活虚拟环境: source .venv/bin/activate"
echo "验证 CLI:       .venv/bin/cursor-usage --help"
