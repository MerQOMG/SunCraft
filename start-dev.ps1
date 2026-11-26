# SunCraft current Windows entry. Called by start-dev.cmd.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try { chcp 65001 | Out-Null } catch {}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root

$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = (@($machinePath, $userPath, $env:Path) | Where-Object { $_ }) -join ';'

function Write-Info([string]$Message) { Write-Host $Message }
function Fail([string]$Message) {
    Write-Host ""
    Write-Host $Message
    exit 1
}

function Get-PythonVersion([string]$Exe, [string[]]$PrefixArgs) {
    $allArgs = @()
    if ($PrefixArgs) { $allArgs += $PrefixArgs }
    $allArgs += @('-c', 'import sys; print("%d.%d.%d" % sys.version_info[:3]); raise SystemExit(0 if sys.version_info >= (3, 11) else 1)')
    $p = Start-Process -FilePath $Exe -ArgumentList $allArgs -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\suncraft-py-ver.txt" -RedirectStandardError "$env:TEMP\suncraft-py-ver-err.txt"
    $out = ''
    if (Test-Path -LiteralPath "$env:TEMP\suncraft-py-ver.txt") {
        $out = (Get-Content -LiteralPath "$env:TEMP\suncraft-py-ver.txt" -Raw -ErrorAction SilentlyContinue)
    }
    return @{ Code = $p.ExitCode; Out = ($out -replace '\s+$', '') }
}

function Find-Python {
    $venvPy = Join-Path $Root '.venv\Scripts\python.exe'
    if (Test-Path -LiteralPath $venvPy) {
        $v = Get-PythonVersion $venvPy @()
        if ($v.Code -eq 0) { return @{ Exe = $venvPy; Prefix = @(); Note = "existing .venv ($($v.Out))" } }
    }

    $named = @(
        (Join-Path $env:LocalAppData 'Programs\Python\Python314\python.exe'),
        (Join-Path $env:LocalAppData 'Programs\Python\Python313\python.exe'),
        (Join-Path $env:LocalAppData 'Programs\Python\Python312\python.exe'),
        (Join-Path $env:LocalAppData 'Programs\Python\Python311\python.exe')
    )
    foreach ($cand in $named) {
        if (Test-Path -LiteralPath $cand) {
            $v = Get-PythonVersion $cand @()
            if ($v.Code -eq 0) { return @{ Exe = $cand; Prefix = @(); Note = $v.Out } }
        }
    }

    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) {
        $v = Get-PythonVersion $py.Source @('-3')
        if ($v.Code -eq 0) { return @{ Exe = $py.Source; Prefix = @('-3'); Note = "py -3 $($v.Out)" } }
    }

    foreach ($name in @('python.exe', 'python3.exe')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if (-not $cmd) { continue }
        if ($cmd.Source -match 'WindowsApps') { continue }
        $v = Get-PythonVersion $cmd.Source @()
        if ($v.Code -eq 0) { return @{ Exe = $cmd.Source; Prefix = @(); Note = "$($cmd.Source) $($v.Out)" } }
    }
    return $null
}

function Test-PortFree([int]$Port) {
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($listener) { $listener.Stop() }
    }
}

Write-Info '夏遮冬透 · SunCraft  当前开发入口'
Write-Info '浏览器请打开  http://127.0.0.1:5174/'
Write-Info '不要双击 前端文件\SunCraft-离线演示.html，也不要把 start-demo.cmd 当作当前入口。'
Write-Info ''

$node = Get-Command node.exe -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm.exe -ErrorAction SilentlyContinue }
if (-not $node -or -not $npm) {
    Fail "未找到 Node.js 或 npm。请安装 Node.js 22.12 或以上（或 24 LTS），并确保安装时带有 npm。`n下载：https://nodejs.org/"
}
$nodeVerRaw = (& $node.Source -v 2>$null)
$nodeVer = $nodeVerRaw.TrimStart('v')
$parts = $nodeVer.Split('.')
$major = 0; $minor = 0
[void][int]::TryParse($parts[0], [ref]$major)
if ($parts.Count -gt 1) { [void][int]::TryParse($parts[1], [ref]$minor) }
if (-not ($major -gt 22 -or ($major -eq 22 -and $minor -ge 12))) {
    Fail "当前 Node.js 版本为 $nodeVerRaw，需要 22.12 或以上（或 24 LTS）。请升级后再试。"
}
Write-Info "已找到 Node.js $nodeVerRaw ，npm $(& $npm.Source -v)"

