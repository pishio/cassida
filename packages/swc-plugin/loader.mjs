// ESM resolver for the WASM artefact. Consumers should import
// `wasmPath` from here and pass it to whatever expects a plugin path
// (Next.js's `experimental.swcPlugins`, SWC's CLI, etc.). Pairs with
// the CommonJS sibling for dual-format consumption.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export const wasmPath = path.join(here, 'dist', 'cassida_swc_plugin.wasm');
