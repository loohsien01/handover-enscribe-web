import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Auth from '@/components/Auth.jsx';
import Select from '@/components/Select.jsx';
import NovaMarkdown from '@/components/NovaMarkdown.jsx';
import IconEdit from '@/components/IconEdit.jsx';
import IconSidebar from '@/components/IconSidebar.jsx';
import IconTrash from '@/components/IconTrash.jsx';
import * as api from '@/lib/api';
import {
  novaCreateChatSession,
  novaDeleteChatSession,
  novaGetChatSession,
  novaListChatSessions,
  novaPatchChatSession,
  novaPollCompletionJob,
  novaPostCompletion,
} from '@/lib/novaChatApi.js';
import {
  NOVA_AI_TITLE_POLL_INTERVAL_MS,
  NOVA_AI_TITLE_POLL_MS,
  NOVA_COMPLETION_MAX_WAIT_MS,
  NOVA_DEFAULT_SESSION_TITLE,
  NOVA_MODEL_LABELS,
  NOVA_MODEL_PRESETS,
  NOVA_SESSION_TITLE_MAX_CHARS,
  NOVA_SUMMARIZE_STUCK_MS,
} from '@/constants/novaChat.js';
import { STORAGE_KEYS } from '@/utils/storageConfig.js';
import {
  isChatKnownLinkedToPreVisitSummary,
  isChatLinkedToPreVisitSummary,
} from '@/utils/preVisitSummaryChatLookup.js';

const NOVA_SESSION_LIST_LIMIT = 100;

/** Centered conversation column (messages, composer, header). */
const NOVA_CHAT_COLUMN_CLASS = 'mx-auto w-full max-w-3xl px-3 sm:px-5';

/** Default composer height (~2 rows). */
const NOVA_COMPOSER_MIN_HEIGHT_PX = 56;
/** Max composer height before scrolling (hardcoded). */
const NOVA_COMPOSER_MAX_HEIGHT_PX = 176;
/** Within this gap of the bottom, treat the user as pinned (autoscroll follows new content). */
const NOVA_SCROLL_BOTTOM_THRESHOLD_PX = 72;

/** Shared body/meta text scale for the main chat panel (+1 step). */
const NOVA_CHAT_BODY_TEXT = 'text-base';
const NOVA_CHAT_META_TEXT = 'text-xs';

const NOVA_CHATS_SIDEBAR_MQ = '(min-width: 768px)';

function isNovaChatsSidebarDesktop() {
  return typeof window !== 'undefined' && window.matchMedia(NOVA_CHATS_SIDEBAR_MQ).matches;
}

/** @param {Record<string, unknown> | null | undefined} rec */
function resolveSessionTitle(rec) {
  const raw = rec?.title;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return NOVA_DEFAULT_SESSION_TITLE;
}

/**
 * Heuristic for legacy sessions created before first message (still in DB; hidden from sidebar).
 * @param {Record<string, unknown>} row
 */
function isLikelyEmptySavedSession(row) {
  if (resolveSessionTitle(row) !== NOVA_DEFAULT_SESSION_TITLE) return false;
  const total = row.total_tokens;
  const estimate = row.token_estimate;
  return (total == null || total === 0) && (estimate == null || estimate === 0);
}

function IconNova({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z"
      />
    </svg>
  );
}

function PencilEditIcon() {
  return <IconEdit className="h-[15px] w-[15px]" />;
}

function ChevronDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 14l7 7 7-7"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendMessageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 19V5M5 12l7-7 7 7"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NovaWritingStatus({ className = '' }) {
  return (
    <p
      className={`nova-writing-status ${NOVA_CHAT_META_TEXT} font-medium tracking-wide text-gray-500 ${className}`.trim()}
      aria-live="polite"
    >
      Nova is Writing…
    </p>
  );
}

/**
 * @param {string} errMsg
 * @param {string} partialText
 * @param {(turn: { text: string; error: string } | null) => void} setFailedPartialTurn
 * @param {(err: string | null) => void} setCompletionError
 */
function applyCompletionFailure(errMsg, partialText, setFailedPartialTurn, setCompletionError) {
  if (partialText.trim()) {
    setFailedPartialTurn({ text: partialText, error: errMsg });
    setCompletionError(null);
    return;
  }
  setFailedPartialTurn(null);
  setCompletionError(errMsg);
}

function readSavedModelPreset() {
  try {
    const v = localStorage.getItem(STORAGE_KEYS.ui.novaLastModelPreset);
    if (NOVA_MODEL_PRESETS.includes(/** @type {*} */ (v))) return v;
  } catch {
    /* ignore */
  }
  return 'sonnet';
}

function writeSavedModelPreset(preset) {
  try {
    localStorage.setItem(STORAGE_KEYS.ui.novaLastModelPreset, preset);
  } catch {
    /* ignore */
  }
}

/** @param {unknown} raw */
function normalizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m) =>
      m &&
      typeof m === 'object' &&
      typeof /** @type {{ content?: unknown }} */ (m).content === 'string' &&
      ['user', 'assistant', 'system'].includes(/** @type {{ role?: string }} */ (m).role),
  );
}

/** @param {unknown} data */
function normalizeSessionListRows(data) {
  const raw = data && typeof data === 'object' && 'sessions' in data ? /** @type {{ sessions?: unknown }} */ (data).sessions : null;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const r = /** @type {Record<string, unknown>} */ (row);
      const chatId = typeof r.chatId === 'string' ? r.chatId : null;
      if (!chatId) return null;
      return { ...r, chatId };
    })
    .filter(Boolean);
}

