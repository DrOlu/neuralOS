#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { Needle, extract, ExtractionValidationError } = require('./index');

function usage(code = 0) {
  const text = `neuralos ${require('./package.json').version} — offline tool-calling + embeddings engine

Usage:
  neuralos run     --tools <tools.json> [--impl <impl.js>] [--system <text>]
                   [--query <text>] [--max-steps <n>] [--max-new-tokens <n>]
  neuralos extract --schema <schema.json> --text <text> [--system <text>]
                   [--max-new-tokens <n>] [--no-strict]
  neuralos embed   --text <text>
  neuralos info

tools.json:  array of { name, description, parameters }
impl.js:     optional module exporting { toolName: (args) => result } functions
schema.json: a JSON schema object (the record is the only tool). Prints the
             extracted record, or exits 1 with the grounding failure.
`;
  process.stdout.write(text);
  process.exit(code);
}

function argValue(flag, argv) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

const argv = process.argv.slice(2);
const command = argv[0];

try {
  if (!command || command === '--help' || command === '-h') usage(0);

  if (command === 'info') {
    const info = require('./index').engineInfo();
    console.log(JSON.stringify(info, null, 2));
    process.exit(0);
  }

  if (command === 'extract') {
    const schemaPath = argValue('--schema', argv);
    const text = argValue('--text', argv);
    if (!schemaPath || !text) usage(1);
    const schema = JSON.parse(fs.readFileSync(path.resolve(schemaPath), 'utf8'));
    const system = argValue('--system', argv) || '';
    const maxNewTokens = Number(argValue('--max-new-tokens', argv) || 512);
    const strict = !argv.includes('--no-strict');
    try {
      const record = extract(text, schema, { system, maxNewTokens, strict });
      process.stdout.write(JSON.stringify(record, null, 2) + '\n');
      process.exit(0);
    } catch (err) {
      if (err instanceof ExtractionValidationError) {
        process.stderr.write(`neuralos: ${err.message}\n`);
        process.exit(1);
      }
      throw err;
    }
  }

  if (command === 'embed') {
    const text = argValue('--text', argv);
    if (!text) usage(1);
    const agent = new Needle();
    process.stdout.write(JSON.stringify(agent.embed(text)) + '\n');
    process.exit(0);
  }

  if (command === 'run') {
    const toolsPath = argValue('--tools', argv);
    const implPath = argValue('--impl', argv);
    const query = argValue('--query', argv) || '';
    const system = argValue('--system', argv) || '';
    const maxSteps = Number(argValue('--max-steps', argv) || 8);
    const maxNewTokens = Number(argValue('--max-new-tokens', argv) || 512);
    if (!toolsPath) usage(1);

    const schemas = JSON.parse(fs.readFileSync(path.resolve(toolsPath), 'utf8'));
    const tools = schemas.map((schema) => {
      const entry = { ...schema };
      if (implPath) {
        const impls = require(path.resolve(implPath));
        if (typeof impls[schema.name] === 'function') {
          entry.implementation = impls[schema.name];
        }
      }
      return entry;
    });
    const agent = new Needle({ tools, system });
    process.stdout.write(JSON.stringify(agent.run(query, { maxSteps, maxNewTokens }), null, 2) + '\n');
    process.exit(0);
  }

  usage(1);
} catch (err) {
  process.stderr.write(`neuralos: ${err && err.message ? err.message : err}\n`);
  process.exit(1);
}
