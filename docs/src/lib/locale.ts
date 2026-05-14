import { createContext, useContext } from 'react';
import { useParams } from 'react-router-dom';

export const LOCALES = ['en', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ja';

export function isLocale(value: string | undefined): value is Locale {
  return value === 'en' || value === 'ja';
}

export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/**
 * Read the active locale from the `:locale` route segment. Defaults
 * to `'ja'` when called outside a locale-routed subtree (e.g. on the
 * redirector at `/`).
 */
export function useLocale(): Locale {
  const params = useParams<{ locale?: string }>();
  if (isLocale(params.locale)) return params.locale;
  return useContext(LocaleContext);
}

/**
 * Translation helper. Pass a record `{ en, ja }` and get the value
 * for the active locale. Keeps strings co-located with their use site
 * — no separate JSON file per locale.
 *
 *   <h1>{t({ en: 'One class', ja: '1 つのクラス' })}</h1>
 */
export function t<T>(record: Record<Locale, T>): T {
  // Component-context resolution: the surrounding `useLocale()` call
  // is what decides which key wins. This helper is intentionally
  // tiny — exports as a plain function so it can sit next to JSX
  // without ceremony.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const locale = useLocale();
  return record[locale];
}
