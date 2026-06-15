/**
 * Post-build assertions for the Next.js e2e consumer.
 *
 * Verifies eight contracts of the SWC-port Phase-1 wiring:
 *
 *   1. Build output exists at `.next/static` + `.next/server/app`
 *   2. CSS contains `@layer cas { ... }` + at least one `.cas-XXXXXXXX`
 *   3. Rendered RSC / HTML carry `class(Name)?="...cas-XXXXXXXX..."`
 *   4. Rendered RSC / HTML carry a `<link rel="stylesheet"
 *      href=".../static/css/...">` whose target exists under
 *      `.next/static/css/` — proves Next.js's CSS-link injection
 *      actually ships the virtual.css output (catches the case where
 *      the import path or exports map regresses and Next.js silently
 *      drops the stylesheet)
 *   5. Client JS chunks contain NO `cas(` / `css(` / `cassida(` runtime
 *      calls — zero-runtime contract
 *   6. NO `__CAS_PLACEHOLDER_<N>__` literal under `.next/` — proves
 *      the IR loader substituted every placeholder
 *   7. Compiler-side runtime didn't leak into the client bundle
 *      (no `compileOps`, `defaultRegistry`, `createHash`, `node:crypto`)
 *   8. Cross-compiler bridge: the server-only root-layout probe's
 *      class (compiled by the server compiler) is present in the
 *      client-shipped `@layer cas` CSS — proves `store.allRules()`
 *      merges the server namespace into the client output
 *
 * Each failure prints a `✗ msg` and increments a counter; we exit
 * non-zero at the end if any fired. The script runs after
 * `next build`.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NEXT_DIR = join(ROOT, '.next');
const STATIC_DIR = join(NEXT_DIR, 'static');
const SERVER_APP_DIR = join(NEXT_DIR, 'server', 'app');

let failures = 0;
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  failures++;
};
const pass = (msg) => console.log(`  ✓ ${msg}`);

/** Recursive file walk — `.next/` is nested by route segment. */
function walk(dir, exts) {
  const out = [];
  if (!existsSync(dir)) return out;
  const exclude = new Set(['cache']);
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (exclude.has(entry)) continue;
      const full = join(cur, entry);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (exts.some((ext) => entry.endsWith(ext))) {
        out.push(full);
      }
    }
  }
  return out;
}

function readAll(files) {
  return files.map((f) => readFileSync(f, 'utf8')).join('\n\n');
}

console.log(`Next.js root: ${NEXT_DIR}`);

// 1. Sanity
if (!existsSync(NEXT_DIR)) {
  fail(`.next/ missing at ${NEXT_DIR}`);
  process.exit(1);
}
if (existsSync(STATIC_DIR)) {
  pass('.next/static exists');
} else {
  fail(`.next/static missing at ${STATIC_DIR}`);
}
if (existsSync(SERVER_APP_DIR)) {
  pass('.next/server/app exists');
} else {
  fail(`.next/server/app missing at ${SERVER_APP_DIR}`);
}

const cssFiles = walk(STATIC_DIR, ['.css']);
const jsClientFiles = walk(join(STATIC_DIR, 'chunks'), ['.js']);
const serverFiles = walk(SERVER_APP_DIR, ['.html', '.rsc']);
const allNextFiles = walk(NEXT_DIR, ['.js', '.css', '.html', '.rsc']);

const cssAll = readAll(cssFiles);
const clientJsAll = readAll(jsClientFiles);
const serverAll = readAll(serverFiles);
const allNextAll = readAll(allNextFiles);

console.log(`CSS files:   ${cssFiles.length} (${cssAll.length} bytes)`);
console.log(`Client JS:   ${jsClientFiles.length} (${clientJsAll.length} bytes)`);
console.log(`Server out:  ${serverFiles.length} (${serverAll.length} bytes)`);

