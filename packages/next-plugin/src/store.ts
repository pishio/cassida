/**
 * Module-singleton rule store, shared between the IR-comment loader
 * (writes) and the virtual CSS module (reads). Keyed first by the
 * compiler-name namespace (Next.js sets `'client'` / `'server'` /
 * `'edge'` / `'middleware'` on the webpack `Compiler` it forks), then
 * by the absolute file path of the source module so a re-transform of
 * one file cleanly replaces that file's contribution without disturbing
 * the rest of the bundle.
 *
 * Why the namespace is here even though the read path merges them:
 *
 *   Next.js's App Router runs a *Server* webpack compiler and a
 *   *Client* webpack compiler in parallel. A Server Component (no
 *   `'use client'`) only enters the Server compiler's graph, so the
 *   IR-comment loader compiles its `cas()` chains in the Server pass
 *   exclusively. The DOM still receives the resulting
 *   `<aside className="cas-XXXXXXXX">` (RSC serialises the className
 *   through the wire), and the *Client* bundle's `virtual.css` has to
 *   carry the rules backing that class name or the browser paints
 *   unstyled markup.
 *
 *   So the singleton is a deliberate **cross-compiler bridge**, not a
 *   leak. `allRules()` (the default read path used by
 *   `CassidaWebpackPlugin`'s `processAssets`) merges every namespace
 *   on purpose — both compilers emit a `virtual.css` that contains
 *   the union of all chains across the whole app, and that's what
 *   makes Server-only styles reach the browser.
 *
 *   The namespace exists for two more advanced use cases:
 *     1. Lifecycle clearing — `beforeRun` / `watchRun` clears ONLY the
 *        compiler's own namespace so `next dev` doesn't accumulate
 *        stale rules across HMR passes while still preserving the
 *        OTHER compiler's contribution between rebuilds.
 *     2. Future debug / Turbopack-split scenarios — `allRulesForCompiler`
 *        lets a tool ask "what did THIS compiler contribute?" without
 *        the bridge merge.
 *
 * Turbopack will need its own equivalent when we add Turbopack support
 * (Phase 1.5).
 *
 * Phase 1 limitation — file deletion / rename: a deleted source file's
 * previous entry stays in the store until the dev server is restarted,
 * because the loader doesn't re-run on a path that no longer exists.
 * The Phase-1.x Webpack-plugin follow-up resolves this by harvesting
 * rules from the live module graph via `compilation.moduleGraph`
 * instead of an out-of-band singleton.
 */
import type { CompiledRule } from '@cassida/compiler';

/**
 * Sentinel used when `compiler.options.name` is absent (most non-Next
 * webpack hosts, unit tests that don't set a name). Distinct from any
 * realistic Next.js value so a future config-injected
 * `name: 'default'` would still bucket separately.
 */
const DEFAULT_NAMESPACE = '__cassida_default__';

interface Namespace {
  readonly rulesByFile: Map<string, readonly CompiledRule[]>;
  /**
   * Monotonic timestamp (Date.now()) of the most recent write into this
   * namespace, or `null` if no write has landed since the last clear.
   * Used by the race-detection telemetry in `CassidaWebpackPlugin` —
   * "compiler X is reading at time T; compiler Y last wrote at time
   * T-Δ but we see zero rules from Y" is the actual race signature,
   * not the v0.8.0 heuristic of "store is empty".
   */
  lastWrittenAt: number | null;
}

const namespaces = new Map<string, Namespace>();

function getOrCreateNamespace(name: string): Namespace {
  let ns = namespaces.get(name);
  if (ns === undefined) {
    ns = { rulesByFile: new Map(), lastWrittenAt: null };
    namespaces.set(name, ns);
  }
  return ns;
}

function normaliseCompilerName(name: string | undefined | null): string {
  if (name === undefined || name === null || name === '') return DEFAULT_NAMESPACE;
  return name;
}

