import { afterEach, describe, expect, it } from 'vitest';
import { withCassida } from '../src/index.js';

// The Turbopack guard fires inside `applyCassida` before any wasm lookup,
// so these tests don't need the SWC artefact present. process.env is
// mutated per-test and restored in afterEach (test files run in isolated
// workers, but the cleanup keeps ordering within this file clean).
describe('Turbopack bundler guard', () => {
  afterEach(() => {
    delete process.env.TURBOPACK;
    delete process.env.CASSIDA_ALLOW_TURBOPACK;
  });

  it('throws a clear, actionable error when Turbopack is active', () => {
    process.env.TURBOPACK = '1';
    expect(() => withCassida({}, {})).toThrow(/Turbopack is active/);
    // The remedy is part of the message.
    expect(() => withCassida({}, {})).toThrow(/--webpack/);
  });

  it('bypasses the guard when CASSIDA_ALLOW_TURBOPACK=1', () => {
    process.env.TURBOPACK = '1';
    process.env.CASSIDA_ALLOW_TURBOPACK = '1';
    // The guard is skipped, so `withCassida` proceeds past it. It may still
    // throw later (e.g. the wasm lookup in a bare unit-test env), but it
    // must not be the Turbopack guard error.
    let thrown: unknown;
    try {
      withCassida({}, {});
    } catch (e) {
      thrown = e;
    }
    if (thrown !== undefined) {
      expect(String(thrown)).not.toMatch(/Turbopack is active/);
    }
  });
});
