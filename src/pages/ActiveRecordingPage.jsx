import React, { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useLocation, useNavigate } from "react-router-dom";
import Auth from "@/components/Auth.jsx";
import ActiveRecordingPhonePanel, {
  RECORDING_SHELL_BG,
} from "@/components/ActiveRecordingPhonePanel.jsx";
import useWakeLock from "@/hooks/useWakeLock";
import useEncounterRecording from "@/hooks/useEncounterRecording";
import useRecordingTouchLock from "@/hooks/useRecordingTouchLock";
import useRecordingFullViewport from "@/hooks/useRecordingFullViewport";
import * as api from "@/lib/api";
import * as format from "@/utils/format.js";
import AttachPreVisitSummaryOverlay from "@/components/visitPrep/AttachPreVisitSummaryOverlay.jsx";
import PendingRecordingGuardModal from "@/components/PendingRecordingGuardModal.jsx";
import {
  ATTACHED_PRE_VISIT_SUMMARY_STATE_KEY,
  ENCOUNTER_NAME_MAX_CHARS,
  encounterNameFromPreVisitSummaryHandoff,
  readAttachedPreVisitSummaryFromLocationState,
  withPreVisitSummaryOnRecordingMetadata,
} from "@/utils/visitPrepRecordingHandoff.js";
import {
  discardPendingRecording,
  formatPendingRecordingLabel,
  getPendingRecordingContext,
  hasPendingRecording,
} from "@/utils/pendingRecordingGuard.js";
import { STORAGE_KEYS } from "@/utils/storageConfig.js";

const ENCOUNTER_NAME_REQUIRED_MSG = "Enter a patient encounter name.";
const LEAVE_CONFIRM_RECORDING_ITEM =
  "Your recording will end and any audio captured so far will be lost.";
const LEAVE_CONFIRM_ATTACHED_SUMMARY_ITEM =
  "You will need to re-attach your Pre Visit Summary if you return.";
const END_RECORDING_CONFIRM_MSG =
  "End this recording? Audio captured so far will be saved for note generation.";

function buildLeaveConfirmMessage({
  hasRecordingLoss,
  hasAttachedSummary,
}) {
  const items = [];
  if (hasRecordingLoss) items.push(LEAVE_CONFIRM_RECORDING_ITEM);
  if (hasAttachedSummary) items.push(LEAVE_CONFIRM_ATTACHED_SUMMARY_ITEM);
  if (items.length === 0) return "";
  return `If you leave this page:\n\n${items.map((item) => `• ${item}`).join("\n")}`;
}

function persistEncounterName(value) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.newPatientEncounter.patientEncounterName,
      JSON.stringify(value),
    );
  } catch (e) {
    console.warn("[ActiveRecordingPage] Could not persist encounter name:", e);
  }
}

function freshEncounterName() {
  return format
    .formatEncounterTimestamp(new Date())
    .slice(0, ENCOUNTER_NAME_MAX_CHARS);
}

function resolveEncounterNameForVisit(locationState) {
  const handoff = readAttachedPreVisitSummaryFromLocationState(locationState);
  return encounterNameFromPreVisitSummaryHandoff(handoff) ?? freshEncounterName();
}

