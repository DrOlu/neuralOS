# CLI reference — `neuralos` / `needle`

Both commands are the same binary (`pip install neuralos` installs both names). Every subcommand works offline except `download` and `--upload`.

## `run` — raw completion

```sh
neuralos run --query "turn the hallway lights off" \
             --tools tools.json --max-len 256 --seed 7 --temperature 0.0
```

| Flag | Purpose |
|---|---|
| `--checkpoint` | Weights file (default: bundled base weights) |
| `--query` | The prompt |
| `--tools` | JSON tool-schema file — returns tool calls instead of text |
| `--max-len` / `--seed` / `--temperature` | Decode bounds and determinism |

## `finetune` — LoRA fine-tuning

```sh
neuralos finetune data.jsonl --checkpoint base.cact \
    --epochs 3 --batch-size 8 --lr 1e-4 \
    --lora-rank 16 --lora-alpha 32 --max-len 1024 --val-split 0.1
```

Input is JSONL of `{"messages": [...]}` or tool-call transcripts. LoRA adapters train fast on CPU; merge + export with `build`. See [fine-tuning & build](finetuning.md).

## `generate-data` — synthetic training data

```sh
neuralos generate-data --tools tools.json --num-samples 2000 \
    --augment --batch-size 16 --workers 4 --output train.jsonl
```

Generates paraphrased, augmented tool-call transcripts from your tool schemas so the model learns **your** surface. `--model`/`--checkpoint` selects the generator weights.

## `build` — merge adapters into a deployable checkpoint

```sh
neuralos build base.cact --lora adapter.safetensors --out my-model.cact
neuralos build base.cact --out my-model.cact --layers 8      # ladder: export at depth 8
neuralos build base.cact --lora adapter.safetensors --out s3-key --upload
```

`--layers` exports a **laddered** checkpoint — every depth from 2 to `--layers` is itself a deployable model (smaller = faster; pick per device tier). `--platform` constrains the export to one engine target.

## `download` — fetch engines/weights

```sh
neuralos download --out ./engines            # engine matrix for this machine
neuralos download --checkpoint my-model.cact --no-wait
```

Needed only for source installs or cross-platform staging; wheels and npm bundles already carry engine + base weights.

## `spec` — engine/version matrix

```sh
neuralos spec --out spec.json --depth 12 --generation 3
```

Prints (or writes) which engine builds exist for which platform at which generation — the machine-readable companion to `download`.

## `platform` — hosted fine-tuning

```sh
neuralos platform finetune train.jsonl --validation val.jsonl --max-depth 8 \
    --suffix mymodel --out result.json
neuralos platform test --tools tools.json --examples tests.jsonl --suffix mymodel
```

Submits training/evaluation to the hosted platform instead of running locally; `--no-wait` polls later.

## `generate` — starter artifacts

```sh
neuralos generate --tools tools.json --examples 6 --description "Home automation skill" \
    --message "dim the cinema lights" --suffix lights --out skill.json
```

Generates a tool-call starter (prompt + example calls) from your schemas — useful as an eval seed or a docs example.
