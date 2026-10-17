import React from "react";
import { BAR_COUNT } from "@/utils/recordingMeter.js";

/**
 * Web equivalent of emscribe-mobile LiveRecordingMeter: scrolling bar history from mic level.
 *
 * @param {"default" | "recordingDark"} [variant] — `recordingDark` matches ActiveRecordingScreen (white bars on blue).
 */
export default function LiveRecordingMeter({
  samples,
  mode,
  isPaused = false,
  className = "",
  variant = "default",
}) {
  const dim = isPaused ? "opacity-[0.35]" : "opacity-100";
  const isDark = variant === "recordingDark";
  const wrap = isDark
    ? `mt-1 px-1 py-3 ${className}`
    : `mt-3 rounded-lg border border-gray-200 bg-gray-50 px-2 py-3 ${className}`;
  const barTone = isDark ? "bg-white" : "bg-blue-600";
  const captionMuted = isDark
    ? "text-[11px] leading-snug text-white/85"
    : "mt-1 text-center text-[11px] leading-snug text-gray-500";
  const fallbackBar = isDark ? "h-14 w-2 rounded bg-white" : "h-14 w-2 rounded bg-gray-300";
  const fallbackCaption = isDark
    ? "mt-1.5 text-center text-[11px] leading-snug text-white/85"
    : "mt-1.5 text-center text-[11px] leading-snug text-gray-600";

  if (mode === "metering") {
    const pad = BAR_COUNT - (samples?.length ?? 0);
    const padded =
      pad > 0
        ? [...Array(pad).fill(0.04), ...(samples ?? [])].slice(-BAR_COUNT)
        : (samples ?? []).slice(-BAR_COUNT);

    return (
      <div className={wrap}>
        <div
          className={`mx-auto flex h-[6.5rem] max-w-md items-stretch justify-between gap-[2px] ${dim}`}
          role="status"
          aria-label="Live microphone level"
        >
          {padded.map((h, i) => (
            <div
              key={i}
              className="flex min-w-[2px] flex-1 items-center justify-center"
            >
              <div
                className={`w-full max-w-[7px] min-w-[2px] self-center rounded-full ${barTone}`}
                style={{
                  height: `${4 + h * 92}px`,
                  minHeight: "4px",
                  opacity: isDark ? 0.35 + h * 0.65 : 1,
                }}
              />
            </div>
          ))}
        </div>
        {!isDark ? (
          <p className={captionMuted}>Live input level</p>
        ) : null}
      </div>
    );
  }

  const fallbackMessage =
    mode === "unknown"
      ? "Ready to start recording..."
      : "Microphone level meter unavailable in this browser.";

  return (
    <div className={wrap}>
      <div
        className={`mx-auto flex h-24 max-w-md items-center justify-center gap-2.5 ${dim} animate-pulse`}
        role="status"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={fallbackBar} aria-hidden />
        ))}
      </div>
      <p className={fallbackCaption}>{fallbackMessage}</p>
    </div>
  );
}
