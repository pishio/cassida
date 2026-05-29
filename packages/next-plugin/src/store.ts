/**
 * Per-compiler rule store. Replaces v0.8.0's module-singleton store,
 * which couldn't distinguish Server-compiler and Client-compiler
 * writes in Next.js's parallel-compiler model and exposed a
 * documented multi-compiler race where the Client compiler's
 * `processAssets` could fire before the Server compiler had finished
 * populating the store with Server-only rules.
 *
 * Keyed by the parent webpack `Compiler`, not the `Compilation`:
 * Next.js spawns child compilations off the main Compiler for CSS
 * extraction and similar passes, and the IR loader can end up
 * running in a child while `CassidaWebpackPlugin.processAssets`
 * reads on the parent. Per-compiler keying makes the two agree
 * (all of a compiler's children write into one bag) while still
 * isolating Server- and Client-side state — those are distinct
 * Compiler instances under Next.js's parallel-compiler architecture.
 *
 * Phase 1.x limitation that remains — file deletion / rename: a
 * deleted source file's previous entry stays in its compiler's bag
 * until that compiler ends, because the loader doesn't re-run on a
 * path that no longer exists. In practice each `next build` starts
 * a fresh compiler so the issue is dev-only; the proper fix is to
 * harvest rules from `compilation.moduleGraph` at `processAssets`
 * time. Tracked for a follow-up.
 */
import type { CompiledRule } from '@cassida/compiler';

type FileMap = Map<string, readonly CompiledRule[]>;

/** Used by `__resetForTests` so each test gets a fresh key without
 * having to thread a synthetic compiler through every assertion. */
const TEST_COMPILER_KEY: object = { __cassidaTestSingleton: true };

const perCompiler = new WeakMap<object, FileMap>();

function bagFor(compiler: object): FileMap {
  let bag = perCompiler.get(compiler);
  if (bag === undefined) {
    bag = new Map();
    perCompiler.set(compiler, bag);
  }
  return bag;
}

export function setRulesForFile(
  compiler: object,
  filename: string,
  rules: readonly CompiledRule[],
): void {
  if (rules.length === 0) {
    perCompiler.get(compiler)?.delete(filename);
    return;
  }
  // Dedup: if the file's previous rules registered the same set of
  // className strings, skip the Map.set. Hash collisions are already
  // guarded against in `CssEmitter.add`, so className equality is a
  // sufficient identity check here.
  const bag = bagFor(compiler);
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
  compiler: object,
  filename: string,
): boolean {
  return perCompiler.get(compiler)?.delete(filename) ?? false;
}

export function allRules(compiler: object): IterableIterator<CompiledRule> {
  return iterateAllRules(compiler);
}

function* iterateAllRules(
  compiler: object,
): IterableIterator<CompiledRule> {
  const bag = perCompiler.get(compiler);
  if (!bag) return;
  for (const rules of bag.values()) {
    for (const rule of rules) yield rule;
  }
}

/** Snapshot of which files currently contribute rules to a given
 * compiler. Useful for tests / debug; not on the build hot path. */
export function trackedFiles(compiler: object): readonly string[] {
  const bag = perCompiler.get(compiler);
  return bag ? [...bag.keys()] : [];
}

/** Stable sentinel key for tests that don't want to thread a
 * synthetic Compiler through every store call. Stays stable across
 * the test process; `__resetForTests` drops its entries between
 * cases so they don't bleed into each other. */
export function testCompilerKey(): object {
  return TEST_COMPILER_KEY;
}

/** Test helper — drop the test-singleton's entries between cases.
 * Real compilers are GC-isolated automatically. */
export function __resetForTests(): void {
  perCompiler.delete(TEST_COMPILER_KEY);
}
