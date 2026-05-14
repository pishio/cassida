import type React from 'react';

/**
 * Root index page at `/`. The actual redirect happens inline in
 * `index.html` before hydration (see the `<script>` block there) so
 * JS-enabled visitors never see this component. The fallback markup
 * below is what crawlers and JS-disabled users get.
 */
export default function RedirectIndex(): React.JSX.Element {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Cassida</h1>
      <p>One element, one class — compiled, not cascaded.</p>
      <p>1 つの要素、1 つのクラス — カスケードではなくコンパイルで。</p>
      <ul>
        <li>
          <a href="en/">Open in English →</a>
        </li>
        <li>
          <a href="ja/">日本語で開く →</a>
        </li>
      </ul>
    </main>
  );
}
