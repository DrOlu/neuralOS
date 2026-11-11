# neuralOS Documentation

**neuralOS** (the `neuralos` package, engine codename **Needle 3**) is a foundation model for mobiles, wearables, robots, smart home, automotive and microcontrollers. The whole model is a single **8–29 MB binary** built on the Simple Attention Network. It trades general chat capacity to beat models 10× its size on **mobile tool calls** and match 2–3× bigger models on **extraction** — and it also returns **text embeddings**, all fully **offline**.

| I want to… | Read |
|---|---|
| Install it | [Install](install.md) |
| Call tools / extract data / embed text from Python | [Python API](python-api.md) |
| Use the `neuralos` / `needle` CLI | [CLI reference](cli.md) |
| Fine-tune, quantize, build a checkpoint | [Fine-tuning & build](finetuning.md) |
| Understand the architecture and engines | [Model & engines](model.md) |
| Wire it into an agent harness | [Agent loop & integrations](agent-loop.md) |

## The three things it does

1. **Tool calls** — given the functions your app exposes, the model picks the right ones and fills every argument from what the user said. Ask for two things and you get two calls in order; ask something no tool covers and you get an **empty list, not a guess**.
2. **Structured extraction** — declare a shape (a Pydantic model or `@tool`-style signature), hand over messy text, get typed fields back: an invoice, a booking, a notification, a form. The decode **grammar guarantees the output parses**, extraction generalises to classification, and every response carries a **calibrated confidence score**. Values that cannot be grounded in the input raise `ExtractionValidationError`.
3. **Text embedding** — the same model returns a vector for a sentence, so an app can search, match and route locally.

## One-minute example

```python
from needle import Needle, tool

@tool
def send_message(to: str, body: str) -> bool:
    """Send a chat message to a contact."""
    return app.send(to, body)

n = Needle(tools=[send_message])
calls = n.run("text Sam that we're landing at 6")
# → [send_message(to="Sam", body="We're landing at 6")] — executed, results returned
```

## Channels

- **PyPI**: `pip install neuralos` — engine + weights bundled, fully offline after install. `needle` is installed as an alias.
- **npm**: `npm install neuralos` — same version number, same API surface, engines for macOS arm64/x64, Linux x64/arm64 (glibc), Windows x64.
- **One-liners**: `curl -fsSL https://raw.githubusercontent.com/DrOlu/neuralOS/main/install.sh | sh` (creates an isolated venv, verifies the wheel checksum, shims `neuralos` onto PATH); PowerShell: `irm …/install.ps1 | iex`.
- **`cactus-needle`**: the download-at-runtime variant (engine fetched from HuggingFace on first use) for footprint-obsessed deployments.

Weights and every platform engine are also on [Hugging Face](https://huggingface.co/Cactus-Compute/needle3).
