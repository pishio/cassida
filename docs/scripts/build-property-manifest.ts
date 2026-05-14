// Pre-build hook: serialize the Cassida property registry into a
// JSON manifest the docs site renders as a sortable, MDN-linked
// table. Runs before `vite-react-ssg build` and writes to
// `src/lib/property-manifest.json` (gitignored).
//
// Source of truth:
//   - `canonicalSpec` (hand-crafted, csstype-typed) from
//     @cassida/compiler — ~48 entries grouped by category.
//   - `generatedPropertySpecs` (mdn-data-derived, permissive
//     string|number) from @cassida/compiler — ~231 entries.
//   - `defaultAliases` from @cassida/compiler — short→long mapping.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalSpec,
  generatedPropertySpecs,
  defaultAliases,
} from '@cassida/compiler';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '..', 'src', 'lib', 'property-manifest.json');

type Category =
  | 'color'
  | 'box-model'
  | 'multi-property'
  | 'typography'
  | 'layout'
  | 'flex'
  | 'border'
  | 'misc';

// Hand-curated bucket for canonical entries. Generated entries
// default to 'misc'.
const CATEGORY_OF: Record<string, Category> = {
  color: 'color',
  backgroundColor: 'color',
  borderColor: 'color',
  margin: 'box-model',
  marginTop: 'box-model',
  marginRight: 'box-model',
  marginBottom: 'box-model',
  marginLeft: 'box-model',
  padding: 'box-model',
  paddingTop: 'box-model',
  paddingRight: 'box-model',
  paddingBottom: 'box-model',
  paddingLeft: 'box-model',
  px: 'multi-property',
  py: 'multi-property',
  mx: 'multi-property',
  my: 'multi-property',
  width: 'box-model',
  height: 'box-model',
  minWidth: 'box-model',
  minHeight: 'box-model',
  maxWidth: 'box-model',
  maxHeight: 'box-model',
  fontFamily: 'typography',
  fontSize: 'typography',
  fontWeight: 'typography',
  lineHeight: 'typography',
  textAlign: 'typography',
  display: 'layout',
  position: 'layout',
  inset: 'layout',
  top: 'layout',
  right: 'layout',
  bottom: 'layout',
  left: 'layout',
  zIndex: 'layout',
  flexDirection: 'flex',
  justifyContent: 'flex',
  alignItems: 'flex',
  gap: 'flex',
  borderRadius: 'border',
  borderWidth: 'border',
  borderStyle: 'border',
  opacity: 'misc',
  cursor: 'misc',
  animation: 'misc',
  transition: 'misc',
  transform: 'misc',
};

interface ManifestEntry {
  readonly method: string;
  readonly cssProperty: string;
  readonly properties?: readonly string[];
  readonly source: 'canonical' | 'generated';
  readonly category: Category;
  readonly animatable?: boolean;
  readonly aliases?: readonly string[];
  readonly typed: boolean;
}

// Build the alias reverse-index: canonical method -> short alias(es).
const reverseAliases: Record<string, string[]> = {};
for (const [short, long] of Object.entries(defaultAliases)) {
  (reverseAliases[long] ??= []).push(short);
}

const entries: ManifestEntry[] = [];

for (const [method, spec] of Object.entries(canonicalSpec)) {
  // `spec.properties` is only present on multi-property entries.
  const properties =
    'properties' in spec && Array.isArray(spec.properties) ? spec.properties : undefined;
  const entry: ManifestEntry = {
    method,
    cssProperty: spec.property,
    source: 'canonical',
    category: CATEGORY_OF[method] ?? 'misc',
    animatable: spec.animatable,
    typed: true,
    ...(properties ? { properties } : {}),
    ...(reverseAliases[method] ? { aliases: reverseAliases[method] } : {}),
  };
  entries.push(entry);
}

const canonicalNames = new Set(Object.keys(canonicalSpec));
for (const [method, spec] of Object.entries(generatedPropertySpecs)) {
  // Hand-crafted canonicals win on method-name collision — the
  // generated entry is shadowed in the runtime registry, so we skip
  // it in the docs too.
  if (canonicalNames.has(method)) continue;
  entries.push({
    method,
    cssProperty: spec.property,
    source: 'generated',
    category: 'misc',
    animatable: spec.animatable,
    typed: false,
  });
}

entries.sort((a, b) => a.method.localeCompare(b.method));

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n');
console.log(`[manifest] wrote ${entries.length} entries → ${outPath}`);
