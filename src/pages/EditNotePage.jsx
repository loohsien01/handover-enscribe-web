import { useNavigate, useParams, useLocation } from "react-router-dom";
import React, { useState, useEffect, useCallback } from "react";
import * as api from "@/lib/api";
import * as format from "@/utils/format.js";
import * as ui from "@/utils/ui.js";
import ExportDataAsFileMenu from "@/components/ExportDataAsFileMenu";
import Auth from "@/components/Auth.jsx";
import CopyToClipboard from '@/components/CopyToClipboard.jsx';
import ExpandableNoteTextarea from "@/components/ExpandableNoteTextarea.jsx";
import EditablePatientEncounterName from "@/components/EditablePatientEncounterName.jsx";
import SimpleAudioPlayer from "@/components/SimpleAudioPlayer.jsx";
import AttachPreVisitSummaryOverlay from "@/components/visitPrep/AttachPreVisitSummaryOverlay.jsx";
import PreVisitSummaryAttachControl, {
  PreVisitSummaryAttachPlaceholder,
} from "@/components/visitPrep/PreVisitSummaryAttachControl.jsx";
import parseNotes from "@/utils/parseNotes";
import { fetchVisitPrepLinkedToEncounter } from "@/utils/visitPrepSidebarLoader.js";
import { normalizeAttachedPreVisitSummaryRef } from "@/utils/visitPrepRecordingHandoff.js";
import { resolveVisitPrepTitle } from "@/utils/visitPrepTitle.js";

function ChevronIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NoteEditAccordionSection({
  step,
  title,
  isOpen,
  onToggle,
  collapsedAccessory = null,
  children,
}) {
  const showCollapsedAccessory = !isOpen && collapsedAccessory;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40 overflow-hidden">
      <div className="bg-slate-50">
        {showCollapsedAccessory ? (
          <div
            data-note-edit-accordion-row
            className="flex min-w-0 items-center gap-2 px-4 py-3.5 sm:gap-3 sm:px-5 sm:py-4"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3166F7] focus-visible:ring-offset-2 sm:gap-3"
              onClick={onToggle}
              aria-expanded={isOpen}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#183278] text-xs font-semibold text-white tabular-nums">
                {step}
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">
                {title}
              </span>
            </button>
            <div
              className="ml-auto shrink-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {collapsedAccessory}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100/90 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3166F7] focus-visible:ring-offset-2"
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-label={`Expand ${title}`}
            >
              <ChevronIcon className="transition-transform duration-200" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-100/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3166F7] focus-visible:ring-offset-2 sm:px-5 sm:py-4"
            onClick={onToggle}
            aria-expanded={isOpen}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#183278] text-xs font-semibold text-white tabular-nums">
              {step}
            </span>
            <span className="flex-1 min-w-0 text-base font-semibold text-slate-900">
              {title}
            </span>
            <ChevronIcon
              className={`shrink-0 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
      {isOpen && (
        <div className="border-t border-slate-100 px-4 py-5 sm:px-6 sm:py-6 bg-white">
          {children}
        </div>
      )}
    </section>
  );
}

export default function EditNotePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: noteIdRaw } = useParams();
  const noteId = noteIdRaw ? parseInt(noteIdRaw, 10) : null;

  // State management
  const [patientEncounterId, setPatientEncounterId] = useState("");
  const [patientEncounterName, setPatientEncounterName] = useState("");
  const [recording, setRecording] = useState(null);
  const [recordingFileUrl, setRecordingFileUrl] = useState("");
  const [recordingFileName, setRecordingFileName] = useState("");
  const [noteText, setNoteText] = useState("");
  /** 'single' | 'json-fields' — per-root-key editors when note text parses as a non-array JSON object */
  const [noteLayout, setNoteLayout] = useState("single");
  const [jsonFieldKeys, setJsonFieldKeys] = useState([]);
  const [jsonFieldTexts, setJsonFieldTexts] = useState({});

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [openSections, setOpenSections] = useState({
    editNameAndRecording: false,
    editNote: true,
  });
  const [linkedPreVisitSummary, setLinkedPreVisitSummary] = useState(null);
  const [linkedPreVisitSummaryLoading, setLinkedPreVisitSummaryLoading] = useState(true);
  const [preVisitSummaryOverlayOpen, setPreVisitSummaryOverlayOpen] = useState(false);

  const toggleSection = (section) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => {
    if (!location.state?.generatedNoteSaved) return;
    setSuccessMessage("Note saved successfully.");
    ui.notifySuccessFeedback();
    navigate(".", { replace: true, state: null });
  }, [location.state, navigate]);

  // Fetch note and patient encounter data on mount
  useEffect(() => {
    if (!noteId) return;
    const fetchData = async () => {
      try {
        // 1. Fetch note by id
        const result = await api.getNoteById(noteId);
        if (!result.success) {
          if (result.status === 401) {
            navigate("/login");
          }
          throw new Error(result.error);
        }
        let data = parseNotes(result.data);
        if (!data) throw new Error("Note not found");

        // Set note text — if JSON object (non-array) with keys, one textarea per root field
        const noteTextContent = data.text || "";
        console.log("data.parsedObject: ", data.parsedObject);
        console.log("format.shouldUseJsonRootFieldEditors(data.parsedObject): ", format.shouldUseJsonRootFieldEditors(data.parsedObject));
        if (
          data.parsedObject &&
          format.shouldUseJsonRootFieldEditors(data.parsedObject)
        ) {
          const po = data.parsedObject;
          const keys = Object.keys(po);
          setNoteLayout("json-fields");
          setJsonFieldKeys(keys);
          const texts = {};
          for (const k of keys) {
            texts[k] =
              typeof po[k] === 'string' || typeof po[k] === 'number'
                ? String(po[k])
                : format.printJsonObject(po[k], 0);
          }
          setJsonFieldTexts(texts);
          setNoteText("");
        } else {
          setNoteLayout("single");
          setJsonFieldKeys([]);
          setJsonFieldTexts({});
          const anon = data.parsedObject
            ? format.getSingleAnonymousRootNotePlainText(data.parsedObject)
            : null;
          if (anon !== null) {
            setNoteText(anon);
          } else if (data.parsedObject) {
            setNoteText(format.printJsonObject(data.parsedObject, 0));
          } else {
            setNoteText(noteTextContent);
          }
        }

        // 2. Fetch patient encounter using note.patientEncounter_id
        const patientEncounterId = data.patientEncounter_id;
        if (!patientEncounterId)
          throw new Error("Associated Patient Encounter not found");
        
        setPatientEncounterId(patientEncounterId);
        const patientEncounterResult = await api.getPatientEncounterComplete(patientEncounterId);
        if (!patientEncounterResult.success) {
          if (patientEncounterResult.status === 401) {
            navigate("/login");
          }
          throw new Error(patientEncounterResult.error);
        }
        const patientEncounterPayload = patientEncounterResult.data;
        const patientEncounterData = patientEncounterPayload.patientEncounter;
        setPatientEncounterName(patientEncounterData.name || "");

        const nextRecording = patientEncounterPayload.recording
          ? {
              ...patientEncounterPayload.recording,
              // RecordingPreviewOverlay expects `selectedRecording.path` for display
              path:
                patientEncounterPayload.recording.recording_file_path ||
                patientEncounterPayload.recording.path ||
                "",
            }
          : null;

        setRecording(nextRecording);
        setRecordingFileUrl(nextRecording?.recording_file_signed_url || "");
        setRecordingFileName(
          format.extractRecordingFilenameFromPath(nextRecording?.path) ||
            "recording.webm",
        );

        setLinkedPreVisitSummaryLoading(true);
        const linkedRes = await fetchVisitPrepLinkedToEncounter(patientEncounterId);
        if (linkedRes.ok && linkedRes.row) {
          setLinkedPreVisitSummary(
            normalizeAttachedPreVisitSummaryRef({
              id: linkedRes.row.id,
              title: resolveVisitPrepTitle(linkedRes.row),
            }),
          );
        } else {
          setLinkedPreVisitSummary(null);
        }
        setLinkedPreVisitSummaryLoading(false);
      } catch (error) {
        console.error("Error fetching note or patient encounter:", error);
        setErrorMessage(
          `Failed to load note or patient encounter: ${error.message}`
        );
        setPatientEncounterName("");
        setRecording(null);
        setRecordingFileUrl("");
        setRecordingFileName("");
        setNoteText("");
        setNoteLayout("single");
        setJsonFieldKeys([]);
        setJsonFieldTexts({});
        setLinkedPreVisitSummary(null);
        setLinkedPreVisitSummaryLoading(false);
      }
    };
    fetchData();
  }, [noteId]);

  const handleAudioError = (e) => {
    const media = e?.target;
    const error = media?.error;
    let msg = "Unknown audio error";
    if (error) {
      switch (error.code) {
        case 1:
          msg = "Audio loading was aborted";
          break;
        case 2:
          msg = "Network error occurred while loading audio";
          break;
        case 3:
          msg = "Audio decoding error - file may be corrupted";
          break;
        case 4:
          msg = "Audio format not supported by browser";
          break;
        default:
          msg = `Audio error (code: ${error.code})`;
      }
    } else if (media) {
      msg =
        "Audio failed to load (unsupported format or network issue). On iPhone, only mp3 audio format is supported. Please use a compatible browser or device.";
    }
    console.error(`Error loading audio: ${msg}`, e);
    alert(`Error loading audio: ${msg}`);
  };

  const buildObjectFromJsonFields = useCallback(() => {
    const o = {};
    for (const k of jsonFieldKeys) {
      o[k] = format.normalizeNoteFieldPlainText(jsonFieldTexts[k] ?? "");
    }
    return o;
  }, [jsonFieldKeys, jsonFieldTexts]);

  // Save note
  const saveNote = async () => {
    setIsSaving(true);
    const missingFields = [];
    const noteMissing =
      noteLayout === "json-fields"
        ? !jsonFieldKeys.some((k) => String(jsonFieldTexts[k] ?? "").trim())
        : !noteText.trim();
    if (noteMissing) missingFields.push("Note");

    if (missingFields.length > 0) {
      alert("Required field(s): " + missingFields.join(", "));
      setIsSaving(false);
      return;
    }

    try {
      const builtJson =
        noteLayout === "json-fields" ? buildObjectFromJsonFields() : null;
      const payload = {
        text:
          noteLayout === "json-fields" && builtJson
            ? JSON.stringify(
                format.shouldCapitalizeNoteParsedObjectRoots(builtJson)
                  ? format.withCapitalizedJsonRootKeys(builtJson)
                  : builtJson,
              )
            : noteText.replace(/\r?\n/g, "\n"),
      };
      const result = await api.patchNote(noteId, payload);
      if (!result.success) {
        if (result.status === 401) {
          navigate("/login");
        } else {
          alert("Error saving data: " + result.error);
        }
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
      window.location.reload();
    } catch (error) {
      alert("Error saving data: " + error.message);
      setIsSaving(false);
    }
  };

  const exportNoteString =
    noteLayout === "json-fields"
      ? format.formatJsonFieldEditorsPlainCopy(jsonFieldKeys, jsonFieldTexts)
      : noteText;

  const copyNoteString =
    noteLayout === "json-fields"
      ? format.formatJsonFieldEditorsPlainCopy(jsonFieldKeys, jsonFieldTexts)
      : noteText;

  const preVisitSummaryOverlayVariant = linkedPreVisitSummary ? "view-linked" : "info";

  const handlePreVisitSummaryPress = useCallback(() => {
    setPreVisitSummaryOverlayOpen(true);
  }, []);

  const preVisitSummaryCollapsedAccessory = !errorMessage ? (
    linkedPreVisitSummaryLoading ? (
      <PreVisitSummaryAttachPlaceholder compact />
    ) : (
      <PreVisitSummaryAttachControl
        attached={!!linkedPreVisitSummary}
        attachedTitle={linkedPreVisitSummary?.title ?? null}
        onPress={handlePreVisitSummaryPress}
        compact
      />
    )
  ) : null;

  const preVisitSummaryBlock = !errorMessage ? (
    <div className="max-w-xl">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#3C4C78]">
        Pre-visit summary
      </span>
      {linkedPreVisitSummaryLoading ? (
        <PreVisitSummaryAttachPlaceholder />
      ) : (
        <PreVisitSummaryAttachControl
          attached={!!linkedPreVisitSummary}
          attachedTitle={linkedPreVisitSummary?.title ?? null}
          onPress={handlePreVisitSummaryPress}
        />
      )}
    </div>
  ) : null;

  return (
    <>
      <Auth />
      <div className="min-h-full w-full">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:max-w-[56rem] lg:px-8 lg:py-10">
          <header className="mb-8 lg:mb-10">
            <div className="flex min-w-0 flex-row items-stretch justify-between gap-4 sm:gap-5 lg:gap-6">
              <div className="min-w-0 flex-1 flex flex-wrap items-end gap-x-4 sm:gap-x-6 ">
                <h1 className="shrink-0 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Edit note
                </h1>
                {patientEncounterName ? (
                  <span
                    className="min-w-0 max-w-full text-base font-normal text-slate-500 sm:text-lg sm:max-w-[min(100%,28rem)] truncate"
                    title={patientEncounterName}
                  >
                    {patientEncounterName}
                  </span>
                ) : null}
              </div>
              <div className="flex h-full min-h-0 shrink-0 self-stretch flex-col items-end">
                <ExportDataAsFileMenu
                  fillRowHeight={true}
                  patientEncounterData={{ name: patientEncounterName }}
                  notes={exportNoteString.trim() ? [exportNoteString] : []}
                />
              </div>
            </div>
          </header>

          {successMessage ? (
            <div
              className="mb-6 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-emerald-900 shadow-sm"
              role="status"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-950">Success</p>
                <p className="mt-1 text-sm text-emerald-800/95">{successMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                className="shrink-0 self-start rounded-md p-1 text-emerald-700 hover:bg-emerald-100/80 hover:text-emerald-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label="Dismiss"
              >
                <span className="block text-lg leading-none" aria-hidden>
                  ×
                </span>
              </button>
            </div>
          ) : null}

          {errorMessage ? (
            <div
              className="mb-6 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-red-900 shadow-sm"
              role="alert"
            >
              <p className="text-sm font-semibold text-red-950">
                Could not load this note
              </p>
              <p className="mt-1 text-sm text-red-800/95">{errorMessage}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <NoteEditAccordionSection
              step={1}
              title="Edit Name and Recording"
              isOpen={openSections.editNameAndRecording}
              onToggle={() => toggleSection("editNameAndRecording")}
              collapsedAccessory={preVisitSummaryCollapsedAccessory}
            >
              <div className="w-full max-w-[580px] space-y-8">
                {preVisitSummaryBlock}
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[#3C4C78] mb-3">
                    Recording
                  </h2>
                  {recordingFileUrl ? (
                    <SimpleAudioPlayer
                      src={recordingFileUrl}
                      onError={handleAudioError}
                      recording={recording}
                      label={recordingFileName || "Recording"}
                      showEncounterActions={false}
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                      No recording found for this encounter.
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[#3C4C78] mb-3">
                    Encounter name
                  </h2>
                  <EditablePatientEncounterName
                    encounterId={patientEncounterId}
                    value={patientEncounterName}
                    label=""
                    onSaved={(nextName) => setPatientEncounterName(nextName)}
                  />
                </div>
              </div>
            </NoteEditAccordionSection>

            <div id="edit-note-accordion">
              <NoteEditAccordionSection
                step={2}
                title="Edit Note"
                isOpen={openSections.editNote}
                onToggle={() => toggleSection("editNote")}
              >
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p
                      id="edit-note-primary-label"
                      className="text-xs font-semibold uppercase tracking-wide text-[#3C4C78]"
                    >
                      Clinical note
                    </p>
                    <div className="shrink-0">
                      <CopyToClipboard
                        text={copyNoteString}
                        label="Copy entire note"
                        placement="right"
                      />
                    </div>
                  </div>
                  <div aria-labelledby="edit-note-primary-label">
                    {noteLayout === "json-fields" ? (
                      <div className="space-y-10">
                        {jsonFieldKeys.map((key) => (
                          <div key={key} className="space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                              <label
                                htmlFor={`edit-note-field-${key}`}
                                className="text-sm font-semibold text-slate-800 break-all min-w-0"
                              >
                                {key}
                              </label>
                              <div className="shrink-0 sm:order-last">
                                <CopyToClipboard
                                  text={format.formatJsonFieldEditorsPlainCopy(
                                    [key],
                                    { [key]: jsonFieldTexts[key] ?? "" },
                                  )}
                                  label="Copy section"
                                  placement="right"
                                />
                              </div>
                            </div>
                            <ExpandableNoteTextarea
                              id={`edit-note-field-${key}`}
                              value={jsonFieldTexts[key] ?? ""}
                              onChange={(e) =>
                                setJsonFieldTexts((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                              disabled={isSaving}
                              placeholder={`${key}…`}
                              className="!border-slate-200/90 !shadow-none focus:outline-none focus:!ring-2 focus:!ring-[#3166F7] focus:!ring-offset-2 focus:!border-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ExpandableNoteTextarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        disabled={isSaving}
                        collapsedMinClass="min-h-64"
                        collapsedMaxClass="max-h-[40rem]"
                        placeholder="Note content will appear here..."
                        className="!border-slate-200/90 !shadow-none focus:outline-none focus:!ring-2 focus:!ring-[#3166F7] focus:!ring-offset-2 focus:!border-blue-500"
                      />
                    )}
                  </div>

                  <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">

                    <button
                      type="button"
                      onClick={saveNote}
                      disabled={isSaving}
                      className={`inline-flex items-center justify-center rounded-lg bg-[#183278] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#14285F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3166F7] focus-visible:ring-offset-2 w-full sm:w-auto ${
                        isSaving ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {isSaving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              </NoteEditAccordionSection>
            </div>
          </div>
        </div>
      </div>
      <AttachPreVisitSummaryOverlay
        open={preVisitSummaryOverlayOpen}
        variant={preVisitSummaryOverlayVariant}
        attachedSummary={linkedPreVisitSummary}
        onRequestClose={() => setPreVisitSummaryOverlayOpen(false)}
        onNewPrep={() => {
          setPreVisitSummaryOverlayOpen(false);
          navigate("/new-pre-visit-summary");
        }}
        onViewAllSummaries={() => {
          setPreVisitSummaryOverlayOpen(false);
          navigate("/pre-visit-summary");
        }}
      />
    </>
  );
}
