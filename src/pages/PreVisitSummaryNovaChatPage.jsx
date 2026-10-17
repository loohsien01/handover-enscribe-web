import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Auth from '@/components/Auth.jsx';
import Select from '@/components/Select.jsx';
import NovaMarkdown from '@/components/NovaMarkdown.jsx';
import {
  VisitPrepPageShell,
  VisitPrepChatPanelHeader,
  VisitPrepSummaryAttachPatientVisitCta,
  VisitPrepSummaryAttachPatientVisitEdgeTab,
  visitPrepChatColumnClass,
  visitPrepChatMessagesColumnClass,
  visitPrepChatFooterFadeShadowClass,
} from '@/components/visitPrep/VisitPrepPageShell.jsx';
import VisitPrepSummaryPanel from '@/components/visitPrep/VisitPrepSummaryPanel.jsx';
import VisitPrepSummaryMobileOverlay from '@/components/visitPrep/VisitPrepSummaryMobileOverlay.jsx';
import { formatVisitPrepSavedAt } from '@/utils/visitPrepSavedAt.js';
import { useVisitPrepSidebar } from '@/hooks/useVisitPrepSidebar.js';
import * as api from '@/lib/api';
import {
  novaCreateChatSession,
  novaGetChatSession,
  novaPollCompletionJob,
  novaPollVisitPrepTitleDetails,
  novaPostCompletion,
  novaPostCompletionAndSaveVisitPrep,
} from '@/lib/novaChatApi.js';
import { createVisitPrep, getVisitPrep, patchVisitPrep } from '@/lib/visitPrepsApi.js';
import { visitPrepChatId } from '@/utils/visitPrepsListResponse.js';
import {
  NOVA_COMPLETION_MAX_WAIT_MS,
  NOVA_MODEL_LABELS,
  NOVA_MODEL_PRESETS,
  NOVA_SUMMARIZE_STUCK_MS,
} from '@/constants/novaChat.js';
import {
  composeVisitPrepSessionTitle,
  resolveVisitPrepTitle,
  VISIT_PREP_DEFAULT_TITLE,
} from '@/utils/visitPrepTitle.js';
import { SESSION_KEYS, STORAGE_KEYS } from '@/utils/storageConfig.js';
import { buildActiveRecordingNavState } from '@/utils/visitPrepRecordingHandoff.js';
import { markChatLinkedToPreVisitSummary } from '@/utils/preVisitSummaryChatLookup.js';
const VISIT_PREP_CHAT_MAP_KEY = 'nova-visit-prep-by-chat';
const PREP_DOCUMENT_HIGHLIGHT_MS = 2800;
const VISIT_PREP_AUTOSAVE_IDLE_MS = 20_000;

function readVisitPrepZoneHintDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEYS.ui.dismissedVisitPrepZoneHint) === '1';
  } catch {
    return false;
  }
}

function dismissVisitPrepZoneHint() {
  try {
    localStorage.setItem(STORAGE_KEYS.ui.dismissedVisitPrepZoneHint, '1');
  } catch {
    /* ignore */
  }
}

const NOVA_COMPOSER_MIN_HEIGHT_PX = 56;
const NOVA_COMPOSER_MAX_HEIGHT_PX = 176;
const NOVA_SCROLL_BOTTOM_THRESHOLD_PX = 72;
const NOVA_CHAT_BODY_TEXT = 'text-base';
const NOVA_CHAT_META_TEXT = 'text-xs';

/** @param {Record<string, unknown>[]} rows @param {string} chatId */
function latestVisitPrepForChat(rows, chatId) {
  let best = null;
  let bestTs = -1;
  for (const row of rows) {
    if (visitPrepChatId(row) !== chatId) continue;
    const ts = new Date(String(row.updated_at ?? row.created_at ?? 0)).getTime();
    if (ts >= bestTs) {
      bestTs = ts;
      best = row;
    }
  }
  return best;
}

