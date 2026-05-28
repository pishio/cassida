// Default Server Component (no 'use client' directive). The Phase-1
// guarantee: a cas() chain in a Server Component must contribute to
// the same `@layer cas` bundle the Client Components see. This file
// is the smallest reliable assertion of that contract.

import { cas } from '@cassida/core';

export function ServerOnly() {
  return (
    <aside
      {...cas()
        .marginTop(24)
        .padding(12)
        .borderWidth(1)
        .borderStyle('solid')
        .borderColor('#ddd')
        .borderRadius(4)
        .fontSize(13)
        .color('#666').props}
    >
      Rendered on the server, styled through the same bundle.
    </aside>
  );
}
