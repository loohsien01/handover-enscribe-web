/**
 * Normalize GET /api/pre-visit-summaries JSON into a flat array of summary rows.
 * Handles: array, { pre_visit_summaries: [...] }, id-keyed map, or a single row object.
 */
export function normalizeVisitPrepsListResponse(data) {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && Array.isArray(data.pre_visit_summaries)) {
    return data.pre_visit_summaries;
  }
  if (typeof data === 'object' && data.id != null) {
    const values = Object.values(data);
    const eachValueIsRow =
      values.length > 0 &&
      values.every((v) => v && typeof v === 'object' && v.id != null && v !== data);
    if (eachValueIsRow) return values;
    return [data];
  }
  if (typeof data === 'object') return Object.values(data);
  return [];
}

/**
 * @param {Record<string, unknown>} row
 * @returns {string | null}
 */
export function visitPrepChatId(row) {
  const id = row.chat_id ?? row.chatId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/** Pre-visit summaries without a Nova chat cannot be opened in the sidebar. */
export function visitPrepsWithChatId(rows) {
  return rows.filter((row) => visitPrepChatId(row) != null);
}

/**
 * @param {Record<string, unknown>} row
 * @returns {string | number | null}
 */
export function visitPrepPatientEncounterId(row) {
  const id = row.patientEncounter_id ?? row.patientEncounterId;
  if (id === null || id === undefined || id === '') return null;
  return /** @type {string | number} */ (id);
}

/** True when this pre-visit summary was consumed by a generate-and-save-note encounter. */
export function visitPrepIsLinkedToEncounter(row) {
  return visitPrepPatientEncounterId(row) != null;
}

/**
 * Stable partition: rows available for attach first, patient-visit-linked rows last.
 * Preserves input order within each group (O(n), no sort).
 *
 * @template {{ alreadyUsedForVisit?: boolean }} T
 * @param {T[]} rows
 */
export function partitionVisitPrepRowsByPatientVisitAttachment(rows) {
  const available = [];
  const attachedToPatientVisit = [];
  for (const row of rows) {
    if (row.alreadyUsedForVisit) attachedToPatientVisit.push(row);
    else available.push(row);
  }
  return {
    available,
    attachedToPatientVisit,
  };
}

/** Client-side sort when API order is unavailable or after filtering. */
export function sortVisitPrepsByUpdatedDesc(rows) {
  return [...rows].sort((a, b) => {
    const ta = new Date(String(a.updated_at ?? a.created_at ?? 0)).getTime();
    const tb = new Date(String(b.updated_at ?? b.created_at ?? 0)).getTime();
    return tb - ta;
  });
}
