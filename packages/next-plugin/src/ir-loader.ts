/**
 * Webpack loader: post-SWC IR-comment substitution.
 *
 * Each `cas()` chain spread on the Rust side gets rewritten to
 *
 *   className={/* @cassida-ir:JSON *​/ "__CAS_PLACEHOLDER_N__"}
 *
 * This loader scans for those pairs, calls `compileOps` from the
 * existing JS compiler, replaces the placeholder string with the
 * resulting `cas-XXXXXXXX` class name, and stashes the
 * `CompiledRule[]` for the virtual CSS module to bundle.
 *
 * The loader must run on transformed `.tsx`/`.jsx` files AFTER SWC
 * but BEFORE minification — Next.js's `experimental.swcPlugins` is
 * applied during the SWC pass, and our `withCassida()` wraps the
 * Next.js webpack config to inject this loader in the right slot.
 */

import {
  compileOps,
  defaultRegistry,
  type CassPlugin,
  type CompiledRule,
  type Registry,
  type Op,
  type ShorthandPolicy,
} from '@cassida/compiler';

import { deleteRulesForFile, setRulesForFile } from './store.js';

/**
 * Compile-time options the loader receives from the Webpack rule.
 * Mirrors the subset of `NextCassidaOptions` that the runtime
 * needs at the per-file level.
 */
export interface IrLoaderOptions {
  readonly registry?: Registry;
  readonly shorthandPolicy?: ShorthandPolicy;
  readonly plugins?: readonly CassPlugin[];
  /**
   * Built-in macros (and any user-defined ones) forwarded to
   * `compileOps`. Run BEFORE `plugins` so the plugin pass sees the
   * macro-filled tree.
   *
   * Note: the SWC plugin (Rust → WASM, `@cassida/swc-plugin`) is
   * macro-agnostic. It emits raw IR comments only; macros are
   * applied here, in TypeScript, inside `rewriteIrComments`. If a
   * future iteration moves the macro pass into the SWC plugin for
   * speed, this contract becomes the boundary to migrate.
   */
  readonly macros?: readonly CassPlugin[];
}

/**
 * The IR comment + adjacent placeholder string. Captured groups:
 *   1: the JSON payload — non-greedy across any character set,
 *      including newlines, so a formatter or minifier that re-wraps
 *      the comment doesn't break the match.
 *   2: the placeholder index, used to keep the rewrite local — if
 *      a future SWC pass re-orders comments we still match each
 *      placeholder to its own comment.
 *
 * Quote style for the placeholder accepts `"`, `'`, or backtick:
 * downstream JS minifiers (esbuild, terser, swc-minifier) sometimes
 * normalise string literals, and the loader has to stay matched
 * regardless of the convention the host picked.
 */
const IR_PATTERN =
  /\/\*\s*@cassida-ir:([\s\S]+?)\s*\*\/\s*["'`]__CAS_PLACEHOLDER_(\d+)__["'`]/g;

/**
 * Pure transform: given a transformed JS source string and the
 * options, returns the post-substitution source plus the rules to
 * register with the store. Extracted from the loader proper so unit
 * tests can drive it without spinning up a Webpack mock.
 */
export function rewriteIrComments(
  source: string,
  options: IrLoaderOptions = {},
): { code: string; rules: CompiledRule[] } {
  const rules: CompiledRule[] = [];
  const compileOptions = {
    registry: options.registry ?? defaultRegistry,
    ...(options.shorthandPolicy !== undefined
      ? { shorthandPolicy: options.shorthandPolicy }
      : {}),
    ...(options.plugins ? { plugins: options.plugins } : {}),
    ...(options.macros ? { macros: options.macros } : {}),
  };
  const code = source.replace(IR_PATTERN, (_match, jsonPayload, _index) => {
    let ops: readonly Op[];
    try {
      ops = JSON.parse(jsonPayload) as readonly Op[];
    } catch (cause) {
      throw new Error(
        `[cassida/next-plugin] failed to parse IR JSON from SWC plugin output: ${(cause as Error).message}. ` +
          `Payload: ${jsonPayload.slice(0, 200)}${jsonPayload.length > 200 ? '…' : ''}`,
      );
    }
    const rule = compileOps(ops, compileOptions);
    rules.push(rule);
    return JSON.stringify(rule.className);
  });
  return { code, rules };
}

/**
 * Webpack loader entry. `function(this, source)` shape so Webpack's
 * loader runner can bind `this` to the loader context.
 *
 * Side effects:
 *   - calls `setRulesForFile(this.resourcePath, rules, compilerName)`
 *     so the virtual CSS module sees the latest rules per file,
 *     namespaced by which webpack compiler ran this loader pass
 *   - returns the transformed source (placeholders → class names)
 */
function cassidaIrLoader(
  this: WebpackLoaderContext,
  source: string,
): string {
  // The loader has a side-effect — it mutates a module-singleton
  // store. Webpack's persistent cache would otherwise skip this
  // loader on cold starts when the file's bytes haven't changed,
  // and the rule set in memory would be missing those files'
  // contributions to the CSS bundle. A non-cacheable mark forces
  // the loader to re-run every build; the inner `compileOps` work
  // is itself cheap and deterministic, so the cost is acceptable
  // for Phase 1.
  //
  // Phase 1.x architectural follow-up: migrate to a Webpack plugin
  // that harvests rules from `compilation.moduleGraph` (rules
  // travel via `module.buildInfo`) so the loader can stay
  // cacheable. The same migration also fixes the file-deletion
  // stale-rules window documented on `store.ts`.
  this.cacheable?.(false);

  const options = (typeof this.getOptions === 'function'
    ? (this.getOptions() as IrLoaderOptions | undefined)
    : undefined) ?? {};

  // Next.js names its compilers (`'client'`, `'server'`, `'edge'`,
  // `'middleware'`); we route writes into the namespace for whichever
  // compiler is running this loader pass. The default read path
  // (`allRules()`) still merges every namespace, so Server-only rules
  // reach the Client bundle — see store.ts for the bridge rationale.
  const compilerName = this._compiler?.options?.name ?? null;

  // Short-circuit when the file doesn't carry any Cassida IR. Avoids
  // a regex pass on every JS file in the bundle (most won't have
  // any).
  //
  // Critically, we ALSO drop any previously-registered rules for this
  // file: a `cas()` chain the user deleted between two HMR
  // re-transforms would otherwise keep contributing rules to the CSS
  // bundle until the build was restarted.
  if (!source.includes('@cassida-ir:')) {
    deleteRulesForFile(this.resourcePath, compilerName);
    return source;
  }

  const { code, rules } = rewriteIrComments(source, options);
  setRulesForFile(this.resourcePath, rules, compilerName);
  return code;
}

export default cassidaIrLoader;

/**
 * Subset of `webpack.LoaderContext` that the loader actually uses.
 * Inlined so the package doesn't pull in `webpack` as a hard
 * dependency at type-check time — consumers' Next.js installs ship
 * webpack and the runtime instance matches this shape.
 *
 * `_compiler` is a documented (but underscore-prefixed) webpack
 * loader-context property. Next.js sets `compiler.options.name`
 * (`'client'` / `'server'` / `'edge'` / `'middleware'`); we route
 * store writes into that namespace so the lifecycle hooks in
 * `CassidaWebpackPlugin` can clear them per-compiler.
 */
interface WebpackLoaderContext {
  readonly resourcePath: string;
  readonly _compiler?: { readonly options?: { readonly name?: string } };
  getOptions?: () => unknown;
  cacheable?: (flag: boolean) => void;
}
