import { useState } from 'react';
import { fss } from '@fss/core';

const theme = {
  primary: 'crimson',
  accent: 'rebeccapurple',
};

export default function App() {
  const [hue, setHue] = useState<number>(180);
  const dynamicColor = `hsl(${hue} 80% 55%)`;

  return (
    <main {...fss().padding(24)}>
      <h1 {...fss().color('red').fontSize(28)}>
        Hello FSS — this should be red.
      </h1>

      <p {...fss().color('#444').marginTop(12)}>
        Open DevTools: this paragraph should have a single class like{' '}
        <code>fss-xxxxxxxx</code>, and the matching rule should live inside an{' '}
        <code>@layer fss</code> block.
      </p>

      <p {...fss().color('blue').color('green')}>
        LIFO check: this paragraph should be{' '}
        <strong>green</strong> (the second .color() wins, not blue).
      </p>

      <h2 {...fss().color(theme.primary).marginTop(24).fontSize(20)}>
        Dynamic value (from theme.primary)
      </h2>
      <p {...fss().color(theme.accent)}>
        This paragraph's color comes from a JS variable. Inspect: it should
        have a single <code>fss-...</code> class, and the rule should reference{' '}
        <code>var(--fss-...-color)</code>. The actual color is supplied via
        the element's inline style.
      </p>

      <p {...fss().color(dynamicColor).marginTop(16)}>
        This paragraph's color is a state-driven{' '}
        <code>hsl({hue}, 80%, 55%)</code>. Move the slider to update.
      </p>
      <input
        type="range"
        min="0"
        max="360"
        value={hue}
        onChange={(e) => setHue(Number(e.target.value))}
      />
    </main>
  );
}
