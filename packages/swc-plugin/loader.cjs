'use strict';

// CommonJS resolver for the WASM artefact. Consumers should prefer the
// ESM entry below; this file exists so `require()` from CJS Node code
// (older toolchains, some Jest setups) still returns a usable
// `wasmPath` string. Both entries point at the same .wasm shipped in
// the package's `dist/` directory.
const path = require('node:path');
module.exports.wasmPath = path.join(
  __dirname,
  'dist',
  'cassida_swc_plugin.wasm',
);
