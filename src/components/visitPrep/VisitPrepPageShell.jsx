import React from 'react';
import { Link } from 'react-router-dom';
import IconMic from '@/components/IconMic.jsx';
import IconSidebar from '@/components/IconSidebar.jsx';
import IconVisitPrep from '@/components/IconVisitPrep.jsx';
import EditableVisitPrepChatTitle from '@/components/visitPrep/EditableVisitPrepChatTitle.jsx';

const visitPrepHeaderBrandRowClass = 'flex items-center gap-2 text-[1.35rem] leading-snug';
const visitPrepHeaderBrandTitleClass =
  'truncate font-semibold text-gray-900';
const visitPrepHeaderBrandIconClass = 'h-[1.15em] w-[1.15em] shrink-0 text-[#183278]';
const visitPrepHeaderTitleRowClass =
  'grid min-h-9 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-[clamp(1rem,8%,3rem)]';
const visitPrepHeaderTitleRowLegacyClass =
  'grid min-h-9 grid-cols-[auto_1fr_auto] items-center gap-x-[clamp(1rem,8%,3rem)]';
const visitPrepHeaderSideStartClass = 'shrink-0';
const visitPrepHeaderBrandCenterClass = 'flex min-w-0 flex-1 items-center justify-center';
const visitPrepHeaderSideEndClass = 'flex shrink-0 items-center gap-2';

/** Pre-visit summary sidebar max width on desktop (right). */
export const VISIT_PREP_SUMMARY_SIDEBAR_WIDTH = '36rem';
/** md+ open sidebar: fluid share of the row, capped at {@link VISIT_PREP_SUMMARY_SIDEBAR_WIDTH}. */
export const visitPrepSummarySidebarWidthClass =
  'md:w-[min(36rem,45%)] md:min-w-[18rem] md:max-w-[36rem]';
export const visitPrepSummarySidebarTransitionClass =
  'transition-transform duration-300 ease-in-out motion-reduce:transition-none';
/** @deprecated Inner panel no longer slides; aside handles transform. */
export const visitPrepSummarySidebarPanelTransitionClass =
  visitPrepSummarySidebarTransitionClass;
export const visitPrepSummarySidebarMainInsetTransitionClass =
  'md:transition-[margin-right] md:duration-300 md:ease-in-out motion-reduce:md:transition-none';
export const visitPrepSummarySidebarTabTransitionClass =
  'transition-[transform,opacity] duration-300 ease-in-out motion-reduce:transition-none';
export const visitPrepSummarySidebarTabPulseClass =
  'max-md:visit-prep-edge-tab-pulse motion-reduce:max-md:animate-none';

export const visitPrepDocumentColumnPaddingClass = 'px-4 sm:px-5';
export const visitPrepMainColumnClass = 'mx-auto w-full max-w-3xl px-2 sm:px-3';
export const visitPrepChatColumnPaddingClass = 'px-1 sm:px-2';
export const visitPrepChatMessagesPaddingClass = 'px-2 sm:px-4';
export const visitPrepChatColumnClass = `mx-auto w-full max-w-3xl ${visitPrepChatColumnPaddingClass}`;
export const visitPrepChatMessagesColumnClass = `mx-auto w-full max-w-3xl ${visitPrepChatMessagesPaddingClass}`;
export const visitPrepChatFooterFadeShadowClass = 'shadow-[0_-12px_20px_12px_#f9fafb]';
export const visitPrepChatHeaderFadeShadowClass = 'shadow-[0_6px_18px_10px_#ffffff]';
export const visitPrepDocumentColumnClass = `w-full ${visitPrepDocumentColumnPaddingClass}`;
export const visitPrepMainHeaderPaddingClass = `${visitPrepDocumentColumnPaddingClass} py-3`;
export const visitPrepAttachOverlayHeaderPaddingClass =
  `${visitPrepDocumentColumnPaddingClass} pt-4 pb-3 sm:pt-5`;
