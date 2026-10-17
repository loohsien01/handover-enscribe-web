import React from "react";

/**
 * Modal when user tries to start a new recording while one is still on device.
 */
export default function PendingRecordingGuardModal({
  open,
  label,
  onGoToGenerateNote,
  onDiscard,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-recording-guard-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2
          id="pending-recording-guard-title"
          className="text-lg font-semibold text-gray-900"
        >
          Recording not uploaded
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          You have a recording saved locally on this device that has not been uploaded
          yet
          {label ? (
            <>
              : <strong className="font-semibold text-gray-900">{label}</strong>
            </>
          ) : null}
          . Starting a new recording will discard this local recording.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onGoToGenerateNote}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Generate Note
          </button>
        </div>
      </div>
    </div>
  );
}
