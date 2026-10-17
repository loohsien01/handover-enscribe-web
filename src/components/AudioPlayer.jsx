import React, { useState } from "react";
import { saveAs } from "file-saver";

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
      typeof window !== "undefined" ? window.location.href : undefined
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

/** iOS Safari and Chrome (WebKit) often cannot play WebM/Opus or Ogg in &lt;audio&gt;. */
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

async function downloadRecording(src, filename) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  saveAs(blob, filename);
}

export default function AudioPlayer({
  src,
  onError,
  filename = "recording.webm",
  maxWidth = "100%",
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const ext = getExtension(src, filename);
  const audioType = getAudioType(ext);
  const playbackBlocked = isInBrowserPlaybackUnsupported(ext);

  const containerStyle = {
    padding: "4px",
    width: "100%",
    maxWidth: maxWidth,
    backgroundColor: "#f3f4f6",
    borderRadius: "12px",
  };

  const rowStyle = {
    display: "flex",
    gap: "0px",
    alignItems: "center",
    width: "100%",
  };

  const downloadButton = (
    <button
      type="button"
      disabled={isDownloading}
      onClick={async () => {
        if (isDownloading) return;
        try {
          setIsDownloading(true);
          await downloadRecording(src, filename);
        } catch (error) {
          console.error("Error downloading recording:", error);
          alert("Failed to download recording. Please try again.");
        } finally {
          setIsDownloading(false);
        }
      }}
      style={{
        width: "40px",
        height: "40px",
        minWidth: "40px",
        minHeight: "40px",
        padding: "3px",
        backgroundColor: "#f3f4f6",
        border: "1px solid #d1d5db",
        borderRadius: "50%",
        cursor: isDownloading ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: isDownloading ? 0.7 : 1,
        transition: "background-color 0.2s",
      }}
      onMouseOver={(e) => {
        if (!isDownloading) e.currentTarget.style.backgroundColor = "#e5e7eb";
      }}
      onMouseOut={(e) => {
        if (!isDownloading) e.currentTarget.style.backgroundColor = "#f3f4f6";
      }}
      title="Download recording"
    >
      {isDownloading ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Downloading"
          role="img"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="#6b7280"
            strokeWidth="3"
            opacity="0.25"
          />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="#6b7280"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 12 12"
              to="360 12 12"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      ) : (
        <img
          src="/download-icon.svg"
          alt="Download"
          style={{ width: "18px", height: "18px" }}
        />
      )}
    </button>
  );

  if (playbackBlocked) {
    return (
      <div style={containerStyle}>
        <p
          style={{
            margin: "0 0 8px 0",
            fontSize: "0.875rem",
            color: "#374151",
            lineHeight: 1.45,
          }}
        >
          
          iPhone and iPad browsers do not support playback for this audio file format (WebM/Opus). 
          <strong>Download</strong> and open it locally, or use a desktop browser.
        </p>
        <div style={{ ...rowStyle, justifyContent: "flex-start", gap: "12px" }}>
          {downloadButton}
          <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
            {filename}
          </span>
        </div>
        <div style={{ width: "10px" }} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={rowStyle}>
        <div className="enscribe-audio-player" style={{ flex: 1, minWidth: 0 }}>
          <audio
            controls
            controlsList="nodownload noplaybackrate novolume"
            style={{ width: "100%" }}
            preload="metadata"
            onError={onError}
          >
            <source src={src} type={audioType} />
            Your browser does not support the audio element.
          </audio>
        </div>

        {downloadButton}

        <div style={{ width: "10px" }} />
      </div>
    </div>
  );
}
