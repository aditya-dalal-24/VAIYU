<#
.SYNOPSIS
    Starts VAIYU locally: AI service, backend and console, in the background.

.DESCRIPTION
    Built for a laptop that is also running a browser and an IDE. The obvious
    way to run the stack - `mvn spring-boot:run` plus `npm run dev` - keeps a
    Maven JVM alive beside the application JVM and runs Vite's dev server, and
    together with PyTorch that was enough for Windows to kill services on a
    16 GB machine. This script runs the packaged jar with a capped heap and the
    production build of the console instead, which is the same code at a
    fraction of the memory.

    It checks every prerequisite first and says exactly what is missing, and it
    installs what can be installed (frontend packages, the backend jar, the
    console build) rather than failing on them.

    Logs go to logs\ in the repository root. Stop everything with
    scripts\stop-local.ps1.

.PARAMETER Rebuild
    Rebuild the backend jar and the console even if builds already exist. Use
    after pulling or editing code.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\start-local.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\start-local.ps1 -Rebuild
#>
param(
    [switch]$Rebuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $root 'logs'
$pidFile = Join-Path $logs 'vaiyu.pids'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

function Step($message) { Write-Host "  $message" -ForegroundColor Cyan }
function Ok($message) { Write-Host "  [ok] $message" -ForegroundColor Green }
function Fail($message) {
    Write-Host "  [!!] $message" -ForegroundColor Red
    exit 1
}

function Test-Port([int]$port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        return $async.AsyncWaitHandle.WaitOne(500) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-Http([string]$url, [int]$seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -lt 500) { return $true }
        } catch {
            if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -lt 500) {
                return $true
            }
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

Write-Host ""
Write-Host "VAIYU - local start" -ForegroundColor White
Write-Host ""

# --- Refuse to double-start ------------------------------------------------
if (Test-Path $pidFile) {
    $alive = Get-Content $pidFile | Where-Object { $_ -match '^\d+$' } |
        Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }
    if ($alive) {
        Fail "VAIYU already appears to be running (PIDs $($alive -join ', ')). Run scripts\stop-local.ps1 first."
    }
    Remove-Item $pidFile
}
foreach ($port in 8000, 8081, 5173) {
    if (Test-Port $port) {
        Fail "Port $port is already in use. Stop whatever holds it (a leftover 'npm run dev' or 'mvn spring-boot:run'?) and try again."
    }
}

# --- Prerequisites ---------------------------------------------------------
Step "Checking prerequisites"

foreach ($tool in 'java', 'node', 'npm') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Fail "'$tool' is not on PATH. Install it (Java 17, Node 20+) and open a new terminal."
    }
}

$python = Join-Path $root 'ai-service\.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    Fail "The AI service virtualenv is missing. From ai-service\: python -m venv .venv; .venv\Scripts\pip install -r requirements.txt"
}

$envFile = Join-Path $root 'backend\.env'
if (-not (Test-Path $envFile)) {
    Fail "backend\.env is missing. Copy backend\.env.example to backend\.env and set DB_PASSWORD and VAIYU_ADMIN_TOKEN."
}

if (-not (Test-Port 5432)) {
    Fail "PostgreSQL is not accepting connections on port 5432. Start the PostgreSQL service (services.msc), then retry."
}

$checkpoints = Join-Path $root 'ai-service\checkpoints'
$models = @(Get-ChildItem -Path $checkpoints -Filter '*.pt' -ErrorAction SilentlyContinue)
if ($models.Count -eq 0) {
    Write-Host "  [--] No trained checkpoints in ai-service\checkpoints: forecasts will report NOT_AVAILABLE." -ForegroundColor Yellow
}
Ok "prerequisites present"

# --- Builds ----------------------------------------------------------------
# Native tools are run through cmd with cmd's own redirection. Windows
# PowerShell 5.1 turns every stderr line from a native command into an error
# record, and under ErrorActionPreference=Stop a harmless warning from Vite or
# Maven would abort the whole script.
$frontend = Join-Path $root 'frontend'
if (-not (Test-Path (Join-Path $frontend 'node_modules\.bin\vite.cmd'))) {
    Step "Installing frontend packages (node_modules is missing)"
    Push-Location $frontend
    $log = Join-Path $logs 'npm-install.log'
    try { cmd /c "npm ci --no-audit --no-fund > `"$log`" 2>&1" }
    finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { Fail "npm ci failed - see logs\npm-install.log" }
    Ok "frontend packages installed"
}

$backend = Join-Path $root 'backend'
$jar = Get-ChildItem -Path (Join-Path $backend 'target') -Filter 'vaiyu-backend-*.jar' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike '*.original' } | Select-Object -First 1
if ($Rebuild -or -not $jar) {
    Step "Building the backend jar"
    Push-Location $backend
    $log = Join-Path $logs 'backend-build.log'
    try { cmd /c "mvn -q -DskipTests clean package > `"$log`" 2>&1" }
    finally { Pop-Location }
    $jar = Get-ChildItem -Path (Join-Path $backend 'target') -Filter 'vaiyu-backend-*.jar' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike '*.original' } | Select-Object -First 1
    if (-not $jar) { Fail "Backend build failed - see logs\backend-build.log" }
    Ok "backend jar built"
}

