# Contributing to Cassida

Thanks for the interest. This document covers the environment setup, the development loop, the conventions the codebase follows, and the release process. For the underlying philosophy (Single Class Principle, LIFO collapse, shorthand-policy), see the [README](./README.md) and the [docs site](https://pishio.github.io/cassida/).

## Prerequisites

- **Node.js ≥ 20** (the e2e CI matrix builds against current Node LTS)
- **pnpm 10.33+** (declared as `packageManager` in the root `package.json` — `corepack enable` is the easiest way to match)

The repo is a pnpm workspace. There are no submodules, native bindings, or codegen steps that run on install — `pnpm install` is enough to get going.

## Repo layout

```
packages/
├── core/                 runtime cas() chain + typed CassChain
├── compiler/             registry, canonicalizer, hasher, emitter
├── parser/               Babel-based JSX transform; parser-plugin extension point
├── vite-plugin/          Vite integration (per-file virtual CSS module)
├── recommended/          curated bundle (hover-fix + conditional)
├── plugin-hover-fix/     CSS plugin: gate :hover behind @media (hover: hover)
├── plugin-conditional/   parser plugin: lift conditional spreads to build time
├── plugin-global-css/    Vite plugin: serve preflight CSS through a virtual module
└── plugin-print/         printPreflight() — @media print defaults
examples/playground/      vite + react app; end-to-end verification
docs/                     bilingual docs site (vite-react-ssg, deployed to GitHub Pages)
e2e/                      CI consumer fixtures (vite 5 / 6 / 7, bun)
```

## Common commands

```bash
pnpm install
pnpm -r --filter='./packages/*' build       # build every published package
pnpm -r --filter='./packages/*' test        # vitest across all packages
pnpm -r typecheck                            # tsc strict across packages + tests
pnpm --filter ./examples/playground build    # E2E playground build
pnpm --filter ./docs build                   # docs site (vite-react-ssg)
pnpm --filter ./docs dev                     # docs site dev server (http://localhost:5173/cassida/)
```

`packages/compiler` ships a code-generated property spec derived from `mdn-data`. The generated file is committed; regenerate only when bumping `mdn-data`:

```bash
pnpm --filter @cassida/compiler codegen
```

## Development workflow

1. Branch off `main`. Use a descriptive prefix (`feat/`, `fix/`, `docs/`, `chore/`, `refactor/`).
2. Make your change. **Tests are required for new behavior.** Type-only assertions live in `*.test-d.ts` files — Vitest's runtime skips them, but `tsc -p tsconfig.typecheck.json` picks them up.
3. Run the full sweep before pushing:
   ```bash
   pnpm -r --filter='./packages/*' build
   pnpm -r typecheck
   pnpm -r --filter='./packages/*' test
   ```
4. For UI / docs changes, also run `pnpm --filter ./docs build` (or the playground equivalent) and visually inspect.
5. Push the branch and open a PR. **Gemini Code Assist** is configured as the automated reviewer — it fires once automatically. After fixup commits, post a comment containing `/gemini review` to trigger a re-review against the latest HEAD. Other slash commands the bot understands: `/gemini summary`, `/gemini help`.
6. Address review feedback in additional commits (don't squash — squashing happens at merge). When you've answered all open threads, request final review or merge if you have the rights.

## Conventions

### TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `verbatimModuleSyntax: true` are enforced repo-wide. The lints are not advisory — they catch real bugs.
- Use the canonical method names in source code (`marginTop`, `backgroundColor`) — the runtime aliases (`mt`, `bg`) exist for ergonomics but are intentionally absent from `CassChain`'s typed surface.
- For UI / app code, prefer `cas()` chains in JSX-spread position so the parser can resolve them at build time.

### Commit messages

- Imperative voice, present tense (`add foo`, not `added foo` or `adds foo`).
- One concept per commit. PRs may bundle related commits, but each commit should be reviewable on its own.
- Conventional prefix encouraged but not required: `feat(scope):`, `fix(scope):`, `docs(scope):`, `chore(scope):`, `refactor(scope):`, `test(scope):`.
- **Never include AI-attribution trailers** (`Co-Authored-By: Claude …`, "Generated with …" lines). The maintainer prefers clean, human-toned commit history.

### Code style

- **No comments unless the *why* is non-obvious.** Well-named identifiers carry the *what*; comments are reserved for hidden constraints, subtle invariants, and workarounds for specific bugs.
- **No defensive boilerplate for impossible scenarios.** Trust internal invariants; validate only at system boundaries (user input, external APIs).
- **No premature abstractions.** Three similar lines beats a generic helper. Half-finished refactors get caught in review.

## Adding a new package

The existing packages are good templates. Quick checklist:

1. `mkdir packages/<name>` and copy the scaffolding from a small comparable package (`plugin-hover-fix`, `plugin-print`).
2. `package.json`: `"name": "@cassida/<name>"`, `"version"` matching the current monorepo version, `"sideEffects": false`, `"type": "module"`, `exports` map (`.`: types/import/default + `./package.json`). Mirror the `scripts` block — `build`, `test`, `typecheck`, `prepublishOnly`.
3. `tsconfig.json` and `tsconfig.test.json` extending `../../tsconfig.base.json`.
4. `src/index.ts`, `test/<name>.test.ts`, `README.md`.
5. Add the package to the root `README.md` packages table and (if it surfaces user-visible behavior) to the docs site.

## Release process

All `@cassida/*` packages are versioned in lockstep — `pnpm -r` bumps them together.

1. **Branch**: `release/vX.Y.Z` off `main`.
2. **Bump every `package.json`** under `packages/` to the new version. (A small script lives in maintainers' memory; manual edits are equally fine.)
3. **Update `CHANGELOG.md`** with an entry for the new version (Added / Changed / Fixed sections). Move the `[Unreleased]` link target forward at the bottom.
4. **Update `README.md`** status section if the headline features have shifted.
5. Run the full sweep + the playground E2E build to confirm the published artifacts behave.
6. Open the release PR; merge after review.
7. **Publish**: `pnpm -r --filter='./packages/*' publish --access public --no-git-checks`. Requires an npm Granular Access Token with publish rights for the `@cassida` scope.
8. **Tag**: `git tag vX.Y.Z <merge-commit-sha> && git push origin vX.Y.Z`.
9. **GitHub Release**: `gh release create vX.Y.Z --title "vX.Y.Z — <headline>" --notes-file <draft>`. The docs site `docs.yml` workflow redeploys on every push to `main`, so the live docs already reflect the merged state.

## Plugin authoring

Cassida exposes two distinct extension points:

- **CSS plugins** (`CassPlugin`) operate post-canonicalize on the `ScopeBag` tree. They mutate the rule structure — wrap scopes, expand pseudo-classes, prefix vendor properties. `@cassida/plugin-hover-fix` is the canonical example.
- **Parser plugins** (`CassParserPlugin`) operate pre-canonicalize on Babel paths. They recognize JSX-spread shapes the default chain walker doesn't claim and produce rewrites. `@cassida/plugin-conditional` is the canonical example; the helpers it consumes (`walkChain`, `compileOps`, `peelPropsAccess`, `makeClassNameAttr`, `makeStyleAttr`, `getDynamicSource`, `mergeStyleExpression`) are all part of the public `ParserPluginHelpers` API.

Plugins run between collapse and hash (CSS) or before walk (parser), so flipping a plugin on or off changes hashes and invalidates browser caches cleanly. See the `Plugin authoring` section in the root README for the contract.

## Asking for help

- Bug reports and feature requests: open an issue at https://github.com/pishio/cassida/issues.
- Security concerns: email the maintainer privately at mail@pishio.com instead of filing a public issue.

## License

By contributing, you agree your contributions will be licensed under the [MIT License](./LICENSE).
