/**
 * IndexedDB persistence for a single pending encounter recording (bytes on device).
 * DB: enscribe-pending-recordings / store: pending / key: id
 */

const DB_NAME = "enscribe-pending-recordings";
const DB_VERSION = 1;
const STORE_NAME = "pending";

let persistRequested = false;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

function requestPersistStorage() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Promise<import('./pendingRecordingsDb.js').PendingRecordingRecord | null>}
 */
export async function getPending() {
  const db = await openDb();
  try {
    const all = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (!all.length) return null;

    all.sort((a, b) => {
      const ta = Date.parse(a.capturedAt || 0);
      const tb = Date.parse(b.capturedAt || 0);
      return tb - ta;
    });

    const newest = all[0];
    if (all.length > 1) {
      const stale = all.slice(1);
      await Promise.all(stale.map((r) => deletePending(r.id)));
    }
    return newest;
  } finally {
    db.close();
  }
}

/**
 * @param {PendingRecordingRecord} record
 * @param {{ replace?: boolean }} [options]
 */
export async function savePending(record, options = {}) {
  const existing = await getPending();
  if (existing && existing.id !== record.id && !options.replace) {
    throw new Error(
      "A pending recording already exists. Discard it before saving another.",
    );
  }

  requestPersistStorage();

  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      if (existing && existing.id !== record.id) {
        store.delete(existing.id);
      }
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/**
 * @param {string} id
 * @param {Partial<PendingRecordingRecord>} partial
 */
export async function updatePending(id, partial) {
  const db = await openDb();
  try {
    const current = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (!current) {
      throw new Error(`Pending recording not found: ${id}`);
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).put({ ...current, ...partial });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/**
 * @param {string} id
 */
export async function getPendingById(id) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/**
 * @param {string} id
 */
export async function deletePending(id) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function clearAllPendingRecordings() {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/**
 * @param {{ blob: Blob; mimeType?: string }} record
 */
export function pendingToFile(record) {
  const type = record.mimeType || record.blob?.type || "audio/webm";
  return new File([record.blob], "recording.webm", { type });
}

/**
 * @param {File|Blob} file
 * @param {string} [filename]
 */
export function triggerRecordingDownload(file, filename = "recording.webm") {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * @typedef {Object} PendingRecordingRecord
 * @property {string} id
 * @property {Blob} blob
 * @property {string} mimeType
 * @property {number} sizeBytes
 * @property {number} durationSec
 * @property {string} encounterName
 * @property {string} capturedAt
 * @property {'local' | 'uploading' | 'failed'} status
 * @property {number} attempts
 * @property {string | null} lastError
 * @property {string | null} uploadedPath
 */
