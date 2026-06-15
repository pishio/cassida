// Server Component: imports the aggregated `@layer cas` CSS bundle
// owned by CassidaWebpackPlugin. Next.js's CSS pipeline handles the
// rest (chunking, minification, RSC delivery).
import '@cassida/next-plugin/virtual.css';
import { cas } from '@cassida/core';
import type { ReactNode } from 'react';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Cross-compiler bridge probe. The root layout is a Server
            Component that never ships to the client bundle, so this
            chain is compiled ONLY by the server webpack compiler. The
            e2e assert (#8) checks the resulting class reaches the
            client-shipped `@layer cas` CSS — that round trip is the
            cross-compiler bridge (`store.allRules()` merging the
            server + client namespaces). The `data-cassida-bridge`
            attribute pins the assertion to this element. The colour is
            deliberately distinctive so the chain gets its own class. */}
        <div data-cassida-bridge="probe" {...cas().color('#0b1d3a').props} />
        {children}
      </body>
    </html>
  );
}
