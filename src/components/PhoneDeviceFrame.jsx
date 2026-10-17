import React from "react";

/** Desktop mockup size — change these to resize the phone on large screens. */
export const PHONE_SCREEN_WIDTH = 450;
export const PHONE_SCREEN_HEIGHT = 920;

/**
 * Vertical space reserved around the desktop mockup (`py-10` + bezel breathing room).
 * Must match the `100dvh - Nrem` calc on the mockup screen.
 */
export const PHONE_MOCKUP_VIEWPORT_RESERVE_REM = 7;

/**
 * Min scaled mockup height (px) before /active-recording drops the phone frame
 * for full-bleed. Independent of width: the phone still requires `lg` (1024px+).
 */
export const PHONE_MOCKUP_MIN_HEIGHT = 600;

/**
 * Dynamic Island strip — desktop mockup only (real devices use the OS status bar).
 */
export function PhoneStatusBar({ backgroundColor = "#3166F7", className = "" }) {
  return (
    <div
      className={`relative z-[2] hidden h-[52px] shrink-0 items-end justify-center pb-2 lg:flex ${className}`.trim()}
      style={{ backgroundColor }}
      aria-hidden
    >
      <div className="relative flex h-[26px] w-[96px] items-center justify-end rounded-full bg-black pr-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.35)]">
        <div className="h-[9px] w-[9px] rounded-full bg-[#1a1a1c] ring-1 ring-[#2c2c2e]" />
      </div>
    </div>
  );
}

/** Home indicator — desktop mockup only. */
export function PhoneHomeIndicator({ className = "" }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-2 z-[3] hidden justify-center lg:flex ${className}`.trim()}
      aria-hidden
    >
      <div className="h-[5px] w-[min(134px,36%)] rounded-full bg-white/35" />
    </div>
  );
}

/**
 * Desktop (lg+): iPhone-style bezel. Mobile / short viewports / `fullViewport`:
 * pass-through full-width shell (no bezel).
 * @param {boolean} [fullViewport] — fill the recording shell; skip desktop mockup chrome
 * @param {number} [screenWidth] — mockup width in px (desktop)
 * @param {number} [screenHeight] — mockup height in px (desktop)
 */
export default function PhoneDeviceFrame({
  children,
  className = "",
  fullViewport = false,
  screenWidth = PHONE_SCREEN_WIDTH,
  screenHeight = PHONE_SCREEN_HEIGHT,
}) {
  const screenAspectRatio = screenWidth / screenHeight;
  const fillLayout = "flex flex-1 min-h-0 w-full flex-col";
  const stackedLayout = "min-h-[var(--mobile-viewport-height)]";
  const frameLayout = fullViewport ? fillLayout : stackedLayout;
  const desktopMockup = !fullViewport;

  return (
    <div
      className={`w-full ${frameLayout} ${desktopMockup ? "lg:mx-auto lg:w-fit lg:min-h-0 lg:flex-none" : ""} ${className}`.trim()}
    >
      <div
        className={`${frameLayout} w-full ${desktopMockup ? "lg:w-fit lg:min-h-0 lg:flex-none lg:rounded-[3rem] lg:bg-black lg:p-[11px] lg:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.35),0_16px_32px_-12px_rgba(0,0,0,0.45)] lg:ring-1 lg:ring-black/50" : ""}`}
      >
        <div
          className={`relative ${frameLayout} w-full overflow-hidden ${desktopMockup ? "lg:min-h-0 lg:shrink-0 lg:rounded-[2.35rem] lg:bg-black lg:h-[min(var(--phone-h),calc(100dvh-var(--phone-vh-reserve)))] lg:w-[min(var(--phone-w),calc((100dvh-var(--phone-vh-reserve))*var(--phone-ar)))] lg:flex-none lg:ring-1 lg:ring-black/60" : ""}`}
          style={
            desktopMockup
              ? {
                  "--phone-h": `${screenHeight}px`,
                  "--phone-w": `${screenWidth}px`,
                  "--phone-ar": screenAspectRatio,
                  "--phone-vh-reserve": `${PHONE_MOCKUP_VIEWPORT_RESERVE_REM}rem`,
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
