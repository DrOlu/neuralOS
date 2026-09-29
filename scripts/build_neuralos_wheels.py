#!/usr/bin/env python3
"""Build the neuralOS PyPI distribution set.

Platform wheels bundle the Needle 3 engine library and the base weights
pulled from the engine's HuggingFace repo, so ``pip install neuralos``
works fully offline. A binary-free ``py3-none-any`` fallback wheel keeps
the upstream download-at-runtime behavior for platforms without a bundled
engine (musl, armv7, android, ios, wasm, ...).

The engine layout consumed at runtime (needle/__init__.py):
  needle/libneedle3.<dylib|so|dll>   shared-library engine (generation 3)
  needle/needle3.cact                base weights

Both are extracted from the upstream artifacts:
  https://huggingface.co/Cactus-Compute/needle3
    python/cactus_needle-<ver>-py3-none-<tag>.whl   (engine library)
    needle3.cact                                    (weights)

Targets and wheel tags mirror needle.agent.fetch._platform_tag():
  macos-arm64     macosx_11_0_arm64     libneedle3.dylib
  linux-x86_64    manylinux2014_x86_64  libneedle3.so
  linux-arm64     manylinux2014_aarch64 libneedle3.so
  windows-x86_64  win_amd64             libneedle3.dll

Usage:
    python scripts/build_neuralos_wheels.py --version 3.0.2 \
        [--targets macos-arm64,linux-x86_64] [--fallback-only]
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PKG = ROOT / "needle"
DIST = ROOT / "dist"

ENGINE_REPO = "Cactus-Compute/needle3"
WEIGHTS_NAME = "needle3.cact"

TARGETS = {
    "macos-arm64": {"tag": "macosx_11_0_arm64", "lib": "libneedle3.dylib"},
    "linux-x86_64": {"tag": "manylinux2014_x86_64", "lib": "libneedle3.so"},
    "linux-arm64": {"tag": "manylinux2014_aarch64", "lib": "libneedle3.so"},
    "windows-x86_64": {"tag": "win_amd64", "lib": "libneedle3.dll"},
}

HF_BASE = f"https://huggingface.co/{ENGINE_REPO}/resolve/main"


def http_download(url: str, dest: Path) -> Path:
    print(f"downloading {url}", flush=True)
    request = urllib.request.Request(url, headers={"User-Agent": "neuralos-build/1.0"})
    with urllib.request.urlopen(request, timeout=300) as response, open(dest, "wb") as out:
        shutil.copyfileobj(response, out)
    size = dest.stat().st_size
    if size < 1_000:  # an error page instead of a binary
        raise SystemExit(f"suspiciously small download ({size} bytes): {url}")
    return dest


def fetch_engine_lib(tag: str, lib_name: str, cache: Path) -> Path:
    """Extract needle/libneedle3.* out of the upstream platform wheel."""
    wheel_name = f"cactus_needle-{args_version}-py3-none-{tag}.whl"
    archive_path = cache / wheel_name
    if not archive_path.exists():
        http_download(f"{HF_BASE}/python/{wheel_name}", archive_path)
    with zipfile.ZipFile(archive_path) as archive:
        members = [m for m in archive.namelist() if "/libneedle" in m]
        if not members:
            raise SystemExit(f"no engine library in {wheel_name}")
        target = cache / lib_name
        with open(target, "wb") as out:
            out.write(archive.read(members[0]))
    return target


def fetch_weights(cache: Path) -> Path:
    weights = cache / WEIGHTS_NAME
    if not weights.exists():
        http_download(f"{HF_BASE}/{WEIGHTS_NAME}", weights)
    return weights


def set_project_version(version: str) -> None:
    pyproject = ROOT / "pyproject.toml"
    text = pyproject.read_text()
    updated, count = re.subn(r'(?m)^version = "[^"]*"$', f'version = "{version}"', text)
    if count != 1:
        raise SystemExit("could not patch the version line in pyproject.toml")
    pyproject.write_text(updated)


def expected_fallback(version: str) -> Path:
    return DIST / f"neuralos-{version}-py3-none-any.whl"


def build_wheel(version: str) -> Path:
    expected = expected_fallback(version)
    expected.unlink(missing_ok=True)
    # setuptools' bdist_wheel copies into build/lib without cleaning it first;
    # stale engine files from a previous target would leak into this wheel.
    for residue in (ROOT / "build", *ROOT.glob("*.egg-info")):
        shutil.rmtree(residue, ignore_errors=True)
    print("+ python -m build --wheel", flush=True)
    subprocess.run(
        [sys.executable, "-m", "build", "--wheel", "--no-isolation", "--outdir", str(DIST)],
        check=True, cwd=ROOT,
    )
    if not expected.exists():
        raise SystemExit(f"wheel build did not produce {expected.name}")
    return expected


def retag(wheel: Path, platform_tag: str) -> Path:
    # wheel >= 0.45 dropped --dest-dir: output lands next to the original.
    subprocess.run(
        [sys.executable, "-m", "wheel", "tags", "--platform-tag", platform_tag,
         "--remove", str(wheel)],
        check=True, cwd=ROOT,
    )
    retagged = wheel.with_name(wheel.name.replace("-any.whl", f"-{platform_tag}.whl"))
    if not retagged.exists():
        raise SystemExit(f"retagging failed: {retagged} not created")
    return retagged


def unstage() -> None:
    """Remove bundled engine artifacts from the package tree."""
    for pattern in ("libneedle*", WEIGHTS_NAME):
        for path in PKG.glob(pattern):
            path.unlink()


def main() -> None:
    global args_version
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True, help="release version, e.g. 3.0.2")
    parser.add_argument("--targets", default=",".join(TARGETS),
                        help=f"comma-separated subset of {sorted(TARGETS)}")
    parser.add_argument("--fallback-only", action="store_true",
                        help="build only the binary-free any wheel")
    args = parser.parse_args()
    args_version = args.version

    if not re.match(r"^\d+\.\d+\.\d+(?:[.\-+][0-9A-Za-z.\-]+)?$", args.version):
        raise SystemExit(f"invalid version: {args.version!r}")

    selected = [t for t in args.targets.split(",") if t]
    for target in selected:
        if target not in TARGETS:
            raise SystemExit(f"unknown target: {target}")

    DIST.mkdir(exist_ok=True)
    set_project_version(args.version)
    unstage()

    produced = []

    if not args.fallback_only:
        cache = Path(tempfile.mkdtemp(prefix="neuralos-engines-"))
        weights = fetch_weights(cache)

        for target in selected:
            spec = TARGETS[target]
            unstage()
            lib = fetch_engine_lib(spec["tag"], spec["lib"], cache)
            shutil.copy2(lib, PKG / spec["lib"])
            shutil.copy2(weights, PKG / WEIGHTS_NAME)
            wheel = retag(build_wheel(args.version), spec["tag"])
            print(f"built {wheel.name}")
            produced.append(wheel)

    unstage()
    fallback = build_wheel(args.version)
    print(f"built {fallback.name}")
    produced.append(fallback)

    print("\nDone:")
    for wheel in produced:
        print(f"  {wheel}")


if __name__ == "__main__":
    main()
