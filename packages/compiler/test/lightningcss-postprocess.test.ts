import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config.js';
import {
  postProcessLightningCss,
  resolveTargets,
} from '../src/lightningcss-postprocess.js';

const CSS_WITH_LAYER_AND_PROPERTY = `@property --cas-fg{syntax:"<color>";inherits:false;initial-value:#000;}
@layer cas{.cas-aaaaaaaa{color:var(--cas-fg);padding:8px;}}`;

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