export default function ActiveRecordingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const allowLeaveRef = useRef(false);
  const {
    acquireWakeLock,
    releaseWakeLock,
  } = useWakeLock();

  const [attachedPreVisitSummary, setAttachedPreVisitSummary] = useState(() =>
    readAttachedPreVisitSummaryFromLocationState(location.state),
  );
  const [attachOverlayOpen, setAttachOverlayOpen] = useState(false);

  const [encounterName, setEncounterName] = useState(() =>
    resolveEncounterNameForVisit(location.state),
  );

  const nameInputRef = useRef(null);
  const draftRef = useRef("");
  const editingRef = useRef(false);

  const [isEditingEncounterName, setIsEditingEncounterName] = useState(false);
  const [encounterNameDraft, setEncounterNameDraft] = useState("");
  const [encounterNameError, setEncounterNameError] = useState(null);

  const nameInputWidthCh = Math.max(
    12,
    Math.min(encounterNameDraft.length + 2, ENCOUNTER_NAME_MAX_CHARS),
  );

  useEffect(() => {
    const incoming = readAttachedPreVisitSummaryFromLocationState(location.state);
    if (incoming) {
      setAttachedPreVisitSummary(incoming);
    }
  }, [location.key, location.state]);

  const navigateHandoff = useCallback(
    async (handoff) => {
      const name =
        handoff.encounterName ||
        encounterName.trim().slice(0, ENCOUNTER_NAME_MAX_CHARS);
      const handoffId = handoff.id;
      const attachedSummary = attachedPreVisitSummary;
      try {
        localStorage.setItem(
          STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
          JSON.stringify(
            withPreVisitSummaryOnRecordingMetadata(
              {
                status: "local",
                idbId: handoff.idbId,
                name: "recording.webm",
                size: handoff.sizeBytes,
                duration: handoff.durationSec,
                patientEncounterName: name,
                capturedAt: new Date().toISOString(),
              },
              attachedSummary,
            ),
          ),
        );
      } catch (e) {
        console.warn("[ActiveRecordingPage] metadata persist failed:", e);
      }
      allowLeaveRef.current = true;
      navigate("/generate-note", {
        state: {
          pendingRecordingId: handoff.idbId,
          patientEncounterName: name,
          recordingHandoffId: handoffId,
          ...(attachedSummary
            ? { [ATTACHED_PRE_VISIT_SUMMARY_STATE_KEY]: attachedSummary }
            : {}),
        },
      });
    },
    [attachedPreVisitSummary, encounterName, navigate],
  );

  const prepareNewRecording = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.newPatientEncounter.recordingFile);
    localStorage.removeItem(
      STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
    );
  }, []);

  const onRecordingReady = useCallback(
    async (handoff) => {
      await navigateHandoff(handoff);
    },
    [navigateHandoff],
  );

  const getEncounterName = useCallback(
    () => encounterName.trim().slice(0, ENCOUNTER_NAME_MAX_CHARS),
    [encounterName],
  );

  const [pendingBannerVisible, setPendingBannerVisible] = useState(false);
  const [guardModalOpen, setGuardModalOpen] = useState(false);
  const [pendingGuardLabel, setPendingGuardLabel] = useState("");

  const refreshPendingBanner = useCallback(async () => {
    const pending = await hasPendingRecording();
    setPendingBannerVisible(pending);
    if (pending) {
      const ctx = await getPendingRecordingContext();
      setPendingGuardLabel(
        formatPendingRecordingLabel(ctx.record, ctx.metadata),
      );
    }
  }, []);

  useEffect(() => {
    void refreshPendingBanner();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshPendingBanner();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshPendingBanner]);

  const {
    isRecording,
    isRecordingPaused,
    recordingDuration,
    startRecording,
    stopRecording,
    abandonRecording,
    toggleRecordingPause,
    liveMeterSamples,
    liveMeterMode,
  } = useEncounterRecording({
    acquireWakeLock,
    releaseWakeLock,
    checkAuth: api.checkAuthWithRefreshRetry,
    prepareNewRecording,
    getEncounterName,
    onRecordingReady,
    enableLiveMeter: true,
  });

  /** Each visit starts a new session — pre-visit title when attached, else fresh timestamp. */
  useEffect(() => {
    if (isRecording || isRecordingPaused) return;
    const resolved = resolveEncounterNameForVisit(location.state);
    setEncounterName((current) => (current === resolved ? current : resolved));
  }, [location.key, location.state, isRecording, isRecordingPaused]);

  const {
    screenLocked,
    unlockScreen,
    bumpIdleRelock,
    needsEndRecordingConfirm,
  } = useRecordingTouchLock({
    isRecording,
    isRecordingPaused,
  });

  const recordingFullViewport = useRecordingFullViewport();

  const handleStartRecording = useCallback(async () => {
    if (await hasPendingRecording()) {
      const ctx = await getPendingRecordingContext();
      setPendingGuardLabel(
        formatPendingRecordingLabel(ctx.record, ctx.metadata),
      );
      setGuardModalOpen(true);
      return;
    }
    startRecording();
  }, [startRecording]);

  /** Fills .mobile-full-shell flex child; desktop mockup is centered beside the nav. */
  const mobileShellFill = recordingFullViewport
    ? "flex flex-1 min-h-0 w-full flex-col"
    : "min-h-[var(--mobile-viewport-height)] lg:flex lg:min-h-screen lg:items-center lg:justify-center lg:px-4 lg:py-10";

  const handlePreVisitSummaryPress = useCallback(() => {
    setAttachOverlayOpen(true);
  }, []);

  const handlePreVisitSummaryDetach = useCallback(() => {
    setAttachedPreVisitSummary(null);
  }, []);

  const maybePauseForNameEdit = useCallback(() => {
    if (!isRecording) return;
    if (isRecordingPaused) return;
    toggleRecordingPause();
  }, [isRecording, isRecordingPaused, toggleRecordingPause]);

  const tryCommitEncounterName = useCallback(
    (source) => {
      if (!editingRef.current) return;
      const next = draftRef.current.trim().slice(0, ENCOUNTER_NAME_MAX_CHARS);
      if (!next.length) {
        setEncounterNameError(ENCOUNTER_NAME_REQUIRED_MSG);
        if (source === "blur") {
          requestAnimationFrame(() => nameInputRef.current?.focus());
        }
        return;
      }
      setEncounterNameError(null);
      editingRef.current = false;
      setEncounterName(next);
      persistEncounterName(next);
      setIsEditingEncounterName(false);
    },
    [],
  );

  const beginEditEncounterName = useCallback(() => {
    setEncounterNameError(null);
    const d = encounterName.slice(0, ENCOUNTER_NAME_MAX_CHARS);
    draftRef.current = d;
    setEncounterNameDraft(d);
    editingRef.current = true;
    setIsEditingEncounterName(true);
  }, [encounterName]);

  useEffect(() => {
    editingRef.current = isEditingEncounterName;
  }, [isEditingEncounterName]);

  useEffect(() => {
    return () => {
      if (!editingRef.current) return;
      const next = draftRef.current.trim().slice(0, ENCOUNTER_NAME_MAX_CHARS);
      if (!next.length) return;
      persistEncounterName(next);
      setEncounterName(next);
    };
  }, []);

  const elapsed = format.formatDuration(recordingDuration);
  const sessionActive = isRecording;
  const sessionPausedMidCapture = isRecording && isRecordingPaused;

  const nothingToLose =
    !isRecording && recordingDuration === 0 && !attachedPreVisitSummary;

  const confirmLeave = useCallback(() => {
    if (allowLeaveRef.current) return true;
    if (nothingToLose) return true;

    const hasRecordingLoss = isRecording || recordingDuration > 0;
    const hasAttachedSummary = !!attachedPreVisitSummary;
    const leaveConfirmMsg = buildLeaveConfirmMessage({
      hasRecordingLoss,
      hasAttachedSummary,
    });

    if (isRecording) {
      const wasAlreadyPaused = isRecordingPaused;
      if (!wasAlreadyPaused) {
        toggleRecordingPause();
      }
      const ok = window.confirm(leaveConfirmMsg);
      if (!ok) {
        if (!wasAlreadyPaused) {
          toggleRecordingPause();
        }
        return false;
      }
      abandonRecording();
      if (hasAttachedSummary) {
        setAttachedPreVisitSummary(null);
      }
      return true;
    }

    const ok = window.confirm(leaveConfirmMsg);
    if (ok && hasAttachedSummary) {
      setAttachedPreVisitSummary(null);
    }
    return ok;
  }, [
    abandonRecording,
    attachedPreVisitSummary,
    isRecording,
    isRecordingPaused,
    nothingToLose,
    toggleRecordingPause,
  ]);

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => {
        if (allowLeaveRef.current) return false;
        if (currentLocation.pathname !== "/active-recording") return false;
        if (nextLocation.pathname === currentLocation.pathname) return false;
        if (nothingToLose) return false;
        return true;
      },
      [nothingToLose],
    ),
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return undefined;

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const ok = confirmLeave();
      if (cancelled) return;
      if (ok) {
        allowLeaveRef.current = true;
        blocker.proceed();
      } else {
        blocker.reset();
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [blocker, confirmLeave]);

  const handleBack = useCallback(() => {
    if (!confirmLeave()) return;
    allowLeaveRef.current = true;
    navigate("/view-notes");
  }, [confirmLeave, navigate]);

  const handleCloseAttachOverlay = useCallback(() => {
    setAttachOverlayOpen(false);
  }, []);

  const handleAttachPreVisitSummary = useCallback(
    (handoff) => {
      const previousId = attachedPreVisitSummary?.id ?? null;
      const nextId = handoff?.id ?? null;
      const isDifferentAttachment = nextId !== previousId;

      setAttachedPreVisitSummary(handoff);

      if (!isDifferentAttachment) return;

      const fromPrep = encounterNameFromPreVisitSummaryHandoff(handoff);
      if (!fromPrep) return;

      setEncounterName(fromPrep);
      persistEncounterName(fromPrep);
      if (editingRef.current) {
        editingRef.current = false;
        draftRef.current = fromPrep;
        setEncounterNameDraft(fromPrep);
        setEncounterNameError(null);
        setIsEditingEncounterName(false);
      }
    },
    [attachedPreVisitSummary],
  );

  const handleEndRecording = useCallback(() => {
    bumpIdleRelock();
    if (needsEndRecordingConfirm) {
      if (!window.confirm(END_RECORDING_CONFIRM_MSG)) return;
    }
    const name = encounterName.trim().slice(0, ENCOUNTER_NAME_MAX_CHARS);
    if (!name.length) {
      window.alert(ENCOUNTER_NAME_REQUIRED_MSG);
      return;
    }
    persistEncounterName(name);
    stopRecording();
  }, [
    bumpIdleRelock,
    encounterName,
    needsEndRecordingConfirm,
    stopRecording,
  ]);

  const playLabel = "Start recording";

  const nameRowMaxClass = "max-w-full";

  return (
    <>
      <Auth />
      <div
        className={mobileShellFill}
        style={{ backgroundColor: RECORDING_SHELL_BG }}
      >
        <p className="sr-only" aria-live="polite">
          {screenLocked
            ? "Screen locked"
            : needsEndRecordingConfirm
              ? "Screen unlocked"
              : ""}
        </p>
        <ActiveRecordingPhonePanel
          fullViewport={recordingFullViewport}
          showHeaderCancel={recordingFullViewport}
          encounterName={encounterName}
          isEditingEncounterName={isEditingEncounterName}
          encounterNameDraft={encounterNameDraft}
          encounterNameError={encounterNameError}
          nameInputRef={nameInputRef}
          nameInputWidthCh={nameInputWidthCh}
          onEncounterNameDraftChange={(e) => {
            const s = e.target.value.slice(0, ENCOUNTER_NAME_MAX_CHARS);
            draftRef.current = s;
            setEncounterNameDraft(s);
            if (s.trim()) setEncounterNameError(null);
          }}
          onCommitEncounterName={tryCommitEncounterName}
          onBeginEditEncounterName={beginEditEncounterName}
          onEncounterNameFocus={() => {
            if (isRecording && !isRecordingPaused) {
              maybePauseForNameEdit();
            }
          }}
          elapsed={elapsed}
          liveMeterSamples={liveMeterSamples}
          liveMeterMode={liveMeterMode}
          isRecordingPaused={isRecordingPaused}
          sessionActive={sessionActive}
          sessionPausedMidCapture={sessionPausedMidCapture}
          onBack={handleBack}
          onStartRecording={handleStartRecording}
          onTogglePause={toggleRecordingPause}
          onEndRecording={handleEndRecording}
          bumpIdleRelock={bumpIdleRelock}
          screenLocked={screenLocked}
          onUnlockComplete={unlockScreen}
          showPendingBanner={pendingBannerVisible}
          onRetryUpload={() => navigate("/generate-note")}
          playLabel={playLabel}
          nameRowMaxClass={nameRowMaxClass}
          preVisitSummaryAttached={!!attachedPreVisitSummary}
          onPreVisitSummaryPress={handlePreVisitSummaryPress}
          onPreVisitSummaryDetach={handlePreVisitSummaryDetach}
        />
      </div>
      <AttachPreVisitSummaryOverlay
        open={attachOverlayOpen}
        attachedSummary={attachedPreVisitSummary}
        fullBleed={recordingFullViewport}
        onRequestClose={handleCloseAttachOverlay}
        onAttach={handleAttachPreVisitSummary}
        onNewPrep={() => {
          if (!confirmLeave()) return;
          allowLeaveRef.current = true;
          navigate("/new-pre-visit-summary");
        }}
        onViewAllSummaries={() => {
          if (!confirmLeave()) return;
          allowLeaveRef.current = true;
          navigate("/pre-visit-summary");
        }}
      />
      <PendingRecordingGuardModal
        open={guardModalOpen}
        label={pendingGuardLabel}
        onCancel={() => setGuardModalOpen(false)}
        onGoToGenerateNote={() => {
          setGuardModalOpen(false);
          navigate("/generate-note");
        }}
        onDiscard={async () => {
          if (
            !window.confirm(
              "Discard this recording? It cannot be recovered.",
            )
          ) {
            return;
          }
          const ctx = await getPendingRecordingContext();
          await discardPendingRecording(
            ctx.record?.id || ctx.metadata?.idbId,
          );
          setGuardModalOpen(false);
          void refreshPendingBanner();
        }}
      />
    </>
  );
}
