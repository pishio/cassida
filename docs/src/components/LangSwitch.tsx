import type React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cas } from '@cassida/core';
import { useLocale, type Locale } from '../lib/locale.js';

interface LangLinkProps {
  readonly target: Locale;
  readonly current: Locale;
  readonly pathname: string;
  readonly label: string;
}

/**
 * Swap between `/en/...` and `/ja/...` while preserving the current
 * path under the locale segment. Active locale renders as plain text
 * (not a link) so the affordance is clear.
 */
export function LangSwitch(): React.JSX.Element {
  const current = useLocale();
  const { pathname } = useLocation();

  return (
    <nav
      {...cas().display('flex').gap(8).fontSize(13).props}
      aria-label="Language switch"
    >
      <LangLink target="en" current={current} pathname={pathname} label="English" />
      <span aria-hidden="true">·</span>
      <LangLink target="ja" current={current} pathname={pathname} label="日本語" />
    </nav>
  );
}

function LangLink({
  target,
  current,
  pathname,
  label,
}: LangLinkProps): React.JSX.Element {
  if (target === current) {
    // The active locale isn't a link — `cas` styling for muted text.
    return <span {...cas().color('#6b7280').props}>{label}</span>;
  }
  // Pathname is basename-stripped (`/en/api/cas`) because the router
  // is configured with `basename: '/cassida'` in main.tsx. Swap the
  // first segment for the target locale; trailing slash preserved.
  const swapped = pathname.replace(/^\/(en|ja)/, `/${target}`);
  return (
    <Link to={swapped} {...cas().color('#1e3a8a').props}>
      {label}
    </Link>
  );
}
