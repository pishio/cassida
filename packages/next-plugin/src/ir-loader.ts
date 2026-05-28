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

import { setRulesForFile } from './store.js';

/**
 * Compile-time options the loader receives from the Webpack rule.
 * Mirrors the subset of `NextCassidaOptions` that the runtime
 * needs at the per-file level.
 */
export interface IrLoaderOptions {
  readonly registry?: Registry;
  readonly shorthandPolicy?: ShorthandPolicy;
  readonly plugins?: readonly CassPlugin[];
}

/**
 * The IR comment + adjacent placeholder string. Captured groups:
 *   1: the JSON payload (any chars except `*` / `\n` between the
 *      `@cassida-ir:` tag and the comment terminator)
 *   2: the placeholder index, used to keep the rewrite local — if
 *      a future SWC pass re-orders comments we still match each
 *      placeholder to its own comment.
 *
 * The JSON is matched non-greedily so an array like
 * `[{"args":["*"]}]` doesn't run away into the next comment.
 */
const IR_PATTERN =
  /\/\*\s*@cassida-ir:(.+?)\s*\*\/\s*"__CAS_PLACEHOLDER_(\d+)__"/g;

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
 *   - calls `setRulesForFile(this.resourcePath, rules)` so the
 *     virtual CSS module sees the latest rules per file
 *   - returns the transformed source (placeholders → class names)
 */
function cassidaIrLoader(
  this: WebpackLoaderContext,
  source: string,
): string {
  const options = (typeof this.getOptions === 'function'
    ? (this.getOptions() as IrLoaderOptions | undefined)
    : undefined) ?? {};

  // Short-circuit when the file doesn't carry any Cassida IR. Avoids
  // a regex pass on every JS file in the bundle (most won't have
  // any).
  if (!source.includes('@cassida-ir:')) {
    return source;
  }

  const { code, rules } = rewriteIrComments(source, options);
  setRulesForFile(this.resourcePath, rules);
  return code;
}

export default cassidaIrLoader;

/**
 * Subset of `webpack.LoaderContext` that the loader actually uses.
 * Inlined so the package doesn't pull in `webpack` as a hard
 * dependency at type-check time — consumers' Next.js installs ship
 * webpack and the runtime instance matches this shape.
 */
interface WebpackLoaderContext {
  readonly resourcePath: string;
  getOptions?: () => unknown;
}
