import { beforeAll, describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config.js';
import {
  postProcessLightningCss,
  resolveTargets,
} from '../src/lightningcss-postprocess.js';

const CSS_WITH_LAYER_AND_PROPERTY = `@property --cas-fg{syntax:"<color>";inherits:false;initial-value:#000;}
@layer cas{.cas-aaaaaaaa{color:var(--cas-fg);padding:8px;}}`;

// A representative slice of what Cassida actually emits: an @property block
// for an animatable dynamic value, wrapped `@layer cas` rules using
// properties that force vendor prefixes on older engines (user-select,
// backdrop-filter, position: sticky), plus a var() reference into the
// registered property. Exercises the exact surfaces #67 worries about.
const CASSIDA_SHAPED_CSS = `@property --cas-fg{syntax:"<color>";inherits:false;initial-value:#000;}
@layer cas{.cas-11111111{user-select:none;position:sticky;top:0;backdrop-filter:blur(4px);color:var(--cas-fg);}}`;

// An intentionally old browserslist that forces -webkit-/-moz- prefixes.
// Explicit versions (not "defaults" / "last N") keep the resolved target
// set stable regardless of caniuse-lite data updates, so the snapshot below
// only moves when lightningcss itself changes its prefixing or at-rule
// preservation — exactly the regression this fixture is meant to catch.
const OLD_TARGETS_QUERY = 'safari 10.1, chrome 49, firefox 50, ios_saf 10.3';

describe('postProcessLightningCss', () => {
  it('preserves both @layer cas and @property in the output', () => {
    const out = postProcessLightningCss(
      CSS_WITH_LAYER_AND_PROPERTY,
      '/virtual.css',
      defaultConfig,
      null,
    );
    expect(out).toMatch(/@layer cas/);
    expect(out).toMatch(/@property --cas-fg/);
  });

  it('keeps the @property block outside the @layer wrap', () => {
    const out = postProcessLightningCss(
      CSS_WITH_LAYER_AND_PROPERTY,
      '/virtual.css',
      defaultConfig,
      null,
    );
    const propertyIdx = out.indexOf('@property');
    const layerIdx = out.indexOf('@layer');
    expect(propertyIdx).toBeGreaterThanOrEqual(0);
    expect(layerIdx).toBeGreaterThanOrEqual(0);
    expect(propertyIdx).toBeLessThan(layerIdx);
  });

  it('emits short output when minify is true (default)', () => {
    const out = postProcessLightningCss(
      CSS_WITH_LAYER_AND_PROPERTY,
      '/virtual.css',
      defaultConfig,
      null,
    );
    expect(out.length).toBeLessThanOrEqual(CSS_WITH_LAYER_AND_PROPERTY.length + 16);
  });

  it('roundtrips simple class+declaration semantics', () => {
    const out = postProcessLightningCss(
      '@layer cas{.cas-a{color:red;}}',
      '/v.css',
      defaultConfig,
      null,
    );
    expect(out).toContain('.cas-a');
    expect(out).toContain('red');
  });

  it('vendor-prefixes when targets demand it', () => {
    const targets = resolveTargets('safari 14, chrome 70', '/');
    const out = postProcessLightningCss(
      '@layer cas{.cas-a{user-select:none;}}',
      '/v.css',
      defaultConfig,
      targets,
    );
    expect(out).toMatch(/-webkit-user-select|user-select/);
  });
});

describe('resolveTargets', () => {
  it('returns null for unknown root with no project file (silent fallback)', () => {
    const t = resolveTargets('defaults', '/nonexistent/path');
    expect(t === null || typeof t === 'object').toBe(true);
  });

  it('returns a Targets object for an explicit query', () => {
    const t = resolveTargets('chrome 100', '/');
    expect(t).not.toBeNull();
  });
});

// #67: v0.12 turned lightningcss on by default. The survival tests above run
// with `null` targets (lightningcss' own default); these pin behaviour
// against an explicit, prefix-forcing browserslist — the case that actually
// stresses `@layer` / `@property` preservation, since lightningcss rewrites
// far more when it has real targets to prefix for.
//
// The inline snapshot below is expected to move when lightningcss is bumped;
// regenerate it with:
//   pnpm --filter @cassida/compiler exec vitest run -u lightningcss-postprocess
describe('lightningcss survival across real browserslist targets (#67)', () => {
  // Resolve targets + post-process once; all three assertions read this same
  // output (lightningcss is deterministic for a fixed input + target set).
  let out: string;
  beforeAll(() => {
    const targets = resolveTargets(OLD_TARGETS_QUERY, '/');
    expect(targets).not.toBeNull();
    out = postProcessLightningCss(
      CASSIDA_SHAPED_CSS,
      '/virtual.css',
      defaultConfig,
      targets,
    );
  });

  it('preserves @layer cas and @property while prefixing for an old target', () => {
    // Cascade layer + Houdini @property both survive the prefixing pass.
    expect(out).toMatch(/@layer cas\{/);
    expect(out).toMatch(/@property --cas-fg\{/);
    // The @property descriptors stay intact (a dropped syntax/inherits would
    // silently break CSS-var interpolation for animatable values).
    expect(out).toMatch(/syntax:"<color>"/);
    expect(out).toMatch(/inherits:false/);
    // The var() reference into the registered property is untouched.
    expect(out).toContain('var(--cas-fg)');
  });

  it('emits the vendor prefixes the old target requires, with unprefixed fallbacks', () => {
    expect(out).toContain('-webkit-user-select:none');
    expect(out).toContain('-moz-user-select:none');
    expect(out).toContain('-webkit-backdrop-filter:blur(4px)');
    expect(out).toContain('position:-webkit-sticky');
    // Unprefixed fallbacks remain after the prefixed variants.
    expect(out).toContain('user-select:none');
    expect(out).toContain('backdrop-filter:blur(4px)');
    expect(out).toContain('position:sticky');
  });

  it('pins the exact post-lightningcss shape for the old target', () => {
    expect(out).toMatchInlineSnapshot(`"@property --cas-fg{syntax:"<color>";inherits:false;initial-value:#000}@layer cas{.cas-11111111{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);color:var(--cas-fg);position:-webkit-sticky;position:sticky;top:0}}"`);
  });
});
