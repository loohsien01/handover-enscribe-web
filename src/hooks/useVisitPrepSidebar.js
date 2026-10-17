import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/lib/api';
import { deleteVisitPrep, patchVisitPrep } from '@/lib/visitPrepsApi.js';
import { loadVisitPrepSidebarPage } from '@/utils/visitPrepSidebarLoader.js';
import { resolveVisitPrepTitle } from '@/utils/visitPrepTitle.js';
import { visitPrepChatId } from '@/utils/visitPrepsListResponse.js';

export const VISIT_PREP_LIST_LIMIT = 50;

const VISIT_PREP_CHAT_MAP_KEY = 'nova-visit-prep-by-chat';

/** @param {string} chatId */
function clearVisitPrepChatCacheEntry(chatId) {
  try {
    const raw = sessionStorage.getItem(VISIT_PREP_CHAT_MAP_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !(chatId in parsed)) return;
    delete parsed[chatId];
    sessionStorage.setItem(VISIT_PREP_CHAT_MAP_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function useVisitPrepSidebar({ autoLoad = true } = {}) {
  const [visitPrepList, setVisitPrepList] = useState(/** @type {Record<string, unknown>[]} */ ([]));
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(autoLoad);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [listError, setListError] = useState(/** @type {string | null} */ (null));
  const [visitPrepApiOffset, setVisitPrepApiOffset] = useState(0);
  const listFetchGenRef = useRef(0);

  const [renamingChatId, setRenamingChatId] = useState(/** @type {string | null} */ (null));
  const [renameDraft, setRenameDraft] = useState('');

  const sidebarRows = useMemo(() => {
    return visitPrepList
      .map((row) => {
        const chatId = visitPrepChatId(row);
        const visitPrepId = typeof row.id === 'string' ? row.id : null;
        if (!chatId || !visitPrepId) return null;
        return { visitPrepId, chatId, title: resolveVisitPrepTitle(row) };
      })
      .filter(Boolean);
  }, [visitPrepList]);

  const syncVisitPrepInList = useCallback((record) => {
    const id = typeof record.id === 'string' ? record.id : null;
    if (!id) return;
    setVisitPrepList((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...record } : row)),
    );
  }, []);

  const refreshVisitPrepList = useCallback(async () => {
    if (!api.getJWT()) {
      setListLoading(false);
      return;
    }
    const gen = ++listFetchGenRef.current;
    setListLoading(true);
    setListError(null);
    setVisitPrepApiOffset(0);
    try {
      const res = await loadVisitPrepSidebarPage({
        limit: VISIT_PREP_LIST_LIMIT,
        offset: 0,
        sortBy: 'updated_at',
        order: 'desc',
      });
      if (gen !== listFetchGenRef.current) return;
      if (!res.ok) {
        setListError(res.message);
        return;
      }
      setVisitPrepList(res.rows);
      setListTotal(res.total);
      setVisitPrepApiOffset(VISIT_PREP_LIST_LIMIT);
    } finally {
      if (gen === listFetchGenRef.current) {
        setListLoading(false);
      }
    }
  }, []);

  const loadMoreVisitPreps = useCallback(async () => {
    if (!api.getJWT() || listLoadingMore) return;
    const offset = visitPrepApiOffset;
    if (offset >= listTotal) return;
    setListLoadingMore(true);
    setListError(null);
    try {
      const res = await loadVisitPrepSidebarPage({
        limit: VISIT_PREP_LIST_LIMIT,
        offset,
        sortBy: 'updated_at',
        order: 'desc',
      });
      if (!res.ok) {
        setListError(res.message);
        return;
      }
      setVisitPrepList((prev) => {
        const seen = new Set(prev.map((r) => String(r.id ?? '')));
        const appended = res.rows.filter((r) => !seen.has(String(r.id ?? '')));
        return [...prev, ...appended];
      });
      setListTotal(res.total);
      setVisitPrepApiOffset(offset + VISIT_PREP_LIST_LIMIT);
    } finally {
      setListLoadingMore(false);
    }
  }, [listTotal, listLoadingMore, visitPrepApiOffset]);

  useEffect(() => {
    if (!autoLoad) return;
    void refreshVisitPrepList();
  }, [autoLoad, refreshVisitPrepList]);

  const beginRenameChat = useCallback(
    (chatId) => {
      const row = sidebarRows.find((r) => r.chatId === chatId);
      setRenameDraft(row?.title ?? '');
      setRenamingChatId(chatId);
    },
    [sidebarRows],
  );

  const commitSidebarRename = useCallback(
    async (chatId, { onTitlePatched } = {}) => {
      const trimmed = renameDraft.trim();
      if (!trimmed) {
        setRenamingChatId(null);
        return;
      }
      const row = sidebarRows.find((r) => r.chatId === chatId);
      if (!row || trimmed === row.title) {
        setRenamingChatId(null);
        return;
      }
      const res = await patchVisitPrep(row.visitPrepId, { title: trimmed });
      if (!res.ok) {
        setRenamingChatId(null);
        return;
      }
      syncVisitPrepInList(res.data);
      onTitlePatched?.(row.visitPrepId, resolveVisitPrepTitle(res.data));
      setRenamingChatId(null);
    },
    [renameDraft, sidebarRows, syncVisitPrepInList],
  );

  const removeVisitPrepFromList = useCallback((visitPrepId) => {
    setVisitPrepList((prev) => prev.filter((row) => String(row.id ?? '') !== String(visitPrepId)));
    setListTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const deleteVisitPrepRow = useCallback(
    async (row) => {
      if (!row?.visitPrepId) return { ok: false, message: 'Missing pre-visit summary id.' };
      const res = await deleteVisitPrep(row.visitPrepId);
      if (!res.ok) {
        return { ok: false, message: res.message || 'Could not delete pre-visit summary.' };
      }
      removeVisitPrepFromList(row.visitPrepId);
      if (row.chatId) clearVisitPrepChatCacheEntry(row.chatId);
      return { ok: true };
    },
    [removeVisitPrepFromList],
  );

  return {
    visitPrepList,
    sidebarRows,
    listLoading,
    listLoadingMore,
    listError,
    listTotal,
    visitPrepApiOffset,
    renamingChatId,
    renameDraft,
    setRenameDraft,
    setRenamingChatId,
    refreshVisitPrepList,
    loadMoreVisitPreps,
    syncVisitPrepInList,
    removeVisitPrepFromList,
    deleteVisitPrepRow,
    beginRenameChat,
    commitSidebarRename,
  };
}
