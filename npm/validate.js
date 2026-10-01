/**
 * Grounding + extraction validation — the Node port of the Python
 * `needle` validation core (needle/__init__.py), kept behaviour-compatible:
 *
 *   * sourceYears()      — years literally written in the input
 *   * licensedYears()    — those years, plus the system date's year when the
 *                          input reasons relatively ("tomorrow", "next week")
 *   * walkGrounding()    — date arguments must carry a licensed year
 *   * groundedNumberPaths() — numbers a value may carry without being invented
 *   * annotateUngrounded() — the engine's own fabrication report, re-checked
 *   * validateExtraction() — strict mode: raise instead of returning
 *                            ungrounded values silently
 *
 * Python raises ExtractionValidationError; so do we.
 */
'use strict';

class ExtractionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExtractionValidationError';
  }
}

const MONTHS =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|' +
  'jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|' +
  'oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

// The number after a day+month is its year, unless it is the hour of a time
// ("5 June 19:30", "June 5 7 pm"): no ISO argument can carry that as a year,
// so licensing it would reject every date. Year-first numeric dates only
// (2024-03-15) — a day/month-first date must not mint its leading component.
const SOURCE_YEAR_PATTERNS = [
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTHS}[\\s,]+(\\d{1,4})(?![0-9A-Za-z]|:\\d|\\s*[ap]\\.?m\\b)`, 'g'),
  new RegExp(`\\b${MONTHS}\\s+\\d{1,2}(?:st|nd|rd|th)?\\s*,?\\s+(\\d{1,4})(?![0-9A-Za-z]|:\\d|\\s*[ap]\\.?m\\b)`, 'g'),
  new RegExp(`\\b${MONTHS}[\\s,]+(\\d{3,4})(?![0-9A-Za-z])`, 'g'),
  /\byear\s+(\d{1,4})(?![0-9A-Za-z])/g,
  /(?<![0-9])(\d{4})(?=[-/]\d{1,2}[-/]\d{1,2}(?![0-9]))/g,
];

const RELATIVE_CUE = new RegExp(
  '\\b(today|tonight|tomorrow|yesterday|next|this|coming|now|in \\d+ (?:days?|weeks?|months?|years?)|' +
  'monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b', 'i');

const NUMBER_TOKEN =
  /(?<![\w.,])(?:[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[-+]?\d+(?:\.\d+)?)(?!\d)/g;

const DATE_FACT =
  /date:\s*\d{4}-\d{2}-\d{2}(?:\s+[A-Za-z]{3})?(?:\s+\d{2}:\d{2})?|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?/g;

/** Years literally written in the text. */
function sourceYears(text) {
  const lowered = String(text || '').toLowerCase();
  const years = new Set();
  for (const pattern of SOURCE_YEAR_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(lowered)) !== null) {
      years.add(parseInt(match[1], 10));
    }
  }
  return years;
}

function relativeCue(text) {
  return !!text && RELATIVE_CUE.test(String(text));
}

/** Years a date argument may carry without being fabricated. */
function licensedYears(seenYears, system, relative = true) {
  const years = new Set(seenYears || []);
  if (years.size && system && relative) {
    for (const year of sourceYears(system)) years.add(year);
  }
  return years;
}

function schemaParameters(schema) {
  if (schema && typeof schema === 'object' && schema.parameters) return schema.parameters;
  return schema || {};
}

function resolveRef(node, root) {
  const seen = new Set();
  let current = node;
  while (current && typeof current === 'object' && current.$ref) {
    if (seen.has(current.$ref)) break;
    seen.add(current.$ref);
    const parts = String(current.$ref).replace(/^#\//, '').split('/');
    let target = root;
    for (const part of parts) {
      target = (target || {})[part.replace(/~1/g, '/').replace(/~0/g, '~')] || {};
    }
    if (target === current) break;
    current = target;
  }
  return current;
}

/** Date arguments must carry a year that is licensed by the input. */
function walkGrounding(schema, arguments_, years) {
  const root = schemaParameters(schema);
  const checked = new Set();
  const failures = new Set();

  const walk = (value, node, path) => {
    node = resolveRef(node, root) || {};
    const variants = node.anyOf || node.oneOf || [];
    const concrete = variants.filter((v) => (resolveRef(v, root) || {}).type !== 'null');
    if (concrete.length === 1) node = resolveRef(concrete[0], root) || {};

    if ((node.format === 'date' || node.format === 'date-time') && typeof value === 'string') {
      const match = /^(\d{4})-/.exec(value);
      if (match && years.size) {
        checked.add(path);
        if (!years.has(parseInt(match[1], 10))) failures.add(path);
      }
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const properties = node.properties || {};
      for (const [key, item] of Object.entries(value)) {
        if (key in properties) walk(item, properties[key], path ? `${path}.${key}` : key);
      }
    } else if (Array.isArray(value) && node.items) {
      value.forEach((item, index) => walk(item, node.items, `${path}[${index}]`));
    }
  };

  walk(arguments_, root, '');
  return { checked, failures };
}

function temporalGrounding(text, schema, arguments_, system) {
  const years = licensedYears(sourceYears(text), system, relativeCue(text));
  return walkGrounding(schema, arguments_, years);
}

function withoutDateFacts(text) {
  return String(text || '').replace(DATE_FACT, ' ');
}

/** (path, value) for every numeric leaf, arguments-relative. */
function numericPaths(arguments_, path = '') {
  const out = [];
  const walk = (value, currentPath) => {
    if (typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) {
      out.push([currentPath, value]);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${currentPath}[${index}]`));
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        walk(item, currentPath ? `${currentPath}.${key}` : String(key));
      }
    }
  };
  walk(arguments_, path);
  return out;
}

