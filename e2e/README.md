# e2e — published-tarball smoke test

A consumer outside the workspace that installs the `@cassida/*`
packages from freshly built tarballs and runs `vite build` against
them. Mirrors what an end user gets when they `npm install
@cassida/vite-plugin`.

This catches the entire "works in workspace, breaks on npm" class of
regressions — the failure mode that caused v0.1.0 to ship a build
that died on `node:crypto` for any consumer outside the monorepo.

## What it verifies

After build:

- A `.cas-XXXXXXXX` selector appears in the emitted CSS — the parser
  ran, the canonicalizer produced a class, the emitter wrote it
- The CSS is wrapped in `@layer …` — emitter contract
- The JS bundle contains **no** `createHash`, `node:crypto`,
  `compileOps`, `defaultRegistry`, or `canonicalSpec` — the tree-shake
  removed every Cassida runtime symbol and no Node-only API leaked
- The JS bundle contains **no** runtime `cas(` invocations — the
  parser converted every spread to a className literal

## Layout

```
e2e/
├── consumer/             ← the test app (pristine package.json)
│   ├── package.json      ← deps installed at CI / local-run time
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   └── App.tsx       ← exercises static + modifier + dynamic chains
│   ├── scripts/
│   │   └── assert.mjs    ← post-build assertions
│   └── tsconfig.json
├── run-local.sh          ← local mirror of the CI workflow
└── README.md             ← this file
```

## Running locally

```bash
./e2e/run-local.sh        # defaults to Vite 7
./e2e/run-local.sh 5      # Vite 5
./e2e/run-local.sh 6      # Vite 6
```

Each run:

1. Builds every `@cassida/*` package
2. Packs them as tarballs into `e2e/.tarballs/`
3. Installs the tarballs into `e2e/consumer/` together with the
   selected Vite + plugin-react versions (using `npm`, not `pnpm` —
   pnpm's content-addressable store keys by `name@version` and would
   reuse cached `0.1.0` content instead of unpacking the freshly
   built tarball, hiding the very regressions this exists to catch)
4. Runs `vite build`
5. Runs `node scripts/assert.mjs`

## CI workflow

`.github/workflows/e2e.yml` runs the same flow on every push to main
and every pull request. Matrix:

- Vite 5 + plugin-react 4
- Vite 6 + plugin-react 5
- Vite 7 + plugin-react 5
- Bun (resolver canary, builds with Vite 7)
