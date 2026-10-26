# GitHub Actions 서명 시크릿(ANDROID_KEYSTORE_BASE64)용으로 keystore를 base64로 변환해 클립보드에 복사합니다.
# 사용법: powershell -ExecutionPolicy Bypass -File scripts/android/Export-KeystoreForGithub.ps1 -KeystorePath D:\Android\keystore\delivery-map-release.jks
param(
    [Parameter(Mandatory = $true)]
    [string]$KeystorePath
)

if (-not (Test-Path $KeystorePath)) {
    Write-Error "keystore 파일을 찾을 수 없습니다: $KeystorePath"
    exit 1
}

$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $KeystorePath)))
Set-Clipboard -Value $base64
Write-Host "클립보드에 복사했습니다. GitHub 저장소 Settings > Secrets and variables > Actions > New repository secret 에서"
Write-Host "이름 ANDROID_KEYSTORE_BASE64 로 붙여넣으세요."