export const visitPrepChatHeaderPaddingClass = `${visitPrepChatColumnPaddingClass} py-3`;
export const visitPrepSidebarListItemClass =
  'text-[11px] leading-snug tracking-[0.01em]';

const documentHeaderActionTextClass = 'text-sm font-semibold leading-snug';

const documentHeaderPrimaryActionClass =
  `min-w-0 shrink-0 rounded-md bg-[#183278] px-3 py-2 text-center ${documentHeaderActionTextClass} text-white hover:bg-[#142a66] disabled:cursor-not-allowed disabled:bg-[#183278]/45 disabled:hover:bg-[#183278]/45`;

const documentHeaderHomeLinkClass =
  'inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 -ml-1.5 font-semibold leading-snug text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-[#183278] focus:outline-none focus-visible:bg-gray-100 focus-visible:text-[#183278]';

function ChevronLeftIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Shared width so header and sidebar edge tabs align visually. */
export const visitPrepEdgeTabMinWidthClass = 'min-w-0 md:min-w-[14.5rem]';

const visitPrepEdgeTabButtonBaseClass =
  `flex items-center gap-1.5 rounded-l-lg border border-r-0 py-2 pl-2 pr-2 text-white md:gap-2 md:pl-3 md:pr-2.5 ${visitPrepEdgeTabMinWidthClass} focus:outline-none disabled:cursor-not-allowed disabled:opacity-55`;

/** Panel reveal and secondary edge actions. */
export const visitPrepEdgeTabSecondaryClass = `${visitPrepEdgeTabButtonBaseClass} border-[#142a66]/40 bg-[#183278] shadow-[0_3px_10px_rgba(24,50,120,0.28)] ring-1 ring-white/10 hover:bg-[#142a66] hover:shadow-[0_5px_14px_rgba(24,50,120,0.38)] focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#183278] disabled:hover:bg-[#183278] disabled:hover:shadow-[0_3px_10px_rgba(24,50,120,0.28)]`;

/** Primary forward action — same footprint as secondary, stronger presence. */
export const visitPrepEdgeTabPrimaryClass = `${visitPrepEdgeTabButtonBaseClass} border-[#0f2257]/55 bg-[#183278] shadow-[0_6px_22px_rgba(24,50,120,0.48)] ring-2 ring-white/25 hover:bg-[#142a66] hover:shadow-[0_8px_26px_rgba(24,50,120,0.58)] focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#183278] disabled:hover:bg-[#183278] disabled:hover:shadow-[0_6px_22px_rgba(24,50,120,0.48)]`;

/** @deprecated Prefer visitPrepEdgeTabSecondaryClass or variant="secondary". */
export const visitPrepEdgeTabButtonClass = visitPrepEdgeTabSecondaryClass;

export const visitPrepEdgeTabLabelClass = 'whitespace-nowrap text-[14px] font-semibold leading-snug';
export const visitPrepEdgeTabPrimaryLabelClass = `${visitPrepEdgeTabLabelClass} tracking-[0.01em]`;

/** Fits edge tab (py-2 + 14px label) with comfortable vertical padding in header rows. */
export const visitPrepHeaderEdgeTabRowMinHeightClass = 'min-h-[3.75rem]';

/**
 * Shared right-edge tab button used for header actions and the summary panel reveal.
 *
 * @param {{
 *   label: string;
 *   mobileLabel?: string;
 *   onClick?: () => void;
 *   disabled?: boolean;
 *   title?: string;
 *   ariaLabel?: string;
 *   icon?: React.ReactNode;
 *   trailingIcon?: React.ReactNode;
 *   variant?: 'primary' | 'secondary';
 *   className?: string;
 *   style?: React.CSSProperties;
 *   tabIndex?: number;
 *   'aria-hidden'?: boolean;
 * }} props
 */
