# neuralOS installer for Windows PowerShell.
#
#   irm https://raw.githubusercontent.com/DrOlu/neuralOS/main/install.ps1 | iex
#
# Environment overrides (set BEFORE the one-liner):
#   $env:NEURALOS_VERSION = "3.10.1"   # default: latest on PyPI
#   $env:NEURALOS_PREFIX  = "C:\neuralos"  # default: $env:USERPROFILE\.neuralos
#
# Creates a virtualenv at $Prefix\venv, installs the neuralos wheel for this
# platform (engine + weights bundled, offline after install), verifies the
# wheel checksum against PyPI, and adds a `neuralos` shim to the user PATH.

$ErrorActionPreference = "Stop"

$Version = if ($env:NEURALOS_VERSION) { $env:NEURALOS_VERSION } else { "latest" }
$Prefix = if ($env:NEURALOS_PREFIX) { $env:NEURALOS_PREFIX } else { Join-Path $env:USERPROFILE ".neuralos" }

function Say($msg) { Write-Host "neuralos installer: $msg" }
function Die($msg) { Write-Error "neuralos installer: $msg"; exit 1 }

$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("neuralos-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $Tmp | Out-Null
try {

# --- 1. Python ---------------------------------------------------------------
$Python = $null
foreach ($candidate in @("python", "python3", "py")) {
  $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
  if ($cmd) { $Python = $cmd.Source; break }
}
if (-not $Python) {
  Die "python not found on PATH. Install Python 3.9+ first (winget install Python.Python.3.12, or https://python.org) and re-open the shell."
}
& $Python -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)"
if ($LASTEXITCODE -ne 0) { Die "Python 3.9+ is required." }
Say "using Python ($Python)"

# --- 2. Resolve version + wheel + checksum from PyPI --------------------------
$Resolver = @'
import json, platform, sys, urllib.request
want = sys.argv[1]
data = json.load(urllib.request.urlopen("https://pypi.org/pypi/neuralos/json", timeout=60))
version = data["info"]["version"] if want in ("latest", "") else want
files = data["releases"].get(version, [])
if not files:
    sys.exit("no such version on PyPI: " + version)
machine = platform.machine().lower()
plat = "win_amd64" if machine in ("x86_64", "amd64") else "win_arm64"
pick = None
for f in files:
    if f["filename"].endswith(plat + ".whl"):
        pick = f
        break
if pick is None:
    for f in files:
        if f["filename"].endswith("-any.whl"):
            pick = f
            break
if pick is None:
    sys.exit("no wheel for this platform in neuralos " + version)
print(version)
print(pick["url"])
print(pick["digests"]["sha256"])
'@
$ResolverPath = Join-Path $Tmp "resolve.py"
Set-Content -Path $ResolverPath -Value $Resolver -Encoding UTF8
$Resolved = & $Python $ResolverPath $Version
if ($LASTEXITCODE -ne 0) { Die "could not resolve a release from PyPI." }
$ResolvedVersion, $Url, $Sha256 = ($Resolved | Select-Object -First 3)
Say "installing neuralos $ResolvedVersion"

# --- 3. Download + verify checksum --------------------------------------------
$Wheel = Join-Path $Tmp (Split-Path $Url -Leaf)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $Url -OutFile $Wheel -UseBasicParsing
$Actual = (Get-FileHash -Path $Wheel -Algorithm SHA256).Hash.ToLower()
if ($Actual -ne $Sha256.ToLower()) { Die "checksum mismatch for $Wheel" }
Say "checksum ok"

# --- 4. Virtualenv + install ----------------------------------------------------
& $Python -m venv (Join-Path $Prefix "venv")
if ($LASTEXITCODE -ne 0) { Die "could not create a virtualenv at $Prefix\venv" }
& (Join-Path $Prefix "venv\Scripts\pip.exe") install --upgrade pip -q
& (Join-Path $Prefix "venv\Scripts\pip.exe") install --no-cache-dir $Wheel -q
if ($LASTEXITCODE -ne 0) { Die "pip install failed." }

# --- 5. Shim onto PATH ----------------------------------------------------------
$BinDir = Join-Path $Prefix "bin"
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$Shim = Join-Path $BinDir "neuralos.cmd"
Set-Content -Path $Shim -Value "@`"$Prefix\venv\Scripts\neuralos.exe`" %*" -Encoding ASCII

$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $UserPath) { $UserPath = "" }
if (($UserPath -split ";") -notcontains $BinDir) {
  [Environment]::SetEnvironmentVariable("Path", ("$UserPath;$BinDir").Trim(";"), "User")
  Say "added $BinDir to your user PATH - open a NEW shell for it to take effect"
}

# --- 6. Verify --------------------------------------------------------------------
& (Join-Path $Prefix "venv\Scripts\python.exe") -c "import os, needle; lib = needle._library_path(3); assert lib and os.path.isfile(lib), lib; print('neuralOS ' + needle.__version__ + ' installed (engine + weights verified)')"
if ($LASTEXITCODE -ne 0) { Die "verification failed." }

Say "done. try: neuralos --help"

} finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
