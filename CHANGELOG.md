# Changelog

All notable changes to Cassida are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). All packages under the `@cassida/` scope are versioned in lockstep.

## [Unreleased]

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

[Unreleased]: https://github.com/pishio/cassida/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/pishio/cassida/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/pishio/cassida/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/pishio/cassida/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/pishio/cassida/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/pishio/cassida/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/pishio/cassida/releases/tag/v0.1.0
