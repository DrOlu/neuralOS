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
    } else if (entry && typeof entry === 'object') {
      // An ANONYMOUS schema: the record itself is the only tool (Python parity —
      // needle._resolve passes plain dicts through unwrapped, which is what
      // extract() relies on: the engine answers with arguments only).
      schemas.push(entry);
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

/**
 * Field — declarative constraints for a schema property, mirroring the Python
 * `needle.Field`. Build the property, then attach it to your JSON schema:
 *
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       total: Field({ type: 'number', description: 'invoice total', ge: 0 }),
 *       status: Field({ type: 'string', enum: ['paid', 'unpaid', 'overdue'] }),
 *     },
 *     required: ['total'],
 *   }
 *
 * Python parity: ge/le → minimum/maximum, gt/lt → exclusiveMinimum/Maximum,
 * min_length/max_length → minLength/maxLength, min_items/max_items →
 * minItems/maxItems, plus enum/const/pattern/format/multipleOf.
 */
function Field({ default: defaultValue, description, enum: enum_, const: const_,
                 ge, le, gt, lt, multiple_of: multipleOf, min_length: minLength,
                 max_length: maxLength, pattern, format, min_items: minItems,
                 max_items: maxItems, unique_items: uniqueItems, ...rest } = {}) {
  const schema = { ...rest };
  const pairs = [['description', description], ['enum', enum_],
                 ['minimum', ge], ['maximum', le],
                 ['exclusiveMinimum', gt], ['exclusiveMaximum', lt],
                 ['multipleOf', multipleOf], ['minLength', minLength],
                 ['maxLength', maxLength], ['pattern', pattern], ['format', format],
                 ['minItems', minItems], ['maxItems', maxItems],
                 ['uniqueItems', uniqueItems]];
  for (const [key, value] of pairs) {
    if (value !== undefined && value !== null) schema[key] = value;
  }
  if (const_ !== undefined) schema.const = const_;
  if (defaultValue !== undefined) schema.default = defaultValue;

  // Python parity: `needle.Field(ge=0).apply({"type": "number"})`. The method is
  // non-enumerable so JSON.stringify(schema) — i.e. the payload sent to the
  // engine — is byte-identical to the plain constraints object.
  Object.defineProperty(schema, 'apply', {
    enumerable: false,
    value(target) {
      return { ...(target || {}), ...this };
    },
  });
  return schema;
}

module.exports = { normalizeTools, tool, Field };
