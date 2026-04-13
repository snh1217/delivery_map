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
  npm.cmd run cap:sync:extractor
  Push-Location (Join-Path $repoRoot "android-extractor")
  try {
    & .\gradlew.bat $Task
    $stamp = Get-Date -Format "yyyy.MM.dd"
    if ($Task -eq "assembleRelease") {
      $source = Join-Path $repoRoot "android-extractor\app\build\outputs\apk\release\app-release.apk"
      $target = Join-Path $repoRoot "android-extractor\app\build\outputs\apk\release\guyeok-extractor-v$stamp.apk"
      if (Test-Path $source) {
        Copy-Item $source $target -Force
      }
    }
    if ($Task -eq "bundleRelease") {
      $source = Join-Path $repoRoot "android-extractor\app\build\outputs\bundle\release\app-release.aab"
      $target = Join-Path $repoRoot "android-extractor\app\build\outputs\bundle\release\guyeok-extractor-v$stamp.aab"
      if (Test-Path $source) {
        Copy-Item $source $target -Force
      }
    }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}
