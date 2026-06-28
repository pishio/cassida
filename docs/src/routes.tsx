import type { RouteRecord } from 'vite-react-ssg';
import Layout from './components/Layout.js';
import RedirectIndex from './pages/RedirectIndex.js';
import Landing from './pages/Landing.js';
import Philosophy from './pages/Philosophy.js';
import Glossary from './pages/Glossary.js';
import Install from './pages/Install.js';
import Responsive from './pages/Responsive.js';
import Theming from './pages/Theming.js';
import ExistingCss from './pages/ExistingCss.js';
import Cas from './pages/Cas.js';
import Modifiers from './pages/Modifiers.js';
import Registry from './pages/Registry.js';
import Unsafe from './pages/Unsafe.js';
import Config from './pages/Config.js';
import NextSetup from './pages/NextSetup.js';
import SwcPlugin from './pages/SwcPlugin.js';
import NextPlugin from './pages/NextPlugin.js';
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
      { path: 'philosophy', Component: Philosophy },
      { path: 'install', Component: Install },
      { path: 'guides/responsive', Component: Responsive },
      { path: 'guides/theming', Component: Theming },
      { path: 'guides/existing-css', Component: ExistingCss },
      { path: 'glossary', Component: Glossary },
      { path: 'api/cas', Component: Cas },
      { path: 'api/modifiers', Component: Modifiers },
      { path: 'api/registry', Component: Registry },
      { path: 'api/unsafe', Component: Unsafe },
      { path: 'api/config', Component: Config },
      { path: 'frameworks/next', Component: NextSetup },
      { path: 'frameworks/swc-plugin', Component: SwcPlugin },
      { path: 'frameworks/next-plugin', Component: NextPlugin },
      { path: 'plugins/recommended', Component: Recommended },
      { path: 'plugins/hover-fix', Component: HoverFix },
      { path: 'plugins/conditional', Component: Conditional },
      { path: 'plugins/global-css', Component: GlobalCss },
      { path: 'plugins/print', Component: Print },
    ],
  },
];
