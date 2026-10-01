'use strict';

const { Needle, tool } = require('./index');

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
const result = agent.run('What is the weather in Lagos?');
console.log(JSON.stringify(result.results));

const vector = agent.embed('hello world');
console.log('embed dim:', vector.length);

// --- Field: both call styles must produce the same schema -------------------
const { Field } = require('./index');

const inline = Field({ type: 'number', description: 'total', ge: 0, le: 1000 });
const applied = Field({ description: 'total', ge: 0, le: 1000 }).apply({ type: 'number' });
console.log('field inline :', JSON.stringify(inline));
console.log('field applied:', JSON.stringify(applied));
if (JSON.stringify(inline) !== JSON.stringify(applied)) {
  throw new Error('Field: inline form and .apply() form disagree');
}
// the method must not leak into the serialised schema
if (JSON.stringify(inline) !== '{"type":"number","description":"total","minimum":0,"maximum":1000}') {
  throw new Error('Field: unexpected serialisation');
}
if (Object.keys(inline).includes('apply')) {
  throw new Error('Field: apply() must be non-enumerable');
}
// Python-style constraint names, including the snake_case ones
console.log('field python :', JSON.stringify(Field({ min_length: 2, max_length: 8, multiple_of: 5 })));
console.log('Field OK');

// --- extraction: module API present and callable ----------------------------
const { extract, ExtractionValidationError } = require('./index');
console.log('extract:', typeof extract, '| error class:', ExtractionValidationError.name);
