import { describe, expect, it } from 'vitest';
import {
  defaultRegistry,
  defaultCanonicals,
  defaultAliases,
  expandAliases,
  type Registry,
  type RegistryEntry,
} from '../src/registry.js';

describe('default registry layout', () => {
  it('exposes only long-form names as canonicals', () => {
    // Names that historically failed for being alias-like or for being
    // intentionally banned from the safe surface. `font` is now a
    // legitimate CSS-shorthand canonical (the mega font shorthand) and
    // is therefore excluded from this guard; `background` remains an
    // intentional miss because we only expose `backgroundColor` —
    // `background` would set image / repeat / position / size / etc.,
    // which the family guard can't compensate for without longhand
    // entries for each subproperty.
    for (const name of Object.keys(defaultCanonicals)) {
      expect(name).not.toMatch(/^(mt|mr|mb|ml|pt|pr|pb|pl|bg|background)$/);
    }
  });

  it('every alias targets a real canonical', () => {
    for (const [alias, target] of Object.entries(defaultAliases)) {
      expect(defaultCanonicals[target], `alias ${alias}`).toBeDefined();
    }
  });

  it('alias entries share the exact same reference as their canonical', () => {
    expect(defaultRegistry['mt']).toBe(defaultRegistry['marginTop']);
    expect(defaultRegistry['bg']).toBe(defaultRegistry['backgroundColor']);
  });

  it('flattens canonicals + aliases into a single lookup', () => {
    expect(defaultRegistry['marginTop']).toBeDefined();
    expect(defaultRegistry['mt']).toBeDefined();
  });
});

describe('expandAliases', () => {
  const c: Registry = Object.freeze({
    color: { property: 'color', format: (v) => String(v) },
  });

  it('throws when an alias points to an unknown canonical', () => {
    expect(() => expandAliases(c, { c: 'colour' })).toThrow(/unknown canonical/);
  });

  it('throws when an alias shadows a canonical of the same name', () => {
    expect(() => expandAliases(c, { color: 'color' })).toThrow(/shadows/);
  });

  it('returns a frozen registry', () => {
    const r = expandAliases(c, { col: 'color' }) as Record<string, RegistryEntry>;
    expect(Object.isFrozen(r)).toBe(true);
  });
});
