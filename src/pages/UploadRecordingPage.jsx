import React, { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Auth from "@/components/Auth.jsx";
import RecordingFileUploadPicker from "@/components/RecordingFileUploadPicker.jsx";
import PendingRecordingGuardModal from "@/components/PendingRecordingGuardModal.jsx";
import {
  discardPendingRecording,
  formatPendingRecordingLabel,
  getPendingRecordingContext,
  hasPendingRecording,
} from "@/utils/pendingRecordingGuard.js";

export default function UploadRecordingPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [guardModalOpen, setGuardModalOpen] = useState(false);
  const [pendingGuardLabel, setPendingGuardLabel] = useState("");

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openPendingGuardModal = useCallback(async () => {
    const ctx = await getPendingRecordingContext();
    setPendingGuardLabel(
      formatPendingRecordingLabel(ctx.record, ctx.metadata),
    );
    setGuardModalOpen(true);
  }, []);

  const handleFileInputChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (await hasPendingRecording()) {
      await openPendingGuardModal();
      resetFileInput();
      return;
    }

    const uploadHandoffId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    navigate("/generate-note", {
      state: { fileToUpload: file, uploadHandoffId },
    });
  };

  return (
    <>
      <Auth />
      <PendingRecordingGuardModal
        open={guardModalOpen}
        label={pendingGuardLabel}
        onCancel={() => {
          setGuardModalOpen(false);
          resetFileInput();
        }}
        onGoToGenerateNote={() => {
          setGuardModalOpen(false);
          navigate("/generate-note");
        }}
        onDiscard={async () => {
          if (
            !window.confirm(
              "Discard this recording? It cannot be recovered.",
            )
          ) {
            return;
          }
          const ctx = await getPendingRecordingContext();
          await discardPendingRecording(
            ctx.record?.id || ctx.metadata?.idbId,
          );
          setGuardModalOpen(false);
          resetFileInput();
        }}
      />
      <div className="max-w-lg mx-auto p-6">
        <h1 className="text-3xl font-bold mb-2">Upload Recording</h1>
        <p className="text-gray-600 mb-8">
          Upload a recording file and use it to generate a note.
        </p>

        <RecordingFileUploadPicker
          inputRef={fileInputRef}
          onChange={handleFileInputChange}
          inputId="upload-recording-file"
        />

        <p className="mt-8 text-center text-sm text-gray-500">
          <Link
            to="/generate-note"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Back to Generate Note
          </Link>
        </p>
      </div>
    </>
  );
}
