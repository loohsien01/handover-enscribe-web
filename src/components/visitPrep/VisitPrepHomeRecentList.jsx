import React, { useMemo, useState } from 'react';
import IconSpinner from '@/components/IconSpinner.jsx';
import IconTrash from '@/components/IconTrash.jsx';
import {
  VisitPrepAttachToEnscribeIcon,
  VisitPrepReviewSummaryIcon,
} from '@/components/visitPrep/visitPrepExplainerSteps.jsx';
import { partitionVisitPrepRowsByPatientVisitAttachment } from '@/utils/visitPrepsListResponse.js';

const ATTACHED_PATIENT_VISIT_GROUP_LABEL = 'Already attached to a patient visit';
const ATTACHED_PATIENT_VISIT_PREVIEW_LIMIT = 5;

const attachedPatientVisitRowSurfaceClass = 'bg-gray-100';
const attachedPatientVisitTitleClass = 'font-medium text-gray-400';
const activeRowTitleClass = 'font-semibold text-gray-900';

const visitPrepListCardClass = 'overflow-hidden rounded-xl border border-gray-200 bg-white';
const attachedPatientVisitSectionLabelClass =
  'mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-gray-500';

function PickerRowChevron() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0 text-gray-300 transition group-hover:text-[#183278]/70 group-disabled:text-gray-200"
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * @param {{
 *   rows: { visitPrepId: string; chatId: string; title: string; text?: string; alreadyUsedForVisit?: boolean }[];
 *   listLoading: boolean;
 *   listTotal: number;
 *   visitPrepApiOffset: number;
 *   listLoadingMore: boolean;
 *   variant?: 'default' | 'picker' | 'readonly';
 *   deletingVisitPrepId?: string | null;
 *   onSelect?: (chatId: string, visitPrepId: string) => void;
 *   onPickRow?: (row: { visitPrepId: string; chatId: string; title: string; text?: string; alreadyUsedForVisit?: boolean }) => void;
 *   onAttachToVisit?: (row: { visitPrepId: string; chatId: string; title: string; text?: string; alreadyUsedForVisit?: boolean }) => void;
 *   onDelete?: (row: { visitPrepId: string; chatId: string; title: string; text?: string; alreadyUsedForVisit?: boolean }) => void;
 *   onLoadMore: () => void;
 *   onNewPrep: () => void;
 * }} props
 */
export default function VisitPrepHomeRecentList({
  rows,
  listLoading,
  listTotal,
  visitPrepApiOffset,
  listLoadingMore,
  variant = 'default',
  deletingVisitPrepId = null,
  onSelect,
  onPickRow,
  onAttachToVisit,
  onDelete,
  onLoadMore,
  onNewPrep,
}) {
  const isPicker = variant === 'picker';
  const isReadonly = variant === 'readonly';
  const [showAllAttached, setShowAllAttached] = useState(false);
  const iconButtonClass =
    'rounded p-0.5 text-gray-400 transition hover:bg-[#E8EEFB] hover:text-[#183278] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400';

  const { available, attachedToPatientVisit } = useMemo(
    () => partitionVisitPrepRowsByPatientVisitAttachment(rows),
    [rows],
  );

  const attachedPreviewCollapsed =
    !showAllAttached && attachedToPatientVisit.length > ATTACHED_PATIENT_VISIT_PREVIEW_LIMIT;
  const visibleAttachedToPatientVisit = attachedPreviewCollapsed
    ? attachedToPatientVisit.slice(0, ATTACHED_PATIENT_VISIT_PREVIEW_LIMIT)
    : attachedToPatientVisit;
  const hiddenAttachedCount = attachedToPatientVisit.length - visibleAttachedToPatientVisit.length;

  const renderPickerRow = (row) => {
    const excerpt = typeof row.text === 'string' ? row.text.trim() : '';
    const alreadyUsedForVisit = !!row.alreadyUsedForVisit;
    const canAttach = excerpt.length > 0 && !alreadyUsedForVisit;
    const excerptOneLine = excerpt.replace(/\s+/g, ' ');

    return (
      <li key={row.visitPrepId}>
        <button
          type="button"
          disabled={!canAttach}
          onClick={() => onPickRow?.(row)}
          title={
            alreadyUsedForVisit
              ? `${row.title} — already attached to a patient visit`
              : canAttach
                ? `${row.title} — ${excerptOneLine}`
                : row.title
          }
          aria-label={
            alreadyUsedForVisit
              ? `${row.title} already attached to a patient visit`
              : canAttach
                ? `Review ${row.title}`
                : `No summary content for ${row.title}`
          }
          className={`group flex w-full items-center gap-3 px-4 py-3.5 text-left transition disabled:cursor-not-allowed ${
            alreadyUsedForVisit
              ? `${attachedPatientVisitRowSurfaceClass} disabled:opacity-100`
              : 'hover:bg-gray-50/80 disabled:hover:bg-transparent'
          }`}
        >
          <div className="min-w-0 flex-1">
            <span
              className={`block truncate text-[15px] leading-snug ${
                alreadyUsedForVisit ? attachedPatientVisitTitleClass : activeRowTitleClass
              }`}
            >
              {row.title}
            </span>
            {alreadyUsedForVisit ? (
              excerptOneLine ? (
                <span className="mt-1 block truncate text-sm leading-snug text-gray-400">
                  {excerptOneLine}
                </span>
              ) : null
            ) : canAttach ? (
              <span className="mt-1 block truncate text-sm leading-snug text-gray-500">
                {excerptOneLine}
              </span>
            ) : (
              <span className="mt-1 block truncate text-sm leading-snug text-gray-400">
                No summary content yet
              </span>
            )}
          </div>
          <PickerRowChevron />
        </button>
      </li>
    );
  };

  const renderReadonlyRow = (row) => {
    const excerpt = typeof row.text === 'string' ? row.text.trim() : '';
    const alreadyUsedForVisit = !!row.alreadyUsedForVisit;
    const excerptOneLine = excerpt.replace(/\s+/g, ' ');

    return (
      <li key={row.visitPrepId}>
        <div
          className={`px-4 py-3.5 ${
            alreadyUsedForVisit ? attachedPatientVisitRowSurfaceClass : ''
          }`}
        >
          <div className="min-w-0">
            <span
              className={`block truncate text-[15px] leading-snug ${
                alreadyUsedForVisit ? attachedPatientVisitTitleClass : activeRowTitleClass
              }`}
            >
              {row.title}
            </span>
            {alreadyUsedForVisit ? (
              excerptOneLine ? (
                <span className="mt-1 block truncate text-sm leading-snug text-gray-400">
                  {excerptOneLine}
                </span>
              ) : null
            ) : excerptOneLine ? (
              <span className="mt-1 block truncate text-sm leading-snug text-gray-500">
                {excerptOneLine}
              </span>
            ) : (
              <span className="mt-1 block truncate text-sm leading-snug text-gray-400">
                No summary content yet
              </span>
            )}
          </div>
        </div>
      </li>
    );
  };

  const renderDefaultRow = (row) => {
    const excerpt = typeof row.text === 'string' ? row.text.trim() : '';
    const alreadyUsedForVisit = !!row.alreadyUsedForVisit;
    const canAttach = excerpt.length > 0 && !alreadyUsedForVisit;
    const excerptOneLine = excerpt.replace(/\s+/g, ' ');
    const titleClass = alreadyUsedForVisit
      ? attachedPatientVisitTitleClass
      : activeRowTitleClass;
    const isDeleting = deletingVisitPrepId === row.visitPrepId;

    return (
      <li key={row.visitPrepId}>
        <div
          className={`px-4 pt-4 pb-1 transition ${
            alreadyUsedForVisit
              ? attachedPatientVisitRowSurfaceClass
              : 'hover:bg-gray-50/80'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2 mb-1.5">
            <button
              type="button"
              onClick={() => onSelect?.(row.chatId, row.visitPrepId)}
              className={`min-w-0 flex-1 truncate text-left text-[15px] leading-snug ${titleClass}`}
            >
              {row.title}
            </button>
            <div className="flex shrink-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => onSelect?.(row.chatId, row.visitPrepId)}
                title="Review the summary"
                aria-label={`Review ${row.title}`}
                className={iconButtonClass}
              >
                <VisitPrepReviewSummaryIcon size={16} />
              </button>
              {onAttachToVisit ? (
                <button
                  type="button"
                  onClick={() => onAttachToVisit(row)}
                  disabled={!canAttach}
                  title={
                    alreadyUsedForVisit
                      ? ATTACHED_PATIENT_VISIT_GROUP_LABEL
                      : canAttach
                        ? 'Attach to Patient Visit'
                        : 'Add summary content to attach to Patient Visit'
                  }
                  aria-label={
                    alreadyUsedForVisit
                      ? `${row.title} already attached to a patient visit`
                      : `Attach ${row.title} to Enscribe`
                  }
                  className={iconButtonClass}
                >
                  <VisitPrepAttachToEnscribeIcon size={16} />
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(row)}
                  disabled={!!deletingVisitPrepId}
                  title="Delete pre-visit summary"
                  aria-label={`Delete ${row.title}`}
                  className={`${iconButtonClass} hover:bg-red-50 hover:text-red-600 disabled:hover:bg-transparent disabled:hover:text-gray-400`}
                >
                  {isDeleting ? (
                    <IconSpinner className="h-4 w-4 animate-spin" />
                  ) : (
                    <IconTrash className="h-4 w-4" />
                  )}
                </button>
              ) : null}
            </div>
          </div>
          {excerptOneLine ? (
            <button
              type="button"
              onClick={() => onSelect?.(row.chatId, row.visitPrepId)}
              title={excerptOneLine}
              className={`mt-1.5 w-full min-w-0 text-left text-sm leading-snug ${
                alreadyUsedForVisit ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              <span className="block truncate">{excerptOneLine}</span>
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  const renderRow = (row) => {
    if (isPicker) return renderPickerRow(row);
    if (isReadonly) return renderReadonlyRow(row);
    return renderDefaultRow(row);
  };

  if (listLoading && rows.length === 0) {
    return (
      <p className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        Loading pre-visit summaries…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-gray-700">No pre-visit summaries yet</p>
        <p className="mt-1.5 text-sm text-gray-500">
          Create your first pre-visit summary from prior visit records and instructions for Nova.
        </p>
        <button
          type="button"
          onClick={onNewPrep}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[#183278] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#142a66]"
        >
          + New pre-visit summary
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {available.length > 0 ? (
        <div className={visitPrepListCardClass}>
          <ul className="divide-y divide-gray-100">{available.map(renderRow)}</ul>
        </div>
      ) : null}

      {attachedToPatientVisit.length > 0 ? (
        <section aria-label={ATTACHED_PATIENT_VISIT_GROUP_LABEL}>
          <h3 className={attachedPatientVisitSectionLabelClass}>
            {ATTACHED_PATIENT_VISIT_GROUP_LABEL}
          </h3>
          <div className={visitPrepListCardClass}>
            <ul className="divide-y divide-gray-100">
              {visibleAttachedToPatientVisit.map(renderRow)}
            </ul>
          </div>
          {attachedPreviewCollapsed ? (
            <button
              type="button"
              onClick={() => setShowAllAttached(true)}
              className="mt-2 w-full px-1 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
            >
              Load all ({hiddenAttachedCount} more)
            </button>
          ) : null}
        </section>
      ) : null}

      {listTotal > visitPrepApiOffset ? (
        <button
          type="button"
          onClick={() => void onLoadMore()}
          disabled={listLoadingMore}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-[#183278] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {listLoadingMore ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </div>
  );
}
