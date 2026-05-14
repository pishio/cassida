import type React from 'react';
import { useMemo, useState } from 'react';
import { cas } from '@cassida/core';
import manifest from '../lib/property-manifest.json' with { type: 'json' };
import { mdnUrl } from '../lib/mdn.js';
import { useLocale, t } from '../lib/locale.js';

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

  const labels = t({
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
      <div {...cas().display('flex').gap(12).flexWrap('wrap' as never).props}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          {...cas()
            .padding(8)
            .borderRadius(6)
            .fontSize(14).props}
          style={{
            border: '1px solid #d1d5db',
            flex: 1,
            minWidth: 200,
          }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          {...cas()
            .padding(8)
            .borderRadius(6)
            .fontSize(14).props}
          style={{ border: '1px solid #d1d5db' }}
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
        {...cas().fontSize(13).props}
        style={{ borderCollapse: 'collapse', width: '100%' }}
      >
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ padding: '8px 4px' }}>{labels.method}</th>
            <th style={{ padding: '8px 4px' }}>{labels.property}</th>
            <th style={{ padding: '8px 4px' }}>{labels.source}</th>
            <th style={{ padding: '8px 4px' }}>{labels.aliases}</th>
            <th style={{ padding: '8px 4px' }}>{labels.mdn}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                {labels.none}
              </td>
            </tr>
          ) : (
            filtered.map((e) => (
              <tr key={e.method} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '6px 4px', fontFamily: 'monospace' }}>{e.method}</td>
                <td style={{ padding: '6px 4px', fontFamily: 'monospace' }}>
                  {e.properties ? e.properties.join(', ') : e.cssProperty}
                </td>
                <td style={{ padding: '6px 4px', color: '#6b7280' }}>{e.source}</td>
                <td style={{ padding: '6px 4px', fontFamily: 'monospace' }}>
                  {e.aliases?.join(', ') ?? ''}
                </td>
                <td style={{ padding: '6px 4px' }}>
                  <a href={mdnUrl(e.cssProperty, locale)} target="_blank" rel="noreferrer">
                    ↗
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