export function VisitPrepEdgeTabButton({
  label,
  mobileLabel,
  onClick,
  disabled = false,
  title,
  ariaLabel,
  icon = null,
  trailingIcon = null,
  variant = 'secondary',
  className = '',
  style,
  tabIndex,
  'aria-hidden': ariaHidden,
}) {
  const variantClass = variant === 'primary' ? visitPrepEdgeTabPrimaryClass : visitPrepEdgeTabSecondaryClass;
  const labelClass =
    variant === 'primary' ? visitPrepEdgeTabPrimaryLabelClass : visitPrepEdgeTabLabelClass;
  const accessibleLabel = ariaLabel ?? label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={accessibleLabel}
      title={title ?? accessibleLabel}
      aria-hidden={ariaHidden}
      tabIndex={tabIndex}
      style={style}
      className={`${variantClass} ${className}`.trim()}
    >
      {icon}
      <span className={`${labelClass}${trailingIcon ? ' min-w-0 flex-1 text-left' : ''}`}>
        {mobileLabel ? (
          <>
            <span className="md:hidden">{mobileLabel}</span>
            <span className="hidden md:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </span>
      {trailingIcon}
    </button>
  );
}

/**
 * @param {{ disabled?: boolean; disabledTitle?: string; onClick?: () => void; className?: string }} props
 */
export function VisitPrepProceedToVisitEdgeTab({
  disabled = false,
  disabledTitle = 'Save your pre-visit summary to continue',
  onClick,
  className = '',
}) {
  return (
    <VisitPrepEdgeTabButton
      label="Proceed to Patient Visit"
      mobileLabel="Patient Visit"
      onClick={onClick}
      disabled={disabled}
      variant="primary"
      ariaLabel="Proceed to Patient Visit"
      title={disabled ? disabledTitle : 'Proceed to Patient Visit'}
      icon={<IconMic className="h-5 w-5 shrink-0" />}
      className={className}
    />
  );
}

function VisitPrepEdgeTabChevron({ className = '' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Approximate fixed summary edge-tab height for stacking the attach CTA below it. */
export const VISIT_PREP_SUMMARY_EDGE_TAB_APPROX_HEIGHT_PX = 44;
export const VISIT_PREP_EDGE_TAB_STACK_GAP_PX = 6;
export const VISIT_PREP_ATTACH_EDGE_TAB_APPROX_HEIGHT_PX = 64;

const visitPrepAttachPatientVisitAccentClass = 'text-emerald-300';

const visitPrepAttachPatientVisitStepTwoClass =
  `ml-0.5 inline-flex items-center gap-1 rounded-md bg-emerald-400/15 px-1.5 py-0.5 ring-1 ring-emerald-300/30 md:ml-1 ${visitPrepAttachPatientVisitAccentClass}`;

const visitPrepAttachPatientVisitTextGridClass =
  'grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_auto] items-center justify-items-start gap-y-1.5 text-left';

const visitPrepAttachPatientVisitTextGridGapColumnClass = 'gap-x-2 md:gap-x-2.5';
const visitPrepAttachPatientVisitTextGridGapEdgeClass = 'gap-x-2.5 md:gap-x-3.5';

const visitPrepMiddleColumnCtaClass =
  'flex w-full items-center gap-2 rounded-lg border border-[#142a66]/40 bg-[#183278] py-2.5 pl-2.5 pr-2 text-left text-white shadow-[0_3px_10px_rgba(24,50,120,0.28)] ring-1 ring-white/10 transition hover:bg-[#142a66] hover:shadow-[0_5px_14px_rgba(24,50,120,0.38)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 disabled:cursor-not-allowed disabled:opacity-55 md:gap-2.5 md:pl-3 md:pr-2.5';

const visitPrepAttachPatientVisitEdgeTabClass =
  `${visitPrepEdgeTabSecondaryClass} items-center !gap-2.5 py-2.5 md:!gap-3.5`;

/**
 * Icon + two-line label in an inner grid so row 1 and row 2 share one text column.
 *
 * @param {{ className?: string; variant?: 'column' | 'edge' }} props
 */
function VisitPrepSummaryAttachPatientVisitCtaBody({ className = '', variant = 'column' }) {
  const gridGapClass =
    variant === 'edge'
      ? visitPrepAttachPatientVisitTextGridGapEdgeClass
      : visitPrepAttachPatientVisitTextGridGapColumnClass;

  return (
    <span className={`${visitPrepAttachPatientVisitTextGridClass} ${gridGapClass} ${className}`.trim()}>
      <IconVisitPrep className="col-start-1 row-span-2 h-5 w-5 shrink-0 self-center bg-white md:h-6 md:w-6" />
      <span className="col-start-2 row-start-1 justify-self-start text-left text-[13px] font-semibold leading-snug md:text-[14px]">
        Pre-Visit Summary
      </span>
      <span className="col-start-2 row-start-2 flex min-w-0 max-w-full flex-wrap items-center justify-self-start gap-x-1 gap-y-0.5 text-left text-[12px] font-medium leading-snug text-white/90">
        <span aria-hidden>➔</span>
        <span>then start</span>
        <span className={visitPrepAttachPatientVisitStepTwoClass}>
          <IconMic className="h-3.5 w-3.5 shrink-0" />
          <span>Patient visit</span>
        </span>
      </span>
    </span>
  );
}

/**
 * Pre-visit summary → attach to patient visit CTA (middle column or right edge).
 *
 * @param {{
 *   onClick?: () => void;
 *   disabled?: boolean;
 *   className?: string;
 *   style?: React.CSSProperties;
 *   variant?: 'column' | 'edge';
 *   tabIndex?: number;
 *   'aria-hidden'?: boolean;
 * }} props
 */
export function VisitPrepSummaryAttachPatientVisitCta({
  onClick,
  disabled = false,
  className = '',
  style,
  variant = 'column',
  tabIndex,
  'aria-hidden': ariaHidden,
}) {
  const shellClass = variant === 'edge' ? visitPrepAttachPatientVisitEdgeTabClass : visitPrepMiddleColumnCtaClass;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Pre-Visit Summary, then start Patient visit"
      title="Pre-Visit Summary, then start Patient visit"
      aria-hidden={ariaHidden}
      tabIndex={tabIndex}
      style={style}
      className={`${shellClass} ${className}`.trim()}
    >
      <VisitPrepSummaryAttachPatientVisitCtaBody variant={variant} />
      <VisitPrepEdgeTabChevron className="h-4 w-4 shrink-0 self-center text-white/90" />
    </button>
  );
}

/**
 * Right-edge CTA stacked below the pre-visit summary sidebar tab.
 *
 * @param {{
 *   onClick?: () => void;
 *   disabled?: boolean;
 *   top?: number | null;
 *   sidebarOpen?: boolean;
 *   className?: string;
 * }} props
 */
export function VisitPrepSummaryAttachPatientVisitEdgeTab({
  onClick,
  disabled = false,
  top = null,
  sidebarOpen = false,
  className = '',
}) {
  return (
    <VisitPrepSummaryAttachPatientVisitCta
      variant="edge"
      onClick={onClick}
      disabled={disabled}
      aria-hidden={sidebarOpen}
      tabIndex={sidebarOpen ? -1 : 0}
      style={typeof top === 'number' ? { top: `${top}px` } : undefined}
      className={`fixed right-0 z-40 ${visitPrepSummarySidebarTabTransitionClass} ${
        sidebarOpen ? 'pointer-events-none translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      } ${className}`.trim()}
    />
  );
}

/**
 * Primary action in the pre-visit summary overlay header (confirm + navigate to visit).
 *
 * @param {{
 *   onClick?: () => void;
 *   disabled?: boolean;
 *   disabledTitle?: string;
 *   busy?: boolean;
 *   label?: string;
 *   busyLabel?: string;
 *   ariaLabel?: string;
 *   confirmTitle?: string;
 *   icon?: React.ReactNode;
 *   className?: string;
 * }} props
 */
export function VisitPrepConfirmStartPatientVisitButton({
  onClick,
  disabled = false,
  disabledTitle = 'Save your pre-visit summary to continue',
  busy = false,
  label = 'Proceed to patient visit',
  busyLabel = 'Saving…',
  ariaLabel = 'Confirm and start patient visit',
  confirmTitle = 'Confirm and start patient visit',
  icon = <IconMic className="h-4 w-4 shrink-0" />,
  className = '',
}) {
  const isDisabled = disabled || busy;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      title={isDisabled ? disabledTitle : confirmTitle}
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 items-center gap-1.5 ${documentHeaderPrimaryActionClass} ${className}`.trim()}
    >
      {icon}
      {busy ? busyLabel : label}
    </button>
  );
}

const panelToggleButtonClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-[#183278] hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/30';

/**
 * @param {{ onClick: () => void; className?: string; label?: string; title?: string }} props
 */
export function VisitPrepChatPanelToggleButton({
  onClick,
  className = '',
  label = 'Toggle Nova chat panel',
  title = 'Nova chat panel',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className={`${panelToggleButtonClass} ${className}`.trim()}
    >
      <IconSidebar className="h-5 w-5" />
    </button>
  );
}

/** @deprecated Use VisitPrepChatPanelToggleButton */
export const VisitPrepSidebarToggleButton = VisitPrepChatPanelToggleButton;

/**
 * @param {{
 *   onClick: () => void;
 *   className?: string;
 *   label?: string;
 *   title?: string;
 *   disabled?: boolean;
 * }} props
 */
export function VisitPrepSummaryPanelCloseButton({
  onClick,
  className = '',
  label = 'Close pre-visit summary panel',
  title = label,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      aria-busy={disabled || undefined}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/30 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-gray-500 ${className}`.trim()}
    >
      <CloseIcon />
    </button>
  );
}