$serverEntry = Join-Path $frontend '.output\server\index.mjs'
$nitroInfo = Join-Path $frontend '.output\nitro.json'
$isNodeBuild = (Test-Path $nitroInfo) -and ((Get-Content $nitroInfo -Raw) -match '"preset":\s*"node-server"')
if ($Rebuild -or -not (Test-Path $serverEntry) -or -not $isNodeBuild) {
    Step "Building the console"
    Push-Location $frontend
    try {
        # node-server, not the project's default cloudflare-module preset,
        # which produces a Workers bundle with no Node server in it.
        $env:NITRO_PRESET = 'node-server'
        $log = Join-Path $logs 'frontend-build.log'
        cmd /c "npm run build > `"$log`" 2>&1"
    } finally {
        Remove-Item Env:NITRO_PRESET -ErrorAction SilentlyContinue
        Pop-Location
    }
    if (-not (Test-Path $serverEntry)) { Fail "Console build failed - see logs\frontend-build.log" }
    Ok "console built"
}

# --- Start -----------------------------------------------------------------
$pids = @()

Step "Starting AI service on :8000"
$ai = Start-Process -FilePath $python `
    -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000' `
    -WorkingDirectory (Join-Path $root 'ai-service') `
    -RedirectStandardOutput (Join-Path $logs 'ai-service.log') `
    -RedirectStandardError (Join-Path $logs 'ai-service.err.log') `
    -WindowStyle Hidden -PassThru
$pids += $ai.Id

Step "Starting backend on :8081"
# A 512 MB heap is ample for this API and keeps the JVM from sizing itself to
# a quarter of the machine. SerialGC is the leanest collector for one user.
$api = Start-Process -FilePath 'java' `
    -ArgumentList '-Xms128m', '-Xmx512m', '-XX:+UseSerialGC', '-jar', "`"$($jar.FullName)`"" `
    -WorkingDirectory $backend `
    -RedirectStandardOutput (Join-Path $logs 'backend.log') `
    -RedirectStandardError (Join-Path $logs 'backend.err.log') `
    -WindowStyle Hidden -PassThru
$pids += $api.Id

Step "Starting console on :5173"
$previousPort = $env:PORT
$env:PORT = '5173'
$env:HOST = '127.0.0.1'
$web = Start-Process -FilePath 'node' `
    -ArgumentList "`"$serverEntry`"" `
    -WorkingDirectory $frontend `
    -RedirectStandardOutput (Join-Path $logs 'frontend.log') `
    -RedirectStandardError (Join-Path $logs 'frontend.err.log') `
    -WindowStyle Hidden -PassThru
$env:PORT = $previousPort
Remove-Item Env:HOST -ErrorAction SilentlyContinue
$pids += $web.Id

$pids | Set-Content $pidFile

# --- Health ----------------------------------------------------------------
Step "Waiting for everything to come up"
$aiUp = Wait-Http 'http://127.0.0.1:8000/api/v1/health' 90
$apiUp = Wait-Http 'http://127.0.0.1:8081/actuator/health' 120
$webUp = Wait-Http 'http://127.0.0.1:5173/' 60

Write-Host ""
if ($aiUp) { Ok "AI service   http://127.0.0.1:8000" } else { Write-Host "  [!!] AI service did not answer - see logs\ai-service.err.log" -ForegroundColor Red }
if ($apiUp) { Ok "backend      http://127.0.0.1:8081" } else { Write-Host "  [!!] backend did not answer - see logs\backend.log" -ForegroundColor Red }
if ($webUp) { Ok "console      http://localhost:5173" } else { Write-Host "  [!!] console did not answer - see logs\frontend.err.log" -ForegroundColor Red }
Write-Host ""

if ($aiUp -and $apiUp -and $webUp) {
    try {
        $status = Invoke-RestMethod -Uri 'http://127.0.0.1:8081/api/v1/system/status' -TimeoutSec 10
        $loaded = @($status.ai.models.PSObject.Properties | Where-Object { $_.Value.available }).Count
        Write-Host "  $($status.data.cyclones) storms, $($status.data.observations) fixes, $loaded trained models loaded" -ForegroundColor White
        if ($status.data.cyclones -eq 0) {
            Write-Host "  The archive is empty. Load it with scripts\ingest-local.ps1" -ForegroundColor Yellow
        }
    } catch { }
    Write-Host ""
    Write-Host "  Open http://localhost:5173   -   stop with scripts\stop-local.ps1" -ForegroundColor White
    Write-Host ""
} else {
    exit 1
}