// 2. CSS contract
if (cssFiles.length === 0) {
  fail('no CSS chunks emitted under .next/static');
} else {
  if (/@layer\s+cas\s*\{/.test(cssAll)) {
    pass('CSS contains @layer cas wrapper');
  } else {
    fail('CSS missing @layer cas wrapper');
  }
  if (/\.cas-[0-9a-f]{8}\b/.test(cssAll)) {
    pass('CSS contains compiled .cas-XXXXXXXX selectors');
  } else {
    fail('CSS missing compiled .cas-XXXXXXXX selectors');
  }
}

// 3. Rendered output carries class names
if (serverFiles.length === 0) {
  fail('no .html / .rsc output found under .next/server/app');
} else if (/class(?:Name)?="[^"]*\bcas-[0-9a-f]{8}\b[^"]*"/.test(serverAll)) {
  pass('rendered HTML/RSC carries cas-XXXXXXXX class attributes');
} else {
  fail('rendered HTML/RSC missing cas-XXXXXXXX class attributes');
}

// 4. Next.js's CSS-link injection actually ships virtual.css.
//
// Verifying that CSS files exist under .next/static/css and that the
// rendered class names line up is necessary but not sufficient — if
// the consumer's `import '@cassida/next-plugin/virtual.css'` ever
// regresses (exports-map drift, symlink mismatch, virtual-module
// path collision), Next.js silently emits no <link> for it and the
// browser paints unstyled markup. The CSS file is on disk; nothing
// in the rendered HTML points at it.
//
// So look for the link tag explicitly. App Router prerenders carry
// it as `<link rel="stylesheet" href="/_next/static/css/<hash>.css"
// .../>` in `index.html`, and the RSC payload references the same
// asset path under `"stylesheet"` markers. Match the asset path
// (cross-format: HTML uses unescaped quotes, RSC encodes it inside
// the flight payload) and confirm the file it points at actually
// exists under .next/static/css.
const STYLESHEET_HREF_RE =
  /\/_next\/static\/css\/[A-Za-z0-9_-]+\.css/g;
const stylesheetHrefs = new Set(serverAll.match(STYLESHEET_HREF_RE) ?? []);
if (stylesheetHrefs.size === 0) {
  fail(
    'rendered HTML/RSC missing <link rel="stylesheet"> reference to ' +
      '/_next/static/css/*.css — Next.js did not inject the virtual.css ' +
      'stylesheet (check the layout.tsx import path + exports map)',
  );
} else {
  // Each href must resolve to an actual file under .next/static/css.
  const cssNamesOnDisk = new Set(
    walk(join(STATIC_DIR, 'css'), ['.css']).map((p) => p.split('/').pop()),
  );
  const referenced = [...stylesheetHrefs].map((h) => h.split('/').pop());
  const missing = referenced.filter((name) => !cssNamesOnDisk.has(name));
  if (missing.length > 0) {
    fail(
      `stylesheet <link> references ${missing.length} file(s) absent from .next/static/css: ${missing.join(', ')}`,
    );
  } else {
    pass(
      `rendered HTML/RSC carries <link rel="stylesheet"> for ${referenced.length} on-disk CSS asset(s)`,
    );
  }
}

// 5. Zero-runtime: no bare cas() / css() / cassida() literal calls in
// client chunks. The regex is intentionally narrow — it matches the
// runtime call shape but not the IR JSON's `args:["…"]`, the css class
// strings, or property names. We assert no MATCH at all.
const runtimeCallRe = /(?<![A-Za-z_$])(?:cas|css|cassida)\s*\(/;
if (clientJsAll.length === 0) {
  fail('no client JS chunks found under .next/static/chunks');
} else if (runtimeCallRe.test(clientJsAll)) {
  fail(`client JS contains a runtime chain call: ${
    clientJsAll.match(runtimeCallRe)?.[0]
  }`);
} else {
  pass('client JS contains no runtime cas() / css() / cassida() calls');
}

// 6. No placeholder leakage anywhere under .next
if (/__CAS_PLACEHOLDER_\d+__/.test(allNextAll)) {
  fail('placeholder string leaked into .next — IR loader did not substitute every chain');
} else {
  pass('no __CAS_PLACEHOLDER_ literal anywhere under .next');
}

// 7a. Compiler-runtime purity in the client bundle — symbol grep.
// SWC's prod minifier renames function / const identifiers, so most
// of these become weak signals (`compileOps` → `cO`-style ident).
// `node:crypto` survives because it's a webpack-externalised bare
// specifier left as a string literal in the bundle, so it IS a
// reliable fingerprint for a runtime leak of `@cassida/compiler`
// (which imports `createHash` from `node:crypto`). The rest are
// kept as belt-and-braces against unminified / partial-minify
// configurations.
const leakedSymbols = [
  'compileOps',
  'defaultRegistry',
  'canonicalSpec',
  'createHash',
  'node:crypto',
];
const found = leakedSymbols.filter((s) => clientJsAll.includes(s));
if (found.length > 0) {
  fail(`compiler runtime leaked into client JS: ${found.join(', ')}`);
} else {
  pass('compiler runtime not leaked into client JS (symbol grep)');
}

// 7b. Compiler-runtime purity — size budget. Complements the symbol
// grep above by catching the false-negative case where the minifier
// renamed every checkable identifier. A full `@cassida/compiler`
// leak (canonicalizer + emitter + stylis + registry expansion) adds
// roughly 50–100KB to the client bundle even minified. The budget
// sits ~300KB above the current measured size — enough to absorb
// legitimate React / Next.js dependency drift between releases but
// tight enough to flag a compiler leak. Revisit the constant if
// the fixture grows on its own (`pnpm verify` then rebaseline).
const CLIENT_JS_BUDGET = 1_200_000;
if (clientJsAll.length > CLIENT_JS_BUDGET) {
  fail(
    `client JS size ${clientJsAll.length}B exceeds budget ${CLIENT_JS_BUDGET}B — compiler runtime likely leaked (symbol grep may have missed minified idents)`,
  );
} else {
  pass(
    `client JS within size budget (${clientJsAll.length}B / ${CLIENT_JS_BUDGET}B)`,
  );
}

// 8. Cross-compiler bridge. The root layout is a Server Component that
// never ships to the client bundle, so its `data-cassida-bridge` probe
// chain is compiled ONLY by the server webpack compiler. Its class must
// appear in the @layer cas CSS shipped under .next/static/css (built by
// the client compiler from the virtual.css import) — that round trip is
// the cross-compiler bridge: store.allRules() merges every compiler's
// namespace, so a Server-only rule reaches the Client-injected bundle.
// A bridge regression (one compiler clearing another's namespace) drops
// the probe's class from the CSS and fails here, instead of hiding
// behind the Client Components' own classes that assertions 2/3 match.
const bridgeTag = serverAll.match(/<[^>]*\bdata-cassida-bridge\b[^>]*>/);
if (!bridgeTag) {
  fail('cross-compiler bridge: data-cassida-bridge probe element not found in server output');
} else {
  const probeClass = bridgeTag[0].match(/\bcas-[0-9a-f]{8}\b/)?.[0];
  if (!probeClass) {
    fail('cross-compiler bridge: probe element carried no cas-XXXXXXXX class');
  } else if (!new RegExp(`\\.${probeClass}\\b`).test(cssAll)) {
    fail(
      `cross-compiler bridge: server-only probe class .${probeClass} is absent from the ` +
        'client-shipped @layer cas CSS — the server compiler rule did not cross the bridge',
    );
  } else {
    pass(
      `cross-compiler bridge: server-only probe class .${probeClass} present in client-shipped CSS`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} assertion${failures === 1 ? '' : 's'} failed.`);
  process.exit(1);
}
console.log('\nAll assertions passed.');
