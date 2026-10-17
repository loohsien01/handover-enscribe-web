import * as api from "@/lib/api";
import { STORAGE_KEYS } from "@/utils/storageConfig.js";
import {
  deletePending,
  getPending,
  getPendingById,
  pendingToFile,
  updatePending,
} from "@/utils/pendingRecordingsDb.js";

const DEFAULT_BACKOFF_MS = [0, 2000, 6000];

/** Auto-upload when navigating from Active Recording (stop handoff) */
export const PENDING_UPLOAD_HANDOFF_ATTEMPTS = 3;
/** Auto-upload once when Generate Note loads with a pending recording */
export const PENDING_UPLOAD_RESTORE_ATTEMPTS = 1;
/** Manual Retry button — tries per click */
export const PENDING_UPLOAD_MANUAL_RETRY_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {unknown} error
 */
export function isRetryableUploadError(error) {
  if (error && typeof error === "object" && error.requiresLogin) {
    return false;
  }
  const message = error?.message || String(error || "");
  if (message.includes("network error") || message.includes("status 0")) {
    return true;
  }
  const httpMatch = message.match(/HTTP (\d+)/i);
  if (httpMatch) {
    const code = Number(httpMatch[1]);
    if (code >= 500) return true;
    if (code >= 400 && code < 500) return false;
  }
  if (
    message.includes("exceeded the maximum allowed size") ||
    message.includes("File too large") ||
    message.includes("not authenticated") ||
    message.includes("Invalid session")
  ) {
    return false;
  }
  return true;
}

async function uploadWithReactiveAuth(fileName, file, onProgress) {
  const result = await api.fetchWithRefreshRetry(
    "/api/recordings/create-signed-upload-url",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: fileName }),
    },
  );

  if (!result.success) {
    if (result.status === 401) {
      throw Object.assign(
        new Error(result.error || "Not authenticated"),
        { requiresLogin: true },
      );
    }
    throw new Error(`Failed to get signed URL: ${result.error}`);
  }

  const signedUrlResponse = result.response;
  if (!signedUrlResponse.ok) {
    if (signedUrlResponse.status === 401) {
      throw Object.assign(new Error("Not authenticated"), { requiresLogin: true });
    }
    const errorData = await signedUrlResponse.json().catch(() => ({}));
    throw new Error(
      `Failed to get signed URL: ${errorData.message || signedUrlResponse.statusText}`,
    );
  }

  const { signedUrl, path } = await signedUrlResponse.json();
  await api.xhrUploadToSignedUrl(signedUrl, file, onProgress);
  return { path, id: path };
}

/**
 * @param {string} signedUrl
 * @param {number} [maxWaitMs]
 */
export async function pollForFileAccessibility(signedUrl, maxWaitMs = 5000) {
  return new Promise((resolve) => {
    let isResolved = false;
    const startTime = Date.now();
    const pollIntervalMs = 500;

    const initialDelay = setTimeout(() => {
      const poll = setInterval(() => {
        const elapsedMs = Date.now() - startTime;
        if (elapsedMs > maxWaitMs) {
          clearInterval(poll);
          if (!isResolved) {
            isResolved = true;
            resolve(false);
          }
          return;
        }

        fetch(signedUrl, { method: "HEAD", mode: "cors" })
          .then((response) => {
            if (response.ok && !isResolved) {
              isResolved = true;
              clearInterval(poll);
              resolve(true);
            }
          })
          .catch(() => {});
      }, pollIntervalMs);
    }, pollIntervalMs);

    setTimeout(() => {
      clearTimeout(initialDelay);
    }, maxWaitMs + pollIntervalMs);
  });
}

function writeRecordingMetadata(metadata) {
  localStorage.setItem(
    STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
    JSON.stringify(metadata),
  );
}

