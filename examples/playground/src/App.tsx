import { useState } from 'react';
import { cas, type CassChain } from '@cassida/core';
import { tokens } from './tokens';

// Phase 6c-2: same-file style mixins. Compose via plain functions.
const withCard = (c: CassChain) =>
  c.padding(16).borderRadius(8).backgroundColor('#fff');

const withInteractive = (c: CassChain) =>
  c.cursor('pointer').transition('transform .15s ease-out')
    .hover(h => h.transform('translateY(-1px)'));

const theme = {
  primary: 'crimson',
  accent: 'rebeccapurple',
};

const BASE = 8;

const cardPreset = {
  padding: 12,
  borderRadius: 8,
  backgroundColor: '#fff',
};

export default function App() {
  const [hue, setHue] = useState<number>(180);
  const dynamicColor = `hsl(${hue} 80% 55%)`;

  return (
    <main {...cas().padding(BASE * 3, 'px').maxWidth(720).props}>
      <h1 {...cas().color('red').fontSize(28).props}>
        Hello FSS — this should be red.
      </h1>

      <p {...cas().color('#444').marginTop(BASE).props}>
        path.evaluate sees BASE = 8, so this margin-top is statically{' '}
        <code>8px</code>. No CSS variable, no inline style — just a hash class.
      </p>

      <p {...cas().color('blue').color('green').props}>
        LIFO check: green wins, blue is gone from CSS entirely.
      </p>

      <h2 {...cas().color(theme.primary).marginTop(24).fontSize(20).props}>
        Dynamic value (theme.primary)
      </h2>
      <p {...cas().color(theme.accent).props}>
        theme.accent → CSS variable. Inspect: single class with{' '}
        <code>color: var(...)</code>; the actual color is in inline style.
      </p>

      <p {...cas().color(dynamicColor).marginTop(16).props}>
        Slider-driven <code>hsl({hue}, 80%, 55%)</code>. Move the slider:
      </p>
      <input
        type="range"
        min="0"
        max="360"
        value={hue}
        onChange={(e) => setHue(Number(e.target.value))}
      />

      <h2 {...cas().marginTop(32).fontSize(20).props}>Phase 2 — modifiers</h2>

      <div
        {...cas()
          .marginTop(16)
          .accentColor('crimson')
          .aspectRatio('16/9')
          .maxWidth(320)
          .backgroundColor('#eee')
          .props}
      >
        Phase 6b — auto-generated methods (aspectRatio, accentColor) work end-to-end.
      </div>

      <div {...cas(cardPreset).marginTop(16).color('#222').props}>
        Phase 6c-1: <code>cas(cardPreset)</code> — preset constant injected at
        the chain root, then refined with chain methods. Same hash whether the
        preset lives in this file or another.
      </div>

      <div {...cas.unsafe({ background: 'linear-gradient(45deg,#fafafa,#e8e8e8)' }).marginTop(16).padding(12).props}>
        Phase 6c-1: <code>cas.unsafe(...)</code> — `background` shorthand is
        rejected by the safe surface; opting into <code>unsafe</code> bypasses
        registry validation. Use sparingly.
      </div>

      <div
        {...cas()
          .marginTop(16)
          .padding(12)
          .backgroundColor('#fff')
          .transform('rotate(-1deg) scale(0.99)')
          .transition('transform .2s ease-out')
          .hover(c => c.transform('rotate(0deg) scale(1)'))
          .props}
      >
        Phase 6c-3: opaque <code>transform</code> + <code>transition</code>
        shorthands. Hover the box; the transform animates because
        <code>transform</code> is animatable in the spec.
      </div>

      <div
        {...cas()
          .marginTop(16)
          .padding(12)
          .set('--brand-scale', 1.5)
          .set('-webkit-tap-highlight-color', 'transparent')
          .backgroundColor('#fff')
          .props}
      >
        Phase 6c-3: <code>set('--brand-scale', 1.5)</code> writes a CSS custom
        property; <code>set('-webkit-tap-highlight-color', 'transparent')</code>
        reaches a vendor-only API that lightningcss won't autoprefix.
      </div>

      <button {...withInteractive(withCard(cas())).marginTop(16).fontSize(14).props}>
        Phase 6c-2: <code>withInteractive(withCard(cas())).fontSize(14)</code>
        — nested same-file function composition. The mixins layer in source
        order, then chain methods refine. One element, one class, one hash.
      </button>

      <button
        {...cas()
          .padding(12)
          .borderRadius(6)
          .borderWidth(0)
          .backgroundColor('#1a73e8')
          .color('white')
          .cursor('pointer')
          .fontSize(16)
          .hover(c => c.backgroundColor('#1557b0'))
          .focus(c => c.backgroundColor('#0e3f87'))
          .active(c => c.backgroundColor('#0a2c5e'))
          .props}
      >
        Hover / focus / press me
      </button>

      <p
        {...cas()
          .marginTop(16)
          .fontSize(14)
          .media('(min-width: 1024px)', c => c.fontSize(24))
          .media('(min-width: 480px)', c => c.fontSize(16))
          .media('(min-width: 768px)', c => c.fontSize(20))
          .props}
      >
        Resize: this paragraph grows 14 → 16 → 20 → 24 px across breakpoints.
        Source order is intentionally scrambled — mobile-first sort puts the
        @media blocks in numerical ascending order in the output CSS.
      </p>

      <a
        href="#nope"
        {...cas()
          .color('#1a73e8')
          .on(':visited', c => c.color('#673ab7'))
          .hover(c => c.color('#0d4aa3'))
          .props}
      >
        Anchor with :hover and :visited.
      </a>

      <div
        {...cas()
          .marginTop(16)
          .padding(12)
          .backgroundColor('#fafafa')
          .hover(c =>
            c.media('(min-width: 768px)', c2 => c2.backgroundColor('#e0f7fa')),
          )
          .props}
      >
        Nested: hover only changes background past 768px (resize, then hover).
      </div>

      <div
        {...cas()
          .marginTop(16)
          .padding(12)
          .backgroundColor('#fff8e1')
          .media('(min-width: 768px)', c => c.paddingTop(32))
          .props}
      >
        Shorthand-then-longhand across a scope boundary: padding(12) here,
        paddingTop(32) only inside @media. Strict policy permits this because
        the longhand sits in a separate scope.
      </div>

      {/* Cross-file static evaluator demo — tokens are imported from
          ./tokens.ts and folded at build time into a single class.
          Verify in DevTools: only one `cas-XXXXXXXX` class, no inline
          `style` carrying these values. */}
      <button
        {...cas()
          .marginTop(tokens.spacing.md)
          .padding(tokens.spacing.sm, 'px')
          .borderRadius(tokens.radius)
          .backgroundColor(tokens.brand.primary)
          .color(tokens.brand.onPrimary)
          .borderWidth(0)
          .cursor('pointer')
          .props}
      >
        Build-time-folded design tokens
      </button>
    </main>
  );
}