$python = Find-Python
if (-not $python) {
    Fail "未找到 Python 3.11 或以上。请从 https://www.python.org/downloads/ 安装，并勾选 Add python.exe to PATH。"
}
Write-Info "已找到 Python $($python.Note)"

foreach ($port in 5174, 8001) {
    if (-not (Test-PortFree $port)) {
        Fail "端口 $port 已被占用。请先关闭占用该端口的程序，再重新运行本脚本。`n当前入口固定为 http://127.0.0.1:5174/ （后端 8001），不会自动更换端口。"
    }
}

$venvPy = Join-Path $Root '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $venvPy)) {
    Write-Info '未找到 .venv，正在创建虚拟环境并安装后端依赖...'
    $venvArgs = @()
    if ($python.Prefix) { $venvArgs += $python.Prefix }
    $venvArgs += @('-m', 'venv', (Join-Path $Root '.venv'))
    $p = Start-Process -FilePath $python.Exe -ArgumentList $venvArgs -Wait -PassThru -NoNewWindow
    if ($p.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $venvPy)) {
        Fail '创建 Python 虚拟环境失败。请确认已安装 Python 3.11 或以上。'
    }
    $pipArgs = @('-m', 'pip', 'install', '--disable-pip-version-check', '-r', (Join-Path $Root 'backend\requirements.txt'))
    $p = Start-Process -FilePath $venvPy -ArgumentList $pipArgs -Wait -PassThru -NoNewWindow
    if ($p.ExitCode -ne 0) { Fail '安装后端依赖失败。请检查网络后重试：pip install -r backend\requirements.txt' }
} else {
    Write-Info '已使用现有 .venv'
}

$frontendDir = Join-Path $Root '前端文件'
$viteBin = Join-Path $frontendDir 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $viteBin)) {
    Write-Info '未找到前端依赖，正在前端文件目录执行 npm ci...'
    $p = Start-Process -FilePath $npm.Source -ArgumentList @('ci') -WorkingDirectory $frontendDir -Wait -PassThru -NoNewWindow
    if ($p.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $viteBin)) {
        Fail '前端依赖安装失败。请在「前端文件」目录检查 npm ci 的报错后重试。'
    }
} else {
    Write-Info '已使用现有 前端文件\node_modules'
}

Write-Info ''
Write-Info '正在启动后端 127.0.0.1:8001 与前端 127.0.0.1:5174 ...'

$backendCmd = "title SunCraft backend 8001&& set SUNCRAFT_DEV_ENTRY=1&& .venv\Scripts\python.exe -m uvicorn --app-dir backend suncraft.demo:app --host 127.0.0.1 --port 8001"
Start-Process -FilePath $env:ComSpec -ArgumentList @('/k', $backendCmd) -WorkingDirectory $Root | Out-Null
Start-Process -FilePath $env:ComSpec -ArgumentList @('/k', 'title SunCraft frontend 5174&& npm run dev') -WorkingDirectory $frontendDir | Out-Null

$ok5174 = $false
$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline) {
    try {
        $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:5174/' -UseBasicParsing -TimeoutSec 3
        if ($resp.StatusCode -eq 200) { $ok5174 = $true; break }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if ($ok5174) {
    Write-Info ''
    Write-Info '启动成功。请在浏览器打开： http://127.0.0.1:5174/'
    Write-Info '关闭那两个标题为后端/前端的命令窗口，即可停止程序。'
    Start-Process 'http://127.0.0.1:5174/'
    exit 0
}

Write-Info ''
Write-Info '后端和前端窗口已打开，但 45 秒内还没有检测到 http://127.0.0.1:5174/ 返回成功。'
Write-Info '请查看新打开的两个命令窗口是否有报错，稍后再打开 http://127.0.0.1:5174/'
exit 0
