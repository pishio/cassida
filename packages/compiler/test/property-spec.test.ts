import { describe, expect, it } from 'vitest';
import { canonicalSpec, defaultCanonicals, defaultRegistry, defaultAliases } from '../src/index.js';

describe('property-spec ↔ defaultCanonicals consistency', () => {
  it('exposes every spec method in the runtime registry', () => {
    for (const name of Object.keys(canonicalSpec)) {
      expect(defaultCanonicals[name], name).toBeDefined();
    }
  });

  it('has matching CSS property names', () => {
    for (const [name, spec] of Object.entries(canonicalSpec)) {
      expect(defaultCanonicals[name]!.property).toBe(spec.property);
    }
  });

  it('preserves the same format function reference (no wrapping)', () => {
    for (const [name, spec] of Object.entries(canonicalSpec)) {
      expect(defaultCanonicals[name]!.format).toBe(spec.format);
    }
  });

  it('propagates syntax metadata where present', () => {
    expect(defaultCanonicals['color']!.syntax).toBe('<color>');
    expect(defaultCanonicals['marginTop']!.syntax).toBe('<length>');
    // entries without syntax in the spec must not have one in the registry
    expect(defaultCanonicals['display']!.syntax).toBeUndefined();
  });

  it('does not surface aliases in defaultCanonicals', () => {
    for (const alias of Object.keys(defaultAliases)) {
      expect(alias in defaultCanonicals).toBe(false);
    }
  });

  it('does surface aliases in the flat defaultRegistry', () => {
    for (const alias of Object.keys(defaultAliases)) {
      expect(alias in defaultRegistry).toBe(true);
    }
  });
});
