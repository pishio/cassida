/**
 * Cross-file static tokens — exercises the v0.2 cross-file evaluator.
 * The parser folds these values at build time into the consuming
 * chains, so referencing `tokens.brand.primary` from `App.tsx`
 * compiles to a single static class, not a dynamic CSS variable.
 */
export const tokens = {
  brand: {
    primary: '#2563eb',
    onPrimary: '#ffffff',
  },
  spacing: {
    sm: 8,
    md: 16,
    lg: 24,
  },
  radius: 6,
} as const;
