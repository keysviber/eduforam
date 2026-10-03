param(
  [string]$Apk = 'android/app/build/outputs/apk/release/app-release.apk',
  [string]$Sdk = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$Java = 'C:\Program Files\Android\Android Studio\jbr\bin\java.exe'
)
$ErrorActionPreference = 'Stop'
$apkPath = (Resolve-Path -LiteralPath $Apk).Path
$buildTools = Join-Path $Sdk 'build-tools\36.0.0'
& (Join-Path $buildTools 'zipalign.exe') -c -P 16 4 $apkPath
if ($LASTEXITCODE -ne 0) { throw 'APK ZIP alignment verification failed' }
Write-Output 'PASS: APK ZIP alignment supports 16 KB pages'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($apkPath)
$checked = 0
try {
  foreach ($entry in $archive.Entries) {
    if ($entry.FullName -notmatch '^lib/(arm64-v8a|x86_64)/.+\.so$') { continue }
    $buffer = [System.IO.MemoryStream]::new()
    $source = $entry.Open()
    try { $source.CopyTo($buffer); $bytes = $buffer.ToArray() }
    finally { $source.Dispose(); $buffer.Dispose() }
    if ($bytes[0] -ne 127 -or $bytes[1] -ne 69 -or $bytes[2] -ne 76 -or $bytes[3] -ne 70 -or $bytes[4] -ne 2 -or $bytes[5] -ne 1) {
      throw "Expected little-endian ELF64: $($entry.FullName)"
    }
    $phoff = [BitConverter]::ToUInt64($bytes, 32)
    $phsize = [BitConverter]::ToUInt16($bytes, 54)
    $phcount = [BitConverter]::ToUInt16($bytes, 56)
    $loads = 0
    for ($i = 0; $i -lt $phcount; $i++) {
      $offset = [int]($phoff + $i * $phsize)
      if ([BitConverter]::ToUInt32($bytes, $offset) -eq 1) {
        $loads++
        $alignment = [BitConverter]::ToUInt64($bytes, $offset + 48)
        if ($alignment -lt 16384 -or ($alignment -band ($alignment - 1)) -ne 0) {
          throw "Invalid 16 KB LOAD alignment: $($entry.FullName)"
        }
      }
    }
    if ($loads -eq 0) { throw "No LOAD segments: $($entry.FullName)" }
    $checked++
  }
} finally { $archive.Dispose() }
if ($checked -eq 0) { throw 'No 64-bit native libraries were found' }
Write-Output "PASS: $checked native 64-bit libraries have 16 KB ELF LOAD alignment"
$certificate = & $Java -jar (Join-Path $buildTools 'lib\apksigner.jar') verify --print-certs $apkPath
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
$certificate | Write-Output
Get-FileHash -LiteralPath $apkPath -Algorithm SHA256 | Format-List
if (($certificate -join "`n") -match 'CN=Android Debug') {
  throw 'BLOCKED for Play: this APK is debug-signed. Build a production AAB with the owner upload key.'
}
Write-Output 'APK static checks passed. Inspect the final signed AAB and test Play-generated APKs on 16 KB devices before rollout.'
