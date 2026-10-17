import React, { useEffect, useMemo, useRef, useState } from "react";
import RecordingPreviewOverlay from "@/components/RecordingPreviewOverlay.jsx";
import useRecordingPreview from "@/hooks/useRecordingPreview.js";
import * as format from "@/utils/format.js";
import "./SimpleAudioPlayer.css";

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function extensionFromPathOrName(s) {
  if (!s || typeof s !== "string") return "";
  const base = s.split("?")[0].split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

function getExtension(src, filename) {
  const fromFile = extensionFromPathOrName(filename);
  if (fromFile) return fromFile;
  try {
    const path = new URL(
      src,
      typeof window !== "undefined" ? window.location.href : undefined,
    ).pathname;
    return extensionFromPathOrName(path);
  } catch {
    return extensionFromPathOrName(src);
  }
}

function getAudioType(ext) {
  const typeMap = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: "audio/webm",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    opus: "audio/ogg",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
  };
  return typeMap[ext] || "audio/mpeg";
}

/** iOS Safari and Chrome (WebKit) often cannot play WebM/Opus or Ogg in <audio>. */
function isInBrowserPlaybackUnsupported(ext) {
  const a =
    typeof document !== "undefined" ? document.createElement("audio") : null;
  if (!a) return false;

  if (ext === "webm") {
    return (
      !a.canPlayType('audio/webm; codecs="opus"') &&
      !a.canPlayType("audio/webm; codecs=opus") &&
      !a.canPlayType("audio/webm")
    );
  }
  if (ext === "ogg" || ext === "oga" || ext === "opus") {
    return (
      !a.canPlayType('audio/ogg; codecs="opus"') &&
      !a.canPlayType("audio/ogg; codecs=opus") &&
      !a.canPlayType("audio/ogg")
    );
  }
  return false;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

const RECORDING_FILE_ICON_SRC = "/recording-file-icon-outline.svg";

function PlayIcon({ size = 13 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 5.14v13.72L19 12z" />
    </svg>
  );
}

function PauseIcon({ size = 11 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}

/**
 * Simple pill-style player (see mixed_width_layout_concept.html .rec-pill).
 *
 * Props:
 * - src: signed/public audio URL for playback
 * - recording: recording object (id/path/size/created_at/patientEncounter/...) used for details popup
 * - label: middle label text (default: "Recording")
 * - onDetailsClick: optional custom handler; otherwise opens shared RecordingPreviewOverlay
 * - showEncounterActions: hide Create/View Patient Encounter in the details overlay (default true)
 */
export default function SimpleAudioPlayer({
  src,
  recording,
  label = "Recording",
  onDetailsClick,
  onError,
  showEncounterActions = true,
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(null);
  const [audioErrorMessage, setAudioErrorMessage] = useState("");

  const {
    selectedRecording,
    recordingData,
    loadingRecording,
    openRecordingPreview,
    closePreview,
  } = useRecordingPreview();

  const filename = useMemo(() => {
    if (recording?.path) return format.extractRecordingFilenameFromPath(recording.path);
    return "recording.webm";
  }, [recording?.path]);

  const ext = useMemo(() => getExtension(src, filename), [src, filename]);
  const audioType = useMemo(() => getAudioType(ext), [ext]);
  const playbackBlocked = useMemo(() => isInBrowserPlaybackUnsupported(ext), [ext]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const readDuration = () => {
      const d = a.duration;
      setDuration(Number.isFinite(d) && d > 0 ? d : null);
    };
    const onLoadedMetadata = () => readDuration();
    const onDurationChange = () => readDuration();
    const onTimeUpdate = () => setCurrentTime(a.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    a.addEventListener("loadedmetadata", onLoadedMetadata);
    a.addEventListener("durationchange", onDurationChange);
    a.addEventListener("timeupdate", onTimeUpdate);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("loadedmetadata", onLoadedMetadata);
      a.removeEventListener("durationchange", onDurationChange);
      a.removeEventListener("timeupdate", onTimeUpdate);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const progressPct = useMemo(() => {
    if (!duration) return 0;
    return clamp01(currentTime / duration) * 100;
  }, [currentTime, duration]);

  const togglePlay = async (e) => {
    e?.stopPropagation?.();
    const a = audioRef.current;
    if (!a) return;
    if (!src || playbackBlocked) return;
    if (audioErrorMessage) return;
    try {
      if (a.paused) await a.play();
      else a.pause();
    } catch (err) {
      console.error("Audio play error:", err);
    }
  };

  const seekFromClick = (e) => {
    e?.stopPropagation?.();
    const a = audioRef.current;
    if (!a || !duration || !src || playbackBlocked || audioErrorMessage) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = clamp01((e.clientX - rect.left) / rect.width);
    a.currentTime = ratio * duration;
  };

  const handleAudioError = (e) => {
    const error = e?.currentTarget?.error;
    let msg = "";
    if (error) {
      switch (error.code) {
        case 1:
          msg = "Audio loading was aborted";
          break;
        case 2:
          msg = "Network error while loading audio";
          break;
        case 3:
          msg = "Audio decoding error - file may be corrupted";
          break;
        case 4:
          msg = "Audio format not supported by browser";
          break;
        default:
          msg = `Audio error (code: ${error.code})`;
      }
    } else {
      msg = "Audio failed to load";
    }

    setAudioErrorMessage(msg);
    if (typeof onError === "function") onError(e);
  };

  const handleDetails = async (e) => {
    e?.stopPropagation?.();
    if (typeof onDetailsClick === "function") {
      onDetailsClick(recording);
      return;
    }
    if (recording) await openRecordingPreview(recording);
  };

  const isPlayDisabled = !src || playbackBlocked || Boolean(audioErrorMessage);
  const hasKnownDuration = Number.isFinite(duration) && duration > 0;

  return (
    <>
      <div
        className="rec-pill"
        aria-label={label ? `Recording audio: ${label}` : "Recording audio"}
      >
        <button
          type="button"
          className="rec-pill__playBtn"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
          disabled={isPlayDisabled}
          style={{
            opacity: isPlayDisabled ? 0.5 : 1,
            cursor: isPlayDisabled ? "not-allowed" : "pointer",
          }}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="rec-pill__scrubCol">
          <div
            className="rec-pill__scrubTrack"
            onClick={seekFromClick}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration ?? 0}
            aria-valuenow={currentTime}
            aria-label="Seek"
          >
            <div
              className="rec-pill__scrubFill"
              style={{ width: `${progressPct.toFixed(1)}%` }}
            />
          </div>
          <div className="rec-pill__scrubRow">
            <span className="rec-pill__time rec-pill__time--start">
              {formatTime(currentTime)}
            </span>
            <span className="rec-pill__label">{label}</span>
            {hasKnownDuration ? (
              <span className="rec-pill__time rec-pill__time--end">
                {formatTime(duration)}
              </span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="rec-pill__detailsBtn"
          onClick={handleDetails}
          aria-label="Recording file details"
          title="Recording file details"
          disabled={!recording}
        >
          <img
            className="rec-pill__fileIcon"
            src={RECORDING_FILE_ICON_SRC}
            alt=""
            width={20}
            height={20}
            draggable={false}
          />
        </button>

        {/* Hidden native audio element for actual playback */}
        <audio ref={audioRef} preload="metadata" onError={handleAudioError}>
          {src ? <source src={src} type={audioType} /> : null}
          Your browser does not support the audio element.
        </audio>
      </div>

      {(playbackBlocked || audioErrorMessage) && (
        <div className="rec-pill__notice">
          {playbackBlocked ? (
            <>
              This device’s browser cannot play this format (WebM/Opus or Ogg)
              inline. Open{" "}
              <strong>recording details</strong> (file icon) to download, or
              use a desktop browser.
            </>
          ) : (
            <>
              {audioErrorMessage}.{" "}
              <span className="rec-pill__noticeMuted">
                Open recording details (file icon) to download, or try another
                browser or device.
              </span>
            </>
          )}
        </div>
      )}

      <RecordingPreviewOverlay
        selectedRecording={selectedRecording}
        recordingData={recordingData}
        loadingRecording={loadingRecording}
        deletingRecording={false}
        onClose={closePreview}
        title="Recording file details"
        showActions={true}
        showEncounterActions={showEncounterActions}
      />
    </>
  );
}

