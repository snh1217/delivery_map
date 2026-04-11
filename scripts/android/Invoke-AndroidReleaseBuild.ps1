param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("assembleRelease", "bundleRelease")]
  [string]$Task
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $repoRoot "android\release-signing.env.local"

if (-not (Test-Path $envFile)) {
  throw "release-signing.env.local was not found. Run 'npm run android:signing:init' first."
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or [string]::IsNullOrWhiteSpace($_)) {
    return
  }

  $parts = $_ -split '=', 2
  if ($parts.Count -eq 2) {
    [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
  }
}

Push-Location $repoRoot
try {
  npm.cmd run cap:sync
  Push-Location (Join-Path $repoRoot "android")
  try {
    & .\gradlew.bat $Task
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}
