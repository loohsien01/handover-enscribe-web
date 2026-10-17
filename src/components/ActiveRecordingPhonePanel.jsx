import React, { useEffect, useRef, useState } from "react";
import IconEdit from "@/components/IconEdit.jsx";
import IconVisitPrep from "@/components/IconVisitPrep.jsx";
import LiveRecordingMeter from "@/components/LiveRecordingMeter.jsx";
import PhoneDeviceFrame, {
  PHONE_SCREEN_HEIGHT,
  PHONE_SCREEN_WIDTH,
  PhoneHomeIndicator,
  PhoneStatusBar,
} from "@/components/PhoneDeviceFrame.jsx";
import RecordingTouchLockOverlay from "@/components/RecordingTouchLockOverlay.jsx";
import { BAR_COUNT } from "@/utils/recordingMeter.js";

export const RECORDING_MAIN_BLUE = "#183278";
export const RECORDING_BOTTOM_ACCENT = "#14285F";
export const RECORDING_SHELL_BG = "#F9FAFF";
const BOTTOM_GRADIENT_HEIGHT_PCT = 55;

/** Shared frost styling for the encounter name pill. */
const RECORDING_INFO_PILL =
  "rounded-full border border-white/15 bg-white/8 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm";

/** Fallback stack when pre-visit row is absent. */
const RECORDING_INFO_PILL_STACK =
  "mx-auto inline-flex max-w-full flex-col items-stretch gap-2";

/** Title pill layout — centered label with symmetric side slots, width follows title. */
const ENCOUNTER_NAME_PILL_LAYOUT =
  "inline-grid w-fit min-w-[10rem] max-w-full grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center";

const ENCOUNTER_NAME_TEXT =
  "m-0 min-w-0 w-full pr-2.5 text-center text-[15px] font-medium leading-7 text-white/95";

const ENCOUNTER_NAME_INPUT =
  "min-w-0 h-7 w-full border-0 bg-transparent p-0 pr-2.5 text-center text-[15px] font-medium leading-7 text-white placeholder:text-white/40 outline-none focus:outline-none focus:ring-0";

const RECORDING_BTN_ICON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15";

export const RECORDING_ACTION_BTN =
  "flex w-full items-center justify-center gap-3 rounded-2xl border border-white/35 bg-white/8 py-[15px] text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm transition hover:bg-white/14 active:bg-white/18 disabled:opacity-45";

export const RECORDING_START_BTN =
  "flex w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-[#E04E3F] py-[15px] text-[16px] font-semibold text-white shadow-[0_8px_24px_rgba(12,8,8,0.28),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:bg-[#CF4336] active:bg-[#B83A2F] disabled:opacity-45";

const MARKETING_PHONE_HEIGHT = 700;
const MARKETING_PHONE_WIDTH = 350;

function randomMeterSample() {
  return 0.06 + Math.random() * 0.88;
}

function initialMeterSamples(count) {
  return Array.from({ length: count }, randomMeterSample);
}

function shiftMeterSamples(prev) {
  return [...prev.slice(1), randomMeterSample()];
}

function RecordingPlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72L19 12z" />
    </svg>
  );
}

function RecordingPauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function RecordingStopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function EditPencilIcon() {
  return <IconEdit className="h-[15px] w-[15px]" />;
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function RecordingStatusBadge({ paused = false }) {
  return (
    <div
      className="mb-1 flex items-center justify-center gap-2"
      role="status"
      aria-live="polite"
    >
      {!paused ? (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.65)]" />
        </span>
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-300/90" aria-hidden />
      )}
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">
        {paused ? "Paused" : "Recording"}
      </span>
    </div>
  );
}

