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
 * Translation hook. Pass a record `{ en, ja }` and get the value for
 * the active locale. Keeps strings co-located with their use site —
 * no separate JSON file per locale.
 *
 *   <h1>{useT({ en: 'One class', ja: '1 つのクラス' })}</h1>
 *
 * The leading `use` prefix marks this as a custom hook so the
 * underlying `useLocale()` call satisfies the Rules of Hooks
 * unambiguously.
 */
export function useT<T>(record: Record<Locale, T>): T {
  const locale = useLocale();
  return record[locale];
}
