# Install

## Pip (recommended)

```sh
pip install neuralos
```

The PyPI wheels **bundle the engine shared library and the base weights (~36 MB)**, so it works fully offline after install. Installs two equivalent commands: `neuralos` and `needle`.

## npm (Node.js)

```sh
npm install neuralos
```

Same version number, same API surface as the wheels. Bundles engine + weights for **macOS arm64/x64, Linux x64/arm64 (glibc) and Windows x64**; the PyPI wheels carry a broader engine matrix.

> **One version, two channels.** The PyPI wheels and the npm package are built from the same release tag, so `npm view neuralos version` and the wheel filename always agree. The **engine's own release line is independent** of the product version.

## One-line bootstrap

```sh
curl -fsSL https://raw.githubusercontent.com/DrOlu/neuralOS/main/install.sh | sh
```

```powershell
irm https://raw.githubusercontent.com/DrOlu/neuralOS/main/install.ps1 | iex
```

The installer creates an isolated venv, verifies the wheel checksum, and shims `neuralos` onto PATH. Nothing else on the system is touched.

## `neuralos` vs `cactus-needle`

| | `neuralos` | `cactus-needle` |
|---|---|---|
| Engine | **Bundled** in the wheel | Downloaded at runtime (HuggingFace, first use) |
| Offline after install | ✅ | ❌ (needs the first fetch) |
| Disk footprint | ~36 MB | minimal until first run |
| API | identical | identical |

## Verify

```sh
neuralos run --query "hello"            # raw completion smoke test
python -c "from needle import Needle; print(Needle().embed('ping')[:4])"
```

## Platforms

- **Wheels**: macOS (arm64, x64), Linux (x64, arm64 — glibc; musl via cactus-needle), Windows x64.
- **Engines** ship per-platform; the engine release line (e.g. 3.0.2) is independent of the package version (e.g. 3.10.2). `neuralos spec` and `neuralos download` expose the engine matrix — see the [CLI reference](cli.md).

## Troubleshooting

- **`OSError` loading the engine** — confirm the platform is supported; on macOS check the binary isn't quarantined (`xattr -d com.apple.quarantine $(python -c "import needle,os;print(os.path.dirname(needle.__file__))")/../..` path as printed in the error).
- **No weights found** — the wheels bundle base weights; if you installed from source, run `neuralos download` to fetch them.
- **Confidence head missing** — a checkpoint without the confidence head still works; calibration scores are simply absent. Rebuild with `neuralos build` to include it.
