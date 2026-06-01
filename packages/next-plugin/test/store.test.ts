/**
 * Tests for the namespaced rule store. The headline contracts:
 *
 *   1. `setRulesForFile(file, rules, name)` routes into the namespace
 *      for `name`; `setRulesForFile(file, rules)` uses the default
 *      namespace (legacy callers stay byte-compatible).
 *   2. `allRules()` merges every namespace — this is the cross-
 *      compiler bridge that lets Server-only chains reach the
 *      Client compiler's `virtual.css`.
 *   3. `allRulesForCompiler(name)` returns only one namespace.
 *   4. `clearCompilerNamespace(name)` wipes one namespace and leaves
 *      the others untouched.
 *   5. Last-write timestamps track per namespace for the race probe.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import type { CompiledRule } from '@cassida/compiler';

import {
  __resetForTests,
  allRules,
  allRulesForCompiler,
  clearCompilerNamespace,
  knownCompilerNames,
  lastWrittenAtForCompiler,
  setRulesForFile,
  trackedFiles,
  trackedFilesForCompiler,
} from '../src/store.js';

function makeRule(className: string): CompiledRule {
  return {
    className,
    tree: { bag: {}, children: [] },
  } as unknown as CompiledRule;
}

beforeEach(() => {
  __resetForTests();
});

describe('namespaced rule store', () => {
  it('routes writes into separate namespaces by compiler name', () => {
    setRulesForFile('/abs/server.tsx', [makeRule('cas-server')], 'server');
    setRulesForFile('/abs/client.tsx', [makeRule('cas-client')], 'client');

    const serverOnly = Array.from(allRulesForCompiler('server'));
    const clientOnly = Array.from(allRulesForCompiler('client'));

    expect(serverOnly).toHaveLength(1);
    expect(serverOnly[0]!.className).toBe('cas-server');
    expect(clientOnly).toHaveLength(1);
    expect(clientOnly[0]!.className).toBe('cas-client');
  });

  it('allRules() merges every namespace — the cross-compiler bridge', () => {
    setRulesForFile('/abs/server.tsx', [makeRule('cas-server')], 'server');
    setRulesForFile('/abs/client.tsx', [makeRule('cas-client')], 'client');
    setRulesForFile('/abs/edge.tsx', [makeRule('cas-edge')], 'edge');

    const merged = Array.from(allRules()).map((r) => r.className).sort();
    expect(merged).toEqual(['cas-client', 'cas-edge', 'cas-server']);
  });

  it('default (no name) writes land in a dedicated namespace, still merged into allRules', () => {
    setRulesForFile('/abs/a.tsx', [makeRule('cas-default')]);
    setRulesForFile('/abs/b.tsx', [makeRule('cas-server')], 'server');

    expect(Array.from(allRules()).map((r) => r.className).sort()).toEqual([
      'cas-default',
      'cas-server',
    ]);
  });

  it('clearCompilerNamespace wipes one namespace and leaves others alone', () => {
    setRulesForFile('/abs/server.tsx', [makeRule('cas-server')], 'server');
    setRulesForFile('/abs/client.tsx', [makeRule('cas-client')], 'client');

    clearCompilerNamespace('client');

    expect(Array.from(allRulesForCompiler('client'))).toHaveLength(0);
    // The cross-compiler bridge survives — server's contribution is
    // still observable to anyone else reading the store.
    const serverAfter = Array.from(allRulesForCompiler('server'));
    expect(serverAfter).toHaveLength(1);
    expect(serverAfter[0]!.className).toBe('cas-server');
  });

  it('lastWrittenAtForCompiler tracks per namespace', async () => {
    const before = Date.now();
    setRulesForFile('/abs/server.tsx', [makeRule('cas-server')], 'server');
    const serverAt = lastWrittenAtForCompiler('server');
    expect(serverAt).not.toBeNull();
    expect(serverAt!).toBeGreaterThanOrEqual(before);
    // Client namespace has never been written; timestamp is null.
    expect(lastWrittenAtForCompiler('client')).toBeNull();
  });

  it('knownCompilerNames lists every namespace that has been written to', () => {
    setRulesForFile('/abs/a.tsx', [makeRule('cas-a')], 'server');
    setRulesForFile('/abs/b.tsx', [makeRule('cas-b')], 'client');
    expect(knownCompilerNames().sort()).toEqual(['client', 'server']);
  });

  it('trackedFiles aggregates files across every namespace', () => {
    setRulesForFile('/abs/server.tsx', [makeRule('cas-server')], 'server');
    setRulesForFile('/abs/client.tsx', [makeRule('cas-client')], 'client');
    const tracked = [...trackedFiles()].sort();
    expect(tracked).toEqual(['/abs/client.tsx', '/abs/server.tsx']);
  });

  it('trackedFilesForCompiler returns only the namespace it was asked for', () => {
    setRulesForFile('/abs/server.tsx', [makeRule('cas-server')], 'server');
    setRulesForFile('/abs/client.tsx', [makeRule('cas-client')], 'client');
    expect(trackedFilesForCompiler('server')).toEqual(['/abs/server.tsx']);
    expect(trackedFilesForCompiler('client')).toEqual(['/abs/client.tsx']);
  });

  it('same className re-write does not bump the timestamp', () => {
    setRulesForFile('/abs/a.tsx', [makeRule('cas-foo')], 'server');
    const firstWrite = lastWrittenAtForCompiler('server');

    // Sleep replacement — `setRulesForFile` with identical rules
    // short-circuits before touching the timestamp, regardless of
    // wall-clock progression.
    setRulesForFile('/abs/a.tsx', [makeRule('cas-foo')], 'server');
    expect(lastWrittenAtForCompiler('server')).toBe(firstWrite);
  });

  it('clearing an empty namespace is a no-op (idempotent)', () => {
    clearCompilerNamespace('never-written');
    expect(knownCompilerNames()).not.toContain('never-written');
  });
});
