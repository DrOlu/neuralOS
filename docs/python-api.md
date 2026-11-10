# Python API

Everything lives behind `import needle` (alias `import neuralos`):

```python
from needle import Needle, tool, Field, extract, ExtractionValidationError
```

## `Needle` — the model handle

```python
Needle(
    tools=None,            # list of @tool-decorated callables
    system=None,           # system preamble steering style/format
    weights=None,          # path to base or LoRA-merged weights (default: bundled)
    tool_index_path=None,  # persistent tool index (for very large tool sets)
    buffer_size=None,      # context ring-buffer size for multi-turn state
    auto_date=True,        # inject the current date for temporal grounding
    generation=None,       # force engine generation (2 or 3); default: auto
    stateless=False,       # True = no cross-call state at all
)
```

The handle is expensive to construct (loads the engine + weights) and cheap to reuse — treat it as a singleton. It is a **context manager**:

```python
with Needle(tools=tools) as n:
    calls = n.run("…")     # engine released deterministically on exit
```

`UNRESET_TURNS = 4` — the last four turns of state are preserved across `reset()`; pass `stateless=True` when calls must not influence each other at all.

### Methods

| Method | Purpose |
|---|---|
| `run(query, max_steps=…, max_new_tokens=…, strict=False)` | The agentic loop: pick tools, fill args, **execute them**, loop until done or `max_steps`; returns the calls **and their results** in order |
| `extract(text, schema, max_new_tokens=…, strict=True)` | Structured extraction into a declared shape (see below) |
| `complete(text, max_new_tokens=…)` | Raw completion — rarely needed; the model is trained for tools/extraction, not chat |
| `embed(text)` | Text embedding vector for search/match/route |
| `reset()` | Clear conversational state (keeps the last `UNRESET_TURNS`) |
| `close()` | Release the engine immediately (also via `__exit__`) |

### `run()` — the tool-calling loop

```python
calls = n.run("turn off the living room lights and set the alarm for 6am")
for c in calls:
    print(c.name, c.args, c.result)
# lights.off  {}                          → True   (executed first)
# alarm.set    {"time": "06:00"}          → "alarm set for 06:00"
```

- **Ordered multi-intent**: two asks, two calls, in the user's order.
- **No hallucinated tools**: uncovered asks return an **empty list**.
- **`strict=True`** raises instead of executing when a required argument cannot be grounded in the query.
- `max_steps` bounds the loop; `max_new_tokens` bounds each decode.

## `@tool` — expose a function

```python
@tool                                   # or @tool(triggers=["pay", "settle up"])
def pay_invoice(invoice_id: str, amount: float, currency: str = "USD") -> bool:
    """Pay an invoice by id. amount is the exact amount in minor-unit-free currency."""
    return banking.pay(invoice_id, amount, currency)
```

- The **signature is the schema**: type annotations become JSON-schema types (`str→string`, `int→integer`, `float→number`, `bool→boolean`, `list→array`, `dict→object`; unions supported).
- The **docstring is the description** — write it like documentation for a junior colleague; the model reads it.
- `triggers=["…"]` adds recall hints for large tool sets.
- `Field` refines any parameter: `amount: Annotated[float, Field(ge=0, multiple_of=0.01)]`, `status: Annotated[str, Field(enum=["open","paid"])]`, plus `const`, `gt/lt`, `min_length/max_length`, `pattern`, `format`, `min_items/max_items`, `unique_items`.
- Enums, defaults and constraints all constrain the decode **grammar** — the model physically cannot emit an invalid argument shape.

## `extract()` — typed fields from messy text

```python
from pydantic import BaseModel

class Invoice(BaseModel):
    vendor: str
    total: float
    due_date: str
    currency: str = "EUR"

inv = n.extract(text, Invoice)
# Invoice(vendor="Acme GmbH", total=1420.5, due_date="2026-12-20", currency="EUR")
```

or the one-shot top-level function:

```python
from needle import extract
inv = extract(text, Invoice, system="Invoices are in German.")
```

- Works with Pydantic models, `dataclasses`, `TypedDict`, and plain `Annotated` signatures.
- **Grammar-constrained decode**: the output always parses.
- **Grounding**: every extracted value must be grounded in the input (with date/number-path validation); ungrounded values raise **`ExtractionValidationError`** rather than slipping through. `strict=False` downgrades validation failure to `None` fields instead of raising.
- Classification is extraction with a Literal/enum field.

## `embed()` — local embeddings

```python
v = n.embed("refund the duplicate charge")
# → list[float]; cosine-compare against your indexed vectors, all on-device
```

Same engine, no second model to ship. Typical uses: on-device semantic search, routing a user utterance to the right handler, near-duplicate detection.

## Engine lifecycle

- One process should hold **one** `Needle` per weights file; the engine is reference-counted internally.
- `weights=` points at a `.cact` checkpoint (base or LoRA-merged — see [fine-tuning](finetuning.md)); `generation=` pins engine gen 2 or 3 when you must match a specific runtime.
- Everything runs **on CPU** (Apple GPU path on macOS); no cloud calls, no network at inference time.

## Node.js parity

The npm package mirrors this surface: `new Needle({ tools })`, `await n.run(q)`, `await n.extract(text, schema)`, `await n.embed(s)`. Same versioning, same weights.
