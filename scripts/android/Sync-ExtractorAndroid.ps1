param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$publicDir = Join-Path $repoRoot "public"
$androidDir = Join-Path $repoRoot "android-extractor"
$assetsDir = Join-Path $androidDir "app\src\main\assets"
$publicAssetsDir = Join-Path $assetsDir "public"
$configPath = Join-Path $assetsDir "capacitor.config.json"

if (-not (Test-Path $androidDir)) {
  throw "android-extractor folder was not found."
}

New-Item -ItemType Directory -Force -Path $publicAssetsDir | Out-Null
robocopy $publicDir $publicAssetsDir /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
  throw "Failed to copy web assets into android-extractor."
}

$config = @{
  appId = "com.snh.deliveryextractor"
  appName = "구역 추출기"
  webDir = "public"
  server = @{
    url = $(if ($env:CAP_EXTRACTOR_SERVER_URL) { $env:CAP_EXTRACTOR_SERVER_URL } else { "https://deliverymap.vercel.app/extractor" })
    cleartext = $true
    androidScheme = "https"
    allowNavigation = @("deliverymap.vercel.app")
  }
} | ConvertTo-Json -Depth 5

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($configPath, $config, $utf8NoBom)

Write-Host "Extractor Android assets synced."
