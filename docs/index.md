<div class="raft-hero" markdown="0">
<p class="raft-eyebrow">neuralOS &middot; Needle 3</p>
<h1>Tool calls, extraction and embeddings &mdash; on the device.</h1>
<p class="raft-lede">A foundation model for mobiles, wearables, robots, smart home, automotive
and microcontrollers. The whole model is a single 8&ndash;29&nbsp;MB binary built on the
Simple Attention Network &mdash; fully offline, no API key, no cloud.</p>
<div class="raft-actions">
<a class="raft-btn primary" href="install/">Install</a>
<a class="raft-btn" href="python-api/">Python API</a>
<a class="raft-btn" href="https://github.com/DrOlu/neuralOS">GitHub</a>
</div>
<div class="raft-badges">
<span class="raft-badge">8&ndash;29 MB</span>
<span class="raft-badge">Offline</span>
<span class="raft-badge">Python + npm</span>
<span class="raft-badge">macOS &middot; Linux &middot; Windows</span>
</div>
</div>

<div class="raft-grid">
<div class="raft-card"><div class="swatch yellow">TOOLS</div><div class="body">
<h3>Function calling</h3>
<p>Give it your function signatures; it picks the right calls and fills every argument. No match means an empty list, not a guess.</p>
</div></div>
<div class="raft-card"><div class="swatch lavender">EXTRACT</div><div class="body">
<h3>Typed structured output</h3>
<p>Declare a shape and get typed fields back. The decode grammar guarantees the output parses, with a calibrated confidence score.</p>
</div></div>
<div class="raft-card"><div class="swatch orange">EMBED</div><div class="body">
<h3>Local embeddings</h3>
<p>The same model returns vectors for sentences, so search, matching and routing happen on the device.</p>
</div></div>
</div>

<div class="raft-strip">A small model that fits &mdash; and answers where the data lives.</div>

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
