import { useNavigate, useParams } from "react-router-dom";
import React, { useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import * as format from "@/utils/format.js";
import SimpleAudioPlayer from "@/components/SimpleAudioPlayer.jsx";
import ExportDataAsFileMenu from "@/components/ExportDataAsFileMenu.jsx";
import Auth from "@/components/Auth.jsx";
import Select from "@/components/Select.jsx";
import CopyToClipboard from "@/components/CopyToClipboard.jsx";
import EditablePatientEncounterName from "@/components/EditablePatientEncounterName.jsx";
import parseNotes from "@/utils/parseNotes";

function noteToDisplayText(note) {
  if (!note) return "";
  let content = note.text || "";
  if (note.parsedObject) {
    content = format.printJsonObject(note.parsedObject, 0);
  }
  return content;
}

function EditPatientEncounterPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [patientEncounterId, setPatientEncounterId] = useState(null);
  const [patientEncounterName, setPatientEncounterName] = useState("");
  const [associatedNotes, setAssociatedNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [recordingFileUrl, setRecordingFileUrl] = useState("");
  const [recordingFileName, setRecordingFileName] = useState("");
  const [recording, setRecording] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [sortBy, setSortBy] = useState("created_at");

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [openSections, setOpenSections] = useState({
    patientEncounter: true,
    notes: true,
    editNote: false,
  });
  const [editingNote, setEditingNote] = useState(null);

  const toggleSection = (section) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const sortedNotes = [...associatedNotes].sort((a, b) => {
    if (sortBy === "created_at") {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    if (sortBy === "updated_at") {
      return new Date(b.updated_at) - new Date(a.updated_at);
    }
    if (sortBy === "A-Z") {
      return noteToDisplayText(a).localeCompare(noteToDisplayText(b));
    }
    return 0;
  });

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const result = await api.getPatientEncounterComplete(id);

        if (!result.success) {
          if (result.status === 401) {
            navigate("/login");
          }
          throw new Error(result.error);
        }
        const data = result.data;

        setPatientEncounterId(data.patientEncounter.id || null);
        setPatientEncounterName(data.patientEncounter.name || "");
        const nextRecording = data.recording
          ? {
              ...data.recording,
              // RecordingPreviewOverlay expects `selectedRecording.path` for display
              path:
                data.recording.recording_file_path ||
                data.recording.path ||
                "",
            }
          : null;

        setRecording(nextRecording);
        setRecordingFileUrl(nextRecording?.recording_file_signed_url || "");
        setRecordingFileName(
          format.extractRecordingFilenameFromPath(nextRecording?.path) ||
            "recording.webm",
        );
        const rawNotes = Array.isArray(data.notes) ? data.notes : [];
        setAssociatedNotes(parseNotes(rawNotes));
      } catch (error) {
        console.error("Error fetching patient encounter data:", error);
        setErrorMessage(`Failed to load patient encounter: ${error.message}`);
        setRecordingFileUrl("");
        setRecordingFileName("");
        setRecording(null);
        setAssociatedNotes([]);
      }
    };
    fetchData();
  }, [id, navigate]);

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

  const saveNote = async (noteId) => {
    setIsSaving(true);
    if (!noteText.trim()) {
      alert("Required field(s): Note");
      setIsSaving(false);
      return;
    }
    try {
      const result = await api.patchNote(noteId, {
        text: noteText.replace(/\r?\n/g, "\n"),
      });
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

  const handleEditNote = () => {
    const note = associatedNotes.find((n) => n.id === selectedNoteId);
    if (note) {
      setEditingNote(note);
      setNoteText(noteToDisplayText(note));
      setOpenSections((prev) => ({
        ...prev,
        notes: false,
        editNote: true,
      }));
    }
  };

  const notesForExport = associatedNotes.map((n) => noteToDisplayText(n));

  return (
    <>
      <Auth />
      <div className="max-w-8xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">
            Edit Patient Encounter: {patientEncounterName}
          </h1>
          <ExportDataAsFileMenu
            patientEncounterData={{ name: patientEncounterName }}
            notes={notesForExport}
          />
        </div>

        <div className="border border-gray-200 rounded-lg mb-4 overflow-hidden">
          <button
            className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
            onClick={() => toggleSection("patientEncounter")}
            disabled={false}
          >
            <span className="text-lg font-semibold">1. Patient Encounter</span>
            <span className="text-xl">
              {openSections.patientEncounter ? "−" : "+"}
            </span>
          </button>

          {openSections.patientEncounter && (
            <div className="border-t border-gray-200">
              <div className="p-4">
                {errorMessage && (
                  <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
                    <div className="font-medium capitalize">Error</div>
                    <div className="text-sm">{errorMessage}</div>
                  </div>
                )}

                {/* Stacked layout (shared width so components feel connected) */}
                <div className="w-full max-w-[550px]">
                  <div className="text-base font-semibold text-gray-900 mb-2">
                    Recording
                  </div>
                  {recordingFileUrl ? (
                    <div className="min-w-0 w-full">
                      <div className="max-w-full">
                        <SimpleAudioPlayer
                          src={recordingFileUrl}
                          onError={handleAudioError}
                          recording={recording}
                          label={recordingFileName || "Recording"}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-600">
                      No recording found for this patient encounter.
                    </div>
                  )}

                  <div className="mt-6 text-base font-semibold text-gray-900 mb-2">
                    Patient Encounter Name
                  </div>
                  <EditablePatientEncounterName
                    encounterId={patientEncounterId}
                    value={patientEncounterName}
                    label={null}
                    className="mb-0"
                    onSaved={(nextName) => setPatientEncounterName(nextName)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg mb-4">
          <button
            className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
            onClick={() => toggleSection("notes")}
            disabled={false}
          >
            <span className="text-lg font-semibold">
              2. Select Associated Note
            </span>
            <span className="text-xl">{openSections.notes ? "−" : "+"}</span>
          </button>
          {openSections.notes && (
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-bold">Associated Notes</h3>
                <div>
                  <label
                    htmlFor="sortNotes"
                    className="mr-2 text-sm font-medium text-gray-700"
                  >
                    Sort By:
                  </label>
                  <Select
                    id="sortNotes"
                    size="sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="created_at">Created at</option>
                    <option value="updated_at">Updated at</option>
                    <option value="A-Z">A-Z</option>
                  </Select>
                </div>
              </div>
              <div
                id="associatedNotes"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "20px",
                  width: "100%",
                  margin: "0 auto",
                }}
              >
                {sortedNotes.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                    <div className="empty-icon">📋</div>
                    <div className="empty-text">No notes yet</div>
                  </div>
                ) : (
                  sortedNotes.map((note) => {
                    const preview = noteToDisplayText(note);
                    const previewShort =
                      preview.length > 200
                        ? `${preview.substring(0, 200)}...`
                        : preview || "No content";
                    return (
                      <div
                        className="note-card"
                        data-note-id={note.id}
                        key={note.id}
                        style={{
                          background: "#fff",
                          borderRadius: "12px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                          padding: "20px",
                          minWidth: 0,
                          width: "100%",
                          display: "flex",
                          flexDirection: "column",
                          transition: "box-shadow 0.2s, transform 0.2s",
                          cursor: "pointer",
                          position: "relative",
                          border:
                            selectedNoteId === note.id
                              ? "2px solid #22c55e"
                              : "",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow =
                            "0 4px 16px rgba(0,0,0,0.16)";
                          e.currentTarget.style.transform =
                            "translateY(-4px) scale(1.03)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow =
                            "0 2px 8px rgba(0,0,0,0.08)";
                          e.currentTarget.style.transform = "none";
                        }}
                        onClick={() => setSelectedNoteId(note.id)}
                      >
                        <div
                          className="recent-icon"
                          style={{ fontSize: "2rem", marginBottom: "8px" }}
                        >
                          📋
                        </div>
                        <div
                          className="recent-title"
                          style={{ fontWeight: "bold", marginBottom: "6px" }}
                        >
                          {format.formatTimestamp(note.created_at)}
                        </div>
                        <div
                          className="recent-preview"
                          style={{
                            color: "#555",
                            marginBottom: "12px",
                            fontSize: "0.95em",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {previewShort}
                        </div>
                        {selectedNoteId === note.id && (
                          <div
                            style={{
                              position: "absolute",
                              top: 10,
                              right: 10,
                              background: "#22c55e",
                              borderRadius: "50%",
                              width: "28px",
                              height: "28px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: "1.2rem",
                              boxShadow: "0 2px 6px rgba(34,197,94,0.2)",
                            }}
                          >
                            ✓
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  className={`bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium ${
                    selectedNoteId ? "" : "opacity-50 cursor-not-allowed"
                  }`}
                  disabled={!selectedNoteId}
                  onClick={handleEditNote}
                >
                  Edit this note
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg mb-4">
          <button
            className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
            onClick={() => {
              if (editingNote) toggleSection("editNote");
            }}
            disabled={!editingNote}
          >
            <span className="text-lg font-semibold">
              3. Edit Selected Note
            </span>
            <span className="text-xl">
              {openSections.editNote ? "−" : "+"}
            </span>
          </button>
          {openSections.editNote && editingNote && (
            <div className="p-6 border-t border-gray-200">
              <div className="mb-6">
                <label className="block text-sm font-bold text-xl text-gray-700 mb-2">
                  Note
                </label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  disabled={isSaving}
                  className="w-full h-80 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 bg-white resize-none"
                  style={{ minHeight: "8rem" }}
                  placeholder="Note content..."
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <CopyToClipboard
                    text={noteText}
                    label="Copy"
                    placement="right"
                  />
                </div>
              </div>
              <div className="flex flex-col items-end">
                <button
                  onClick={() => saveNote(editingNote.id)}
                  disabled={isSaving}
                  className={`bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium ${
                    isSaving ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Save Note
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default EditPatientEncounterPage;
