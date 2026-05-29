/**
 * Per-compilation rule store. Replaces v0.8.0's module-singleton
 * store, which couldn't distinguish Server-compiler and Client-
 * compiler writes in Next.js's parallel-compiler model and exposed a
 * documented multi-compiler race where the Client compiler's
 * `processAssets` could fire before the Server compiler had finished
 * populating the store with Server-only rules.
 *
 * Keyed by the parent webpack `Compilation`, which the IR loader
 * passes in via `this._compilation` and the `CassidaWebpackPlugin`
 * passes in from the `thisCompilation` hook. Each compilation owns
 * its own `Map<filename, CompiledRule[]>` so Server and Client
 * compilers never share state; the bag is dropped automatically
 * when the compilation object becomes unreachable.
 *
 * Phase 1.x limitation that remains — file deletion / rename: a
 * deleted source file's previous entry stays in its compilation's
 * bag until that compilation ends, because the loader doesn't re-run
 * on a path that no longer exists. In practice each `next build`
 * starts a fresh compilation so the issue is dev-only; the proper
 * fix is to harvest rules from `compilation.moduleGraph` at
 * `processAssets` time. Tracked for a follow-up.
 */
import type { CompiledRule } from '@cassida/compiler';

type FileMap = Map<string, readonly CompiledRule[]>;

/** Used by `__resetForTests` so each test gets a fresh key without
 * having to thread a synthetic compilation through every assertion. */
const TEST_COMPILATION_KEY: object = { __cassidaTestSingleton: true };

const perCompilation = new WeakMap<object, FileMap>();

function bagFor(compilation: object): FileMap {
  let bag = perCompilation.get(compilation);
  if (bag === undefined) {
    bag = new Map();
    perCompilation.set(compilation, bag);
  }
  return bag;
}

export function setRulesForFile(
  compilation: object,
  filename: string,
  rules: readonly CompiledRule[],
): void {
  if (rules.length === 0) {
    perCompilation.get(compilation)?.delete(filename);
    return;
  }
  // Dedup: if the file's previous rules registered the same set of
  // className strings, skip the Map.set. Hash collisions are already
  // guarded against in `CssEmitter.add`, so className equality is a
  // sufficient identity check here.
  const bag = bagFor(compilation);
  const existing = bag.get(filename);
  if (
    existing !== undefined &&
    existing.length === rules.length &&
    existing.every((r, i) => r.className === rules[i]?.className)
  ) {
    return;
  }
  bag.set(filename, rules);
}

export function deleteRulesForFile(
  compilation: object,
  filename: string,
): boolean {
  return perCompilation.get(compilation)?.delete(filename) ?? false;
}

export function allRules(compilation: object): IterableIterator<CompiledRule> {
  return iterateAllRules(compilation);
}

function* iterateAllRules(
  compilation: object,
): IterableIterator<CompiledRule> {
  const bag = perCompilation.get(compilation);
  if (!bag) return;
  for (const rules of bag.values()) {
    for (const rule of rules) yield rule;
  }
}

/** Snapshot of which files currently contribute rules to a given
 * compilation. Useful for tests / debug; not on the build hot path. */
export function trackedFiles(compilation: object): readonly string[] {
  const bag = perCompilation.get(compilation);
  return bag ? [...bag.keys()] : [];
}

/** Stable sentinel key for tests that don't want to thread a
 * synthetic Compilation through every store call. Returns a fresh
 * value each time the test helper resets, so cases don't bleed into
 * each other. */
export function testCompilationKey(): object {
  return TEST_COMPILATION_KEY;
}

/** Test helper — drop the test-singleton's entries between cases.
 * Real compilations are GC-isolated automatically. */
export function __resetForTests(): void {
  perCompilation.delete(TEST_COMPILATION_KEY);
}
