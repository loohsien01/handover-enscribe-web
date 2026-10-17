/**
 * Mobile detection aligned with Tailwind `lg:` (1024px) used by the app shell.
 */

/** Matches `max-lg:` — viewport below desktop sidebar breakpoint. */
export const MOBILE_VIEWPORT_MEDIA = "(max-width: 1023px)";

/**
 * Install hint eligibility: Tailwind `sm` / `md` widths only (strictly below `lg`).
 * Does not use `(pointer: coarse)` — works in Chrome on Android and Safari on iOS.
 */
export const INSTALL_HINT_VIEWPORT_MEDIA = MOBILE_VIEWPORT_MEDIA;

export function isInstallHintViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(INSTALL_HINT_VIEWPORT_MEDIA).matches;
}

function isIosDevice(ua) {
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1)
  );
}

/**
 * Platform-specific install copy (not used to gate whether the hint shows).
 * @returns {'ios-safari' | 'ios-chrome' | 'ios-other' | 'android-chrome' | 'android' | 'generic'}
 */
export function getInstallHintPlatform() {
  if (typeof navigator === "undefined") return "generic";
  const ua = navigator.userAgent || "";
  if (isIosDevice(ua)) {
    if (/CriOS/i.test(ua)) return "ios-chrome";
    if (/FxiOS|EdgiOS|OPiOS/i.test(ua)) return "ios-other";
    return "ios-safari";
  }
  if (/Android/i.test(ua)) {
    if (/Chrome/i.test(ua) && !/Edg|OPR|SamsungBrowser/i.test(ua)) {
      return "android-chrome";
    }
    return "android";
  }
  return "generic";
}

export function isMobileUserAgent() {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

/**
 * True on phones/tablets in the mobile layout, including Chrome/Android where
 * `(pointer: coarse)` may be false.
 */
export function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia(MOBILE_VIEWPORT_MEDIA).matches || isMobileUserAgent()
  );
}
