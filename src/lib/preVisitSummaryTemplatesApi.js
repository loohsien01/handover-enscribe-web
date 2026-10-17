import { fetchWithRefresh } from '@/lib/api';
import { formatApiErrorBody } from '@/utils/errors';

/**
 * @param {Response} resp
 * @returns {Promise<
 *   | { ok: true; status: number; data: Record<string, unknown> }
 *   | { ok: false; status: number; code: string | null; message: string; body: Record<string, unknown> }
 * >}
 */
async function parseJsonResponse(resp) {
  const body = /** @type {Record<string, unknown>} */ (
    await resp.json().catch(() => ({}))
  );
  if (!resp.ok) {
    const code = typeof body.code === 'string' ? body.code : null;
    return {
      ok: false,
      status: resp.status,
      code,
      message: formatApiErrorBody(body, resp.status),
      body,
    };
  }
  return { ok: true, status: resp.status, data: body };
}

/**
 * @param {{
 *   limit?: number;
 *   offset?: number;
 *   sortBy?: string;
 *   order?: 'asc' | 'desc';
 *   decrypt_text?: boolean;
 * }} [query]
 * @param {AbortSignal} [signal]
 */
export function listPreVisitSummaryTemplates(query, signal) {
  const q = new URLSearchParams();
  if (query?.limit != null) q.set('limit', String(query.limit));
  if (query?.offset != null) q.set('offset', String(query.offset));
  if (query?.sortBy) q.set('sortBy', query.sortBy);
  if (query?.order) q.set('order', query.order);
  if (query?.decrypt_text) q.set('decrypt_text', 'true');
  const qs = q.toString();
  const path = qs
    ? `/api/pre-visit-summary-templates?${qs}`
    : '/api/pre-visit-summary-templates';
  return fetchWithRefresh(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  }).then(parseJsonResponse);
}

/**
 * @param {string} id
 * @param {AbortSignal} [signal]
 */
export function getPreVisitSummaryTemplate(id, signal) {
  return fetchWithRefresh(
    `/api/pre-visit-summary-templates/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    },
  ).then(parseJsonResponse);
}

/**
 * @param {{ name: string; text?: string; is_default?: boolean }} payload
 * @param {AbortSignal} [signal]
 */
export function createPreVisitSummaryTemplate(payload, signal) {
  return fetchWithRefresh('/api/pre-visit-summary-templates', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  }).then(parseJsonResponse);
}

/**
 * @param {string} id
 * @param {{ name?: string; text?: string; is_default?: boolean }} payload
 * @param {AbortSignal} [signal]
 */
export function patchPreVisitSummaryTemplate(id, payload, signal) {
  return fetchWithRefresh(
    `/api/pre-visit-summary-templates/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    },
  ).then(parseJsonResponse);
}

/**
 * @param {string} id
 * @param {AbortSignal} [signal]
 */
export function deletePreVisitSummaryTemplate(id, signal) {
  return fetchWithRefresh(
    `/api/pre-visit-summary-templates/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      signal,
    },
  ).then(parseJsonResponse);
}
