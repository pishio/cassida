#!/usr/bin/env bash
# Local mirror of the e2e CI workflow: pack every @cassida/* package,
# install them into the consumer fixture together with a chosen Vite
# major, run the build, and run the post-build assertions.
#
#   Usage: ./e2e/run-local.sh [vite-major]
#     vite-major: 5, 6, or 7 (default: 7)
#
# Run from the repo root.

set -euo pipefail

VITE_MAJOR="${1:-7}"
case "$VITE_MAJOR" in
  5) PLUGIN_REACT="^4" ;;
  6) PLUGIN_REACT="^5" ;;
  7) PLUGIN_REACT="^5" ;;
  *) echo "unsupported vite major: $VITE_MAJOR (use 5, 6, or 7)" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARBALLS="$ROOT/e2e/.tarballs"
CONSUMER="$ROOT/e2e/consumer"

echo "==> Building all @cassida/* packages"
pnpm -r --filter='./packages/*' build >/dev/null

echo "==> Packing tarballs into $TARBALLS"
rm -rf "$TARBALLS"
mkdir -p "$TARBALLS"
for d in "$ROOT"/packages/*/; do
  (cd "$d" && pnpm pack --pack-destination "$TARBALLS" >/dev/null)
done
ls -1 "$TARBALLS"

echo "==> Installing consumer (vite@^$VITE_MAJOR, plugin-react@$PLUGIN_REACT)"
# Use npm here, not pnpm. pnpm's content-addressable store caches by
# name@version and will reuse the previously-published 0.1.0 contents
# instead of unpacking our freshly-built tarball, masking exactly the
# kind of regression this e2e is meant to catch.
rm -rf "$CONSUMER/node_modules" "$CONSUMER/package-lock.json" "$CONSUMER/pnpm-lock.yaml" "$CONSUMER/dist"
cd "$CONSUMER"
npm install --no-audit --no-fund \
  "$TARBALLS"/cassida-core-*.tgz \
  "$TARBALLS"/cassida-compiler-*.tgz \
  "$TARBALLS"/cassida-parser-*.tgz \
  "$TARBALLS"/cassida-vite-plugin-*.tgz \
  react@^18 react-dom@^18 \
  "vite@^$VITE_MAJOR" \
  "@vitejs/plugin-react@$PLUGIN_REACT" \
  typescript@^5 @types/react@^18 @types/react-dom@^18

echo "==> Building consumer"
npx vite build

echo "==> Running assertions"
node scripts/assert.mjs
