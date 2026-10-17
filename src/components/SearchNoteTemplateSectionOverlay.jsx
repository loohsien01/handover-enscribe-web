import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import * as api from '@/lib/api';
import Select from '@/components/Select.jsx';
import { DEFAULT_LAYOUT } from '@/constants/layoutTypes';
import { logNoteTemplateSectionsClassification } from '@/utils/noteTemplateSectionClassificationDebug.js';

function SearchIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12a8 8 0 10-8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 4v6h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
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

function CloseIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SectionListSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3.5"
        >
          <div className="mb-2 h-4 w-2/5 rounded bg-gray-200" />
          <div className="h-3 w-full rounded bg-gray-100" />
          <div className="mt-1.5 h-3 w-4/5 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

/** Platform standard (user_id === null) first, then name within each tier. */
function filterSectionsBySearchAndSort(cachedSections, searchQuery) {
  if (!Array.isArray(cachedSections)) return [];
  const q = (searchQuery || '').toLowerCase();
  return cachedSections
    .filter((section) => (section.name || '').toLowerCase().includes(q))
    .sort((a, b) => {
      const aStd = a.user_id === null ? 0 : 1;
      const bStd = b.user_id === null ? 0 : 1;
      if (aStd !== bStd) return aStd - bStd;
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
}

/**
 * SearchNoteTemplateSectionOverlay - Search existing sections or create new ones
 * Fetches sections on first render and caches them in parent state
 * Implements client-side search to avoid backend decryption on every keystroke
 */
export default function SearchNoteTemplateSectionOverlay({
  isOpen,
  onClose,
  onAddSection,
  cachedSections,
  setCachedSections,
  isLoadingSections,
  setIsLoadingSections,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState('search'); // 'search' or 'create'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [newSectionForm, setNewSectionForm] = useState({
    name: '',
    layout: DEFAULT_LAYOUT,
    details: '',
  });

  const [retentionExpanded, setRetentionExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setRetentionExpanded(false);
  }, [isOpen]);

  // Trace misclassification: same counters as API parse vs what the overlay list reads from props.
  useEffect(() => {
    if (cachedSections == null) {
      console.info(
        '[note-template-sections UI classification] SearchNoteTemplateSectionOverlay cachedSections is null (no cache yet)'
      );
      return;
    }
    logNoteTemplateSectionsClassification(
      'SearchNoteTemplateSectionOverlay cachedSections prop update',
      cachedSections
    );
  }, [cachedSections]);

  // Fetch sections on first open
  useEffect(() => {
    if (!isOpen || cachedSections !== null) return;

    const fetchSections = async () => {
      setIsLoadingSections(true);
      try {
        const result = await api.getAllNoteSections();
        if (result.success) {
          const rows = result.data || [];
          logNoteTemplateSectionsClassification(
            'SearchNoteTemplateSectionOverlay before setCachedSections (lazy fetch on open)',
            rows
          );
          setCachedSections(rows);
        } else {
          console.error('Failed to fetch sections:', result.error);
          setCachedSections([]);
        }
      } catch (err) {
        console.error('Error fetching sections:', err);
        setCachedSections([]);
      } finally {
        setIsLoadingSections(false);
      }
    };

    fetchSections();
  }, [isOpen, cachedSections, setCachedSections, setIsLoadingSections]);

  // Handle refresh sections
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await api.getAllNoteSections();
      if (result.success) {
        const rows = result.data || [];
        logNoteTemplateSectionsClassification(
          'SearchNoteTemplateSectionOverlay before setCachedSections (refresh)',
          rows
        );
        setCachedSections(rows);
      } else {
        console.error('Failed to refresh sections:', result.error);
      }
    } catch (err) {
      console.error('Error refreshing sections:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredSections = filterSectionsBySearchAndSort(cachedSections, searchQuery);

  useEffect(() => {
    if (!isOpen || !Array.isArray(cachedSections) || !searchQuery.trim()) return;
    const filtered = filterSectionsBySearchAndSort(cachedSections, searchQuery);
    logNoteTemplateSectionsClassification(
      'SearchNoteTemplateSectionOverlay filtered list (non-empty search)',
      filtered
    );
  }, [isOpen, cachedSections, searchQuery]);

  // Handle clicking an existing section — immediately adds it to the template
  const handleSelectSection = (section) => {
    // Platform catalog rows (user_id === null) must not be PATCHed by id on template save;
    // TemplateBuilder sends them as new sections. Mark as new so state matches that behavior.
    const isPlatformCatalog = section.user_id === null;
    const sectionToAdd = {
      ...section,
      id: uuidv4(),
      sourceId: section.id,
      isNew: isPlatformCatalog ? true : false,
    };
    onAddSection(sectionToAdd);
    setSearchQuery('');
  };

  // Handle creating new section
  const handleCreateNewSection = () => {
    if (!newSectionForm.name.trim()) {
      setAttemptedSubmit(true);
      alert('Please enter a section name');
      return;
    }
    if (!newSectionForm.details.trim()) {
      setAttemptedSubmit(true);
      alert('Please enter section details');
      return;
    }

    const newSection = {
      id: uuidv4(),
      name: newSectionForm.name,
      layout: newSectionForm.layout,
      details: newSectionForm.details,
      user_id: undefined,
      isNew: true,
    };

    // Add to cached sections temporarily (user will save template later)
    if (cachedSections) {
      const next = [...cachedSections, newSection];
      logNoteTemplateSectionsClassification(
        'SearchNoteTemplateSectionOverlay before setCachedSections (append draft from Create New)',
        next
      );
      setCachedSections(next);
    }

    onAddSection(newSection);

    // Reset form
    setNewSectionForm({
      name: '',
      layout: DEFAULT_LAYOUT,
      details: '',
    });
  };

  // Handle mode change - reset state
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setSearchQuery('');
    setNewSectionForm({
      name: '',
      layout: DEFAULT_LAYOUT,
      details: '',
    });
  };

  if (!isOpen) return null;

  const isCreateDisabled = !newSectionForm.name.trim() || !newSectionForm.details.trim();
  const isDetailsEmpty = !newSectionForm.details.trim();

  const tabClass = (active) =>
    `flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
      active
        ? 'border-b-2 border-[#183278] bg-[#E8EEFB]/60 text-[#183278]'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`;

  const fieldFocusClass =
    'focus:outline-none focus:ring-2 focus:ring-[#183278]/40 focus:border-[#183278]/35';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-[2px]"
        style={{ cursor: 'pointer' }}
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-section-title"
        className="relative flex h-[min(650px,85vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
      >
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id="add-section-title"
                className="text-lg font-semibold tracking-tight text-gray-900 sm:text-xl"
              >
                Add section
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Search the library or create a new section for your template.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="flex border-b border-gray-100">
          <button type="button" onClick={() => handleModeChange('search')} className={tabClass(mode === 'search')}>
            Search existing
          </button>
          <button type="button" onClick={() => handleModeChange('create')} className={tabClass(mode === 'create')}>
            Create new
          </button>
        </div>

        {mode === 'search' ? (
          <div className="border-b border-gray-100 px-5 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 transition focus-within:border-[#183278]/35 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#183278]/15">
                <SearchIcon className="h-4 w-4 shrink-0 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isLoadingSections}
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing || isLoadingSections}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-white hover:text-[#183278] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
                  title="Refresh sections"
                  aria-label="Refresh sections"
                >
                  <RefreshIcon
                    className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#183278]' : ''}`}
                  />
                  <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
                </button>
              </div>
              <button
                type="button"
                id="section-retention-disclosure"
                aria-expanded={retentionExpanded}
                aria-pressed={retentionExpanded}
                aria-controls="section-retention-panel"
                title="Section retention — unused detached sections are removed after five days"
                onClick={() => setRetentionExpanded((v) => !v)}
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40 ${
                  retentionExpanded
                    ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <span className="sr-only">Section retention policy</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <svg
                  className={`pointer-events-none absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border text-white shadow-sm ${
                    retentionExpanded ? 'border-amber-100 bg-amber-800' : 'border-white bg-[#183278]'
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {mode === 'search' ? (
            <div className="space-y-3">
              {retentionExpanded ? (
                <div
                  id="section-retention-panel"
                  role="region"
                  aria-labelledby="section-retention-disclosure"
                  className="rounded-xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 text-sm leading-relaxed text-amber-950 shadow-sm"
                >
                  <p>
                    To remove unused sections, detach them from all your note templates first.
                    Sections that are not linked to any template are removed automatically after five
                    days as part of our data retention policy.
                  </p>
                </div>
              ) : null}

              {isLoadingSections ? (
                <SectionListSkeleton />
              ) : cachedSections ? (
                <>
                  {filteredSections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                        <SearchIcon className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">
                        {searchQuery ? 'No sections match your search' : 'No sections available'}
                      </p>
                      <p className="mt-1 max-w-xs text-sm text-gray-500">
                        {searchQuery
                          ? 'Try a different name or clear the search.'
                          : 'Switch to Create new to add your first section.'}
                      </p>
                      {!searchQuery ? (
                        <button
                          type="button"
                          onClick={() => handleModeChange('create')}
                          className="mt-4 rounded-lg border border-[#183278]/25 px-3 py-2 text-sm font-semibold text-[#183278] transition hover:bg-[#E8EEFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
                        >
                          Create new section
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {filteredSections.map((section) => {
                        const isPlatformStandard = section.user_id === null;
                        const sectionType = isPlatformStandard ? 'Standard' : 'Custom';

                        return (
                          <li key={section.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectSection(section)}
                              className="group flex w-full items-start gap-3 rounded-xl border border-gray-200/90 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-[#183278]/25 hover:bg-[#E8EEFB]/35 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-gray-900">{section.name}</span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      isPlatformStandard
                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10'
                                        : 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10'
                                    }`}
                                  >
                                    {sectionType}
                                  </span>
                                </div>
                                <div className="mt-1.5 space-y-1 text-sm text-gray-500">
                                  <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                    {section.layout}
                                  </div>
                                  {section.details ? (
                                    <p className="line-clamp-2 leading-relaxed">{section.details}</p>
                                  ) : null}
                                </div>
                              </div>
                              <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-[#183278]" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Section name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chief Complaint"
                  value={newSectionForm.name}
                  onChange={(e) =>
                    setNewSectionForm({
                      ...newSectionForm,
                      name: e.target.value,
                    })
                  }
                  className={`w-full rounded-xl border border-gray-300 px-3 py-2 ${fieldFocusClass}`}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Layout</label>
                <Select
                  value={newSectionForm.layout}
                  onChange={(e) =>
                    setNewSectionForm({
                      ...newSectionForm,
                      layout: e.target.value,
                    })
                  }
                  className={`rounded-xl py-2 ${fieldFocusClass}`}
                >
                  <option value="bullet points">Bullet Points</option>
                  <option value="paragraph">Paragraph</option>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Section details…"
                  value={newSectionForm.details}
                  onChange={(e) => {
                    setAttemptedSubmit(false);
                    setNewSectionForm({
                      ...newSectionForm,
                      details: e.target.value,
                    });
                  }}
                  className={`h-40 w-full resize-none rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-inset ${
                    attemptedSubmit && isDetailsEmpty
                      ? 'border-red-500 focus:ring-red-500'
                      : `border-gray-300 ${fieldFocusClass}`
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {mode === 'create' ? (
          <div className="border-t border-gray-100 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={handleCreateNewSection}
              disabled={isCreateDisabled}
              className="w-full rounded-xl bg-[#183278] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#142a66] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Add section
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
