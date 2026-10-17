import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import * as api from "@/lib/api";
import * as ui from "@/utils/ui.js";
import * as format from "@/utils/format.js";
import * as validation from "@/utils/validation.js";
import * as background from "@/utils/background.js";
import { isNetworkError } from "@/utils/errors.js";
import { STORAGE_KEYS, STORAGE_PREFIX, parseStorageValue, getLastUsedNoteTemplateId, setLastUsedNoteTemplateId } from "@/utils/storageConfig.js";
import {
  discardPendingRecording,
  downloadPendingRecording,
  hasPendingRecording,
} from "@/utils/pendingRecordingGuard.js";
import { getPending, getPendingById } from "@/utils/pendingRecordingsDb.js";
import {
  formatPendingUploadUserMessage,
  isUploadedRecordingMetadata,
  normalizePendingMetadataForRetry,
  normalizeStaleUploadingMetadata,
  PENDING_UPLOAD_HANDOFF_ATTEMPTS,
  PENDING_UPLOAD_MANUAL_RETRY_ATTEMPTS,
  PENDING_UPLOAD_RESTORE_ATTEMPTS,
  resolvePendingIdbId,
  shouldAutoRetryPendingOnPageLoad,
  uploadRecordingFromPending,
} from "@/utils/uploadPendingRecording.js";
import {
  ENCOUNTER_NAME_MAX_CHARS,
  encounterNameFromPreVisitSummaryHandoff,
  normalizeAttachedPreVisitSummaryRef,
  persistAttachedPreVisitSummaryRef,
  readAttachedPreVisitSummaryFromHandoffState,
  readAttachedPreVisitSummaryFromRecordingMetadata,
  readStoredAttachedPreVisitSummary,
  withPreVisitSummaryOnRecordingMetadata,
} from "@/utils/visitPrepRecordingHandoff.js";
import ExportDataAsFileMenu from "@/components/ExportDataAsFileMenu.jsx";
import Auth from "@/components/Auth.jsx";
import Select from "@/components/Select.jsx";
import AttachPreVisitSummaryOverlay from "@/components/visitPrep/AttachPreVisitSummaryOverlay.jsx";
import PreVisitSummaryAttachControl from "@/components/visitPrep/PreVisitSummaryAttachControl.jsx";
import CopyToClipboard from "@/components/CopyToClipboard.jsx";
import ExpandableNoteTextarea from "@/components/ExpandableNoteTextarea.jsx";
// import LiveRecordingMeter from "@/components/LiveRecordingMeter.jsx";
// import {
//   BAR_COUNT,
//   meteringDbToBarDisplay,
// } from "@/utils/recordingMeter.js";

function mergePreVisitSummaryIntoRecordingMetadata(ref) {
  try {
    const raw = localStorage.getItem(
      STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
    );
    const metadata = raw ? JSON.parse(raw) : {};
    localStorage.setItem(
      STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
      JSON.stringify(withPreVisitSummaryOnRecordingMetadata(metadata, ref)),
    );
    return withPreVisitSummaryOnRecordingMetadata(metadata, ref);
  } catch (e) {
    console.warn("[GenerateNotePage] recording metadata pre-visit merge failed:", e);
    return null;
  }
}

