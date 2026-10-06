param([switch]$ValidationOnly)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not $ValidationOnly) {
    $env:EXPO_PUBLIC_APP_ENV = 'production'
    node --env-file=.env -e "require('./scripts/release-config.cjs').validateReleaseEnvironment(process.env)"
    if ($LASTEXITCODE -ne 0) { throw 'Production environment is incomplete.' }
} else {
    $env:EXPO_PUBLIC_APP_ENV = 'validation'
}
npx.cmd expo prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw 'Android prebuild failed.' }
Push-Location android
try {
    .\gradlew.bat :app:bundleRelease --console=plain --max-workers=2
    if ($LASTEXITCODE -ne 0) { throw 'Android bundle build failed.' }
} finally { Pop-Location }
$kind = if ($ValidationOnly) { 'validation' } else { 'production' }
New-Item -ItemType Directory -Force release-artifacts | Out-Null
$target = "release-artifacts/education-forum-$kind.aab"
Copy-Item android/app/build/outputs/bundle/release/app-release.aab $target
& (Join-Path $PSScriptRoot 'inspect-android.ps1') -Apk $target
Write-Output "Created $target. Verify its upload certificate and test through Play internal testing before rollout."
