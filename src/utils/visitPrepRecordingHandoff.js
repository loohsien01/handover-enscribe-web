import { STORAGE_KEYS } from '@/utils/storageConfig.js';

/** Router state key for one-time nova-chat → active-recording handoff. */
export const ATTACHED_PRE_VISIT_SUMMARY_STATE_KEY = 'attachedPreVisitSummary';

/** Legacy recording handoff — id only (title may live on patientEncounterName). */
export const PRE_VISIT_SUMMARY_ID_STATE_KEY = 'preVisitSummaryId';

export const ENCOUNTER_NAME_MAX_CHARS = 120;

/**
 * Lightweight attachment ref — id (+ optional title for encounter name).
 * Full summary text is fetched on demand when the attach overlay opens.
 *
 * @typedef {{
 *   id: string;
 *   title: string;
 * }} AttachedPreVisitSummaryRef
 */

/** @param {unknown} raw */
export function normalizeAttachedPreVisitSummaryRef(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const row = /** @type {Record<string, unknown>} */ (raw);
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  if (!id) return null;
  return {
    id,
    title: title || 'Pre-visit summary',
  };
}

/**
 * @param {unknown} locationState — `useLocation().state`
 * @returns {AttachedPreVisitSummaryRef | null}
 */
export function readAttachedPreVisitSummaryFromLocationState(locationState) {
  if (!locationState || typeof locationState !== 'object') return null;
  const state = /** @type {Record<string, unknown>} */ (locationState);
  return normalizeAttachedPreVisitSummaryRef(
    state[ATTACHED_PRE_VISIT_SUMMARY_STATE_KEY],
  );
}

/**
 * @param {{ id: string; title?: string }} payload
 */
export function buildActiveRecordingNavState(payload) {
  const handoff = normalizeAttachedPreVisitSummaryRef(payload);
  if (!handoff) return {};
  return { [ATTACHED_PRE_VISIT_SUMMARY_STATE_KEY]: handoff };
}

/** @param {{ title?: string } | null | undefined} handoff */
export function encounterNameFromPreVisitSummaryHandoff(handoff) {
  const trimmed = typeof handoff?.title === 'string' ? handoff.title.trim() : '';
  if (!trimmed) return null;
  return trimmed.slice(0, ENCOUNTER_NAME_MAX_CHARS);
}

/**
 * @param {unknown} locationState — `useLocation().state`
 * @returns {AttachedPreVisitSummaryRef | null}
 */
export function readAttachedPreVisitSummaryFromHandoffState(locationState) {
  const fromRef = readAttachedPreVisitSummaryFromLocationState(locationState);
  if (fromRef) return fromRef;

  if (!locationState || typeof locationState !== 'object') return null;
  const state = /** @type {Record<string, unknown>} */ (locationState);
  const id =
    typeof state[PRE_VISIT_SUMMARY_ID_STATE_KEY] === 'string'
      ? state[PRE_VISIT_SUMMARY_ID_STATE_KEY].trim()
      : '';
  if (!id) return null;

  const encounterName =
    typeof state.patientEncounterName === 'string'
      ? state.patientEncounterName.trim()
      : '';
  return normalizeAttachedPreVisitSummaryRef({
    id,
    title: encounterName || undefined,
  });
}

/**
 * @param {unknown} metadata — recordingFileMetadata object
 * @returns {AttachedPreVisitSummaryRef | null}
 */
export function readAttachedPreVisitSummaryFromRecordingMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const row = /** @type {Record<string, unknown>} */ (metadata);
  const id =
    typeof row.preVisitSummaryId === 'string' ? row.preVisitSummaryId.trim() : '';
  if (!id) return null;
  const title =
    typeof row.preVisitSummaryTitle === 'string'
      ? row.preVisitSummaryTitle.trim()
      : '';
  return normalizeAttachedPreVisitSummaryRef({ id, title: title || undefined });
}

/**
 * Merge pre-visit summary ref fields into recording metadata (mutates copy).
 *
 * @param {Record<string, unknown> | null | undefined} metadata
 * @param {AttachedPreVisitSummaryRef | null | undefined} ref
 */
export function withPreVisitSummaryOnRecordingMetadata(metadata, ref) {
  const next = { ...(metadata || {}) };
  if (ref?.id) {
    next.preVisitSummaryId = ref.id;
    next.preVisitSummaryTitle = ref.title;
  } else {
    delete next.preVisitSummaryId;
    delete next.preVisitSummaryTitle;
  }
  return next;
}

/** @returns {AttachedPreVisitSummaryRef | null} */
export function readStoredAttachedPreVisitSummary() {
  try {
    const raw = localStorage.getItem(
      STORAGE_KEYS.newPatientEncounter.attachedPreVisitSummary,
    );
    if (!raw) return null;
    return normalizeAttachedPreVisitSummaryRef(JSON.parse(raw));
  } catch (e) {
    console.warn('[visitPrepRecordingHandoff] attached pre-visit summary parse failed:', e);
    return null;
  }
}

/** @param {AttachedPreVisitSummaryRef | null | undefined} ref */
export function persistAttachedPreVisitSummaryRef(ref) {
  try {
    const key = STORAGE_KEYS.newPatientEncounter.attachedPreVisitSummary;
    if (ref?.id) {
      localStorage.setItem(key, JSON.stringify(ref));
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('[visitPrepRecordingHandoff] attached pre-visit summary persist failed:', e);
  }
}
