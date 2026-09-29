'use strict';

/**
 * Tool schema normalization. A tool is one of:
 *   - a schema object: { name, description, parameters, implementation? }
 *     (parameters is a JSON schema object; implementation is optional)
 *   - a function with a `.needleSchema` property (schema + implementation in one)
 *
 * Tool functions receive ONE argument: the arguments object the model produced.
 */

function normalizeTools(tools, functions) {
  const schemas = [];
  for (const entry of tools || []) {
    if (typeof entry === 'function' && entry.needleSchema) {
      const schema = entry.needleSchema;
      if (!schema || typeof schema.name !== 'string') {
        throw new TypeError('neuralOS: function.needleSchema must be {name, description, parameters}');
      }
      schemas.push(schema);
      functions.set(schema.name, entry);
    } else if (entry && typeof entry === 'object' && typeof entry.name === 'string') {
      schemas.push({
        name: entry.name,
        description: entry.description || '',
        parameters: entry.parameters || { type: 'object', properties: {} },
      });
      if (typeof entry.implementation === 'function') {
        functions.set(entry.name, entry.implementation);
      }
    } else {
      throw new TypeError(
        'neuralOS: each tool must be a schema object {name, description, parameters, implementation?} ' +
        'or a function with a .needleSchema property');
    }
  }
  return schemas;
}

/** A tiny `tool` helper, mirroring the Python decorator ergonomics. */
function tool(schema, fn) {
  const wrapped = (args) => fn(args);
  wrapped.needleSchema = schema;
  return wrapped;
}

module.exports = { normalizeTools, tool };
