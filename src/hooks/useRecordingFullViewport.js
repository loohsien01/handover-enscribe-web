import { useEffect, useState } from "react";
import {
  PHONE_MOCKUP_MIN_HEIGHT,
  PHONE_MOCKUP_VIEWPORT_RESERVE_REM,
  PHONE_SCREEN_HEIGHT,
} from "@/components/PhoneDeviceFrame";
import { MOBILE_VIEWPORT_MEDIA } from "@/utils/device";

function isNarrowRecordingViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_VIEWPORT_MEDIA).matches;
}

function isPhoneMockupHeightCramped() {
  if (typeof window === "undefined") return false;
  const rootFontPx =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const mockupHeight = Math.min(
    PHONE_SCREEN_HEIGHT,
    window.innerHeight - PHONE_MOCKUP_VIEWPORT_RESERVE_REM * rootFontPx,
  );
  return mockupHeight < PHONE_MOCKUP_MIN_HEIGHT;
}

/**
 * Full-bleed recording layout when the desktop phone mockup cannot fit:
 * below Tailwind `lg` (1024px wide), or the scaled mockup would be shorter
 * than `PHONE_MOCKUP_MIN_HEIGHT`. User agent is ignored — same as the old `lg:` CSS.
 */
export function isRecordingFullViewport() {
  return isNarrowRecordingViewport() || isPhoneMockupHeightCramped();
}

/**
 * Reactive full-bleed flag for /active-recording (viewport width or height).
 */
export default function useRecordingFullViewport() {
  const [fullViewport, setFullViewport] = useState(() =>
    isRecordingFullViewport(),
  );

  useEffect(() => {
    const widthMq = window.matchMedia(MOBILE_VIEWPORT_MEDIA);
    const onChange = () => setFullViewport(isRecordingFullViewport());
    onChange();
    widthMq.addEventListener("change", onChange);
    window.addEventListener("orientationchange", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      widthMq.removeEventListener("change", onChange);
      window.removeEventListener("orientationchange", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  return fullViewport;
}
