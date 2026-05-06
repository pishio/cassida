/**
 * Post-build assertions for the e2e consumer.
 *
 * Each check fails the process with a non-zero exit code and a clear
 * message. The CI workflow runs this after `vite build` and treats
 * any failure as a regression of the v0.1.1 hardening work.
 *
 * What we verify:
 *
 *   1. Build artifacts exist (sanity)
 *   2. CSS contains a Cassida-prefixed class — the parser actually
 *      hashed the chain at build time
 *   3. CSS contains the @layer wrapper — emitter contract
 *   4. JS bundle does NOT contain `createHash`, `compileOps`,
 *      `defaultRegistry`, or any `node:` import string — tree-shake
 *      removed the runtime, no Node-only API leaked into the browser
 *   5. JS bundle does NOT contain a literal `cas(` runtime call —
 *      the parser converted every spread to a className literal
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath` rather than `.pathname` — on Windows the URL path is
// `/C:/...` which path.resolve misinterprets as POSIX-rooted. CI runs
// on Ubuntu, but contributors may run this script locally on Windows.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const ASSETS = join(DIST, 'assets');

let failures = 0;
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  failures++;
};
const pass = (msg) => console.log(`  ✓ ${msg}`);

if (!existsSync(DIST) || !existsSync(ASSETS)) {
  fail(`dist/assets missing at ${ASSETS}`);
  process.exit(1);
}

const files = readdirSync(ASSETS);
const cssFiles = files.filter((f) => f.endsWith('.css'));
const jsFiles = files.filter((f) => f.endsWith('.js'));

if (cssFiles.length === 0) fail('no CSS chunk emitted');
if (jsFiles.length === 0) fail('no JS chunk emitted');

const css = cssFiles
  .map((f) => readFileSync(join(ASSETS, f), 'utf8'))
  .join('\n');
const js = jsFiles
  .map((f) => readFileSync(join(ASSETS, f), 'utf8'))
  .join('\n');

console.log(`CSS bytes: ${css.length}`);
console.log(`JS  bytes: ${js.length}`);

// 2. CSS contract
if (!/\.cas-[0-9a-f]{8}\b/.test(css)) {
  fail('CSS missing a `.cas-XXXXXXXX` class — parser may not have run');
} else {
  pass('CSS contains compiled cas-class selectors');
}

// 3. @layer wrapper
if (!/@layer\s+\w+\s*\{/.test(css)) {
  fail('CSS missing `@layer` wrapper — emitter contract violated');
} else {
  pass('CSS wrapped in @layer');
}

// 4. JS purity — no Cassida runtime, no Node-only APIs
const forbidden = [
  ['createHash', 'node:crypto leaked into the bundle'],
  ['node:crypto', 'node:crypto string literal leaked'],
  ['compileOps', 'compiler runtime leaked'],
  ['defaultRegistry', 'registry data table leaked'],
  ['canonicalSpec', 'csstype-derived spec leaked'],
];
for (const [needle, msg] of forbidden) {
  if (js.includes(needle)) fail(`${msg} (found "${needle}" in JS)`);
}
if (failures === 0) pass('JS bundle free of Cassida runtime and Node APIs');

// 5. cas() runtime call must be gone — parser should have replaced
// every spread with a `className` literal.
const casCallMatches = js.match(/\bcas\s*\(/g) ?? [];
if (casCallMatches.length > 0) {
  fail(`JS bundle still contains ${casCallMatches.length} runtime cas( call site(s)`);
} else {
  pass('JS bundle contains no runtime cas() invocations');
}

if (failures === 0) {
  console.log(`\n✓ All e2e assertions passed`);
  process.exit(0);
}
console.error(`\n✗ ${failures} assertion(s) failed`);
process.exit(1);
