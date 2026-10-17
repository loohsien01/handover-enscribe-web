import React, { useCallback, useState } from 'react';
import IconVisitPrep from '@/components/IconVisitPrep.jsx';
import VisitPrepExplainerStepCard from '@/components/visitPrep/VisitPrepExplainerStepCard.jsx';
import {
  EXPLAINER_OPTIONAL_STEPS,
  EXPLAINER_STEPS,
} from '@/components/visitPrep/visitPrepExplainerSteps.jsx';
import { STORAGE_KEYS } from '@/utils/storageConfig.js';

const EXPLAINER_GOT_IT_BUTTON_CLASS =
  'inline-flex shrink-0 items-center rounded-lg bg-[#183278] py-2.5 self-start px-6 text-sm font-semibold text-white transition hover:bg-[#142a66] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/30 focus-visible:ring-offset-2';

const EXPLAINER_COLLAPSED_TRIGGER_CLASS =
  'group inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-semibold text-[#183278] transition hover:bg-[#E8EEFB] hover:text-[#142a66] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/25 focus-visible:ring-offset-2';

const EXPLAINER_TITLE_BUTTON_CLASS =
  'inline-block rounded-md px-1.5 py-0.5 -ml-1.5 text-left text-sm font-semibold text-[#183278] transition hover:bg-[#E8EEFB] hover:text-[#142a66] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/30 focus-visible:ring-offset-2 sm:text-[0.9375rem]';

function ExplainerCollapsedChevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0 text-[#183278]/70 transition group-hover:text-[#142a66]"
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

const PRE_VISIT_SUMMARY_INTRO =
  "Pre-visit Summary uses Nova AI to summarize your patient's prior records. It helps you prepare for the visit, and improves the accuracy of your generated note.";

function readVisitPrepHomeExplainerCollapsed() {
  try {
    const stored = localStorage.getItem(
      STORAGE_KEYS.ui.visitPrepHomeExplainerCollapsed,
    );
    if (stored === '1' || stored === '0') {
      return stored === '1';
    }
    if (localStorage.getItem('enscribe_dismissedVisitPrepHomeExplainer_v1') === '1') {
      localStorage.setItem(STORAGE_KEYS.ui.visitPrepHomeExplainerCollapsed, '1');
      localStorage.removeItem('enscribe_dismissedVisitPrepHomeExplainer_v1');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function writeVisitPrepHomeExplainerCollapsed(collapsed) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.ui.visitPrepHomeExplainerCollapsed,
      collapsed ? '1' : '0',
    );
  } catch {
    /* ignore */
  }
}

/**
 * Collapsible explainer for what pre-visit summaries are and how they work.
 * Shared by the pre-visit summary home page and read-only info overlays.
 *
 * @param {{ compact?: boolean; defaultExpanded?: boolean; attachStepOnly?: boolean }} props
 */
export default function PreVisitSummaryExplainer({
  compact = false,
  defaultExpanded = false,
  attachStepOnly = false,
}) {
  const [collapsed, setCollapsed] = useState(() =>
    defaultExpanded ? false : readVisitPrepHomeExplainerCollapsed(),
  );

  const handleCollapse = useCallback(() => {
    if (!compact) {
      writeVisitPrepHomeExplainerCollapsed(true);
    }
    setCollapsed(true);
  }, [compact]);

  const handleExpand = useCallback(() => {
    if (!compact) {
      writeVisitPrepHomeExplainerCollapsed(false);
    }
    setCollapsed(false);
  }, [compact]);

  const collapsedMarginClass = compact ? 'mt-0' : 'mt-5';
  const expandedMarginClass = compact ? 'mt-0' : 'mt-6';

  if (collapsed) {
    return (
      <div className={collapsedMarginClass}>
        <button
          type="button"
          onClick={handleExpand}
          aria-expanded={false}
          aria-controls="pre-visit-summary-explainer-body"
          className={EXPLAINER_COLLAPSED_TRIGGER_CLASS}
        >
          <ExplainerCollapsedChevron />
          <span>
            What is a Pre-visit Summary?
            {!attachStepOnly ? (
              <span className="font-medium text-[#183278]/65 group-hover:text-[#142a66]/80">
                {' '}
                · How it works
              </span>
            ) : null}
          </span>
        </button>
      </div>
    );
  }

  return (
    <section
      className={`${expandedMarginClass} overflow-hidden rounded-xl border border-[#183278]/15 bg-gradient-to-br from-[#E8EEFB]/80 via-white to-[#F9FAFF] shadow-sm`}
      aria-labelledby="pre-visit-summary-explainer-title"
    >
      <div id="pre-visit-summary-explainer-body">
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              {attachStepOnly ? (
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E8EEFB] shadow-sm ring-1 ring-[#183278]/10"
                  aria-hidden
                >
                  <IconVisitPrep className="h-9 w-9" />
                </div>
              ) : null}
              <div className="min-w-0 flex-1 pr-1">
                {attachStepOnly ? (
                  <h3
                    id="pre-visit-summary-explainer-title"
                    className="text-sm font-semibold text-[#183278] sm:text-[0.9375rem]"
                  >
                    What is a Pre-visit Summary?
                  </h3>
                ) : (
                  <button
                    type="button"
                    id="pre-visit-summary-explainer-title"
                    onClick={handleCollapse}
                    aria-expanded={true}
                    aria-controls="pre-visit-summary-explainer-body"
                    className={EXPLAINER_TITLE_BUTTON_CLASS}
                  >
                    What is a Pre-visit Summary?
                  </button>
                )}
                <p className="mt-1.5 text-sm leading-relaxed text-gray-700">
                  {PRE_VISIT_SUMMARY_INTRO}
                </p>
              </div>
            </div>
            {!attachStepOnly ? (
              <button
                type="button"
                onClick={handleCollapse}
                aria-expanded={true}
                aria-controls="pre-visit-summary-explainer-body"
                className={EXPLAINER_GOT_IT_BUTTON_CLASS}
              >
                Got it
              </button>
            ) : null}
          </div>

          {!attachStepOnly ? (
            <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EXPLAINER_STEPS.map((step, index) => (
                <VisitPrepExplainerStepCard
                  key={step.title}
                  stepLabel={`Step ${index + 1}`}
                  title={step.title}
                  description={step.description}
                  icon={step.icon}
                />
              ))}
            </ol>
          ) : null}
        </div>

        {!attachStepOnly ? (
        <div className="border-t border-[#183278]/10 bg-[#F9FAFF]/80 px-4 py-4 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">
            During the visit
          </p>
          <ol className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {EXPLAINER_OPTIONAL_STEPS.map((step) => (
              <VisitPrepExplainerStepCard
                key={step.title}
                stepLabel="Step 4+"
                optionalTag
                title={step.title}
                description={step.description}
                icon={step.icon}
              />
            ))}
          </ol>
        </div>
        ) : null}
      </div>
    </section>
  );
}
