# @cassida/next-plugin

Next.js integration for Cassida. One-line drop-in for `next.config.js` that wires up the SWC plugin, the IR-comment loader, the `@layer cas` virtual CSS module, and the optional plugin registry.

**Status: Phase 1 scaffold.** Currently exports the `withCassida()` API surface and the `NextCassidaOptions` type. The actual integration lands in subsequent commits.

## Install

```bash
pnpm add @cassida/next-plugin @cassida/core
```

`@cassida/next-plugin` depends transitively on `@cassida/swc-plugin`, `@cassida/parser`, and `@cassida/compiler`. Optional plugins (`@cassida/plugin-hover-fix`, `@cassida/plugin-conditional`, `@cassida/plugin-print`, `@cassida/plugin-global-css`) are lazy-loaded — they're only required if you enable them via `options.plugins`.

## Usage

```js
// next.config.js
import { withCassida } from '@cassida/next-plugin';

export default withCassida(
  {
    // ordinary next config
    reactStrictMode: true,
    experimental: { typedRoutes: true },
  },
  {
    // cassida options (all optional)
    layer: 'cas',
    hash: { prefix: 'cas-', length: 8 },
    shorthand: { policy: 'strict' },

    // Enable optional plugins
    plugins: {
      hoverFix: true,
      conditional: { shortCircuit: true },
      print: false, // skip the @media print preflight
      globalCss: { preflight: './styles/preflight.css' },
    },

    // Auto-discover tsconfig path aliases (default true)
    pathAliases: true,
  },
);
```

`withCassida()` returns the same `next.config` object, augmented with the SWC plugin registration, webpack/turbopack rules, and any other glue the requested options imply.

## Why a dedicated Next.js wrapper

`@cassida/swc-plugin` alone is just the AST transform; it needs a Node-side post-pass to compile the emitted IR into class names and to bundle the resulting CSS. `@cassida/next-plugin` is that glue, packaged as a one-line config wrapper so consumers don't manually hand-edit `experimental.swcPlugins`, `webpack.module.rules`, or `experimental.turbo.rules`.

It also ships the App Router (RSC) guard that warns when a `cas()` call would land in a Server Component runtime, the lazy plugin loader so you only require what you enable, and the standard `@layer cas` CSS bundle endpoint.

## License

MIT
