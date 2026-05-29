/**
 * Module-singleton rule store — the cross-compiler bridge that lets
 * Next.js's App Router + RSC pipeline ship Cassida CSS through a
 * single `<link rel="stylesheet">` regardless of which webpack
 * compiler (Client, Server, Edge, Middleware) discovered the rules.
 *
 * # Why a singleton is the right shape here
 *
 * The browser-DOM contract is: every `cas-XXXXXXXX` className that
 * lands on a rendered element MUST have a matching rule in the CSS
 * Next.js injects via `<link rel="stylesheet">` into `<head>`. Next.js
 * sources that link from CSS assets emitted by the **Client**
 * compiler — that is the only compiler whose output is shipped to the
 * browser as a stylesheet.
 *
 * Server-only Server Components (e.g. `app/server-only.tsx`) are
 * never imported by the Client graph. Their `.tsx` files run through
 * the SWC plugin + IR loader ONLY inside the Server compiler. The
 * rendered HTML / RSC payload still sends `<aside class="cas-abc12345">`
 * down to the browser, so the browser needs the rule for `cas-abc12345`
 * in the Client compiler's emitted `virtual.css`.
 *
 * This shared module-singleton IS the bridge: the Server compiler's
 * loader writes rules in here, the Client compiler's
 * `CassidaWebpackPlugin.processAssets` drains them when it
 * materialises `virtual.css`. Each compiler runs in the same Node.js
 * process (Next.js's webpack multi-compiler architecture shares one
 * module realm), so the bridge works without IPC.
 *
 * Per-compiler isolation breaks this contract — that experiment lived
 * on `feat/per-compilation-store` (PR #29, closed) and surfaced as
 * missing CSS for Server-only components because the Client
 * compiler's `virtual.css` had no path to the Server-only rules.
 * Keep this file a flat module-singleton until we either ship
 * Turbopack support (which gets its own equivalent bridge) or wire a
 * structural sidecar (see `multiCompilerMode: 'sidecar-file'` in
 * `NextCassidaOptions`, currently stub for Phase 2).
 *
 * # Compiler matrix (Next.js App Router, webpack mode)
 *
 *   - **Client**: browser bundle. Consumes `virtual.css` for the
 *     `<link rel="stylesheet">`. Loader writes Client-graph rules.
 *   - **Server**: Node SSR + RSC renderer. Loader writes Server-only
 *     component rules. Server compiler also imports `virtual.css` via
 *     `app/layout.tsx`, but the browser-facing stylesheet always
 *     originates from the Client compiler's emitted assets.
 *   - **Edge**: Edge runtime bundle (middleware-adjacent). Usually a
 *     strict subset of the Server graph. Loader writes whatever the
 *     graph contains. Frequently empty in apps that only use Edge for
 *     `middleware.ts` — that empty state is normal, not a race.
 *   - **Middleware**: a thin Edge bundle for `middleware.ts`. CSS
 *     imports here are exceedingly rare; the loader contribution is
 *     usually a no-op. Contributes harmlessly to the singleton.
 *
 * All four compiler instances share this module realm under Next.js,
 * so all four feed into one `rulesByFile` map. Per-file keying means
 * the same source file picked up by both Server and Client compilers
 * produces one entry — the second writer's `setRulesForFile` early-
 * returns because the IR comment hashes deterministically to the same
 * className list.
 *
 * # Deletion / rename
 *
 * A deleted source file's entry stays in the store until the dev
 * server restarts — the loader doesn't re-run on a path that no
 * longer exists. Dev-only paper cut. In a production build the store
 * is built once from the full graph and the issue can't surface.
 *
 * # Turbopack
 *
 * Turbopack's plugin model is different and will need its own
 * equivalent bridge (Phase 1.5). The contract — Server-only rules
 * must reach the Client stylesheet — is identical; the implementation
 * surface is what differs.
 *
 * # Observability
 *
 * Set `DEBUG=cassida:store` (anywhere `process.env.DEBUG.includes`
 * matches, so `cassida:*` works too) to log each write / delete /
 * read event with file path and rule count. Zero overhead when off —
 * the gate is a single env lookup per event and the event firings only
 * happen on real mutations.
 */
import type { CompiledRule } from '@cassida/compiler';

const rulesByFile = new Map<string, readonly CompiledRule[]>();

/**
 * Subscribers wake up when the rule set changes — used by the
 * virtual CSS module's HMR path to invalidate the generated module
 * whenever a source file's compiled rules change. The Node loader
 * fires `notify` after every loader pass.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * DEBUG-namespace gate. `process.env.DEBUG` is the conventional Node
 * tracing knob (debug, pino, koa, mocha all read it). We match by
 * substring so `DEBUG=cassida:*` and `DEBUG=cassida:store` both
 * light up; `DEBUG=` or unset stays silent.
 *
 * Re-checked per event rather than memoised because dev-loop tooling
 * (Vitest setupFiles, `cross-env` wrappers) frequently flips it
 * mid-process. One string lookup + `includes` per event is cheap and
 * only paid when something is actually firing.
 */
function traceEnabled(): boolean {
  const dbg = process.env.DEBUG;
  return typeof dbg === 'string' && dbg.includes('cassida:store');
}

function trace(event: string, filename: string, count: number): void {
  if (!traceEnabled()) return;
  process.stderr.write(
    `[cassida:store] ${event} file=${filename} rules=${count}\n`,
  );
}

export function setRulesForFile(
  filename: string,
  rules: readonly CompiledRule[],
): void {
  if (rules.length === 0) {
    if (rulesByFile.delete(filename)) {
      trace('delete (empty rule set)', filename, 0);
      notify();
    }
    return;
  }
  // Skip `notify()` when the incoming rules are identical to the
  // file's current contribution. During development, editing any
  // non-CSS part of a file (text, event handlers, etc.) still
  // re-runs the loader; without this check, every keystroke would
  // invalidate the virtual CSS module and force the browser to
  // re-fetch the entire bundle even though the styles didn't move.
  // ClassName comparison is enough here because hash collisions are
  // already guarded against in `CssEmitter.add`.
  const existing = rulesByFile.get(filename);
  if (
    existing !== undefined &&
    existing.length === rules.length &&
    existing.every((r, i) => r.className === rules[i]?.className)
  ) {
    trace('set (noop, identical)', filename, rules.length);
    return;
  }
  rulesByFile.set(filename, rules);
  trace('set', filename, rules.length);
  notify();
}

export function deleteRulesForFile(filename: string): boolean {
  const existed = rulesByFile.delete(filename);
  if (existed) {
    trace('delete', filename, 0);
    notify();
  }
  return existed;
}

export function allRules(): IterableIterator<CompiledRule> {
  if (traceEnabled()) {
    let count = 0;
    for (const rules of rulesByFile.values()) count += rules.length;
    process.stderr.write(
      `[cassida:store] read files=${rulesByFile.size} rules=${count}\n`,
    );
  }
  return iterateAllRules();
}

function* iterateAllRules(): IterableIterator<CompiledRule> {
  for (const rules of rulesByFile.values()) {
    for (const rule of rules) yield rule;
  }
}

/**
 * Snapshot of which files currently contribute rules. Useful for
 * tests / debug, not on the build hot path.
 */
export function trackedFiles(): readonly string[] {
  return [...rulesByFile.keys()];
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Test helper — reset the singleton between cases so a leaky earlier
 * test doesn't pollute the next one. Not part of the public API.
 */
export function __resetForTests(): void {
  rulesByFile.clear();
  listeners.clear();
}
