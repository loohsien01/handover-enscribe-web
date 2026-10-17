import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import { msUntilAccessTokenRefresh } from "@/utils/jwtUser.js";
import { BAR_COUNT, meteringDbToBarDisplay } from "@/utils/recordingMeter.js";
import {
  pendingToFile,
  savePending,
  triggerRecordingDownload,
} from "@/utils/pendingRecordingsDb.js";

/** Matroska/WebM EBML ID at offset 0 — required for demuxers (ffprobe, ffmpeg). */
async function blobStartsWithWebmEbmlMagic(blob) {
  if (!blob || blob.size < 4) return false;
  const buf = await blob.slice(0, 4).arrayBuffer();
  const b = new Uint8Array(buf);
  return b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
}

const DEFAULT_MAX_DURATION_SEC = 40 * 60;

function clearRecordingRefreshTimer(timerRef) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

/**
 * In-browser mic capture (WebM/Opus), duration clock, optional level meter,
 * JWT refresh while recording, and finalize-on-unload.
 *
 * @param {object} options
 * @param {() => Promise<unknown>} options.acquireWakeLock
 * @param {() => void} options.releaseWakeLock
 * @param {() => Promise<{ valid?: boolean }>} options.checkAuth
 * @param {() => void | Promise<void>} [options.prepareNewRecording] — after auth, before getUserMedia
 * @param {() => string} [options.getEncounterName] — encounter label for IDB (max 120 chars)
 * @param {(handoff: { id: string, idbId: string, sizeBytes: number, durationSec: number, encounterName: string }) => void | Promise<void>} options.onRecordingReady
 * @param {boolean} [options.enableLiveMeter]
 * @param {number} [options.maxDurationSec]
 * @returns Hook API includes `abandonRecording` to discard capture without calling onRecordingReady
 */
