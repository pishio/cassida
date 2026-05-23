# @cassida/swc-plugin

SWC plugin (WASM) for Cassida. Detects `cas()` chains in JSX spreads, walks them into an `Op[]` IR, and emits the IR as a comment annotation that `@cassida/next-plugin` picks up and compiles against `@cassida/compiler` in a Node post-pass.

**Status: Phase 1 scaffold.** The current build ships a no-op transform. Subsequent releases will fill in the chain walker, modifier scopes, `.set()` / `.unsafe()` escape hatches, and JSX rewrite. See `.claude/plans/swc-port-phase-1.md` (local to maintainers) for the full design.

## Why a SWC plugin

`@cassida/parser` (Babel-based) and `@cassida/vite-plugin` together give Vite users the full zero-runtime experience. Next.js's transform pipeline is SWC; injecting a Babel pass adds significant build cost. This package mirrors the Babel parser's behaviour in Rust so Next.js (Webpack + Turbopack) users get the same output without paying a Babel tax.

## Architecture

The plugin emits an IR-as-comment, not a finished class name. A companion Node loader in `@cassida/next-plugin` reads the comment, calls `compileOps()` from `@cassida/compiler`, and substitutes the resulting `cas-XXXXXXXX` class. This keeps the compiler and hash function single-sourced in JS — Babel-parsed and SWC-parsed files always produce identical class names for the same chain.

## Install

```bash
pnpm add -D @cassida/swc-plugin @cassida/next-plugin
```

Then in `next.config.js`:

```js
import { withCassida } from '@cassida/next-plugin';

export default withCassida({ /* normal next config */ }, {
  /* cassida options */
});
```

You do not register `@cassida/swc-plugin` directly — `withCassida()` wires it into `experimental.swcPlugins` for you.

If you need the WASM path from JS (custom build setup, SWC CLI usage, esbuild, etc.):

```js
// ESM
import { wasmPath } from '@cassida/swc-plugin/loader';

// CJS
const { wasmPath } = require('@cassida/swc-plugin/loader');
```

The package's `main` field also points at the WASM directly for SWC's built-in `require.resolve()` lookup of `swcPlugins: [['@cassida/swc-plugin', ...]]` shorthand.

## Development

Requires Rust 1.91+ (`rust-toolchain.toml` at the repo root pins this) and the `wasm32-wasip1` target.

```bash
pnpm build       # cargo build --release --target wasm32-wasip1
pnpm test        # cargo test (native target)
pnpm lint        # cargo clippy
pnpm fmt         # cargo fmt --check
```

## License

MIT
