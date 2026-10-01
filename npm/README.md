# neuralOS for Node.js

The automation foundation model for tiny devices — **offline tool-calling,
structured extraction and embeddings** for Node.js. Each platform package
bundles the native engine (`libneedle3`) **and** the base weights
(`needle3.cact`, ~35 MB), so after `npm install` nothing ever touches the
network.

```bash
npm install neuralos
```

```js
const { Needle, tool } = require('neuralos');

const getWeather = tool({
  name: 'get_weather',
  description: 'Get the current weather for a city.',
  parameters: {
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city'],
  },
}, (args) => ({ city: args.city, temp_c: 27, sky: 'clear' }));

const agent = new Needle({ tools: [getWeather] });
console.log(agent.run("What's the weather in Lagos?"));
// -> { type: 'respond', confidence: 0.73, results: [{ city: 'Lagos', ... }], ... }

console.log(agent.embed('hello world')); // float vector
```

## CLI

```bash
neuralos run --tools tools.json [--impl impl.js] --query "text"
neuralos embed --text "text"
neuralos info
```

## API

- **`new Needle({ tools, system, autoDate, stateless, bufferSize })`**
  - `tools`: schema objects `{ name, description, parameters, implementation? }`
    or functions with a `.needleSchema` property (use the `tool()` helper).
    Implementations receive one argument: the arguments object from the model.
  - `autoDate` (default true): injects a local `date:` fact into the system text.
  - `stateless` (default false): `reset()` before every query.
- **`agent.run(query, { maxSteps, maxNewTokens })`** — tool-call loop;
  returns the response envelope with a `results` array.
- **`agent.complete(text, maxNewTokens)`** — single completion, no execution.
- **`agent.embed(text)`** — embedding vector.
- **`agent.reset()`** — clear the engine-side conversation state.

## Platforms

## Structured extraction (same API as Python)

Declare the record, hand over messy text, get typed fields back. The API is the
Node mirror of the Python `needle.extract` — same semantics, same validation:

```js
const { extract, Field } = require('neuralos');

const invoice = extract('Invoice INV-1042 issued 12 May 2024, total 49.62 USD.', {
  name: 'Invoice',                       // named schema = the engine's call target
  parameters: {
    type: 'object',
    properties: {
      invoice_no: Field({ type: 'string' }),
      issue_date: Field({ type: 'string', format: 'date' }),
      total:      Field({ type: 'number', ge: 0 }),
    },
    required: ['invoice_no', 'total'],
  },
});
// { invoice_no: 'INV-1042', issue_date: '2024-05-12', total: 49.62 }
```

With `strict: true` (the default) a value the input does not license raises
`ExtractionValidationError` instead of being returned silently — a date whose
year is not written in the text, an invented number, or a negated request:

```js
const { extract, ExtractionValidationError } = require('neuralos');
try {
  extract('Invoice with no date mentioned', { name: 'Invoice', parameters: { /* … */ } });
} catch (err) {
  if (err instanceof ExtractionValidationError) console.error(err.message);
}
```

Return value: the extracted record, or `null` when the model emits no call.
Pass `strict: false` to receive unvalidated values.

### CLI

```bash
neuralos extract --schema invoice.schema.json --text "Invoice INV-7, 3 March 2024, total 12.50"
neuralos extract --schema invoice.schema.json --text "…" --no-strict
```

Exits `1` with the grounding message when strict validation fails.

## Feature parity with the Python distribution

| Capability | Python (`pip install neuralos`) | Node (this package) |
|---|---|---|
| Tool calling | `Needle().run()` | `new Needle().run()` |
| Structured extraction | `needle.extract()` | `extract()` |
| Field constraints | `needle.Field(...)` | `Field(...)` |
| Grounding validation | `ExtractionValidationError` | `ExtractionValidationError` |
| Embeddings | `.embed()` | `.embed()` |
| CLI | `run \| embed \| info` | `run \| extract \| embed \| info` |
| Engine + weights bundled | wheels | platform packages |

Both distributions are released **at the same version number** from the same
tag, so `npm view neuralos version` and `pip index versions neuralos` agree.

Bundled engines: macOS arm64/x64, Linux x64/arm64 (glibc), **Windows x64**.
Other platforms are not packaged — the Python distribution
(`pip install neuralos`) carries a broader engine matrix.
Other platforms are not packaged — the Python distribution
(`pip install neuralos`) carries a broader engine matrix.

> Note: this package is the **foundation-model runtime**. The headless RTerm
> backend daemon lives in the separate [`rterm-backend`](https://www.npmjs.com/package/rterm-backend)
> package (previously also published here as neuralos 2.x–3.9.x).

## License

Apache-2.0
