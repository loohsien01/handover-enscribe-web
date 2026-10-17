import { fetchWithRefresh } from '@/lib/api';
import {
  NOVA_AI_TITLE_POLL_INTERVAL_MS,
  NOVA_AI_TITLE_POLL_MS,
  NOVA_COMPLETION_MAX_WAIT_MS,
  NOVA_COMPLETION_POLL_INTERVAL_MS,
  NOVA_COMPLETION_POLL_INTERVAL_PARTIAL_MS,
  NOVA_COMPLETION_POLL_INTERVAL_PENDING_MS,
  NOVA_COMPLETION_POLL_INTERVAL_RUNNING_MS,
} from '@/constants/novaChat.js';
import { normalizeVisitPrepTitleDetails } from '@/utils/visitPrepTitle.js';
import { formatApiErrorBody, isNetworkError } from '@/utils/errors';

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
 *   sortBy?: 'last_active_at' | 'created_at' | 'updated_at';
 *   order?: 'asc' | 'desc';
 *   includePreVisitSummary?: boolean;
 *   onlyPreVisitSummary?: boolean;
 * }} [query]
 * @param {AbortSignal} [signal]
 */
export function novaListChatSessions(query, signal) {
  const q = new URLSearchParams();
  if (query?.limit != null) q.set('limit', String(query.limit));
  if (query?.offset != null) q.set('offset', String(query.offset));
  if (query?.sortBy) q.set('sortBy', query.sortBy);
  if (query?.order) q.set('order', query.order);
  if (query?.includePreVisitSummary) q.set('includePreVisitSummary', 'true');
  if (query?.onlyPreVisitSummary) q.set('onlyPreVisitSummary', 'true');
  const qs = q.toString();
  const path = qs ? `/api/nova/chat-sessions?${qs}` : '/api/nova/chat-sessions';
  return fetchWithRefresh(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  }).then(parseJsonResponse);
}

export function novaCreateChatSession(signal) {
  return fetchWithRefresh('/api/nova/chat-sessions', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: '{}',
    signal,
  }).then(parseJsonResponse);
}

/**
 * @param {string} chatId
 * @param {AbortSignal} [signal]
 */
export function novaGetChatSession(chatId, signal) {
  return fetchWithRefresh(`/api/nova/chat-sessions/${encodeURIComponent(chatId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  }).then(parseJsonResponse);
}

/**
 * @param {string} chatId
 * @param {{ title?: string; summary?: string; token_estimate?: number; messages?: unknown[]; appendMessages?: unknown[] }} payload
 * @param {AbortSignal} [signal]
 */
export function novaPatchChatSession(chatId, payload, signal) {
  return fetchWithRefresh(`/api/nova/chat-sessions/${encodeURIComponent(chatId)}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  }).then(parseJsonResponse);
}

/**
 * Hard-delete an owned chat session. Linked pre-visit summary rows keep text with `chat_id` null.
 *
 * @param {string} chatId
 * @param {AbortSignal} [signal]
 */
export function novaDeleteChatSession(chatId, signal) {
  return fetchWithRefresh(`/api/nova/chat-sessions/${encodeURIComponent(chatId)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    signal,
  }).then(parseJsonResponse);
}

/**
 * Enqueue one completion turn. **202** + job id → poll {@link novaGetCompletionJob}; **200** may return a
 * terminal replay (`status: complete` + `session`) for the same `client_message_id`.
 *
 * @param {string} chatId
 * @param {{ model: string; message: string; client_message_id: string }} payload
 * @param {AbortSignal} [signal]
 */
export function novaPostCompletion(chatId, payload, signal) {
  return fetchWithRefresh(`/api/nova/chat-sessions/${encodeURIComponent(chatId)}/completions`, {
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
 * Turn 1 on pre-visit summary page: Bedrock + persist summary before job `complete`.
 *
 * @param {string} chatId
 * @param {{
 *   model: string;
 *   message: string;
 *   client_message_id: string;
 *   extract_title_details?: boolean;
 * }} payload
 * @param {AbortSignal} [signal]
 */
export function novaPostCompletionAndSaveVisitPrep(chatId, payload, signal) {
  return fetchWithRefresh(
    `/api/nova/chat-sessions/${encodeURIComponent(chatId)}/completions-and-save-pre-visit-summary`,
    {
      method: 'POST',
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
 * @param {string} chatId
 * @param {string} jobId
 * @param {AbortSignal} [signal]
 */
export function novaGetCompletionJob(chatId, jobId, signal) {
  return fetchWithRefresh(
    `/api/nova/chat-sessions/${encodeURIComponent(chatId)}/completion-jobs/${encodeURIComponent(jobId)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    },
  ).then(parseJsonResponse);
}

