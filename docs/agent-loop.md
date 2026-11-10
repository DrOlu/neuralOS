# Agent loop & integrations

## Writing good tools

The model reads your **signatures and docstrings**, so tool quality = prompt quality:

```python
from needle import Needle, tool
from typing import Annotated
from needle import Field

@tool(triggers=["transfer", "send money"])
def transfer_funds(
    from_account: Annotated[str, Field(pattern=r"^ACCT-\d{8}$")],
    to_account: Annotated[str, Field(pattern=r"^ACCT-\d{8}$")],
    amount: Annotated[float, Field(gt=0, multiple_of=0.01)],
    memo: str = "",
) -> dict:
    """Move money between two accounts. Only for accounts the user owns.
    Returns the confirmation id and the new balance."""
    return bank.transfer(from_account, to_account, amount, memo)
```

Checklist:

1. **Docstring states when to use it** — and when *not* to ("Only for accounts the user owns").
2. **Constrain with `Field`** — enums, ranges, patterns become decode grammar; invalid arguments become impossible, not unlikely.
3. **Deterministic, idempotent, fast** — `run()` executes tools inline.
4. **Return typed values** — dicts/bools the model can chain on the next step.
5. **Small tool sets win** — over ~50 tools, split by `triggers` or use a `tool_index_path`.

## The run loop, step by step

```python
n = Needle(tools=[transfer_funds, get_balance, …], system="You are the banking copilot.")
result = n.run("pay the electricity bill from checking", max_steps=6, strict=True)
```

Each step: the model either emits a tool call (grammar-constrained args) or a final answer. Calls execute in order; results feed the next step; the loop stops when the ask is satisfied or `max_steps` is hit. With `strict=True`, an ask no tool covers raises instead of returning an empty list — useful in pipelines where "silently do nothing" is worse than an error.

Confidence is on every response: below your threshold, hand off to a bigger model, another device, or a human.

## Patterns

**Router.** `embed()` the utterance once, pick the specialist `Needle` (calendar vs music vs home) by cosine match, then `run()` there.

**Extraction as classification.** A one-field Literal schema ("billing", "support", "sales") turns `extract()` into an on-device text classifier.

**Streaming state.** Keep one `Needle` alive across turns; state persists for `UNRESET_TURNS` (4) past `reset()`. `stateless=True` for strictly independent calls (e.g. batch processing).

**Edge relay.** Device runs neuralOS for instant tool calls; anything low-confidence relays to a cloud model. The calibrated confidence score makes the relay policy trivial.

## Integrating with harnesses

neuralOS is a library, not a daemon — any harness can embed it:

- **neuralOSd instances** (github.com/DrOlu/neuralosd) are the production pattern: a closed menu of probes with a refusal gate, signed envelopes and audit, backed by this engine. neuralOS supplies the model; neuralOSd supplies the *contract* (banks, oracles, trust classes, durable builds).
- **Custom agents**: wrap `Needle` in your own loop, or point an OpenAI-compatible harness at a thin shim that maps `run()` to the tool-call protocol.

## Embedded platforms

- The `.cact` checkpoint and engine library are plain files — drop them into an app bundle (iOS/Android via the bundled library, desktop via wheels/npm).
- The **ladder** is your device-tier strategy: depth 2–6 for wearables/MCU, 8–14 for phones, 16–20 for laptops/kiosks — one training run serves all of them.
- No network permission needed at inference; audit-friendly by construction.