export default function useEncounterRecording({
  acquireWakeLock,
  releaseWakeLock,
  checkAuth,
  prepareNewRecording,
  getEncounterName,
  onRecordingReady,
  enableLiveMeter = false,
  maxDurationSec = DEFAULT_MAX_DURATION_SEC,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingDurationRef = useRef(0);
  const [liveMeterSamples, setLiveMeterSamples] = useState([]);
  const [liveMeterMode, setLiveMeterMode] = useState("unknown");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isRecordingRef = useRef(false);
  const abandonRecordingRef = useRef(false);
  const recordingIntervalRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const meterRafRef = useRef(null);
  const meterLoopActiveRef = useRef(false);
  const meterSamplesHistoryRef = useRef([]);
  const meterGenRef = useRef(0);
  const isRecordingPausedRef = useRef(false);

  const acquireWakeLockRef = useRef(acquireWakeLock);
  const releaseWakeLockRef = useRef(releaseWakeLock);
  const checkAuthRef = useRef(checkAuth);
  const onRecordingReadyRef = useRef(onRecordingReady);
  const prepareNewRecordingRef = useRef(prepareNewRecording);
  const getEncounterNameRef = useRef(getEncounterName);

  useEffect(() => {
    acquireWakeLockRef.current = acquireWakeLock;
    releaseWakeLockRef.current = releaseWakeLock;
  }, [acquireWakeLock, releaseWakeLock]);

  useEffect(() => {
    checkAuthRef.current = checkAuth;
  }, [checkAuth]);

  useEffect(() => {
    onRecordingReadyRef.current = onRecordingReady;
  }, [onRecordingReady]);

  useEffect(() => {
    prepareNewRecordingRef.current = prepareNewRecording;
  }, [prepareNewRecording]);

  useEffect(() => {
    getEncounterNameRef.current = getEncounterName;
  }, [getEncounterName]);

  const teardownRecordingMeter = useCallback(() => {
    meterGenRef.current += 1;
    meterLoopActiveRef.current = false;
    if (meterRafRef.current != null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    try {
      sourceNodeRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    sourceNodeRef.current = null;
    try {
      analyserRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    analyserRef.current = null;
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx) {
      ctx.close().catch(() => {});
    }
    meterSamplesHistoryRef.current = [];
    setLiveMeterSamples([]);
    setLiveMeterMode("unknown");
  }, []);

  const beginRecordingMeter = useCallback(
    (stream) => {
      if (!enableLiveMeter) return;

      const genAtStart = meterGenRef.current;
      meterLoopActiveRef.current = true;
      setLiveMeterMode("unknown");
      meterSamplesHistoryRef.current = [];

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        meterLoopActiveRef.current = false;
        setLiveMeterMode("fallback");
        return;
      }

      const start = async () => {
        try {
          if (genAtStart !== meterGenRef.current) {
            meterLoopActiveRef.current = false;
            return;
          }

          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.65;
          analyserRef.current = analyser;
          const source = ctx.createMediaStreamSource(stream);
          sourceNodeRef.current = source;
          source.connect(analyser);

          await ctx.resume();

          if (genAtStart !== meterGenRef.current || !meterLoopActiveRef.current) {
            try {
              source.disconnect();
            } catch {
              /* ignore */
            }
            try {
              analyser.disconnect();
            } catch {
              /* ignore */
            }
            sourceNodeRef.current = null;
            analyserRef.current = null;
            await ctx.close().catch(() => {});
            if (audioContextRef.current === ctx) {
              audioContextRef.current = null;
            }
            meterLoopActiveRef.current = false;
            return;
          }

          const timeData = new Float32Array(analyser.fftSize);
          let lastUi = 0;

          const tick = (t) => {
            if (!meterLoopActiveRef.current) {
              return;
            }
            meterRafRef.current = requestAnimationFrame(tick);
            if (!isRecordingPausedRef.current) {
              analyser.getFloatTimeDomainData(timeData);
              let sum = 0;
              for (let i = 0; i < timeData.length; i += 1) {
                const v = timeData[i];
                sum += v * v;
              }
              const rms = Math.sqrt(sum / timeData.length);
              const db = 20 * Math.log10(rms + 1e-8);
              const shaped = meteringDbToBarDisplay(db);
              meterSamplesHistoryRef.current.push(shaped);
              if (meterSamplesHistoryRef.current.length > BAR_COUNT) {
                meterSamplesHistoryRef.current =
                  meterSamplesHistoryRef.current.slice(-BAR_COUNT);
              }
              if (t - lastUi > 48) {
                lastUi = t;
                setLiveMeterSamples([...meterSamplesHistoryRef.current]);
                setLiveMeterMode("metering");
              }
            }
          };

          meterRafRef.current = requestAnimationFrame(tick);
        } catch (e) {
          console.warn("Live meter unavailable:", e);
          meterLoopActiveRef.current = false;
          setLiveMeterMode("fallback");
        }
      };

      void start();
    },
    [enableLiveMeter],
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      teardownRecordingMeter();
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
      setIsRecording(false);
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      clearRecordingRefreshTimer(refreshTimerRef);
    }

    try {
      releaseWakeLockRef.current?.();
    } catch (e) {
      console.warn("Error releasing wake lock on stop:", e);
    }
  }, [teardownRecordingMeter]);

  /** Stop capture without producing a file or calling onRecordingReady (e.g. user leaves recording UI). */
  const abandonRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || !isRecordingRef.current) {
      return;
    }
    abandonRecordingRef.current = true;
    teardownRecordingMeter();

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    clearRecordingRefreshTimer(refreshTimerRef);

    if (mr.state === "recording" || mr.state === "paused") {
      mr.stop();
    }

    isRecordingRef.current = false;
    setIsRecording(false);
    setIsRecordingPaused(false);
    isRecordingPausedRef.current = false;

    try {
      releaseWakeLockRef.current?.();
    } catch (e) {
      console.warn("Error releasing wake lock on abandon:", e);
    }
  }, [teardownRecordingMeter]);

  const startRecording = useCallback(async () => {
    try {
      if (typeof acquireWakeLockRef.current === "function") {
        const ok = await acquireWakeLockRef.current();
        console.log("Wake lock acquire result (on Start click):", ok);
      }
    } catch (e) {
      console.warn("Wake lock acquisition threw:", e);
    }

    const authCheck = await checkAuthRef.current();
    if (!authCheck?.valid) {
      try {
        releaseWakeLockRef.current?.();
      } catch (e) {
        console.warn("Error releasing wake lock after auth failure:", e);
      }
      if (authCheck?.networkError) {
        alert(
          "Could not verify your session. Check your internet connection and try again.",
        );
      } else if (authCheck?.requiresLogin) {
        alert(
          "Your session has expired. Please log in again to continue recording.",
        );
      } else {
        alert(
          "Could not verify your session right now. Please try again in a moment.",
        );
      }
      return;
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    try {
      await prepareNewRecordingRef.current?.();
    } catch (e) {
      console.warn("prepareNewRecording failed:", e);
    }

    setRecordingDuration(0);
    recordingDurationRef.current = 0;

    try {
      teardownRecordingMeter();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
        },
      });

      if (enableLiveMeter) {
        beginRecordingMeter(stream);
      }

      const mediaRecorder = new window.MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }

        clearRecordingRefreshTimer(refreshTimerRef);

        const shouldAbandon = abandonRecordingRef.current;
        abandonRecordingRef.current = false;

        if (shouldAbandon) {
          audioChunksRef.current = [];
          setRecordingDuration(0);
          recordingDurationRef.current = 0;
          mediaRecorderRef.current = null;
          try {
            stream.getTracks().forEach((track) => track.stop());
          } catch {
            /* ignore */
          }
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        try {
          const okEbml = await blobStartsWithWebmEbmlMagic(audioBlob);
          if (!okEbml) {
            console.error(
              "[Recording] Blob missing WebM EBML at offset 0; size=",
              audioBlob.size,
            );
            alert(
              "The recording was not saved in a valid audio format. Please try recording again, or upload a file instead.",
            );
            return;
          }

          const encounterName = String(getEncounterNameRef.current?.() ?? "")
            .trim()
            .slice(0, 120);
          const id =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const durationSec = recordingDurationRef.current;

          try {
            await savePending(
              {
                id,
                blob: audioBlob,
                mimeType: "audio/webm",
                sizeBytes: audioBlob.size,
                durationSec,
                encounterName,
                capturedAt: new Date().toISOString(),
                status: "local",
                attempts: 0,
                lastError: null,
                uploadedPath: null,
              },
              { replace: true },
            );
          } catch (saveError) {
            console.error("[Recording] IndexedDB save failed:", saveError);
            const isQuota =
              saveError?.name === "QuotaExceededError" ||
              saveError?.message?.includes("quota");
            alert(
              isQuota
                ? "Could not save the recording on this device (storage full). Download a copy to keep it."
                : "Could not save the recording on this device. Download a copy to keep it.",
            );
            triggerRecordingDownload(
              pendingToFile({ blob: audioBlob, mimeType: "audio/webm" }),
            );
            return;
          }

          await onRecordingReadyRef.current?.({
            id,
            idbId: id,
            sizeBytes: audioBlob.size,
            durationSec,
            encounterName,
          });
        } finally {
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
      isRecordingRef.current = true;
      setIsRecording(true);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prevDuration) => {
          const newDuration = prevDuration + 1;
          console.log(`Recording duration: ${newDuration} seconds`);
          if (newDuration >= maxDurationSec) {
            stopRecording();
          }
          recordingDurationRef.current = newDuration;
          return newDuration;
        });
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      try {
        releaseWakeLockRef.current?.();
      } catch (e) {
        console.warn("Error releasing wake lock after mic error:", e);
      }
      alert("Error accessing microphone. Please check permissions.");
    }
  }, [
    teardownRecordingMeter,
    beginRecordingMeter,
    enableLiveMeter,
    maxDurationSec,
    stopRecording,
  ]);

  const toggleRecordingPause = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || !isRecordingRef.current) return;

    if (typeof mr.pause !== "function" || typeof mr.resume !== "function") {
      alert("Pause and resume are not supported in this browser.");
      return;
    }

    if (mr.state === "recording") {
      mr.pause();
      setIsRecordingPaused(true);
      isRecordingPausedRef.current = true;
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    } else if (mr.state === "paused") {
      mr.resume();
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
      if (!recordingIntervalRef.current) {
        recordingIntervalRef.current = setInterval(() => {
          setRecordingDuration((prevDuration) => {
            const newDuration = prevDuration + 1;
            console.log(`Recording duration: ${newDuration} seconds`);
            if (newDuration >= maxDurationSec) {
              stopRecording();
            }
            recordingDurationRef.current = newDuration;
            return newDuration;
          });
        }, 1000);
      }
    }
  }, [maxDurationSec, stopRecording]);

  useEffect(() => {
    return () => {
      teardownRecordingMeter();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      clearRecordingRefreshTimer(refreshTimerRef);
    };
  }, [teardownRecordingMeter]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    let cancelled = false;

    const scheduleNextRefresh = () => {
      if (cancelled) return;
      clearRecordingRefreshTimer(refreshTimerRef);

      const delay = msUntilAccessTokenRefresh(api.getJWT());
      refreshTimerRef.current = setTimeout(async () => {
        if (cancelled) return;
        console.log(
          "[Recording] Proactive JWT refresh scheduled at exp − margin",
        );
        try {
          const result = await api.refreshSession();
          if (result?.success) {
            console.log("[Recording] JWT refreshed successfully during recording");
          } else {
            console.warn(
              "[Recording] JWT refresh failed:",
              result?.error || "Unknown error",
            );
          }
        } catch (error) {
          console.warn("[Recording] JWT refresh error:", error);
        }
        scheduleNextRefresh();
      }, delay);
    };

    void api.ensureFreshAccessToken().then(() => {
      if (!cancelled) scheduleNextRefresh();
    });

    return () => {
      cancelled = true;
      clearRecordingRefreshTimer(refreshTimerRef);
    };
  }, [isRecording]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isRecordingRef.current) return;
      const mr = mediaRecorderRef.current;
      const state = mr?.state;
      if (state !== "recording" && state !== "paused") return;
      e.preventDefault();
      e.returnValue = "";
    };

    const handlePageHide = (e) => {
      if (e.persisted) return;
      if (!isRecordingRef.current) return;
      abandonRecording();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [abandonRecording]);

  const out = {
    isRecording,
    isRecordingPaused,
    recordingDuration,
    setRecordingDuration,
    recordingDurationRef,
    startRecording,
    stopRecording,
    abandonRecording,
    toggleRecordingPause,
  };

  if (enableLiveMeter) {
    out.liveMeterSamples = liveMeterSamples;
    out.liveMeterMode = liveMeterMode;
  }

  return out;
}
