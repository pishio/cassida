/**
 * Unit tests for `CassidaWebpackPlugin`. We don't drive a real
 * webpack compilation here — the full end-to-end signal lives in the
 * `e2e/next-app/` fixture's `next build`. These tests verify the
 * plugin's local contract: when its hooks fire, the virtual module's
 * content reflects the store at that moment.
 *
 * We replace `webpack-virtual-modules` with a spy that records every
 * `writeModule` call, then drive synthetic `compiler` /
 * `compilation` objects through the plugin's `apply` method.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CassidaWebpackPlugin } from '../src/webpack-plugin.js';
import { rewriteIrComments } from '../src/ir-loader.js';
import { __resetForTests, setRulesForFile } from '../src/store.js';

// vi.mock affects the import graph for the file under test — must be
// declared before importing the SUT to take effect.
vi.mock('webpack-virtual-modules', () => {
  const writes: Array<{ path: string; content: string }> = [];
  class MockVirtualModulesPlugin {
    static __writes = writes;
    static __clear(): void {
      writes.length = 0;
    }
    constructor(_initial: Record<string, string>) {}
    apply(_compiler: unknown): void {
      // No-op — real webpack hooks aren't fired by the synthetic
      // compiler we drive below.
    }
    writeModule(path: string, content: string): void {
      writes.push({ path, content });
    }
  }
  return { default: MockVirtualModulesPlugin };
});

// Import the mocked module so the test can reach the spy buffer.
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
  hooks: {
    thisCompilation: { tap: (name: string, fn: (c: SyntheticCompilation) => void) => void };
    watchRun: { tap: (name: string, fn: () => void) => void };
    watchClose: { tap: (name: string, fn: () => void) => void };
    compile: { tap: (name: string, fn: () => void) => void };
    done: { tap: (name: string, fn: () => void) => void };
  };
}

function createSyntheticCompiler(): {
  compiler: SyntheticCompiler;
  fireThisCompilation: () => void;
  fireProcessAssets: () => void;
  fireWatchRun: () => void;
  fireWatchClose: () => void;
  fireCompile: () => void;
  fireDone: () => void;
} {
  let thisCompilationFn: ((c: SyntheticCompilation) => void) | null = null;
  let processAssetsFn: (() => void) | null = null;
  let watchRunFn: (() => void) | null = null;
  let watchCloseFn: (() => void) | null = null;
  let compileFn: (() => void) | null = null;
  let doneFn: (() => void) | null = null;

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
    hooks: {
      thisCompilation: {
        tap: (_name, fn) => {
          thisCompilationFn = fn;
        },
      },
      watchRun: {
        tap: (_name, fn) => {
          watchRunFn = fn;
        },
      },
      watchClose: {
        tap: (_name, fn) => {
          watchCloseFn = fn;
        },
      },
      compile: {
        tap: (_name, fn) => {
          compileFn = fn;
        },
      },
      done: {
        tap: (_name, fn) => {
          doneFn = fn;
        },
      },
    },
  };

  return {
    compiler,
    fireThisCompilation: () => thisCompilationFn?.(compilation),
    fireProcessAssets: () => processAssetsFn?.(),
    fireWatchRun: () => watchRunFn?.(),
    fireWatchClose: () => watchCloseFn?.(),
    fireCompile: () => compileFn?.(),
    fireDone: () => doneFn?.(),
  };
}

beforeEach(() => {
  __resetForTests();
  MockVirtualModulesPlugin.__clear();
});

describe('CassidaWebpackPlugin', () => {
  it('writes a placeholder when no rules are registered at processAssets', () => {
    const { compiler, fireThisCompilation, fireProcessAssets } = createSyntheticCompiler();
    new CassidaWebpackPlugin().apply(compiler as never);
    fireThisCompilation();
    fireProcessAssets();

    expect(MockVirtualModulesPlugin.__writes).toHaveLength(1);
    // The virtual module is registered at the published `virtual.css`'s
    // absolute physical path (via `fileURLToPath`), not a hard-coded
    // `node_modules/...` relative — symlink-safe across pnpm
    // workspaces / yarn link / hoisted layouts.
    expect(MockVirtualModulesPlugin.__writes[0]!.path).toMatch(/virtual\.css$/);
    expect(MockVirtualModulesPlugin.__writes[0]!.content).toMatch(/cassida virtual/);
  });

  it('writes the real @layer cas CSS when rules are present at processAssets', () => {
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

  it('suppresses subscription-driven writes while compilation is active', () => {
    const { compiler, fireWatchRun, fireCompile, fireDone } = createSyntheticCompiler();
    new CassidaWebpackPlugin({ layer: 'cas' }).apply(compiler as never);
    fireWatchRun();

    // Enter active compilation — subscription-driven writes must
    // be suppressed so the IR loader's per-file `setRulesForFile`
    // calls don't trigger N redundant `writeModule` invocations.
    fireCompile();

    const irA = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const { rules: rulesA } = rewriteIrComments(
      `const x = /* @cassida-ir:${irA}*/ "__CAS_PLACEHOLDER_0__";`,
    );
    setRulesForFile('/abs/a.tsx', rulesA);
    setRulesForFile('/abs/b.tsx', rulesA);
    expect(MockVirtualModulesPlugin.__writes).toHaveLength(0);

    // Compilation ends; the next between-compilation update goes
    // through.
    fireDone();
    setRulesForFile('/abs/c.tsx', rulesA);
    expect(MockVirtualModulesPlugin.__writes).toHaveLength(1);
  });

  it('re-writes the virtual content when the store fires between compilations', () => {
    const { compiler, fireWatchRun, fireWatchClose } = createSyntheticCompiler();
    new CassidaWebpackPlugin({ layer: 'cas' }).apply(compiler as never);
    fireWatchRun();

    // First store update — should drive a rewrite.
    const irA = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const { rules: rulesA } = rewriteIrComments(
      `const x = /* @cassida-ir:${irA}*/ "__CAS_PLACEHOLDER_0__";`,
    );
    setRulesForFile('/abs/a.tsx', rulesA);
    expect(MockVirtualModulesPlugin.__writes.length).toBeGreaterThanOrEqual(1);
    expect(
      MockVirtualModulesPlugin.__writes[
        MockVirtualModulesPlugin.__writes.length - 1
      ]!.content,
    ).toContain('color:red');

    // Second update from a different file — should drive another
    // rewrite that carries both colours.
    const irB = JSON.stringify([{ method: 'color', args: ['blue'] }]);
    const { rules: rulesB } = rewriteIrComments(
      `const y = /* @cassida-ir:${irB}*/ "__CAS_PLACEHOLDER_0__";`,
    );
    setRulesForFile('/abs/b.tsx', rulesB);
    const last = MockVirtualModulesPlugin.__writes[
      MockVirtualModulesPlugin.__writes.length - 1
    ]!.content;
    expect(last).toContain('color:red');
    expect(last).toContain('color:blue');

    fireWatchClose();

    // After watchClose, subsequent store updates must NOT drive
    // rewrites — the listener was supposed to detach.
    const writesBeforeClose = MockVirtualModulesPlugin.__writes.length;
    setRulesForFile('/abs/c.tsx', rulesA);
    expect(MockVirtualModulesPlugin.__writes.length).toBe(writesBeforeClose);
  });
});
