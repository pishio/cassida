import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withCassida } from '@cassida/next-plugin';

// The e2e consumer dir carries its own package-lock.json (npm install of
// the cassida tarballs) while the repo root has pnpm-lock.yaml. Next.js
// 15 picks the wrong one as the workspace root and warns "Next.js
// inferred your workspace root, but it may not be correct" on every
// build. Pinning `outputFileTracingRoot` to this directory silences the
// warning and tells the tracer to scope to the consumer alone.
const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  outputFileTracingRoot: here,
};

export default withCassida(config, {
  plugins: {
    // Verify the declarative plugin form fires too — hoverFix is
    // the only built-in CSS plugin wired in Phase 1.x.
    hoverFix: true,
  },
});
