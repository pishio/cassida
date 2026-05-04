import {
  DYNAMIC_PLACEHOLDER,
  type CompiledRule,
  type DynamicSlot,
  type Op,
  type PropertyBag,
  type Scope,
  type ScopeBag,
} from './types.js';
import type { Registry } from './registry.js';
import { Canonicalizer } from './canonicalizer.js';
import { hash, type HashOptions } from './hasher.js';
import { defaultPropertyMeta, type PropertyMeta } from './property-spec.js';
import type { ShorthandPolicy } from './config.js';
import { applyPlugins, type CassPlugin, type PluginContext } from './plugin.js';

export interface CompileOptions extends HashOptions {
  readonly registry: Registry;
  /**
   * Override the property → metadata table used to enrich dynamic slots
   * with `animatable` / `syntax` / `initialValue`. Defaults to the
   * canonical spec's own metadata; only override when extending the
   * registry with custom properties that need their own `@property`
   * descriptors.
   */
  readonly propertyMeta?: Readonly<Record<string, PropertyMeta>>;
  /**
   * Policy for shorthand ↔ longhand co-occurrence within a single
   * scope. Defaults to `'strict'`. See `ShorthandPolicy` in `config.ts`.
   */
  readonly shorthandPolicy?: ShorthandPolicy;
  /**
   * Build-time plugins. Each plugin receives the post-collapse
   * `ScopeBag` tree and returns a new tree; the className is derived
   * from the post-plugin form. Plugins run in array order.
   */
  readonly plugins?: readonly CassPlugin[];
  /**
   * Subset of resolved config exposed to plugins through their
   * `PluginContext`. Optional — if omitted, plugins receive a minimal
   * default context.
   */
  readonly pluginContext?: PluginContext;
}

/**
 * Pure: an `Op[]` chain in, a deterministic `CompiledRule` out.
 *
 * The canonical key is computed from the *shape* of the scope tree (not
 * concrete dynamic values), so chains with the same set of properties
 * and modifiers collapse to the same className regardless of the
 * dynamic source values. Each dynamic slot ends up in `dynamics` with a
 * fresh `--<className>-<scope-segments>-<prop>` variable name; the
 * parser uses these to populate the element's inline style.
 */
export function compileOps(ops: readonly Op[], options: CompileOptions): CompiledRule {
  const canon = new Canonicalizer(options.registry, options.shorthandPolicy ?? 'strict');
  const rawTree = canon.collapse(ops);

  // Plugin pipeline: between collapse and canonicalKey so that any
  // tree shape change (e.g. wrapping :hover in @media (hover: hover))
  // propagates into the className. This is the FSS bijection
  // contract: same hash ⇔ same final-state CSS.
  const ctx: PluginContext = options.pluginContext ?? {
    config: { layer: 'fss', importSource: '@cassida/core' },
  };
  const transformedTree = applyPlugins(rawTree, options.plugins, ctx);

  const canonical = canon.canonicalKey(transformedTree);
  const className = hash(canonical, options);

  const meta = options.propertyMeta ?? defaultPropertyMeta;
  const dynamics: DynamicSlot[] = [];
  const tree = substituteVars(transformedTree, className, meta, dynamics, []);

  return {
    className,
    tree,
    canonical,
    dynamics: Object.freeze(dynamics),
  };
}

function substituteVars(
  node: ScopeBag,
  className: string,
  meta: Readonly<Record<string, PropertyMeta>>,
  dynamics: DynamicSlot[],
  scopePath: readonly Scope[],
): ScopeBag {
  const newBag: Record<string, string> = {};
  for (const prop of Object.keys(node.bag).sort()) {
    const val = node.bag[prop]!;
    if (val === DYNAMIC_PLACEHOLDER) {
      const varName = makeVarName(className, scopePath, prop);
      newBag[prop] = `var(${varName})`;
      const m = meta[prop];
      dynamics.push({
        property: prop,
        varName,
        sourceId: node.slots[prop]!,
        animatable: m?.animatable ?? false,
        syntax: m?.syntax,
        initialValue: m?.initialValue,
        scopePath: [...scopePath],
      });
    } else {
      newBag[prop] = val;
    }
  }

  const newChildren: ScopeBag[] = node.children.map((c) =>
    substituteVars(c, className, meta, dynamics, [...scopePath, c.scope!]),
  );

  return {
    scope: node.scope,
    bag: Object.freeze(newBag) as PropertyBag,
    slots: node.slots,
    children: Object.freeze(newChildren),
  };
}

function makeVarName(
  className: string,
  scopePath: readonly Scope[],
  prop: string,
): string {
  const parts = [className];
  for (const s of scopePath) {
    parts.push(scopeToVarSegment(s));
  }
  parts.push(prop);
  return '--' + parts.join('-');
}

function scopeToVarSegment(s: Scope): string {
  if (s.kind === 'pseudo') return s.selector.replace(/:/g, '_');
  if (s.kind === 'media') return 'm-' + s.query.replace(/[^a-zA-Z0-9]/g, '_');
  return 'r-' + s.selector.replace(/[^a-zA-Z0-9]/g, '_');
}