function NovaChatContent() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const chatIdFromUrl = searchParams.get('chat');

  const [sessionList, setSessionList] = useState(/** @type {Record<string, unknown>[]} */ ([]));
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [listError, setListError] = useState(/** @type {string | null} */ (null));
  const listFetchGenRef = useRef(0);

  const [activeChatId, setActiveChatId] = useState(chatIdFromUrl || null);
  const [session, setSession] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [aiTitlePollChatId, setAiTitlePollChatId] = useState(/** @type {string | null} */ (null));
  const [renamingChatId, setRenamingChatId] = useState(/** @type {string | null} */ (null));
  const [renameDraft, setRenameDraft] = useState('');
  const [deletingChatId, setDeletingChatId] = useState(/** @type {string | null} */ (null));
  const [chatsSidebarOpen, setChatsSidebarOpen] = useState(() => isNovaChatsSidebarDesktop());
  const activeChatIdRef = useRef(/** @type {string | null} */ (null));
  const sessionRef = useRef(/** @type {Record<string, unknown> | null} */ (null));
  const [modelPreset, setModelPreset] = useState(() => readSavedModelPreset());
  const [draft, setDraft] = useState('');
  const [loadingSession, setLoadingSession] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pageError, setPageError] = useState(/** @type {string | null} */ (null));
  const [completionError, setCompletionError] = useState(/** @type {string | null} */ (null));
  const [inFlightPartial, setInFlightPartial] = useState(
    /** @type {{ text: string; revision: number } | null} */ (null),
  );
  const [failedPartialTurn, setFailedPartialTurn] = useState(
    /** @type {{ text: string; error: string } | null} */ (null),
  );
  const [summarizeBanner, setSummarizeBanner] = useState(/** @type {'stuck' | 'api' | null} */ (null));
  const [pendingUserEcho, setPendingUserEcho] = useState(/** @type {string | null} */ (null));
  const [scrollToBottomVisible, setScrollToBottomVisible] = useState(false);

  const messagesEl = useRef(/** @type {HTMLDivElement | null} */ (null));
  const messagesContentEl = useRef(/** @type {HTMLDivElement | null} */ (null));
  const composerEl = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const summarizePendingSince = useRef(/** @type {number | null} */ (null));
  const lastPartialTextRef = useRef('');
  const scrollPinnedToBottomRef = useRef(true);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const syncSessionRowFromSession = useCallback((chatId, sess) => {
    if (isChatKnownLinkedToPreVisitSummary(chatId)) return;
    const title = resolveSessionTitle(sess);
    const lastActive =
      (typeof sess?.last_active === 'string' && sess.last_active) ||
      (typeof sess?.last_active_at === 'string' && sess.last_active_at) ||
      new Date().toISOString();
    setSessionList((prev) => {
      const idx = prev.findIndex((r) => /** @type {{ chatId?: unknown }} */ (r).chatId === chatId);
      const patch = {
        chatId,
        title,
        last_active_at: lastActive,
        updated_at: lastActive,
        token_estimate: sess?.token_estimate,
        total_tokens: sess?.total_tokens,
      };
      if (idx === -1) return [patch, ...prev];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const sidebarRows = useMemo(() => {
    return sessionList
      .filter((row) => {
        const r = /** @type {Record<string, unknown>} */ (row);
        const chatId = String(r.chatId ?? '');
        if (chatId && chatId === activeChatId) return true;
        return !isLikelyEmptySavedSession(r);
      })
      .map((row) => {
        const r = /** @type {Record<string, unknown>} */ (row);
        const chatId = /** @type {string} */ (r.chatId);
        const title = resolveSessionTitle(r);
        return { chatId, title };
      });
  }, [sessionList, activeChatId]);

  const refreshSessionList = useCallback(async () => {
    if (!api.getJWT()) {
      setListLoading(false);
      return;
    }
    const gen = ++listFetchGenRef.current;
    setListLoading(true);
    setListError(null);
    try {
      const res = await novaListChatSessions({
        limit: NOVA_SESSION_LIST_LIMIT,
        offset: 0,
        sortBy: 'last_active_at',
        order: 'desc',
      });
      if (gen !== listFetchGenRef.current) return;
      if (!res.ok) {
        setListError(res.message);
        return;
      }
      const rows = normalizeSessionListRows(res.data);
      let nextRows = rows;
      const aid = activeChatIdRef.current;
      const sessSnap = sessionRef.current;
      if (aid && !rows.some((r) => /** @type {{ chatId?: unknown }} */ (r).chatId === aid)) {
        const linkedToPreVisit = await isChatLinkedToPreVisitSummary(aid);
        if (!linkedToPreVisit) {
          const sid = String(sessSnap?.chat_id ?? sessSnap?.chatId ?? '');
          const sessForRow = sid === aid ? sessSnap : null;
          const lastActive =
            (sessForRow &&
              ((typeof sessForRow.last_active === 'string' && sessForRow.last_active) ||
                (typeof sessForRow.last_active_at === 'string' && sessForRow.last_active_at))) ||
            new Date().toISOString();
          const created =
            (sessForRow &&
              ((typeof sessForRow.created_at === 'string' && sessForRow.created_at) ||
                (typeof sessForRow.createdAt === 'string' && sessForRow.createdAt))) ||
            lastActive;
          nextRows = [
            {
              chatId: aid,
              title: resolveSessionTitle(sessForRow),
              last_active_at: lastActive,
              updated_at: lastActive,
              created_at: created,
              organizationId: sessForRow?.organization_id ?? sessForRow?.organizationId,
              token_estimate: sessForRow?.token_estimate,
              total_tokens: sessForRow?.total_tokens,
            },
            ...rows,
          ];
        }
      }
      setSessionList(nextRows);
      const total = typeof res.data.total === 'number' ? res.data.total : rows.length;
      setListTotal(total);
    } finally {
      if (gen === listFetchGenRef.current) {
        setListLoading(false);
      }
    }
  }, []);

  const loadMoreSessions = useCallback(async () => {
    if (!api.getJWT() || listLoadingMore) return;
    const offset = sessionList.length;
    if (offset >= listTotal) return;
    setListLoadingMore(true);
    setListError(null);
    try {
      const res = await novaListChatSessions({
        limit: NOVA_SESSION_LIST_LIMIT,
        offset,
        sortBy: 'last_active_at',
        order: 'desc',
      });
      if (!res.ok) {
        setListError(res.message);
        return;
      }
      const rows = normalizeSessionListRows(res.data);
      setSessionList((prev) => {
        const seen = new Set(prev.map((r) => String(/** @type {{ chatId?: unknown }} */ (r).chatId ?? '')));
        const appended = rows.filter((r) => !seen.has(/** @type {{ chatId: string }} */ (r).chatId));
        return [...prev, ...appended];
      });
      const total = typeof res.data.total === 'number' ? res.data.total : offset + rows.length;
      setListTotal(total);
    } finally {
      setListLoadingMore(false);
    }
  }, [sessionList.length, listTotal, listLoadingMore]);

  const mergeSessionIntoList = useCallback(
    (chatId, sess) => {
      syncSessionRowFromSession(chatId, sess);
    },
    [syncSessionRowFromSession],
  );

  useEffect(() => {
    void refreshSessionList();
  }, [refreshSessionList]);

  const baseMessages = useMemo(() => normalizeMessages(session?.messages), [session]);

  const displayMessages = useMemo(() => {
    if (!pendingUserEcho) return baseMessages;
    const last = baseMessages[baseMessages.length - 1];
    if (last && last.role === 'user' && last.content === pendingUserEcho) return baseMessages;
    return [...baseMessages, { role: 'user', content: pendingUserEcho }];
  }, [baseMessages, pendingUserEcho]);

  const isNearBottom = useCallback((/** @type {HTMLDivElement} */ el) => {
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    return gap <= NOVA_SCROLL_BOTTOM_THRESHOLD_PX;
  }, []);

  const scrollToBottomInstant = useCallback(() => {
    const el = messagesEl.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const followBottomIfPinned = useCallback(() => {
    if (!scrollPinnedToBottomRef.current) return;
    scrollToBottomInstant();
  }, [scrollToBottomInstant]);

  const updateScrollAwayFromBottom = useCallback(() => {
    const el = messagesEl.current;
    if (!el) {
      setScrollToBottomVisible(false);
      return;
    }
    const near = isNearBottom(el);
    scrollPinnedToBottomRef.current = near;
    setScrollToBottomVisible(!near);
  }, [isNearBottom]);

  useEffect(() => {
    scrollPinnedToBottomRef.current = true;
    const el = messagesEl.current;
    if (!el) return undefined;
    followBottomIfPinned();
    updateScrollAwayFromBottom();
    el.addEventListener('scroll', updateScrollAwayFromBottom, { passive: true });
    return () => el.removeEventListener('scroll', updateScrollAwayFromBottom);
  }, [activeChatId, followBottomIfPinned, updateScrollAwayFromBottom]);

  useEffect(() => {
    followBottomIfPinned();
    updateScrollAwayFromBottom();
  }, [
    displayMessages.length,
    loadingSession,
    isSending,
    inFlightPartial?.revision,
    failedPartialTurn,
    followBottomIfPinned,
    updateScrollAwayFromBottom,
  ]);

  useEffect(() => {
    const el = messagesContentEl.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      followBottomIfPinned();
      updateScrollAwayFromBottom();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeChatId, followBottomIfPinned, updateScrollAwayFromBottom]);

  useEffect(() => {
    if (!api.getJWT()) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (chatIdFromUrl) {
      setActiveChatId((prev) => (prev === chatIdFromUrl ? prev : chatIdFromUrl));
    } else {
      setActiveChatId(null);
    }
  }, [chatIdFromUrl]);

  const loadSession = useCallback(
    async (chatId) => {
      setLoadingSession(true);
      setPageError(null);
      const res = await novaGetChatSession(chatId);
      if (!res.ok) {
        setLoadingSession(false);
        if (res.status === 404) {
          setPageError('This chat was not found or you no longer have access. Starting fresh removes it from your sidebar list.');
          setSession(null);
          setSessionList((prev) => prev.filter((r) => /** @type {{ chatId?: unknown }} */ (r).chatId !== chatId));
          setActiveChatId(null);
          setAiTitlePollChatId((prev) => (prev === chatId ? null : prev));
          setSearchParams({}, { replace: true });
          return;
        }
        if (res.code && String(res.code).includes('SUMMARIZE')) {
          setSummarizeBanner('api');
        }
        setPageError(res.message);
        return;
      }

      const linkedToPreVisit = await isChatLinkedToPreVisitSummary(chatId);
      if (linkedToPreVisit) {
        setLoadingSession(false);
        navigate(`/pre-visit-summary/nova-chat?chat=${encodeURIComponent(chatId)}`, { replace: true });
        return;
      }

      setLoadingSession(false);
      const sess = /** @type {Record<string, unknown>} */ (res.data.session);
      setSession(sess || null);
      mergeSessionIntoList(chatId, sess);
      if (sess?.summarize_pending) {
        summarizePendingSince.current = Date.now();
      } else {
        summarizePendingSince.current = null;
        setSummarizeBanner(null);
      }
    },
    [mergeSessionIntoList, navigate, setSearchParams],
  );

  useEffect(() => {
    if (!activeChatId) {
      setSession(null);
      return;
    }
    loadSession(activeChatId);
  }, [activeChatId, loadSession]);

  useEffect(() => {
    if (!activeChatId || !session?.summarize_pending) {
      return;
    }
    const tick = async () => {
      const res = await novaGetChatSession(activeChatId);
      if (!res.ok) {
        if (res.code && String(res.code).includes('SUMMARIZE')) {
          setSummarizeBanner('api');
        }
        return;
      }
      const sess = /** @type {Record<string, unknown>} */ (res.data.session);
      setSession(sess);
      syncSessionRowFromSession(activeChatId, sess);
      if (!sess?.summarize_pending) {
        setSummarizeBanner(null);
        summarizePendingSince.current = null;
        return;
      }
      const since = summarizePendingSince.current ?? Date.now();
      summarizePendingSince.current = since;
      if (Date.now() - since > NOVA_SUMMARIZE_STUCK_MS) {
        setSummarizeBanner('stuck');
      }
    };
    const id = window.setInterval(tick, 4000);
    tick();
    return () => window.clearInterval(id);
  }, [activeChatId, session?.summarize_pending, syncSessionRowFromSession]);

  useEffect(() => {
    if (!aiTitlePollChatId || aiTitlePollChatId !== activeChatId) return undefined;
    let cancelled = false;
    const started = Date.now();

    const tick = async () => {
      if (cancelled) return;
      const res = await novaGetChatSession(aiTitlePollChatId);
      if (cancelled || !res.ok) return;
      const sess = /** @type {Record<string, unknown>} */ (res.data.session);
      const title = resolveSessionTitle(sess);
      setSession(sess);
      syncSessionRowFromSession(aiTitlePollChatId, sess);
      if (title !== NOVA_DEFAULT_SESSION_TITLE || Date.now() - started >= NOVA_AI_TITLE_POLL_MS) {
        setAiTitlePollChatId(null);
        void refreshSessionList();
      }
    };

    const id = window.setInterval(tick, NOVA_AI_TITLE_POLL_INTERVAL_MS);
    tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeChatId, aiTitlePollChatId, refreshSessionList, syncSessionRowFromSession]);

  const startNewChat = useCallback(() => {
    setPageError(null);
    setCompletionError(null);
    setInFlightPartial(null);
    setFailedPartialTurn(null);
    lastPartialTextRef.current = '';
    setSummarizeBanner(null);
    setPendingUserEcho(null);
    setAiTitlePollChatId(null);
    setRenamingChatId(null);
    setDraft('');
    setSession(null);
    setActiveChatId(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const selectThread = useCallback(
    (chatId) => {
      setCompletionError(null);
      setInFlightPartial(null);
      setFailedPartialTurn(null);
      lastPartialTextRef.current = '';
      setPageError(null);
      setSummarizeBanner(null);
      setPendingUserEcho(null);
      setAiTitlePollChatId(null);
      setActiveChatId(chatId);
      setSearchParams({ chat: chatId }, { replace: true });
      if (!isNovaChatsSidebarDesktop()) {
        setChatsSidebarOpen(false);
      }
    },
    [setSearchParams],
  );

  const toggleChatsSidebar = useCallback(() => {
    setChatsSidebarOpen((open) => !open);
  }, []);

  const startNewChatFromSidebar = useCallback(() => {
    startNewChat();
    if (!isNovaChatsSidebarDesktop()) {
      setChatsSidebarOpen(false);
    }
  }, [startNewChat]);

  const beginRenameChat = useCallback(
    (chatId) => {
      const row = sidebarRows.find((r) => r.chatId === chatId);
      setRenameDraft(row?.title ?? '');
      setRenamingChatId(chatId);
      if (activeChatId !== chatId) {
        selectThread(chatId);
      }
    },
    [activeChatId, selectThread, sidebarRows],
  );

  const commitSidebarRename = useCallback(
    async (chatId) => {
      const trimmed = renameDraft.trim();
      if (!trimmed) {
        setRenamingChatId(null);
        return;
      }
      const current = sidebarRows.find((r) => r.chatId === chatId)?.title;
      if (trimmed === current) {
        setRenamingChatId(null);
        return;
      }
      const res = await novaPatchChatSession(chatId, { title: trimmed });
      if (!res.ok) {
        setRenamingChatId(null);
        return;
      }
      const sess = /** @type {Record<string, unknown>} */ (res.data.session);
      syncSessionRowFromSession(chatId, sess);
      if (activeChatIdRef.current === chatId) {
        setSession(sess);
      }
      setAiTitlePollChatId(null);
      setRenamingChatId(null);
      void refreshSessionList();
    },
    [renameDraft, refreshSessionList, sidebarRows, syncSessionRowFromSession],
  );

  const deleteSidebarChat = useCallback(
    async (chatId) => {
      const row = sidebarRows.find((r) => r.chatId === chatId);
      const label = row?.title || 'this chat';
      if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
      if (deletingChatId) return;

      setDeletingChatId(chatId);
      setPageError(null);
      try {
        const res = await novaDeleteChatSession(chatId);
        if (!res.ok) {
          setPageError(res.message || 'Could not delete chat.');
          return;
        }
        setSessionList((prev) =>
          prev.filter((r) => /** @type {{ chatId?: unknown }} */ (r).chatId !== chatId),
        );
        setListTotal((prev) => Math.max(0, prev - 1));
        if (renamingChatId === chatId) setRenamingChatId(null);
        if (aiTitlePollChatId === chatId) setAiTitlePollChatId(null);
        if (activeChatIdRef.current === chatId) {
          startNewChat();
        }
      } finally {
        setDeletingChatId(null);
      }
    },
    [aiTitlePollChatId, deletingChatId, renamingChatId, sidebarRows, startNewChat],
  );

  const onModelChange = useCallback((e) => {
    const v = e.target.value;
    if (NOVA_MODEL_PRESETS.includes(/** @type {*} */ (v))) {
      setModelPreset(v);
      writeSavedModelPreset(v);
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || isSending) return;

    let chatId = activeChatId;

    setDraft('');
    setCompletionError(null);
    setInFlightPartial(null);
    setFailedPartialTurn(null);
    lastPartialTextRef.current = '';
    const messagesViewport = messagesEl.current;
    scrollPinnedToBottomRef.current = messagesViewport ? isNearBottom(messagesViewport) : true;
    setPendingUserEcho(text);
    setIsSending(true);
    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => ctrl.abort(), NOVA_COMPLETION_MAX_WAIT_MS);
    let lastPartialRevision = -1;
    const clientMessageId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const applyTerminalCompletion = (/** @type {Record<string, unknown>} */ data) => {
      const sess = /** @type {Record<string, unknown>} */ (data.session);
      setPendingUserEcho(null);
      setInFlightPartial(null);
      setFailedPartialTurn(null);
      lastPartialTextRef.current = '';
      setSession(sess || null);
      if (sess?.summarize_pending) {
        summarizePendingSince.current = Date.now();
      }
      syncSessionRowFromSession(chatId, sess);
      const title = resolveSessionTitle(sess);
      const assistantTurns = normalizeMessages(sess?.messages).filter((m) => m.role === 'assistant').length;
      if (title === NOVA_DEFAULT_SESSION_TITLE && assistantTurns === 1) {
        setAiTitlePollChatId(chatId);
      }
      void refreshSessionList();
    };

    try {
      if (!chatId) {
        const createRes = await novaCreateChatSession(ctrl.signal);
        if (!createRes.ok) {
          setCompletionError(createRes.message);
          setPendingUserEcho(null);
          setDraft(text);
          return;
        }
        chatId = typeof createRes.data.chatId === 'string' ? createRes.data.chatId : null;
        const createdSession = /** @type {Record<string, unknown>} */ (createRes.data.session);
        if (!chatId) {
          setCompletionError('Server did not return a chat id.');
          setPendingUserEcho(null);
          setDraft(text);
          return;
        }
        setSession(createdSession || null);
        setActiveChatId(chatId);
        setSearchParams({ chat: chatId }, { replace: true });
        mergeSessionIntoList(chatId, createdSession);
      }

      const postRes = await novaPostCompletion(
        chatId,
        { model: modelPreset, message: text, client_message_id: clientMessageId },
        ctrl.signal,
      );
      if (!postRes.ok) {
        if (postRes.status === 409) {
          setCompletionError(
            'A reply is still being generated for this chat. Wait for it to finish, then try again.',
          );
        } else {
          setCompletionError(postRes.message);
        }
        setPendingUserEcho(null);
        setDraft(text);
        return;
      }

      const postData = /** @type {Record<string, unknown>} */ (postRes.data);
      const postStatus = postData?.status;

      if (postStatus === 'failed') {
        const errMsg =
          typeof postData.error === 'string'
            ? postData.error
            : 'Nova could not complete this reply.';
        const partial =
          typeof postData.assistant_partial === 'string' ? postData.assistant_partial : '';
        applyCompletionFailure(errMsg, partial, setFailedPartialTurn, setCompletionError);
        setPendingUserEcho(null);
        setInFlightPartial(null);
        lastPartialTextRef.current = '';
        const sync = await novaGetChatSession(chatId, ctrl.signal);
        if (sync.ok) {
          setSession(/** @type {Record<string, unknown>} */ (sync.data.session) || null);
        }
        setDraft(text);
        return;
      }

      if (postStatus === 'complete') {
        applyTerminalCompletion(postData);
        return;
      }

      const jobId = typeof postData.id === 'string' ? postData.id : null;
      if (!jobId) {
        setCompletionError('Unexpected completion response from server.');
        setPendingUserEcho(null);
        setDraft(text);
        return;
      }

      const syncUser = await novaGetChatSession(chatId, ctrl.signal);
      if (syncUser.ok) {
        const sess = /** @type {Record<string, unknown>} */ (syncUser.data.session);
        setSession(sess || null);
        const msgs = normalizeMessages(sess?.messages);
        const last = msgs[msgs.length - 1];
        if (last?.role === 'user' && last.content === text) {
          setPendingUserEcho(null);
        }
      }

      const pollRes = await novaPollCompletionJob(chatId, jobId, {
        signal: ctrl.signal,
        onProgress: (job) => {
          const partial = typeof job.assistant_partial === 'string' ? job.assistant_partial : null;
          const rev = typeof job.partial_revision === 'number' ? job.partial_revision : -1;
          if (partial == null || rev === lastPartialRevision) return;
          lastPartialRevision = rev;
          lastPartialTextRef.current = partial;
          setInFlightPartial({ text: partial, revision: rev });
        },
      });
      if (!pollRes.ok) {
        applyCompletionFailure(
          pollRes.message,
          lastPartialTextRef.current,
          setFailedPartialTurn,
          setCompletionError,
        );
        setPendingUserEcho(null);
        setInFlightPartial(null);
        setDraft(text);
        const sync2 = await novaGetChatSession(chatId, ctrl.signal);
        if (sync2.ok) {
          setSession(/** @type {Record<string, unknown>} */ (sync2.data.session) || null);
        }
        return;
      }

      const pollData = /** @type {Record<string, unknown>} */ (pollRes.data);
      if (pollData.status === 'failed') {
        const errMsg =
          typeof pollData.error === 'string'
            ? pollData.error
            : 'Nova could not complete this reply.';
        const partial =
          typeof pollData.assistant_partial === 'string'
            ? pollData.assistant_partial
            : lastPartialTextRef.current;
        applyCompletionFailure(errMsg, partial, setFailedPartialTurn, setCompletionError);
        setPendingUserEcho(null);
        setInFlightPartial(null);
        lastPartialTextRef.current = '';
        const sync = await novaGetChatSession(chatId, ctrl.signal);
        if (sync.ok) {
          setSession(/** @type {Record<string, unknown>} */ (sync.data.session) || null);
        }
        setDraft(text);
        return;
      }

      if (pollData.status === 'complete') {
        applyTerminalCompletion(pollData);
        return;
      }

      setCompletionError('Unexpected job status after polling.');
      setPendingUserEcho(null);
      setDraft(text);
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'name' in e && e.name === 'AbortError'
          ? 'This reply took too long and was cancelled. Try again, or use a shorter message.'
          : e instanceof Error
            ? e.message
            : 'Request failed.';
      applyCompletionFailure(msg, lastPartialTextRef.current, setFailedPartialTurn, setCompletionError);
      setPendingUserEcho(null);
      setInFlightPartial(null);
      setDraft(text);
    } finally {
      window.clearTimeout(timeout);
      setIsSending(false);
    }
  }, [
    activeChatId,
    draft,
    isNearBottom,
    isSending,
    mergeSessionIntoList,
    modelPreset,
    refreshSessionList,
    setSearchParams,
    syncSessionRowFromSession,
  ]);

  const onComposerKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const syncComposerHeight = useCallback(() => {
    const el = composerEl.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, NOVA_COMPOSER_MAX_HEIGHT_PX);
    el.style.height = `${Math.max(next, NOVA_COMPOSER_MIN_HEIGHT_PX)}px`;
  }, []);

  const onComposerChange = useCallback(
    (e) => {
      setDraft(e.target.value);
      const el = e.target;
      el.style.height = 'auto';
      const next = Math.min(el.scrollHeight, NOVA_COMPOSER_MAX_HEIGHT_PX);
      el.style.height = `${Math.max(next, NOVA_COMPOSER_MIN_HEIGHT_PX)}px`;
    },
    [],
  );

  useEffect(() => {
    syncComposerHeight();
  }, [draft, syncComposerHeight]);

  return (
    <div className="flex h-[var(--mobile-viewport-height)] min-h-0 flex-col bg-gray-50 lg:h-[100dvh]">
        {(summarizeBanner === 'stuck' || summarizeBanner === 'api') && (
          <div
            className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm"
            role="alert"
          >
            {summarizeBanner === 'api' ? (
              <>
                The server reported a problem while updating the rolling conversation summary. This will not affect your chat experience. However, longer threads may use more tokens until summarization catches up.
              </>
            ) : (
              <>
                Background conversation summarization is slower than usual. This will not affect your chat experience. However, longer threads may use more tokens until summarization catches up.
              </>
            )}
            <button
              type="button"
              className="ml-3 underline font-bold"
              onClick={() => setSummarizeBanner(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
          {chatsSidebarOpen ? (
            <div
              className="pointer-events-none absolute inset-y-0 left-64 z-20 hidden w-px bg-gray-200 md:block"
              aria-hidden
            />
          ) : null}
          <aside
            aria-hidden={!chatsSidebarOpen}
            className={
              chatsSidebarOpen
                ? 'flex min-h-0 w-full flex-1 flex-col border-b border-gray-200 bg-white md:w-64 md:flex-none md:border-b-0'
                : 'hidden'
            }
          >
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleChatsSidebar}
                  aria-label="Hide chats"
                  title="Hide chats"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-[#183278] hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/30"
                >
                  <IconSidebar className="h-4 w-4" />
                </button>
                <h2 className="text-sm font-semibold text-gray-900">Chats</h2>
              </div>
              <button
                type="button"
                onClick={startNewChatFromSidebar}
                className="rounded-md bg-[#183278] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#142a66]"
              >
                New chat
              </button>
            </div>
            {listError && (
              <div className="border-b border-gray-100 px-3 py-2">
                <p className="text-[11px] leading-snug text-red-600">{listError}</p>
                <button
                  type="button"
                  onClick={() => void refreshSessionList()}
                  className="mt-1.5 text-[11px] font-semibold text-[#183278] underline"
                >
                  Retry
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {listLoading && sidebarRows.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-gray-400">Loading chats…</p>
                ) : sidebarRows.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-gray-400">No chats yet. Start a new one.</p>
                ) : (
                  <ul className="space-y-1">
                    {sidebarRows.map((t) => (
                      <li key={t.chatId}>
                        <div
                          className={`group/sidebar-row relative flex w-full items-center rounded-lg transition ${
                            activeChatId === t.chatId
                              ? 'bg-[#E8EEFB]'
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          {renamingChatId === t.chatId ? (
                            <input
                              type="text"
                              value={renameDraft}
                              maxLength={NOVA_SESSION_TITLE_MAX_CHARS}
                              aria-label="Rename chat"
                              autoFocus
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onBlur={() => void commitSidebarRename(t.chatId)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void commitSidebarRename(t.chatId);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setRenamingChatId(null);
                                }
                              }}
                              className="min-w-0 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-[#183278] focus:outline-none focus:ring-2 focus:ring-[#183278]/25"
                            />
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => selectThread(t.chatId)}
                                className={`min-w-0 w-full px-2 py-2 text-left text-sm ${
                                  activeChatId === t.chatId
                                    ? 'font-medium text-[#183278]'
                                    : 'text-gray-700'
                                }`}
                              >
                                <span className="line-clamp-2">{t.title}</span>
                              </button>
                              <div
                                className={`pointer-events-none absolute inset-y-0 right-0 flex items-center gap-0.5 bg-inherit pl-3 pr-1 opacity-0 transition-opacity group-hover/sidebar-row:pointer-events-auto group-hover/sidebar-row:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-70 ${
                                  deletingChatId === t.chatId ? 'pointer-events-none opacity-50' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => beginRenameChat(t.chatId)}
                                  disabled={deletingChatId === t.chatId}
                                  className="rounded-md p-1.5 text-gray-500 hover:bg-white/90 hover:text-[#183278] disabled:opacity-50"
                                  aria-label={`Rename ${t.title}`}
                                >
                                  <PencilEditIcon />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteSidebarChat(t.chatId)}
                                  disabled={deletingChatId === t.chatId}
                                  className="rounded-md p-1.5 text-gray-500 hover:bg-white/90 hover:text-red-600 disabled:opacity-50"
                                  aria-label={`Delete ${t.title}`}
                                >
                                  <IconTrash className="h-[15px] w-[15px]" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {listTotal > sessionList.length && (
                  <div className="px-2 pt-2 pb-1">
                    <button
                      type="button"
                      onClick={() => void loadMoreSessions()}
                      disabled={listLoadingMore}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-center text-xs font-semibold text-[#183278] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {listLoadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </div>
          </aside>

          <section
            className={`min-h-0 min-w-0 flex-1 flex-col bg-white ${
              chatsSidebarOpen ? 'hidden md:flex' : 'flex'
            }`}
          >
            <header className="shrink-0 border-b border-gray-200 px-3 py-3 sm:px-4">
              <div className="flex items-center gap-2.5">
                {!chatsSidebarOpen ? (
                  <button
                    type="button"
                    onClick={toggleChatsSidebar}
                    aria-expanded={false}
                    aria-label="Show chats"
                    title="Show chats"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-[#183278] hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/30"
                  >
                    <IconSidebar className="h-4 w-4" />
                  </button>
                ) : null}
                <IconNova className="h-6 w-6 shrink-0 text-[#183278]" />
                <h1 className="text-xl font-semibold text-gray-900">Nova</h1>
              </div>
            </header>

            {pageError && (
              <div className="shrink-0 border-b border-red-100 bg-red-50">
                <p className={`${NOVA_CHAT_COLUMN_CLASS} py-2 ${NOVA_CHAT_BODY_TEXT} text-red-800`}>{pageError}</p>
              </div>
            )}

            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <div
                ref={messagesEl}
                onScroll={updateScrollAwayFromBottom}
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <div ref={messagesContentEl} className={`${NOVA_CHAT_COLUMN_CLASS} space-y-4 py-4`}>
              {loadingSession && activeChatId && (
                <p className={`text-center ${NOVA_CHAT_BODY_TEXT} text-gray-500`}>Loading conversation…</p>
              )}
              {!loadingSession && displayMessages.length === 0 && !isSending && (
                <p className={`text-center ${NOVA_CHAT_BODY_TEXT} text-gray-500`}>Send a message to begin.</p>
              )}
              {displayMessages.map((m, idx) => {
                const role = /** @type {string} */ (m.role);
                const isUser = role === 'user';
                const isSystem = role === 'system';
                const isAssistant = role === 'assistant';
                const roleLabel = role === 'assistant' ? 'Nova' : role;
                const isTailOptimistic =
                  isSending &&
                  pendingUserEcho &&
                  isUser &&
                  m.content === pendingUserEcho &&
                  idx === displayMessages.length - 1;
                const bubbleMaxClass = 'max-w-[min(100%,42rem)]';
                const userBubbleMaxClass = 'max-w-[min(100%,35rem)]';
                return (
                  <div
                    key={`msg-${idx}`}
                    className={`flex ${isUser ? 'justify-end' : 'w-full justify-start'}`}
                  >
                    <div
                      className={`${isAssistant ? 'px-0 py-1' : 'rounded-2xl px-4 py-2.5 shadow-sm'} ${NOVA_CHAT_BODY_TEXT} leading-relaxed ${
                        isUser
                          ? `${userBubbleMaxClass} border border-white/25 bg-[#183278] text-white shadow-md ring-2 ring-white/35 ring-offset-2 ring-offset-white${isTailOptimistic ? ' opacity-95' : ''}`
                          : isSystem
                            ? `${bubbleMaxClass} border border-amber-200 bg-amber-50 text-amber-950`
                            : isAssistant
                              ? 'w-full bg-transparent text-gray-900'
                              : `${bubbleMaxClass} border border-gray-200 bg-gray-50 text-gray-900`
                      }`}
                    >
                      {!isAssistant ? (
                        <div className={`mb-1 ${NOVA_CHAT_META_TEXT} font-semibold uppercase tracking-wide opacity-70`}>
                          {roleLabel}
                          {isTailOptimistic ? ' · sending' : ''}
                        </div>
                      ) : null}
                      {isAssistant ? (
                        <NovaMarkdown content={String(m.content ?? '')} />
                      ) : (
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isSending && (
                <div className="flex w-full justify-start">
                  <div className={`w-full px-0 py-1 ${NOVA_CHAT_BODY_TEXT}`}>
                    {inFlightPartial?.text ? (
                      <div className="nova-in-flight-partial">
                        <NovaMarkdown content={inFlightPartial.text} />
                        <span className="nova-stream-cursor" aria-hidden />
                      </div>
                    ) : null}
                    <NovaWritingStatus className={inFlightPartial?.text ? 'mt-2' : ''} />
                  </div>
                </div>
              )}
              {!isSending && failedPartialTurn ? (
                <div className="flex w-full justify-start">
                  <div className={`w-full px-0 py-1 ${NOVA_CHAT_BODY_TEXT}`}>
                    <div className="nova-in-flight-partial opacity-90">
                      <NovaMarkdown content={failedPartialTurn.text} />
                    </div>
                    <div
                      className={`mt-2 rounded-lg bg-red-100 px-3 py-2 ${NOVA_CHAT_BODY_TEXT} font-medium text-red-900`}
                      role="alert"
                    >
                      {failedPartialTurn.error}
                    </div>
                  </div>
                </div>
              ) : null}
                </div>
              </div>
              {scrollToBottomVisible && (
                <button
                  type="button"
                  onClick={() => {
                    scrollPinnedToBottomRef.current = true;
                    scrollToBottomInstant();
                    updateScrollAwayFromBottom();
                  }}
                  aria-label="Scroll to bottom"
                  className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-gray-300 bg-white p-2 text-[#183278] shadow-md hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
                >
                  <ChevronDownIcon />
                </button>
              )}
            </div>

            <footer className="relative z-10 shrink-0 bg-white pb-2 pt-1">
              <div className={`${NOVA_CHAT_COLUMN_CLASS} relative shadow-[0_-12px_20px_12px_#ffffff]`}>
                {completionError && (
                  <div className={`mb-2 rounded-lg bg-red-100 px-3 py-2 ${NOVA_CHAT_BODY_TEXT} font-medium text-red-900`}>
                    {completionError}
                  </div>
                )}
                <label htmlFor="nova-composer" className="sr-only">
                  Message Nova
                </label>
                <div
                  className={`rounded-xl border border-gray-300 shadow-sm focus-within:border-[#183278] focus-within:ring-2 focus-within:ring-[#183278]/30 ${
                    isSending ? 'bg-gray-100' : 'bg-white'
                  }`}
                >
                  <textarea
                    ref={composerEl}
                    id="nova-composer"
                    rows={2}
                    value={draft}
                    onChange={onComposerChange}
                    onKeyDown={onComposerKeyDown}
                    disabled={isSending}
                    placeholder="Message Nova… (Enter to send, Shift+Enter for newline)"
                    className={`block w-full min-h-[3.5rem] max-h-[11rem] resize-none overflow-y-auto border-0 bg-transparent px-3 pt-2.5 pb-1 ${NOVA_CHAT_BODY_TEXT} text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-70`}
                  />
                  <div className="flex items-center justify-end gap-4 px-2 pb-2">
                    <div className="flex items-center gap-1">
                      <label
                        htmlFor="nova-model"
                        className={`${NOVA_CHAT_META_TEXT} shrink-0 font-medium uppercase tracking-wide leading-none text-gray-500`}
                      >
                        Model:
                      </label>
                      <Select
                        id="nova-model"
                        size="inline"
                        value={modelPreset}
                        onChange={onModelChange}
                        disabled={isSending}
                        title="Model"
                        className={NOVA_CHAT_META_TEXT}
                      >
                        {NOVA_MODEL_PRESETS.map((id) => (
                          <option key={id} value={id}>
                            {NOVA_MODEL_LABELS[id]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={isSending || !draft.trim()}
                      aria-label="Send message"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#183278] text-white hover:bg-[#142a66] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
                    >
                      <SendMessageIcon />
                    </button>
                  </div>
                </div>
                <p className={`mt-2 text-center ${NOVA_CHAT_META_TEXT} leading-snug text-gray-500`}>
                  Nova can make mistakes. This assistant is not a substitute for clinical judgment.
                </p>
              </div>
            </footer>
          </section>
        </div>
    </div>
  );
}

export default function NovaChatPage() {
  return (
    <>
      <Auth />
      <NovaChatContent />
    </>
  );
}