/**
 * Edge tab — fixed to the viewport right edge so slide animation is independent of column width.
 *
 * @param {{ sidebarOpen: boolean; onOpenSidebar: () => void; top?: number | null; pulse?: boolean; className?: string }} props
 */
export function VisitPrepSummarySidebarTab({
  sidebarOpen,
  onOpenSidebar,
  top = null,
  pulse = false,
  className = '',
}) {
  return (
    <VisitPrepEdgeTabButton
      label="Pre-Visit Summary"
      mobileLabel="Summary"
      onClick={onOpenSidebar}
      icon={<IconVisitPrep className="h-5 w-5 shrink-0 bg-white" />}
      ariaLabel="Pre-Visit Summary"
      title="Pre-Visit Summary"
      aria-hidden={sidebarOpen}
      tabIndex={sidebarOpen ? -1 : 0}
      style={typeof top === 'number' ? { top: `${top}px` } : undefined}
      className={`fixed right-0 z-40 ${visitPrepSummarySidebarTabTransitionClass} ${
        typeof top !== 'number' ? 'top-20 ' : ''
      }${
        sidebarOpen ? 'pointer-events-none translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      } ${pulse ? visitPrepSummarySidebarTabPulseClass : ''} ${className}`.trim()}
    />
  );
}

/**
 * Nova chat (main) + optional pre-visit summary sidebar (right, collapsible).
 *
 * @param {{
 *   children: React.ReactNode;
 *   sidebar?: React.ReactNode | null;
 *   sidebarOpen?: boolean;
 * }} props
 */
