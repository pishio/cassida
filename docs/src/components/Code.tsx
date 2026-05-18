import type React from 'react';
import { cas } from '@cassida/core';

interface CodeProps {
  readonly source: string;
}

interface InlineCodeProps {
  readonly children: React.ReactNode;
}

/**
 * Code block with a quiet outline. Reused across every page that
 * carries example code. Mono font comes from the global preflight.
 */
export function Code({ source }: CodeProps): React.JSX.Element {
  return (
    <pre
      {...cas()
        .padding(16)
        .borderRadius(8)
        .backgroundColor('#0f172a')
        .color('#e2e8f0')
        .fontSize(13)
        .lineHeight(1.6)
        .marginTop(8)
        .marginBottom(16)
        .overflowX('auto')
        .whiteSpace('pre').props}
    >
      <code>{source}</code>
    </pre>
  );
}

/**
 * Render a string of prose, expanding `` `foo` `` segments to inline
 * `<code>` elements. The useT() helper returns strings, so we keep
 * the source readable (single string in / per locale) and let this
 * helper turn the conventional backtick syntax into actual code
 * formatting at render time.
 */
export function Prose({ children }: { readonly children: string }): React.JSX.Element {
  const parts: React.ReactNode[] = [];
  const regex = /`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(children)) !== null) {
    if (match.index > last) {
      parts.push(children.slice(last, match.index));
    }
    parts.push(<InlineCode key={parts.length}>{match[1]}</InlineCode>);
    last = regex.lastIndex;
  }
  if (last < children.length) {
    parts.push(children.slice(last));
  }
  return <>{parts}</>;
}

/**
 * Inline `<code>` styled to match the block form.
 */
export function InlineCode({ children }: InlineCodeProps): React.JSX.Element {
  return (
    <code
      {...cas()
        .py(2)
        .px(6)
        .borderRadius(4)
        .backgroundColor('#f1f5f9')
        .color('#0f172a')
        .fontSize(13).props}
    >
      {children}
    </code>
  );
}
