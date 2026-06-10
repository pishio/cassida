#!/usr/bin/env node
// Compare the `swc_core` version pinned in `packages/swc-plugin-next/Cargo.toml`
// against the version currently embedded in the latest stable Next.js LTS
// release. Drives the weekly `.github/workflows/swc-core-drift.yml` cron.
//
// Exit codes:
//   0 — aligned, OR `gh` unavailable / network soft-failure (don't false-alarm)
//   1 — drift detected; stdout carries the machine-readable diff line the
//       workflow's `gh issue create` step parses
//   2 — hard error after retry (network failure on both attempts)
//
// The script is plain Node 20 ESM, zero npm deps, uses only `gh` via execSync.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

// Current Next.js LTS major. Hard-coded because the "current LTS" concept is
// editorial (Next.js doesn't tag releases as LTS in its release metadata).
// Bump in lockstep with `@cassida/next-plugin`'s README policy.
const LTS_MAJOR = 15;

const RETRY_DELAY_MS = 5000;

/**
 * Run `gh` and return stdout. Throws on non-zero exit so callers can
 * differentiate transient failures (handled by retry) from `gh` missing
 * (handled by soft exit).
 */
function gh(args) {
  return execSync(`gh ${args}`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** True if `gh` is on PATH and authenticated. */
function ghAvailable() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch the most recent stable (non-prerelease) Next.js release tag whose
 * version is `${LTS_MAJOR}.x.y`. Returns the tag string (e.g. `v15.5.18`).
 */
function fetchLatestLtsTag() {
  // The `--jq` filter has to match e.g. `v15.5.18` but reject `v15.0.0-rc.1`
  // (those carry `prerelease == true` already) and any tag from a different
  // major (rare for a stable release, but guard anyway).
  const jq =
    `[.[] | select(.prerelease == false) | select(.tag_name | test("^v?${LTS_MAJOR}\\\\.")) | .tag_name] | .[0]`;
  const out = gh(`api 'repos/vercel/next.js/releases?per_page=30' --jq '${jq}'`);
  const tag = out.trim();
  if (!tag || tag === 'null') {
    throw new Error(`no stable Next.js ${LTS_MAJOR}.x release found in the latest 30`);
  }
  return tag;
}

/**
 * Fetch the `Cargo.toml` at the given Next.js tag, base64-decode the content
 * field, and return it as a string.
 */
function fetchNextCargoToml(tag) {
  const out = gh(`api 'repos/vercel/next.js/contents/Cargo.toml?ref=${tag}' --jq '.content'`);
  const b64 = out.replace(/\s+/g, '');
  if (!b64) {
    throw new Error(`empty Cargo.toml content at ref ${tag}`);
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}

/**
 * Extract the swc_core version pin. Matches the patterns Next.js uses:
 *   swc_core = "0.123.4"
 *   swc_core = { version = "0.123.4", ... }
 *   swc_core = { version = "=35.0.0", features = [...] }
 *
 * Returns the raw version string, including any leading `=` (Cargo's
 * exact-version marker). The caller normalises before diffing.
 */
function extractSwcCore(cargoToml) {
  // Anchor `swc_core` as a whole key (start of line or after `[dependencies]`
  // -style boundaries) so we don't accidentally match `xxx_swc_core`.
  // Try the inline-table form first — that's what both Next.js and our
  // plugin use — then fall back to the bare-string form.
  const inline = cargoToml.match(/^\s*swc_core\s*=\s*\{[^}]*?version\s*=\s*"([^"]+)"/m);
  if (inline) return inline[1];
  const bare = cargoToml.match(/^\s*swc_core\s*=\s*"([^"]+)"/m);
  if (bare) return bare[1];
  return null;
}

/**
 * Normalise an `swc_core` version string for comparison. We strip a leading
 * `=` exact-match marker (Cargo semantics: `"=35.0.0"` and `"35.0.0"` mean
 * different things to the resolver, but for the drift check we only care
 * about the underlying version number).
 */
function normalize(v) {
  if (v == null) return null;
  return v.replace(/^=/, '').trim();
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Wrap a thunk in single-retry-with-delay semantics. Used for the two `gh`
 * fetches so a transient network blip doesn't trip a false-positive issue.
 */
async function withRetry(thunk, label) {
  try {
    return thunk();
  } catch (err) {
    process.stderr.write(`[drift] ${label} attempt 1 failed (${err.message}); retrying in ${RETRY_DELAY_MS}ms\n`);
    await sleep(RETRY_DELAY_MS);
    return thunk();
  }
}

async function main() {
  if (!ghAvailable()) {
    process.stderr.write('[drift] gh CLI not available; skipping drift check\n');
    process.exit(0);
  }

  // Local pin first — fast, no network. If this fails, the workflow file
  // path is wrong and we want a hard error.
  const localCargoPath = resolve(repoRoot, 'packages/swc-plugin-next/Cargo.toml');
  const localCargo = readFileSync(localCargoPath, 'utf8');
  const ourPin = normalize(extractSwcCore(localCargo));
  if (!ourPin) {
    process.stderr.write(`[drift] could not find swc_core pin in ${localCargoPath}\n`);
    process.exit(2);
  }

  let tag;
  let upstreamPin;
  try {
    tag = await withRetry(fetchLatestLtsTag, 'fetch latest Next.js LTS tag');
    const upstreamCargo = await withRetry(() => fetchNextCargoToml(tag), `fetch Cargo.toml@${tag}`);
    upstreamPin = normalize(extractSwcCore(upstreamCargo));
  } catch (err) {
    process.stderr.write(`[drift] hard failure after retry: ${err.message}\n`);
    process.exit(2);
  }

  if (!upstreamPin) {
    process.stderr.write(`[drift] could not find swc_core pin in Next.js ${tag} Cargo.toml\n`);
    process.exit(2);
  }

  if (upstreamPin === ourPin) {
    process.stdout.write(
      `aligned: Next.js ${tag} swc_core ${upstreamPin} matches @cassida/swc-plugin-next pin\n`,
    );
    process.exit(0);
  }

  // Machine-readable diff line. The workflow parses this exact format to
  // build the issue title; keep it on one line and stable.
  process.stdout.write(
    `drift: next_tag=${tag} next_swc_core=${upstreamPin} cassida_swc_core=${ourPin}\n`,
  );
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`[drift] unexpected error: ${err.stack || err.message}\n`);
  process.exit(2);
});
