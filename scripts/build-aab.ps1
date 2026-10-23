param([switch]$ValidationOnly)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
# Load only client/build configuration. Server AI/admin secrets never enter Metro.
foreach ($file in @('.env.local', '.env')) {
    if (Test-Path -LiteralPath $file) {
        foreach ($line in Get-Content -LiteralPath $file) {
            if ($line -match '^((?:EXPO_PUBLIC_|ADMOB_)[A-Z0-9_]+|EAS_PROJECT_ID|GOOGLE_SERVICES_JSON)=(.*)$') {
                $name = $matches[1]
                $value = $matches[2].Trim().Trim('"')
                if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
                    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
                }
            }
        }
    }
}
$env:EXPO_NO_DOTENV = '1'
$env:EXPO_OS = 'android'
foreach ($secretName in @('GEMINI_API_KEY', 'OPENAI_API_KEY', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY')) {
    [Environment]::SetEnvironmentVariable($secretName, $null, 'Process')
}
if (-not $env:JAVA_HOME -and (Test-Path 'C:\Program Files\Android\Android Studio\jbr\bin\java.exe')) {
    $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
}
if ($env:JAVA_HOME) { $env:Path = "$env:JAVA_HOME\bin;$env:Path" }
if (-not $ValidationOnly) {
    $env:EXPO_PUBLIC_APP_ENV = 'production'
    node -e "require('./scripts/release-config.cjs').validateReleaseEnvironment(process.env)"
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
$app = (Get-Content app.json -Raw | ConvertFrom-Json).expo
$target = "release-artifacts/education-forum-$($app.version)-$($app.android.versionCode)-$kind.aab"
Copy-Item android/app/build/outputs/bundle/release/app-release.aab $target
& (Join-Path $PSScriptRoot 'inspect-android.ps1') -Apk $target
Write-Output "Created $target. Verify its upload certificate and test through Play internal testing before rollout."
