param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$TargetPath
)

$ErrorActionPreference = 'Stop'

function Write-SigningNote {
    param([string]$Message)
    Write-Host "[volt-signing] $Message"
}

$certificateBase64 = $env:WINDOWS_SIGNING_CERT_BASE64
$certificatePassword = $env:WINDOWS_SIGNING_CERT_PASSWORD

if ([string]::IsNullOrWhiteSpace($certificateBase64) -or [string]::IsNullOrWhiteSpace($certificatePassword)) {
    Write-SigningNote "signing secrets are absent, skipping $TargetPath"
    exit 0
}

$timestampUrl = $env:WINDOWS_SIGNING_TIMESTAMP_URL
if ([string]::IsNullOrWhiteSpace($timestampUrl)) {
    $timestampUrl = 'http://timestamp.digicert.com'
}

$signtoolPath = $env:WINDOWS_SIGNTOOL_PATH
if ([string]::IsNullOrWhiteSpace($signtoolPath)) {
    $signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($signtool) {
        $signtoolPath = $signtool.Source
    }
}

if ([string]::IsNullOrWhiteSpace($signtoolPath)) {
    $sdkRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
    $signtoolPath = Get-ChildItem -Path $sdkRoot -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
        Sort-Object FullName |
        Select-Object -Last 1 |
        ForEach-Object { $_.FullName }
}

if ([string]::IsNullOrWhiteSpace($signtoolPath)) {
    throw 'signtool.exe was not found on the runner'
}

$certificatePath = Join-Path $env:TEMP ("volt-signing-{0}.pfx" -f [guid]::NewGuid().ToString('N'))
[IO.File]::WriteAllBytes($certificatePath, [Convert]::FromBase64String($certificateBase64))

try {
    Write-SigningNote "signing $TargetPath"

    & $signtoolPath sign /fd SHA256 /f $certificatePath /p $certificatePassword /tr $timestampUrl /td SHA256 $TargetPath
    if ($LASTEXITCODE -ne 0) {
        throw "signtool failed with exit code $LASTEXITCODE"
    }
}
finally {
    Remove-Item -LiteralPath $certificatePath -Force -ErrorAction SilentlyContinue
}
