# Windows 原生环境初始化（PowerShell，可重复执行）
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$MinPython = [version]"3.10"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "未找到 python，请先安装 Python >= 3.10"
}

$VersionText = (python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')").Trim()
$Version = [version]$VersionText
if ($Version -lt $MinPython) {
    Write-Error "需要 Python >= 3.10，当前为 $VersionText"
}

Write-Host "==> 项目目录: $Root"
Write-Host "==> Python: $(python --version)"

if (-not (Test-Path ".venv")) {
    Write-Host "==> 创建虚拟环境 .venv"
    python -m venv .venv
} else {
    Write-Host "==> 虚拟环境已存在，跳过创建"
}

Write-Host "==> 升级 pip / setuptools / wheel"
& .\.venv\Scripts\python.exe -m pip install -U pip setuptools wheel

Write-Host "==> 以可编辑模式安装本项目"
& .\.venv\Scripts\pip.exe install -e .

Write-Host ""
Write-Host "初始化完成。"
Write-Host "激活虚拟环境: .\.venv\Scripts\Activate.ps1"
Write-Host "验证 CLI:       .\.venv\Scripts\cursor-usage.exe --help"
