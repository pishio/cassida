/**
 * Module-singleton rule store, shared between the IR-comment loader
 * (writes) and the virtual CSS module (reads). Keyed by the absolute
 * file path of the source module so a re-transform of one file
 * cleanly replaces that file's contribution without disturbing the
 * rest of the bundle.
 *
 * Next.js's webpack instance imports this module once per build;
 * Turbopack will need its own equivalent when we add Turbopack
 * support (Phase 1.5).
 *
 * Phase 1 limitation — file deletion / rename: a deleted source
 * file's previous entry stays in the store until the dev server is
 * restarted, because the loader doesn't re-run on a path that no
 * longer exists. The Phase-1.x Webpack-plugin follow-up resolves
 * this by harvesting rules from the live module graph via
 * `compilation.moduleGraph` instead of an out-of-band singleton.
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

export function setRulesForFile(
  filename: string,
  rules: readonly CompiledRule[],
): void {
  if (rules.length === 0) {
    if (rulesByFile.delete(filename)) notify();
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
    return;
  }
  rulesByFile.set(filename, rules);
  notify();
}

export function deleteRulesForFile(filename: string): boolean {
  const existed = rulesByFile.delete(filename);
  if (existed) notify();
  return existed;
}

export function allRules(): IterableIterator<CompiledRule> {
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
