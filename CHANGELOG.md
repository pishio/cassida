# Changelog

All notable changes to Cassida are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). All packages under the `@cassida/` scope are versioned in lockstep.

## [Unreleased]

### Changed

- **`@cassida/next-plugin` per-compiler rule store** — replaces v0.8.0's module-singleton store, resolving the documented Phase 1.x multi-compiler race. The store is now keyed by the parent webpack `Compiler` (via `WeakMap<Compiler, Map<filename, rules>>`), populated through `this._compilation.compiler` in the IR loader and drained through the captured `compiler` argument in `CassidaWebpackPlugin.processAssets`. Keying by `Compiler` instead of `Compilation` matters because Next.js spawns child compilations off the main Compiler for CSS extraction and similar passes — the IR loader and the plugin can otherwise disagree on which bag to use (loader writes into child, plugin reads on parent). Server- and Client-compiler writes can no longer collide; the previous failure mode (Client `processAssets` emitting CSS before Server loader passes complete, dropping Server-only styles from the Client bundle) is structurally impossible. New isolation + parent-child aggregation tests in `webpack-plugin.test.ts` lock the contract in.

### Removed

- **`CASSIDA_QUIET_RACE_WARNING` env var** — the v0.8.0 empty-store stderr heads-up no longer fires; the race it muted is structurally gone. Setting the variable is now a no-op (kept silent rather than warning, so consumers who already wired it can leave the env alone).
- **`subscribe` / `subscribeToRules` export from `@cassida/next-plugin`** — the subscription API was vestigial after v0.8.0 dropped HMR-side reuse of it, and per-compilation isolation makes a global subscriber even less useful. `allRules(compilation)` is now exported in its place for advanced wiring.

## [0.8.0] — 2026-05-29

### Added

