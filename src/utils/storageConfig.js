/**
 * Centralized browser storage configuration for Enscribe
 * localStorage + sessionStorage keys use: enscribe_<camelCaseKeyName>
 */

import { clearAllPendingRecordings } from '@/utils/pendingRecordingsDb.js';

export const STORAGE_PREFIX = 'enscribe_';

/** sessionStorage — tab-scoped cache (cleared with clearAppStorage) */
export const SESSION_KEYS = {
  recentNotesPreview: `${STORAGE_PREFIX}recentNotesPreview_v1`,
  /** Decrypted patient encounter display names by id (string keys) */
  encounterNames: `${STORAGE_PREFIX}encounterNames_v1`,
  /** Nova chat session sidebar titles by chat id (string keys) */
  novaChatTitles: `${STORAGE_PREFIX}novaChatTitles_v1`,
  /** One-shot Nova message from /new-pre-visit-summary setup → /pre-visit-summary/nova-chat */
  novaVisitPrepPendingMessage: `${STORAGE_PREFIX}novaVisitPrepPendingMessage_v1`,
  /** Prefill email on /reset-password after /forgot-password */
  resetPasswordEmail: `${STORAGE_PREFIX}resetPasswordEmail`,
  /** Prefill email on /confirm-email after /signup */
  confirmEmail: `${STORAGE_PREFIX}confirmEmail`,
};

/** Legacy colon-style key (pre–storageConfig); migrate on read, remove on clear */
export const SESSION_KEYS_LEGACY = {
  recentNotesPreview: 'enscribe:recentNotesPreview_v1',
}

export const STORAGE_KEYS = {
  // Auth & User (shared across app, originated from SignIn page)
  auth: {
    jwt: `${STORAGE_PREFIX}jwt`,
    userEmail: `${STORAGE_PREFIX}userEmail`,
    currentUserId: `${STORAGE_PREFIX}currentUserId`,
  },

  // New Patient Encounter (form data - page-specific)
  // Contains actual patient encounter form fields and recording metadata
  newPatientEncounter: {
    patientEncounterName: `${STORAGE_PREFIX}patientEncounterName`,
    note: `${STORAGE_PREFIX}note`,
    /**
     * Recording pointer + upload state (JSON). Audio bytes live in IndexedDB until uploaded.
     * status: "local" | "uploading" | "failed" | "uploaded" (omit idbId when uploaded)
     * See docs/LOCAL_RECORDING_UPLOAD.md
     */
    recordingFileMetadata: `${STORAGE_PREFIX}recordingFileMetadata`,
    recordingFile: `${STORAGE_PREFIX}recordingFile`,
    /** Lightweight pre-visit summary attach ref ({ id, title }) for generate-note */
    attachedPreVisitSummary: `${STORAGE_PREFIX}attachedPreVisitSummary`,
  },

  // UI State (page-specific)
  // Contains user preferences and UI choices (e.g., last selected tab, last selected option)
  ui: {
    lastUsedRecordingsTab: `${STORAGE_PREFIX}lastUsedRecordingsTab`,
    lastUsedNoteTemplateId: `${STORAGE_PREFIX}lastUsedNoteTemplateId`,
    /** Last selected Nova chat model preset (`haiku` | `sonnet` | `opus`) */
    novaLastModelPreset: `${STORAGE_PREFIX}novaLastModelPreset_v1`,
    /** User dismissed chat vs prep zone hint on visit prep nova-chat page */
    dismissedVisitPrepZoneHint: `${STORAGE_PREFIX}dismissedVisitPrepZoneHint_v1`,
    /** Pre-visit summary home explainer collapsed (`1`) vs expanded (`0`) */
    visitPrepHomeExplainerCollapsed: `${STORAGE_PREFIX}visitPrepHomeExplainerCollapsed_v1`,
  },

  /** Nova AI — client-only thread index (no list API yet; cleared on logout via getAppStorageKeys) */
  novaChat: {
    threadIndex: `${STORAGE_PREFIX}novaChatThreads_v1`,
  },

  // Confirm Email (page-specific)
  confirmEmail: {
    resendConfirmationCooldownTs: `${STORAGE_PREFIX}resendConfirmationCooldownTs`,
  },

  // Reset password (page-specific)
  resetPassword: {
    resendCodeCooldownTs: `${STORAGE_PREFIX}resetPasswordResendCodeCooldownTs`,
  },

  // Job tracking (for async job operations)
  jobs: {
    promptLlmJobId: `${STORAGE_PREFIX}promptLlmJobId`,
    promptLlmJobStatus: `${STORAGE_PREFIX}promptLlmJobStatus`,
  },
};