/** Numeric values written in the source texts (separators normalized). */
function sourceNumbers(...sources) {
  const text = sources
    .map((source) => withoutDateFacts(source))
    .filter((source) => source)
    .join('\n');
  const numbers = new Set();
  NUMBER_TOKEN.lastIndex = 0;
  let match;
  while ((match = NUMBER_TOKEN.exec(text)) !== null) {
    const normalized = match[0].replace(/,/g, '');
    const asNumber = Number(normalized);
    if (Number.isFinite(asNumber)) numbers.add(asNumber);
  }
  return numbers;
}

function groundedNumberPaths(arguments_, ...sources) {
  const numbers = sourceNumbers(...sources);
  const grounded = new Set();
  if (!numbers.size) return grounded;
  for (const [path, value] of numericPaths(arguments_)) {
    if (numbers.has(value)) grounded.add(path);
  }
  return grounded;
}

/** The engine's fabrication report, grouped by tool. */
function ungroundedPaths(response) {
  const validation = (response && response.validation) || {};
  const grouped = new Map();
  for (const name of validation.ungrounded || []) {
    const text = String(name);
    const dot = text.indexOf('.');
    const tool = dot === -1 ? text : text.slice(0, dot);
    const path = dot === -1 ? text : text.slice(dot + 1);
    if (!grouped.has(tool)) grouped.set(tool, new Set());
    grouped.get(tool).add(path || tool);
  }
  return grouped;
}

/** Add engine-reported ungrounded values to response.validation.ungrounded. */
function annotateUngrounded(response, toolSchemas, seenYears, system, text) {
  const calls = response.function_calls || [];
  const years = licensedYears(seenYears, system, text !== undefined && text !== null ? relativeCue(text) : true);
  if (!calls.length || !years.size) return;
  const schemas = new Map();
  for (const entry of toolSchemas || []) {
    if (entry && entry.name) schemas.set(entry.name, entry);
  }
  const found = [];
  for (const call of calls) {
    const schema = schemas.get(call.name);
    if (!schema) continue;
    const { failures } = walkGrounding(schema, call.arguments || {}, years);
    for (const path of [...failures].sort()) found.push(`${call.name}.${path}`);
  }
  if (!found.length) return;
  const validation = response.validation || {};
  const existing = [...(validation.ungrounded || [])];
  validation.ungrounded = existing.concat(found.filter((name) => !existing.includes(name)));
  response.validation = validation;
}

/** Strict mode: raise instead of returning values the input does not license. */
function validateExtraction(text, schema, arguments_, response, system) {
  const { checked, failures } = temporalGrounding(text, schema, arguments_, system);
  const validation = (response && response.validation) || {};
  const flagged = validation.ungrounded || [];
  const grounded = flagged.length ? groundedNumberPaths(arguments_, text, system) : new Set();
  for (const name of flagged) {
    const path = String(name).includes('.') ? String(name).split('.').slice(1).join('.') : String(name);
    if (grounded.has(path)) continue;
    if (!checked.has(path) || failures.has(path)) failures.add(path);
  }
  if (validation.negation) failures.add('negated request');
  if (failures.size) {
    const detail = [...failures].sort().join(', ');
    throw new ExtractionValidationError(
      `extraction returned values not grounded in the input: ${detail}`);
  }
  return arguments_;
}

module.exports = {
  ExtractionValidationError,
  sourceYears,
  relativeCue,
  licensedYears,
  walkGrounding,
  temporalGrounding,
  groundedNumberPaths,
  sourceNumbers,
  numericPaths,
  ungroundedPaths,
  annotateUngrounded,
  validateExtraction,
};
