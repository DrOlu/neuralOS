# Fine-tuning & build

The whole pipeline runs on CPU with no cloud dependency: **generate data → LoRA fine-tune → merge → export → ship**.

## 1. When to fine-tune

The base model already covers general tool-calling, extraction and embedding. Fine-tune when:

- Your **domain vocabulary** is dense (medical codes, internal product SKUs, ATC phraseology).
- You need a **house extraction schema** to hit near-100% field F1 without prompt scaffolding.
- You target a **tiny depth** (2–6 layers) for an MCU/wearable and want maximum accuracy at that depth.

## 2. Data

Two routes:

**Synthetic first (recommended).** Declare your tools, let the model bootstrap itself:

```sh
neuralos generate-data --tools tools.json --num-samples 2000 --augment --output train.jsonl
```

Augmentation paraphrases user phrasings around your schemas — this is what teaches argument filling, not tool *invention*.

**Real transcripts.** Ship logs of actual `run()` calls (JSONL `{"messages":[…]}`); mix with synthetic at roughly 1:3.

Hold out a validation split (`--val-split`) and keep a **trap set**: asks no tool covers that must produce an empty call list. That refusal behaviour is trained, not prompted.

## 3. LoRA fine-tune

```sh
neuralos finetune train.jsonl --checkpoint base.cact \
    --epochs 3 --lora-rank 16 --lora-alpha 32 --lr 1e-4 --max-len 1024
```

- Rank 8–32 covers most domain shifts; higher rank for new languages.
- Keeps a checkpoint per epoch; watch the validation loss, not the train loss.

## 4. Merge & export

```sh
neuralos build base.cact --lora adapter.safetensors --out mymodel.cact
```

The build writes a `.cact` checkpoint: weights + tokenizer + the **confidence head** (learned calibration — preserved through merges) + the decode grammar compiled from the training schemas.

**Ladder exports** for device tiers:

```sh
neuralos build base.cact --lora adapter.safetensors --out mymodel.cact --layers 12
```

A depth-12 ladder yields 11 deployable models (2…12). Most of the parameter count lives in the **engram** memory, so a 121M model does the arithmetic of a 50M one — lower depths stay surprisingly competent on tool calls.

Optionally `--upload` pushes the artifact to hosted storage and prints a key for `platform test`.

## 5. Evaluate

```sh
neuralos platform test --tools tools.json --examples eval.jsonl --suffix mymodel
```

or locally: point `Needle(weights="mymodel.cact")` at your eval set and assert on tool picks + extraction F1. Exact-match accuracy on full test splits is the headline metric (benchmarks chart in the [README](https://github.com/DrOlu/neuralOS#readme)).

## 6. Ship

- **Python**: `Needle(weights="mymodel.cact")`.
- **App bundles**: the `.cact` is a single file; ship it next to your engine library.
- **Cross-platform**: `neuralos download` stages engines for other platforms; `neuralos spec` documents the matrix.
- **Quantization**: the shipped weights are already 2-bit quantized; re-quantization is only needed when training in higher precision first (`needle.model.quantize`).

## Architecture in one paragraph

Needle 3 is a **Laddered Simple Attention Network**: a **Monarch Hadamard MLP** replaces the FFN, **GQA attention with causal-conv taps**, **engram n-gram memory read by gather**, and **multi-lane hyper-connections**. Every depth from 2 to 20 layers is a deployable model. A **byte-level grammar compiled from your schemas** constrains every token, and every response carries a **calibrated confidence score** from a learned head. The interactive frontier plot and full fine-tuning results live at [cactuscompute.com/needle](https://cactuscompute.com/needle); weights and engines on [Hugging Face](https://huggingface.co/Cactus-Compute/needle3).
