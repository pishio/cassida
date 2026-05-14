import type React from 'react';
import { useMemo, useState } from 'react';
import { cas, type CassChain } from '@cassida/core';
import manifest from '../lib/property-manifest.json' with { type: 'json' };
import { mdnUrl } from '../lib/mdn.js';
import { useLocale, useT } from '../lib/locale.js';

interface ManifestEntry {
  readonly method: string;
  readonly cssProperty: string;
  readonly properties?: readonly string[];
  readonly source: 'canonical' | 'generated';
  readonly category: string;
  readonly animatable?: boolean;
  readonly aliases?: readonly string[];
  readonly typed: boolean;
}

const ALL_ENTRIES = manifest as readonly ManifestEntry[];
const CATEGORIES = Array.from(new Set(ALL_ENTRIES.map((e) => e.category))).sort();

export function PropertyTable(): React.JSX.Element {
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_ENTRIES.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        e.method.toLowerCase().includes(q) ||
        e.cssProperty.includes(q) ||
        (e.aliases?.some((a) => a.includes(q)) ?? false)
      );
    });
  }, [query, categoryFilter]);

  const labels = useT({
    en: {
      search: 'Filter by method or property name…',
      category: 'Category',
      all: 'All',
      method: 'Chain method',
      property: 'CSS property',
      source: 'Source',
      aliases: 'Aliases',
      mdn: 'MDN',
      none: 'No matches',
      countTemplate: '%n entries',
    },
    ja: {
      search: 'メソッド名または CSS プロパティ名で絞り込み…',
      category: 'カテゴリ',
      all: 'すべて',
      method: 'チェーンメソッド',
      property: 'CSS プロパティ',
      source: 'ソース',
      aliases: 'エイリアス',
      mdn: 'MDN',
      none: '一致なし',
      countTemplate: '%n 件',
    },
  });

  return (
    <div {...cas().display('flex').flexDirection('column').gap(12).props}>
      <div {...cas().display('flex').gap(12).flexWrap('wrap').props}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          {...cas()
            .padding(8)
            .borderRadius(6)
            .fontSize(14)
            .borderWidth(1)
            .borderStyle('solid')
            .borderColor('#d1d5db')
            .flexGrow(1)
            .flexShrink(1)
            .flexBasis(0)
            .minWidth(200).props}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label={labels.category}
          {...cas()
            .padding(8)
            .borderRadius(6)
            .fontSize(14)
            .borderWidth(1)
            .borderStyle('solid')
            .borderColor('#d1d5db').props}
        >
          <option value="all">{labels.all}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <p {...cas().fontSize(13).color('#6b7280').props}>
        {labels.countTemplate.replace('%n', String(filtered.length))}
      </p>
      <table
        // `borderCollapse` exists on the generated chain set, so a bare
        // `.borderCollapse('collapse')` would also work. Kept on the
        // `cas.unsafe(...)` path on purpose: the registry page is the
        // primary place users read about the unsafe escape, and a live
        // demo of it here doubles as the canonical worked example.
        {...cas.unsafe({ borderCollapse: 'collapse' }).fontSize(13).width('100%').props}
      >
        <thead>
          <tr
            {...cas()
              .textAlign('left')
              .borderBottomWidth("1px")
              .borderBottomStyle('solid')
              .borderBottomColor('#e5e7eb').props}
          >
            <Th>{labels.method}</Th>
            <Th>{labels.property}</Th>
            <Th>{labels.source}</Th>
            <Th>{labels.aliases}</Th>
            <Th>{labels.mdn}</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                {...cas()
                  .padding(16)
                  .textAlign('center')
                  .color('#6b7280').props}
              >
                {labels.none}
              </td>
            </tr>
          ) : (
            filtered.map((e) => (
              <tr
                key={e.method}
                {...cas()
                  .borderBottomWidth("1px")
                  .borderBottomStyle('solid')
                  .borderBottomColor('#f3f4f6').props}
              >
                <Td mono>{e.method}</Td>
                <Td mono>{e.properties ? e.properties.join(', ') : e.cssProperty}</Td>
                <Td muted>{e.source}</Td>
                <Td mono>{e.aliases?.join(', ') ?? ''}</Td>
                <Td>
                  <a href={mdnUrl(e.cssProperty, locale)} target="_blank" rel="noreferrer">
                    ↗
                  </a>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface ThProps {
  readonly children: React.ReactNode;
}

interface TdProps {
  readonly children: React.ReactNode;
  readonly mono?: boolean;
  readonly muted?: boolean;
}

function Th({ children }: ThProps): React.JSX.Element {
  return <th {...cas().py(8).px(4).props}>{children}</th>;
}

function Td({ children, mono, muted }: TdProps): React.JSX.Element {
  // Dynamic styling driven by component props — `.cond()` keeps the
  // branching inside the chain so each (mono, muted) combination
  // materialises into its own pre-compiled class hash. `cond`'s test
  // arg is just truthy-checked, so the bare optional booleans work.
  return (
    <td
      {...cas()
        .py(6)
        .px(4)
        .cond(mono, (c: CassChain) => c.fontFamily('monospace'))
        .cond(muted, (c: CassChain) => c.color('#6b7280')).props}
    >
      {children}
    </td>
  );
}
