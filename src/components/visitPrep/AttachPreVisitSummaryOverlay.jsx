import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import IconVisitPrep from '@/components/IconVisitPrep.jsx';
import VisitPrepHomeRecentList from '@/components/visitPrep/VisitPrepHomeRecentList.jsx';
import PreVisitSummaryExplainer from '@/components/visitPrep/PreVisitSummaryExplainer.jsx';
import VisitPrepSummaryMobileOverlay from '@/components/visitPrep/VisitPrepSummaryMobileOverlay.jsx';
import VisitPrepSummaryPanel from '@/components/visitPrep/VisitPrepSummaryPanel.jsx';
import {
  VisitPrepSummaryPanelCloseButton,
  visitPrepDocumentColumnPaddingClass,
  visitPrepAttachOverlayHeaderPaddingClass,
} from '@/components/visitPrep/VisitPrepPageShell.jsx';
import { useVisitPrepSidebar } from '@/hooks/useVisitPrepSidebar.js';
import { getVisitPrep } from '@/lib/visitPrepsApi.js';
import { normalizeAttachedPreVisitSummaryRef } from '@/utils/visitPrepRecordingHandoff.js';
import { visitPrepIsLinkedToEncounter } from '@/utils/visitPrepsListResponse.js';

const ATTACH_OVERLAY_TITLE = 'Recent Pre-visit Summaries';
const INFO_OVERLAY_TITLE = 'Pre-visit Summaries';

