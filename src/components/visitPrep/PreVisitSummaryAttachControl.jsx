import React, { useLayoutEffect, useRef, useState } from 'react';
import IconVisitPrep from '@/components/IconVisitPrep.jsx';

const COMPACT_LABEL_CHROME_PX = 52;
const COMPACT_MIN_TITLE_RESERVE_PX = 112;

export function PreVisitSummaryAttachPlaceholder({ compact = false } = {}) {
  if (compact) {
    return (
      <div
        className="flex shrink-0 items-center rounded-lg border border-gray-200 bg-gray-50 px-2 py-2"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Checking pre-visit summary"
      >
        <span
          className="h-3.5 w-3.5 shrink-0 animate-pulse rounded-sm bg-gray-200"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Checking pre-visit summary"
    >
      <span
        className="h-4 w-4 shrink-0 animate-pulse rounded-sm bg-gray-200"
        aria-hidden
      />
      <span className="h-3.5 w-48 max-w-full animate-pulse rounded bg-gray-200" aria-hidden />
    </div>
  );
}

/**
 * Light-theme control for attaching / viewing a pre-visit summary on generate-note.
 *
 * @param {{
 *   attached?: boolean;
 *   attachedTitle?: string | null;
 *   onPress?: () => void;
 *   disabled?: boolean;
 *   compact?: boolean;
 * }} props
 */
export default function PreVisitSummaryAttachControl({
  attached = false,
  attachedTitle = null,
  onPress,
  disabled = false,
  compact = false,
}) {
  const hostRef = useRef(null);
  const labelMeasureRef = useRef(null);
  const [labelVisible, setLabelVisible] = useState(false);

  const label = attached
    ? attachedTitle
      ? `Pre-visit summary attached: ${attachedTitle}`
      : 'Pre-visit summary attached'
    : 'Attach pre-visit summary';

  const compactDisplayText = attached
    ? attachedTitle || 'Summary attached'
    : 'No summary';

  const displayText = compact
    ? compactDisplayText
    : attached
      ? (
          <>
            <span className="font-semibold">Pre-visit summary attached</span>
            {attachedTitle ? (
              <span className="font-normal text-[#183278]/75"> — {attachedTitle}</span>
            ) : null}
          </>
        )
      : 'No pre-visit summary attached';

  useLayoutEffect(() => {
    if (!compact) {
      setLabelVisible(true);
      return undefined;
    }

    const host = hostRef.current;
    const measure = labelMeasureRef.current;
    if (!host || !measure) return undefined;

    const update = () => {
      const row = host.closest('[data-note-edit-accordion-row]');
      if (!row) return;

      const rowStyle = getComputedStyle(row);
      const gap = parseFloat(rowStyle.columnGap || rowStyle.gap || '0') || 8;
      const children = Array.from(row.children);
      const chevronButton = children[children.length - 1];
      const chevronWidth = chevronButton?.getBoundingClientRect().width ?? 0;
      const accessoryBudget =
        row.clientWidth -
        COMPACT_MIN_TITLE_RESERVE_PX -
        chevronWidth -
        gap * 2;

      setLabelVisible(
        accessoryBudget >= measure.offsetWidth + COMPACT_LABEL_CHROME_PX,
      );
    };

    const observer = new ResizeObserver(update);
    const row = host.closest('[data-note-edit-accordion-row]');
    if (row) observer.observe(row);
    update();

    return () => observer.disconnect();
  }, [compact, compactDisplayText]);

  if (!onPress) return null;

  return (
    <div ref={hostRef} className="shrink-0">
      {compact ? (
        <span
          ref={labelMeasureRef}
          className="pointer-events-none absolute whitespace-nowrap opacity-0"
          aria-hidden
        >
          {compactDisplayText}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
        className={`group flex shrink-0 items-center gap-2 rounded-lg border text-left font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3166F7]/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          compact
            ? 'px-2 py-2 text-xs'
            : 'w-full px-3 py-2.5 text-sm'
        } ${
          attached
            ? 'border-[#183278]/20 bg-[#F9FAFF] text-[#183278] hover:border-[#183278]/35 hover:bg-[#E8EEFB]'
            : 'border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300 hover:bg-amber-100/80'
        }`}
        aria-label={label}
        title={label}
      >
        <IconVisitPrep
          className={`shrink-0 ${
            compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
          } ${attached ? 'bg-[#183278]' : 'bg-amber-700'}`}
        />
        {compact ? (
          labelVisible ? (
            <span className="whitespace-nowrap">{compactDisplayText}</span>
          ) : null
        ) : (
          <span className="min-w-0 flex-1 truncate">{displayText}</span>
        )}
        {compact && labelVisible ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className={`h-3 w-3 shrink-0 transition group-hover:translate-x-0.5 ${
              attached ? 'text-[#183278]/70' : 'text-amber-700/80'
            }`}
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
        {!compact ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className={`shrink-0 transition group-hover:translate-x-0.5 ${
              attached ? 'text-[#183278]/70' : 'text-amber-700/80'
            }`}
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </button>
    </div>
  );
}
