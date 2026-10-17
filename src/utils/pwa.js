/**
 * PWA / installed web app helpers (Add to Home Screen, standalone display mode).
 */

/** @returns {boolean} True when launched from home screen (no browser URL bar). */
export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

/**
 * @returns {'standalone' | 'browser' | 'minimal-ui' | 'fullscreen' | 'unknown'}
 */
export function getPwaDisplayMode() {
  if (typeof window === "undefined") return "browser";
  if (isStandalonePwa()) return "standalone";

  const queries = [
    "standalone",
    "fullscreen",
    "minimal-ui",
    "browser",
  ];
  for (const mode of queries) {
    if (window.matchMedia(`(display-mode: ${mode})`).matches) {
      return mode;
    }
  }
  return "unknown";
}

/** iPhone / iPad (including iPadOS desktop UA). */
export function isAppleMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/**
 * Tags `<html>` for CSS/analytics (`data-display-mode`, `data-pwa-standalone`).
 * Call once at app bootstrap.
 */
export function applyPwaLaunchTags() {
  if (typeof document === "undefined") return;
  const mode = getPwaDisplayMode();
  document.documentElement.dataset.displayMode = mode;
  document.documentElement.dataset.pwaStandalone = isStandalonePwa()
    ? "true"
    : "false";
}
