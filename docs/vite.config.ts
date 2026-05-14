import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cassida from '@cassida/vite-plugin';
import { recommended } from '@cassida/recommended';
import { cassidaGlobalCss } from '@cassida/plugin-global-css';
import { printPreflight } from '@cassida/plugin-print';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const preflight = readFileSync(
  fileURLToPath(new URL('./public/preflight.css', import.meta.url)),
  'utf8',
);

// Bundle the screen preflight + print preflight into one virtual
// module so the entry file imports a single stylesheet. The print
// rules are already wrapped in @media print so they stay inert at
// screen render.
const globalCss = `${preflight}\n${printPreflight()}`;

export default defineConfig({
  // Project page under pishio/cassida → all assets resolve under /cassida/.
  base: '/cassida/',
  plugins: [
    cassida(recommended()),
    cassidaGlobalCss({ css: globalCss, layer: 'base' }),
    react(),
  ],
  ssr: {
    // vite-react-ssg internally imports `react-helmet-async@1` (CJS,
    // no `type: module`), which Node ESM can't resolve through pnpm's
    // symlink layout in the SSR temp dir. Force-bundling it via
    // noExternal makes the SSR step run cleanly.
    noExternal: ['react-helmet-async'],
  },
  ssgOptions: {
    // `nested` produces `/en/index.html`, `/ja/index.html`, …
    // pretty URLs that GitHub Pages serves cleanly without
    // trailing-slash redirects.
    dirStyle: 'nested',
    // Beasties inlines critical CSS — useful but adds build cost.
    // Keep enabled; toggle off if build time becomes an issue.
  },
});