export default function GenerateNotePage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Check for recordingPath URL parameter (from query string)
  const urlParams = new URLSearchParams(window.location.search);
  const urlRecordingPath = urlParams.get("recordingPath");

  // State for URL-loaded recording
  const [urlRecordingData, setUrlRecordingData] = useState(null);
  const [loadingUrlRecording, setLoadingUrlRecording] = useState(false);

  const recordingDurationRef = useRef(0);

  // State management
  const [activeSection, setActiveSection] = useState("upload");
  const [recordingFile, setRecordingFile] = useState(null);
  const [recordingFileMetadata, setRecordingFileMetadata] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const isUploading = currentStatus?.status === "uploading-recording";

  // Persistent fields
  const [noteText, setNoteText] = useState("");
  /** 'single' = one textarea; 'json-fields' = one textarea per top-level JSON key (values saved as plain strings) */
  const [noteLayout, setNoteLayout] = useState("single");
  // Generic JSON-root field editors (one textarea per top-level key)
  const [jsonFieldKeys, setJsonFieldKeys] = useState([]);
  const [jsonFieldTexts, setJsonFieldTexts] = useState({});
  /** Last JSON object from prompt-llm */
  const lastParsedLlmResultRef = useRef(null);
  const [patientEncounterName, setPatientEncounterName] = useState("");
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [attachedPreVisitSummary, setAttachedPreVisitSummary] = useState(() =>
    readStoredAttachedPreVisitSummary(),
  );
  const [attachOverlayOpen, setAttachOverlayOpen] = useState(false);

  const handleRecordingFileUploadRef = useRef(async () => {});
  const uploadInFlightRef = useRef(false);
  const pendingRestoreAttemptedRef = useRef(false);
  const startPendingUploadRef = useRef(async () => {});

  const setRecordingDuration = useCallback((duration) => {
    recordingDurationRef.current = duration;
  }, []);

  const applyAttachedPreVisitSummary = useCallback(
    (ref, { updateEncounterName = true } = {}) => {
      const normalized = ref?.id
        ? normalizeAttachedPreVisitSummaryRef(ref)
        : null;
      setAttachedPreVisitSummary(normalized);
      persistAttachedPreVisitSummaryRef(normalized);
      const mergedMetadata = mergePreVisitSummaryIntoRecordingMetadata(normalized);
      if (mergedMetadata) {
        setRecordingFileMetadata((current) =>
          current ? { ...current, ...mergedMetadata } : current,
        );
      }

      if (!updateEncounterName || !normalized) return;
      const fromTitle = encounterNameFromPreVisitSummaryHandoff(normalized);
      if (!fromTitle) return;
      setPatientEncounterName(fromTitle);
      try {
        localStorage.setItem(
          STORAGE_KEYS.newPatientEncounter.patientEncounterName,
          JSON.stringify(fromTitle),
        );
      } catch (e) {
        console.warn("[GenerateNotePage] encounter name persist failed:", e);
      }
    },
    [],
  );

  const handleAttachPreVisitSummary = useCallback(
    (handoff) => {
      const previousId = attachedPreVisitSummary?.id ?? null;
      const nextId = handoff?.id ?? null;
      applyAttachedPreVisitSummary(handoff, {
        updateEncounterName: nextId !== previousId,
      });
    },
    [applyAttachedPreVisitSummary, attachedPreVisitSummary?.id],
  );

  // Flag to prevent auto-save useEffects from running before initial restoration
  const [restorationComplete, setRestorationComplete] = useState(false);

  // Template dropdown state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // For rich text editing
  const handleEditableChange = (setter) => (e) => {
    setter(e.target.innerHTML);
  };

  // LocalStorage keys now use centralized config from storageConfig.js
  // Load recording file from localStorage on page mount only
  useEffect(() => {
    // Only load from localStorage if there's no URL recording being processed
    if (!urlRecordingPath && !loadingUrlRecording) {
      getLocalStorageRecordingFile().then(setRecordingFileMetadata);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore from localStorage on mount and enable Section 2 if any field exists
  useEffect(() => {
    console.log(
      "[GenerateNotePage] Restoring form data from localStorage...",
    );

    const name = parseStorageValue(
      STORAGE_KEYS.newPatientEncounter.patientEncounterName,
    );
    let note = parseStorageValue(STORAGE_KEYS.newPatientEncounter.note);
    // One-time migration from legacy per-section SOAP keys
    if (!String(note).trim()) {
      const subjective = parseStorageValue(
        `${STORAGE_PREFIX}soapSubjective`,
      );
      const objective = parseStorageValue(`${STORAGE_PREFIX}soapObjective`);
      const assessment = parseStorageValue(
        `${STORAGE_PREFIX}soapAssessment`,
      );
      const plan = parseStorageValue(`${STORAGE_PREFIX}soapPlan`);
      const parts = [
        subjective.trim() && `Subjective:\n${subjective}`,
        objective.trim() && `Objective:\n${objective}`,
        assessment.trim() && `Assessment:\n${assessment}`,
        plan.trim() && `Plan:\n${plan}`,
      ].filter(Boolean);
      if (parts.length) {
        note = parts.join("\n\n");
      }
    }
    console.log("[GenerateNotePage] Raw localStorage values:", {
      patientEncounterName: name ? `"${name.substring(0, 50)}..."` : "empty",
      note: note ? `"${String(note).substring(0, 50)}..."` : "empty",
    });

    console.log("[GenerateNotePage] Restored fields (has content):", {
      patientEncounterName: name.length > 0,
      note: String(note).length > 0,
    });

    console.log(
      "[GenerateNotePage] About to set state with parsed values:",
      {
        name: name.substring(0, 50),
        note: String(note).substring(0, 50),
      },
    );

    setPatientEncounterName(name);
    const attachedFromStorage = readStoredAttachedPreVisitSummary();
    if (attachedFromStorage) {
      setAttachedPreVisitSummary(attachedFromStorage);
    }
    let restoredLayout = "single";
    let restoredNote = "";
    if (
      note &&
      typeof note === "object" &&
      !Array.isArray(note) &&
      (note.__enscribeNoteLayout === "json-fields" ||
        note.__enscribeNoteLayout === "soap-four") &&
      note.fields &&
      typeof note.fields === "object"
    ) {
      restoredLayout = "json-fields";
      const restored = {};
      for (const [k, v] of Object.entries(note.fields)) {
        restored[k] = String(v ?? "");
      }
      setJsonFieldKeys(Object.keys(restored));
      setJsonFieldTexts(restored);
      lastParsedLlmResultRef.current = restored;
    } else {
      restoredNote = note === undefined || note === null ? "" : String(note);
    }
    setNoteLayout(restoredLayout);
    setNoteText(restoredNote);

    console.log("[GenerateNotePage] State setters called");

    // If any field has data, enable section 2
    const hasData = name.trim() || String(note).trim();

    if (hasData) {
      console.log(
        "[GenerateNotePage] Found restored data, expanding Section 2",
      );
      setSoapNoteRequested(true);
    } else {
      console.log(
        "[GenerateNotePage] No saved form data found in localStorage",
      );
    }

    // Mark restoration as complete - NOW auto-save useEffects can run
    setRestorationComplete(true);
    console.log(
      "[GenerateNotePage] Restoration complete, auto-save effects enabled",
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch templates for dropdown
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const result = await api.fetchWithRefreshRetry("/api/note-templates/complete", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!result.success) {
          console.error("Error fetching templates:", result.error);
          if (result.status === 401) {
            navigate("/login");
          }
          setLoadingTemplates(false);
          return;
        }

        const data = await result.response.json();
        const allTemplates = data.templates || [];
        
        // Sort templates by creation date (newest first)
        allTemplates.sort((a, b) => {
          const aTime = new Date(a.created_at).getTime();
          const bTime = new Date(b.created_at).getTime();
          return bTime - aTime;
        });

        setTemplates(allTemplates);
        setLoadingTemplates(false);
        
        // Restore last used template if it exists
        const lastUsedId = getLastUsedNoteTemplateId();
        if (lastUsedId) {
          const lastUsedTemplate = allTemplates.find(
            (t) => t.id.toString() === lastUsedId.toString()
          );
          if (lastUsedTemplate) {
            setSelectedTemplate(lastUsedTemplate);
            console.log("[GenerateNotePage] Restored template:", lastUsedTemplate.name);
          }
        }
      } catch (error) {
        console.error("Error fetching templates:", error);
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save last used template ID whenever it changes
  useEffect(() => {
    if (selectedTemplate && restorationComplete) {
      setLastUsedNoteTemplateId(selectedTemplate.id);
      console.log("[GenerateNotePage] Saved template:", selectedTemplate.name);
    }
  }, [selectedTemplate, restorationComplete]);

  // Handle URL recording parameter
  useEffect(() => {
    const loadRecordingFromUrl = async () => {
      if (!urlRecordingPath) {
        // No URL recording, allow localStorage loading
        setLoadingUrlRecording(false);
        return;
      }

      setLoadingUrlRecording(true);
      try {
        // Create signed URL for the recording using api singleton
        const result = await api.fetchWithRefreshRetry(
          "/api/recordings/create-signed-url",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: urlRecordingPath }),
          },
        );

        if (!result.success) {
          console.error(
            "Error creating signed URL for URL recording:",
            result.error,
          );
          alert(
            "Failed to load recording from URL. Please try again or upload the file manually.",
          );
          setLoadingUrlRecording(false);
          return;
        }

        const response = result.response;
        if (!response.ok) {
          console.error(
            "Error creating signed URL for URL recording:",
            response.statusText,
          );
          alert(
            "Failed to load recording from URL. Please try again or upload the file manually.",
          );
          setLoadingUrlRecording(false);
          return;
        }

        const signedUrlData = await response.json();
        if (!signedUrlData?.signedUrl) {
          console.error(
            "Error creating signed URL for URL recording: no signedUrl in response",
          );
          alert(
            "Failed to load recording from URL. Please try again or upload the file manually.",
          );
          setLoadingUrlRecording(false);
          return;
        }
        // Extract filename from path
        const fileName =
          format.extractRecordingFilenameFromPath(urlRecordingPath);

        // Create metadata object similar to upload flow
        const metadata = {
          status: "uploaded",
          path: urlRecordingPath,
          signedUrl: signedUrlData.signedUrl,
          name: fileName,
          // Note: size and duration not available from URL, but path is most important
          fromUrl: true, // Flag to indicate this came from URL
        };

        // Store in localStorage like the upload flow does
        localStorage.setItem(
          STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
          JSON.stringify(metadata),
        );

        // Set both URL recording data and recordingFileMetadata for consistency
        setUrlRecordingData(metadata);
        setRecordingFileMetadata(metadata);

        // Note: We enable the SOAP note section but don't automatically open it
        // User should stay on section 1 to see the loaded recording and click "Generate Note"
        setSoapNoteRequested(true);
        // Keep user on section 1 (upload) to see the loaded recording

        console.log("Loaded recording from URL and saved to localStorage:", {
          path: urlRecordingPath,
          fileName,
          signedUrl: signedUrlData.signedUrl,
          metadata,
        });
      } catch (error) {
        console.error("Error loading recording from URL:", error);
        alert(
          "Failed to load recording from URL. Please try again or upload the file manually.",
        );
      } finally {
        setLoadingUrlRecording(false);
      }
    };

    loadRecordingFromUrl();
  }, [
    urlRecordingPath,
    STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
  ]); // Remove supabase from dependency array since it's stable

  useEffect(() => {
    if (!restorationComplete || urlRecordingPath) return;
    if (attachedPreVisitSummary?.id) return;

    try {
      const raw = localStorage.getItem(
        STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
      );
      if (!raw) return;
      const metadata = JSON.parse(raw);
      const fromMetadata = readAttachedPreVisitSummaryFromRecordingMetadata(metadata);
      if (fromMetadata) {
        setAttachedPreVisitSummary(fromMetadata);
        persistAttachedPreVisitSummaryRef(fromMetadata);
      }
    } catch (e) {
      console.warn("[GenerateNotePage] metadata pre-visit restore failed:", e);
    }
  }, [attachedPreVisitSummary?.id, restorationComplete, urlRecordingPath]);

  useEffect(() => {
    if (!restorationComplete) return;
    persistAttachedPreVisitSummaryRef(attachedPreVisitSummary);
  }, [attachedPreVisitSummary, restorationComplete]);

  // Save to localStorage on change (with JSON stringify for proper serialization)
  // Only run AFTER restoration is complete to avoid overwriting with empty initial state
  useEffect(() => {
    if (!restorationComplete) return;
    localStorage.setItem(
      STORAGE_KEYS.newPatientEncounter.patientEncounterName,
      JSON.stringify(patientEncounterName),
    );
  }, [
    patientEncounterName,
    STORAGE_KEYS.newPatientEncounter.patientEncounterName,
    restorationComplete,
  ]);
  useEffect(() => {
    if (!restorationComplete) return;
    if (noteLayout === "json-fields") {
      localStorage.setItem(
        STORAGE_KEYS.newPatientEncounter.note,
        JSON.stringify({
          __enscribeNoteLayout: "json-fields",
          fields: jsonFieldTexts,
        }),
      );
    } else {
      localStorage.setItem(
        STORAGE_KEYS.newPatientEncounter.note,
        JSON.stringify(noteText),
      );
    }
  }, [
    noteText,
    noteLayout,
    jsonFieldTexts,
    STORAGE_KEYS.newPatientEncounter.note,
    restorationComplete,
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // New: Track if save was attempted
  const [saveAttempted, setSaveAttempted] = useState(false);

  // Track if SOAP note generation has started
  const [soapNoteRequested, setSoapNoteRequested] = useState(false);

  // Error message for missing fields
  const [errorMessage, setErrorMessage] = useState("");

  // Cache incognito/localStorage/cookie checks to run once on mount
  const [incognitoStatus, setIncognitoStatus] = useState(null);
  const [storageQuotaInfo, setStorageQuotaInfo] = useState(null);
  const [cookiesWork, setCookiesWork] = useState(null);
  const [localStorageAccessible, setLocalStorageAccessible] = useState(null);
  // Cache Supabase auth/session info on mount to avoid "split-brain" later
  const [
    refreshTokenCookieAvailableOnMount,
    setRefreshTokenCookieAvailableOnMount,
  ] = useState(null);
  const [jwtOnMount, setJwtOnMount] = useState(null);

  // Run storage/cookie/incognito checks once when the page mounts so
  // subsequent flows can use cached results (helps with incognito detection)
  const isMountedRef = useRef(true);

  const runStartupChecks = useCallback(async () => {
    try {
      const inc = await detectIncognitoMode();
      const storage = await getStorageQuota();
      // Check for server-visible refresh cookie (HttpOnly cookies not visible to JS)
      const refreshCookieExists = await api.checkRefreshCookie();

      let lsOk = true;
      try {
        localStorage.setItem("enscribe_localstorage_test", "1");
        localStorage.removeItem("enscribe_localstorage_test");
        lsOk = true;
      } catch (e) {
        lsOk = false;
      }

      // JWT and refresh token checks for incognito detection
      let jwt = null;
      let refreshTokenCookieAvailable = false;
      let effectiveCookies = false;

      try {
        jwt = api.getJWT();
        refreshTokenCookieAvailable = !!refreshCookieExists;
        // effectiveCookies represents whether cookies generally worked and the refresh cookie is present
        effectiveCookies = refreshCookieExists;
      } catch (e) {
        console.warn("JWT/refreshCookie checks failed:", e);
        jwt = null;
        refreshTokenCookieAvailable = false;
        effectiveCookies = false;
      }

      const result = {
        incognitoStatus: inc,
        storageQuotaInfo: storage,
        cookiesWork: effectiveCookies,
        localStorageAccessible: lsOk,
        refreshTokenCookieAvailable,
        jwtPresent: !!jwt,
      };

      if (isMountedRef.current) {
        setRefreshTokenCookieAvailableOnMount(refreshTokenCookieAvailable);
        setJwtOnMount(jwt || null);
        setCookiesWork(effectiveCookies);
        setIncognitoStatus(inc);
        setStorageQuotaInfo(storage);
        setLocalStorageAccessible(lsOk);
      }

      console.log("Startup checks:", result);
      return result;
    } catch (e) {
      const errorResult = {
        incognitoStatus: null,
        storageQuotaInfo: null,
        cookiesWork: false,
        localStorageAccessible: false,
        refreshTokenCookieAvailable: false,
        jwtPresent: false,
      };

      if (isMountedRef.current) {
        setIncognitoStatus(null);
        setStorageQuotaInfo(null);
        setCookiesWork(false);
        setLocalStorageAccessible(false);
        setRefreshTokenCookieAvailableOnMount(false);
        setJwtOnMount(null);
      }

      return errorResult;
    }
  }, []);

  const handleAuthError = useCallback(
    (diagnosticData) => {
      console.error(
        "[handleAuthError] Authentication failed - diagnostic analysis:",
        diagnosticData,
      );

      let errorMessage = "You must be logged in to upload recordings.";

      if (diagnosticData.isIncognito === "localhost-incognito") {
        errorMessage =
          "Your session has expired in incognito/private mode on localhost.\n\n" +
          "Note: Localhost has relaxed incognito restrictions, but session tokens may still expire. " +
          "Please log in again.";
      } else if (
        diagnosticData.isIncognito === true &&
        diagnosticData.jwtPresent
      ) {
        errorMessage =
          "Your session has expired in incognito/private mode.\n\n" +
          "Incognito mode blocks refresh token cookies needed to maintain long sessions. " +
          "Please log in again or use normal browsing mode for better session persistence.";
      } else if (diagnosticData.isIncognito === true) {
        errorMessage +=
          "\n\nIncognito/Private mode detected. This may cause authentication issues due to restricted cookies and storage.";
      } else if (diagnosticData.isIncognito === "localhost-normal") {
        errorMessage +=
          "\n\nRunning on localhost with relaxed incognito restrictions.";
      } else if (!diagnosticData.jwtPresent) {
        errorMessage += "\n\nPlease log in to continue.";
      }

      alert(errorMessage);
      api.handleSignOut();
      navigate("/login");
      return;
    },
    [navigate],
  );
  useEffect(() => {
    isMountedRef.current = true;

    runStartupChecks().then((diagnosticData) => {
      console.log(
        "[GenerateNotePage] Startup checks complete:",
        diagnosticData,
      );

      // Only show error if incognito mode is detected (storage actually restricted)
      // Don't block on other checks - they're just informational
      if (diagnosticData.isIncognito === true) {
        console.warn("[GenerateNotePage] Actual incognito mode detected");
        handleAuthError(diagnosticData);
        return;
      }

      // Log other conditions for debugging but don't block
      if (diagnosticData.isIncognito === "localhost-incognito") {
        console.warn("[GenerateNotePage] Localhost incognito detected");
      }
      if (diagnosticData.localStorageAccessible === false) {
        console.warn("[GenerateNotePage] localStorage not accessible");
      }
      if (diagnosticData.jwtPresent === false) {
        console.warn("[GenerateNotePage] JWT not present");
      }
    });

    return () => {
      isMountedRef.current = false;
    };
  }, [navigate, runStartupChecks, handleAuthError]);

  const getLocalStorageRecordingFile = async () => {
    const metadataStr = localStorage.getItem(
      STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
    );
    if (!metadataStr) return null;

    try {
      const metadata = JSON.parse(metadataStr);

      if (
        metadata.status === "local" ||
        metadata.status === "failed" ||
        metadata.status === "uploading"
      ) {
        return metadata.status === "uploading"
          ? { ...metadata, status: "local" }
          : metadata;
      }

      if (!metadata.path) {
        return metadata;
      }

      // Get a signed URL from backend using refresh-retry auth
      try {
        console.log("localStorage Metadata:", metadata);
        console.log(
          "[getLocalStorageRecordingFile] Fetching signed URL for stored recording:",
          metadata.path,
        );
        const result = await api.fetchWithRefreshRetry(
          "/api/recordings/create-signed-url",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: metadata.path }),
          },
        );

        if (!result.success) {
          console.warn(
            "Error creating signed URL for stored recording:",
            result.error,
          );
          // Return metadata without signed URL
          return {
            ...metadata,
            signedUrl: null,
            name:
              metadata.path && typeof metadata.path === "string"
                ? metadata.path.split("/")[metadata.path.split("/").length - 1]
                : "recording.webm",
          };
        }

        const response = result.response;
        if (!response.ok) {
          console.warn(
            "Error creating signed URL for stored recording:",
            response.statusText,
          );
          // Return metadata without signed URL
          return {
            ...metadata,
            signedUrl: null,
            name:
              metadata.path && typeof metadata.path === "string"
                ? metadata.path.split("/")[metadata.path.split("/").length - 1]
                : "recording.webm",
          };
        }

        const signedUrlData = await response.json();
        console.log(
          "[getLocalStorageRecordingFile]: recordingFileMetadata:",
          metadata,
          "signedUrl:",
          signedUrlData.signedUrl,
          "isuploading:",
          isUploading,
        );
        return {
          ...metadata,
          signedUrl: signedUrlData.signedUrl,
          name:
            metadata.path && typeof metadata.path === "string"
              ? metadata.path.split("/")[metadata.path.split("/").length - 1]
              : "recording.webm",
          // size and duration are now included from stored metadata
        };
      } catch (error) {
        console.error("Error creating signed URL for stored recording:", error);
        // Return metadata without signed URL
        return {
          ...metadata,
          signedUrl: null,
          name:
            metadata.path && typeof metadata.path === "string"
              ? metadata.path.split("/")[metadata.path.split("/").length - 1]
              : "recording.webm",
        };
      }
    } catch (e) {
      console.error("Error parsing recording file metadata:", e);
      return null;
    }
  };
  // useEffect(() => {
  //   background.debugElements({
  //     currentStatus,
  //     isProcessing,
  //     isUploading,
  //     soapNoteRequested,
  //     recordingFileMetadata,
  //     isRecording,
  //     soapSubjective,
  //     soapObjective,
  //     soapAssessment,
  //     soapPlan,
  //     billingSuggestion,
  //     patientEncounterName,
  //     audioDuration,
  //     audioCurrentTime,
  //     audioLoadingState,
  //     isSaving,
  //     saveAttempted,
  //     errorMessage,
  //   });
  // }, [
  //   currentStatus,
  //   isProcessing,
  //   isUploading,
  //   soapNoteRequested,
  //   recordingFileMetadata,
  //   isRecording,
  //   soapSubjective,
  //   soapObjective,
  //   soapAssessment,
  //   soapPlan,
  //   billingSuggestion,
  //   patientEncounterName,
  //   audioDuration,
  //   audioCurrentTime,
  //   audioLoadingState,
  //   isSaving,
  //   saveAttempted,
  //   errorMessage,
  // ]);

  // File validation
  const validateFile = (file) => {
    const validTypes = [
      "audio/mp3",
      "audio/mpeg",
      "audio/wav",
      "audio/webm",
      "audio/ogg",
      "video/webm",
      "video/mp4",
      "video/mp4", // Add MP4 support
      "audio/mp4", // Add MP4 audio support
      "audio/m4a", // Add M4A support
      "audio/x-m4a", // Add alternative M4A MIME type
    ];
    if (!validTypes.some((type) => file.type.includes(type))) {
      return "File must be in a supported audio format (MP3, WAV, WebM, OGG, MP4, M4A)";
    }
    if (file.size > 100 * 1024 * 1024) {
      // 100MB
      return "File size must be less than 100MB";
    }
    return null;
  };

  // Poll for file accessibility on Supabase (verify upload is complete and accessible)
  const pollForFileAccessibility = async (signedUrl, maxWaitMs = 5000) => {
    console.log(
      "[pollForFileAccessibility] Starting poll for URL accessibility:",
      {
        url: signedUrl.substring(0, 50) + "...",
        maxWaitMs,
      },
    );

    return new Promise((resolve) => {
      let isResolved = false;
      const startTime = Date.now();
      const pollIntervalMs = 500;

      // Wait 500ms offset before first poll to let Supabase process
      const initialDelay = setTimeout(() => {
        const poll = setInterval(() => {
          const elapsedMs = Date.now() - startTime;

          // Check if we've exceeded timeout
          if (elapsedMs > maxWaitMs) {
            console.warn(
              "[pollForFileAccessibility] Timeout reached, stopping poll",
            );
            clearInterval(poll);
            if (!isResolved) {
              isResolved = true;
              resolve(false); // Return false on timeout
            }
            return;
          }

          // Attempt to fetch file headers to verify accessibility
          fetch(signedUrl, { method: "HEAD" })
            .then((response) => {
              console.log("[pollForFileAccessibility] HEAD request returned:", {
                status: response.status,
                ok: response.ok,
                elapsedMs,
              });

              if (response.ok && !isResolved) {
                isResolved = true;
                clearInterval(poll);
                clearTimeout(initialDelay);
                console.log(
                  "[pollForFileAccessibility] File is accessible, stopping poll",
                );
                resolve(true);
              }
            })
            .catch((error) => {
              console.log(
                "[pollForFileAccessibility] HEAD request failed (expected during polling):",
                {
                  error: error.message,
                  elapsedMs,
                },
              );
              // Continue polling on error
            });
        }, pollIntervalMs);
      }, 500); // 500ms initial offset
    });
  };

  // Get audio duration
  const getAudioDuration = async (file) => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();

      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
        audio.removeEventListener("error", onError);
        if (audio.src) URL.revokeObjectURL(audio.src);
      };

      console.log("Getting audio duration for file:", {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      const fallbackDuration = () => {
        // Try ref first to avoid stale state
        const duration = recordingDurationRef.current;
        setRecordingDuration(duration);
        if (duration > 0) {
          console.warn(`Using recordingDurationRef: ${duration} seconds`);
          return duration;
        }
        // As last resort, estimate based on size (~1 KB ≈ 1 sec for WebM)
        const estimated = Math.max(1, file.size / 1024);
        console.warn(`Using estimated duration: ${estimated} seconds`);
        return estimated;
      };

      const onLoadedMetadata = () => {
        cleanup();
        if (isFinite(audio.duration) && audio.duration > 0) {
          console.log("Audio duration obtained:", audio.duration);
          resolve(audio.duration);
        } else {
          resolve(fallbackDuration());
        }
      };

      const onError = () => {
        cleanup();
        resolve(fallbackDuration());
      };

      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("error", onError);
      audio.src = URL.createObjectURL(file);

      // Timeout after 10s
      setTimeout(() => {
        cleanup();
        resolve(fallbackDuration());
      }, 10000);
    });
  };

  // Helper function to detect incognito/private browsing mode
  const detectIncognitoMode = async () => {
    try {
      // Simple test: try to write to localStorage
      const testKey = "incognito-test-" + Math.random();
      try {
        localStorage.setItem(testKey, "test");
        localStorage.removeItem(testKey);
        // If we got here, localStorage works fine - not in incognito
        return false;
      } catch (e) {
        // localStorage is restricted - likely incognito mode
        return true;
      }
    } catch (e) {
      // If we can't determine, assume normal mode
      return false;
    }
  };

  // Helper to get storage quota information
  const getStorageQuota = async () => {
    try {
      if ("storage" in navigator && "estimate" in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          quota: Math.round(estimate.quota / (1024 * 1024)) + "MB",
          usage: Math.round(estimate.usage / (1024 * 1024)) + "MB",
          available:
            Math.round((estimate.quota - estimate.usage) / (1024 * 1024)) +
            "MB",
        };
      }
      return null;
    } catch (e) {
      return { error: e.message };
    }
  };

  // Helper to test third-party cookie functionality
  const testThirdPartyCookies = async () => {
    try {
      // Test if we can set a cookie
      document.cookie = "test-cookie=test-value; SameSite=None; Secure";
      const cookieSet = document.cookie.includes("test-cookie=test-value");

      // Clean up
      document.cookie =
        "test-cookie=; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";

      return cookieSet;
    } catch (e) {
      return false;
    }
  };

  // Helper function to clear all auth-related storage when sessions get corrupted
  const clearAllAuthState = async () => {
    try {
      // Supabase sessions are now managed by singleton in api.js
      // Just clear localStorage and sessionStorage entries
      Object.keys(localStorage).forEach((key) => {
        if (
          key.includes("supabase") ||
          key.includes("sb-") ||
          key.includes("auth")
        ) {
          localStorage.removeItem(key);
        }
      });

      // Clear sessionStorage entries
      Object.keys(sessionStorage).forEach((key) => {
        if (
          key.includes("supabase") ||
          key.includes("sb-") ||
          key.includes("auth")
        ) {
          sessionStorage.removeItem(key);
        }
      });

      // Clear API JWT
      api.deleteJWT();

      console.log("[clearAllAuthState] Cleared all authentication state");
    } catch (e) {
      console.error("[clearAllAuthState] Error clearing auth state:", e);
    }
  };

  // Helper: call server refresh endpoint and return accessToken (or null)
  const refreshAndGetAccessToken = async () => {
    try {
      const resp = await api.fetchWithRefresh("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!resp.ok) {
        return null;
      }
      console.log("refreshAndGetAccessToken response:", resp);
      const body = await resp.json();
      return body?.accessToken || null;
    } catch (e) {
      console.error("refreshAndGetAccessToken error:", e);
      return null;
    }
  };
  // Wrapper around two-step upload process: get signed URL + XHR upload
  const uploadWithReactiveAuth = async (fileName, file, onProgress) => {
    try {
      // Step 1: Get signed URL from backend using Tier 3 (refresh-retry) auth
      console.log("[uploadWithReactiveAuth] Step 1: Fetching signed URL...");
      const result = await api.fetchWithRefreshRetry(
        "/api/recordings/create-signed-upload-url",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: fileName }),
        },
      );

      if (!result.success) {
        if (result.status === 401) {
          throw Object.assign(
            new Error(result.error || "Not authenticated"),
            { requiresLogin: true },
          );
        }
        throw new Error(`Failed to get signed URL: ${result.error}`);
      }

      const signedUrlResponse = result.response;
      if (!signedUrlResponse.ok) {
        if (signedUrlResponse.status === 401) {
          throw Object.assign(new Error("Not authenticated"), {
            requiresLogin: true,
          });
        }
        const errorData = await signedUrlResponse.json().catch(() => ({}));
        throw new Error(
          `Failed to get signed URL: ${errorData.message || signedUrlResponse.statusText}`,
        );
      }

      const { signedUrl, path } = await signedUrlResponse.json();
      console.log("[uploadWithReactiveAuth] Step 1 complete, got signed URL");

      // Step 2: Upload file to signed URL using XHR with progress tracking
      console.log(
        "[uploadWithReactiveAuth] Step 2: Uploading to signed URL via XHR...",
      );
      await api.xhrUploadToSignedUrl(signedUrl, file, onProgress);
      console.log(
        "[uploadWithReactiveAuth] Step 2 complete, upload successful",
      );

      return { data: { path, id: path }, error: null };
    } catch (error) {
      // Handle specific error: file too large (413)
      const message = error?.message;
      if (
        message?.includes("exceeded the maximum allowed size") ||
        message?.includes("File too large")
      ) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const fileTooLargeError = new Error(
          `File too large (${fileSizeMB}MB). Maximum allowed size is 100MB.`,
        );
        return {
          data: null,
          error: fileTooLargeError,
          isFileTooLarge: true,
        };
      }
      // Return error structure for other errors
      return {
        data: null,
        error: error,
        requiresLogin:
          error?.requiresLogin === true ||
          error?.message?.includes("not authenticated") ||
          error?.message?.includes("Invalid session"),
      };
    }
  };
  const PENDING_BLOCKS_FILE_UPLOAD_MSG =
    "You have a recording saved on this device that is not uploaded yet. Finish or discard it from Generate Note before uploading a different file.";

  // Handle file upload (picker handoff only — does not read/write IndexedDB)
  const handleRecordingFileUpload = async (file) => {
    if (!file) return;
    if (uploadInFlightRef.current) return;

    if (await hasPendingRecording()) {
      setCurrentStatus({
        status: "error",
        message: PENDING_BLOCKS_FILE_UPLOAD_MSG,
        uploadSource: "file-picker",
      });
      alert(PENDING_BLOCKS_FILE_UPLOAD_MSG);
      return;
    }

    uploadInFlightRef.current = true;

    // Capture the file upload start time for encounter naming (only if not already set by startRecording)
    if (!recordingStartTime) {
      setRecordingStartTime(new Date());
    }

    // Validate file type and size FIRST, before any async operations
    const validationError = validateFile(file);
    if (validationError) {
      console.error(
        "[handleRecordingFileUpload] Validation failed:",
        validationError,
      );
      alert(validationError);
      uploadInFlightRef.current = false;
      return;
    }

    try {
      // Check duration - log warning but don't block (file size is the actual constraint)
      const duration = await getAudioDuration(file);
      if (duration > 40 * 60) {
        // 40 minutes
        const durationWarning = `Recording duration (${Math.round(duration / 60)} minutes) exceeds typical 40-minute limit`;
        console.warn(
          "[handleRecordingFileUpload] Duration warning:",
          durationWarning,
        );
        // Proceed with upload - file size enforcement takes precedence
      }
      console.log("File metadata:", {
        name: file.name,
        size: file.size,
        type: file.type,
        duration,
      });
      // Show uploading status with 0% progress
      setCurrentStatus({
        status: "uploading-recording",
        message: "Uploading recording",
        progress: 0,
      });
      setIsSaving(true);

      const authUser = await api.resolveAuthenticatedAppUser({ refresh: true });
      if (!authUser.success) {
        setIsSaving(false);
        setCurrentStatus({
          status: "error",
          message: authUser.error || "Not logged in",
          uploadSource: "file-picker",
        });
        if (authUser.requiresLogin) {
          alert("Session expired. Please log in again.");
          api.deleteJWT();
          navigate("/login");
        } else if (authUser.networkError) {
          alert(
            "Could not verify your session. Check your internet connection and try again.",
          );
        } else {
          alert(authUser.error || "Could not verify your session.");
        }
        uploadInFlightRef.current = false;
        return;
      }

      const { email } = authUser;
      // Get extension from uploaded file name
      const originalName = file.name || "audio";
      const lastDot = originalName.lastIndexOf(".");
      const extension =
        lastDot !== -1 ? originalName.substring(lastDot + 1).toLowerCase() : "";
      const fileName = `${email}-${Date.now()}-${Math.floor(Math.random() * 100)
        .toString()
        .padStart(2, "0")}${extension ? `.${extension}` : ""}`;
      console.log("[handleRecordingFileUpload] constructed filename:", { fileName });

      // Define progress callback to update UI with upload percentage
      const onProgress = (progress) => {
        console.log(
          "[handleRecordingFileUpload] onProgress callback triggered:",
          progress,
        );
        setCurrentStatus((prev) => {
          const newStatus = {
            ...prev,
            progress: progress.percent || 0,
            message: "Uploading recording",
          };
          console.log(
            "[handleRecordingFileUpload] setCurrentStatus with:",
            newStatus,
          );
          return newStatus;
        });
      };

      // Attempt upload with auth validation and progress tracking
      console.log(
        "[handleRecordingFileUpload] Calling uploadWithReactiveAuth (Tier 2)...",
      );
      const uploadResult = await uploadWithReactiveAuth(
        fileName,
        file,
        onProgress,
      );
      console.log(
        "[handleRecordingFileUpload] uploadWithReactiveAuth returned:",
        {
          hasError: !!uploadResult?.error,
          hasData: !!uploadResult?.data,
          requiresLogin: uploadResult?.requiresLogin,
          errorMessage: uploadResult?.error?.message,
          dataPath: uploadResult?.data?.path,
        },
      );

      setIsSaving(false);

      if (uploadResult?.requiresLogin) {
        alert("Session expired. Please log in again.");
        api.deleteJWT();
        navigate("/login");
        return;
      }

      const { data, error } = uploadResult;

      console.log("[handleRecordingFileUpload] uploadResult.data:", {
        path: data?.path,
        id: data?.id,
        fullPath: data?.fullPath,
      });

      if (error || !data || !data?.path) {
        const errorMessage = error?.message || "Upload failed";
        setCurrentStatus({
          status: "error",
          message: errorMessage,
          uploadSource: "file-picker",
        });

        // Provide better error messaging
        if (uploadResult?.isFileTooLarge) {
          alert(
            errorMessage +
              "\n\nPlease record a shorter session or use a higher quality setting to reduce file size.",
          );
        } else {
          alert("Error uploading recording: " + errorMessage);
        }
        return;
      }

      // Clear prior picker/URL metadata only (never touches IndexedDB pending blobs)
      localStorage.removeItem(STORAGE_KEYS.newPatientEncounter.recordingFile);
      localStorage.removeItem(
        STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
      );
      setRecordingFile(null);
      setRecordingDuration(0);
      setRecordingFileMetadata(null);

      // Get signed URL for the uploaded file to enable playback
      console.log(
        "[handleRecordingFileUpload] Getting signed URL for playback...",
      );
      let signedUrl = null;
      try {
        const result = await api.fetchWithRefreshRetry(
          "/api/recordings/create-signed-url",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: data.path }),
          },
        );

        if (!result.success) {
          console.warn(
            "[handleRecordingFileUpload] Failed to get signed URL:",
            result.error,
          );
        } else {
          const response = result.response;
          if (!response.ok) {
            console.warn(
              "[handleRecordingFileUpload] Failed to get signed URL:",
              response.statusText,
            );
          } else {
            const signedUrlData = await response.json();
            console.log(
              "[handleRecordingFileUpload] Received signed URL data:",
              signedUrlData,
            );
            signedUrl = signedUrlData.signedUrl;
            console.log(
              "[handleRecordingFileUpload] Got signed URL, polling for accessibility...",
            );

            // Poll to verify file is accessible before proceeding
            const isAccessible = await pollForFileAccessibility(signedUrl);
            if (isAccessible) {
              console.log(
                "[handleRecordingFileUpload] File confirmed accessible",
              );
            } else {
              console.warn(
                "[handleRecordingFileUpload] File accessibility poll timed out (may still work)",
              );
            }
          }
        }
      } catch (signedUrlError) {
        console.warn(
          "[handleRecordingFileUpload] Error getting signed URL:",
          signedUrlError,
        );
      }

      // Save enhanced metadata for later use - use upload response + our calculations
      const metadata = {
        status: "uploaded",
        source: "file-picker",
        path: data.path,
        id: data.id,
        fullPath: data.fullPath,
        name: fileName, // Frontend-generated filename (email-timestamp-random.ext)
        size: file.size, // File size from upload
        duration, // Duration calculated from getAudioDuration
        signedUrl: signedUrl, // Signed URL for playback
      };

      console.log("File uploaded successfully - metadata being saved:", {
        metadataPath: metadata.path,
        pathLength: metadata.path?.length,
        pathParts: metadata.path?.split("/"),
      });

      // Store with new key name
      localStorage.setItem(
        STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
        JSON.stringify(metadata),
      );

      // Verify what was actually saved
      const savedMetadata = JSON.parse(
        localStorage.getItem(
          STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
        ),
      );
      console.log("Metadata saved to localStorage - verification:", {
        savedPath: savedMetadata?.path,
        pathLength: savedMetadata?.path?.length,
        pathParts: savedMetadata?.path?.split("/"),
      });

      // Update local state
      setRecordingFile(file);
      setRecordingDuration(duration);
      setRecordingFileMetadata(metadata);

      setCurrentStatus({ status: "success", message: "Recording Ready" });
    } catch (error) {
      setIsSaving(false);
      setCurrentStatus({
        status: "error",
        message: error.message,
        uploadSource: "file-picker",
      });
      setIsProcessing(false);
      console.error("Error processing or uploading audio file:", error);
      alert(
        "Error processing or uploading audio file. Please ensure it's a valid audio file.",
      );
    } finally {
      uploadInFlightRef.current = false;
    }
  };

  handleRecordingFileUploadRef.current = handleRecordingFileUpload;

  useEffect(() => {
    const file = location.state?.fileToUpload;
    const handoffId = location.state?.uploadHandoffId;
    if (!(file instanceof File) || typeof handoffId !== "string" || !handoffId) {
      return;
    }
    const markKey = `enscribe_file_upload_handoff_${handoffId}`;
    if (sessionStorage.getItem(markKey)) {
      return;
    }
    sessionStorage.setItem(markKey, "1");
    pendingRestoreAttemptedRef.current = true;
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: {} },
    );
    void handleRecordingFileUploadRef.current(file);
  }, [location.state, location.pathname, location.search, navigate]);

  const startPendingUpload = useCallback(
    async (idbId, { maxAttempts = PENDING_UPLOAD_HANDOFF_ATTEMPTS } = {}) => {
      if (!idbId || uploadInFlightRef.current) return;

      const applyUploadedMetadata = (meta) => {
        setRecordingFileMetadata(meta);
        setRecordingDuration(meta.duration || 0);
        setCurrentStatus({ status: "success", message: "Recording Ready" });
      };

      const runUpload = async () => {
        uploadInFlightRef.current = true;
        setIsSaving(true);
        setCurrentStatus({
          status: "uploading-recording",
          message: "Uploading recording",
          progress: 0,
        });
        try {
          const result = await uploadRecordingFromPending({
            idbId,
            maxAttempts,
            onProgress: (percent) => {
              setCurrentStatus({
                status: "uploading-recording",
                message: "Uploading recording",
                progress: percent,
              });
            },
          });
          if (result?.paused) {
            setRecordingFileMetadata(result.metadata);
            setCurrentStatus({
              status: "error",
              message: formatPendingUploadUserMessage({
                lastError: result.metadata?.lastError,
                attempts: result.metadata?.attempts ?? 0,
              }),
            });
            return;
          }
          applyUploadedMetadata(result.metadata);
        } catch (error) {
          if (error?.requiresLogin) {
            pendingRestoreAttemptedRef.current = false;
            alert("Session expired. Please log in again.");
            api.deleteJWT();
            navigate("/login");
            return;
          }
          let meta = null;
          try {
            const raw = localStorage.getItem(
              STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
            );
            meta = raw ? JSON.parse(raw) : null;
          } catch {
            meta = null;
          }
          if (isUploadedRecordingMetadata(meta, idbId)) {
            applyUploadedMetadata(meta);
            return;
          }
          if (meta) {
            setRecordingFileMetadata(meta);
          }
          const attempts = meta?.attempts ?? 0;
          setCurrentStatus({
            status: "error",
            message: formatPendingUploadUserMessage({
              lastError: meta?.lastError || error?.message,
              attempts,
            }),
          });
        } finally {
          setIsSaving(false);
          uploadInFlightRef.current = false;
        }
      };

      if (typeof navigator !== "undefined" && navigator.locks?.request) {
        try {
          await navigator.locks.request(
            `upload:${idbId}`,
            { ifAvailable: true },
            async (lock) => {
              if (!lock) {
                try {
                  const raw = localStorage.getItem(
                    STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
                  );
                  const meta = raw ? JSON.parse(raw) : null;
                  if (isUploadedRecordingMetadata(meta, idbId)) {
                    applyUploadedMetadata(meta);
                  }
                } catch {
                  /* ignore */
                }
                return;
              }
              await runUpload();
            },
          );
          return;
        } catch (e) {
          console.warn("[GenerateNotePage] navigator.locks failed:", e);
        }
      }
      await runUpload();
    },
    [navigate, setRecordingDuration],
  );

  startPendingUploadRef.current = startPendingUpload;

  useEffect(() => {
    const pendingRecordingId = location.state?.pendingRecordingId;
    const handoffId = location.state?.recordingHandoffId;
    if (typeof pendingRecordingId !== "string" || !pendingRecordingId) {
      return;
    }
    if (typeof handoffId !== "string" || !handoffId) {
      return;
    }
    const markKey = `enscribe_recording_handoff_${handoffId}`;
    if (sessionStorage.getItem(markKey)) {
      return;
    }
    sessionStorage.setItem(markKey, "1");

    const pendingName = location.state?.patientEncounterName;
    const attachedFromHandoff = readAttachedPreVisitSummaryFromHandoffState(
      location.state,
    );
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: {} },
    );

    if (attachedFromHandoff) {
      applyAttachedPreVisitSummary(attachedFromHandoff);
    } else if (typeof pendingName === "string" && pendingName.trim()) {
      const trimmed = pendingName.trim().slice(0, ENCOUNTER_NAME_MAX_CHARS);
      setPatientEncounterName(trimmed);
      try {
        localStorage.setItem(
          STORAGE_KEYS.newPatientEncounter.patientEncounterName,
          JSON.stringify(trimmed),
        );
      } catch (e) {
        console.warn("[GenerateNotePage] handoff name persist failed:", e);
      }
    }

    pendingRestoreAttemptedRef.current = true;
    void startPendingUploadRef.current(pendingRecordingId, {
      maxAttempts: PENDING_UPLOAD_HANDOFF_ATTEMPTS,
    });
  }, [
    applyAttachedPreVisitSummary,
    location.state,
    location.pathname,
    location.search,
    navigate,
  ]);

  useEffect(() => {
    if (!restorationComplete || urlRecordingPath) return;
    if (pendingRestoreAttemptedRef.current) return;

    let cancelled = false;

    const runRestoreUpload = async () => {
      const meta = normalizeStaleUploadingMetadata();
      const idbId = await resolvePendingIdbId(meta);
      if (cancelled || !idbId) return;

      const record = await getPendingById(idbId);
      const metaWithId = { ...(meta || {}), idbId };

      if (!shouldAutoRetryPendingOnPageLoad(metaWithId, record)) {
        if (metaWithId.status === "failed" || meta?.status === "failed") {
          setRecordingFileMetadata(metaWithId);
        }
        return;
      }

      pendingRestoreAttemptedRef.current = true;
      const prepared = normalizePendingMetadataForRetry(metaWithId);
      if (prepared) {
        try {
          localStorage.setItem(
            STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
            JSON.stringify(prepared),
          );
        } catch (e) {
          console.warn("[GenerateNotePage] restore metadata persist failed:", e);
        }
        setRecordingFileMetadata(prepared);
      }

      await startPendingUploadRef.current(idbId, {
        maxAttempts: PENDING_UPLOAD_RESTORE_ATTEMPTS,
      });
    };

    void runRestoreUpload();

    return () => {
      cancelled = true;
    };
  }, [restorationComplete, urlRecordingPath]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      try {
        const raw = localStorage.getItem(
          STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
        );
        if (!raw) return;
        const meta = JSON.parse(raw);
        if (meta.status === "uploading" || isUploading) {
          e.preventDefault();
          e.returnValue = "";
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isUploading]);

  const handleDiscardPending = useCallback(async () => {
    if (
      !window.confirm("Discard this recording? It cannot be recovered.")
    ) {
      return;
    }
    const idbId = recordingFileMetadata?.idbId;
    await discardPendingRecording(idbId);
    setRecordingFileMetadata(null);
    setCurrentStatus(null);
    setRecordingFile(null);
    setRecordingDuration(0);
  }, [recordingFileMetadata?.idbId, setRecordingDuration]);

  const isRecordingReady =
    recordingFileMetadata?.status === "uploaded" ||
    (!recordingFileMetadata?.status && !!recordingFileMetadata?.path);

  const jobStatusToneClass = (status) => {
    if (status === "error") {
      return "bg-red-50 border border-red-200 text-red-800";
    }
    if (status === "success" || status === "complete" || status === "saving") {
      return "bg-emerald-50 border border-emerald-200 text-emerald-900";
    }
    return "bg-blue-50 border border-blue-200 text-blue-800";
  };

  const finishGenerateAndSaveSuccess = (noteId) => {
    localStorage.removeItem(STORAGE_KEYS.jobs.promptLlmJobId);
    localStorage.removeItem(STORAGE_KEYS.jobs.promptLlmJobStatus);
    applyAttachedPreVisitSummary(null, { updateEncounterName: false });
    setIsProcessing(false);
    setCurrentStatus(null);
    navigate(`/edit-note/${String(noteId)}`, {
      state: { generatedNoteSaved: true },
    });
  };

  // Rebuild JSON from generic json-field editors
  const buildObjectFromJsonFields = useCallback(() => {
    const o = {};
    for (const k of jsonFieldKeys) {
      o[k] = format.normalizeNoteFieldPlainText(jsonFieldTexts[k] ?? "");
    }
    return o;
  }, [jsonFieldKeys, jsonFieldTexts]);

  const getExportNoteString = () =>
    noteLayout === "json-fields"
      ? format.formatJsonFieldEditorsPlainCopy(jsonFieldKeys, jsonFieldTexts)
      : noteText;

  // Generate note using job-based API (prompt-llm)
  const generateSoapNote = async () => {
    // Capture encounter name for generate-and-save before clearing fields
    const encounterNameForJob =
      (patientEncounterName && String(patientEncounterName).trim()) ||
      format.formatEncounterTimestamp(recordingStartTime || new Date());

    // Clear localStorage and reset textareas
    setPatientEncounterName("");
    setNoteText("");
    setNoteLayout("single");
    setJsonFieldKeys([]);
    setJsonFieldTexts({});
    lastParsedLlmResultRef.current = null;

    // Clear any previous job IDs
    localStorage.removeItem(STORAGE_KEYS.jobs.promptLlmJobId);
    localStorage.removeItem(STORAGE_KEYS.jobs.promptLlmJobStatus);

    setSoapNoteRequested(true);
    setIsProcessing(true);
    setActiveSection("review");
    setCurrentStatus({
      status: "pending",
      message: "Creating job...",
    });

    const abortController = new AbortController();
    let timeoutId;
    const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

    try {
      timeoutId = setTimeout(() => {
        abortController.abort();
        setIsProcessing(false);
        setCurrentStatus({
          status: "error",
          message: "Job processing timeout after 10 minutes. Please try again.",
        });
        alert("Job processing timeout after 10 minutes. Please try again.");
      }, TIMEOUT_MS);

      try {
        let recording_file_path = "";

        // Check if we have recording file metadata (works for both upload and URL flows)
        const metadataStr = localStorage.getItem(
          STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
        );
        if (metadataStr) {
          const metadata = JSON.parse(metadataStr);
          if (!metadata.path) {
            throw new Error("Audio file path missing in metadata.");
          }
          recording_file_path = metadata.path;
          console.log(
            "[generateSoapNote] Using recording path:",
            recording_file_path,
            metadata.fromUrl ? "(from URL)" : "(from upload)",
          );
        } else {
          throw new Error(
            "No audio file found. Please upload or record audio first.",
          );
        }

        // Step 1: Create job — generate SOAP and persist encounter + note
        console.log("[generateSoapNote] Creating generate-and-save job...", {
          noteTemplate_id: selectedTemplate?.id ?? null,
          patient_encounter_name: encounterNameForJob,
          pre_visit_summary_id: attachedPreVisitSummary?.id ?? null,
        });
        const jobResponse = await api.createPromptLlmGenerateAndSaveJob(
          recording_file_path,
          {
            noteTemplate_id: selectedTemplate?.id,
            patient_encounter_name: encounterNameForJob,
            ...(attachedPreVisitSummary?.id
              ? { pre_visit_summary_id: attachedPreVisitSummary.id }
              : {}),
          },
        );
        const jobId = jobResponse.id;

        console.log("[generateSoapNote] Job created:", jobId);
        localStorage.setItem(STORAGE_KEYS.jobs.promptLlmJobId, jobId);
        localStorage.setItem(
          STORAGE_KEYS.jobs.promptLlmJobStatus,
          jobResponse.status,
        );

        // Step 2: Poll for status with exponential backoff on failures
        let pollInterval = 5000; // 5 seconds
        const MAX_BACKOFF = 60000; // 60 seconds
        let backoffMultiplier = 1; // Reset to 1 on each successful poll
        let consecutiveErrors = 0;
        let pollCount = 0;

        while (true) {
          if (abortController.signal.aborted) {
            console.log("[generateSoapNote] Polling aborted by user");
            throw new Error("Job polling aborted");
          }

          try {
            pollCount++;
            console.log(
              `[generateSoapNote] Poll #${pollCount} - Starting poll for jobId: ${jobId} - Next interval: ${pollInterval}ms`,
            );
            const statusResponse = await api.getPromptLlmJobStatus(jobId);

            console.log(
              `[generateSoapNote] Poll #${pollCount} - Response received - Status: ${statusResponse.status}`,
            );
            if (statusResponse.error_message) {
              console.log(
                `[generateSoapNote] Poll #${pollCount} - Error message: ${statusResponse.error_message}`,
              );
            }

            localStorage.setItem(
              STORAGE_KEYS.jobs.promptLlmJobStatus,
              statusResponse.status,
            );

            // Reset backoff on successful poll
            if (consecutiveErrors > 0) {
              console.log(
                `[generateSoapNote] Poll #${pollCount} - Resetting backoff (was ${consecutiveErrors} consecutive errors)`,
              );
            }
            // Update UI with current status
            const elapsedSeconds = pollCount * 5; // 5-second polling intervals
            const statusMessage = {
              pending: `Waiting to start... (${elapsedSeconds}s)`,
              transcribing: `Transcribing audio... (${elapsedSeconds}s)`,
              generating: `Generating note... (${elapsedSeconds}s)`,
              complete: `Processing complete, fetching result... (${elapsedSeconds}s)`,
              error: statusResponse.error_message || "Job failed",
            };

            setCurrentStatus({
              status: statusResponse.status,
              message:
                statusMessage[statusResponse.status] || statusResponse.status,
            });
            if (statusResponse.status === "complete") {
              let noteId = statusResponse.note_id ?? null;
              if (noteId != null && noteId !== "") {
                console.log(
                  `[generateSoapNote] Poll #${pollCount} - Job complete with note_id, redirecting to editor`,
                  { noteId },
                );
                finishGenerateAndSaveSuccess(noteId);
                break;
              }

              console.log(
                `[generateSoapNote] Poll #${pollCount} - Job complete (no note_id on poll). Fetching full result with ?includeResult=true`,
              );
              const resultResponse = await api.getPromptLlmJobResult(jobId);
              noteId = resultResponse.note_id ?? null;
              if (noteId != null && noteId !== "") {
                console.log(
                  `[generateSoapNote] Poll #${pollCount} - note_id on result, redirecting`,
                  { noteId },
                );
                finishGenerateAndSaveSuccess(noteId);
                break;
              }

              console.log(
                `[generateSoapNote] Poll #${pollCount} - Result fetched successfully (inline edit fallback)`,
              );
              await processJobResult(resultResponse);
              setIsProcessing(false);
              console.log(
                `[generateSoapNote] Poll #${pollCount} - Note processing complete`,
              );
              ui.notifySuccessFeedback(); // persist failed; show SOAP on page
              break;
            }

            // Handle error
            if (statusResponse.status === "error") {
              console.error(
                `[generateSoapNote] Poll #${pollCount} - Job error state received`,
              );
              throw new Error(
                statusResponse.error_message || "Job failed with unknown error",
              );
            }

            // Wait before next poll (10 seconds default, or with backoff)
            console.log(
              `[generateSoapNote] Poll #${pollCount} - Waiting ${pollInterval}ms before next poll (status: ${statusResponse.status})`,
            );
            await new Promise((resolve) => {
              const pollTimeout = setTimeout(resolve, pollInterval);
              abortController.signal.addEventListener("abort", () =>
                clearTimeout(pollTimeout),
              );
            });
          } catch (pollError) {
            // Allowlist approach: only retry for 401 (refresh) or genuine network
            // connectivity loss. Everything else — job errors, HTTP 4xx/5xx, server
            // errors, unknown errors — stops immediately (non-retryable).
            const networkErr = isNetworkError(pollError);
            const is401 =
              pollError.message?.includes("401") ||
              pollError.message?.includes("Unauthorized");

            console.warn(
              `[generateSoapNote] Poll #${pollCount} - Error: ${pollError.message} (network=${networkErr}, 401=${is401})`,
            );

            // 401 Unauthorized: Refresh JWT and retry immediately
            if (is401) {
              console.log(
                `[generateSoapNote] Poll #${pollCount} - 401 Unauthorized: Attempting JWT refresh`,
              );
              try {
                await api.refreshSession();
                console.log(
                  `[generateSoapNote] Poll #${pollCount} - JWT refreshed successfully, retrying immediately`,
                );
                backoffMultiplier = 1;
                consecutiveErrors = 0;
                continue; // Retry immediately without backoff
              } catch (refreshError) {
                console.error(
                  `[generateSoapNote] Poll #${pollCount} - JWT refresh failed:`,
                  refreshError,
                );
                throw new Error("Session expired. Please log in again.");
              }
            }

            // Network errors: Use exponential backoff with 10 retries for bad mobile connections
            if (networkErr) {
              consecutiveErrors++;
              console.warn(
                `[generateSoapNote] Poll #${pollCount} - Network error (attempt #${consecutiveErrors}/10): ${pollError.message}`,
              );

              if (consecutiveErrors >= 10) {
                console.error(
                  `[generateSoapNote] Poll #${pollCount} - GIVING UP after ${consecutiveErrors} network errors`,
                );
                throw new Error(
                  `Failed to reach server after ${consecutiveErrors} attempts. Please check your connection.`,
                );
              }

              // Apply exponential backoff for network errors
              if (consecutiveErrors > 1) {
                backoffMultiplier = Math.min(
                  backoffMultiplier * 2,
                  MAX_BACKOFF / 5000,
                );
                pollInterval = 5000 * backoffMultiplier;
                console.log(
                  `[generateSoapNote] Poll #${pollCount} - Applying exponential backoff: multiplier=${backoffMultiplier}, nextInterval=${pollInterval}ms`,
                );
              }

              // Wait before retrying network error
              console.log(
                `[generateSoapNote] Poll #${pollCount} - Waiting ${pollInterval}ms before network retry`,
              );
              await new Promise((resolve) => {
                const pollTimeout = setTimeout(resolve, pollInterval);
                abortController.signal.addEventListener("abort", () =>
                  clearTimeout(pollTimeout),
                );
              });
            } else {
              // Unknown error: Stop immediately
              console.error(
                `[generateSoapNote] Poll #${pollCount} - Unknown error (non-retryable): ${pollError.message}`,
              );
              throw pollError;
            }
          }
        }
      } catch (error) {
        console.error("[generateSoapNote] Error:", error);
        const errorMsg =
          typeof error === "string" ? error : error?.message || "";
        const errorCode =
          error && typeof error === "object" && "code" in error
            ? /** @type {string | undefined} */ (error.code)
            : undefined;

        if (
          errorCode === "PRE_VISIT_SUMMARY_ALREADY_LINKED" ||
          errorCode === "PRE_VISIT_SUMMARY_NOT_FOUND"
        ) {
          applyAttachedPreVisitSummary(null, { updateEncounterName: false });
          if (errorCode === "PRE_VISIT_SUMMARY_ALREADY_LINKED") {
            setAttachOverlayOpen(true);
          }
        }

        if (errorMsg.includes("expired token") || errorMsg.includes("401")) {
          api.handleSignOut();
          navigate("/login");
          return;
        }

        alert(`Error generating note: ${errorMsg}`);
        setCurrentStatus({
          status: "error",
          message: `Failed to process recording: ${errorMsg}`,
        });
        setIsProcessing(false);
      }
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("[generateSoapNote] Outer error:", error);
      alert(`Error generating note: ${error.message}`);
      setCurrentStatus({
        status: "error",
        message: `Failed to process recording: ${error.message}`,
      });
      setIsProcessing(false);
    }
  };

  // Process job result and set state (full JSON from API; display as formatted text, not forced into SOAP sections)
  const processJobResult = async (resultResponse) => {
    console.log("[processJobResult] Processing result:", resultResponse);

    try {
      const raw = resultResponse.soap_note;
      let parsed;
      if (raw === undefined || raw === null) {
        parsed = {};
      } else if (typeof raw === "string") {
        try {
          parsed = JSON.parse(raw);
        } catch {
          lastParsedLlmResultRef.current = null;
          setNoteLayout("single");
          setJsonFieldKeys([]);
          setJsonFieldTexts({});
          setNoteText(raw);
          const dateToUsePlain = recordingStartTime || new Date();
          setPatientEncounterName(format.formatEncounterTimestamp(dateToUsePlain));
          localStorage.setItem(
            STORAGE_KEYS.newPatientEncounter.note,
            JSON.stringify(raw),
          );
          setCurrentStatus({
            status: "success",
            message: "Note generated successfully",
          });
          return;
        }
      } else {
        parsed = raw;
      }

      console.log("[processJobResult] Parsed LLM note JSON:", parsed);

      const isJsonObject =
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed);

      lastParsedLlmResultRef.current = parsed;

      if (isJsonObject && format.shouldUseJsonRootFieldEditors(parsed)) {
        const po = parsed;
        const keys = Object.keys(po);
        setNoteLayout("json-fields");
        setJsonFieldKeys(keys);
        const texts = {};
        for (const k of keys) {
          const v = po[k];
          if (typeof v === "string" || typeof v === "number") {
            texts[k] = String(v);
          } else {
            texts[k] = format.printJsonObject(v, 0);
          }
        }
        setJsonFieldTexts(texts);
        setNoteText("");
        localStorage.setItem(
          STORAGE_KEYS.newPatientEncounter.note,
          JSON.stringify({
            __enscribeNoteLayout: "json-fields",
            fields: texts,
          }),
        );
      } else if (isJsonObject) {
        const anon = format.getSingleAnonymousRootNotePlainText(parsed);
        lastParsedLlmResultRef.current = null;
        setNoteLayout("single");
        setJsonFieldKeys([]);
        setJsonFieldTexts({});
        const noteTextContent =
          anon !== null
            ? anon
            : format.printJsonObject(parsed, 0);
        setNoteText(noteTextContent);
        localStorage.setItem(
          STORAGE_KEYS.newPatientEncounter.note,
          JSON.stringify(noteTextContent),
        );
      } else {
        setNoteLayout("single");
        setJsonFieldKeys([]);
        setJsonFieldTexts({});
        const noteTextContent =
          parsed !== null && typeof parsed === "object"
            ? format.printJsonObject(parsed, 0)
            : String(parsed ?? "");
        setNoteText(noteTextContent);
        localStorage.setItem(
          STORAGE_KEYS.newPatientEncounter.note,
          JSON.stringify(noteTextContent),
        );
      }

      const dateToUse = recordingStartTime || new Date();
      const generatedName = format.formatEncounterTimestamp(dateToUse);
      setPatientEncounterName(generatedName);

      setCurrentStatus({
        status: "success",
        message: "Note generated successfully",
      });
    } catch (e) {
      console.error("[processJobResult] Parse error:", e);
      lastParsedLlmResultRef.current = null;
      setNoteText("");
      setNoteLayout("single");
      setJsonFieldKeys([]);
      setJsonFieldTexts({});
      throw new Error(`Failed to parse LLM note result: ${e.message}`);
    }
  };

  // Save patient encounter and note (POST /api/patient-encounters/complete — see patient-encounter-complete-api.md)
  const savePatientEncounter = async () => {
    setSaveAttempted(true);
    const missingFields = [];
    if (!patientEncounterName.trim())
      missingFields.push("Patient Encounter Name");
    const noteMissing =
      noteLayout === "json-fields"
        ? !jsonFieldKeys.some((k) => String(jsonFieldTexts[k] ?? "").trim())
        : !noteText.trim();
    if (noteMissing) missingFields.push("Note");
    if (missingFields.length > 0) {
      alert(
        "Required field(s): " + missingFields.map((f) => `${f}`).join(", "),
      );
      return;
    }

    setIsSaving(true);

    try {
      let note_text;
      if (noteLayout === "json-fields") {
        const built = buildObjectFromJsonFields();
        note_text = JSON.stringify(
          format.shouldCapitalizeNoteParsedObjectRoots(built)
            ? format.withCapitalizedJsonRootKeys(built)
            : built,
        );
      } else {
        note_text = noteText.replace(/\r?\n/g, "\n");
      }

      // Get recording_file_path from localStorage metadata
      const recordingFileMetadata = localStorage.getItem(
        STORAGE_KEYS.newPatientEncounter.recordingFileMetadata,
      );
      let recording_file_path = "";

      if (recordingFileMetadata) {
        try {
          const metadataObj = JSON.parse(recordingFileMetadata);
          recording_file_path = metadataObj.path || "";
        } catch (e) {
          console.error("Error parsing recording metadata:", e);
          recording_file_path = "";
        }
      }

      const payload = {
        patientEncounter: { name: patientEncounterName },
        recording: { recording_file_path },
        note_text,
      };

      console.log("Saving patient encounter with data:", payload);
      console.log(
        "[savePatientEncounter] Calling API with fetchWithRefreshRetry (Tier 3)...",
      );
      const apiResult = await api.fetchWithRefreshRetry(
        "/api/patient-encounters/complete",
        {
          method: "POST",
          body: JSON.stringify(payload),
          cache: "no-store", // Always fetch fresh data, never use cache
        },
      );

      if (!apiResult.success) {
        const errorMessage = `Authentication failed: ${apiResult.error}`;
        console.error(errorMessage);
        alert(errorMessage);
        setIsSaving(false);
        return;
      }

      const response = apiResult.response;
      console.log("Save response:", response);

      if (!response.ok) {
        let detailedError = `Failed to save patient encounter: ${response.status} ${response.statusText}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            detailedError += `\nServer response: ${errorText}`;
          }
          console.error(detailedError);
        } catch (e) {
          detailedError += `\nError reading server response: ${e.message}`;
        }
        alert(detailedError);
        setIsSaving(false);
        return;
      }
      // Clear localStorage for these fields after successful save
      Object.values(STORAGE_KEYS.newPatientEncounter).forEach((key) =>
        localStorage.removeItem(key),
      );
      // Navigate back to dashboard
      setRecordingFile(null);
      setRecordingFileMetadata(null);
      setPatientEncounterName("");
      setNoteText("");
      setNoteLayout("single");
      setJsonFieldKeys([]);
      setJsonFieldTexts({});
      lastParsedLlmResultRef.current = null;

      setIsSaving(false);
      //reload page
      window.location.reload();
    } catch (error) {
      let debugMsg = "Error saving data: " + error.message;
      if (error.stack) {
        debugMsg += "\nStack trace: " + error.stack;
      }
      alert(debugMsg);
      setIsSaving(false);
    }
  };

  const exportNoteString = getExportNoteString();

  return (
    <>
      <Auth />
      <div className="max-w-8xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8">Generate Note</h1>

        {/* Section 1: Upload/Record */}
        <div className="border border-gray-200 rounded-lg mb-4">
          <button
            className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
            onClick={() =>
              setActiveSection(activeSection === "upload" ? "upload" : "upload")
            }
          >
            <span className="text-lg font-semibold">1. Note Setup</span>
            <span className="text-xl">
              {activeSection === "upload" ? "−" : "+"}
            </span>
          </button>

          {activeSection === "upload" && (
            <div className="p-6 border-t border-gray-200 space-y-6">
              <div className="w-full max-w-[640px] space-y-6">
                <div className="space-y-2">
                  <label
                    htmlFor="patient-encounter-name"
                    className="block text-lg font-medium text-gray-900"
                  >
                    Patient Encounter Name
                  </label>
                  <input
                    id="patient-encounter-name"
                    type="text"
                    value={patientEncounterName}
                    onChange={(e) => setPatientEncounterName(e.target.value)}
                    disabled={isSaving || isProcessing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:opacity-50 disabled:bg-gray-100"
                    placeholder="Patient Encounter Name..."
                    maxLength={ENCOUNTER_NAME_MAX_CHARS}
                  />
                </div>

                <div className="space-y-2">
                  <span className="block text-lg font-medium text-gray-900">
                    Pre-visit summary
                  </span>
                  <PreVisitSummaryAttachControl
                    attached={!!attachedPreVisitSummary}
                    attachedTitle={attachedPreVisitSummary?.title ?? null}
                    onPress={() => setAttachOverlayOpen(true)}
                    disabled={isSaving || isProcessing}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="note-template-select"
                      className="text-lg font-medium text-gray-900"
                    >
                      Select note template
                    </label>
                    <button
                      type="button"
                      onClick={() => navigate("/view-templates")}
                      title="View note templates"
                      aria-label="View note templates"
                      disabled={loadingTemplates || isProcessing}
                      className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#3166F7]/55 bg-[#F9FAFF] text-[#4B5D99] transition-colors hover:border-[#3166F7]/80 hover:bg-[#E8EEFB] hover:text-[#3166F7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3166F7]/35 active:border-[#2751C4] active:bg-[#dce6fc] active:text-[#2751C4] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden
                      >
                        <path
                          d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M14 2v5h5M8 13h8M8 17h8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <Select
                    id="note-template-select"
                    value={selectedTemplate?.id || ""}
                    onChange={(e) => {
                      const templateId = e.target.value;
                      if (templateId) {
                        const template = templates.find(
                          (t) => t.id.toString() === templateId,
                        );
                        setSelectedTemplate(template);
                        setLastUsedNoteTemplateId(templateId);
                      } else {
                        setSelectedTemplate(null);
                        setLastUsedNoteTemplateId(null);
                      }
                    }}
                    disabled={loadingTemplates || isProcessing}
                    className="focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">
                      {loadingTemplates
                        ? "Loading templates..."
                        : "-- Default template --"}
                    </option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {!recordingFileMetadata &&
              !isUploading &&
              !loadingUrlRecording &&
              !(
                currentStatus?.status === "error" &&
                currentStatus?.uploadSource === "file-picker"
              ) ? (
                <p className="text-sm text-gray-600">
                  <Link
                    to="/upload-recording"
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    Upload an audio file
                  </Link>{" "}
                  to attach a recording to this encounter.
                </p>
              ) : null}

              {(() => {
                const isFilePickerUploadError =
                  currentStatus?.status === "error" &&
                  currentStatus?.uploadSource === "file-picker" &&
                  !recordingFileMetadata?.idbId;

                if (
                  !recordingFileMetadata &&
                  !isUploading &&
                  !loadingUrlRecording &&
                  !isFilePickerUploadError
                ) {
                  return null;
                }

                const metaStatus = recordingFileMetadata?.status;
                const isPendingIdbFlow = !!recordingFileMetadata?.idbId;
                const isLoading = isUploading || loadingUrlRecording;
                const isLocal = metaStatus === "local";
                const isFailed = metaStatus === "failed";
                const isReady = isRecordingReady;
                const uploadAttempts = recordingFileMetadata?.attempts ?? 0;
                const pendingUploadMessage =
                  isPendingIdbFlow &&
                  (isLocal || isFailed) &&
                  recordingFileMetadata?.lastError
                    ? formatPendingUploadUserMessage({
                        lastError: recordingFileMetadata.lastError,
                        attempts: uploadAttempts,
                      })
                    : null;
                const showPendingActions =
                  isPendingIdbFlow &&
                  (isFailed || (isLocal && !!pendingUploadMessage));

                let cardClass =
                  "mt-6 p-4 rounded-lg border w-full max-w-full overflow-hidden ";
                if (isLoading) {
                  cardClass +=
                    "bg-gray-100 border-gray-300 opacity-60 pointer-events-none select-none";
                } else if (isFailed || isFilePickerUploadError) {
                  cardClass += "bg-red-50 border-red-300";
                } else if (isLocal) {
                  cardClass += "bg-amber-50 border-amber-200";
                } else {
                  cardClass += "bg-green-50 border-green-200";
                }

                const statusToneClass =
                  isFailed || isFilePickerUploadError
                  ? "text-red-700"
                  : isLocal
                    ? "text-amber-800"
                    : isLoading
                      ? "text-gray-500"
                      : "text-green-600";

                return (
                  <div className={cardClass}>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
                      <div className="flex-1 min-w-0 w-full max-w-full">
                        {isFilePickerUploadError ? (
                          <p
                            className={`text-sm w-full break-words font-medium ${statusToneClass}`}
                          >
                            {currentStatus.message}
                          </p>
                        ) : isLoading ? (
                          <p className={`text-sm w-full break-words ${statusToneClass}`}>
                            {loadingUrlRecording
                              ? "Loading recording from URL..."
                              : isPendingIdbFlow && uploadAttempts > 0
                                ? `Uploading recording (attempt ${uploadAttempts})…`
                                : "Uploading recording…"}
                          </p>
                        ) : pendingUploadMessage ? (
                          <p
                            className={`text-sm w-full break-words font-medium ${statusToneClass}`}
                          >
                            {pendingUploadMessage}
                          </p>
                        ) : isLocal ? (
                          <p className={`text-sm w-full break-words ${statusToneClass}`}>
                            Saved on this device — upload will start automatically.
                          </p>
                        ) : isReady ? (
                          <p className={`text-sm w-full break-words ${statusToneClass}`}>
                            {recordingFileMetadata?.fromUrl
                              ? "Recording Loaded from URL"
                              : "Recording Ready"}
                          </p>
                        ) : null}
                        {isFilePickerUploadError ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                              onClick={() => {
                                setCurrentStatus(null);
                                navigate("/upload-recording");
                              }}
                            >
                              Retry
                            </button>
                          </div>
                        ) : null}
                        {isLoading && currentStatus?.progress !== undefined && (
                          <p className="text-sm w-full break-words text-gray-600 mt-1">
                            Progress: {currentStatus.progress}%
                          </p>
                        )}
                        {!isFilePickerUploadError ? (
                          <p
                            className={`text-sm ${
                              isFailed
                                ? "text-red-600"
                                : isLocal
                                  ? "text-amber-700"
                                  : isLoading
                                    ? "text-gray-500"
                                    : "text-green-600"
                            }`}
                            data-path={recordingFileMetadata?.path || ""}
                          >
                            {recordingFileMetadata?.name || "recording.webm"}
                            {recordingFileMetadata?.size
                              ? ` (${((recordingFileMetadata.size || 0) / (1024 * 1024)).toFixed(1)}MB)`
                              : ""}
                          </p>
                        ) : null}
                        {showPendingActions ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                              onClick={() => {
                                const idbId = recordingFileMetadata?.idbId;
                                if (!idbId) return;
                                void startPendingUpload(idbId, {
                                  maxAttempts: PENDING_UPLOAD_MANUAL_RETRY_ATTEMPTS,
                                });
                              }}
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              onClick={() => {
                                void downloadPendingRecording(
                                  recordingFileMetadata?.idbId,
                                ).catch((e) => alert(e.message));
                              }}
                            >
                              Download recording
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                              onClick={() => void handleDiscardPending()}
                            >
                              Discard
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={generateSoapNote}
                        disabled={
                          isProcessing ||
                          isUploading ||
                          loadingUrlRecording ||
                          !isRecordingReady
                        }
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 shrink-0"
                      >
                        {isProcessing
                          ? "Processing..."
                          : loadingUrlRecording
                            ? "Loading Recording..."
                            : "Generate Note"}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Section 2: Review */}
        <div
          className={`border border-gray-200 rounded-lg ${
            !soapNoteRequested
              ? "opacity-60 pointer-events-none select-none"
              : ""
          }`}
        >
          <button
            className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
            onClick={() =>
              setActiveSection(activeSection === "review" ? "review" : "review")
            }
            disabled={!soapNoteRequested}
          >
            <span className="text-lg font-semibold">
              2. Edit Generated Note
            </span>
            <span className="text-xl">
              {activeSection === "review" ? "−" : "+"}
            </span>
          </button>

          {activeSection === "review" && (
            <div className="p-6 border-t border-gray-200">
              {/* <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Encounter Name
                </label>
                <input
                  type="text"
                  value={patientEncounterName}
                  onChange={(e) => setPatientEncounterName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 bg-white"
                  placeholder="Enter patient encounter name"
                  disabled={isSaving}
                />
              </div> */}

              {/* Status Messages */}
              {currentStatus && (
                <div
                  className={`mb-6 p-4 rounded-lg ${jobStatusToneClass(currentStatus.status)}`}
                >
                  <div className="font-medium capitalize">
                    {currentStatus.status === "success"
                      ? "Success"
                      : currentStatus.status}
                  </div>
                  <div className="text-sm">
                    {currentStatus.message}
                    {currentStatus.progress !== undefined &&
                    currentStatus.progress !== null
                      ? ` – ${currentStatus.progress}%`
                      : ""}
                  </div>
                </div>
              )}

              {/* Note: single textarea, or per-SOAP-section editors for nested JSON */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-xl text-gray-700 mb-2">
                  Note
                </label>
                {noteLayout === "json-fields" ? (
                  <div className="space-y-4">
                    {jsonFieldKeys.map((key) => (
                      <div key={key}>
                        <label
                          htmlFor={`note-field-${key}`}
                          className="block text-sm font-semibold text-gray-800 mb-1 break-all"
                        >
                          {key}
                        </label>
                        <ExpandableNoteTextarea
                          id={`note-field-${key}`}
                          value={jsonFieldTexts[key] ?? ""}
                          onChange={(e) =>
                            setJsonFieldTexts((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          disabled={isSaving || isProcessing}
                          collapsedMinClass="min-h-[14rem]"
                          collapsedMaxClass="max-h-[14rem]"
                          className="font-mono text-sm"
                          placeholder={`${key}…`}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <ExpandableNoteTextarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    disabled={isSaving || isProcessing}
                    collapsedMinClass="min-h-64"
                    collapsedMaxClass="max-h-[40rem]"
                    placeholder="Note content will appear here..."
                  />
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <CopyToClipboard
                    text={exportNoteString}
                    label="Copy"
                    placement="right"
                  />
                </div>
              </div>

              {/* Save Button (always enabled, but checks required fields before saving) */}
              <div className="flex flex-col items-end">
                <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-stretch md:items-center">
                  {/* Export menu/button - placed to the left of Preview button */}
                  <ExportDataAsFileMenu
                    patientEncounterData={{ name: patientEncounterName }}
                    notes={exportNoteString.trim() ? [exportNoteString] : []}
                  />
                  <button
                    type="button"
                    onClick={savePatientEncounter}
                    disabled={isSaving}
                    className={`bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium ${
                      isSaving ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Save
                  </button>
                </div>
                {errorMessage && (
                  <div className="mt-3 text-red-600 text-sm text-right w-full">
                    {errorMessage}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <AttachPreVisitSummaryOverlay
        open={attachOverlayOpen}
        attachedSummary={attachedPreVisitSummary}
        onRequestClose={() => setAttachOverlayOpen(false)}
        onAttach={handleAttachPreVisitSummary}
        onNewPrep={() => {
          setAttachOverlayOpen(false);
          navigate("/new-pre-visit-summary");
        }}
        onViewAllSummaries={() => {
          setAttachOverlayOpen(false);
          navigate("/pre-visit-summary");
        }}
      />
    </>
  );
}
