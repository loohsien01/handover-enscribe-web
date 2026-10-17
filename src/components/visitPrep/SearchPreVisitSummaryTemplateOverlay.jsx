import React, { useState, useEffect } from 'react';
import {
  deletePreVisitSummaryTemplate,
  listPreVisitSummaryTemplates,
} from '@/lib/preVisitSummaryTemplatesApi.js';

/** Platform standard (user_id === null) first, then name within each tier. */
function filterTemplatesBySearchAndSort(cachedTemplates, searchQuery) {
  if (!Array.isArray(cachedTemplates)) return [];
  const q = (searchQuery || '').toLowerCase();
  return cachedTemplates
    .filter((template) => (template.name || '').toLowerCase().includes(q))
    .sort((a, b) => {
      const aStd = a.user_id === null ? 0 : 1;
      const bStd = b.user_id === null ? 0 : 1;
      if (aStd !== bStd) return aStd - bStd;
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
}

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

function DeleteIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6h6M10 6l.5-2h3L14 6m-8 0h12l-1 14H7L6 6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h8"
        stroke="currentColor"
        strokeWidth="1.75"
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

function TemplateListSkeleton() {
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

/**
 * Browse pre-visit summary instruction templates.
 * Fetches with decrypt_text=true on first open; client-side search on name.
 */
export default function SearchPreVisitSummaryTemplateOverlay({
  isOpen,
  onClose,
  onSelectTemplate,
  onNewInstruction,
  onCopyTemplate,
  onDeleteTemplate,
  cachedTemplates,
  setCachedTemplates,
  isLoadingTemplates,
  setIsLoadingTemplates,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    if (!isOpen || cachedTemplates !== null) return;

    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const res = await listPreVisitSummaryTemplates({
          limit: 100,
          decrypt_text: true,
          sortBy: 'name',
          order: 'asc',
        });
        if (res.ok) {
          setCachedTemplates(Array.isArray(res.data) ? res.data : []);
        } else {
          console.error('Failed to fetch pre-visit summary templates:', res.message);
          setCachedTemplates([]);
        }
      } catch (err) {
        console.error('Error fetching pre-visit summary templates:', err);
        setCachedTemplates([]);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    void fetchTemplates();
  }, [isOpen, cachedTemplates, setCachedTemplates, setIsLoadingTemplates]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await listPreVisitSummaryTemplates({
        limit: 100,
        decrypt_text: true,
        sortBy: 'name',
        order: 'asc',
      });
      if (res.ok) {
        setCachedTemplates(Array.isArray(res.data) ? res.data : []);
      } else {
        console.error('Failed to refresh templates:', res.message);
      }
    } catch (err) {
      console.error('Error refreshing templates:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredTemplates = filterTemplatesBySearchAndSort(cachedTemplates, searchQuery);

  const handleSelectTemplate = (template) => {
    onSelectTemplate(template);
    setSearchQuery('');
  };

  const handleNewInstruction = () => {
    onNewInstruction();
    setSearchQuery('');
  };

  const handleCopyTemplate = (template, event) => {
    event.stopPropagation();
    onCopyTemplate?.(template);
    setSearchQuery('');
  };

  const handleDeleteTemplate = async (template, event) => {
    event.stopPropagation();
    if (template.user_id === null || deletingTemplateId) return;

    const name = String(template.name ?? 'this template');
    const ok = window.confirm(`Delete "${name}"? This cannot be undone.`);
    if (!ok) return;

    const templateId = String(template.id);
    setDeletingTemplateId(templateId);
    try {
      const res = await deletePreVisitSummaryTemplate(templateId);
      if (!res.ok) {
        window.alert(res.message || 'Could not delete template.');
        return;
      }

      setCachedTemplates((prev) =>
        Array.isArray(prev) ? prev.filter((row) => String(row.id) !== templateId) : prev,
      );
      onDeleteTemplate?.(templateId);
    } catch (err) {
      console.error('Error deleting pre-visit summary template:', err);
      window.alert('Could not delete template.');
    } finally {
      setDeletingTemplateId(null);
    }
  };

  if (!isOpen) return null;

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
        aria-labelledby="instruction-templates-title"
        className="relative flex h-[min(650px,85vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
      >
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id="instruction-templates-title"
                className="text-lg font-semibold tracking-tight text-gray-900 sm:text-xl"
              >
                Instruction templates
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Pick a saved instruction template or start from scratch.
              </p>
            </div>
            <div className="flex h-[3.125rem] shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleNewInstruction}
                className="flex h-[70%] shrink-0 items-center gap-2 rounded-lg bg-[#183278] px-3 text-sm font-semibold whitespace-nowrap text-white shadow-sm transition hover:bg-[#142a66] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
              >
                <span className="text-base font-normal leading-none" aria-hidden>
                  +
                </span>
                <span>New instruction</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-full w-[3.125rem] shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-100 px-5 py-3 sm:px-6">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 transition focus-within:border-[#183278]/35 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#183278]/15">
            <SearchIcon className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoadingTemplates}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing || isLoadingTemplates}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-white hover:text-[#183278] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
              title="Refresh templates"
              aria-label="Refresh templates"
            >
              <RefreshIcon
                className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#183278]' : ''}`}
              />
              <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {isLoadingTemplates ? (
            <TemplateListSkeleton />
          ) : cachedTemplates ? (
            <>
              {filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                    <SearchIcon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    {searchQuery ? 'No templates match your search' : 'No templates yet'}
                  </p>
                  <p className="mt-1 max-w-xs text-sm text-gray-500">
                    {searchQuery
                      ? 'Try a different name or clear the search.'
                      : 'Use + New instruction to write your own.'}
                  </p>
                  {!searchQuery ? (
                    <button
                      type="button"
                      onClick={handleNewInstruction}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#183278]/25 px-5 py-2 text-sm font-semibold text-[#183278] transition hover:bg-[#E8EEFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
                    >
                      <span className="text-base font-normal leading-none" aria-hidden>
                        +
                      </span>
                      <span>New instruction</span>
                    </button>
                  ) : null}
                </div>
              ) : (
                <ul className="space-y-2">
                  {filteredTemplates.map((template) => {
                    const isPlatformStandard = template.user_id === null;
                    const sectionType = isPlatformStandard ? 'Standard' : 'Custom';

                    return (
                      <li key={template.id}>
                        <div className="group relative overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm transition hover:border-[#183278]/25 hover:bg-[#E8EEFB]/35 hover:shadow-md focus-within:ring-2 focus-within:ring-[#183278]/40">
                          <button
                            type="button"
                            onClick={() => handleSelectTemplate(template)}
                            aria-label={`Use ${template.name}`}
                            className="absolute inset-0 z-0 focus:outline-none"
                          />
                          <div className="pointer-events-none relative z-10 px-4 py-3.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-900">{template.name}</span>
                                {template.is_default ? (
                                  <span className="rounded-full bg-[#183278]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#183278]">
                                    Default
                                  </span>
                                ) : null}
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
                              <div className="pointer-events-auto flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(event) => handleCopyTemplate(template, event)}
                                  className="inline-flex items-center justify-center rounded-md p-1 text-[#183278] transition hover:bg-[#183278]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
                                  title={`Copy ${template.name}`}
                                  aria-label={`Copy ${template.name}`}
                                >
                                  <CopyIcon className="h-[1.125rem] w-[1.125rem]" />
                                </button>
                                {!isPlatformStandard ? (
                                  <button
                                    type="button"
                                    onClick={(event) => void handleDeleteTemplate(template, event)}
                                    disabled={deletingTemplateId === String(template.id)}
                                    className="inline-flex items-center justify-center rounded-md p-1 text-[#183278] transition hover:bg-[#183278]/10 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
                                    title={`Delete ${template.name}`}
                                    aria-label={`Delete ${template.name}`}
                                  >
                                    {deletingTemplateId === String(template.id) ? (
                                      <RefreshIcon className="h-[1.125rem] w-[1.125rem] animate-spin" />
                                    ) : (
                                      <DeleteIcon className="h-[1.125rem] w-[1.125rem]" />
                                    )}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            {template.text ? (
                              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-500">
                                {template.text}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
