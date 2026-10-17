import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

const LG_MEDIA = "(min-width: 1024px)";

/**
 * Note textarea with expand/collapse when content exceeds the collapsed height
 * (pairs with globals.css: overflow-y hidden until :focus, so mobile drags scroll
 * the page instead of a nested textarea). Expanded mode grows to full
 * content height so no inner scrollbar is needed.
 *
 * Below `lg`: starts collapsed; toggle appears when content overflows (expand mode).
 * At `lg` and up: starts expanded (full height); toggle is contract mode (collapse).
 */
export default function ExpandableNoteTextarea({
  value,
  onChange,
  disabled = false,
  id,
  placeholder,
  className = "",
  /** Tailwind max-h-* for collapsed state (content clipped). */
  collapsedMaxClass = "max-h-72",
  /** Tailwind min-h-* when collapsed (optional). */
  collapsedMinClass = "min-h-56",
}) {
  const ref = useRef(null);
  /** Below lg: default collapsed. At lg+: default expanded (full height). */
  const [expanded, setExpanded] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(LG_MEDIA).matches : false
  );
  /** Pixel height when showing full content (expanded on sm, or always at lg+) */
  const [expandedHeightPx, setExpandedHeightPx] = useState(null);
  const [canExpand, setCanExpand] = useState(false);
  const [isLg, setIsLg] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(LG_MEDIA).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(LG_MEDIA);
    const onChangeMq = () => setIsLg(mq.matches);
    onChangeMq();
    mq.addEventListener("change", onChangeMq);
    return () => mq.removeEventListener("change", onChangeMq);
  }, []);

  /** Crossing breakpoints: lg defaults to expanded; below lg defaults to collapsed. */
  useEffect(() => {
    setExpanded(isLg);
  }, [isLg]);

  const fullSize = expanded;
  const showToggle = expanded || canExpand;

  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;

    const sync = () => {
      const el = ref.current;
      if (!el) return;
      if (expanded) {
        const h = el.scrollHeight;
        setExpandedHeightPx(h);
      } else {
        setExpandedHeightPx(null);
        setCanExpand(el.scrollHeight > el.clientHeight + 2);
      }
    };

    sync();
    let rafDone = false
    const id1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!rafDone) sync()
      })
    })

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", sync);
      return () => {
        rafDone = true
        cancelAnimationFrame(id1)
        window.removeEventListener("resize", sync);
      }
    }

    const ro = new ResizeObserver(sync);
    ro.observe(ta);
    window.addEventListener("resize", sync);
    return () => {
      rafDone = true
      cancelAnimationFrame(id1)
      ro.disconnect()
      window.removeEventListener("resize", sync)
    }
  }, [expanded, value, isLg]);

  const heightClasses = fullSize
    ? "min-h-0 max-h-none"
    : `${collapsedMinClass} ${collapsedMaxClass}`

  const togglePaddingClass = showToggle ? "pr-9 pb-12" : ""

  const expandStyle =
    fullSize && expandedHeightPx != null
      ? {
          height: expandedHeightPx,
          maxHeight: "none",
          minHeight: 0,
          overflowY: "hidden",
        }
      : undefined;

  return (
    <div className="relative rounded-lg">
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        style={expandStyle}
        className={`w-full border rounded-lg bg-white px-3 pt-2 pb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500 border-gray-300 resize-none ${togglePaddingClass} ${heightClasses} ${className}`}
      />
      {showToggle && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="absolute bottom-4 right-2.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded border border-blue-600 bg-blue-500 text-white shadow-sm hover:bg-blue-600 disabled:opacity-50"
          title={
            expanded
              ? isLg
                ? "Contract"
                : "Show less"
              : "Show more"
          }
          aria-label={
            expanded
              ? isLg
                ? "Contract note field"
                : "Collapse note field"
              : "Expand note field"
          }
        >
          {expanded ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="6 15 12 9 18 15" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
