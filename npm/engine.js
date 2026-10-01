'use strict';

/**
 * neuralOS engine loader — locates the platform engine package
 * (libneedle3 shared library + needle3.cact weights), binds the C ABI
 * through koffi, and loads the base weights once per process.
 *
 * The C ABI mirrors needle/__init__.py in the Python distribution:
 *   int  needle_init(const char *system, const char *tools, const char *tool_index)
 *   int  needle_complete(const char *text, int max_new_tokens, char *buffer, int buffer_len)
 *   int  needle_embed(const char *text, float *out, int dim)
 *   void needle_reset(void)
 *   int  needle_load(const char *data, unsigned long long len)
 */

const fs = require('fs');
const path = require('path');
const koffi = require('koffi');

const PLATFORM_PACKAGES = {
  'darwin-arm64': { pkg: 'neuralos-darwin-arm64', lib: 'libneedle3.dylib' },
  'darwin-x64': { pkg: 'neuralos-darwin-x64', lib: 'libneedle3.dylib' },
  'linux-x64-gnu': { pkg: 'neuralos-linux-x64-gnu', lib: 'libneedle3.so' },
  'linux-arm64-gnu': { pkg: 'neuralos-linux-arm64-gnu', lib: 'libneedle3.so' },
  // npm blocks "neuralos-win32-x64" as a look-alike name (403 spam
  // detection), so the Windows payload ships as this package instead.
  'win32-x64': { pkg: 'neuralos-engine-windows-x64', lib: 'libneedle3.dll' },
};

function platformKey() {
  const p = process.platform;
  const a = process.arch;
  if (p === 'darwin') return a === 'arm64' ? 'darwin-arm64' : (a === 'x64' ? 'darwin-x64' : null);
  if (p === 'win32') return a === 'x64' ? 'win32-x64' : null;
  if (p === 'linux') {
    if (a !== 'x64' && a !== 'arm64') return null;
    // musl (Alpine) engines are not bundled; detect via process.report.
    try {
      const report = process.report && process.report.getReport && process.report.getReport();
      if (report && report.header && !report.header.glibcVersionRuntime) return null;
    } catch (_) { /* assume glibc */ }
    return a === 'x64' ? 'linux-x64-gnu' : 'linux-arm64-gnu';
  }
  return null;
}

function platformPackageDir() {
  const key = platformKey();
  if (!key) {
    throw new Error(
      `neuralOS: no bundled engine for ${process.platform}/${process.arch}. ` +
      'Supported: darwin arm64/x64, linux x64/arm64 (glibc), win32 x64.');
  }
  const spec = PLATFORM_PACKAGES[key];
  let dir;
  try {
    dir = path.dirname(require.resolve(spec.pkg + '/package.json'));
  } catch (err) {
    throw new Error(
      `neuralOS: engine package ${spec.pkg} is not installed. Reinstall neuralos ` +
      `(optional dependencies must be allowed: npm i neuralos --include=optional).`);
  }
  return { dir, lib: spec.lib, key };
}

let _engine = null;

function engine() {
  if (_engine) return _engine;
  const { dir, lib: libName } = platformPackageDir();
  const libPath = path.join(dir, 'bin', libName);
  const weightsPath = path.join(dir, 'bin', 'needle3.cact');
  if (!fs.existsSync(libPath)) throw new Error(`neuralOS: engine library missing: ${libPath}`);
  if (!fs.existsSync(weightsPath)) throw new Error(`neuralOS: weights missing: ${weightsPath}`);

  const lib = koffi.load(libPath);
  const needleInit = lib.func('int needle_init(const char *system, const char *tools, const char *tool_index)');
  const needleComplete = lib.func('int needle_complete(const char *text, int max_new_tokens, _Out_ char *buffer, int buffer_len)');
  const needleEmbed = lib.func('int needle_embed(const char *text, float *out, int dim)');
  const needleReset = lib.func('void needle_reset()');
  const needleLoad = lib.func('int needle_load(const char *data, unsigned long long len)');

  const weights = fs.readFileSync(weightsPath);
  const dataPtr = koffi.as(weights, 'const char *');
  if (needleLoad(dataPtr, weights.length) < 0) {
    throw new Error(`neuralOS: needle_load failed for ${weightsPath}`);
  }

  _engine = {
    libPath,
    weightsPath,
    init: (systemText, toolsJson, toolIndexPath) =>
      needleInit(systemText, toolsJson, toolIndexPath || null),
    complete: (text, maxNewTokens, buf, len) =>
      needleComplete(text, maxNewTokens, buf, len),
    embed: (text, out, dim) => needleEmbed(text, out, dim),
    reset: () => needleReset(),
    allocBuffer: (n) => koffi.alloc('char', n),
    allocFloats: (n) => koffi.alloc('float', n),
    // koffi.decode(ptr, 'string') would deref the pointer as char**; the
    // correct read of a raw char buffer is 'char' + length, NUL-trimmed.
    decodeString: (ptr, n) => {
      const bytes = Buffer.from(koffi.decode(ptr, 'char', n));
      const end = bytes.indexOf(0);
      return bytes.subarray(0, end === -1 ? bytes.length : end).toString('utf8');
    },
    decodeFloats: (ptr, n) => koffi.decode(ptr, 'float', n),
  };
  return _engine;
}

/** The currently bound agent (needle_init is engine-global, like Python's). */
let _active = null;

function bindAgent(agent) {
  const e = engine();
  if (_active === agent) return e;
  if (e.init(agent.systemText, agent.toolsJson, null) < 0) {
    _active = null;
    throw new Error('neuralOS: needle_init failed');
  }
  _active = agent;
  return e;
}

module.exports = { engine, bindAgent, platformKey, platformPackageDir, PLATFORM_PACKAGES };
