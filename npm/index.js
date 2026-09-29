'use strict';

/**
 * neuralOS — the automation foundation model for tiny devices, for Node.js.
 *
 * Offline tool-calling, structured extraction and embeddings on the bundled
 * libneedle3 engine + needle3.cact weights (installed via the platform
 * optional dependency for your OS/arch).
 *
 *   const { Needle, tool } = require('neuralos');
 *
 *   const getWeather = tool({
 *     name: 'get_weather',
 *     description: 'Get the current weather for a city.',
 *     parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
 *   }, (args) => ({ city: args.city, temp_c: 27, sky: 'clear' }));
 *
 *   const agent = new Needle({ tools: [getWeather] });
 *   console.log(agent.run("What's the weather in Lagos?"));
 */

const engineLoader = require('./engine');
const { normalizeTools, tool } = require('./tools');

const UNRESET_TURNS = 4;

function withDateFact(system, autoDate) {
  const text = system || '';
  if (!autoDate) return text;
  // Mirror Python: skip when the caller already supplied a date fact/ISO stamp.
  if (/\bdate\s*:/.test(text) || /\d{4}-\d{2}-\d{2}/.test(text)) return text;
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const pad = (n) => String(n).padStart(2, '0');
  const fact =
    `date: ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${days[now.getDay()]} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (!text.trim()) return fact;
  return fact + '; ' + text;
}

class Needle {
  constructor({
    tools = [],
    system = '',
    autoDate = true,
    stateless = false,
    bufferSize = 65536,
  } = {}) {
    this._functions = new Map();
    this._schemas = normalizeTools(tools, this._functions);
    this.systemText = withDateFact(system, autoDate);
    this.toolsJson = JSON.stringify(this._schemas);
    this._stateless = !!stateless;
    this._turns = 0;
    this._bufferSize = bufferSize;
    this._bind();
  }

  _bind() {
    engineLoader.bindAgent(this);
  }

  _countQuery() {
    this._turns++;
    if (this._turns === UNRESET_TURNS + 1) {
      console.warn(
        `neuralOS: ${UNRESET_TURNS} queries on this agent without reset(); every turn stays in the ` +
        'conversation, so unrelated queries lose accuracy. Call reset() between independent queries.');
    }
  }

  complete(text = '', maxNewTokens = 512) {
    if (this._stateless) this.reset();
    this._countQuery();
    return this._complete(text, maxNewTokens);
  }

  _complete(text, maxNewTokens, parse = true) {
    this._bind();
    const e = engineLoader.engine();
    const buffer = e.allocBuffer(this._bufferSize);
    const rc = e.complete(text || '', Math.trunc(maxNewTokens), buffer, this._bufferSize);
    if (rc < 0) {
      const detail = e.decodeString(buffer, this._bufferSize);
      throw new Error(detail || `neuralOS: needle_complete failed (code ${rc})`);
    }
    const raw = e.decodeString(buffer, this._bufferSize);
    if (!parse) return raw;
    let response;
    try {
      response = JSON.parse(raw);
    } catch (err) {
      throw new Error(`neuralOS: engine returned an unparseable envelope (${err.message})`);
    }
    return response;
  }

  /** Execute tool calls until the model responds. Mirrors Python's run(). */
  run(query = '', { maxSteps = 8, maxNewTokens = 512 } = {}) {
    if (this._stateless) this.reset();
    this._countQuery();
    let response = this._complete(query, maxNewTokens);
    const executed = [];
    for (let step = 0; step < maxSteps; step++) {
      const calls = response.function_calls || [];
      if (response.type !== 'call' || !calls.length) break;
      const results = [];
      for (const call of calls) {
        const name = String(call.name);
        const fn = this._functions.get(name);
        if (!fn) {
          results.push({ error: 'unknown tool: ' + name });
          continue;
        }
        try {
          results.push(fn(call.arguments || {}));
        } catch (err) {
          results.push({ error: String((err && err.message) || err) });
        }
      }
      executed.push(...results);
      response = this._complete(JSON.stringify(results), maxNewTokens, false);
      try { response = JSON.parse(response); } catch (_) { /* handled below */ }
      if (typeof response !== 'object' || response === null) {
        throw new Error('neuralOS: engine returned an unparseable envelope');
      }
    }
    response.results = executed;
    return response;
  }

  embed(text = '') {
    this._bind();
    const e = engineLoader.engine();
    const dim = e.embed(text || '', null, 0);
    if (dim <= 0) throw new Error(`neuralOS: needle_embed failed (code ${dim})`);
    const out = e.allocFloats(dim);
    const rc = e.embed(text || '', out, dim);
    if (rc !== dim) throw new Error(`neuralOS: needle_embed failed (code ${rc})`);
    return e.decodeFloats(out, dim);
  }

  reset() {
    this._bind();
    engineLoader.engine().reset();
    this._turns = 0;
  }
}

module.exports = {
  Needle,
  tool,
  version: require('./package.json').version,
  platformKey: engineLoader.platformKey,
  engineInfo: () => {
    const e = engineLoader.engine();
    return { lib: e.libPath, weights: e.weightsPath };
  },
};
