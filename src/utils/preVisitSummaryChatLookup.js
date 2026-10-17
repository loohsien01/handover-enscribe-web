import { listVisitPreps } from '@/lib/visitPrepsApi.js';
import {
  normalizeVisitPrepsListResponse,
  visitPrepChatId,
} from '@/utils/visitPrepsListResponse.js';

const LOOKUP_PAGE_SIZE = 50;

/** @type {Map<string, boolean>} */
const linkedCache = new Map();

/**
 * Whether a Nova chat session has any linked `pre_visit_summaries` row.
 * Used to keep Pre-Visit Summary threads off the generic Nova sidebar.
 *
 * @param {string} chatId
 * @param {AbortSignal} [signal]
 */
export async function isChatLinkedToPreVisitSummary(chatId, signal) {
  if (!chatId) return false;
  if (linkedCache.has(chatId)) return linkedCache.get(chatId);

  let offset = 0;
  while (true) {
    const res = await listVisitPreps(
      { limit: LOOKUP_PAGE_SIZE, offset, sortBy: 'updated_at', order: 'desc' },
      signal,
    );
    if (!res.ok) {
      linkedCache.set(chatId, false);
      return false;
    }

    const rows = normalizeVisitPrepsListResponse(res.data);
    if (rows.some((row) => visitPrepChatId(row) === chatId)) {
      linkedCache.set(chatId, true);
      return true;
    }

    const total =
      res.data && typeof res.data === 'object' && typeof res.data.total === 'number'
        ? res.data.total
        : rows.length;
    offset += LOOKUP_PAGE_SIZE;
    if (offset >= total || rows.length === 0) {
      linkedCache.set(chatId, false);
      return false;
    }
  }
}

/** @param {string} chatId */
export function markChatLinkedToPreVisitSummary(chatId) {
  if (chatId) linkedCache.set(chatId, true);
}

/** @param {string} chatId */
export function isChatKnownLinkedToPreVisitSummary(chatId) {
  return linkedCache.get(chatId) === true;
}
