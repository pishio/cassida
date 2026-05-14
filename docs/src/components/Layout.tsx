import type React from 'react';
import { Outlet, NavLink, useParams } from 'react-router-dom';
import { cas } from '@cassida/core';
import { isLocale, DEFAULT_LOCALE, type Locale, LocaleContext, t } from '../lib/locale.js';
import { LangSwitch } from './LangSwitch.js';

/**
 * Outer shell that wraps every locale-routed page. Reads the
 * `:locale` segment, falls back to `'ja'` if absent, and exposes the
 * value via `LocaleContext` so deeply-nested components can `t({en,
 * ja})` without prop-drilling.
 */
export default function Layout(): React.JSX.Element {
  const params = useParams<{ locale?: string }>();
  const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;

  return (
    <LocaleContext.Provider value={locale}>
      <div {...cas().display('grid').props} style={{ gridTemplateColumns: '240px 1fr', minHeight: '100vh' }}>
        <aside
          {...cas()
            .padding(24)
            .borderRight('1px solid #e5e7eb' as never)
            .backgroundColor('#fff').props}
        >
          <SidebarNav locale={locale} />
        </aside>
        <main {...cas().padding(40).maxWidth(960).props}>
          <header
            {...cas()
              .display('flex')
              .justifyContent('flex-end')
              .marginBottom(32).props}
          >
            <LangSwitch />
          </header>
          <Outlet />
        </main>
      </div>
    </LocaleContext.Provider>
  );
}

function SidebarNav({ locale }: { locale: Locale }): React.JSX.Element {
  const labels = t({
    en: {
      home: 'Home',
      install: 'Install',
      api: 'API',
      cas: 'cas() chain',
      modifiers: 'Modifiers',
      registry: 'Property registry',
      unsafe: 'Unsafe surface',
      config: 'Configuration',
      plugins: 'Plugins',
      recommended: '@cassida/recommended',
      hoverFix: '@cassida/plugin-hover-fix',
      conditional: '@cassida/plugin-conditional',
      globalCss: '@cassida/plugin-global-css',
      print: '@cassida/plugin-print',
    },
    ja: {
      home: 'ホーム',
      install: 'インストール',
      api: 'API',
      cas: 'cas() チェーン',
      modifiers: '修飾子',
      registry: 'プロパティレジストリ',
      unsafe: 'unsafe 面',
      config: '設定',
      plugins: 'プラグイン',
      recommended: '@cassida/recommended',
      hoverFix: '@cassida/plugin-hover-fix',
      conditional: '@cassida/plugin-conditional',
      globalCss: '@cassida/plugin-global-css',
      print: '@cassida/plugin-print',
    },
  });

  const base = `/${locale}`;
  return (
    <nav {...cas().fontSize(14).props}>
      <h2 {...cas().fontSize(18).marginBottom(16).props}>Cassida</h2>
      <NavSection title={labels.home}>
        <NavItem to={`${base}/`} label={labels.home} end />
        <NavItem to={`${base}/install`} label={labels.install} />
      </NavSection>
      <NavSection title={labels.api}>
        <NavItem to={`${base}/api/cas`} label={labels.cas} />
        <NavItem to={`${base}/api/modifiers`} label={labels.modifiers} />
        <NavItem to={`${base}/api/registry`} label={labels.registry} />
        <NavItem to={`${base}/api/unsafe`} label={labels.unsafe} />
        <NavItem to={`${base}/api/config`} label={labels.config} />
      </NavSection>
      <NavSection title={labels.plugins}>
        <NavItem to={`${base}/plugins/recommended`} label={labels.recommended} />
        <NavItem to={`${base}/plugins/hover-fix`} label={labels.hoverFix} />
        <NavItem to={`${base}/plugins/conditional`} label={labels.conditional} />
        <NavItem to={`${base}/plugins/global-css`} label={labels.globalCss} />
        <NavItem to={`${base}/plugins/print`} label={labels.print} />
      </NavSection>
    </nav>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section {...cas().marginBottom(24).props}>
      <h3
        {...cas()
          .fontSize(12)
          .textTransform('uppercase' as never)
          .color('#6b7280')
          .marginBottom(8).props}
      >
        {title}
      </h3>
      <ul {...cas().display('flex').flexDirection('column').gap(4).props} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {children}
      </ul>
    </section>
  );
}

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }): React.JSX.Element {
  // `end` defaults to `false`. Inlining the boolean keeps NavLink's
  // strict-optional typing happy under `exactOptionalPropertyTypes`.
  return (
    <li>
      <NavLink
        to={to}
        end={end === true}
        style={({ isActive }: { isActive: boolean }) => ({
          display: 'block',
          padding: '4px 8px',
          borderRadius: 4,
          textDecoration: 'none',
          backgroundColor: isActive ? '#eef2ff' : 'transparent',
          color: isActive ? '#1e3a8a' : '#1c1f24',
        })}
      >
        {label}
      </NavLink>
    </li>
  );
}
