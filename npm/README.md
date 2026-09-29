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

Bundled engines: macOS arm64/x64, Linux x64/arm64 (glibc), Windows x64.
Other platforms are not packaged — the Python distribution
(`pip install neuralos`) carries a broader engine matrix.

> Note: this package is the **foundation-model runtime**. The headless RTerm
> backend daemon lives in the separate [`rterm-backend`](https://www.npmjs.com/package/rterm-backend)
> package (previously also published here as neuralos 2.x–3.9.x).

## License

Apache-2.0
