import type React from 'react';
import { cas } from '@cassida/core';

/**
 * Root index page at `/`. The actual redirect happens inline in
 * `index.html` before hydration (see the `<script>` block there) so
 * JS-enabled visitors never see this component. The fallback markup
 * below is what crawlers and JS-disabled users get.
 */
export default function RedirectIndex(): React.JSX.Element {
  return (
    <main {...cas().padding(24).fontFamily('system-ui, sans-serif').props}>
      <h1 {...cas().fontSize(28).marginBottom(8).props}>Cassida</h1>
      <p {...cas().marginBottom(4).props}>The compiler-driven single class CSS engine.</p>
      <p {...cas().color('#4b5563').marginBottom(16).props}>
        コンパイラ駆動の単一クラス CSS エンジン。
      </p>
      <ul {...cas().display('flex').flexDirection('column').gap(4).props}>
        <li>
          <a href="en/">Read in English →</a>
        </li>
        <li>
          <a href="ja/">日本語で読む →</a>
        </li>
      </ul>
    </main>
  );
}
