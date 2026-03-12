param(
  [switch]$SkipInstall,
  [switch]$SkipBuild,
  [switch]$FastZip
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$packageRoot = Join-Path $root ".package"
$staging = Join-Path $packageRoot "phabricator-dashboard-standalone"
$zipPath = Join-Path $root "phabricator-dashboard-standalone.zip"
$standaloneRoot = Join-Path $root ".next/standalone"

Write-Host "Preparing standalone package..."

Push-Location $root
try {
  if (-not $SkipInstall) {
    Write-Host "Ensuring dependencies are installed..."
    npm install
    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed"
    }
  } else {
    Write-Host "Skipping dependency install."
  }

  if (-not $SkipBuild) {
    Write-Host "Building production bundle..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed"
    }
  } else {
    Write-Host "Skipping build."
  }
}
finally {
  Pop-Location
}

if (-not (Test-Path (Join-Path $standaloneRoot "server.js"))) {
  throw "Missing .next/standalone/server.js. Run npm run build before packaging."
}

if (Test-Path $packageRoot) {
  Remove-Item -Path $packageRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $staging | Out-Null

Write-Host "Copying Next standalone runtime..."
Copy-Item -Path (Join-Path $standaloneRoot "*") -Destination $staging -Recurse -Force

$nextStaticSource = Join-Path $root ".next/static"
$nextStaticTarget = Join-Path $staging ".next/static"
if (Test-Path $nextStaticSource) {
  New-Item -ItemType Directory -Path (Join-Path $staging ".next") -Force | Out-Null
  Copy-Item -Path $nextStaticSource -Destination $nextStaticTarget -Recurse -Force
}

$runtimeItems = @("public", "data")
foreach ($item in $runtimeItems) {
  $src = Join-Path $root $item
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination (Join-Path $staging $item) -Recurse -Force
  }
}

# Ensure sensitive local configs are never shipped in release package.
$sensitiveNames = @(".env.local", "llm-config.json")
foreach ($name in $sensitiveNames) {
  Get-ChildItem -Path $staging -Recurse -Force -Filter $name -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -Path $_.FullName -Force
  }
}

$killPortScriptSource = Join-Path $root "scripts/kill-port.js"
if (Test-Path $killPortScriptSource) {
  $scriptsTarget = Join-Path $staging "scripts"
  New-Item -ItemType Directory -Path $scriptsTarget -Force | Out-Null
  Copy-Item -Path $killPortScriptSource -Destination (Join-Path $scriptsTarget "kill-port.js") -Force
}

$startBat = @"
@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo [Phabricator Dashboard] One-click start

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Please install Node.js 18+ first.
  pause
  exit /b 1
)

if not exist server.js (
  echo ERROR: standalone runtime is missing server.js
  echo Please re-package with scripts\package-standalone.ps1.
  pause
  exit /b 1
)

set PORT=9641
if exist scripts\kill-port.js (
  echo Checking and clearing port %PORT% ...
  node scripts\kill-port.js %PORT%
)
echo Starting server at http://localhost:9641 ...
start "" http://localhost:9641
node server.js
"@

Set-Content -Path (Join-Path $staging "START.bat") -Value $startBat -Encoding ASCII

$readmeRun = @"
# Standalone Run Guide

1. Double-click `START.bat`
2. It starts the prebuilt production server at `http://localhost:9641`

Requirements:
- Windows
- Node.js 18+ available in PATH
"@

Set-Content -Path (Join-Path $staging "RUNNING.md") -Value $readmeRun -Encoding UTF8

if (Test-Path $zipPath) {
  Remove-Item -Path $zipPath -Force
}

$sevenZip = (Get-Command 7z -ErrorAction SilentlyContinue).Source
if ($FastZip -and $sevenZip) {
  Write-Host "Compressing package with 7z..."
  & $sevenZip a -tzip $zipPath "$staging\*" -mx=1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "7z compression failed"
  }
} else {
  Write-Host "Compressing package with Compress-Archive..."
  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force
}

Write-Host "Done: $zipPath"