function readRecordingMetadata() {
  try {
    const raw = localStorage.getItem(
      STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
    );
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function patchRecordingMetadata(partial) {
  try {
    const current = readRecordingMetadata() || {};
    if (current.status === "uploaded" && partial.status && partial.status !== "uploaded") {
      return;
    }
    writeRecordingMetadata({ ...current, ...partial });
  } catch (e) {
    console.warn("[uploadPendingRecording] patch metadata failed:", e);
  }
}

const PENDING_RECORDING_STATUSES = new Set(["local", "uploading", "failed"]);

/**
 * @param {object | null | undefined} meta
 * @param {string} [idbId]
 */
export function isUploadedRecordingMetadata(meta, idbId) {
  if (meta?.status !== "uploaded" || !meta?.path) return false;
  if (!idbId || !meta.idbId) return true;
  return meta.idbId === idbId;
}

/**
 * @param {object} meta
 */
export function uploadedMetadataToResult(meta) {
  return {
    path: meta.path,
    signedUrl: meta.signedUrl ?? null,
    metadata: meta,
  };
}

/**
 * @param {object | null | undefined} meta
 * @param {import('./pendingRecordingsDb.js').PendingRecordingRecord | null} [record]
 */
export function getPendingUploadAttempts(meta, record) {
  if (typeof meta?.attempts === "number") return meta.attempts;
  if (typeof record?.attempts === "number") return record.attempts;
  return 0;
}

/**
 * Strip legacy combined messages so we only store/show the underlying error.
 * @param {string | null | undefined} lastError
 */
export function getRawUploadError(lastError) {
  if (!lastError) return "";
  const s = String(lastError).trim();
  const legacy = s.match(/^Attempt \d+(?:\/\d+)?:\s*(.*)$/s);
  if (legacy) return legacy[1].trim();
  const parenLegacy = s.match(/^(.*)\s+\(Attempt \d+\/\d+\)/s);
  if (parenLegacy) return parenLegacy[1].trim();
  return s;
}

/**
 * @param {object} options
 * @param {string} [options.lastError]
 * @param {number} [options.attempts]
 */
export function formatPendingUploadUserMessage({
  lastError,
  attempts = 0,
}) {
  const n = Math.max(1, attempts);
  const base = getRawUploadError(lastError) || "Upload failed";
  return `Attempt ${n}: ${base}`;
}

/**
 * @param {object | null | undefined} meta
 */
export async function resolvePendingIdbId(meta) {
  if (meta?.idbId) return meta.idbId;
  const record = await getPending();
  return record?.id ?? null;
}

/**
 * @param {object | null | undefined} meta
 * @param {import('./pendingRecordingsDb.js').PendingRecordingRecord | null} [record]
 */
export function shouldAutoRetryPendingOnPageLoad(meta, record) {
  if (isUploadedRecordingMetadata(meta)) return false;

  const idbId = meta?.idbId || record?.id;
  if (!idbId) return false;

  const status = meta?.status ?? record?.status;
  if (status === "uploaded") return false;

  if (PENDING_RECORDING_STATUSES.has(status)) {
    if (meta?.idbId && !record?.blob) return false;
    return true;
  }
  if (!status) return !!record?.blob;
  return false;
}

/**
 * @param {object | null | undefined} meta
 */
export function normalizePendingMetadataForRetry(meta) {
  if (!meta) return null;
  const next = { ...meta };
  if (next.status === "uploading" || next.status === "failed") {
    next.status = "local";
  }
  return next;
}

/**
 * Upload a pending IndexedDB recording with retries.
 *
 * @param {object} options
 * @param {string} options.idbId
 * @param {(percent: number) => void} [options.onProgress]
 * @param {number} [options.maxAttempts]
 * @param {number[]} [options.backoffMs]
 * @returns {Promise<{ path: string, signedUrl: string | null, metadata: object }>}
 */
export async function uploadRecordingFromPending({
  idbId,
  onProgress,
  maxAttempts = PENDING_UPLOAD_HANDOFF_ATTEMPTS,
  backoffMs = DEFAULT_BACKOFF_MS,
}) {
  const existingMeta = readRecordingMetadata();
  if (isUploadedRecordingMetadata(existingMeta, idbId)) {
    return uploadedMetadataToResult(existingMeta);
  }

  const record = await getPendingById(idbId);
  if (!record?.blob) {
    const metaAfter = readRecordingMetadata();
    if (isUploadedRecordingMetadata(metaAfter, idbId)) {
      return uploadedMetadataToResult(metaAfter);
    }

    const orphanMessage =
      "Local recording data was lost. Discard and record again, or upload a file.";
    if (PENDING_RECORDING_STATUSES.has(metaAfter?.status)) {
      patchRecordingMetadata({
        status: "failed",
        lastError: orphanMessage,
      });
    }
    throw new Error(orphanMessage);
  }

  const authUser = await api.resolveAuthenticatedAppUser({ refresh: true });
  if (!authUser.success) {
    throw Object.assign(
      new Error(authUser.error || "Not logged in"),
      { requiresLogin: authUser.requiresLogin === true },
    );
  }
  const { email } = authUser;

  const file = pendingToFile(record);
  const duration = record.durationSec ?? 0;
  const originalName = file.name || "recording.webm";
  const lastDot = originalName.lastIndexOf(".");
  const extension =
    lastDot !== -1 ? originalName.substring(lastDot + 1).toLowerCase() : "webm";
  const fileName = `${email}-${Date.now()}-${Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0")}.${extension || "webm"}`;

  const batchSize = Math.max(1, maxAttempts);
  let lastError = null;
  let attempts = record.attempts || 0;

  for (let attempt = 0; attempt < batchSize; attempt += 1) {
    const delay = backoffMs[attempt] ?? backoffMs[backoffMs.length - 1] ?? 0;
    if (delay > 0) {
      await sleep(delay);
    }

    attempts += 1;
    await updatePending(idbId, {
      status: "uploading",
      attempts,
      lastError: null,
    });
    patchRecordingMetadata({
      status: "uploading",
      idbId,
      attempts,
      progress: 0,
      name: "recording.webm",
      size: record.sizeBytes,
      duration,
      patientEncounterName: record.encounterName,
    });

    try {
      const onXhrProgress = onProgress
        ? (progress) => onProgress(progress.percent || 0)
        : undefined;

      const data = await uploadWithReactiveAuth(fileName, file, onXhrProgress);

      let signedUrl = null;
      try {
        const result = await api.fetchWithRefreshRetry(
          "/api/recordings/create-signed-url",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: data.path }),
          },
        );
        if (result.success && result.response.ok) {
          const signedUrlData = await result.response.json();
          signedUrl = signedUrlData.signedUrl;
          if (signedUrl) {
            await pollForFileAccessibility(signedUrl);
          }
        }
      } catch (e) {
        console.warn("[uploadPendingRecording] signed URL fetch failed:", e);
      }

      const metadata = {
        status: "uploaded",
        path: data.path,
        id: data.id,
        name: fileName,
        size: record.sizeBytes,
        duration,
        signedUrl,
      };

      writeRecordingMetadata(metadata);
      await updatePending(idbId, {
        status: "local",
        uploadedPath: data.path,
      });
      await deletePending(idbId);

      return { path: data.path, signedUrl, metadata };
    } catch (error) {
      if (error?.requiresLogin) {
        throw error;
      }
      lastError = getRawUploadError(error?.message || String(error));
      const retryable = isRetryableUploadError(error);
      const batchExhausted = attempt >= batchSize - 1;
      const headline = formatPendingUploadUserMessage({
        lastError,
        attempts,
      });

      if (!retryable) {
        await updatePending(idbId, {
          status: "failed",
          attempts,
          lastError,
        });
        patchRecordingMetadata({
          status: "failed",
          idbId,
          attempts,
          lastError,
          name: "recording.webm",
          size: record.sizeBytes,
          duration,
        });
        throw new Error(headline);
      }

      if (batchExhausted) {
        await updatePending(idbId, {
          status: "local",
          attempts,
          lastError,
        });
        const pausedMeta = {
          status: "local",
          idbId,
          attempts,
          lastError,
          name: "recording.webm",
          size: record.sizeBytes,
          duration,
          patientEncounterName: record.encounterName,
        };
        patchRecordingMetadata(pausedMeta);
        return { paused: true, metadata: pausedMeta };
      }
    }
  }

  const rawFinal = getRawUploadError(lastError || "Upload failed");
  const headline = formatPendingUploadUserMessage({
    lastError: rawFinal,
    attempts,
  });
  patchRecordingMetadata({
    status: "local",
    idbId,
    attempts,
    lastError: rawFinal,
  });
  throw new Error(headline);
}

/**
 * Normalize stale uploading metadata to local (crash mid-upload).
 */
export function normalizeStaleUploadingMetadata() {
  try {
    const raw = localStorage.getItem(
      STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
    );
    if (!raw) return null;
    const meta = JSON.parse(raw);
    if (meta.status === "uploading") {
      const next = { ...meta, status: "local" };
      writeRecordingMetadata(next);
      return next;
    }
    return meta;
  } catch {
    return null;
  }
}
