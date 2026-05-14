import type { RouteRecord } from 'vite-react-ssg';
import Layout from './components/Layout.js';
import RedirectIndex from './pages/RedirectIndex.js';
import Landing from './pages/Landing.js';
import Install from './pages/Install.js';
import Cas from './pages/Cas.js';
import Modifiers from './pages/Modifiers.js';
import Registry from './pages/Registry.js';
import Unsafe from './pages/Unsafe.js';
import Config from './pages/Config.js';
import Recommended from './pages/Recommended.js';
import HoverFix from './pages/HoverFix.js';
import Conditional from './pages/Conditional.js';
import GlobalCss from './pages/GlobalCss.js';
import Print from './pages/Print.js';

/**
 * Static route table for vite-react-ssg.
 *
 * Single component tree under `/:locale/...` — `useLocale()` reads
 * the `:locale` segment and the `t({en, ja})` helper resolves strings
 * per locale. Each (locale, path) pair is enumerated by
 * `getStaticPaths` so a typo surfaces at build time rather than as a
 * 404 in production.
 */
export const routes: RouteRecord[] = [
  {
    path: '/',
    Component: RedirectIndex,
    entry: 'src/pages/RedirectIndex.tsx',
  },
  {
    path: '/:locale',
    Component: Layout,
    getStaticPaths: () => ['/en', '/ja'],
    children: [
      { index: true, Component: Landing },
      { path: 'install', Component: Install },
      { path: 'api/cas', Component: Cas },
      { path: 'api/modifiers', Component: Modifiers },
      { path: 'api/registry', Component: Registry },
      { path: 'api/unsafe', Component: Unsafe },
      { path: 'api/config', Component: Config },
      { path: 'plugins/recommended', Component: Recommended },
      { path: 'plugins/hover-fix', Component: HoverFix },
      { path: 'plugins/conditional', Component: Conditional },
      { path: 'plugins/global-css', Component: GlobalCss },
      { path: 'plugins/print', Component: Print },
    ],
  },
];
