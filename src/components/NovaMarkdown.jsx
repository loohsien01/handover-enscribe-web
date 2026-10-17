import React, { useMemo } from 'react';
import NovaExcerpt from '@/components/NovaExcerpt.jsx';
import { parseMarkdownBlocks } from '@/utils/markdown.js';

/**
 * Renders GitHub-flavored markdown with Nova styling.
 *
 * @param {{ content: string; className?: string; excerpts?: boolean }} props
 */
export default function NovaMarkdown({ content, className = '', excerpts = true }) {
  const blocks = useMemo(
    () => parseMarkdownBlocks(content, { excerpts }),
    [content, excerpts],
  );
  if (!blocks.length) return null;

  return (
    <div className={`nova-markdown break-words ${className}`.trim()}>
      {blocks.map((block, idx) => {
        if (block.type === 'excerpt') {
          return (
            <NovaExcerpt
              key={`excerpt-${idx}`}
              plainText={block.plainText}
              html={block.html}
              variant={block.variant}
            />
          );
        }
        return (
          <div
            key={`html-${idx}`}
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        );
      })}
    </div>
  );
}
