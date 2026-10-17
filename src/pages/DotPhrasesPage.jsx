import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";
import * as format from "@/utils/format.js";
import Auth from "@/components/Auth.jsx";
import PageHeaderCountBadge from "@/components/PageHeaderCountBadge.jsx";
import IconEdit from "@/components/IconEdit.jsx";

const DEMO_DOT_PHRASE = {
  trigger: "exam teenager",
  expansion:
    "General: Alert, responsive. HEENT: Normocephalic, atraumatic...",
};

export default function DotPhrasesPage() {
  const navigate = useNavigate();
  const [dotPhrases, setDotPhrases] = useState([]);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [editValues, setEditValues] = useState({ trigger: "", expansion: "" });
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [error, setError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    if (selectedRowId === null && !isCreatingNew) return;
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedRowId, isCreatingNew]);

  const fetchDotPhrases = useCallback(async () => {
    const jwt = api.getJWT();
    if (!jwt) {
      navigate("/login");
      return;
    }
    setError(null);
    const result = await api.getAllDotPhrases();
    if (!result.success) {
      // Only logout on 401 (authentication error)
      if (result.status === 401) {
        navigate("/login");
      } else {
        // Show user-friendly error for other failures (404, 500, etc)
        setError(`Failed to load dot phrases: ${result.error}`);
        setDotPhrases([]);
      }
      setHasLoaded(true);
      return;
    }
    setDotPhrases(result.data);
    setHasLoaded(true);
  }, [navigate]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchDotPhrases().catch(console.error);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [fetchDotPhrases]);

  const handleEditClick = (dotPhrase) => {
    setSelectedRowId(dotPhrase.id);
    setEditValues({
      trigger: dotPhrase.trigger,
      expansion: dotPhrase.expansion,
    });
    setIsCreatingNew(false);
  };

  const handleDeleteClick = async (dotPhrase) => {
    if (
      confirm(
        `Are you sure you want to delete the dot phrase "${dotPhrase.trigger}"?`,
      )
    ) {
      const result = await api.deleteDotPhrase(dotPhrase.id);
      if (!result.success) {
        if (result.status === 401) {
          navigate("/login");
        } else {
          setError(`Delete failed: ${result.error}`);
        }
        return;
      }
      window.location.reload();
    }
  };

  const handleSave = async () => {
    if (isCreatingNew) {
      const result = await api.createDotPhrase({
        trigger: editValues.trigger,
        expansion: editValues.expansion,
      });
      if (!result.success) {
        if (result.status === 401) {
          navigate("/login");
        } else {
          setError(`Save failed: ${result.error}`);
        }
        return;
      }
      else {
        window.location.reload();
      }
    } else {
      const result = await api.updateDotPhrase(selectedRowId, {
        trigger: editValues.trigger,
        expansion: editValues.expansion,
      });
      if (!result.success) {
        if (result.status === 401) {
          navigate("/login");
        } else {
          setError(`Save failed: ${result.error}`);
        }
      } else {
        window.location.reload();
      }
    }
  };

  const handleCancel = () => {
    setSelectedRowId(null);
    setIsCreatingNew(false);
    setEditValues({ trigger: "", expansion: "" });
    setError(null);
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedRowId(null);
    setEditValues({ trigger: "", expansion: "" });
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  const rowGridClass =
    "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,16rem)_1fr] sm:gap-6";
  const editorInputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition focus:border-[#183278] focus:outline-none focus:ring-2 focus:ring-[#183278]/20";

  const renderEditor = () => (
    <div ref={editorRef} className="bg-[#F9FAFF] px-5 py-4">
      <div className={rowGridClass}>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3C4C78]">
            Dot phrase
          </label>
          <input
            type="text"
            value={editValues.trigger}
            onChange={(e) =>
              setEditValues({
                ...editValues,
                trigger: e.target.value.substring(0, 50),
              })
            }
            className={editorInputClass}
            placeholder="e.g. exam teenager"
            maxLength={50}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#3C4C78]">
            Full text
          </label>
          <textarea
            value={editValues.expansion}
            onChange={(e) =>
              setEditValues({
                ...editValues,
                expansion: e.target.value,
              })
            }
            className={`${editorInputClass} resize-y`}
            placeholder="The text this phrase expands into"
            style={{ whiteSpace: "pre-wrap", height: "70vh" }}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={handleCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="rounded-lg bg-[#183278] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#142a66]"
        >
          Save
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Auth />
      <div className="max-w-5xl mx-auto p-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold text-gray-900">
              <span>Dot Phrases</span>
              <PageHeaderCountBadge count={dotPhrases.length} />
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Short triggers words you can say while recording your patient visit. These will expand into the full text excerpt you set for each dot phrase.
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            disabled={isCreatingNew || selectedRowId !== null}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-[#183278] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#142a66] disabled:cursor-not-allowed disabled:bg-gray-300 sm:self-auto"
          >
            + New Dot Phrase
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="shrink-0 text-sm font-medium text-red-600 underline hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dot Phrases Card */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Column headers */}
          <div
            className={`${rowGridClass} border-b border-gray-200 bg-[#F9FAFF] px-5 py-3`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-[#3C4C78]">
              Dot Phrase
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[#3C4C78]">
              Full Text
            </div>
          </div>

          {dotPhrases.length === 0 ? (
            error ? (
              <div className="p-8 text-center text-gray-500">
                Unable to load dot phrases
              </div>
            ) : hasLoaded ? (
              <>
                <div
                  className="select-none border-b border-dashed border-gray-200 bg-gray-50/60 px-5 py-4"
                  aria-hidden="true"
                >
                  <p className="mb-2 text-xs font-medium text-gray-400">
                    Example:
                  </p>
                  <div
                    className={`${rowGridClass} items-center italic text-gray-400`}
                  >
                    <p className="font-medium">{DEMO_DOT_PHRASE.trigger}</p>
                    <p>{DEMO_DOT_PHRASE.expansion}</p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-8 px-5 py-8">
                  <p className="text-sm text-gray-500">
                    No dot phrases yet. Create your first one to get started.
                  </p>
                  <button
                    onClick={handleCreateNew}
                    disabled={isCreatingNew || selectedRowId !== null}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#183278] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#142a66] disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    + New Dot Phrase
                  </button>
                </div>
              </>
            ) : null
          ) : (
            dotPhrases.map((dotPhrase) => (
              <div key={dotPhrase.id}>
                {/* Normal Row */}
                {selectedRowId !== dotPhrase.id && (
                  <div
                    className="group cursor-pointer border-b border-gray-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-[#F9FAFF]"
                    data-dot-phrase-id={dotPhrase.id}
                    onClick={() => handleEditClick(dotPhrase)}
                  >
                    <div className={`${rowGridClass} items-center`}>
                      <p className="font-medium text-gray-900">
                        {truncateText(dotPhrase.trigger)}
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-gray-600">
                          {truncateText(dotPhrase.expansion)}
                        </p>
                        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(dotPhrase);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-[#183278]/10 hover:text-[#183278]"
                            title="Edit"
                            aria-label="Edit dot phrase"
                          >
                            <IconEdit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(dotPhrase);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                            aria-label="Delete dot phrase"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit Row */}
                {selectedRowId === dotPhrase.id && (
                  <div className="border-b border-gray-100 last:border-b-0">
                    {renderEditor()}
                  </div>
                )}
              </div>
            ))
          )}

          {/* New Dot Phrase Row */}
          {isCreatingNew && (
            <div className="border-t border-gray-100">{renderEditor()}</div>
          )}
        </div>
      </div>
    </>
  );
}
