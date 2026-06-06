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

describe('property-spec — CSS shorthand coverage', () => {
  // Phase 1 surfaced a gap: chains like `.border('1px solid #ddd')`
  // failed because no canonical entry existed. The fix adds entries
  // for the major shorthands and wires their longhand families so the
  // shorthand-policy guard fires on co-occurrence.
  const shorthandsWithFamily: ReadonlyArray<[string, string]> = [
    ['border', 'border'],
    ['font', 'font'],
    ['flex', 'flex'],
    ['grid', 'grid'],
    ['outline', 'outline'],
  ];

  for (const [method, family] of shorthandsWithFamily) {
    it(`registers ${method} as a shorthand of family "${family}"`, () => {
      const entry = defaultRegistry[method];
      expect(entry, method).toBeDefined();
      expect(entry!.shorthandFamily).toBe(family);
    });
  }

  it('border family: borderWidth / borderStyle / borderColor declare longhandFamily "border"', () => {
    for (const m of ['borderWidth', 'borderStyle', 'borderColor']) {
      expect(defaultRegistry[m]!.longhandFamily, m).toBe('border');
    }
  });

  it('font family: fontFamily / fontSize / fontWeight / lineHeight declare longhandFamily "font"', () => {
    for (const m of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight']) {
      expect(defaultRegistry[m]!.longhandFamily, m).toBe('font');
    }
  });

  it('font family: fontStyle / fontVariant / fontStretch also declare longhandFamily "font"', () => {
    // The `font` shorthand resets these too per CSS spec, so the
    // family guard needs to see them. Promoted into the hand-curated
    // set as part of the 0.10.x shorthand-coverage pass.
    for (const m of ['fontStyle', 'fontVariant', 'fontStretch']) {
      expect(defaultRegistry[m]!.longhandFamily, m).toBe('font');
    }
  });

  it('outline family: outlineWidth / outlineStyle / outlineColor declare longhandFamily "outline"', () => {
    // Promoted out of the generated set so the policy guard fires on
    // `outline ↔ outlineWidth / outlineStyle / outlineColor` mixes.
    for (const m of ['outlineWidth', 'outlineStyle', 'outlineColor']) {
      expect(defaultRegistry[m]!.longhandFamily, m).toBe('outline');
    }
  });

  it('border / outline shorthand entries are animatable:false', () => {
    // `@property` only accepts a restricted syntax grammar; the
    // shorthand's `<line-width> || <line-style> || <color>` is
    // invalid syntax there. Marking them `animatable:false` skips
    // the `@property` emission path so the CSS parser doesn't
    // silently drop the declaration.
    expect(defaultRegistry['border']!.animatable).toBe(false);
    expect(defaultRegistry['outline']!.animatable).toBe(false);
  });

  it('flex family: flexGrow / flexShrink / flexBasis declare longhandFamily "flex"', () => {
    for (const m of ['flexGrow', 'flexShrink', 'flexBasis']) {
      expect(defaultRegistry[m]!.longhandFamily, m).toBe('flex');
    }
  });

  it('flexDirection is NOT a flex-shorthand longhand (different family)', () => {
    expect(defaultRegistry['flexDirection']!.longhandFamily).toBeUndefined();
  });

  it('shorthand formatters produce the user-supplied string verbatim', () => {
    // Passthrough format: the user already knows what they want. The
    // bag value is exactly what they wrote.
    const ops = (method: string, value: string) => [{ method, args: [value] }] as const;
    expect(defaultRegistry['border']!.format('1px solid #ddd')).toBe('1px solid #ddd');
    expect(defaultRegistry['font']!.format('italic bold 16px/1.4 sans-serif')).toBe(
      'italic bold 16px/1.4 sans-serif',
    );
    expect(defaultRegistry['flex']!.format('1 1 0%')).toBe('1 1 0%');
    expect(defaultRegistry['outline']!.format('2px dashed red')).toBe('2px dashed red');
    expect(defaultRegistry['grid']!.format('auto-flow / 1fr 1fr')).toBe('auto-flow / 1fr 1fr');
    void ops; // silence unused-helper lint
  });
});
