#!/usr/bin/env pwsh
# 9router-sync installer for Windows.
#
# Run from a clone:    .\install.ps1
# Run via curl:        iwr -useb https://raw.githubusercontent.com/<owner>/9router-sync/main/install.ps1 | iex
#
# Env overrides:
#   PREFIX     install dir for the CLI wrapper (default: ~\.local\bin or ~\bin)
#   APP_DIR    where the package lives  (default: ~\.9router-sync)

$ErrorActionPreference = "Stop"

# ---------- pretty printers --------------------------------------------------
$script:UseColor = $Host.UI.RawUI.ForegroundColor -ne $null
function info($msg)  { if ($UseColor) { Write-Host "$([char]27)[2m>$([char]27)[0m $msg" } else { Write-Host "> $msg" } }
function ok($msg)    { if ($UseColor) { Write-Host "$([char]27)[32m+$([char]27)[0m $msg" } else { Write-Host "+ $msg" } }
function warn($msg)  { if ($UseColor) { Write-Host "$([char]27)[33m!$([char]27)[0m $msg" } else { Write-Host "! $msg" } }
function die($msg)   { if ($UseColor) { Write-Host "$([char]27)[31mX$([char]27)[0m $msg" } else { Write-Host "X $msg" }; exit 1 }

# ---------- platform check ---------------------------------------------------
if ($IsLinux -or $IsMacOS) {
    die "unsupported OS: use install.sh on Unix systems"
}

# ---------- Node.js version check --------------------------------------------
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    die "node not found in PATH (need Node.js >= 18)"
}

$nodeMajor = [int](node -p 'process.versions.node.split(".")[0]')
if ($nodeMajor -lt 18) {
    die "node $(node -v) too old (need >= 18)"
}

# ---------- npm check --------------------------------------------------------
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    die "npm not found in PATH"
}

# ---------- where to install -------------------------------------------------
$APP_DIR = if ($env:APP_DIR) { $env:APP_DIR } else { Join-Path $HOME ".9router-sync" }

function Get-Prefix {
    if ($env:PREFIX) { return $env:PREFIX }
    
    $pathDirs = $env:PATH -split ";"
    $localBin = Join-Path $HOME ".local\bin"
    $homeBin = Join-Path $HOME "bin"
    
    if ($pathDirs -contains $localBin) { return $localBin }
    if ($pathDirs -contains $homeBin) { return $homeBin }
    
    # Default to .local\bin
    return $localBin
}

$PREFIX = Get-Prefix

# ---------- locate sources (local checkout) ----------------------------------
$SCRIPT_DIR = $PSScriptRoot
if (-not $SCRIPT_DIR) {
    $SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
}

if ((Test-Path (Join-Path $SCRIPT_DIR "package.json")) -and 
    (Test-Path (Join-Path $SCRIPT_DIR "bin\9router-sync"))) {
    $SOURCE_DIR = $SCRIPT_DIR
    info "using local checkout at $SOURCE_DIR"
} else {
    die "run this script from the 9router-sync directory (package.json not found)"
}

# ---------- copy + install dependencies --------------------------------------
info "installing into $APP_DIR"

if (-not (Test-Path $APP_DIR)) {
    New-Item -ItemType Directory -Path $APP_DIR -Force | Out-Null
}

# Mirror only the files we ship (matches `files` in package.json).
$entries = @("bin", "lib", "package.json", "README.md", "LICENSE", "uninstall.ps1", "9router-sync.cmd")

foreach ($entry in $entries) {
    $srcPath = Join-Path $SOURCE_DIR $entry
    $dstPath = Join-Path $APP_DIR $entry
    
    if (-not (Test-Path $srcPath)) { continue }
    
    if (Test-Path $dstPath) {
        Remove-Item $dstPath -Recurse -Force
    }
    
    if (Test-Path $srcPath -PathType Container) {
        Copy-Item -Path $srcPath -Destination $dstPath -Recurse -Force
    } else {
        Copy-Item -Path $srcPath -Destination $dstPath -Force
    }
}

Push-Location $APP_DIR
try {
    info "installing better-sqlite3 (this compiles a native module)"
    npm install --omit=dev --no-audit --no-fund --silent
} finally {
    Pop-Location
}

# ---------- copy CLI wrapper -------------------------------------------------
$wrapperName = "9router-sync.cmd"
$srcWrapper = Join-Path $APP_DIR $wrapperName
$dstWrapper = Join-Path $PREFIX $wrapperName

if (-not (Test-Path $PREFIX)) {
    New-Item -ItemType Directory -Path $PREFIX -Force | Out-Null
}

if (Test-Path $dstWrapper) {
    Remove-Item $dstWrapper -Force
}

Copy-Item -Path $srcWrapper -Destination $dstWrapper -Force
ok "copied $dstWrapper"

# ---------- verify -----------------------------------------------------------
try {
    & $dstWrapper --help | Out-Null
    ok "9router-sync installed"
} catch {
    die "installed binary failed to run; try: $dstWrapper --help"
}

# ---------- PATH check -------------------------------------------------------
$pathDirs = $env:PATH -split ";"
if ($pathDirs -notcontains $PREFIX) {
    warn "$PREFIX is not on your PATH"
    warn "add this to your PowerShell profile:"
    warn '  $env:PATH = "' + $PREFIX + ';$env:PATH"'
}

# ---------- next steps -------------------------------------------------------
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. 9router-sync --init              # print config template + Supabase SQL"
Write-Host "  2. save it to ~\.9router\sync.json with your supabaseUrl + supabaseKey"
Write-Host "  3. run the printed SQL in Supabase"
Write-Host "  4. 9router-sync                     # merge both directions"
Write-Host ""
Write-Host "To uninstall:"
Write-Host "  Remove-Item '$dstWrapper' && Remove-Item '$APP_DIR' -Recurse"
