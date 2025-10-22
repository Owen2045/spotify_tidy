param(
  [string]$EnvFile = '.env',
  [string]$ReqFile = 'requirements.txt'
)

Write-Host 'start environment setup'

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

$envPath = Join-Path $root $EnvFile
$reqPath = Join-Path $root $ReqFile

if (-not (Test-Path $envPath)) { Write-Host 'env file not found'; exit 1 }
if (-not (Test-Path $reqPath)) { Write-Host 'requirements file not found'; exit 1 }

$envMap = @{}
Get-Content -LiteralPath $envPath | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq '') { return }
  if ($line.StartsWith('#')) { return }
  $kv = $line -split '=', 2
  if ($kv.Count -eq 2) {
    $k = $kv[0].Trim()
    $v = $kv[1].Trim().Trim("'`"").Trim('"')
    $envMap[$k] = $v
  }
}

if (-not $envMap.ContainsKey('PROJECT_NAME')) { Write-Host 'PROJECT_NAME not found in env'; exit 1 }
$projectName = $envMap['PROJECT_NAME']
if ([string]::IsNullOrWhiteSpace($projectName)) { Write-Host 'PROJECT_NAME is empty'; exit 1 }

$codeDir = Join-Path $root $projectName
$venvName = "venv_$projectName"
$venvDir  = Join-Path $root $venvName
$activate = Join-Path $venvDir 'Scripts\Activate.ps1'

Write-Host ("project name {0}" -f $projectName)
Write-Host ("code folder {0}" -f $codeDir)
Write-Host ("venv folder {0}" -f $venvDir)

if (-not (Test-Path $codeDir)) {
  New-Item -ItemType Directory -Path $codeDir | Out-Null
  Write-Host ('created code folder')
}

function Get-PyCmd {
  if (Get-Command py -ErrorAction SilentlyContinue) { return 'py' }
  elseif (Get-Command python -ErrorAction SilentlyContinue) { return 'python' }
  else { return $null }
}
$py = Get-PyCmd
if (-not $py) { Write-Host 'python not found'; exit 1 }

Write-Host 'python version'
& $py --version

if (-not (Test-Path $venvDir)) {
  Write-Host 'create venv'
  try {
    & $py -m venv $venvDir
  } catch {
    Write-Host 'venv failed use virtualenv'
    & $py -m pip install --upgrade pip setuptools wheel virtualenv
    & $py -m virtualenv $venvDir
  }
} else {
  Write-Host 'venv exists'
}

if (-not (Test-Path $activate)) { Write-Host 'activate script not found'; exit 1 }

Write-Host 'activate venv'
. $activate

Write-Host 'upgrade pip'
python -m pip install --upgrade pip setuptools wheel

Write-Host 'install requirements'
pip install -r $reqPath

Write-Host 'done'
Write-Host ("code folder {0}" -f $codeDir)
Write-Host ("venv folder {0}" -f $venvDir)
Write-Host ('activate venv .\{0}\Scripts\Activate.ps1' -f $venvName)

Set-Location $codeDir
Write-Host ("current directory changed to {0}" -f (Get-Location))