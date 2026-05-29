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
import { __resetForTests, setRulesForFile } from '../src/store.js';

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
  hooks: {
    thisCompilation: { tap: (name: string, fn: (c: SyntheticCompilation) => void) => void };
  };
}

function createSyntheticCompiler(): {
  compiler: SyntheticCompiler;
  fireThisCompilation: () => void;
  fireProcessAssets: () => void;
} {
  let thisCompilationFn: ((c: SyntheticCompilation) => void) | null = null;
  let processAssetsFn: (() => void) | null = null;

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
    },
  };

  return {
    compiler,
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

  // The v0.8.0 heads-up gated on `NODE_ENV === 'production' &&
  // seen.length === 0` was removed: in real Next.js builds every
  // Edge / Middleware compiler whose graph doesn't import any
  // `cas()` chain trips that condition harmlessly. The Browser API
  // contract is that an empty store at `processAssets` is a normal
  // outcome for compilers whose graph has no styled markup —
  // Server-only rules still reach the Client stylesheet via the
  // shared singleton (see `store.ts`). This test pins that
  // quietness so a future regression that adds the warning back
  // surfaces immediately.
  it('stays quiet under NODE_ENV=production when the store is empty', () => {
    const writes: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stderr.write;
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { compiler, fireThisCompilation, fireProcessAssets } = createSyntheticCompiler();
      new CassidaWebpackPlugin({ layer: 'cas' }).apply(compiler as never);
      fireThisCompilation();
      fireProcessAssets();
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.stderr.write = origWrite;
    }
    expect(writes.join('')).toBe('');
  });

  // DEBUG=cassida:plugin opts into per-compilation tracing. The
  // event line names the compiler (via `compiler.options.name`) and
  // the rule count drained from the store. Off by default — no
  // production noise unless explicitly enabled.
  it('emits a DEBUG trace line when cassida:plugin is enabled', () => {
    const writes: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stderr.write;
    const prevDebug = process.env.DEBUG;
    process.env.DEBUG = 'cassida:plugin';
    try {
      const { compiler, fireThisCompilation, fireProcessAssets } = createSyntheticCompiler();
      new CassidaWebpackPlugin({ layer: 'cas' }).apply(compiler as never);
      fireThisCompilation();
      fireProcessAssets();
    } finally {
      if (prevDebug === undefined) delete process.env.DEBUG;
      else process.env.DEBUG = prevDebug;
      process.stderr.write = origWrite;
    }
    expect(writes.join('')).toMatch(/\[cassida:plugin\] processAssets/);
    expect(writes.join('')).toMatch(/rules=0/);
  });
});
