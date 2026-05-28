// Server Component: imports the aggregated `@layer cas` CSS bundle
// owned by CassidaWebpackPlugin. Next.js's CSS pipeline handles the
// rest (chunking, minification, RSC delivery).
import '@cassida/next-plugin/virtual.css';
import type { ReactNode } from 'react';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
