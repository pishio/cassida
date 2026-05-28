'use client';

import { useState } from 'react';
import { cas, type CassChain } from '@cassida/core';

import { ServerOnly } from './server-only';

// Same-file mixin — exercises the parser-side function composition
// path (chain folded into another chain in place).
const withCard = (c: CassChain): CassChain =>
  c.padding(16).borderRadius(8).backgroundColor('#fff').color('#111');

export default function Page() {
  const [hue, setHue] = useState(180);

  return (
    <main {...cas().padding(24).maxWidth(720).props}>
      <h1 {...cas().fontSize(24).fontWeight(700).color('#111').props}>
        Cassida × Next.js e2e
      </h1>

      <section {...withCard(cas()).props}>
        <p {...cas().margin(0).fontSize(14).props}>
          Static chain → one class.
        </p>
      </section>

      {/* Modifier scope (:hover): must compile to a single class
          with a nested rule, never two selectors. */}
      <button
        {...cas()
          .padding(8)
          .backgroundColor('#3b82f6')
          .color('#fff')
          .borderRadius(4)
          .hover((c) => c.backgroundColor('#2563eb'))
          .props}
        onClick={() => setHue((h) => (h + 30) % 360)}
      >
        Bump hue
      </button>

      {/* Dynamic value via state — exercises the CSS-var path. */}
      <div
        {...cas()
          .marginTop(16)
          .padding(16)
          .backgroundColor(`hsl(${hue}deg 70% 50%)`)
          .color('#fff').props}
      >
        Dynamic hue: {hue}
      </div>

      {/* RSC subtree — proves Server Component chains contribute to
          the same @layer cas bundle as Client Component chains. */}
      <ServerOnly />
    </main>
  );
}
