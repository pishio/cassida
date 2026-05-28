/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference types="react" />
// Server Component: imports the aggregated `@layer cas` CSS bundle
// owned by CassidaWebpackPlugin. Next.js's CSS pipeline handles the
// rest (chunking, minification, RSC delivery).
import '@cassida/next-plugin/virtual.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
