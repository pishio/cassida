import { useState } from 'react';
import { fss } from '@fss/core';

const theme = {
  primary: 'crimson',
  accent: 'rebeccapurple',
};

const BASE = 8;

export default function App() {
  const [hue, setHue] = useState<number>(180);
  const dynamicColor = `hsl(${hue} 80% 55%)`;

  return (
    <main {...fss().padding(BASE * 3, 'px').maxWidth(720)}>
      <h1 {...fss().color('red').fontSize(28)}>
        Hello FSS — this should be red.
      </h1>

      <p {...fss().color('#444').marginTop(BASE)}>
        path.evaluate sees BASE = 8, so this margin-top is statically{' '}
        <code>8px</code>. No CSS variable, no inline style — just a hash class.
      </p>

      <p {...fss().color('blue').color('green')}>
        LIFO check: green wins, blue is gone from CSS entirely.
      </p>

      <h2 {...fss().color(theme.primary).marginTop(24).fontSize(20)}>
        Dynamic value (theme.primary)
      </h2>
      <p {...fss().color(theme.accent)}>
        theme.accent → CSS variable. Inspect: single class with{' '}
        <code>color: var(...)</code>; the actual color is in inline style.
      </p>

      <p {...fss().color(dynamicColor).marginTop(16)}>
        Slider-driven <code>hsl({hue}, 80%, 55%)</code>. Move the slider:
      </p>
      <input
        type="range"
        min="0"
        max="360"
        value={hue}
        onChange={(e) => setHue(Number(e.target.value))}
      />

      <h2 {...fss().marginTop(32).fontSize(20)}>Phase 2 — modifiers</h2>

      <button
        {...fss()
          .padding(12)
          .borderRadius(6)
          .borderWidth(0)
          .backgroundColor('#1a73e8')
          .color('white')
          .cursor('pointer')
          .fontSize(16)
          .hover(c => c.backgroundColor('#1557b0'))
          .focus(c => c.backgroundColor('#0e3f87'))
          .active(c => c.backgroundColor('#0a2c5e'))}
      >
        Hover / focus / press me
      </button>

      <p
        {...fss()
          .marginTop(16)
          .fontSize(14)
          .media('(min-width: 768px)', c => c.fontSize(20))}
      >
        Resize the window: this paragraph grows from 14px to 20px past 768px.
      </p>

      <a
        href="#nope"
        {...fss()
          .color('#1a73e8')
          .on(':visited', c => c.color('#673ab7'))
          .hover(c => c.color('#0d4aa3'))}
      >
        Anchor with :hover and :visited.
      </a>

      <div
        {...fss()
          .marginTop(16)
          .padding(12)
          .backgroundColor('#fafafa')
          .hover(c =>
            c.media('(min-width: 768px)', c2 => c2.backgroundColor('#e0f7fa')),
          )}
      >
        Nested: hover only changes background past 768px (resize, then hover).
      </div>
    </main>
  );
}
