import { STORAGE_KEYS } from "@/utils/storageConfig.js";
import {
  clearAllPendingRecordings,
  deletePending,
  getPending,
  getPendingById,
  pendingToFile,
  triggerRecordingDownload,
} from "@/utils/pendingRecordingsDb.js";
import {
  isUploadedRecordingMetadata,
  normalizeStaleUploadingMetadata,
} from "@/utils/uploadPendingRecording.js";

const PENDING_STATUSES = new Set(["local", "failed", "uploading"]);

/**
 * @returns {Promise<boolean>}
 */
export async function hasPendingRecording() {
  normalizeStaleUploadingMetadata();
  const record = await getPending();
  if (record?.blob && PENDING_STATUSES.has(record.status)) {
    return true;
  }
  try {
    const raw = localStorage.getItem(
      STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
    );
    if (!raw) return false;
    const meta = JSON.parse(raw);
    if (isUploadedRecordingMetadata(meta)) return false;
    if (!PENDING_STATUSES.has(meta.status)) return false;
    if (meta.idbId) {
      const byId = await getPendingById(meta.idbId);
      return !!(byId?.blob);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<{ record: import('./pendingRecordingsDb.js').PendingRecordingRecord | null, metadata: object | null }>}
 */
export async function getPendingRecordingContext() {
  normalizeStaleUploadingMetadata();
  const record = await getPending();
  let metadata = null;
  try {
    const raw = localStorage.getItem(
      STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
    );
    metadata = raw ? JSON.parse(raw) : null;
  } catch {
    metadata = null;
  }
  return { record, metadata };
}

/**
 * @param {import('./pendingRecordingsDb.js').PendingRecordingRecord | null} record
 * @param {object | null} metadata
 */
export function formatPendingRecordingLabel(record, metadata) {
  const name =
    record?.encounterName ||
    metadata?.patientEncounterName ||
    metadata?.name ||
    "";
  return String(name).trim() || "Unnamed encounter";
}

/**
 * @param {string} [idbId]
 */
export async function discardPendingRecording(idbId) {
  if (idbId) {
    await deletePending(idbId);
  } else {
    await clearAllPendingRecordings();
  }
  localStorage.removeItem(
    STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
  );
  localStorage.removeItem(STORAGE_KEYS.newPatientEncounter.recordingFile);
}

/**
 * @param {string} [idbId]
 */
export async function downloadPendingRecording(idbId) {
  const target = idbId ? await getPendingById(idbId) : await getPending();
  if (!target?.blob) {
    throw new Error(
      "Local recording data was lost. Discard and record again, or upload a file.",
    );
  }
  triggerRecordingDownload(pendingToFile(target));
}
