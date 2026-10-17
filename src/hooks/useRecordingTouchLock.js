import { useCallback, useEffect, useRef, useState } from "react";
import useCoarsePointer from "@/hooks/useCoarsePointer";

export const TOUCH_LOCK_HOLD_MS = 600;
export const TOUCH_LOCK_IDLE_RELOCK_MS = 10_000;

/**
 * Pocket-mode screen lock: blocks in-app touches while recording (active, not paused)
 * on coarse-pointer devices until the user holds the unlock control.
 */
export default function useRecordingTouchLock({
  isRecording,
  isRecordingPaused,
  enabled = true,
}) {
  const isCoarsePointer = useCoarsePointer();
  const featureEnabled = enabled && isCoarsePointer;
  const shouldAutoLock =
    featureEnabled && isRecording && !isRecordingPaused;

  const [userUnlocked, setUserUnlocked] = useState(false);
  const idleTimerRef = useRef(null);
  const prevShouldAutoLockRef = useRef(false);

  const screenLocked = shouldAutoLock && !userUnlocked;

  const clearIdleRelock = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleIdleRelock = useCallback(() => {
    clearIdleRelock();
    if (!shouldAutoLock) return;
    idleTimerRef.current = setTimeout(() => {
      setUserUnlocked(false);
    }, TOUCH_LOCK_IDLE_RELOCK_MS);
  }, [clearIdleRelock, shouldAutoLock]);

  const unlockScreen = useCallback(() => {
    setUserUnlocked(true);
    scheduleIdleRelock();
  }, [scheduleIdleRelock]);

  const bumpIdleRelock = useCallback(() => {
    if (!userUnlocked || !shouldAutoLock) return;
    scheduleIdleRelock();
  }, [userUnlocked, shouldAutoLock, scheduleIdleRelock]);

  useEffect(() => {
    const wasAutoLock = prevShouldAutoLockRef.current;
    if (shouldAutoLock && !wasAutoLock) {
      setUserUnlocked(false);
    }
    if (!shouldAutoLock) {
      setUserUnlocked(false);
      clearIdleRelock();
    }
    prevShouldAutoLockRef.current = shouldAutoLock;
  }, [shouldAutoLock, clearIdleRelock]);

  useEffect(() => () => clearIdleRelock(), [clearIdleRelock]);

  const needsEndRecordingConfirm =
    featureEnabled && shouldAutoLock && userUnlocked;

  return {
    featureEnabled,
    screenLocked,
    userUnlocked,
    unlockScreen,
    bumpIdleRelock,
    needsEndRecordingConfirm,
  };
}