export function VisitPrepPageShell({
  children,
  sidebar = null,
  sidebarOpen = true,
}) {
  const hasSidebar = sidebar != null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <section
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col bg-gray-50 md:min-h-0 md:min-w-[14rem] md:max-h-full ${
          hasSidebar ? visitPrepSummarySidebarMainInsetTransitionClass : ''
        } ${
          hasSidebar && sidebarOpen
            ? `max-md:hidden md:mr-[min(36rem,45%)]`
            : 'max-md:relative max-md:z-10 md:mr-0'
        }`}
      >
        {children}
      </section>
      {hasSidebar ? (
        <aside
          aria-hidden={!sidebarOpen}
          className={`flex min-h-0 flex-col overflow-hidden border-gray-200 bg-white ${visitPrepSummarySidebarTransitionClass} ${visitPrepSummarySidebarWidthClass} max-md:absolute max-md:inset-0 max-md:h-full max-md:max-h-none max-md:w-full max-md:overflow-hidden max-md:bg-transparent md:absolute md:inset-y-0 md:right-0 md:z-20 md:max-h-full md:border-t-0 md:border-l md:border-[#183278]/10 ${
            sidebarOpen
              ? 'max-md:z-30 max-md:pointer-events-auto translate-x-0 md:pointer-events-auto'
              : 'max-md:z-0 max-md:pointer-events-none md:pointer-events-none translate-x-full'
          }`}
        >
          <div className="flex h-full min-h-0 w-full flex-col bg-white md:h-full">{sidebar}</div>
        </aside>
      ) : null}
    </div>
  );
}

const visitPrepMainHeaderEdgeTabPaddingClass = 'pl-4 py-3 sm:pl-5';

/**
 * @param {{
 *   summaryTitle?: string;
 *   summaryTitleEditable?: boolean;
 *   onSaveSummaryTitle?: (title: string) => void | Promise<void>;
 *   homeHref?: string;
 *   onStartPatientVisit?: () => void;
 *   startPatientVisitDisabled?: boolean;
 *   startPatientVisitDisabledTitle?: string;
 *   trailing?: React.ReactNode;
 *   onCloseChatPanel?: () => void;
 * }} props
 */
export function VisitPrepChatPanelHeader({
  summaryTitle,
  summaryTitleEditable = false,
  onSaveSummaryTitle,
  homeHref = '/pre-visit-summary',
  onStartPatientVisit,
  startPatientVisitDisabled = true,
  startPatientVisitDisabledTitle,
  trailing,
  onCloseChatPanel,
}) {
  return (
    <header className="relative z-10 shrink-0 overflow-visible border-b border-gray-200 bg-white">
      <div
        className={`${visitPrepMainHeaderEdgeTabPaddingClass} relative pr-0 ${visitPrepHeaderEdgeTabRowMinHeightClass}`}
      >
        <div
          className={`${visitPrepHeaderTitleRowClass}${
            onStartPatientVisit ? ' pr-[min(6.75rem,30vw)] md:pr-[min(14.5rem,42vw)]' : ''
          }`}
        >
          <div className={visitPrepHeaderSideStartClass}>
            {homeHref ? (
              <Link to={homeHref} className={documentHeaderHomeLinkClass}>
                <ChevronLeftIcon />
                Home
              </Link>
            ) : onCloseChatPanel ? (
              <VisitPrepChatPanelToggleButton
                onClick={onCloseChatPanel}
                label="Close Nova chat panel"
                title="Close Nova chat panel"
              />
            ) : null}
          </div>
          <div className={visitPrepHeaderBrandCenterClass}>
            <div className="flex min-w-0 w-full max-w-full items-center justify-center gap-x-2 overflow-hidden px-1 sm:px-2">
              <p className="shrink-0 text-xs font-medium leading-none text-gray-600 sm:text-sm">
                Nova AI chat
              </p>
              <span aria-hidden className="shrink-0 text-gray-400">
                ·
              </span>
              {summaryTitle ? (
                <EditableVisitPrepChatTitle
                  value={summaryTitle}
                  editable={summaryTitleEditable && typeof onSaveSummaryTitle === 'function'}
                  onSave={onSaveSummaryTitle ?? (async () => {})}
                  hero
                  inlineRow
                />
              ) : null}
            </div>
          </div>
        </div>
        {onStartPatientVisit ? (
          <VisitPrepProceedToVisitEdgeTab
            disabled={startPatientVisitDisabled}
            disabledTitle={startPatientVisitDisabledTitle}
            onClick={onStartPatientVisit}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2"
          />
        ) : null}
        {trailing ? <div className="absolute right-0 top-1/2 z-10 -translate-y-1/2">{trailing}</div> : null}
      </div>
      <div
        className={`pointer-events-none absolute inset-x-0 top-full z-[1] h-px ${visitPrepChatHeaderFadeShadowClass}`}
        aria-hidden
      />
    </header>
  );
}

/**
 * @param {{
 *   title: string;
 *   linkedChatTitle?: string;
 *   linkedChatTitleEditable?: boolean;
 *   onSaveLinkedChatTitle?: (title: string) => void | Promise<void>;
 *   homeHref?: string;
 *   onStartPatientVisit?: () => void;
 *   startPatientVisitComingSoon?: boolean;
 *   titleAction?: React.ReactNode;
 *   titleBadge?: React.ReactNode;
 *   titleRowLayout?: 'default' | 'overlay';
 *   borderless?: boolean;
 *   paddingClass?: string;
 *   trailing?: React.ReactNode;
 * }} props
 */
export function VisitPrepDocumentHeader({
  title,
  linkedChatTitle,
  linkedChatTitleEditable = false,
  onSaveLinkedChatTitle,
  homeHref,
  onStartPatientVisit,
  startPatientVisitComingSoon = false,
  titleAction = null,
  titleBadge = null,
  titleRowLayout = 'default',
  borderless = false,
  paddingClass = visitPrepMainHeaderPaddingClass,
  trailing,
}) {
  const showStartPatientVisit = !!onStartPatientVisit || startPatientVisitComingSoon;

  const titleBrand = (
    <div className={`${visitPrepHeaderBrandRowClass} min-w-0 max-w-full`}>
      <IconVisitPrep className={visitPrepHeaderBrandIconClass} />
      <h1 className={visitPrepHeaderBrandTitleClass}>{title}</h1>
      {titleBadge}
    </div>
  );

  return (
    <header
      className={`shrink-0 bg-white ${borderless ? '' : 'border-b border-gray-200'} ${paddingClass}`}
    >
      <div className="min-w-0">
        {titleRowLayout === 'overlay' ? (
          <div className="flex min-h-9 items-center gap-4">
            <div className="min-w-0 flex-1">{titleBrand}</div>
            <div className="flex shrink-0 items-center gap-3">
              {titleAction}
              {trailing}
            </div>
          </div>
        ) : (
          <div className={visitPrepHeaderTitleRowLegacyClass}>
            <div className={visitPrepHeaderSideStartClass}>
              {homeHref ? (
                <Link to={homeHref} className={documentHeaderHomeLinkClass}>
                  <ChevronLeftIcon />
                  Home
                </Link>
              ) : null}
            </div>
            <div className={visitPrepHeaderBrandCenterClass}>
              <div className="flex min-w-0 max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2">
                {titleBrand}
                {titleAction}
              </div>
            </div>
            <div className={visitPrepHeaderSideEndClass}>
              {trailing ? <div className="flex shrink-0 items-center">{trailing}</div> : null}
              {showStartPatientVisit ? (
                <button
                  type="button"
                  onClick={onStartPatientVisit ?? (() => {})}
                  disabled={startPatientVisitComingSoon}
                  title={startPatientVisitComingSoon ? 'Coming soon' : undefined}
                  className={documentHeaderPrimaryActionClass}
                >
                  Proceed to Patient Visit →
                </button>
              ) : null}
            </div>
          </div>
        )}
        {linkedChatTitle ? (
          <EditableVisitPrepChatTitle
            value={linkedChatTitle}
            editable={linkedChatTitleEditable && typeof onSaveLinkedChatTitle === 'function'}
            onSave={onSaveLinkedChatTitle ?? (async () => {})}
            inline
            className="mt-3 min-w-0 w-full"
          />
        ) : null}
      </div>
    </header>
  );
}
