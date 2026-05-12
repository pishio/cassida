# @cassida/plugin-global-css

Vite plugin that serves arbitrary global CSS — preflight, resets, body
or tag-selector rules — to a Cassida-powered app through a virtual
module, wrapped in a configurable `@layer` so it composes cleanly with
Cassida's single-class output.

Cassida's chains always emit exactly one class per element; there is no
built-in escape hatch for rules like `body { ... }` or
`*, ::before, ::after { ... }`. This plugin fills that gap without
introducing a second styling system.

## Install

```bash
pnpm add -D @cassida/plugin-global-css
```

The plugin declares Vite as a peer dependency
(`vite ^5 || ^6 || ^7`).

## Use

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { cassida } from '@cassida/vite-plugin';
import { cassidaGlobalCss } from '@cassida/plugin-global-css';
import { recommended } from '@cassida/recommended';
import preflight from './preflight.css?raw';

export default defineConfig({
  plugins: [
    cassida(recommended()),
    cassidaGlobalCss({ css: preflight, layer: 'base' }),
  ],
});
```

```ts
// main.tsx
import 'virtual:cassida-global.css';
```

The default `@layer base` wrap pairs with the cascade declaration

```css
@layer base, cas;
```

(emit this once near the top of your entry file, or rely on the order
Vite generates) so Cassida's single-class rules in `@layer cas` always
beat preflight without `!important` or specificity bumps.

## Options

| Option      | Type                          | Default                              |
| ----------- | ----------------------------- | ------------------------------------ |
| `css`       | `string`                      | *(required)*                         |
| `layer`     | `string \| null`              | `'base'`                             |
| `virtualId` | `string`                      | `'virtual:cassida-global.css'`       |

- `layer: null` skips the `@layer` wrap. The CSS then lives at the
  document-default layer, which ranks above any layered rules — almost
  always *not* what you want against Cassida. Use it only when you
  understand the cascade consequences.
- `virtualId` lets you mount multiple instances of the plugin (e.g. one
  for preflight, one for print). Each instance must have a distinct id;
  import each id explicitly from your entry.

## Companion: `@cassida/plugin-print`

If you want CSS-mania-grade print styling for free, pair this plugin
with `@cassida/plugin-print`:

```ts
import { cassidaGlobalCss } from '@cassida/plugin-global-css';
import { printPreflight } from '@cassida/plugin-print';

cassidaGlobalCss({
  css: printPreflight(),
  layer: 'base',
  virtualId: 'virtual:cassida-print.css',
});
```

## License

MIT © pishio
