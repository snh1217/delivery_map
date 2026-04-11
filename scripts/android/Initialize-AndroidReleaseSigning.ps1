param(
  [string]$KeystoreDir = "D:\Android\keystore",
  [string]$KeystoreFileName = "delivery-map-release.jks",
  [string]$Alias = "delivery-map"
)

$ErrorActionPreference = "Stop"

function New-RandomSecret([int]$Length = 24) {
  $chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()-_=+"
  -join (1..$Length | ForEach-Object { $chars[(Get-Random -Minimum 0 -Maximum $chars.Length)] })
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $repoRoot "android\release-signing.env.local"

New-Item -ItemType Directory -Force -Path $KeystoreDir | Out-Null
$keystorePath = Join-Path $KeystoreDir $KeystoreFileName

if (-not $env:JAVA_HOME) {
  $javaHome = [Environment]::GetEnvironmentVariable("JAVA_HOME", "User")
  if ($javaHome) {
    $env:JAVA_HOME = $javaHome
  }
}

if (-not $env:JAVA_HOME) {
  throw "JAVA_HOME is not configured."
}

$keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
if (-not (Test-Path $keytool)) {
  throw "keytool.exe was not found at $keytool"
}

if (Test-Path $envFile) {
  Write-Host "release-signing.env.local already exists:" -ForegroundColor Yellow
  Write-Host "  $envFile"
  exit 0
}

$storePassword = New-RandomSecret
$keyPassword = $storePassword

if (-not (Test-Path $keystorePath)) {
  & $keytool `
    -genkeypair `
    -v `
    -keystore $keystorePath `
    -storepass $storePassword `
    -alias $Alias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -keypass $keyPassword `
    -dname "CN=delivery-map, OU=SNH, O=SNH, L=Seoul, ST=Seoul, C=KR"
}

@"
RELEASE_STORE_FILE=$keystorePath
RELEASE_STORE_PASSWORD=$storePassword
RELEASE_KEY_ALIAS=$Alias
RELEASE_KEY_PASSWORD=$keyPassword
"@ | Set-Content -Encoding ascii $envFile

Write-Host ""
Write-Host "Release signing has been initialized." -ForegroundColor Green
Write-Host "Keystore: $keystorePath"
Write-Host "Env file: $envFile"
Write-Host ""
Write-Host "Important: back up both files somewhere safe." -ForegroundColor Yellow
Write-Host "Note: PKCS12 keystores use the same password for the store and the key." -ForegroundColor DarkYellow
