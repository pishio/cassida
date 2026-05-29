/**
 * Unit tests for `CassidaWebpackPlugin`. We don't drive a real
 * webpack compilation here — the full end-to-end signal lives in the
 * `e2e/next-app/` fixture's `next build`. These tests verify the
 * plugin's local contract: when `processAssets` fires, the virtual
 * module's content reflects `allRules(compilation)` at that moment.
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
  compilation: SyntheticCompilation;
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
    compilation,
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

    const { compiler, compilation, fireThisCompilation, fireProcessAssets } =
      createSyntheticCompiler();
    // Per-compilation store: rules are keyed off the synthetic
    // compilation the plugin will receive, not a global singleton.
    setRulesForFile(compilation, '/abs/a.tsx', rules);

    new CassidaWebpackPlugin({ layer: 'cas' }).apply(compiler as never);
    fireThisCompilation();
    fireProcessAssets();

    expect(MockVirtualModulesPlugin.__writes).toHaveLength(1);
    const content = MockVirtualModulesPlugin.__writes[0]!.content;
    expect(content).toMatch(/@layer\s+cas/);
    expect(content).toMatch(/\.cas-[0-9a-f]+/);
    expect(content).toContain('color:red');
  });

  it('keeps two compilations isolated — Server and Client write distinct virtual.css', () => {
    // The whole point of the per-compilation refactor. Drive two
    // independent synthetic compilers (think Server + Client) and
    // assert that each compilation's processAssets emits only its
    // own rules.
    const ir = JSON.stringify([{ method: 'color', args: ['red'] }]);
    const { rules: rulesServer } = rewriteIrComments(
      `const x = /* @cassida-ir:${ir}*/ "__CAS_PLACEHOLDER_0__";`,
    );
    const irBlue = JSON.stringify([{ method: 'color', args: ['blue'] }]);
    const { rules: rulesClient } = rewriteIrComments(
      `const x = /* @cassida-ir:${irBlue}*/ "__CAS_PLACEHOLDER_0__";`,
    );

    const server = createSyntheticCompiler();
    const client = createSyntheticCompiler();
    setRulesForFile(server.compilation, '/abs/server-only.tsx', rulesServer);
    setRulesForFile(client.compilation, '/abs/page.tsx', rulesClient);

    const plugin = new CassidaWebpackPlugin({ layer: 'cas' });
    plugin.apply(server.compiler as never);
    plugin.apply(client.compiler as never);
    server.fireThisCompilation();
    client.fireThisCompilation();
    server.fireProcessAssets();
    client.fireProcessAssets();

    // Each apply() registers its own VirtualModulesPlugin instance;
    // two compiles → two writes.
    expect(MockVirtualModulesPlugin.__writes).toHaveLength(2);
    const serverCss = MockVirtualModulesPlugin.__writes[0]!.content;
    const clientCss = MockVirtualModulesPlugin.__writes[1]!.content;
    expect(serverCss).toContain('color:red');
    expect(serverCss).not.toContain('color:blue');
    expect(clientCss).toContain('color:blue');
    expect(clientCss).not.toContain('color:red');
  });
});
