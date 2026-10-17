import React from 'react';
import EditableVisitPrepChatTitle from '@/components/visitPrep/EditableVisitPrepChatTitle.jsx';
import {
  VisitPrepDocumentHeader,
  VisitPrepSummaryPanelCloseButton,
  VisitPrepConfirmStartPatientVisitButton,
  visitPrepDocumentColumnClass,
  visitPrepDocumentColumnPaddingClass,
} from '@/components/visitPrep/VisitPrepPageShell.jsx';

function VisitPrepViewOnlyTitleBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-500">
      View only
    </span>
  );
}

/**
 * Shared pre-visit summary document panel — sidebar (desktop) and mobile overlay body.
 *
 * @param {{
 *   linkedChatTitle?: string;
 *   linkedChatTitleEditable?: boolean;
 *   onSaveLinkedChatTitle?: (title: string) => void | Promise<void>;
 *   onRequestClose?: () => void;
 *   closeBusy?: boolean;
 *   closeDisabled?: boolean;
 *   zoneHintDismissed?: boolean;
 *   onDismissZoneHint?: () => void;
 *   prepDocumentHighlight?: boolean;
 *   visitPrepDirty?: boolean;
 *   visitPrepSavedLabel?: string | null;
 *   visitPrepDraft?: string;
 *   onVisitPrepDraftChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
 *   onVisitPrepFocus?: () => void;
 *   onVisitPrepBlur?: () => void;
 *   visitPrepBottomFade?: boolean;
 *   onVisitPrepScroll?: () => void;
 *   visitPrepTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
 *   onSaveVisitPrep?: () => void;
 *   visitPrepSaving?: boolean;
 *   visitPrepPanelError?: string | null;
 *   onConfirmStartPatientVisit?: () => void;
 *   confirmStartPatientVisitDisabled?: boolean;
 *   confirmStartPatientVisitBusy?: boolean;
 *   confirmStartPatientVisitDisabledTitle?: string;
 *   confirmStartPatientVisitLabel?: string;
 *   confirmStartPatientVisitAriaLabel?: string;
 *   confirmStartPatientVisitTitle?: string;
 *   confirmStartPatientVisitIcon?: React.ReactNode;
 *   hideDocumentHeader?: boolean;
 *   documentTitleAction?: React.ReactNode;
 *   documentHeaderBorderless?: boolean;
 *   documentHeaderPaddingClass?: string;
 *   documentSurfaceClass?: string;
 *   mode?: 'edit' | 'view';
 * }} props
 */
