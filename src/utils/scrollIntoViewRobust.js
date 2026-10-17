/**
 * Robust scroll helper (preserves lessons from Edit Note auto-scroll debugging).
 *
 * Why this exists:
 * - The scrollable element is not always `window` (find nearest overflow parent).
 * - Some browsers need `document.documentElement.scrollTop` / `document.body.scrollTop`
 *   in addition to `window.scrollTo`.
 * - `overflow-y: overlay` can be scrollable on some engines (include it).
 * - React dev StrictMode remounts can make naive "scroll on mount" flaky; optional
 *   sessionStorage dedupe keyed by `location.key` avoids double-invoke fighting itself.
 *
 * Debug: set localStorage.ENSCRIBE_SCROLL_DEBUG = "1" for console traces.
 *
 * Example (restore auto-scroll on a page):
 *
 *   import { useLayoutEffect } from "react";
 *   import { useLocation } from "react-router-dom";
 *   import { startScrollToElementId } from "@/utils/scrollIntoViewRobust";
 *
 *   const location = useLocation();
 *   useLayoutEffect(() => {
 *     return startScrollToElementId({
 *       elementId: "edit-note-accordion",
 *       offsetTop: 10,
 *       oncePerSession: {
 *         key: "enscribe.editNote.autoScroll.v1",
 *         token: `${location.key}:${noteId}`,
 *       },
 *     });
 *   }, [location.key, noteId]);
 */

function isScrollDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage?.getItem?.("ENSCRIBE_SCROLL_DEBUG") === "1";
  } catch {
    return false;
  }
}

function findScrollParent(node) {
  if (typeof window === "undefined") return null;
  let cur = node?.parentElement || null;
  while (cur && cur !== document.body) {
    const style = window.getComputedStyle(cur);
    const overflowY = style.overflowY;
    const canScroll =
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay") &&
      cur.scrollHeight > cur.clientHeight + 1;
    if (canScroll) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * @param {object} options
 * @param {string} options.elementId
 * @param {number} [options.offsetTop=10]
 * @param {number} [options.maxAttempts=20]
 * @param {number} [options.attemptDelayMs=50]
 * @param {{ key: string, token: string } | null} [options.oncePerSession]
 * @returns {() => void} cancel — call on unmount to clear pending timeouts
 */
export function startScrollToElementId(options) {
  const {
    elementId,
    offsetTop = 10,
    maxAttempts = 20,
    attemptDelayMs = 50,
    oncePerSession = null,
  } = options || {};

  if (typeof window === "undefined") {
    return () => {};
  }
  if (!elementId) {
    return () => {};
  }

  const debugScroll = isScrollDebugEnabled();

  if (oncePerSession?.key && oncePerSession?.token) {
    try {
      if (window.sessionStorage.getItem(oncePerSession.key) === oncePerSession.token) {
        return () => {};
      }
    } catch {
      // ignore storage failures
    }
  }

  let attempts = 0;
  let timeoutId = null;
  let cancelled = false;

  const cancel = () => {
    cancelled = true;
    if (timeoutId) window.clearTimeout(timeoutId);
    timeoutId = null;
  };

  const tryScroll = (passLabel = "pass") => {
    if (cancelled) return;
    attempts += 1;

    const el = document.getElementById(elementId);
    if (!el) {
      if (attempts < maxAttempts) {
        timeoutId = window.setTimeout(() => tryScroll(`${passLabel}-wait-el`), attemptDelayMs);
      }
      return;
    }

    const topBefore = el.getBoundingClientRect().top;
    const scrollParent = findScrollParent(el);

    if (debugScroll) {
      console.log("[scrollIntoViewRobust]", {
        passLabel,
        attempts,
        elementId,
        windowScrollY: window.scrollY,
        elRectTop: topBefore,
        scrollParent: scrollParent
          ? {
              tag: scrollParent.tagName,
              className: scrollParent.className,
              overflowY: window.getComputedStyle(scrollParent).overflowY,
              scrollTop: scrollParent.scrollTop,
              clientHeight: scrollParent.clientHeight,
              scrollHeight: scrollParent.scrollHeight,
            }
          : null,
        scrollingElement: document.scrollingElement
          ? {
              tag: document.scrollingElement.tagName,
              scrollTop: document.scrollingElement.scrollTop,
              clientHeight: document.scrollingElement.clientHeight,
              scrollHeight: document.scrollingElement.scrollHeight,
            }
          : null,
      });
    }

    if (scrollParent) {
      const topWithinParent =
        el.getBoundingClientRect().top -
        scrollParent.getBoundingClientRect().top +
        scrollParent.scrollTop;
      scrollParent.scrollTop = Math.max(0, topWithinParent - offsetTop);
    } else {
      const y = Math.max(0, window.scrollY + topBefore - offsetTop);
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
      if (document.documentElement) document.documentElement.scrollTop = y;
      if (document.body) document.body.scrollTop = y;
    }

    window.requestAnimationFrame(() => {
      if (cancelled) return;
      const topAfter = el.getBoundingClientRect().top;
      const moved = Math.abs(topAfter - topBefore) > 1;

      if (debugScroll) {
        console.log("[scrollIntoViewRobust post]", {
          passLabel,
          windowScrollY: window.scrollY,
          elRectTop: topAfter,
          moved,
          scrollParentScrollTop: scrollParent ? scrollParent.scrollTop : null,
          scrollingElementScrollTop: document.scrollingElement
            ? document.scrollingElement.scrollTop
            : null,
        });
      }

      if (!moved && topAfter > 16 && attempts < maxAttempts) {
        timeoutId = window.setTimeout(() => tryScroll(`${passLabel}-retry`), attemptDelayMs);
        return;
      }

      if (oncePerSession?.key && oncePerSession?.token) {
        try {
          window.sessionStorage.setItem(oncePerSession.key, oncePerSession.token);
        } catch {
          // ignore
        }
      }
    });
  };

  tryScroll("layout");
  return cancel;
}
