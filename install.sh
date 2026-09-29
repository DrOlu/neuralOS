#!/bin/sh
# neuralOS installer (POSIX sh).
#
#   curl -fsSL https://raw.githubusercontent.com/DrOlu/neuralOS/main/install.sh | sh
#
# Environment overrides:
#   NEURALOS_VERSION  version to install (default: latest on PyPI)
#   NEURALOS_PREFIX   install root (default: ~/.neuralos)
#   PYTHON            python interpreter to use (default: auto-detect)
#
# The script creates a virtualenv at $NEURALOS_PREFIX/venv, installs the
# neuralos wheel for this platform (engine + weights bundled, offline after
# install), verifies the wheel checksum against PyPI, and shims `neuralos`
# onto PATH at $NEURALOS_PREFIX/bin.

set -eu

NEURALOS_VERSION="${NEURALOS_VERSION:-latest}"
PREFIX="${NEURALOS_PREFIX:-$HOME/.neuralos}"

say() { printf '%s\n' "neuralos installer: $*"; }
die() { printf 'neuralos installer: %s\n' "$*" >&2; exit 1; }

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t neuralos)"
trap 'rm -rf "$TMP"' EXIT

# --- 1. Python -------------------------------------------------------------
PYTHON="${PYTHON:-}"
if [ -z "$PYTHON" ]; then
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then PYTHON="$candidate"; break; fi
  done
fi
[ -n "$PYTHON" ] || die "python3 not found on PATH. Install Python 3.9+ first
  (macOS: brew install python3 | Debian/Ubuntu: apt install python3 python3-venv
   Fedora: dnf install python3 | or https://python.org) and re-run."
command -v "$PYTHON" >/dev/null 2>&1 || die "PYTHON=$PYTHON is not on PATH"
"$PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' \
  || die "$($PYTHON --version 2>&1) is too old; Python 3.9+ is required"
say "using $($PYTHON --version 2>&1)"

# --- 2. Resolve version + wheel + checksum from PyPI ------------------------
cat > "$TMP/resolve.py" <<'PY'
import json, platform, sys, urllib.request

want = sys.argv[1]
data = json.load(urllib.request.urlopen("https://pypi.org/pypi/neuralos/json", timeout=60))
version = data["info"]["version"] if want in ("latest", "") else want
files = data["releases"].get(version, [])
if not files:
    sys.exit("no such version on PyPI: " + version)

machine = platform.machine().lower()
if sys.platform == "darwin":
    plat = "macosx_11_0_" + ("arm64" if machine in ("arm64", "aarch64") else "x86_64")
elif sys.platform == "win32":
    plat = "win_amd64"
else:
    arch = "x86_64" if machine in ("x86_64", "amd64") else "aarch64"
    plat = "manylinux2014_" + arch

pick, fallback = None, False
for f in files:
    if f["filename"].endswith(plat + ".whl"):
        pick = f
        break
if pick is None:
    for f in files:
        if f["filename"].endswith("-any.whl"):
            pick, fallback = f, True
            break
if pick is None:
    sys.exit("no wheel for this platform in neuralos " + version)

for line in (version, pick["url"], pick["digests"]["sha256"],
             "fallback" if fallback else "bundled"):
    print(line)
PY
RES="$("$PYTHON" "$TMP/resolve.py" "$NEURALOS_VERSION")" || die "could not resolve a release from PyPI"
VERSION="$(printf '%s\n' "$RES" | sed -n 1p)"
URL="$(printf '%s\n' "$RES" | sed -n 2p)"
SHA256="$(printf '%s\n' "$RES" | sed -n 3p)"
KIND="$(printf '%s\n' "$RES" | sed -n 4p)"

say "installing neuralos $VERSION ($KIND engine)"
[ "$KIND" = "bundled" ] || say "note: no bundled engine for this platform; the engine downloads from HuggingFace on first use"

# --- 3. Download + verify checksum ------------------------------------------
WHEEL="$TMP/$(basename "$URL")"
curl -fsSL "$URL" -o "$WHEEL" || die "download failed"
if command -v sha256sum >/dev/null 2>&1; then
  echo "$SHA256  $WHEEL" | sha256sum -c - >/dev/null || die "checksum mismatch"
elif command -v shasum >/dev/null 2>&1; then
  echo "$SHA256  $WHEEL" | shasum -a 256 -c - >/dev/null || die "checksum mismatch"
else
  die "no sha256sum/shasum available to verify the download"
fi
say "checksum ok"

# --- 4. Virtualenv + install -------------------------------------------------
"$PYTHON" -m venv "$PREFIX/venv" || die "could not create a virtualenv at $PREFIX/venv (need python3-venv on Debian/Ubuntu)"
"$PREFIX/venv/bin/pip" install --upgrade pip -q
"$PREFIX/venv/bin/pip" install --no-cache-dir "$WHEEL" -q || die "pip install failed"

# --- 5. Shim onto PATH -------------------------------------------------------
mkdir -p "$PREFIX/bin"
printf '#!/bin/sh\nexec "%s/venv/bin/neuralos" "$@"\n' "$PREFIX" > "$PREFIX/bin/neuralos"
chmod +x "$PREFIX/bin/neuralos"

# --- 6. Verify ---------------------------------------------------------------
"$PREFIX/venv/bin/python" - <<'PY'
import os
import needle

lib = needle._library_path(3)
weights = needle._base_weights_path(3)
assert lib and os.path.isfile(lib), f"engine not found: {lib}"
assert weights and os.path.isfile(weights), f"weights not found: {weights}"
print(f"neuralOS {needle.__version__} installed (engine + weights verified)")
PY

case ":$PATH:" in
  *":$PREFIX/bin:"*) ;;
  *)
    say ""
    say "Add to your PATH (pick your shell):"
    say "  echo 'export PATH=\"$PREFIX/bin:\$PATH\"' >> ~/.profile    # then: source ~/.profile"
    say "  (zsh: use ~/.zshrc, bash: ~/.bashrc)"
    ;;
esac
say "done. try: $PREFIX/bin/neuralos --help"
