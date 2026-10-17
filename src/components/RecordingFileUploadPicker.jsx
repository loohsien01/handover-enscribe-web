import React from "react";

/**
 * Dashed drop-zone file picker for audio/video recordings.
 */
export default function RecordingFileUploadPicker({
  inputRef,
  onChange,
  disabled = false,
  inputId = "recording-file-upload",
}) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/mp4,.mp4,.m4a"
        onChange={onChange}
        className="hidden"
        id={inputId}
        disabled={disabled}
      />
      <label
        htmlFor={inputId}
        className={`cursor-pointer text-blue-600 hover:text-blue-800 ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <div className="text-4xl mb-2" aria-hidden>
          📁
        </div>
        <div>Click to upload audio file</div>
        <div className="text-sm text-gray-500 mt-2">
          Max 100MB
          <br />
          Supports MP3, WAV, WebM, OGG, MP4, M4A
        </div>
      </label>
    </div>
  );
}
