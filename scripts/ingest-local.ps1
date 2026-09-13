<#
.SYNOPSIS
    Loads (or reloads) the storm archive into the local database.

.DESCRIPTION
    Reads the admin token from backend\.env, so it never has to be typed or
    pasted into a shell history. Safe to re-run: the import only inserts what
    is missing and fills columns added since a fix was first stored.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root 'backend\.env'

$line = Get-Content $envFile | Where-Object { $_ -match '^\s*VAIYU_ADMIN_TOKEN\s*=' } | Select-Object -Last 1
$token = if ($line) { ($line -split '=', 2)[1].Trim() } else { '' }
if ($token.Length -lt 24) {
    Write-Host "  VAIYU_ADMIN_TOKEN in backend\.env is missing or shorter than 24 characters." -ForegroundColor Red
    Write-Host "  Generate one: python -c ""import secrets; print(secrets.token_hex(32))""" -ForegroundColor Red
    exit 1
}

Write-Host "  Loading the archive (about 30 seconds)..." -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8081/api/internal/ingest/ibtracs' `
        -Headers @{ 'X-Admin-Token' = $token } -TimeoutSec 600
    Write-Host "  $($result.storms) storms, $($result.observations) fixes, $($result.malformedRows) malformed rows" -ForegroundColor Green
    Write-Host "  newly inserted: $($result.stormsInserted) storms, $($result.observationsInserted) fixes" -ForegroundColor Green
} catch {
    Write-Host "  Ingest failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Is the backend running? (scripts\start-local.ps1)" -ForegroundColor Red
    exit 1
}
