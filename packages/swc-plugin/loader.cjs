'use strict';

// CommonJS resolver for the WASM artefacts. Consumers should prefer
// the ESM entry; this file exists so `require()` from CJS Node code
// (older toolchains, some Jest setups) still returns a usable path.
// See `loader.mjs` for the modern-vs-next distinction.
const path = require('node:path');
const wasmPath = path.join(__dirname, 'dist', 'cassida_swc_plugin.wasm');
module.exports.wasmPath = wasmPath;
module.exports.wasmPathModern = wasmPath;
module.exports.wasmPathNext = path.join(
  __dirname,
  'dist',
  'cassida_swc_plugin.next.wasm',
);