export default function VisitPrepSummaryPanel({
  linkedChatTitle,
  linkedChatTitleEditable = false,
  onSaveLinkedChatTitle,
  onRequestClose,
  closeBusy = false,
  closeDisabled = false,
  zoneHintDismissed = true,
  onDismissZoneHint,
  prepDocumentHighlight = false,
  visitPrepDirty = false,
  visitPrepSavedLabel = null,
  visitPrepDraft = '',
  onVisitPrepDraftChange,
  onVisitPrepFocus,
  onVisitPrepBlur,
  visitPrepBottomFade = false,
  onVisitPrepScroll,
  visitPrepTextareaRef,
  onSaveVisitPrep,
  visitPrepSaving = false,
  visitPrepPanelError = null,
  onConfirmStartPatientVisit,
  confirmStartPatientVisitDisabled = false,
  confirmStartPatientVisitBusy = false,
  confirmStartPatientVisitDisabledTitle,
  confirmStartPatientVisitLabel,
  confirmStartPatientVisitAriaLabel,
  confirmStartPatientVisitTitle,
  confirmStartPatientVisitIcon,
  hideDocumentHeader = false,
  documentTitleAction = null,
  documentHeaderBorderless = false,
  documentHeaderPaddingClass,
  documentSurfaceClass = 'bg-white',
  mode = 'edit',
}) {
  const readOnly = mode === 'view';
  const closeTitle = closeBusy
    ? 'Saving your changes…'
    : closeDisabled
      ? 'Save in progress…'
      : 'Close pre-visit summary panel';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!hideDocumentHeader ? (
        <VisitPrepDocumentHeader
          title="Pre-Visit Summary"
          titleBadge={readOnly ? <VisitPrepViewOnlyTitleBadge /> : null}
          borderless={documentHeaderBorderless}
          paddingClass={documentHeaderPaddingClass}
          titleRowLayout={onConfirmStartPatientVisit || documentTitleAction ? 'overlay' : 'default'}
          titleAction={
            onConfirmStartPatientVisit ? (
              <VisitPrepConfirmStartPatientVisitButton
                onClick={onConfirmStartPatientVisit}
                disabled={confirmStartPatientVisitDisabled}
                busy={confirmStartPatientVisitBusy}
                disabledTitle={confirmStartPatientVisitDisabledTitle}
                label={confirmStartPatientVisitLabel}
                ariaLabel={confirmStartPatientVisitAriaLabel}
                confirmTitle={confirmStartPatientVisitTitle}
                icon={confirmStartPatientVisitIcon}
              />
            ) : (
              documentTitleAction
            )
          }
          trailing={
            onRequestClose ? (
              <VisitPrepSummaryPanelCloseButton
                onClick={onRequestClose}
                disabled={closeDisabled || closeBusy}
                title={closeTitle}
                label={closeBusy ? 'Saving pre-visit summary before close' : 'Close pre-visit summary panel'}
              />
            ) : null
          }
        />
      ) : null}

      {!zoneHintDismissed && !readOnly ? (
        <div
          className={`flex shrink-0 items-center justify-between gap-3 border-b border-[#183278]/10 bg-[#E8EEFB]/70 py-2 ${visitPrepDocumentColumnPaddingClass}`}
        >
          <p className="text-xs leading-snug text-[#183278] sm:text-sm">
            <span className="font-semibold">Nova AI</span>
            <span className="text-gray-600"> · </span>
            <span className="font-semibold">Your pre-visit summary is in this panel</span>
          </p>
          <button
            type="button"
            onClick={onDismissZoneHint}
            className="shrink-0 text-xs font-semibold text-[#183278] hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${documentSurfaceClass}`}>
        <div className={`${visitPrepDocumentColumnClass} flex min-h-0 flex-1 flex-col py-4`}>
          <div
            className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-md transition-[box-shadow,border-color] duration-500 ${
              prepDocumentHighlight
                ? 'border-[#183278] ring-2 ring-[#183278]/35 ring-offset-2 ring-offset-white'
                : visitPrepDirty
                  ? 'border-[#183278]/35'
                  : 'border-gray-200'
            }`}
          >
            {linkedChatTitle ? (
              <EditableVisitPrepChatTitle
                value={linkedChatTitle}
                editable={linkedChatTitleEditable && typeof onSaveLinkedChatTitle === 'function'}
                onSave={onSaveLinkedChatTitle ?? (async () => {})}
                merged
                className="shrink-0"
              />
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="relative min-h-0 flex-1">
                <textarea
                  ref={visitPrepTextareaRef}
                  value={visitPrepDraft}
                  onChange={onVisitPrepDraftChange}
                  onFocus={onVisitPrepFocus}
                  onBlur={onVisitPrepBlur}
                  onScroll={onVisitPrepScroll}
                  readOnly={readOnly}
                  aria-readonly={readOnly || undefined}
                  aria-label="Pre-visit summary document"
                  className="min-h-0 h-full w-full resize-none overflow-y-auto border-0 bg-transparent px-4 py-3 text-[15px] leading-relaxed text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-0 read-only:cursor-default read-only:text-gray-800"
                  placeholder="Your pre-visit summary will appear here after Nova generates it…"
                />
                {visitPrepBottomFade && readOnly ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent"
                  />
                ) : null}
              </div>
              {!readOnly ? (
                <div className="relative shrink-0">
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute inset-x-0 bottom-full h-7 bg-gradient-to-t from-white via-white/85 to-transparent transition-opacity duration-300 ease-out ${
                      visitPrepBottomFade ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <div className="flex items-center justify-end gap-2.5 border-t border-gray-200 bg-white px-3 py-1">
                    <span
                      className={`truncate text-[11px] font-medium leading-none text-gray-500 ${
                        visitPrepSavedLabel ? '' : 'invisible'
                      }`}
                      aria-live="polite"
                    >
                      {visitPrepSavedLabel || '\u00a0'}
                    </span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void onSaveVisitPrep?.()}
                      disabled={!visitPrepDirty || visitPrepSaving}
                      className={`inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-[11px] font-semibold leading-none transition-colors ${
                        visitPrepDirty && !visitPrepSaving
                          ? 'bg-[#183278]/12 text-[#183278] hover:bg-[#183278]/18'
                          : 'text-gray-400'
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {visitPrepSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {visitPrepPanelError ? (
            <p className="mt-2 text-xs leading-snug text-red-600" role="alert">
              {visitPrepPanelError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
