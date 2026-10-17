import React, { useCallback, useEffect, useRef, useState } from "react";
import { TOUCH_LOCK_HOLD_MS } from "@/hooks/useRecordingTouchLock";

const SAFE_AREA_STYLE = {
  paddingLeft: "var(--safe-area-left)",
  paddingRight: "var(--safe-area-right)",
};

function HoldToUnlockButton({ holdDurationMs, onUnlockComplete }) {
  const [progress, setProgress] = useState(0);
  const activeRef = useRef(false);
  const startTimeRef = useRef(0);
  const frameRef = useRef(null);

  const clearHold = useCallback(() => {
    activeRef.current = false;
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setProgress(0);
  }, []);

  const tick = useCallback(() => {
    if (!activeRef.current) return;
    const elapsed = Date.now() - startTimeRef.current;
    const p = Math.min(1, elapsed / holdDurationMs);
    setProgress(p);
    if (p >= 1) {
      clearHold();
      onUnlockComplete();
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  }, [holdDurationMs, onUnlockComplete, clearHold]);

  const startHold = useCallback(
    (e) => {
      e.preventDefault();
      if (activeRef.current) return;
      activeRef.current = true;
      startTimeRef.current = Date.now();
      frameRef.current = requestAnimationFrame(tick);
    },
    [tick],
  );

  useEffect(() => () => clearHold(), [clearHold]);

  const progressPct = Math.round(progress * 100);

  const holdFill = `linear-gradient(90deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.38) ${progressPct}%, rgba(255,255,255,0.1) ${progressPct}%, rgba(255,255,255,0.1) 100%)`;

  return (
    <button
      type="button"
      className="relative flex min-h-12 min-w-[8.5rem] items-center justify-center overflow-hidden rounded-full border-2 border-white/70 px-6 py-3 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] touch-none select-none"
      style={{
        WebkitTouchCallout: "none",
        background: holdFill,
      }}
      onPointerDown={startHold}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onPointerLeave={clearHold}
      aria-label="Hold to unlock screen"
    >
      Hold to unlock
    </button>
  );
}

/**
 * Full-screen touch shield for active recording (mobile / coarse pointer).
 * Uniform scrim over the whole viewport; unlock control sits upper-middle (away from End/Pause).
 */
export default function RecordingTouchLockOverlay({
  onUnlockComplete,
  holdDurationMs = TOUCH_LOCK_HOLD_MS,
}) {
  return (
    <div
      className="absolute inset-0 z-30 touch-none select-none"
      style={{ WebkitTouchCallout: "none", ...SAFE_AREA_STYLE }}
      role="presentation"
    >
      <div
        className="pointer-events-auto absolute inset-0 bg-slate-900/50"
        aria-hidden
      />

      <div className="pointer-events-none relative flex h-full flex-col px-5">
        <div className="min-h-0 flex-[1.05]" aria-hidden />
        <div className="flex shrink-0 flex-col items-center pb-6 pt-2">
          <p className="mb-3 text-center text-sm font-medium text-white/92 drop-shadow-sm">
            Screen locked
          </p>
          <div className="pointer-events-auto">
            <HoldToUnlockButton
              holdDurationMs={holdDurationMs}
              onUnlockComplete={onUnlockComplete}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1" aria-hidden />
      </div>
    </div>
  );
}
