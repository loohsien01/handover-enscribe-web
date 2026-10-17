import React, { useMemo, useRef, useState } from "react";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const precision = idx === 0 ? 0 : idx === 1 ? 0 : 1;
  return `${value.toFixed(precision)}${units[idx]}`;
}

function isPdfFile(file) {
  if (!file) return false;
  const nameOk = (file.name || "").toLowerCase().endsWith(".pdf");
  const typeOk = file.type === "application/pdf";
  return typeOk || nameOk;
}

export default function LlmExtractNoteTemplateOverlay({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  title = "LLM Extract Note Template",
  /** Set by parent when the extract API fails (shown in the bar above the footer). */
  serverError = "",
  onDismissServerError,
}) {
  const fileInputRef = useRef(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [error, setError] = useState("");

  const isTooLarge = useMemo(
    () => !!pdfFile && pdfFile.size > MAX_PDF_BYTES,
    [pdfFile]
  );
  const isInvalidType = useMemo(
    () => !!pdfFile && !isPdfFile(pdfFile),
    [pdfFile]
  );

  const fileOk = useMemo(
    () => !!pdfFile && !isTooLarge && !isInvalidType,
    [pdfFile, isTooLarge, isInvalidType]
  );

  const reset = () => {
    setPdfFile(null);
    setError("");
    onDismissServerError?.();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose?.();
  };

  const handleFileChange = (e) => {
    setError("");
    onDismissServerError?.();
    const file = e.target.files?.[0] || null;
    if (!file) {
      setPdfFile(null);
      return;
    }

    if (!isPdfFile(file)) {
      setPdfFile(file);
      setError("Please upload a PDF file.");
      return;
    }

    if (file.size > MAX_PDF_BYTES) {
      setPdfFile(file);
      setError("PDF must be smaller than 20MB.");
      return;
    }

    setPdfFile(file);

    void (async () => {
      try {
        await onConfirm?.(file);
      } catch (e) {
        console.error(e);
      }
    })();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay background, clickable to close */}
      <div
        className="absolute inset-0 bg-black opacity-50"
        style={{ cursor: isSubmitting ? "default" : "pointer" }}
        onClick={handleClose}
      />

      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-[28rem] max-h-[85vh] flex flex-col mx-4"
        style={{ marginTop: "5rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-2 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate min-w-0">{title}</h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content — no flex-1 so the dialog height follows content (no empty gap above footer) */}
        <div className="overflow-y-auto p-9 min-h-0">
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              Upload a note to extract a template structure from it.
            </div>

            {/* Upload section (copied pattern from recordings uploader) */}
            <div className="space-y-2">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-file-upload"
                  disabled={isSubmitting}
                />
                <label
                  htmlFor="pdf-file-upload"
                  className={`cursor-pointer text-blue-600 hover:text-blue-800 ${
                    isSubmitting ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <div className="text-4xl mb-2">📁</div>
                  <div>Click to upload PDF</div>
                  <div className="text-sm text-gray-500 mt-2">
                    Max 20MB
                    <br />
                    PDF only
                  </div>
                </label>
              </div>

              {pdfFile && (
                <div
                  className={`p-3 rounded-lg border ${
                    fileOk
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-medium break-words ${
                          fileOk ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {pdfFile.name}
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          fileOk ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formatBytes(pdfFile.size)}
                        {isTooLarge ? " (too large)" : ""}
                        {isInvalidType ? " (not a PDF)" : ""}
                      </div>
                      {fileOk && isSubmitting && (
                        <div className="text-xs text-green-700 mt-2">
                          Generating…
                        </div>
                      )}
                      {error && (
                        <div className="text-xs text-red-700 mt-2">{error}</div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={reset}
                      disabled={isSubmitting}
                      className="flex-shrink-0 p-1 rounded-md text-red-600 hover:text-red-800 hover:bg-red-100 disabled:opacity-40 disabled:hover:bg-transparent"
                      aria-label="Remove file"
                      title="Remove file"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Server / API error — full-width bar above footer */}
        {serverError ? (
          <div
            role="alert"
            className="px-4 py-2.5 bg-red-50 border-t border-red-200 text-red-800 text-sm flex items-start gap-2 shrink-0"
          >
            <span className="flex-1 min-w-0 break-words">{serverError}</span>
            <button
              type="button"
              onClick={() => onDismissServerError?.()}
              disabled={isSubmitting}
              className="flex-shrink-0 p-0.5 rounded text-red-600 hover:text-red-800 hover:bg-red-100 disabled:opacity-40"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        ) : null}

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 flex justify-end gap-2 shrink-0">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