/** @returns {Record<string, { id: string; text: string }>} */
function readVisitPrepChatMap() {
  try {
    const raw = sessionStorage.getItem(VISIT_PREP_CHAT_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return /** @type {Record<string, { id: string; text: string }>} */ (parsed);
  } catch {
    return {};
  }
}

/**
 * @param {string} chatId
 * @param {{ id: string; text: string }} entry
 */
function writeVisitPrepChatEntry(chatId, entry) {
  try {
    const map = readVisitPrepChatMap();
    map[chatId] = entry;
    sessionStorage.setItem(VISIT_PREP_CHAT_MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function ChevronScrollIcon() {
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

/** @param {Record<string, unknown> | null | undefined} sess */
function isFirstVisitPrepTurn(sess) {
  return normalizeMessages(sess?.messages).filter((m) => m.role === 'assistant').length === 0;
}

function PreVisitSummaryNovaChatPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const chatIdFromUrl = searchParams.get('chat');

  const {
    visitPrepList,
    refreshVisitPrepList,
    syncVisitPrepInList,
  } = useVisitPrepSidebar();

  const visitPrepListRef = useRef(/** @type {Record<string, unknown>[]} */ ([]));
  const visitPrepIdRef = useRef(/** @type {string | null} */ (null));

  const [activeChatId, setActiveChatId] = useState(chatIdFromUrl || null);
  const [session, setSession] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [visitPrepTitlePoll, setVisitPrepTitlePoll] = useState(
    /** @type {{ chatId: string; jobId: string; visitPrepId?: string | null } | null} */ (null),
  );
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

  const [summaryOverlayOpen, setSummaryOverlayOpen] = useState(false);
  const [zoneHintDismissed, setZoneHintDismissed] = useState(readVisitPrepZoneHintDismissed);
  const [prepDocumentHighlight, setPrepDocumentHighlight] = useState(false);
  const [visitPrepId, setVisitPrepId] = useState(/** @type {string | null} */ (null));
  const [visitPrepTitle, setVisitPrepTitle] = useState('');
  const [visitPrepDraft, setVisitPrepDraft] = useState('');
  const [visitPrepSavedText, setVisitPrepSavedText] = useState('');
  const [visitPrepPanelError, setVisitPrepPanelError] = useState(/** @type {string | null} */ (null));
  const [visitPrepSaving, setVisitPrepSaving] = useState(false);
  const [visitPrepSavedAt, setVisitPrepSavedAt] = useState(/** @type {Date | null} */ (null));
  const [visitPrepBottomFade, setVisitPrepBottomFade] = useState(false);
  const [summaryPanelClosing, setSummaryPanelClosing] = useState(false);

  const messagesEl = useRef(/** @type {HTMLDivElement | null} */ (null));
  const messagesContentEl = useRef(/** @type {HTMLDivElement | null} */ (null));
  const composerEl = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const summarizePendingSince = useRef(/** @type {number | null} */ (null));
  const lastPartialTextRef = useRef('');
  const scrollPinnedToBottomRef = useRef(true);
  const pendingAutoSendDoneRef = useRef(false);
  const sendMessageRef = useRef(/** @type {(text?: string) => Promise<void>} */ (async () => {}));
  const visitPrepTextareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const visitPrepAutosaveTimerRef = useRef(/** @type {number | null} */ (null));
  const saveVisitPrepRef = useRef(/** @type {() => Promise<boolean>} */ (async () => true));
  const visitPrepDirtyRef = useRef(false);
  const visitPrepSaveInFlightRef = useRef(/** @type {Promise<boolean> | null} */ (null));
  const summaryTabAnchorRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const summaryTabPageRootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [summaryTabTopPx, setSummaryTabTopPx] = useState(/** @type {number | null} */ (null));

  const visitPrepDirty = visitPrepDraft !== visitPrepSavedText;

  const syncSummaryTabTop = useCallback(() => {
    const el = summaryTabAnchorRef.current;
    if (!el) return;
    setSummaryTabTopPx(el.getBoundingClientRect().top);
  }, []);

  useLayoutEffect(() => {
    syncSummaryTabTop();
    window.addEventListener('resize', syncSummaryTabTop);
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncSummaryTabTop);
      const anchor = summaryTabAnchorRef.current;
      if (anchor) ro.observe(anchor);
      if (summaryTabPageRootRef.current) ro.observe(summaryTabPageRootRef.current);
    }
    return () => {
      window.removeEventListener('resize', syncSummaryTabTop);
      ro?.disconnect();
    };
  }, [syncSummaryTabTop, summarizeBanner]);

  useEffect(() => {
    visitPrepDirtyRef.current = visitPrepDirty;
  }, [visitPrepDirty]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    visitPrepListRef.current = visitPrepList;
  }, [visitPrepList]);

  useEffect(() => {
    visitPrepIdRef.current = visitPrepId;
  }, [visitPrepId]);

  useEffect(() => {
    setSummaryOverlayOpen(false);
  }, [activeChatId]);

  useEffect(() => {
    if (!prepDocumentHighlight) return undefined;
    const id = window.setTimeout(() => setPrepDocumentHighlight(false), PREP_DOCUMENT_HIGHLIGHT_MS);
    return () => window.clearTimeout(id);
  }, [prepDocumentHighlight]);

  const applyVisitPrepRecord = useCallback((chatId, rec, { highlightPanel = false } = {}) => {
    const id = typeof rec.id === 'string' ? rec.id : null;
    const text = typeof rec.text === 'string' ? rec.text : '';
    if (!id) return;
    markChatLinkedToPreVisitSummary(chatId);
    setVisitPrepId(id);
    setVisitPrepTitle(resolveVisitPrepTitle(rec));
    setVisitPrepDraft(text);
    setVisitPrepSavedText(text);
    const savedAtRaw = rec.updated_at ?? rec.created_at;
    setVisitPrepSavedAt(savedAtRaw ? new Date(String(savedAtRaw)) : new Date());
    setVisitPrepPanelError(null);
    writeVisitPrepChatEntry(chatId, { id, text });
    if (highlightPanel && text.trim()) {
      setPrepDocumentHighlight(true);
    }
  }, []);

  const loadVisitPrepById = useCallback(
    async (chatId, prepId) => {
      setVisitPrepId(null);
      setVisitPrepTitle('');
      setVisitPrepDraft('');
      setVisitPrepSavedText('');
      setVisitPrepSavedAt(null);
      setVisitPrepPanelError(null);
      const res = await getVisitPrep(prepId);
      if (!res.ok) {
        if (res.status === 404) return;
        setVisitPrepPanelError(res.message);
        return;
      }
      applyVisitPrepRecord(chatId, res.data);
    },
    [applyVisitPrepRecord],
  );

  const loadVisitPrepForChat = useCallback(
    async (chatId, preferredPrepId) => {
      const latest = latestVisitPrepForChat(visitPrepListRef.current, chatId);
      const prepId =
        preferredPrepId ||
        (typeof latest?.id === 'string' ? latest.id : null) ||
        readVisitPrepChatMap()[chatId]?.id;
      if (!prepId) return;
      await loadVisitPrepById(chatId, prepId);
    },
    [loadVisitPrepById],
  );

  const baseMessages = useMemo(() => normalizeMessages(session?.messages), [session]);

  const linkedChatTitle = useMemo(() => {
    if (visitPrepTitlePoll) return 'Generating title…';
    if (visitPrepTitle) return visitPrepTitle;
    if (activeChatId) return VISIT_PREP_DEFAULT_TITLE;
    return 'New pre-visit summary';
  }, [activeChatId, visitPrepTitle, visitPrepTitlePoll]);

  const displayMessages = useMemo(() => {
    if (!pendingUserEcho) return baseMessages;
    const last = baseMessages[baseMessages.length - 1];
    if (last && last.role === 'user' && last.content === pendingUserEcho) return baseMessages;
    return [...baseMessages, { role: 'user', content: pendingUserEcho }];
  }, [baseMessages, pendingUserEcho]);

  const firstAssistantMessageIndex = useMemo(
    () => displayMessages.findIndex((m) => m.role === 'assistant'),
    [displayMessages],
  );

  const showAttachPatientVisitCta =
    !!visitPrepId && !!visitPrepSavedText.trim() && !visitPrepSaving;

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
      setLoadingSession(false);
      if (!res.ok) {
        if (res.status === 404) {
          setPageError('This chat was not found or you no longer have access.');
          setSession(null);
          void refreshVisitPrepList();
          setActiveChatId(null);
          setVisitPrepTitlePoll(null);
          setSearchParams({}, { replace: true });
          return;
        }
        if (res.code && String(res.code).includes('SUMMARIZE')) {
          setSummarizeBanner('api');
        }
        setPageError(res.message);
        return;
      }
      const sess = /** @type {Record<string, unknown>} */ (res.data.session);
      setSession(sess || null);
      void loadVisitPrepForChat(chatId);
      if (sess?.summarize_pending) {
        summarizePendingSince.current = Date.now();
      } else {
        summarizePendingSince.current = null;
        setSummarizeBanner(null);
      }
    },
    [loadVisitPrepForChat, refreshVisitPrepList, setSearchParams],
  );

  useEffect(() => {
    if (!activeChatId) {
      setSession(null);
      setVisitPrepId(null);
      setVisitPrepTitle('');
      setVisitPrepDraft('');
      setVisitPrepSavedText('');
      setVisitPrepSavedAt(null);
      setVisitPrepPanelError(null);
      return;
    }
    loadSession(activeChatId);
  }, [activeChatId, loadSession]);

  // loadSession may run before useVisitPrepSidebar finishes listing preps; retry once ids are known.
  useEffect(() => {
    if (!activeChatId || visitPrepIdRef.current) return;
    void loadVisitPrepForChat(activeChatId);
  }, [activeChatId, visitPrepList, loadVisitPrepForChat]);

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
  }, [activeChatId, session?.summarize_pending]);

  useEffect(() => {
    if (!visitPrepTitlePoll || visitPrepTitlePoll.chatId !== activeChatId) return undefined;
    let cancelled = false;
    const { chatId, jobId, visitPrepId: pollPrepId } = visitPrepTitlePoll;

    const run = async () => {
      const res = await novaPollVisitPrepTitleDetails(chatId, jobId);
      if (cancelled) return;
      if (!res.ok) {
        setVisitPrepTitlePoll(null);
        return;
      }
      const prepId = pollPrepId ?? visitPrepIdRef.current;
      if (!prepId) {
        setVisitPrepTitlePoll(null);
        return;
      }
      const title = composeVisitPrepSessionTitle(res.data);
      const patchRes = await patchVisitPrep(prepId, { title });
      if (cancelled) return;
      if (patchRes.ok) {
        const savedTitle = resolveVisitPrepTitle(patchRes.data);
        syncVisitPrepInList(patchRes.data);
        if (visitPrepIdRef.current === prepId) {
          setVisitPrepTitle(savedTitle);
        }
        void refreshVisitPrepList();
      }
      setVisitPrepTitlePoll(null);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeChatId, refreshVisitPrepList, syncVisitPrepInList, visitPrepTitlePoll]);

  const saveLinkedChatTitle = useCallback(
    async (title) => {
      const prepId = visitPrepIdRef.current;
      if (!prepId) {
        throw new Error('No active pre-visit summary');
      }
      const trimmed = title.trim();
      if (!trimmed) {
        throw new Error('Title cannot be empty');
      }
      const res = await patchVisitPrep(prepId, { title: trimmed });
      if (!res.ok) {
        throw new Error(res.message || 'Could not save title');
      }
      const savedTitle = resolveVisitPrepTitle(res.data);
      syncVisitPrepInList(res.data);
      setVisitPrepTitle(savedTitle);
      setVisitPrepTitlePoll(null);
      void refreshVisitPrepList();
    },
    [refreshVisitPrepList, syncVisitPrepInList],
  );

  const linkedChatTitleEditable = !!visitPrepId && !visitPrepTitlePoll;

  const dismissZoneHint = useCallback(() => {
    dismissVisitPrepZoneHint();
    setZoneHintDismissed(true);
  }, []);

  const revertVisitPrep = useCallback(() => {
    setVisitPrepDraft(visitPrepSavedText);
    setVisitPrepPanelError(null);
  }, [visitPrepSavedText]);

  const clearVisitPrepAutosaveTimer = useCallback(() => {
    if (visitPrepAutosaveTimerRef.current != null) {
      window.clearTimeout(visitPrepAutosaveTimerRef.current);
      visitPrepAutosaveTimerRef.current = null;
    }
  }, []);

  const triggerVisitPrepAutosave = useCallback(() => {
    if (!visitPrepDirtyRef.current) return;
    void saveVisitPrepRef.current();
  }, []);

  const scheduleVisitPrepAutosaveTimer = useCallback(() => {
    clearVisitPrepAutosaveTimer();
    visitPrepAutosaveTimerRef.current = window.setTimeout(() => {
      visitPrepAutosaveTimerRef.current = null;
      if (document.activeElement === visitPrepTextareaRef.current) {
        triggerVisitPrepAutosave();
      }
    }, VISIT_PREP_AUTOSAVE_IDLE_MS);
  }, [clearVisitPrepAutosaveTimer, triggerVisitPrepAutosave]);

  const onVisitPrepDraftChange = useCallback(
    (/** @type {React.ChangeEvent<HTMLTextAreaElement>} */ e) => {
      setVisitPrepDraft(e.target.value);
      if (document.activeElement === visitPrepTextareaRef.current) {
        scheduleVisitPrepAutosaveTimer();
      }
    },
    [scheduleVisitPrepAutosaveTimer],
  );

  const onVisitPrepFocus = useCallback(() => {
    scheduleVisitPrepAutosaveTimer();
  }, [scheduleVisitPrepAutosaveTimer]);

  const onVisitPrepBlur = useCallback(() => {
    clearVisitPrepAutosaveTimer();
    triggerVisitPrepAutosave();
  }, [clearVisitPrepAutosaveTimer, triggerVisitPrepAutosave]);

  useEffect(() => () => clearVisitPrepAutosaveTimer(), [clearVisitPrepAutosaveTimer]);

  const updateVisitPrepBottomFade = useCallback(() => {
    const el = visitPrepTextareaRef.current;
    if (!el) {
      setVisitPrepBottomFade(false);
      return;
    }
    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 4;
    setVisitPrepBottomFade(hasOverflow && !atBottom);
  }, []);

  useEffect(() => {
    updateVisitPrepBottomFade();
    const el = visitPrepTextareaRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', updateVisitPrepBottomFade, { passive: true });
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateVisitPrepBottomFade);
      ro.observe(el);
    }
    return () => {
      el.removeEventListener('scroll', updateVisitPrepBottomFade);
      ro?.disconnect();
    };
  }, [updateVisitPrepBottomFade, visitPrepDraft]);

  const saveVisitPrep = useCallback(async () => {
    if (visitPrepSaveInFlightRef.current) {
      return visitPrepSaveInFlightRef.current;
    }
    if (!visitPrepDirtyRef.current) {
      if (!visitPrepId) return false;
      return { ok: true, id: visitPrepId, text: visitPrepSavedText };
    }

    const run = (async () => {
      setVisitPrepSaving(true);
      setVisitPrepPanelError(null);
      try {
        if (visitPrepId) {
          const res = await patchVisitPrep(visitPrepId, { text: visitPrepDraft });
          if (!res.ok) {
            setVisitPrepPanelError(res.message);
            return false;
          }
          const text = typeof res.data.text === 'string' ? res.data.text : visitPrepDraft;
          setVisitPrepDraft(text);
          setVisitPrepSavedText(text);
          setVisitPrepSavedAt(new Date());
          if (activeChatIdRef.current) {
            writeVisitPrepChatEntry(activeChatIdRef.current, { id: visitPrepId, text });
          }
          return { ok: true, id: visitPrepId, text };
        }
        const chatId = activeChatIdRef.current;
        if (!chatId) {
          setVisitPrepPanelError('Open a pre-visit summary chat before saving.');
          return false;
        }
        const res = await createVisitPrep({ chat_id: chatId, text: visitPrepDraft });
        if (!res.ok) {
          setVisitPrepPanelError(res.message);
          return false;
        }
        const id = typeof res.data.id === 'string' ? res.data.id : null;
        const text = typeof res.data.text === 'string' ? res.data.text : visitPrepDraft;
        if (!id) {
          setVisitPrepPanelError('Server did not return a pre-visit summary id.');
          return false;
        }
        setVisitPrepId(id);
        visitPrepIdRef.current = id;
        setVisitPrepTitle(resolveVisitPrepTitle(res.data));
        setVisitPrepDraft(text);
        setVisitPrepSavedText(text);
        setVisitPrepSavedAt(new Date());
        if (activeChatIdRef.current) {
          writeVisitPrepChatEntry(activeChatIdRef.current, { id, text });
        }
        markChatLinkedToPreVisitSummary(chatId);
        void refreshVisitPrepList();
        return { ok: true, id, text };
      } finally {
        setVisitPrepSaving(false);
        visitPrepSaveInFlightRef.current = null;
      }
    })();

    visitPrepSaveInFlightRef.current = run;
    return run;
  }, [refreshVisitPrepList, visitPrepDraft, visitPrepId, visitPrepSavedText]);

  const flushSaveAndCloseSummaryPanel = useCallback(
    async (close) => {
      if (summaryPanelClosing) return;

      clearVisitPrepAutosaveTimer();
      visitPrepTextareaRef.current?.blur();

      if (!visitPrepDirtyRef.current && !visitPrepSaveInFlightRef.current) {
        close();
        return;
      }

      setSummaryPanelClosing(true);
      try {
        const saved = await saveVisitPrep();
        if (saved) {
          close();
        }
      } finally {
        setSummaryPanelClosing(false);
      }
    },
    [clearVisitPrepAutosaveTimer, saveVisitPrep, summaryPanelClosing],
  );

  const requestCloseSummaryOverlay = useCallback(
    () => void flushSaveAndCloseSummaryPanel(() => setSummaryOverlayOpen(false)),
    [flushSaveAndCloseSummaryPanel],
  );

  const proceedToPatientVisit = useCallback(async () => {
    if (summaryPanelClosing) return;

    clearVisitPrepAutosaveTimer();
    visitPrepTextareaRef.current?.blur();

    setSummaryPanelClosing(true);
    try {
      const saved = await saveVisitPrep();
      if (saved && typeof saved === 'object' && saved.ok) {
        navigate('/active-recording', {
          state: buildActiveRecordingNavState({
            id: saved.id,
            title: linkedChatTitle,
          }),
        });
      }
    } finally {
      setSummaryPanelClosing(false);
    }
  }, [
    clearVisitPrepAutosaveTimer,
    linkedChatTitle,
    navigate,
    saveVisitPrep,
    summaryPanelClosing,
  ]);

  useEffect(() => {
    saveVisitPrepRef.current = saveVisitPrep;
  }, [saveVisitPrep]);

  const startPatientVisitDisabled =
    !(visitPrepSavedText.trim() || visitPrepDraft.trim()) ||
    visitPrepSaving ||
    summaryPanelClosing;

  const openProceedToVisitOverlay = useCallback(() => {
    if (startPatientVisitDisabled) return;
    setSummaryOverlayOpen(true);
  }, [startPatientVisitDisabled]);

  const visitPrepSavedLabel = useMemo(() => {
    if (visitPrepSaving || summaryPanelClosing) return 'Saving…';
    if (visitPrepDirty || !visitPrepSavedAt) return null;
    const at = formatVisitPrepSavedAt(visitPrepSavedAt);
    return at ? `Saved ${at}` : null;
  }, [visitPrepDirty, visitPrepSavedAt, visitPrepSaving, summaryPanelClosing]);

  const summaryOverlayPanelProps = useMemo(
    () => ({
      linkedChatTitle,
      linkedChatTitleEditable,
      onSaveLinkedChatTitle: saveLinkedChatTitle,
      onRequestClose: () => void requestCloseSummaryOverlay(),
      closeBusy: summaryPanelClosing,
      closeDisabled: visitPrepSaving && !summaryPanelClosing,
      zoneHintDismissed,
      onDismissZoneHint: dismissZoneHint,
      prepDocumentHighlight,
      visitPrepDirty,
      visitPrepSavedLabel,
      visitPrepDraft,
      onVisitPrepDraftChange,
      onVisitPrepFocus,
      onVisitPrepBlur,
      visitPrepBottomFade,
      onVisitPrepScroll: updateVisitPrepBottomFade,
      visitPrepTextareaRef,
      onSaveVisitPrep: () => void saveVisitPrep(),
      visitPrepSaving,
      visitPrepPanelError,
      onConfirmStartPatientVisit: () => void proceedToPatientVisit(),
      confirmStartPatientVisitDisabled: startPatientVisitDisabled,
      confirmStartPatientVisitBusy: summaryPanelClosing,
      confirmStartPatientVisitDisabledTitle: visitPrepSaving
        ? 'Saving your pre-visit summary…'
        : 'Your pre-visit summary will appear here after Nova generates it',
    }),
    [
      linkedChatTitle,
      linkedChatTitleEditable,
      saveLinkedChatTitle,
      requestCloseSummaryOverlay,
      summaryPanelClosing,
      visitPrepSaving,
      zoneHintDismissed,
      dismissZoneHint,
      prepDocumentHighlight,
      visitPrepDirty,
      visitPrepSavedLabel,
      visitPrepDraft,
      onVisitPrepDraftChange,
      onVisitPrepFocus,
      onVisitPrepBlur,
      visitPrepBottomFade,
      updateVisitPrepBottomFade,
      saveVisitPrep,
      visitPrepPanelError,
      proceedToPatientVisit,
      startPatientVisitDisabled,
    ],
  );

  const onModelChange = useCallback((e) => {
    const v = e.target.value;
    if (NOVA_MODEL_PRESETS.includes(/** @type {*} */ (v))) {
      setModelPreset(v);
      writeSavedModelPreset(v);
    }
  }, []);

  const sendMessage = useCallback(async (messageOverride) => {
    const text = (typeof messageOverride === 'string' ? messageOverride : draft).trim();
    if (!text || isSending) return;

    let chatId = activeChatId;
    const firstTurn = !chatId || isFirstVisitPrepTurn(sessionRef.current);

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
    let terminalJobId = /** @type {string | null} */ (null);
    const clientMessageId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const applyVisitPrepFromPoll = (/** @type {Record<string, unknown>} */ data) => {
      const embedded =
        data.pre_visit_summary && typeof data.pre_visit_summary === 'object'
          ? /** @type {Record<string, unknown>} */ (data.pre_visit_summary)
          : null;
      const prepId =
        typeof data.pre_visit_summary_id === 'string'
          ? data.pre_visit_summary_id
          : typeof embedded?.id === 'string'
            ? embedded.id
            : null;
      if (embedded && prepId) {
        const prepText = typeof embedded.text === 'string' ? embedded.text : '';
        const hadPrep = !!visitPrepIdRef.current;
        applyVisitPrepRecord(
          chatId,
          { ...embedded, id: prepId },
          { highlightPanel: !hadPrep && prepText.trim().length > 0 },
        );
      }
    };

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
      applyVisitPrepFromPoll(data);
      if (firstTurn && typeof data.id === 'string') {
        setVisitPrepTitlePoll({
          chatId,
          jobId: data.id,
          visitPrepId: visitPrepIdRef.current,
        });
      }
      void refreshVisitPrepList();
    };

    const handleVisitPrepPersistFailed = (/** @type {Record<string, unknown>} */ data) => {
      const errMsg =
        typeof data.error === 'string' ? data.error : 'Pre-visit summary could not be saved.';
      setVisitPrepPanelError(errMsg);
      const sess = /** @type {Record<string, unknown>} */ (data.session);
      if (sess) {
        setSession(sess);
      }
      setPendingUserEcho(null);
      setInFlightPartial(null);
      setFailedPartialTurn(null);
      lastPartialTextRef.current = '';
      if (firstTurn && typeof data.id === 'string') {
        setVisitPrepTitlePoll({
          chatId,
          jobId: data.id,
          visitPrepId: visitPrepIdRef.current,
        });
      }
      void refreshVisitPrepList();
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
      }

      const completionPayload = {
        model: firstTurn ? 'sonnet' : modelPreset,
        message: text,
        client_message_id: clientMessageId,
        ...(firstTurn ? { extract_title_details: true } : {}),
      };

      const postRes = firstTurn
        ? await novaPostCompletionAndSaveVisitPrep(chatId, completionPayload, ctrl.signal)
        : await novaPostCompletion(chatId, completionPayload, ctrl.signal);

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
        if (postData.code === 'PRE_VISIT_SUMMARY_PERSIST_FAILED') {
          handleVisitPrepPersistFailed(postData);
          return;
        }
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
      terminalJobId = jobId;
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
        if (pollData.code === 'PRE_VISIT_SUMMARY_PERSIST_FAILED') {
          handleVisitPrepPersistFailed({ ...pollData, id: jobId });
          return;
        }
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
        applyTerminalCompletion({ ...pollData, id: jobId ?? terminalJobId });
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
    applyVisitPrepRecord,
    draft,
    isNearBottom,
    isSending,
    modelPreset,
    refreshVisitPrepList,
    setSearchParams,
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

  const onComposerChange = useCallback((e) => {
    setDraft(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, NOVA_COMPOSER_MAX_HEIGHT_PX);
    el.style.height = `${Math.max(next, NOVA_COMPOSER_MIN_HEIGHT_PX)}px`;
  }, []);

  useEffect(() => {
    syncComposerHeight();
  }, [draft, syncComposerHeight]);

  sendMessageRef.current = sendMessage;

  useEffect(() => {
    if (pendingAutoSendDoneRef.current || chatIdFromUrl || !api.getJWT()) return;
    let message = '';
    try {
      message = sessionStorage.getItem(SESSION_KEYS.novaVisitPrepPendingMessage) ?? '';
      if (!message.trim()) return;
      sessionStorage.removeItem(SESSION_KEYS.novaVisitPrepPendingMessage);
    } catch {
      return;
    }
    pendingAutoSendDoneRef.current = true;
    void sendMessageRef.current(message);
  }, [chatIdFromUrl]);

  return (
    <>
      <Auth />
      <div ref={summaryTabPageRootRef} className="flex h-[var(--mobile-viewport-height)] min-h-0 flex-col bg-gray-50 lg:h-[100dvh]">
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
            className="ml-3 font-bold underline"
            onClick={() => setSummarizeBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <VisitPrepPageShell>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <VisitPrepChatPanelHeader
            summaryTitle={linkedChatTitle}
            summaryTitleEditable={linkedChatTitleEditable}
            onSaveSummaryTitle={saveLinkedChatTitle}
            homeHref="/pre-visit-summary"
          />

          {pageError && (
              <div className="shrink-0 border-b border-red-100 bg-red-50">
                <p className={`${visitPrepChatColumnClass} py-2 ${NOVA_CHAT_BODY_TEXT} text-red-800`}>
                  {pageError}
                </p>
              </div>
            )}

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              ref={summaryTabAnchorRef}
              className="pointer-events-none absolute right-0 top-4 h-px w-px"
              aria-hidden
            />
            {showAttachPatientVisitCta ? (
              <VisitPrepSummaryAttachPatientVisitEdgeTab
                top={summaryTabTopPx}
                onClick={() => void openProceedToVisitOverlay()}
              />
            ) : null}
            <div
                ref={messagesEl}
                onScroll={updateScrollAwayFromBottom}
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <div ref={messagesContentEl} className={`${visitPrepChatMessagesColumnClass} space-y-4 py-4`}>
                  {loadingSession && activeChatId && (
                    <p className={`text-center ${NOVA_CHAT_META_TEXT} text-gray-500`}>
                      Loading conversation…
                    </p>
                  )}
                  {!loadingSession && displayMessages.length === 0 && !isSending && (
                    <p className={`text-center ${NOVA_CHAT_BODY_TEXT} leading-relaxed text-gray-500`}>
                      Nova drafts your pre-visit summary from the charts you provided. Follow-up questions and
                      refinements appear here.
                    </p>
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
                      <React.Fragment key={`msg-${idx}`}>
                        <div
                          className={`flex ${isUser ? 'justify-end' : 'w-full justify-start'}`}
                        >
                          <div
                            className={`${isAssistant ? 'px-0 py-1' : 'rounded-2xl px-4 py-2.5 shadow-sm'} ${NOVA_CHAT_BODY_TEXT} leading-relaxed ${
                              isUser
                                ? `${userBubbleMaxClass} border border-white/25 bg-[#183278] text-white shadow-md ring-2 ring-white/35 ring-offset-2 ring-offset-gray-50${isTailOptimistic ? ' opacity-95' : ''}`
                                : isSystem
                                  ? `${bubbleMaxClass} border border-amber-200 bg-amber-50 text-amber-950`
                                  : isAssistant
                                    ? 'w-full bg-transparent text-gray-900'
                                    : `${bubbleMaxClass} border border-gray-200 bg-white text-gray-900`
                            }`}
                          >
                            {!isAssistant ? (
                              <div
                                className={`mb-1 ${NOVA_CHAT_META_TEXT} font-semibold uppercase tracking-wide opacity-70`}
                              >
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
                        {showAttachPatientVisitCta && isAssistant && idx === firstAssistantMessageIndex ? (
                          <VisitPrepSummaryAttachPatientVisitCta
                            onClick={() => void openProceedToVisitOverlay()}
                          />
                        ) : null}
                      </React.Fragment>
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
                  <ChevronScrollIcon />
                </button>
              )}
            </div>

            <footer className="relative z-10 shrink-0 bg-gray-50 pb-2 pt-1">
              <div className={`${visitPrepChatMessagesColumnClass} relative ${visitPrepChatFooterFadeShadowClass}`}>
                {completionError && (
                  <div
                    className={`mb-2 rounded-lg bg-red-100 px-3 py-2 ${NOVA_CHAT_BODY_TEXT} font-medium text-red-900`}
                  >
                    {completionError}
                  </div>
                )}
                <label htmlFor="nova-visit-prep-composer" className="sr-only">
                  Ask Nova a follow-up question
                </label>
                <div
                  className={`rounded-xl border border-gray-300 shadow-sm focus-within:border-[#183278] focus-within:ring-2 focus-within:ring-[#183278]/30 ${
                    isSending ? 'bg-gray-100' : 'bg-white'
                  }`}
                >
                  <textarea
                    ref={composerEl}
                    id="nova-visit-prep-composer"
                    rows={2}
                    value={draft}
                    onChange={onComposerChange}
                    onKeyDown={onComposerKeyDown}
                    disabled={isSending}
                    placeholder="Ask a follow-up question… (Enter to send, Shift+Enter for newline)"
                    className={`block w-full min-h-[3.5rem] max-h-[11rem] resize-none overflow-y-auto border-0 bg-transparent px-3 pt-2.5 pb-1 ${NOVA_CHAT_BODY_TEXT} text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-70`}
                  />
                  <div className="flex items-center justify-end gap-4 px-2 pb-2">
                    <div className="flex items-center gap-1">
                      <label
                        htmlFor="nova-visit-prep-model"
                        className={`${NOVA_CHAT_META_TEXT} shrink-0 font-medium uppercase tracking-wide leading-none text-gray-500`}
                      >
                        Model:
                      </label>
                      <Select
                        id="nova-visit-prep-model"
                        size="inline"
                        value={modelPreset}
                        onChange={onModelChange}
                        disabled={isSending}
                        title="Model (follow-up turns; turn 1 uses Sonnet)"
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
                      onClick={() => void sendMessage()}
                      disabled={isSending || !draft.trim()}
                      aria-label="Send follow-up question"
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
        </div>
      </VisitPrepPageShell>

      <VisitPrepSummaryMobileOverlay
        open={summaryOverlayOpen}
        closeBusy={summaryPanelClosing}
        onRequestClose={() => void requestCloseSummaryOverlay()}
      >
        <VisitPrepSummaryPanel
          {...summaryOverlayPanelProps}
          visitPrepTextareaRef={summaryOverlayOpen ? visitPrepTextareaRef : undefined}
        />
      </VisitPrepSummaryMobileOverlay>
    </div>
    </>
  );
}

export default PreVisitSummaryNovaChatPage;
