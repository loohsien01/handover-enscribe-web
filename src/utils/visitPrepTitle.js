import { NOVA_SESSION_TITLE_MAX_CHARS } from '@/constants/novaChat.js';

/** DB default for `pre_visit_summaries.title` (see PRE_VISIT_SUMMARY_ARCHITECTURE.md). */
export const VISIT_PREP_DEFAULT_TITLE = 'New Pre-Visit Summary';

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function resolveVisitPrepTitle(row) {
  const raw = row?.title;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return VISIT_PREP_DEFAULT_TITLE;
}

/**
 * Local date segment for visit prep sidebar titles (e.g. "Jun 24").
 * @param {Date} [date]
 */
export function formatVisitPrepTitleDate(date = new Date()) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Compose sidebar title from Haiku `pre_visit_summary_title_details` + local date.
 *
 * @param {{ patient_display_name?: unknown; visit_kind?: unknown }} details
 * @param {Date} [date]
 */
export function composeVisitPrepSessionTitle(details, date = new Date()) {
  const rawName =
    typeof details.patient_display_name === 'string' ? details.patient_display_name.trim() : '';
  const name = rawName || 'Unknown Patient';
  const kind = details.visit_kind === 'NP' ? 'NP' : 'F/U';
  const dateStr = formatVisitPrepTitleDate(date);
  let title = `${name} ${kind} ${dateStr}`;
  if (title.length > NOVA_SESSION_TITLE_MAX_CHARS) {
    title = title.slice(0, NOVA_SESSION_TITLE_MAX_CHARS);
  }
  return title;
}

/**
 * @param {unknown} raw
 * @returns {{ patient_display_name: string; visit_kind: string } | null}
 */
export function normalizeVisitPrepTitleDetails(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rec = /** @type {Record<string, unknown>} */ (raw);
  const patient_display_name =
    typeof rec.patient_display_name === 'string' ? rec.patient_display_name : 'Unknown Patient';
  const visit_kind = rec.visit_kind === 'NP' ? 'NP' : 'F/U';
  return { patient_display_name, visit_kind };
}
