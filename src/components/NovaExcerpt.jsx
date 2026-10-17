import React, { useState } from 'react';
import { copyToClipboard } from '@/utils/ui.js';

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6 9 17 4 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Copyable document excerpt — blockquote letters or fenced code blocks from Nova.
 *
 * @param {{ plainText: string; html: string; variant?: 'blockquote' | 'code' }} props
 */
export default function NovaExcerpt({ plainText, html, variant = 'blockquote' }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!plainText) return;
    const ok = await copyToClipboard(plainText);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const label = copied ? 'Copied to clipboard' : 'Copy excerpt';

  return (
    <div className={`nova-excerpt nova-excerpt--${variant}`}>
      <div
        className="nova-excerpt__content nova-markdown"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div className="nova-excerpt__rail">
        <button
          type="button"
          onClick={() => void onCopy()}
          className={`nova-excerpt__copy${copied ? ' nova-excerpt__copy--copied' : ''}`}
          aria-label={label}
          title={label}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
    </div>
  );
}
