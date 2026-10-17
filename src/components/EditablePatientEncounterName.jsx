import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";
import IconEdit from "@/components/IconEdit.jsx";

/**
 * Inline encounter name editor with:
 * - view mode (disabled input + pencil)
 * - edit mode (enabled input + save icon)
 * - background save state (spinner, hover→pencil)
 * - queued saves when edits occur during in-flight save
 */
export default function EditablePatientEncounterName({
  encounterId,
  value,
  label = "Patient Encounter Name",
  onSaved,
  className = "",
}) {
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [isIconHovered, setIsIconHovered] = useState(false);
  const [draft, setDraft] = useState(value || "");

  const inputRef = useRef(null);
  const iconButtonRef = useRef(null);
  const queuedSaveRef = useRef(null); // string | null
  const saveInFlightRef = useRef(false);
  const resetSavedTimeoutRef = useRef(null);

  const trimmedValue = useMemo(() => (value || "").trim(), [value]);

  useEffect(() => {
    // Keep draft in sync with external value when not actively editing.
    if (!isEditing && !saveInFlightRef.current) {
      setDraft(value || "");
    }
  }, [value, isEditing]);

  useEffect(() => {
    return () => {
      if (resetSavedTimeoutRef.current) {
        window.clearTimeout(resetSavedTimeoutRef.current);
        resetSavedTimeoutRef.current = null;
      }
    };
  }, []);

  const flushQueuedSaves = async () => {
    if (!encounterId) return;
    if (saveInFlightRef.current) return;

    saveInFlightRef.current = true;
    setSaveState("saving");

    try {
      while (true) {
        const queued = queuedSaveRef.current;
        if (!queued) break;
        queuedSaveRef.current = null;

        const nextName = queued.trim();
        if (!nextName) continue;

        const result = await api.patchPatientEncounter(encounterId, {
          name: nextName,
        });

        if (!result.success) {
          console.error("Error saving patient encounter name:", result.error);
          if (result.status === 401) {
            navigate("/login");
            return;
          }
          alert("Error saving data: " + result.error);
          setSaveState("idle");
          return;
        }

        onSaved?.(nextName);
        setDraft(nextName);
      }

      setSaveState("saved");
      if (resetSavedTimeoutRef.current) {
        window.clearTimeout(resetSavedTimeoutRef.current);
        resetSavedTimeoutRef.current = null;
      }
      resetSavedTimeoutRef.current = window.setTimeout(() => {
        setSaveState("idle");
        resetSavedTimeoutRef.current = null;
      }, 2000);
    } finally {
      saveInFlightRef.current = false;
      if (queuedSaveRef.current) flushQueuedSaves();
    }
  };

  const commit = () => {
    if (!encounterId) return;
    const nextName = (draft || "").trim();

    setIsEditing(false);

    if (!nextName) {
      alert("Required field(s): Patient Encounter Name");
      setDraft(value || "");
      return;
    }
    if (nextName === trimmedValue) return;

    if (resetSavedTimeoutRef.current) {
      window.clearTimeout(resetSavedTimeoutRef.current);
      resetSavedTimeoutRef.current = null;
    }

    queuedSaveRef.current = nextName;
    if (saveInFlightRef.current) {
      setSaveState("saving");
      return;
    }
    flushQueuedSaves();
  };

  const showSpinner = saveState === "saving" && !isIconHovered && !isEditing;

  return (
    <div className={`mb-6 ${className}`.trim()}>
      {label ? (
        <label className="block text-sm font-bold text-xl text-gray-700 mb-2">
          {label}
        </label>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!isEditing}
          onBlur={(e) => {
            if (!isEditing) return;
            // If focus is moving to the icon button, let the button click handle commit.
            if (e.relatedTarget && e.relatedTarget === iconButtonRef.current) {
              return;
            }
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setDraft(value || "");
              setIsEditing(false);
              setSaveState("idle");
            }
          }}
          className={`w-full px-3 py-2 border rounded-lg border-gray-300 disabled:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            !isEditing
              ? "bg-gray-50 text-gray-700 cursor-not-allowed truncate"
              : "bg-white text-gray-900"
          }`}
          placeholder="Enter patient encounter name..."
        />

        <button
          ref={iconButtonRef}
          type="button"
          aria-label={
            isEditing
              ? "Save patient encounter name"
              : saveState === "saving"
                ? "Saving"
                : saveState === "saved"
                  ? "Saved"
                  : "Edit patient encounter name"
          }
          title={
            isEditing
              ? "Save"
              : saveState === "saving"
                ? "Saving"
                : saveState === "saved"
                  ? "Saved"
                  : "Edit"
          }
          onMouseEnter={() => setIsIconHovered(true)}
          onMouseLeave={() => setIsIconHovered(false)}
          onClick={() => {
            if (isEditing) {
              commit();
              return;
            }
            setIsEditing(true);
            window.setTimeout(() => {
              inputRef.current?.focus?.();
              inputRef.current?.select?.();
            }, 0);
          }}
          className={`flex items-center justify-center w-10 h-10 min-w-10 min-h-10 rounded-full border transition ${
            showSpinner ? "opacity-90" : "hover:bg-gray-100"
          }`}
          style={{ backgroundColor: "#f3f4f6", borderColor: "#d1d5db" }}
        >
          {isEditing ? (
            // Save icon
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Save"
              role="img"
            >
              <path
                d="M19 21H5a2 2 0 0 1-2-2V7l4-4h10l4 4v12a2 2 0 0 1-2 2Z"
                stroke="#374151"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M17 21v-8H7v8"
                stroke="#374151"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M7 3v4h8"
                stroke="#374151"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          ) : showSpinner ? (
            // Spinner (same style as AudioPlayer)
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Saving"
              role="img"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="#6b7280"
                strokeWidth="3"
                opacity="0.25"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="#6b7280"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 12 12"
                  to="360 12 12"
                  dur="0.8s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
          ) : saveState === "saved" ? (
            // Tick
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Saved"
              role="img"
            >
              <path
                d="M20 6L9 17l-5-5"
                stroke="#16a34a"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <IconEdit className="h-[18px] w-[18px] text-[#374151]" />
          )}
        </button>
      </div>
    </div>
  );
}