/**
 * @param {Record<string, unknown>} jobData
 * @param {{
 *   intervalMs?: number;
 *   intervalPendingMs?: number;
 *   intervalRunningMs?: number;
 *   intervalPartialMs?: number;
 * }} options
 */
function resolveCompletionPollIntervalMs(jobData, options) {
  if (options.intervalMs != null) return options.intervalMs;
  const st = jobData?.status;
  if (st === 'pending') {
    return options.intervalPendingMs ?? NOVA_COMPLETION_POLL_INTERVAL_PENDING_MS;
  }
  if (jobData?.assistant_partial != null) {
    return options.intervalPartialMs ?? NOVA_COMPLETION_POLL_INTERVAL_PARTIAL_MS;
  }
  return options.intervalRunningMs ?? NOVA_COMPLETION_POLL_INTERVAL_RUNNING_MS;
}

/**
 * Poll until `complete`, `failed`, timeout, or non-OK HTTP.
 *
 * @param {string} chatId
 * @param {string} jobId
 * @param {{
 *   signal?: AbortSignal;
 *   maxWaitMs?: number;
 *   intervalMs?: number;
 *   intervalPendingMs?: number;
 *   intervalRunningMs?: number;
 *   intervalPartialMs?: number;
 *   onProgress?: (job: Record<string, unknown>) => void;
 * }} [options]
 */
export async function novaPollCompletionJob(chatId, jobId, options = {}) {
  const {
    signal,
    maxWaitMs = NOVA_COMPLETION_MAX_WAIT_MS,
    intervalMs,
    onProgress,
  } = options;
  const deadline = Date.now() + maxWaitMs;
  let consecutiveNetworkErrors = 0;
  const maxNetworkRetries = 10;
  const fallbackIntervalMs = intervalMs ?? NOVA_COMPLETION_POLL_INTERVAL_MS;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    /** @type {Awaited<ReturnType<typeof novaGetCompletionJob>>} */
    let res;
    try {
      res = await novaGetCompletionJob(chatId, jobId, signal);
      consecutiveNetworkErrors = 0;
    } catch (err) {
      if (signal?.aborted) throw err;
      if (isNetworkError(err) && consecutiveNetworkErrors < maxNetworkRetries) {
        consecutiveNetworkErrors += 1;
        const backoff = Math.min(60_000, fallbackIntervalMs * 2 ** (consecutiveNetworkErrors - 1));
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }

    if (!res.ok) {
      return res;
    }

    const jobData = res.data;
    onProgress?.(jobData);

    const st = jobData?.status;
    if (st === 'complete' || st === 'failed') {
      return res;
    }

    const waitMs = resolveCompletionPollIntervalMs(jobData, options);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  return {
    ok: false,
    status: 408,
    code: null,
    message: 'Nova reply took too long. Try again.',
    body: {},
  };
}

/**
 * Re-poll a terminal job until `pre_visit_summary_title_details` appears or timeout (~30s).
 *
 * @param {string} chatId
 * @param {string} jobId
 * @param {{ signal?: AbortSignal; maxWaitMs?: number; intervalMs?: number }} [options]
 */
export async function novaPollVisitPrepTitleDetails(chatId, jobId, options = {}) {
  const {
    signal,
    maxWaitMs = NOVA_AI_TITLE_POLL_MS,
    intervalMs = NOVA_AI_TITLE_POLL_INTERVAL_MS,
  } = options;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const res = await novaGetCompletionJob(chatId, jobId, signal);
    if (!res.ok) return res;
    const details = normalizeVisitPrepTitleDetails(res.data.pre_visit_summary_title_details);
    if (details) {
      return { ok: true, status: res.status, data: details };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return {
    ok: false,
    status: 408,
    code: null,
    message: 'Pre-visit summary title details took too long.',
    body: {},
  };
}
