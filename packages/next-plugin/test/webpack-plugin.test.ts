/**
 * Unit tests for `CassidaWebpackPlugin`. We don't drive a real
 * webpack compilation here — the full end-to-end signal lives in the
 * `e2e/next-app/` fixture's `next build`. These tests verify the
 * plugin's local contract: when `processAssets` fires, the virtual
 * module's content reflects `store.allRules()` at that moment.
 *
 * `webpack-virtual-modules` is mocked so the test can intercept
 * every `writeModule` call without standing up a webpack instance.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CassidaWebpackPlugin } from '../src/webpack-plugin.js';
import { rewriteIrComments } from '../src/ir-loader.js';
import {
  __resetForTests,
  setRulesForFile,
  trackedFilesForCompiler,
  allRulesForCompiler,
  knownCompilerNames,
} from '../src/store.js';

vi.mock('webpack-virtual-modules', () => {
  const writes: Array<{ path: string; content: string }> = [];
  class MockVirtualModulesPlugin {
    static __writes = writes;
    static __clear(): void {
      writes.length = 0;
    }
    constructor(_initial: Record<string, string>) {}
    apply(_compiler: unknown): void {
      // No-op — synthetic compiler doesn't fire real webpack hooks.
    }
    writeModule(path: string, content: string): void {
      writes.push({ path, content });
    }
  }
  return { default: MockVirtualModulesPlugin };
});

const { default: MockVirtualModulesPlugin } = (await import(
  'webpack-virtual-modules'
)) as unknown as {
  default: { __writes: Array<{ path: string; content: string }>; __clear: () => void };
};

interface SyntheticCompilation {
  compiler: { webpack: { Compilation: { PROCESS_ASSETS_STAGE_PRE_PROCESS: number } } };
  hooks: { processAssets: { tap: (tap: unknown, fn: () => void) => void } };
}

interface SyntheticCompiler {
  options?: { name?: string };
  hooks: {
    thisCompilation: { tap: (name: string, fn: (c: SyntheticCompilation) => void) => void };
    beforeRun: { tap: (name: string, fn: () => void) => void };
    watchRun: { tap: (name: string, fn: () => void) => void };
  };
}

function createSyntheticCompiler(name?: string): {
  compiler: SyntheticCompiler;
  fireBeforeRun: () => void;
  fireWatchRun: () => void;
  fireThisCompilation: () => void;
  fireProcessAssets: () => void;
} {
  let thisCompilationFn: ((c: SyntheticCompilation) => void) | null = null;
  let processAssetsFn: (() => void) | null = null;
  let beforeRunFn: (() => void) | null = null;
  let watchRunFn: (() => void) | null = null;

  const compilation: SyntheticCompilation = {
    compiler: { webpack: { Compilation: { PROCESS_ASSETS_STAGE_PRE_PROCESS: -1000 } } },
    hooks: {
      processAssets: {
        tap: (_tap, fn) => {
          processAssetsFn = fn;
        },
      },
    },
  };

  const compiler: SyntheticCompiler = {
    ...(name !== undefined ? { options: { name } } : {}),
    hooks: {
      thisCompilation: {
        tap: (_name, fn) => {
          thisCompilationFn = fn;
        },
      },
      beforeRun: {
        tap: (_name, fn) => {
          beforeRunFn = fn;
        },
      },
      watchRun: {
        tap: (_name, fn) => {
          watchRunFn = fn;
        },
      },
    },
  };

  return {
    compiler,
    fireBeforeRun: () => beforeRunFn?.(),
    fireWatchRun: () => watchRunFn?.(),
    fireThisCompilation: () => thisCompilationFn?.(compilation),
    fireProcessAssets: () => processAssetsFn?.(),
  };
}

beforeEach(() => {
  __resetForTests();
  MockVirtualModulesPlugin.__clear();
});

describe('CassidaWebpackPlugin', () => {
  it('writes the placeholder when no rules are registered', () => {
    const { compiler, fireThisCompilation, fireProcessAssets } = createSyntheticCompiler();
    new CassidaWebpackPlugin().apply(compiler as never);
    fireThisCompilation();
    fireProcessAssets();

    expect(MockVirtualModulesPlugin.__writes).toHaveLength(1);
    // The virtual module is registered at the absolute physical
    // path of `virtual.css` (resolved via `fileURLToPath`) so the
    // path is symlink-safe across pnpm / yarn-link / hoisted layouts.
    expect(MockVirtualModulesPlugin.__writes[0]!.path).toMatch(/virtual\.css$/);
    expect(MockVirtualModulesPlugin.__writes[0]!.content).toMatch(/cassida virtual/);
  });

  it('writes the aggregated @layer cas CSS when rules are present', () => {
    const ir = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const { rules } = rewriteIrComments(
      `const x = /* @cassida-ir:${ir}*/ "__CAS_PLACEHOLDER_0__";`,
    );
    setRulesForFile('/abs/a.tsx', rules);

    const { compiler, fireThisCompilation, fireProcessAssets } = createSyntheticCompiler();
    new CassidaWebpackPlugin({ layer: 'cas' }).apply(compiler as never);
    fireThisCompilation();
    fireProcessAssets();

    expect(MockVirtualModulesPlugin.__writes).toHaveLength(1);
    const content = MockVirtualModulesPlugin.__writes[0]!.content;
    expect(content).toMatch(/@layer\s+cas/);
    expect(content).toMatch(/\.cas-[0-9a-f]+/);
    expect(content).toContain('color:red');
  });

  it('bridges server-only rules into the client compiler virtual.css', () => {
    // This is the architecture's reason to exist. A Server Component
    // emits a chain in the Server compiler ONLY; the Client compiler
    // must still see the rule so the RSC-serialised className paints.
    const serverIr = JSON.stringify([{ method: 'color', args: ['rebeccapurple'] }]);
    const { rules: serverRules } = rewriteIrComments(
      `/* @cassida-ir:${serverIr}*/ "__CAS_PLACEHOLDER_0__"`,
    );
    setRulesForFile('/abs/server-only.tsx', serverRules, 'server');

    const clientIr = JSON.stringify([{ method: 'color', args: ['tomato'] }]);
    const { rules: clientRules } = rewriteIrComments(
      `/* @cassida-ir:${clientIr}*/ "__CAS_PLACEHOLDER_0__"`,
    );
    setRulesForFile('/abs/page.tsx', clientRules, 'client');

    // Simulate the Client compiler's processAssets.
    const { compiler, fireThisCompilation, fireProcessAssets } =
      createSyntheticCompiler('client');
    new CassidaWebpackPlugin({ layer: 'cas' }).apply(compiler as never);
    fireThisCompilation();
    fireProcessAssets();

    const content = MockVirtualModulesPlugin.__writes.at(-1)!.content;
    // Both rules ride through — the client's virtual.css contains the
    // server-only color too.
    expect(content).toContain('color:rebeccapurple');
    expect(content).toContain('color:tomato');
  });

  it('clears only the matching compiler namespace on beforeRun', () => {
    setRulesForFile(
      '/abs/server-only.tsx',
      [{ className: 'cas-server', tree: { bag: {}, children: [] } } as never],
      'server',
    );
    setRulesForFile(
      '/abs/page.tsx',
      [{ className: 'cas-client', tree: { bag: {}, children: [] } } as never],
      'client',
    );

    const { compiler, fireBeforeRun } = createSyntheticCompiler('client');
    new CassidaWebpackPlugin().apply(compiler as never);

    fireBeforeRun();

    expect(trackedFilesForCompiler('client')).toHaveLength(0);
    // Server namespace untouched — the cross-compiler bridge survives.
    expect(trackedFilesForCompiler('server')).toContain('/abs/server-only.tsx');
  });

  it('clears only the matching compiler namespace on watchRun (dev)', () => {
    setRulesForFile(
      '/abs/server-only.tsx',
      [{ className: 'cas-server', tree: { bag: {}, children: [] } } as never],
      'server',
    );
    setRulesForFile(
      '/abs/page.tsx',
      [{ className: 'cas-client', tree: { bag: {}, children: [] } } as never],
      'client',
    );

    const { compiler, fireWatchRun } = createSyntheticCompiler('server');
    new CassidaWebpackPlugin().apply(compiler as never);

    fireWatchRun();

    expect(trackedFilesForCompiler('server')).toHaveLength(0);
    expect(trackedFilesForCompiler('client')).toContain('/abs/page.tsx');
  });

  it('does NOT emit the race-detection heads-up on a legitimately empty build', () => {
    // The v0.8.0 heuristic ('seen is empty' → warn) false-positived
    // on fixtures with no cas() chains. New probe requires a peer
    // compiler to have written rules before; without a peer, no
    // warning fires.
    const writes: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stderr.write;
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { compiler, fireThisCompilation, fireProcessAssets } =
        createSyntheticCompiler('client');
      new CassidaWebpackPlugin({ layer: 'cas' }).apply(compiler as never);
      fireThisCompilation();
      fireProcessAssets();
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.stderr.write = origWrite;
    }
    expect(writes.join('')).not.toMatch(/cross-compiler bridge gap/);
  });

  it('emits the race-detection heads-up when a peer compiler wrote then got cleared', () => {
    // Simulate the real race: server compiler wrote rules, then its
    // namespace got cleared (or never had its rules harvested into
    // the client read), and now the client's processAssets fires
    // seeing none of the server's contribution.
    const serverIr = JSON.stringify([{ method: 'color', args: ['rebeccapurple'] }]);
    const { rules: serverRules } = rewriteIrComments(
      `/* @cassida-ir:${serverIr}*/ "__CAS_PLACEHOLDER_0__"`,
    );
    setRulesForFile('/abs/server-only.tsx', serverRules, 'server');
    // Simulate "the server's bridge contribution evaporated" — the
    // namespace exists (lastWrittenAt is set) but is empty.
    setRulesForFile('/abs/server-only.tsx', [], 'server');

    expect(knownCompilerNames()).toContain('server');
    expect(Array.from(allRulesForCompiler('server'))).toHaveLength(0);

    const writes: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stderr.write;
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { compiler, fireThisCompilation, fireProcessAssets } =
        createSyntheticCompiler('client');
      new CassidaWebpackPlugin({ layer: 'cas' }).apply(compiler as never);
      fireThisCompilation();
      fireProcessAssets();
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.stderr.write = origWrite;
    }
    expect(writes.join('')).toMatch(/cross-compiler bridge gap/);
    expect(writes.join('')).toMatch(/'server'/);
  });

  it('suppresses the bridge-gap warning when CASSIDA_QUIET_RACE_WARNING is set', () => {
    setRulesForFile(
      '/abs/server-only.tsx',
      [{ className: 'cas-server', tree: { bag: {}, children: [] } } as never],
      'server',
    );
    setRulesForFile('/abs/server-only.tsx', [], 'server');

    const writes: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stderr.write;
    const prevEnv = process.env.NODE_ENV;
    const prevQuiet = process.env.CASSIDA_QUIET_RACE_WARNING;
    process.env.NODE_ENV = 'production';
    process.env.CASSIDA_QUIET_RACE_WARNING = '1';
    try {
      const { compiler, fireThisCompilation, fireProcessAssets } =
        createSyntheticCompiler('client');
      new CassidaWebpackPlugin({ layer: 'cas' }).apply(compiler as never);
      fireThisCompilation();
      fireProcessAssets();
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevQuiet === undefined) delete process.env.CASSIDA_QUIET_RACE_WARNING;
      else process.env.CASSIDA_QUIET_RACE_WARNING = prevQuiet;
      process.stderr.write = origWrite;
    }
    expect(writes.join('')).not.toMatch(/cross-compiler bridge gap/);
  });
});