- **`@cassida/swc-plugin` and `@cassida/next-plugin` scaffolds** — two new workspace packages laying the groundwork for Next.js (App Router included) integration via a Rust-authored SWC plugin. Phase 1 ships the no-op plugin transform and the `withCassida()` config wrapper API surface; subsequent commits fill in the chain walker, IR-comment loader, and CSS pipeline. Architecturally the plugin emits the existing `Op[]` IR as a comment annotation that the Node-side loader feeds to `@cassida/compiler`, so Babel-parsed and SWC-parsed files hash to identical class names. Both packages are marked private until Phase 1 is feature-complete.
- **`@cassida/swc-plugin` chain walker + JSX rewrite** — the Rust SWC plugin now lifts `{...cas().X().props}` JSX spreads. The walker handles literal-arg method ops, canonical modifier scopes (`.hover`, `.before`, etc.), arg modifiers (`.media`, `.on`), `.set(prop, value)`, the trailing `.props` terminator, default / named / aliased imports of `@cassida/core`, and a broad parity surface with the Babel parser (`UnaryOp::Minus`/`Plus`/`Bang` on literal operands, parens at every step, `tpl` cooked strings, JS safe-integer range for numeric coercion, kebab-case `camelToKebab` matching Babel exactly). 48 unit tests cover the IR JSON shape, modifier table, walker, and visitor.
- **`@cassida/next-plugin` IR-comment loader + virtual CSS** — first end-to-end wiring of the Next.js path. `withCassida(nextConfig, options)` registers `@cassida/swc-plugin`'s WASM in `experimental.swcPlugins`, injects a webpack loader that scans `/* @cassida-ir:JSON */ "__CAS_PLACEHOLDER_N__"` pairs in transformed sources, calls `compileOps` to mint real class names, accumulates the rules in a module-singleton store, and exposes the aggregated `@layer cas` CSS via `buildVirtualCss()`. Function-form `next.config.js` is supported by wrapping the user function so options apply to its resolved config.
- **`CassidaWebpackPlugin` virtual CSS module** — consumers can now `import '@cassida/next-plugin/virtual.css'` from `app/layout.tsx`. The plugin registers the path via `webpack-virtual-modules` and rewrites its content twice per compilation: a placeholder seed at `compiler.hooks.thisCompilation`, then the real `buildVirtualCss()` output at `compilation.hooks.processAssets` (stage `PRE_PROCESS`, after the IR loader has populated the store and before CSS minifiers run). Dev / HMR re-writes via a `store.subscribe()` listener attached on `watchRun`. Next.js's CSS pipeline handles chunking, minification, and Server / Client Component delivery.
- **`e2e/next-app/` fixture + `consumer-next` CI job** — Phase 1 closing signal. Mirrors the existing Vite consumer: a minimal Next.js 15 App Router app with `withCassida` configured, a Server Component (`server-only.tsx`) and a `'use client'` page exercising static chains, modifier scopes, and dynamic values. The post-build `assert.mjs` verifies six contracts on the `.next/` output (CSS `@layer cas`, rendered `class="cas-XXXXXXXX"` attributes, no `cas(` runtime calls in client chunks, no placeholder leakage, no compiler runtime leak). The CI workflow installs the cassida tarballs (including the WASM-bundled `@cassida/swc-plugin`) and runs `next build` + assertions in matrix leg `next: 15`. Phase 1.5 will add Turbopack and the previous Next.js 14 leg back.
- **`@cassida/swc-plugin` dual-WASM build** — ships two ABI-pinned WASM artefacts side by side. `wasmPath` / `wasmPathModern` (`dist/cassida_swc_plugin.wasm`) is built against swc_core 66.x for Rspack, @swc/core mainline, swc-loader, swc-node, and @vitejs/plugin-react-swc. `wasmPathNext` (`dist/cassida_swc_plugin.next.wasm`, exported at the `./next` subpath) is built against swc_core 35.0.0 for the `@next/swc` binary shipped in Next.js 15.x. `@cassida/next-plugin` consumes the Next-targeted build. The split exists because the SWC plugin ABI is version-bound to the host's swc_core, and shipping only the modern build manifested as `failed to invoke plugin` on every file inside Next.js 15. A new `cassida_swc_plugin_next` Rust crate mirrors the source of `cassida_swc_plugin`; six `Atom::as_str()` call sites are adapted because the return type widened from `&str` to `Option<&str>` between swc_core 35 and 66.
- **`CassidaWebpackPlugin` empty-store heads-up** — in production builds the plugin now writes a stderr line when `processAssets` fires with no rules registered. This is the user-visible signal that the documented Phase 1.x multi-compiler race (Server compiler populates the store after the Client compiler's `processAssets`) actually fired in a real build — without it Server-only styles silently fall out of the Client bundle. The check is gated on `NODE_ENV === 'production'` so dev / test runs stay quiet; consumers with legitimately empty fixtures can mute via `CASSIDA_QUIET_RACE_WARNING=1`.

## [0.7.0] — 2026-05-21

### Added

- **TypeScript path-alias resolution in cross-file eval** — `import { theme } from '@/tokens'` now folds at build time when the project declares `compilerOptions.paths` in `tsconfig.json`. The Vite plugin auto-discovers paths via the new `loadTsconfigPaths(projectRoot)` helper; `extends` chains are followed the whole way up (cycles guarded), with each config's paths anchored against its own `baseUrl`. Override or disable through the plugin's new `pathAliases` option (`PathAliases | false`). Standalone consumers of `@cassida/parser` can pass `pathAliases` directly to `transform()` or call `loadTsconfigPaths` themselves.

## [0.6.0] — 2026-05-20

### Changed

- **`.cond()` lifted inside modifier scopes** — chains like `cas().hover(c => c.cond(active, t => t.bg('red'), f => f.bg('blue')))` now expand to two build-time classes (one for each branch) instead of bailing to the runtime. The Cartesian expansion descends into scoped ops, and `buildBranchedExpr` handles leaves with variable conditions length when a `.cond()` lives inside only one branch of an outer `.cond()`. The `[Limitations]` entry from `0.4.0` is resolved; `.cond()` inside function composition (`withCard(cas())`) still bails.
- **Dynamic args on multi-property utilities** — `cas().px(theme.spacing)` (and `.py` / `.mx` / `.my`) now compile at build time. The canonicalizer seeds every longhand the entry expands to with the same source id, so the parser emits one CSS variable per longhand bound to the same source expression — `style={{ '--cas-X-padding-inline-start': theme.spacing, '--cas-X-padding-inline-end': theme.spacing }}`. `defaultPropertyMeta` now also seeds the longhands of every multi-property canonical entry so `@property` descriptors emit for the CSS variables on both halves. The `[Limitations]` entry from `0.4.0` is resolved.

## [0.5.0] — 2026-05-14

### Added

- **`@cassida/plugin-print`** — `printPreflight()` returns a CSS string of conservative `@media print` defaults. Ink-saving black-on-white, external link URL expansion with `overflow-wrap: break-word`, abbreviation expansion via `<abbr title>`, media width clamp covering `img` / `svg` / `video` / `canvas` with `height: auto`, page-break hygiene for `pre` / `blockquote` / `tr` / `h1`–`h6`, `p` / `li` orphans + widows: 2, and `thead` / `tfoot` repetition across page boundaries. Adapted from the HTML5 Boilerplate print subset (MIT). Cascade-layer-aware (no `!important`), so Cassida classes in `@layer cas` override the defaults cleanly.

## [0.4.0] — 2026-05-14

### Added

- **`@cassida/plugin-global-css`** — first-party Vite plugin that serves arbitrary global CSS (preflight, resets, body / tag-selector rules) through a virtual module, wrapped in a configurable cascade `@layer`. Pairs with the `@layer base, cas;` declaration so Cassida classes win without specificity tricks.
- **Multi-property utilities** — hand-crafted `px`, `py`, `mx`, `my` chain methods write two logical longhands per call (`padding-inline-start/end`, `padding-block-start/end`, `margin-inline-start/end`, `margin-block-start/end`). Per-longhand LIFO collapse and full participation in the `shorthand-policy` guard as longhands of the parent `padding` / `margin` family.
- **`.cond(test, truthy, falsy?)` chain method** — chain-internal branching. At build time the Cartesian product of branches materializes into N classes (cap 32); the JSX `className` becomes a balanced nested ternary. Runtime evaluates `test` eagerly and inlines the picked branch's ops so its hash matches the corresponding build-time leaf byte-for-byte.

### Changed

- **`@cassida/plugin-conditional` v2: dynamic-slot branches** — earlier versions bailed when either branch carried a dynamic slot. v0.4 keeps the build-time path active: dynamic branches emit a parallel branch-conditional `style={...}` ternary that mirrors the className shape. Branches without dynamics contribute `void 0`.
- **Registry contract widened** — `Formatter` now returns `string | StyleBag`; `RegistryEntry` gains optional `properties: readonly string[]` for multi-property entries. Existing single-property entries are byte-identical.
- **Parser-plugin helpers expanded** — `getDynamicSource(sourceId)` exposes the source AST behind a compiled `DynamicSlot`; `mergeStyleExpression(existing, pluginExpr, casWins)` is a generalized counterpart to `makeStyleAttr` that accepts any expression. `ExistingHostAttrs` gains `casWins: boolean` so plugin-emitted style merges honor JSX source-order precedence.

### Limitations

- `.cond()` inside modifier scopes (`.hover(c => c.cond(...))`) currently bails to runtime — Phase 2 will lift this.
- Dynamic args on multi-property entries (`cas().px(theme.spacing)`) bail at build time; pass a literal or use the underlying `.paddingInline(...)` / `.paddingBlock(...)` for dynamic values.

## [0.3.0] — 2026-05-12

### Added

- **`.props` JSX terminator** — every chain ends with `.props` and yields `{ className: string; style: Readonly<CSS.Properties> }`. Strips the chain's ~460 method handles from the spread shape, so React's strict JSX typings (`translate`, `disabled`, `color`, `width`, `height`, ...) accept the spread under `tsc --noEmit`. End-to-end CI now runs `tsc --noEmit` against the consumer fixture on every Vite leg.

### Changed

- `CassChainProps` is the new exported type for the spread shape.
- `CassChainTerminus` surfaces `.props` instead of bare `style` / `className`.
- `.props` is defined on every chain (root and inner) and memoized by `ops.length`, so repeated reads on the same finalized chain skip the canonicalize pass and preserve identity for `React.memo` comparisons.
- Parser peels a trailing `.props` member access via a `peelPropsAccess` helper; output is byte-identical to the bare-chain form, so v0.2 codebases continue to compile while they migrate.

## [0.2.0] — 2026-05-11

### Added

- **Cross-file static evaluation** — design tokens defined in a separate module or `.json` file fold into static class hashes at build time. The parser walks `import` declarations from the file at `filename`, evaluates the import chain (supports JSON, destructured exports, re-export chains), and inlines the resolved value into the chain's canonical bag.
- **`createModuleCache()`** for amortizing parse work across many files during a Vite build. The vite-plugin wires this in automatically.

## [0.1.1] — 2026-05-06

### Fixed

- **Universal resolver hardening** — `sideEffects: false` on every published package so bundlers can drop unused entries. Pure-JS MurmurHash3 implementation (no `node:crypto` dependency) for browser / Bun / Edge runtime compatibility. `exports` map cleanup so consumers can import without resolution surprises.
- e2e CI builds a real consumer against the tarballs on Vite 5 / 6 / 7 and Bun.

## [0.1.0] — 2026-04-30

### Added

- Initial public release of `@cassida/core`, `@cassida/compiler`, `@cassida/parser`, `@cassida/vite-plugin`, `@cassida/recommended`, `@cassida/plugin-hover-fix`, `@cassida/plugin-conditional`. Single Class Principle, LIFO collapse, build-time class table, deterministic hashing, mobile-first media sort, `@layer cas` cascade-layer wrapping, csstype-typed canonical chain methods + mdn-data-derived generated chain methods, `cas.unsafe` / `.set` escape paths, `shorthand-policy` guard.

[Unreleased]: https://github.com/pishio/cassida/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/pishio/cassida/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/pishio/cassida/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/pishio/cassida/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/pishio/cassida/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/pishio/cassida/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/pishio/cassida/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pishio/cassida/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/pishio/cassida/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pishio/cassida/releases/tag/v0.1.0