const attachOverlayPrimaryButtonClass =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[#183278] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#142a66] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40 focus-visible:ring-offset-2';

const attachOverlaySecondaryButtonClass =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-[#183278]/25 bg-white px-4 py-2.5 text-sm font-semibold text-[#183278] transition hover:border-[#183278]/40 hover:bg-[#F9FAFF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/30 focus-visible:ring-offset-2';

/**
 * Shared title row for step 1 — title and optional subtitle.
 *
 * @param {{ subtitle?: string; title?: string; titleAction?: React.ReactNode }} props
 */
function AttachOverlayTitleRow({ subtitle, title = ATTACH_OVERLAY_TITLE, titleAction = null }) {
  return (
    <header className={`shrink-0 bg-white ${visitPrepAttachOverlayHeaderPaddingClass}`}>
      <div className="flex min-h-9 items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[1.35rem] leading-snug">
          <IconVisitPrep className="h-[1.15em] w-[1.15em] shrink-0 bg-[#183278]" />
          <h2 className="truncate font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="shrink-0">
          {titleAction ?? (
            <div aria-hidden className="invisible">
              <span className={attachOverlayPrimaryButtonClass}>Attach Pre-visit summary</span>
            </div>
          )}
        </div>
      </div>
      {subtitle ? (
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      ) : null}
    </header>
  );
}

const ATTACH_STEPS = [
  { id: 'pick', label: 'Choose summary' },
  { id: 'review', label: 'Review & attach' },
];

/** @param {import('@/utils/visitPrepRecordingHandoff.js').AttachedPreVisitSummaryRef} ref */
function attachedRefToPickerRow(ref) {
  return {
    visitPrepId: ref.id,
    chatId: '',
    title: ref.title,
    text: '',
  };
}

/**
 * Top nav row — step path and close (attach flow only).
 *
 * @param {{
 *   step: 'pick' | 'review';
 *   onGoToPick?: () => void;
 *   onClose: () => void;
 * }} props
 */
function AttachPreVisitSummaryNavRow({ step, onGoToPick, onClose }) {
  return (
    <nav
      aria-label="Attach pre-visit summary steps"
      className={`relative z-20 flex shrink-0 items-center gap-3 border-b border-[#183278]/10 bg-[#E8EEFB]/40 py-3 ${visitPrepDocumentColumnPaddingClass}`}
    >
      <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {ATTACH_STEPS.map((item, index) => {
          const isCurrent = step === item.id;
          const isPast = step === 'review' && item.id === 'pick';

          const stepClass = isCurrent
            ? 'border-[#183278] bg-[#183278] text-white shadow-sm'
            : isPast
              ? 'border-[#183278]/25 bg-white text-[#183278] hover:border-[#183278]/40 hover:bg-[#F9FAFF]'
              : 'border-transparent bg-white/70 text-gray-400';

          const stepContent = (
            <span
              className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-semibold leading-none transition ${stepClass}`}
            >
              <span
                aria-hidden
                className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  isCurrent
                    ? 'bg-white/20 text-white'
                    : isPast
                      ? 'bg-[#183278]/10 text-[#183278]'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {index + 1}
              </span>
              {item.label}
            </span>
          );

          return (
            <React.Fragment key={item.id}>
              {index > 0 ? (
                <li aria-hidden className="text-base font-medium text-[#183278]/35">
                  ›
                </li>
              ) : null}
              <li aria-current={isCurrent ? 'step' : undefined}>
                {isPast && onGoToPick ? (
                  <button
                    type="button"
                    onClick={onGoToPick}
                    className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/30"
                  >
                    {stepContent}
                  </button>
                ) : (
                  stepContent
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
      <VisitPrepSummaryPanelCloseButton onClick={onClose} />
    </nav>
  );
}

function AttachOverlayCloseRow({ onClose }) {
  return (
    <nav
      aria-label="Pre-visit summary overlay"
      className={`relative z-20 flex shrink-0 items-center justify-end border-b border-[#183278]/10 bg-[#E8EEFB]/40 py-3 ${visitPrepDocumentColumnPaddingClass}`}
    >
      <VisitPrepSummaryPanelCloseButton onClick={onClose} />
    </nav>
  );
}

const attachOverlayInlineLinkClass =
  'font-semibold text-[#183278] underline decoration-[#183278]/30 underline-offset-2 hover:text-[#14285F] hover:decoration-[#14285F]/40';

function PreVisitCannotAttachBanner({ onGoToActiveRecording }) {
  return (
    <div
      className={`shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 ${visitPrepDocumentColumnPaddingClass}`}
      role="status"
    >
      You cannot attach a Pre-visit Summary to a note that is already saved. Attach Pre-visit
      Summaries before the note is generated — for example, when{' '}
      <button type="button" onClick={onGoToActiveRecording} className={attachOverlayInlineLinkClass}>
        starting a new patient visit
      </button>
      .
    </div>
  );
}

/**
 * Two-step overlay: pick a recent pre-visit summary, review it, then attach for recording.
 * Also supports read-only view (`view-linked`) and informational list (`info`) modes.
 *
 * @param {{
 *   open: boolean;
 *   onRequestClose: () => void;
 *   onAttach?: (ref: import('@/utils/visitPrepRecordingHandoff.js').AttachedPreVisitSummaryRef) => void;
 *   attachedSummary?: import('@/utils/visitPrepRecordingHandoff.js').AttachedPreVisitSummaryRef | null;
 *   fullBleed?: boolean;
 *   onNewPrep?: () => void;
 *   onViewAllSummaries?: () => void;
 *   variant?: 'attach' | 'view-linked' | 'info';
 * }} props
 */
export default function AttachPreVisitSummaryOverlay({
  open,
  onRequestClose,
  onAttach,
  attachedSummary = null,
  fullBleed = false,
  onNewPrep,
  onViewAllSummaries,
  variant = 'attach',
}) {
  const navigate = useNavigate();
  const isAttachVariant = variant === 'attach';
  const isViewLinkedVariant = variant === 'view-linked';
  const isInfoVariant = variant === 'info';
  const [step, setStep] = useState(/** @type {'pick' | 'review'} */ ('pick'));
  const [selectedRow, setSelectedRow] = useState(
    /** @type {{ visitPrepId: string; chatId: string; title: string; text?: string } | null} */ (null),
  );
  const [reviewTextLoading, setReviewTextLoading] = useState(false);
  const [reviewTextError, setReviewTextError] = useState(/** @type {string | null} */ (null));
  const wasOpenRef = useRef(false);

  const {
    visitPrepList,
    sidebarRows,
    listLoading,
    listLoadingMore,
    listError,
    listTotal,
    visitPrepApiOffset,
    refreshVisitPrepList,
    loadMoreVisitPreps,
  } = useVisitPrepSidebar({ autoLoad: false });

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      setStep('pick');
      setSelectedRow(null);
      setReviewTextLoading(false);
      setReviewTextError(null);
      return;
    }

    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    if (isViewLinkedVariant && attachedSummary) {
      setSelectedRow(attachedRefToPickerRow(attachedSummary));
      setStep('review');
      return;
    }

    if (isInfoVariant) {
      setStep('pick');
      setSelectedRow(null);
      return;
    }

    if (attachedSummary) {
      setSelectedRow(attachedRefToPickerRow(attachedSummary));
      setStep('review');
      return;
    }

    setStep('pick');
    setSelectedRow(null);
  }, [open, attachedSummary, isInfoVariant, isViewLinkedVariant]);

  useEffect(() => {
    if (!open || step !== 'review' || !selectedRow?.visitPrepId) return;
    const existingText = typeof selectedRow.text === 'string' ? selectedRow.text.trim() : '';
    if (existingText) return;

    const ac = new AbortController();
    setReviewTextLoading(true);
    setReviewTextError(null);

    void (async () => {
      const res = await getVisitPrep(selectedRow.visitPrepId, ac.signal);
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setReviewTextError(res.message);
        setReviewTextLoading(false);
        return;
      }
      const text = typeof res.data.text === 'string' ? res.data.text : '';
      const alreadyUsedForVisit = visitPrepIsLinkedToEncounter(res.data);
      setSelectedRow((prev) =>
        prev && prev.visitPrepId === selectedRow.visitPrepId
          ? { ...prev, text, alreadyUsedForVisit }
          : prev,
      );
      setReviewTextLoading(false);
    })();

    return () => ac.abort();
  }, [open, step, selectedRow?.visitPrepId, selectedRow?.text]);

  useEffect(() => {
    if (!open || step !== 'pick' || isViewLinkedVariant) return;
    void refreshVisitPrepList();
  }, [open, step, refreshVisitPrepList, isViewLinkedVariant]);

  const homeRows = useMemo(() => {
    const textByVisitPrepId = new Map(
      visitPrepList
        .map((row) => {
          const visitPrepId = typeof row.id === 'string' ? row.id : null;
          const text = typeof row.text === 'string' ? row.text : '';
          return visitPrepId ? [visitPrepId, { text, row }] : null;
        })
        .filter(Boolean),
    );
    return sidebarRows.map((row) => {
      const entry = textByVisitPrepId.get(row.visitPrepId);
      const listRow = entry?.row;
      return {
        ...row,
        text: entry?.text ?? '',
        alreadyUsedForVisit: listRow ? visitPrepIsLinkedToEncounter(listRow) : false,
      };
    });
  }, [sidebarRows, visitPrepList]);

  const handlePickRow = useCallback((row) => {
    const text = typeof row.text === 'string' ? row.text.trim() : '';
    if (!text || row.alreadyUsedForVisit) return;
    setSelectedRow(row);
    setStep('review');
  }, []);

  const handleAttach = useCallback(() => {
    if (!isAttachVariant || !onAttach) return;
    if (!selectedRow || selectedRow.alreadyUsedForVisit) return;
    const ref = normalizeAttachedPreVisitSummaryRef({
      id: selectedRow.visitPrepId,
      title: selectedRow.title,
    });
    if (!ref) return;
    onAttach(ref);
    onRequestClose();
  }, [isAttachVariant, onAttach, onRequestClose, selectedRow]);

  const handleClose = useCallback(() => {
    onRequestClose();
  }, [onRequestClose]);

  const goToPick = useCallback(() => {
    setStep('pick');
  }, []);

  const handleViewAllSummaries = useCallback(() => {
    if (onViewAllSummaries) {
      onViewAllSummaries();
      return;
    }
    onRequestClose();
    navigate('/pre-visit-summary');
  }, [navigate, onRequestClose, onViewAllSummaries]);

  const handleGoToActiveRecording = useCallback(() => {
    onRequestClose();
    navigate('/active-recording');
  }, [navigate, onRequestClose]);

  const attachSummaryButton = isAttachVariant ? (
    <button
      type="button"
      onClick={handleAttach}
      disabled={reviewTextLoading || selectedRow?.alreadyUsedForVisit}
      className={attachOverlayPrimaryButtonClass}
    >
      Attach Pre-visit summary
    </button>
  ) : null;

  const overlayTitle = isInfoVariant ? INFO_OVERLAY_TITLE : ATTACH_OVERLAY_TITLE;

  return (
    <VisitPrepSummaryMobileOverlay
      open={open}
      fullBleed={fullBleed}
      onRequestClose={handleClose}
    >
      <div className="flex h-full min-h-0 flex-col">
        {isAttachVariant ? (
          <AttachPreVisitSummaryNavRow
            step={step}
            onClose={handleClose}
            onGoToPick={step === 'review' ? goToPick : undefined}
          />
        ) : isInfoVariant ? (
          <>
            <AttachOverlayCloseRow onClose={handleClose} />
            <PreVisitCannotAttachBanner onGoToActiveRecording={handleGoToActiveRecording} />
          </>
        ) : null}

        {step === 'pick' ? (
          <>
            <AttachOverlayTitleRow
              title={overlayTitle}
              subtitle={
                isInfoVariant
                  ? undefined
                  : 'Choose a summary to attach to the patient visit.'
              }
              titleAction={
                <button
                  type="button"
                  onClick={handleViewAllSummaries}
                  className={
                    isInfoVariant
                      ? attachOverlayPrimaryButtonClass
                      : attachOverlaySecondaryButtonClass
                  }
                >
                  {isInfoVariant ? '+ New Pre-visit Summary' : 'View all summaries'}
                </button>
              }
            />
            {isInfoVariant ? (
              <div className={`shrink-0 pb-2 ${visitPrepDocumentColumnPaddingClass}`}>
                <PreVisitSummaryExplainer compact defaultExpanded attachStepOnly />
              </div>
            ) : null}

            {isInfoVariant ? (
              <div className={`shrink-0 pt-6 ${visitPrepDocumentColumnPaddingClass}`}>
                <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-500">
                  Recent pre-visit summaries
                </h3>
              </div>
            ) : null}

            {listError ? (
              <div className={`shrink-0 pt-3 ${visitPrepDocumentColumnPaddingClass}`}>
                <p className="text-sm text-red-600" role="alert">
                  {listError}
                </p>
                <button
                  type="button"
                  onClick={() => void refreshVisitPrepList()}
                  className="mt-2 text-xs font-semibold text-[#183278] underline"
                >
                  Retry
                </button>
              </div>
            ) : null}

            <div
              className={`min-h-0 flex-1 overflow-y-auto py-4 ${visitPrepDocumentColumnPaddingClass}`}
            >
              <VisitPrepHomeRecentList
                variant={isInfoVariant ? 'readonly' : 'picker'}
                rows={homeRows}
                listLoading={listLoading}
                listTotal={listTotal}
                visitPrepApiOffset={visitPrepApiOffset}
                listLoadingMore={listLoadingMore}
                onPickRow={isInfoVariant ? undefined : handlePickRow}
                onLoadMore={loadMoreVisitPreps}
                onNewPrep={onNewPrep}
              />
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {reviewTextError ? (
              <div className={`shrink-0 pt-3 ${visitPrepDocumentColumnPaddingClass}`}>
                <p className="text-sm text-red-600" role="alert">
                  {reviewTextError}
                </p>
              </div>
            ) : null}
            {isAttachVariant && selectedRow?.alreadyUsedForVisit ? (
              <div className={`shrink-0 pt-3 ${visitPrepDocumentColumnPaddingClass}`}>
                <p className="text-sm text-amber-800" role="status">
                  This pre-visit summary is already attached to a patient visit and cannot be attached again.
                </p>
              </div>
            ) : null}
            {reviewTextLoading ? (
              <p className={`shrink-0 py-3 text-sm text-gray-500 ${visitPrepDocumentColumnPaddingClass}`}>
                Loading summary…
              </p>
            ) : null}
            <VisitPrepSummaryPanel
              mode="view"
              linkedChatTitle={selectedRow?.title}
              visitPrepDraft={selectedRow?.text ?? ''}
              zoneHintDismissed
              onRequestClose={isViewLinkedVariant ? handleClose : undefined}
              documentTitleAction={attachSummaryButton}
              documentHeaderBorderless
              documentHeaderPaddingClass={visitPrepAttachOverlayHeaderPaddingClass}
            />
          </div>
        )}
      </div>
    </VisitPrepSummaryMobileOverlay>
  );
}
