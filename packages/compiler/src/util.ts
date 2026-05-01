/**
 * Convert kebab-case CSS property names to camelCase keys (the form used
 * by React's `style` prop and `csstype.Properties`).
 */
export const cssToCamel = (prop: string): string =>
  prop.replace(/-([a-z])/g, (_match: string, c: string) => c.toUpperCase());