function PreVisitSummaryStatusChevron({ className = "" }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 ${className}`.trim()}
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

function PreVisitSummaryStatusClose({ className = "" }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 ${className}`.trim()}
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PreVisitSummaryStatusLink({
  attached = false,
  onPress,
  onDetach,
  interactive = true,
  screenLocked = false,
  onBump,
}) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          onBump?.();
          onPress?.();
        }}
        className={`group flex items-center justify-center gap-1.5 text-xs font-medium leading-none whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
          attached
            ? "text-white/65 hover:text-white hover:underline hover:decoration-white/35 hover:underline-offset-[3px]"
            : "text-amber-200/75 hover:text-amber-100 hover:underline hover:decoration-amber-200/40 hover:underline-offset-[3px]"
        }`}
        aria-label={
          attached
            ? "View attached pre-visit summary"
            : "Go to pre-visit summary home"
        }
        title={
          attached
            ? "View attached pre-visit summary"
            : "Go to pre-visit summary home"
        }
        aria-hidden={screenLocked ? true : undefined}
        tabIndex={interactive ? 0 : -1}
      >
        <IconVisitPrep
          className={`h-3.5 w-3.5 shrink-0 ${
            attached
              ? "bg-white/75 group-hover:bg-white/90"
              : "bg-amber-200 group-hover:bg-amber-100"
          }`}
        />
        <span>
          {attached
            ? "Pre Visit Summary attached"
            : "No Pre Visit Summary attached"}
        </span>
        {attached ? null : (
          <PreVisitSummaryStatusChevron className="text-amber-200 transition group-hover:translate-x-0.5 group-hover:text-amber-100" />
        )}
      </button>
      {attached ? (
        <button
          type="button"
          onClick={() => {
            onBump?.();
            onDetach?.();
          }}
          className="group flex items-center justify-center text-white/75 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          aria-label="Detach pre-visit summary"
          title="Detach pre-visit summary"
          aria-hidden={screenLocked ? true : undefined}
          tabIndex={interactive ? 0 : -1}
        >
          <PreVisitSummaryStatusClose className="text-white/75 transition group-hover:text-white/90" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Phone mockup for active / ambient recording — shared by the live page and marketing.
 */
export function ActiveRecordingPhonePanel({
  fullViewport = false,
  className = "",
  encounterName,
  isEditingEncounterName = false,
  encounterNameDraft = "",
  encounterNameError = null,
  nameInputRef,
  nameInputWidthCh = 16,
  onEncounterNameDraftChange,
  onCommitEncounterName,
  onBeginEditEncounterName,
  onEncounterNameFocus,
  elapsed = "00:00",
  liveMeterSamples = [],
  liveMeterMode = "metering",
  isRecordingPaused = false,
  sessionActive = false,
  sessionPausedMidCapture = false,
  onBack,
  onStartRecording,
  onTogglePause,
  onEndRecording,
  bumpIdleRelock,
  screenLocked = false,
  onUnlockComplete,
  showPendingBanner = false,
  onRetryUpload,
  playLabel = "Start recording",
  nameRowMaxClass = "max-w-full",
  preVisitSummaryAttached = false,
  onPreVisitSummaryPress,
  onPreVisitSummaryDetach,
  showHeaderCancel = true,
  interactive = true,
  screenWidth,
  screenHeight,
}) {
  const handleBump = () => {
    if (interactive) bumpIdleRelock?.();
  };

  const encounterPillRef = useRef(null);
  const [lockedPillWidthPx, setLockedPillWidthPx] = useState(null);

  useEffect(() => {
    if (!isEditingEncounterName) {
      setLockedPillWidthPx(null);
    }
  }, [isEditingEncounterName]);

  const pillWidthStyle =
    isEditingEncounterName && lockedPillWidthPx != null
      ? { width: lockedPillWidthPx }
      : undefined;

  const beginEditEncounterName = () => {
    handleBump();
    const measuredWidth = encounterPillRef.current?.offsetWidth;
    if (measuredWidth) {
      setLockedPillWidthPx(measuredWidth);
    }
    onBeginEditEncounterName?.();
  };

  return (
    <PhoneDeviceFrame
      fullViewport={fullViewport}
      className={className}
      screenWidth={screenWidth}
      screenHeight={screenHeight}
    >
      <div
        className="relative flex flex-1 min-h-0 flex-col overflow-hidden lg:min-h-0 lg:h-full"
        style={{
          backgroundColor: RECORDING_MAIN_BLUE,
          backgroundImage: `radial-gradient(ellipse 120% 80% at 50% -10%, rgba(124,157,249,0.22) 0%, transparent 55%), linear-gradient(180deg, ${RECORDING_MAIN_BLUE} 0%, ${RECORDING_MAIN_BLUE} 100%)`,
        }}
      >
        {fullViewport ? null : (
          <PhoneStatusBar backgroundColor="transparent" />
        )}
        {showPendingBanner ? (
          <div
            className="relative z-[2] mx-3 mt-1 rounded-lg border border-amber-200/80 bg-amber-50/95 px-3 py-2 text-center text-sm text-amber-950"
            role="status"
          >
            You have a recording saved on this device that has not been uploaded.{" "}
            <button
              type="button"
              className="font-semibold text-[#183278] underline decoration-[#183278]/30 underline-offset-2 hover:text-[#14285F] hover:decoration-[#14285F]/40"
              onClick={onRetryUpload}
              disabled={!interactive}
            >
              Retry upload
            </button>
          </div>
        ) : null}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            className="relative flex min-h-0 flex-1 flex-col"
            {...(screenLocked ? { inert: "" } : {})}
          >
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{
                height: `${BOTTOM_GRADIENT_HEIGHT_PCT}%`,
                background: `linear-gradient(to top, ${RECORDING_BOTTOM_ACCENT} 0%, transparent 100%)`,
              }}
              aria-hidden
            />

            {showHeaderCancel ? (
              <header className="relative z-[1] px-5 pt-3 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    handleBump();
                    onBack?.();
                  }}
                  className="py-1 text-[15px] font-medium text-white/75 transition hover:text-white lg:text-[14px]"
                  aria-label="Cancel"
                  aria-hidden={screenLocked ? true : undefined}
                  tabIndex={interactive ? 0 : -1}
                >
                  Cancel
                </button>
              </header>
            ) : null}

            <div
              className={`relative z-[1] flex flex-1 flex-col px-5 pb-8 ${
                showHeaderCancel ? "pt-1" : "pt-3 lg:pt-4"
              }`}
            >
              <div
                className={
                  onPreVisitSummaryPress
                    ? "mx-auto mb-2 flex max-w-full flex-col items-center gap-5"
                    : `mb-2 ${RECORDING_INFO_PILL_STACK}`
                }
              >
                <div className="max-w-full min-w-0 self-center">
                  {isEditingEncounterName ? (
                    <>
                      <div
                        ref={encounterPillRef}
                        style={pillWidthStyle}
                        className={`${RECORDING_INFO_PILL} ${ENCOUNTER_NAME_PILL_LAYOUT}`}
                      >
                        <span className="h-7 w-7 shrink-0" aria-hidden />
                        <input
                          ref={nameInputRef}
                          type="text"
                          className={ENCOUNTER_NAME_INPUT}
                          value={encounterNameDraft}
                          placeholder="Patient encounter name"
                          aria-label="Patient encounter name"
                          onChange={onEncounterNameDraftChange}
                          onBlur={() => onCommitEncounterName?.("blur")}
                          onFocus={onEncounterNameFocus}
                          autoFocus={isEditingEncounterName}
                          maxLength={120}
                          readOnly={!interactive}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onCommitEncounterName?.("submit");
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 hover:text-white disabled:opacity-35"
                          aria-label="Save patient encounter name"
                          onClick={() => onCommitEncounterName?.("tick")}
                          tabIndex={interactive ? 0 : -1}
                        >
                          <CheckIcon />
                        </button>
                      </div>
                      {encounterNameError ? (
                        <p className="mt-1 text-center text-sm font-normal text-[#ffb4b4]">
                          {encounterNameError}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <div
                      ref={encounterPillRef}
                      role="group"
                      aria-label="Patient encounter name"
                      className={`${RECORDING_INFO_PILL} ${ENCOUNTER_NAME_PILL_LAYOUT}`}
                    >
                      <span className="h-7 w-7 shrink-0" aria-hidden />
                      <h1
                        className={`${ENCOUNTER_NAME_TEXT} truncate`}
                        title={encounterName || undefined}
                      >
                        {encounterName || "—"}
                      </h1>
                      <button
                        type="button"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/12 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
                        aria-label="Edit patient encounter name"
                        title="Edit patient encounter name"
                        onClick={beginEditEncounterName}
                        aria-hidden={screenLocked ? true : undefined}
                        tabIndex={interactive ? 0 : -1}
                      >
                        <EditPencilIcon />
                      </button>
                    </div>
                  )}
                </div>

                {onPreVisitSummaryPress ? (
                  <div className="max-w-full">
                    <PreVisitSummaryStatusLink
                      attached={preVisitSummaryAttached}
                      onPress={onPreVisitSummaryPress}
                      onDetach={onPreVisitSummaryDetach}
                      interactive={interactive}
                      screenLocked={screenLocked}
                      onBump={handleBump}
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex flex-col items-center">
                {sessionActive ? (
                  <RecordingStatusBadge paused={isRecordingPaused} />
                ) : null}
                <span
                  className="text-[48px] font-semibold leading-none tracking-tight text-white tabular-nums"
                  aria-live="polite"
                >
                  {elapsed}
                </span>
              </div>

              <LiveRecordingMeter
                samples={liveMeterSamples}
                mode={liveMeterMode}
                isPaused={isRecordingPaused}
                variant="recordingDark"
                className="mt-1 w-full max-w-[400px] self-center"
              />

              <div className="min-h-3 flex-1" />

              <div className="mx-auto flex w-full max-w-[400px] flex-col gap-3 pb-1">
                {!sessionActive ? (
                  <button
                    type="button"
                    onClick={onStartRecording}
                    className={RECORDING_START_BTN}
                    tabIndex={interactive ? 0 : -1}
                  >
                    <span className={RECORDING_BTN_ICON} aria-hidden>
                      <RecordingPlayIcon />
                    </span>
                    {playLabel}
                  </button>
                ) : sessionPausedMidCapture ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleBump();
                        onTogglePause?.();
                      }}
                      className={RECORDING_ACTION_BTN}
                      tabIndex={interactive ? 0 : -1}
                    >
                      <span className={RECORDING_BTN_ICON} aria-hidden>
                        <RecordingPlayIcon />
                      </span>
                      Resume recording
                    </button>
                    <button
                      type="button"
                      onClick={onEndRecording}
                      className={RECORDING_ACTION_BTN}
                      tabIndex={interactive ? 0 : -1}
                    >
                      <span className={RECORDING_BTN_ICON} aria-hidden>
                        <RecordingStopIcon />
                      </span>
                      End recording
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handleBump();
                        onTogglePause?.();
                      }}
                      className={RECORDING_ACTION_BTN}
                      tabIndex={interactive ? 0 : -1}
                    >
                      <span className={RECORDING_BTN_ICON} aria-hidden>
                        <RecordingPauseIcon />
                      </span>
                      Pause recording
                    </button>
                    <button
                      type="button"
                      onClick={onEndRecording}
                      className={RECORDING_ACTION_BTN}
                      tabIndex={interactive ? 0 : -1}
                    >
                      <span className={RECORDING_BTN_ICON} aria-hidden>
                        <RecordingStopIcon />
                      </span>
                      End recording
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          {screenLocked ? (
            <RecordingTouchLockOverlay onUnlockComplete={onUnlockComplete} />
          ) : null}
        </div>
        {fullViewport ? null : <PhoneHomeIndicator />}
      </div>
    </PhoneDeviceFrame>
  );
}

/** Marketing mock — active recording with Anya Harmon and live random meter. */
export function ActiveRecordingPhoneMockup({ className = "" }) {
  const [meterSamples, setMeterSamples] = useState(() =>
    initialMeterSamples(BAR_COUNT),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setMeterSamples((prev) => shiftMeterSamples(prev));
    }, 110);
    return () => window.clearInterval(id);
  }, []);

  return (
    <ActiveRecordingPhonePanel
      className={className}
      encounterName="Anya Harmon"
      elapsed="08:42"
      liveMeterSamples={meterSamples}
      liveMeterMode="metering"
      sessionActive
      interactive={false}
      screenWidth={MARKETING_PHONE_WIDTH}
      screenHeight={MARKETING_PHONE_HEIGHT}
    />
  );
}

export default ActiveRecordingPhonePanel;
