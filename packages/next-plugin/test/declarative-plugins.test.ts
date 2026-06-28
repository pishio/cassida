import { describe, expect, it } from 'vitest';
import { withCassida } from '../src/index.js';

// The declarative `options.plugins.{conditional,print,globalCss}` flags
// are not wired in the Next.js path yet. They must reject at config time
// (eagerly, inside `withCassida`) rather than warn-and-no-op, so a
// recognised-but-inert option can't silently swallow the user's intent.
// The throw happens before any wasm lookup, so these tests don't need
// the SWC artefact present.
describe('declarative plugin flags in the Next.js path', () => {
  it('rejects options.plugins.conditional at config time', () => {
    expect(() => withCassida({}, { plugins: { conditional: true } })).toThrow(
      /options\.plugins\.conditional is not supported in the Next\.js path/,
    );
  });

  it('rejects options.plugins.print at config time', () => {
    expect(() => withCassida({}, { plugins: { print: true } })).toThrow(
      /options\.plugins\.print is not supported in the Next\.js path/,
    );
  });

  it('rejects options.plugins.globalCss at config time', () => {
    expect(() => withCassida({}, { plugins: { globalCss: true } })).toThrow(
      /options\.plugins\.globalCss is not supported in the Next\.js path/,
    );
  });
});
