#!/usr/bin/env python3
"""Build the neuralOS npm package set (main + engine platform packages).

Mirrors scripts/build_neuralos_wheels.py: pulls the pinned engine library
and the base weights from the engine's HuggingFace repo, stages them into
per-platform npm packages under <out>/, and stages the main package with
versions patched. Publish with:  for d in <out>/*/; do npm publish "$d"; done

Targets and npm os/cpu (main package resolves via engine.js):
  darwin-arm64      neuralos-darwin-arm64      macosx_11_0_arm64      libneedle3.dylib
  darwin-x64        neuralos-darwin-x64        macosx_11_0_x86_64     libneedle3.dylib
  linux-x64-gnu     neuralos-linux-x64-gnu     manylinux2014_x86_64   libneedle3.so
  linux-arm64-gnu   neuralos-linux-arm64-gnu   manylinux2014_aarch64  libneedle3.so
  win32-x64         neuralos-engine-windows-x64  win_amd64            libneedle3.dll
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NPM = ROOT / "npm"

ENGINE_REPO = "Cactus-Compute/needle3"
HF_BASE = f"https://huggingface.co/{ENGINE_REPO}/resolve/main"
WEIGHTS_NAME = "needle3.cact"

TARGETS = {
    "darwin-arm64": {"pkg": "neuralos-darwin-arm64", "tag": "macosx_11_0_arm64",
                     "lib": "libneedle3.dylib", "os": ["darwin"], "cpu": ["arm64"]},
    "darwin-x64": {"pkg": "neuralos-darwin-x64", "tag": "macosx_11_0_x86_64",
                   "lib": "libneedle3.dylib", "os": ["darwin"], "cpu": ["x64"]},
    "linux-x64-gnu": {"pkg": "neuralos-linux-x64-gnu", "tag": "manylinux2014_x86_64",
                      "lib": "libneedle3.so", "os": ["linux"], "cpu": ["x64"], "libc": ["glibc"]},
    "linux-arm64-gnu": {"pkg": "neuralos-linux-arm64-gnu", "tag": "manylinux2014_aarch64",
                        "lib": "libneedle3.so", "os": ["linux"], "cpu": ["arm64"], "libc": ["glibc"]},
    # NOTE: npm's spam heuristics block the name "neuralos-win32-x64" as a
    # look-alike of "neuralos" (403, name-level, not metadata). The Windows
    # payload therefore ships as "neuralos-engine-windows-x64"; engine.js maps
    # the win32-x64 key onto it.
    "win32-x64": {"pkg": "neuralos-engine-windows-x64", "tag": "win_amd64",
                  "lib": "libneedle3.dll", "os": ["win32"], "cpu": ["x64"]},
}

ENGINE_VERSION_RE = re.compile(r'^ENGINE_VERSION = "([0-9.]+)"', re.M)


def http_download(url: str, dest: Path) -> Path:
    print(f"downloading {url}", flush=True)
    request = urllib.request.Request(url, headers={"User-Agent": "neuralos-npm-build/1.0"})
    with urllib.request.urlopen(request, timeout=300) as response, open(dest, "wb") as out:
        shutil.copyfileobj(response, out)
    if dest.stat().st_size < 1_000:
        raise SystemExit(f"suspiciously small download: {url}")
    return dest


def engine_version() -> str:
    match = ENGINE_VERSION_RE.search((ROOT / "scripts" / "build_neuralos_wheels.py").read_text())
    if not match:
        raise SystemExit("cannot read ENGINE_VERSION from scripts/build_neuralos_wheels.py")
    return match.group(1)


def fetch_engine_lib(tag: str, cache: Path) -> Path:
    """Return the extracted libneedle3.* from the upstream platform wheel."""
    wheel_name = f"cactus_needle-{EV}-py3-none-{tag}.whl"
    archive_path = cache / wheel_name
    if not archive_path.exists():
        http_download(f"{HF_BASE}/python/{wheel_name}", archive_path)
    with zipfile.ZipFile(archive_path) as archive:
        members = [m for m in archive.namelist() if "/libneedle" in m]
        if not members:
            raise SystemExit(f"no engine library in {wheel_name}")
        out = cache / Path(members[0]).name
        with open(out, "wb") as handle:
            handle.write(archive.read(members[0]))
    return out


def fetch_weights(cache: Path) -> Path:
    weights = cache / WEIGHTS_NAME
    if not weights.exists():
        http_download(f"{HF_BASE}/{WEIGHTS_NAME}", weights)
    return weights


def stage_platform(target: str, version: str, cache: Path, out: Path) -> Path:
    spec = TARGETS[target]
    pkg_dir = out / spec["pkg"]
    (pkg_dir / "bin").mkdir(parents=True, exist_ok=True)
    shutil.copy2(fetch_engine_lib(spec["tag"], cache), pkg_dir / "bin" / spec["lib"])
    shutil.copy2(fetch_weights(cache), pkg_dir / "bin" / WEIGHTS_NAME)
    manifest = {
        "name": spec["pkg"],
        "version": version,
        "description": (
            f"neuralOS engine (libneedle3) and base weights (needle3.cact) for "
            f"{target} — the platform payload for the neuralos package. Install "
            f"neuralos instead of this package directly."
        ),
        "os": spec["os"],
        "cpu": spec["cpu"],
        **({"libc": spec["libc"]} if "libc" in spec else {}),
        "files": ["bin", "README.md"],
        "license": "Apache-2.0",
        "homepage": "https://neuralos.ng",
        "author": "Neural AI (Hyperspace Technologies)",
        "keywords": ["neuralos", "needle", "on-device", "offline", "tool-calling",
                     "embeddings", target],
        "repository": {"type": "git", "url": "git+https://github.com/DrOlu/neuralOS.git"},
        "publishConfig": {"access": "public"},
    }
    (pkg_dir / "package.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (pkg_dir / "README.md").write_text(
        f"# {spec['pkg']}\n\n"
        f"Platform payload for **neuralos** — the {target} build of the neuralOS\n"
        f"engine (`{spec['lib']}`) and the base weights (`{WEIGHTS_NAME}`, ~35 MB).\n\n"
        "This package is installed automatically as an optional dependency of\n"
        "`neuralos` on matching platforms; do not install it directly.\n\n"
        "```bash\nnpm install neuralos\n```\n\n"
        "Docs: https://neuralos.ng · Source: https://github.com/DrOlu/neuralOS\n"
        "License: Apache-2.0\n")
    return pkg_dir


def stage_main(version: str, out: Path) -> Path:
    pkg_dir = out / "neuralos"
    if pkg_dir.exists():
        shutil.rmtree(pkg_dir)
    shutil.copytree(NPM, pkg_dir, ignore=shutil.ignore_patterns("dist", "node_modules"))
    manifest_path = pkg_dir / "package.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["version"] = version
    manifest["optionalDependencies"] = {
        spec["pkg"]: version for spec in TARGETS.values()
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    return pkg_dir


def main() -> None:
    global EV
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default=None,
                        help="release version (default: npm/package.json version)")
    parser.add_argument("--targets", default=",".join(TARGETS))
    parser.add_argument("--out", default=str(NPM / "dist"))
    args = parser.parse_args()
    EV = engine_version()
    print(f"engine pin: {EV}")

    args.version = args.version or json.loads((NPM / "package.json").read_text())["version"]
    if not re.match(r"^\d+\.\d+\.\d+$", args.version):
        raise SystemExit(f"invalid version: {args.version!r}")

    selected = [t for t in args.targets.split(",") if t]
    for target in selected:
        if target not in TARGETS:
            raise SystemExit(f"unknown target: {target}")

    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    cache = Path(tempfile.mkdtemp(prefix="neuralos-npm-engines-"))
    weights = fetch_weights(cache)

    produced = [stage_main(args.version, out)]
    print(f"staged {produced[0]}")
    for target in selected:
        pkg_dir = stage_platform(target, args.version, cache, out)
        print(f"staged {pkg_dir}")
        produced.append(pkg_dir)

    print("\nDone. Publish with:")
    for pkg in produced:
        print(f"  npm publish {pkg}")


if __name__ == "__main__":
    main()
