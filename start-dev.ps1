param([switch]$CheckOnly, [switch]$NoBrowser)

# UTF-8 BOM is required by Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Root = $PSScriptRoot
Set-Location -LiteralPath $Root
$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = (@($env:Path, $machinePath, $userPath) | Where-Object { $_ }) -join ';'

function Get-PythonVersion([string]$Exe, [string[]]$PrefixArgs = @()) {
    try {
        # Start-Process joins ArgumentList with spaces, breaking Python's -c code.
        # The call operator preserves argument boundaries and paths with spaces.
        $versionText = & $Exe @PrefixArgs -c 'import sys; print(sys.version.split()[0]); sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>$null
        if ($LASTEXITCODE -eq 0) { return ($versionText | Select-Object -Last 1) }
    } catch {}
    return $null
}

function Find-Python {
    $candidates = @()
    if ($env:SUNCRAFT_PYTHON) { $candidates += $env:SUNCRAFT_PYTHON }
    $candidates += (Join-Path $Root '.venv\Scripts\python.exe')
    foreach ($name in @('python.exe', 'python3.exe')) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command -and $command.Source -notmatch 'WindowsApps') { $candidates += $command.Source }
    }
    $installRoot = Join-Path $env:LocalAppData 'Programs\Python'
    if (Test-Path -LiteralPath $installRoot) {
        $candidates += @(Get-ChildItem -LiteralPath $installRoot -Directory |
            Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'python.exe' })
    }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (Test-Path -LiteralPath $candidate) {
            $versionText = Get-PythonVersion $candidate
            if ($versionText) { return @{ Exe = $candidate; Prefix = @(); Version = $versionText } }
        }
    }
    $py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($py) {
        $versionText = Get-PythonVersion $py.Source @('-3')
        if ($versionText) { return @{ Exe = $py.Source; Prefix = @('-3'); Version = $versionText } }
    }
    throw '未找到可用的 Python 3.11+。请安装 Python，或设置 SUNCRAFT_PYTHON 为 python.exe 的完整路径。'
}

function Test-PortFree([int]$Port) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try { $listener.Start(); return $true } catch { return $false } finally { $listener.Stop() }
}

$backendProcess = $null
$frontendProcess = $null
try {
    Write-Host '夏遮冬透 · SunCraft'
    Write-Host '开发入口：http://127.0.0.1:5174/  |  后端：127.0.0.1:8001'
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $node -or -not $npm) { throw '未找到 Node.js / npm，请安装 Node.js 22.12+（或 24 LTS）。' }
    $nodeVersion = (& $node.Source -p 'process.versions.node').Trim()
    if ([version]$nodeVersion -lt [version]'22.12.0') { throw "Node.js $nodeVersion 版本过低，需要 22.12+。" }
    $python = Find-Python
    Write-Host "Node.js $nodeVersion | Python $($python.Version) ($($python.Exe))"
    if ($CheckOnly) { Write-Host '环境检测通过。'; exit 0 }

    foreach ($port in @(5174, 8001)) {
        if (-not (Test-PortFree $port)) {
            throw "端口 $port 已被占用。若 SunCraft 已启动，请直接打开 http://127.0.0.1:5174/；否则先关闭占用程序。"
        }
    }
    $venvPy = Join-Path $Root '.venv\Scripts\python.exe'
    if (-not (Get-PythonVersion $venvPy)) {
        Write-Host '正在创建 / 修复本项目的 Python 虚拟环境…'
        if ($python.Exe -eq $venvPy) { throw '本项目 .venv 不可用，请设置 SUNCRAFT_PYTHON 为系统 Python 后重试。' }
        $prefixArgs = $python.Prefix
        & $python.Exe @prefixArgs -m venv (Join-Path $Root '.venv')
        if ($LASTEXITCODE -ne 0) { throw '创建虚拟环境失败，请检查上方错误。' }
    }
    # A previous interrupted install may have left .venv without its packages.
    $dependenciesReady = $false
    try {
        & $venvPy -c 'import fastapi, uvicorn, numpy, pydantic' 2>$null
        $dependenciesReady = ($LASTEXITCODE -eq 0)
    } catch {}
    if (-not $dependenciesReady) {
        Write-Host '正在安装 / 补齐后端依赖…'
        & $venvPy -m pip install --disable-pip-version-check -r (Join-Path $Root 'backend\requirements.txt')
        if ($LASTEXITCODE -ne 0) { throw '安装后端依赖失败，请检查网络和上方错误后重试。' }
    }
    $frontendDir = Join-Path $Root '前端文件'
    $viteBin = Join-Path $frontendDir 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path -LiteralPath $viteBin)) {
        Push-Location -LiteralPath $frontendDir
        try {
            & $npm.Source ci --no-fund
            if ($LASTEXITCODE -ne 0) { throw '前端依赖安装失败，请检查上方 npm ci 的错误。' }
        } finally { Pop-Location }
    }

    $logDir = Join-Path $Root '.cache\run'
    New-Item -Path $logDir -ItemType Directory -Force | Out-Null
    $previousEntry = $env:SUNCRAFT_DEV_ENTRY
    try {
        $env:SUNCRAFT_DEV_ENTRY = '1'
        $backendProcess = Start-Process -FilePath $venvPy -ArgumentList '-m uvicorn --app-dir backend suncraft.demo:app --host 127.0.0.1 --port 8001' -WorkingDirectory $Root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'backend.out.log') -RedirectStandardError (Join-Path $logDir 'backend.err.log')
    } finally { $env:SUNCRAFT_DEV_ENTRY = $previousEntry }
    $frontendProcess = Start-Process -FilePath $node.Source -ArgumentList ('"' + $viteBin + '" --host 127.0.0.1 --port 5174 --strictPort') -WorkingDirectory $frontendDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'frontend.out.log') -RedirectStandardError (Join-Path $logDir 'frontend.err.log')

    $healthy = $false
    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline) {
        if ($backendProcess.HasExited -or $frontendProcess.HasExited) { break }
        try {
            $preset = Invoke-RestMethod 'http://127.0.0.1:8001/api/presets' -TimeoutSec 2
            $page = Invoke-WebRequest 'http://127.0.0.1:5174/' -UseBasicParsing -TimeoutSec 2
            if ($preset.room -and $page.StatusCode -eq 200) { $healthy = $true; break }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $healthy) {
        foreach ($name in @('backend.err.log', 'frontend.err.log')) {
            Get-Content -LiteralPath (Join-Path $logDir $name) -Tail 12 -ErrorAction SilentlyContinue | Write-Host
        }
        throw "前端或后端未能启动。日志位于 $logDir"
    }
    Write-Host '前端和后端均已就绪：http://127.0.0.1:5174/'
    Write-Host '使用期间请保留此窗口；按 Ctrl+C 停止两项服务。'
    if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5174/' }
    while (-not $backendProcess.HasExited -and -not $frontendProcess.HasExited) { Start-Sleep -Milliseconds 500 }
    throw "服务已退出，请检查 $logDir 中的日志。"
} catch {
    Write-Host "启动失败：$($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    foreach ($service in @($backendProcess, $frontendProcess)) {
        if ($service -and -not $service.HasExited) { Stop-Process -Id $service.Id -ErrorAction SilentlyContinue }
    }
}
