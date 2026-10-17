import { listVisitPreps } from '@/lib/visitPrepsApi.js';
import {
  normalizeVisitPrepsListResponse,
  sortVisitPrepsByUpdatedDesc,
  visitPrepPatientEncounterId,
  visitPrepsWithChatId,
} from '@/utils/visitPrepsListResponse.js';

/**
 * List pre-visit summaries for sidebar / home recent lists.
 * Titles come from `pre_visit_summaries.title` on each row (no Nova session fetch).
 *
 * @param {{
 *   limit?: number;
 *   offset?: number;
 *   sortBy?: string;
 *   order?: 'asc' | 'desc';
 * }} query
 * @param {AbortSignal} [signal]
 */
export async function loadVisitPrepSidebarPage(query, signal) {
  const prepsRes = await listVisitPreps(query, signal);

  if (!prepsRes.ok) {
    return {
      ok: false,
      status: prepsRes.status,
      code: prepsRes.code,
      message: prepsRes.message,
      body: prepsRes.body,
    };
  }

  const rows = sortVisitPrepsByUpdatedDesc(
    visitPrepsWithChatId(normalizeVisitPrepsListResponse(prepsRes.data)),
  );

  const total =
    prepsRes.data && typeof prepsRes.data === 'object' && typeof prepsRes.data.total === 'number'
      ? prepsRes.data.total
      : rows.length;

  return { ok: true, rows, total };
}

const LINKED_ENCOUNTER_PAGE_SIZE = 50;

/**
 * Find the pre-visit summary linked to a patient encounter (1:1 via patientEncounter_id).
 *
 * @param {string | number} encounterId
 * @param {AbortSignal} [signal]
 */
export async function fetchVisitPrepLinkedToEncounter(encounterId, signal) {
  if (encounterId == null || encounterId === '') {
    return { ok: true, row: null };
  }

  const target = String(encounterId);
  let offset = 0;

  while (true) {
    const prepsRes = await listVisitPreps(
      {
        limit: LINKED_ENCOUNTER_PAGE_SIZE,
        offset,
        sortBy: 'updated_at',
        order: 'desc',
      },
      signal,
    );

    if (!prepsRes.ok) {
      return {
        ok: false,
        status: prepsRes.status,
        code: prepsRes.code,
        message: prepsRes.message,
        body: prepsRes.body,
      };
    }

    const rows = normalizeVisitPrepsListResponse(prepsRes.data);
    const match =
      rows.find((row) => String(visitPrepPatientEncounterId(row) ?? '') === target) ?? null;

    if (match) {
      return { ok: true, row: match };
    }

    const total =
      prepsRes.data && typeof prepsRes.data === 'object' && typeof prepsRes.data.total === 'number'
        ? prepsRes.data.total
        : rows.length;

    offset += LINKED_ENCOUNTER_PAGE_SIZE;
    if (offset >= total || rows.length < LINKED_ENCOUNTER_PAGE_SIZE) {
      return { ok: true, row: null };
    }
  }
}
