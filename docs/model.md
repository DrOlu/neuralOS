# Model & engines

## Lineage

| | `neuralos` (this repo) | `cactus-needle` |
|---|---|---|
| Distribution | Engine + weights **bundled** | Download-at-runtime |
| Install | `pip install neuralos` / `npm i neuralos` / one-liners | `pip install cactus-needle` |
| API surface | `needle` package | identical |

The engine was born as **Needle** (Cactus Compute), now distributed independently as the `neuralos` package. The **engine release line is independent** of the product version: e.g. package 3.10.2 bundles engine 3.0.2. Engine generation 2 resolves to the `Cactus-Compute/needle2` artifacts, generation 3 to `Cactus-Compute/needle3`.

## What makes it different

- **Single 8–29 MB binary.** Weights + engine in one artifact; no runtime downloads, no cloud.
- **Laddered depth.** Every depth from 2 to 20 layers is a deployable model — pick the depth that fits the device tier without retraining.
- **Tool-calling first.** Beats models 10× its size on mobile tool-call benchmarks (exact match, full test splits).
- **Extraction with guarantees.** The decode grammar is compiled from your schemas; output always parses; values must be **grounded** in the input (dates and numeric paths are validated) or extraction raises.
- **Calibrated confidence.** A learned head scores every response — route low-confidence calls to a bigger model or a human.
- **Embeddings included.** Same model returns sentence vectors for on-device search and routing.

## Architecture

Needle 3 is a **Laddered Simple Attention Network (SAN)**:

- **Monarch Hadamard MLP** in place of the dense FFN.
- **GQA attention with causal-conv taps** (fast streaming, cheap KV).
- **Engram n-gram memory** read by gather — where most parameters live; it is why a 121M-parameter model does the arithmetic of a 50M one.
- **Multi-lane hyper-connections** across depth.

Weights ship **2-bit quantized**; the confidence head and tokenizer travel inside the `.cact` checkpoint.

## Engines & platforms

| Platform | Engines |
|---|---|
| macOS | arm64 (Apple GPU path), x64 |
| Linux | x64, arm64 (glibc; musl via `cactus-needle`) |
| Windows | x64 |
| Mobile/embedded | via the bundled library (Core ML-free, no JIT) |

Inspect the live matrix with `neuralos spec`; stage other platforms with `neuralos download`. Inference is **CPU-first and fully offline** — nothing phones home.

## Versioning

- Package version (PyPI = npm, always the same tag): currently **3.10.x**.
- Engine version: independent line (e.g. 3.0.2); pinned per generation in `needle.agent.fetch`.
- `Needle(generation=N)` pins an engine generation when a deployment must match a tested runtime.

## Benchmarks

Tool calling = **exact-match accuracy** on full test splits; extraction = **field micro-F1**. The frontier plot, architecture deep-dive and fine-tuning results are at [cactuscompute.com/needle](https://cactuscompute.com/needle); try it in the browser there too.
