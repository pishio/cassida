import { fss } from '@fss/core';

export default function App() {
  return (
    <main {...fss().padding(24)}>
      <h1 {...fss().color('red').fontSize(28)}>
        Hello FSS — this should be red.
      </h1>
      <p {...fss().color('#444').marginTop(12)}>
        Open DevTools: this paragraph should have a single class like{' '}
        <code>fss-xxxxxxxx</code>, and the matching rule should live inside an
        <code>@layer fss</code> block.
      </p>
      <p {...fss().color('blue').color('green')}>
        LIFO check: text below "should be red" should be{' '}
        <strong>green</strong> (the second .color() wins, not blue).
      </p>
    </main>
  );
}
