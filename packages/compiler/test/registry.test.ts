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
    for (const name of Object.keys(defaultCanonicals)) {
      expect(name).not.toMatch(/^(mt|mr|mb|ml|pt|pr|pb|pl|bg|font|background)$/);
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
