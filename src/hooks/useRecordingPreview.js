import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";

export default function useRecordingPreview() {
  const navigate = useNavigate();

  const [selectedRecording, setSelectedRecording] = useState(null);
  const [recordingData, setRecordingData] = useState(null);
  const [loadingRecording, setLoadingRecording] = useState(false);

  const openRecordingPreview = useCallback(
    async (recording) => {
      if (!recording) return;

      setSelectedRecording(recording);
      setLoadingRecording(true);
      setRecordingData(null);

      const jwt = api.getJWT();
      if (!jwt) {
        navigate("/login");
        return;
      }

      try {
        // If caller already has a signed url, don't refetch.
        if (recording.recording_file_signed_url) {
          setRecordingData(recording);
          return;
        }

        if (recording.id) {
          // Attached recording - fetch from API with signed URL generation
          const result = await api.getRecordingById(recording.id);
          if (!result.success) {
            if (result.status === 401) navigate("/login");
            else console.error("Failed to fetch recording data:", result.error);
            return;
          }
          setRecordingData(result.data);
          return;
        }

        // Unattached recording - create signed URL directly
        const result = await api.fetchWithRefreshRetry(
          "/api/recordings/create-signed-url",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: recording.path }),
          },
        );

        if (!result.success) {
          console.error("Failed to get signed URL:", result.error);
          return;
        }

        const response = result.response;
        if (!response.ok) {
          console.error("Failed to get signed URL:", response.statusText);
          return;
        }

        const signedUrlData = await response.json();
        setRecordingData({
          ...recording,
          recording_file_signed_url: signedUrlData.signedUrl,
          id: null, // Mark as unattached
        });
      } catch (error) {
        console.error("Error fetching recording preview data:", error);
      } finally {
        setLoadingRecording(false);
      }
    },
    [navigate],
  );

  const closePreview = useCallback(() => {
    setSelectedRecording(null);
    setRecordingData(null);
    setLoadingRecording(false);
  }, []);

  return {
    selectedRecording,
    recordingData,
    loadingRecording,
    openRecordingPreview,
    closePreview,
  };
}

