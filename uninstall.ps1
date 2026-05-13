#!/usr/bin/env pwsh
# 9router-sync uninstaller for Windows.
$ErrorActionPreference = "Stop"

$APP_DIR = if ($env:APP_DIR) { $env:APP_DIR } else { Join-Path $HOME ".9router-sync" }

# Remove CLI wrapper from common locations
$locations = @(
    (Join-Path $HOME ".local\bin"),
    (Join-Path $HOME "bin")
)

foreach ($loc in $locations) {
    $wrapper = Join-Path $loc "9router-sync.cmd"
    if (Test-Path $wrapper) {
        Remove-Item $wrapper -Force
        Write-Host "removed $wrapper"
    }
}

# Also check PREFIX if set
if ($env:PREFIX) {
    $wrapper = Join-Path $env:PREFIX "9router-sync.cmd"
    if (Test-Path $wrapper) {
        Remove-Item $wrapper -Force
        Write-Host "removed $wrapper"
    }
}

# Remove APP_DIR
if (Test-Path $APP_DIR) {
    Remove-Item $APP_DIR -Recurse -Force
    Write-Host "removed $APP_DIR"
}

Write-Host ""
Write-Host "The Supabase table and ~\.9router\sync.json were left untouched."
Write-Host "Delete them manually if you no longer need them:"
Write-Host "  Remove-Item ~\.9router\sync.json"
