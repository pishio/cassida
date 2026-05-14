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