/**
 * Subscribers wake up when the rule set changes. Listeners are global
 * rather than per-namespace: the virtual CSS module aggregates across
 * every namespace, so any write is observable to every reader.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function setRulesForFile(
  filename: string,
  rules: readonly CompiledRule[],
  compilerName?: string | null,
): void {
  const ns = getOrCreateNamespace(normaliseCompilerName(compilerName));
  if (rules.length === 0) {
    if (ns.rulesByFile.delete(filename)) {
      ns.lastWrittenAt = Date.now();
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
  const existing = ns.rulesByFile.get(filename);
  if (
    existing !== undefined &&
    existing.length === rules.length &&
    existing.every((r, i) => r.className === rules[i]?.className)
  ) {
    return;
  }
  ns.rulesByFile.set(filename, rules);
  ns.lastWrittenAt = Date.now();
  notify();
}

export function deleteRulesForFile(
  filename: string,
  compilerName?: string | null,
): boolean {
  const ns = namespaces.get(normaliseCompilerName(compilerName));
  if (ns === undefined) return false;
  const existed = ns.rulesByFile.delete(filename);
  if (existed) {
    ns.lastWrittenAt = Date.now();
    notify();
  }
  return existed;
}

/**
 * Default read path. Iterates every namespace — this is the
 * cross-compiler bridge that lets Server-only rules reach the Client
 * bundle's `virtual.css`. `CassidaWebpackPlugin.processAssets` calls
 * this directly.
 */
export function allRules(): IterableIterator<CompiledRule> {
  return iterateAllRules();
}

function* iterateAllRules(): IterableIterator<CompiledRule> {
  for (const ns of namespaces.values()) {
    for (const rules of ns.rulesByFile.values()) {
      for (const rule of rules) yield rule;
    }
  }
}

/**
 * Advanced read path — returns rules contributed by a single compiler
 * namespace. Currently used only by the race-detection telemetry in
 * `CassidaWebpackPlugin`; exposed for future Turbopack-split or
 * debug-tooling scenarios where a consumer wants "what did the Server
 * compiler emit?" without the cross-compiler merge.
 */
export function allRulesForCompiler(
  compilerName?: string | null,
): IterableIterator<CompiledRule> {
  return iterateNamespace(normaliseCompilerName(compilerName));
}

function* iterateNamespace(name: string): IterableIterator<CompiledRule> {
  const ns = namespaces.get(name);
  if (ns === undefined) return;
  for (const rules of ns.rulesByFile.values()) {
    for (const rule of rules) yield rule;
  }
}

/**
 * Snapshot of which files currently contribute rules across every
 * namespace. Useful for tests / debug, not on the build hot path.
 */
export function trackedFiles(): readonly string[] {
  const out: string[] = [];
  for (const ns of namespaces.values()) {
    for (const file of ns.rulesByFile.keys()) out.push(file);
  }
  return out;
}

/**
 * Snapshot of which files contribute rules in a single namespace.
 * Useful for assertions in webpack-plugin tests.
 */
export function trackedFilesForCompiler(
  compilerName?: string | null,
): readonly string[] {
  const ns = namespaces.get(normaliseCompilerName(compilerName));
  if (ns === undefined) return [];
  return [...ns.rulesByFile.keys()];
}

/**
 * Last-write timestamp (Date.now() epoch ms) for the given compiler's
 * namespace, or `null` if no write has been observed since the last
 * `clearCompilerNamespace`. Returned for the race-detection probe in
 * `CassidaWebpackPlugin.processAssets`.
 */
export function lastWrittenAtForCompiler(
  compilerName?: string | null,
): number | null {
  const ns = namespaces.get(normaliseCompilerName(compilerName));
  return ns === undefined ? null : ns.lastWrittenAt;
}

/**
 * Names of every namespace the store currently knows about. Stable
 * iteration order is the insertion order of the first write into each
 * namespace.
 */
export function knownCompilerNames(): readonly string[] {
  return [...namespaces.keys()];
}

/**
 * Drop every rule the given compiler had registered. Called from the
 * `beforeRun` (production) / `watchRun` (dev) hooks before a compiler
 * re-runs its loaders, so a stale rule from a since-deleted source
 * file in *that* compiler doesn't keep contributing CSS. Crucially
 * leaves the OTHER compiler's namespace alone — the cross-compiler
 * bridge has to survive each compiler's lifecycle independently.
 */
export function clearCompilerNamespace(compilerName?: string | null): void {
  const name = normaliseCompilerName(compilerName);
  const ns = namespaces.get(name);
  if (ns === undefined) return;
  if (ns.rulesByFile.size === 0 && ns.lastWrittenAt === null) return;
  ns.rulesByFile.clear();
  ns.lastWrittenAt = Date.now();
  notify();
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
  namespaces.clear();
  listeners.clear();
}
