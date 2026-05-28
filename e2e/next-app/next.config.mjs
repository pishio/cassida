import { withCassida } from '@cassida/next-plugin';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

export default withCassida(config, {
  plugins: {
    // Verify the declarative plugin form fires too — hoverFix is
    // the only built-in CSS plugin wired in Phase 1.x.
    hoverFix: true,
  },
});
