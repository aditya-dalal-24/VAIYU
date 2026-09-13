<#
.SYNOPSIS
    Stops the VAIYU processes started by scripts\start-local.ps1.

.DESCRIPTION
    Stops only the processes the start script recorded, never anything else
    that happens to be listening on the same ports.
#>
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root 'logs\vaiyu.pids'

if (-not (Test-Path $pidFile)) {
    Write-Host "  VAIYU is not running (no logs\vaiyu.pids)." -ForegroundColor Yellow
    exit 0
}

foreach ($processId in Get-Content $pidFile | Where-Object { $_ -match '^\d+$' }) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        # /T takes the child processes with it (uvicorn and node can spawn them).
        cmd /c "taskkill /PID $processId /T /F" | Out-Null
        Write-Host "  stopped $($process.ProcessName) ($processId)" -ForegroundColor Green
    }
}
Remove-Item $pidFile
Write-Host "  VAIYU stopped." -ForegroundColor White