/**
 * Get all app-specific localStorage keys (enscribe_* prefix)
 * Used for clearing user data on logout or user switch
 */
export const getAppStorageKeys = () => {
  const keys = [];
  Object.values(STORAGE_KEYS).forEach(scope => {
    if (typeof scope === 'object') {
      keys.push(...Object.values(scope));
    }
  });
  return keys;
};

/**
 * Get all app-specific sessionStorage keys
 */
export const getSessionAppStorageKeys = () => {
  return Object.values(SESSION_KEYS);
};

/**
 * Clear all app-specific localStorage data
 * Also clears SESSION_KEYS in sessionStorage (tab cache, e.g. recent note previews).
 * Preserves jwt for the case of logout (backend will invalidate it)
 */
export const clearAppStorage = (preserveKeys = []) => {
  const keysToDelete = getAppStorageKeys().filter(key => !preserveKeys.includes(key));
  keysToDelete.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to clear localStorage key ${key}:`, e);
    }
  });
  getSessionAppStorageKeys().forEach((key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn(`Failed to clear sessionStorage key ${key}:`, e);
    }
  });
  try {
    sessionStorage.removeItem(SESSION_KEYS_LEGACY.recentNotesPreview);
  } catch (e) {
    console.warn('Failed to clear legacy sessionStorage recent notes key:', e);
  }
  void clearAllPendingRecordings().catch((e) => {
    console.warn('Failed to clear pending recordings IndexedDB:', e);
  });
};

/**
 * Check if current user matches stored user
 * Returns true if user changed (should clear storage)
 */
export const hasUserChanged = (currentUserId) => {
  try {
    const storedUserId = localStorage.getItem(STORAGE_KEYS.auth.currentUserId);
    return !!(storedUserId && storedUserId !== currentUserId);
  } catch (e) {
    return false;
  }
};

/**
 * Set current user ID in storage
 */
export const setCurrentUserId = (userId) => {
  try {
    localStorage.setItem(STORAGE_KEYS.auth.currentUserId, userId);
  } catch (e) {
    console.warn('Failed to set current user ID:', e);
  }
};

/**
 * Safely parse localStorage JSON values with fallback
 * Handles both stringified and legacy plain-text data
 * @param {string} key - The localStorage key
 * @returns {string} - Parsed value or empty string
 */
export const parseStorageValue = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : "";
  } catch (e) {
    console.warn(`Failed to parse ${key}:`, e);
    // Fallback to raw value if parse fails (for legacy data)
    return localStorage.getItem(key) || "";
  }
};

/**
 * Get the last used note template ID
 * @returns {string|null} - The template ID or null if not found
 */
export const getLastUsedNoteTemplateId = () => {
  try {
    const id = localStorage.getItem(STORAGE_KEYS.ui.lastUsedNoteTemplateId);
    return id || null;
  } catch (e) {
    console.warn('Failed to get last used note template ID:', e);
    return null;
  }
};

/**
 * Set the last used note template ID
 * @param {string} templateId - The template ID to store
 */
export const setLastUsedNoteTemplateId = (templateId) => {
  try {
    if (templateId) {
      localStorage.setItem(STORAGE_KEYS.ui.lastUsedNoteTemplateId, templateId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ui.lastUsedNoteTemplateId);
    }
  } catch (e) {
    console.warn('Failed to set last used note template ID:', e);
  }
};

/**
 * Get the last used recordings tab
 * @returns {string} - 'attached' or 'unattached'
 */
export const getLastUsedRecordingsTab = () => {
  try {
    const tab = localStorage.getItem(STORAGE_KEYS.ui.lastUsedRecordingsTab);
    return (tab === 'attached' || tab === 'unattached') ? tab : 'attached';
  } catch (e) {
    console.warn('Failed to get last used recordings tab:', e);
    return 'attached';
  }
};

/**
 * Set the last used recordings tab
 * @param {string} tab - 'attached' or 'unattached'
 */
export const setLastUsedRecordingsTab = (tab) => {
  try {
    if (tab === 'attached' || tab === 'unattached') {
      localStorage.setItem(STORAGE_KEYS.ui.lastUsedRecordingsTab, tab);
    }
  } catch (e) {
    console.warn('Failed to set last used recordings tab:', e);
  }
};
