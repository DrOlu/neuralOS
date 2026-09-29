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
