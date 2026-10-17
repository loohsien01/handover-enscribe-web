/**
 * Session cache for Nova chat session display titles, keyed by chat id.
 * Warmed from visit prep sidebar, Nova chat pages, etc.
 */
import { NOVA_DEFAULT_SESSION_TITLE } from '@/constants/novaChat.js';
import { SESSION_KEYS } from '@/utils/storageConfig.js';

const CACHE_VERSION = 1;

function toArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') return Object.values(data);
  return [];
}

/** @param {unknown} data */
function normalizeSessionRows(data) {
  const raw =
    data && typeof data === 'object' && 'sessions' in data
      ? /** @type {{ sessions?: unknown }} */ (data).sessions
      : null;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = /** @type {Record<string, unknown>} */ (row);
      const chatId =
        typeof r.chatId === 'string'
          ? r.chatId
          : typeof r.chat_id === 'string'
            ? r.chat_id
            : null;
      if (!chatId) return null;
      return { chatId, title: r.title };
    })
    .filter(Boolean);
}

/**
 * @returns {Record<string, string>}
 */
export function readChatTitleCache() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEYS.novaChatTitles);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed?.version !== CACHE_VERSION || typeof parsed?.byId !== 'object') {
      return {};
    }
    return { ...parsed.byId };
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, string>} byId
 */
function writeChatTitleCache(byId) {
  try {
    sessionStorage.setItem(
      SESSION_KEYS.novaChatTitles,
      JSON.stringify({ version: CACHE_VERSION, byId }),
    );
  } catch {
    /* ignore quota */
  }
}

/**
 * @param {Record<string, string>} entries
 * @returns {Record<string, string>}
 */
export function mergeChatTitleEntries(entries) {
  const cur = readChatTitleCache();
  const next = { ...cur };
  for (const [id, title] of Object.entries(entries)) {
    if (id == null || id === '') continue;
    const n = typeof title === 'string' ? title.trim() : '';
    if (!n) continue;
    next[String(id)] = n;
  }
  writeChatTitleCache(next);
  return next;
}

/**
 * Drop chat ids from the title session cache (e.g. after encounter DELETE cascades chats).
 * @param {Iterable<string>} chatIds
 */
export function removeChatTitlesFromCache(chatIds) {
  const cur = readChatTitleCache();
  const next = { ...cur };
  let changed = false;
  for (const id of chatIds) {
    if (id == null || id === '') continue;
    const key = String(id);
    if (key in next) {
      delete next[key];
      changed = true;
    }
  }
  if (changed) writeChatTitleCache(next);
}

/**
 * Build a display map from GET /api/nova/chat-sessions list response.
 * @returns {Record<string, string>}
 */
export function chatTitleMapFromSessionListData(data) {
  const map = {};
  for (const row of normalizeSessionRows(data)) {
    const raw = row.title != null ? String(row.title).trim() : '';
    map[row.chatId] = raw || NOVA_DEFAULT_SESSION_TITLE;
  }
  return map;
}

/**
 * Warm cache from Nova session list response; only stores non-empty titles.
 * @returns {Record<string, string>}
 */
export function mergeChatTitlesFromSessionListResponse(data) {
  const toMerge = {};
  for (const row of normalizeSessionRows(data)) {
    const n = row.title != null ? String(row.title).trim() : '';
    if (n) toMerge[row.chatId] = n;
  }
  mergeChatTitleEntries(toMerge);
  return toMerge;
}
