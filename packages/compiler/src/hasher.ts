export const DEFAULT_PREFIX = 'cas-';
export const DEFAULT_LENGTH = 8;

export interface HashOptions {
  readonly prefix?: string;
  readonly length?: number;
}

/**
 * Build-time class-name hasher.
 *
 * Uses MurmurHash3 (x86, 32-bit) — a non-cryptographic hash with good
 * distribution and low collision rate over ASCII inputs.
 *
 * Why not `node:crypto`? It pulls Node-only APIs into modules that
 * eventually transit through bundlers. When the bundler thinks a
 * downstream module *might* still reach `cas()` at runtime (e.g. when
 * tree-shake is conservative), it traces the import graph into
 * `hasher.ts` and chokes on `node:crypto`'s missing `createHash`
 * export in browser-stub mode. A self-contained JS implementation
 * avoids that whole class of build-time failures and ships zero
 * dependencies.
 *
 * Hash strength is non-cryptographic by design — collisions are
 * detected at build time by the emitter (`CssEmitter.add` throws on
 * a class name with two distinct canonical bags), so a chance
 * collision surfaces as a clear error, not a silent miscompile.
 *
 * For lengths > 8 hex chars, additional 32-bit rounds with
 * incrementing seed are concatenated until the requested length is
 * met. This preserves the existing API (length 4..40) without
 * forcing a bigger algorithm or dual-package complexity.
 */
export function hash(canonical: string, options: HashOptions = {}): string {
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  const length = options.length ?? DEFAULT_LENGTH;

  let hex = '';
  let seed = 0;
  while (hex.length < length) {
    hex += murmur3_32(canonical, seed).toString(16).padStart(8, '0');
    seed++;
  }
  return prefix + hex.slice(0, length);
}

/**
 * MurmurHash3 x86 32-bit. Public-domain algorithm by Austin Appleby.
 *
 * Implementation notes:
 *   - All arithmetic kept in unsigned 32-bit territory via `>>> 0`
 *     and `Math.imul` — V8 / SpiderMonkey JIT both fast-path these.
 *   - Input is treated as a UTF-8 byte stream so non-ASCII strings
 *     hash the same on every host.
 *   - Returns a non-negative 32-bit integer.
 */
function murmur3_32(input: string, seed: number = 0): number {
  const bytes = utf8Bytes(input);
  const len = bytes.length;
  const nblocks = Math.floor(len / 4);

  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let h1 = seed >>> 0;

  for (let i = 0; i < nblocks; i++) {
    const o = i * 4;
    let k1 =
      (bytes[o]! |
        (bytes[o + 1]! << 8) |
        (bytes[o + 2]! << 16) |
        (bytes[o + 3]! << 24)) >>>
      0;

    k1 = Math.imul(k1, c1) >>> 0;
    k1 = ((k1 << 15) | (k1 >>> 17)) >>> 0;
    k1 = Math.imul(k1, c2) >>> 0;

    h1 = (h1 ^ k1) >>> 0;
    h1 = ((h1 << 13) | (h1 >>> 19)) >>> 0;
    h1 = (Math.imul(h1, 5) + 0xe6546b64) >>> 0;
  }

  // tail
  let k1 = 0;
  const tailStart = nblocks * 4;
  const rem = len & 3;
  if (rem >= 3) k1 ^= bytes[tailStart + 2]! << 16;
  if (rem >= 2) k1 ^= bytes[tailStart + 1]! << 8;
  if (rem >= 1) {
    k1 ^= bytes[tailStart]!;
    k1 = Math.imul(k1, c1) >>> 0;
    k1 = ((k1 << 15) | (k1 >>> 17)) >>> 0;
    k1 = Math.imul(k1, c2) >>> 0;
    h1 = (h1 ^ k1) >>> 0;
  }

  // finalization
  h1 = (h1 ^ len) >>> 0;
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h1 = Math.imul(h1, 0x85ebca6b) >>> 0;
  h1 = (h1 ^ (h1 >>> 13)) >>> 0;
  h1 = Math.imul(h1, 0xc2b2ae35) >>> 0;
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;

  return h1 >>> 0;
}

/**
 * Encode a string as a UTF-8 byte sequence. Avoids the `TextEncoder`
 * dependency (Node ≥ 11 has it globally, but bundling it for older
 * targets is wasted bytes for the tiny input strings hashed here).
 */
function utf8Bytes(s: string): readonly number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let cp = s.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < s.length) {
      const lo = s.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(
        0xe0 | (cp >> 12),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return out;
}
