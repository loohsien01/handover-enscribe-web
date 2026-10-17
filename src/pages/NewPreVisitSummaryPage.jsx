import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Auth from '@/components/Auth.jsx';
import { visitPrepStepFieldInsetClass } from '@/components/visitPrep/VisitPrepStepHint.jsx';
import { visitPrepMainColumnClass } from '@/components/visitPrep/VisitPrepPageShell.jsx';
import SearchPreVisitSummaryTemplateOverlay from '@/components/visitPrep/SearchPreVisitSummaryTemplateOverlay.jsx';
import IconEdit from '@/components/IconEdit.jsx';
import * as api from '@/lib/api';
import {
  createPreVisitSummaryTemplate,
  listPreVisitSummaryTemplates,
  patchPreVisitSummaryTemplate,
} from '@/lib/preVisitSummaryTemplatesApi.js';
import { formatVisitPrepUserMessage } from '@/utils/visitPrepMessage.js';
import {
  formatVisitPrepSavedAt,
  VISIT_PREP_INSTRUCTION_AUTOSAVE_IDLE_MS,
} from '@/utils/visitPrepSavedAt.js';
import { SESSION_KEYS } from '@/utils/storageConfig.js';

const MAX_PRIOR_VISITS = 3;
const BODY_TEXT = 'text-base';
const META_TEXT = 'text-xs';

/** @param {Record<string, unknown>[] | null} templates */
function pickDefaultTemplate(templates) {
  if (!Array.isArray(templates) || templates.length === 0) return null;
  const userDefault = templates.find((t) => t.user_id != null && t.is_default);
  if (userDefault) return userDefault;
  return templates.find((t) => t.user_id === null && t.is_default) ?? null;
}

/** @param {Record<string, unknown>[] | null | undefined} templates @param {Record<string, unknown>} updated */
function mergeTemplateIntoCache(templates, updated) {
  if (!Array.isArray(templates)) return [updated];
  return templates.map((t) => {
    if (t.id === updated.id) return updated;
    if (updated.is_default && t.user_id === updated.user_id && t.user_id != null) {
      return { ...t, is_default: false };
    }
    return t;
  });
}

/** @param {Record<string, unknown> | null | undefined} template */
function isCustomTemplate(template) {
  return template != null && template.user_id != null;
}

function PreVisitSummaryStepPath({ step, onStepChange }) {
  const steps = [
    { id: 1, label: 'Prior visit records' },
    { id: 2, label: 'Nova AI instructions' },
  ];

  return (
    <nav aria-label="Pre-visit summary steps" className="w-full">
      <ol className="flex w-full items-center gap-3">
        <li className="shrink-0">
          {(() => {
            const item = steps[0];
            const isActive = step === item.id;
            const isComplete = step > item.id;
            return (
              <button
                type="button"
                onClick={() => onStepChange(1)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-left transition ${
                  isActive
                    ? 'bg-[#E8EEFB] text-[#183278] ring-1 ring-[#183278]/20'
                    : isComplete
                      ? 'text-[#183278] hover:bg-gray-100'
                      : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    isActive
                      ? 'border-[#183278] bg-[#183278] text-white'
                      : isComplete
                        ? 'border-[#183278] bg-white text-[#183278]'
                        : 'border-gray-300 bg-white text-gray-500'
                  }`}
                >
                  {item.id}
                </span>
                <span className="text-sm font-medium leading-none">{item.label}</span>
              </button>
            );
          })()}
        </li>
        <li
          className={`h-px min-w-[2rem] flex-1 ${step > 1 ? 'bg-[#183278]/35' : 'bg-gray-300'}`}
          aria-hidden
        />
        <li className="shrink-0">
          {(() => {
            const item = steps[1];
            const isActive = step === item.id;
            return (
              <button
                type="button"
                onClick={() => onStepChange(2)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-left transition ${
                  isActive
                    ? 'bg-[#E8EEFB] text-[#183278] ring-1 ring-[#183278]/20'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    isActive
                      ? 'border-[#183278] bg-[#183278] text-white'
                      : 'border-gray-300 bg-white text-gray-500'
                  }`}
                >
                  {item.id}
                </span>
                <span className="text-sm font-medium leading-none">{item.label}</span>
              </button>
            );
          })()}
        </li>
      </ol>
    </nav>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M20 20l-3.5-3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DefaultStarIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
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

function NewPreVisitSummaryContent() {
  const navigate = useNavigate();

  const [step, setStep] = useState(/** @type {1 | 2} */ (1));
  const [charts, setCharts] = useState(() => ['', '', '']);
  const [visibleChartCount, setVisibleChartCount] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [templateTitle, setTemplateTitle] = useState('New instruction');
  const [savedTitleSnapshot, setSavedTitleSnapshot] = useState('New instruction');
  const [formError, setFormError] = useState(/** @type {string | null} */ (null));

  const [cachedTemplates, setCachedTemplates] = useState(
    /** @type {Record<string, unknown>[] | null} */ (null),
  );
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateOverlayOpen, setTemplateOverlayOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(
    /** @type {Record<string, unknown> | null} */ (null),
  );
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSavedAt, setTemplateSavedAt] = useState(/** @type {Date | null} */ (null));
  const [templatePanelError, setTemplatePanelError] = useState(/** @type {string | null} */ (null));
  const [defaultToggleSaving, setDefaultToggleSaving] = useState(false);

  const instructionsTextareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const templateTitleInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const autosaveTimerRef = useRef(/** @type {number | null} */ (null));
  const saveInstructionsRef = useRef(/** @type {() => Promise<void>} */ (async () => {}));
  const hasUnsavedChangesRef = useRef(false);
  const defaultLoadAttemptedRef = useRef(false);

  const filledCharts = useMemo(
    () => charts.slice(0, visibleChartCount).map((c) => c.trim()).filter(Boolean),
    [charts, visibleChartCount],
  );

  const canAddAnotherChart = visibleChartCount < MAX_PRIOR_VISITS;
  const canGoToInstructions = filledCharts.length > 0;
  const hasInstructions = instructions.trim().length > 0;
  const hasPriorCharts = filledCharts.length > 0;
  const hasUnsavedChanges =
    instructions !== savedSnapshot || templateTitle.trim() !== savedTitleSnapshot.trim();

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!api.getJWT()) {
      navigate('/login');
    }
  }, [navigate]);

  const applyTemplate = useCallback((/** @type {Record<string, unknown>} */ template) => {
    const text = typeof template.text === 'string' ? template.text : '';
    const name = String(template.name ?? 'Untitled');
    setInstructions(text);
    setSavedSnapshot(text);
    setTemplateTitle(name);
    setSavedTitleSnapshot(name);
    setActiveTemplate(template);
    setTemplatePanelError(null);
    setFormError(null);
  }, []);

  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await listPreVisitSummaryTemplates({
        limit: 100,
        decrypt_text: true,
        sortBy: 'name',
        order: 'asc',
      });
      const rows = res.ok && Array.isArray(res.data) ? res.data : [];
      setCachedTemplates(rows);
      return rows;
    } catch (err) {
      console.error('Error loading pre-visit summary templates:', err);
      setCachedTemplates([]);
      return [];
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (step !== 2 || defaultLoadAttemptedRef.current) return;

    const loadDefault = async () => {
      defaultLoadAttemptedRef.current = true;
      let templates = cachedTemplates;
      if (templates === null) {
        templates = await fetchTemplates();
      }
      const def = pickDefaultTemplate(templates);
      if (def && instructions === '' && savedSnapshot === '') {
        applyTemplate(def);
      }
    };

    void loadDefault();
  }, [step, cachedTemplates, fetchTemplates, applyTemplate, instructions, savedSnapshot]);

  const updateChart = useCallback((index, value) => {
    setCharts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setFormError(null);
  }, []);

  const addNextChart = useCallback(() => {
    if (visibleChartCount >= MAX_PRIOR_VISITS) return;
    setVisibleChartCount((count) => Math.min(MAX_PRIOR_VISITS, count + 1));
  }, [visibleChartCount]);

  const removeChart = useCallback(
    (index) => {
      if (visibleChartCount <= 1) {
        setCharts(['', '', '']);
        setFormError(null);
        return;
      }

      setCharts((prev) => {
        const next = [...prev];
        for (let i = index; i < visibleChartCount - 1; i += 1) {
          next[i] = next[i + 1];
        }
        next[visibleChartCount - 1] = '';
        return next;
      });
      setVisibleChartCount((count) => count - 1);
      setFormError(null);
    },
    [visibleChartCount],
  );

  const goToInstructions = useCallback(() => {
    if (!canGoToInstructions) {
      setFormError('Paste at least one prior visit record to continue.');
      return;
    }
    setFormError(null);
    setStep(2);
  }, [canGoToInstructions]);

  const confirmIfUnsaved = useCallback(() => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(
      'You have unsaved changes to these instructions. Continue and discard them?',
    );
  }, [hasUnsavedChanges]);

  const handleSelectTemplate = useCallback(
    (/** @type {Record<string, unknown>} */ template) => {
      if (!confirmIfUnsaved()) return;
      applyTemplate(template);
      setTemplateOverlayOpen(false);
    },
    [applyTemplate, confirmIfUnsaved],
  );

  const handleCopyTemplate = useCallback(
    (/** @type {Record<string, unknown>} */ template) => {
      if (!confirmIfUnsaved()) return;
      const text = typeof template.text === 'string' ? template.text : '';
      const name = String(template.name ?? 'Untitled');
      setInstructions(text);
      setSavedSnapshot('');
      setTemplateTitle(`${name} (copy)`);
      setSavedTitleSnapshot('New instruction');
      setActiveTemplate(null);
      setTemplateSavedAt(null);
      setTemplatePanelError(null);
      setFormError(null);
      setTemplateOverlayOpen(false);
    },
    [confirmIfUnsaved],
  );

  const handleNewInstruction = useCallback(() => {
    if (!confirmIfUnsaved()) return;
    setInstructions('');
    setSavedSnapshot('');
    setTemplateTitle('New instruction');
    setSavedTitleSnapshot('New instruction');
    setActiveTemplate(null);
    setTemplateSavedAt(null);
    setTemplatePanelError(null);
    setTemplateOverlayOpen(false);
  }, [confirmIfUnsaved]);

  const handleDeleteTemplate = useCallback((/** @type {string} */ templateId) => {
    if (activeTemplate != null && String(activeTemplate.id) === templateId) {
      setInstructions('');
      setSavedSnapshot('');
      setTemplateTitle('New instruction');
      setSavedTitleSnapshot('New instruction');
      setActiveTemplate(null);
      setTemplateSavedAt(null);
      setTemplatePanelError(null);
    }
  }, [activeTemplate]);

  const handleStepChange = useCallback(
    (/** @type {1 | 2} */ nextStep) => {
      if (nextStep === 1 && step === 2 && !confirmIfUnsaved()) return;
      if (nextStep === 2 && !canGoToInstructions) {
        setFormError('Paste at least one prior visit record to continue.');
        return;
      }
      setFormError(null);
      setStep(nextStep);
    },
    [canGoToInstructions, confirmIfUnsaved, step],
  );

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current != null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const commitSavedTemplate = useCallback(
    (
      /** @type {Record<string, unknown>} */ row,
      /** @type {string} */ text,
      /** @type {string} */ title,
    ) => {
      setInstructions(text);
      setSavedSnapshot(text);
      setTemplateTitle(title);
      setSavedTitleSnapshot(title);
      setTemplateSavedAt(new Date());
      setActiveTemplate(row);
      setCachedTemplates((prev) =>
        prev ? mergeTemplateIntoCache(prev, row) : [row],
      );
    },
    [],
  );

  const saveInstructionsTemplate = useCallback(async () => {
    if (templateSaving || !hasUnsavedChangesRef.current) return;

    const trimmedTitle = templateTitle.trim();
    if (!trimmedTitle) {
      setTemplatePanelError('Enter a template name.');
      return;
    }

    setTemplateSaving(true);
    setTemplatePanelError(null);
    try {
      if (isCustomTemplate(activeTemplate)) {
        const id = String(activeTemplate.id);
        const res = await patchPreVisitSummaryTemplate(id, {
          text: instructions,
          name: trimmedTitle,
        });
        if (!res.ok) {
          setTemplatePanelError(res.message);
          return;
        }
        const text = typeof res.data.text === 'string' ? res.data.text : instructions;
        const name = typeof res.data.name === 'string' ? res.data.name : trimmedTitle;
        commitSavedTemplate(res.data, text, name);
        return;
      }

      const res = await createPreVisitSummaryTemplate({
        name: trimmedTitle,
        text: instructions,
      });
      if (!res.ok) {
        setTemplatePanelError(res.message);
        return;
      }
      const text = typeof res.data.text === 'string' ? res.data.text : instructions;
      const name = typeof res.data.name === 'string' ? res.data.name : trimmedTitle;
      commitSavedTemplate(res.data, text, name);
    } finally {
      setTemplateSaving(false);
    }
  }, [activeTemplate, commitSavedTemplate, instructions, templateSaving, templateTitle]);

  useEffect(() => {
    saveInstructionsRef.current = saveInstructionsTemplate;
  }, [saveInstructionsTemplate]);

  const triggerAutosave = useCallback(() => {
    if (!hasUnsavedChangesRef.current) return;
    if (!isCustomTemplate(activeTemplate)) return;
    void saveInstructionsRef.current();
  }, [activeTemplate]);

  const scheduleAutosaveTimer = useCallback(() => {
    if (!isCustomTemplate(activeTemplate)) return;
    clearAutosaveTimer();
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      const focused = document.activeElement;
      if (
        focused === instructionsTextareaRef.current ||
        focused === templateTitleInputRef.current
      ) {
        triggerAutosave();
      }
    }, VISIT_PREP_INSTRUCTION_AUTOSAVE_IDLE_MS);
  }, [activeTemplate, clearAutosaveTimer, triggerAutosave]);

  const onTemplateTitleChange = useCallback(
    (/** @type {React.ChangeEvent<HTMLInputElement>} */ e) => {
      setTemplateTitle(e.target.value);
      setTemplatePanelError(null);
      if (document.activeElement === templateTitleInputRef.current) {
        scheduleAutosaveTimer();
      }
    },
    [scheduleAutosaveTimer],
  );

  const onTemplateTitleBlur = useCallback(() => {
    clearAutosaveTimer();
    triggerAutosave();
  }, [clearAutosaveTimer, triggerAutosave]);

  const onInstructionsChange = useCallback(
    (/** @type {React.ChangeEvent<HTMLTextAreaElement>} */ e) => {
      setInstructions(e.target.value);
      setFormError(null);
      setTemplatePanelError(null);
      if (document.activeElement === instructionsTextareaRef.current) {
        scheduleAutosaveTimer();
      }
    },
    [scheduleAutosaveTimer],
  );

  const onInstructionsFocus = useCallback(() => {
    scheduleAutosaveTimer();
  }, [scheduleAutosaveTimer]);

  const onInstructionsBlur = useCallback(() => {
    clearAutosaveTimer();
    triggerAutosave();
  }, [clearAutosaveTimer, triggerAutosave]);

  useEffect(() => () => clearAutosaveTimer(), [clearAutosaveTimer]);

  const handleDefaultStarClick = useCallback(async () => {
      if (!isCustomTemplate(activeTemplate) || defaultToggleSaving || templateSaving) return;

      const checked = !activeTemplate.is_default;

      setDefaultToggleSaving(true);
      setTemplatePanelError(null);
      try {
        const id = String(activeTemplate.id);
        const res = await patchPreVisitSummaryTemplate(id, { is_default: checked });
        if (!res.ok) {
          setTemplatePanelError(res.message);
          return;
        }
        setActiveTemplate(res.data);
        setCachedTemplates((prev) =>
          prev ? mergeTemplateIntoCache(prev, res.data) : [res.data],
        );
      } finally {
        setDefaultToggleSaving(false);
      }
    }, [activeTemplate, defaultToggleSaving, templateSaving]);

  const templateSavedLabel = useMemo(() => {
    if (templateSaving) return 'Saving…';
    if (hasUnsavedChanges || !templateSavedAt) return null;
    const at = formatVisitPrepSavedAt(templateSavedAt);
    return at ? `Saved ${at}` : null;
  }, [hasUnsavedChanges, templateSavedAt, templateSaving]);

  const isDefaultTemplate = Boolean(activeTemplate?.is_default);
  const defaultStarLabel = isDefaultTemplate ? 'Default Instruction' : 'Set Default';

  const generateVisitPrep = useCallback(() => {
    if (!hasInstructions) {
      setFormError('Add pre-visit summary instructions to continue.');
      return;
    }
    if (!hasPriorCharts) {
      setFormError('Add at least one prior visit record before generating.');
      return;
    }
    setFormError(null);
    const message = formatVisitPrepUserMessage(
      filledCharts,
      instructions,
      templateTitle,
    );
    try {
      sessionStorage.setItem(SESSION_KEYS.novaVisitPrepPendingMessage, message);
    } catch {
      setFormError('Could not start pre-visit summary. Try again.');
      return;
    }
    navigate('/pre-visit-summary/nova-chat');
  }, [filledCharts, hasInstructions, hasPriorCharts, instructions, navigate, templateTitle]);

  const goBackHome = useCallback(() => {
    navigate('/pre-visit-summary');
  }, [navigate]);

  const canToggleDefault = isCustomTemplate(activeTemplate) && !defaultToggleSaving && !templateSaving;
  const isStandardTemplate = activeTemplate != null && activeTemplate.user_id == null;
  const defaultDisabledReason =
    canToggleDefault || defaultToggleSaving || templateSaving
      ? null
      : isStandardTemplate
        ? isDefaultTemplate
          ? 'This Standard instruction is already the default. Copy it to create a custom version you can set as your own default.'
          : "You can't set a Standard instruction as default. Copy it to create a custom instruction first."
        : 'Save this as a custom instruction to set it as your default.';

  return (
    <div className="flex h-[var(--mobile-viewport-height)] min-h-0 flex-col bg-gray-50 lg:h-[100dvh]">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white md:flex-row">
          <div className="shrink-0 border-b border-gray-100 px-3 pt-4 pb-3 md:border-b-0 md:px-4 md:pt-6 md:pb-0">
            <button
              type="button"
              onClick={goBackHome}
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 -ml-1.5 text-sm font-semibold leading-snug text-gray-600 transition-colors hover:bg-gray-100 hover:text-[#183278] focus:outline-none focus-visible:bg-gray-100 focus-visible:text-[#183278]"
            >
              ← Home
            </button>
          </div>

          <div className={`${visitPrepMainColumnClass} flex min-h-0 min-w-0 flex-1 flex-col pt-4 md:pt-6`}>
            <div className="relative z-10 shrink-0 bg-white pb-5">
              <PreVisitSummaryStepPath step={step} onStepChange={handleStepChange} />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-full h-5 bg-gradient-to-b from-white to-transparent"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-4 pb-4">
              {formError && (
                <div
                  className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              {step === 1 ? (
                <div className="space-y-5">
                  <div className={visitPrepStepFieldInsetClass}>
                    <p className="text-sm font-semibold leading-snug text-gray-900">
                      Add prior visit records
                    </p>
                    <p className="mt-1 text-sm leading-snug text-gray-600">
                      Paste plain text from past patient visits for Nova to analyze.
                    </p>
                    <p className={`mt-1 ${META_TEXT} leading-relaxed text-gray-500`}>
                      e.g. SOAP note, discharge summary, clinic visit note
                    </p>
                  </div>
                  <div className={visitPrepStepFieldInsetClass}>
                    {Array.from({ length: visibleChartCount }, (_, index) => (
                      <div key={`chart-${index}`} className={index > 0 ? 'mt-5' : undefined}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <label
                            htmlFor={`prior-visit-${index + 1}`}
                            className="text-sm font-medium text-gray-700"
                          >
                            Visit {index + 1}
                          </label>
                          <button
                            type="button"
                            onClick={() => removeChart(index)}
                            className="inline-flex shrink-0 items-center rounded-md p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
                            title={`Remove visit ${index + 1}`}
                            aria-label={`Remove visit ${index + 1}`}
                          >
                            <DeleteIcon className="h-4 w-4" />
                          </button>
                        </div>
                        <textarea
                          id={`prior-visit-${index + 1}`}
                          value={charts[index]}
                          onChange={(e) => updateChart(index, e.target.value)}
                          rows={10}
                          placeholder="Paste plain text from a prior visit record…"
                          className={`w-full resize-y rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 ${BODY_TEXT} text-gray-900 placeholder:text-gray-400 focus:border-[#183278] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#183278]/25`}
                        />
                      </div>
                    ))}

                    {canAddAnotherChart ? (
                      <button
                        type="button"
                        onClick={addNextChart}
                        className="mt-5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#183278] hover:border-[#183278]/30 hover:bg-gray-50"
                      >
                        + Add another visit
                      </button>
                    ) : (
                      <p className={`mt-5 ${META_TEXT} text-gray-500`}>Maximum of 3 prior visits.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={visitPrepStepFieldInsetClass}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                      <div className="min-w-0 flex-1 sm:pr-1">
                        <p className="text-sm font-semibold leading-snug text-gray-900">
                          Tell Nova what to extract
                        </p>
                        <p className="mt-1 text-sm leading-snug text-gray-600">
                          Use plain English — list the patient details you want in the summary.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTemplateOverlayOpen(true)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start whitespace-nowrap rounded-lg bg-[#183278] px-3 py-2 text-sm font-semibold text-white hover:bg-[#142a66] sm:h-11 sm:px-3.5"
                      >
                        <SearchIcon />
                        Nova AI instruction templates
                      </button>
                    </div>
                    <p className={`mt-1 ${META_TEXT} leading-relaxed text-gray-500`}>
                      e.g. problems, med changes, labs, follow-ups
                    </p>
                  </div>

                  <div className={visitPrepStepFieldInsetClass}>
                    <div
                      className={`overflow-hidden rounded-lg border bg-white shadow-sm transition-[border-color] ${
                        hasUnsavedChanges ? 'border-[#183278]/35' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-white px-3 py-2">
                        <div className="flex min-w-0 flex-1 items-center gap-0.5">
                          <input
                            ref={templateTitleInputRef}
                            type="text"
                            value={templateTitle}
                            onChange={onTemplateTitleChange}
                            onBlur={onTemplateTitleBlur}
                            aria-label="Instruction template title"
                            className="min-w-0 max-w-full flex-none truncate border-0 bg-transparent p-0 text-sm font-semibold leading-snug text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                            style={{ width: `${Math.max(templateTitle.length, 4)}ch` }}
                            placeholder="Template name"
                          />
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const el = templateTitleInputRef.current;
                              if (el) {
                                el.focus();
                                el.select();
                              }
                            }}
                            title="Edit template name"
                            aria-label="Edit template name"
                            className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#183278] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40"
                          >
                            <IconEdit className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="group/default relative shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleDefaultStarClick()}
                            disabled={!canToggleDefault}
                            title={
                              canToggleDefault
                                ? isDefaultTemplate
                                  ? 'Remove as default instructions'
                                  : 'Set as default instructions'
                                : undefined
                            }
                            aria-label={
                              canToggleDefault
                                ? isDefaultTemplate
                                  ? 'Default instructions — click to remove'
                                  : 'Set as default instructions'
                                : defaultDisabledReason ?? 'Default not available for this template'
                            }
                            aria-pressed={isDefaultTemplate}
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/40 disabled:pointer-events-none ${
                              canToggleDefault
                                ? isDefaultTemplate
                                  ? 'text-[#183278] hover:bg-[#E8EEFB]'
                                  : 'text-gray-500 hover:bg-gray-100 hover:text-[#183278]'
                                : isDefaultTemplate
                                  ? 'cursor-default text-[#183278]'
                                  : 'cursor-not-allowed text-gray-400'
                            }`}
                          >
                            <DefaultStarIcon filled={isDefaultTemplate} />
                            <span className="text-xs font-semibold leading-none whitespace-nowrap">
                              {defaultStarLabel}
                            </span>
                          </button>
                          {defaultDisabledReason ? (
                            <div
                              role="tooltip"
                              className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 hidden w-56 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs leading-snug text-gray-600 shadow-lg group-hover/default:block"
                            >
                              {defaultDisabledReason}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <textarea
                        ref={instructionsTextareaRef}
                        id="visit-prep-instructions"
                        value={instructions}
                        onChange={onInstructionsChange}
                        onFocus={onInstructionsFocus}
                        onBlur={onInstructionsBlur}
                        rows={14}
                        placeholder="e.g. Chief complaint, recent labs, medications to reconcile, and follow-up items."
                        className={`min-h-[280px] w-full resize-y border-0 bg-transparent px-3 py-3 ${BODY_TEXT} text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0`}
                      />
                      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 bg-white px-3 py-2">
                        <span
                          className={`min-w-0 flex-1 truncate pl-0.5 text-[11px] font-medium leading-none text-gray-500 ${
                            templateSavedLabel ? '' : 'invisible'
                          }`}
                          aria-live="polite"
                        >
                          {templateSavedLabel || '\u00a0'}
                        </span>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => void saveInstructionsTemplate()}
                          disabled={!hasUnsavedChanges || templateSaving}
                          className={`inline-flex shrink-0 items-center rounded-md px-3 py-1.5 text-xs font-semibold leading-none transition-colors ${
                            hasUnsavedChanges && !templateSaving
                              ? 'bg-[#183278] text-white hover:bg-[#142a66] shadow-sm'
                              : 'bg-gray-100 text-gray-400'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {templateSaving ? 'Saving…' : 'Save change'}
                        </button>
                      </div>
                    </div>
                    {templatePanelError ? (
                      <p className="mt-2 text-xs leading-snug text-red-600" role="alert">
                        {templatePanelError}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="relative z-10 shrink-0 bg-white">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-full h-5 bg-gradient-to-t from-white to-transparent"
              />
              <div
                className={`relative pt-4 pb-5 ${
                  step === 1 ? 'flex justify-end' : 'flex flex-wrap items-center justify-between gap-3'
                }`}
              >
                {step === 1 ? (
                  <button
                    type="button"
                    onClick={goToInstructions}
                    disabled={!canGoToInstructions}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#183278] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#142a66] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    Nova AI instructions
                    <ChevronRightIcon />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStepChange(1)}
                      className={`text-sm font-semibold text-gray-600 hover:text-[#183278] ${visitPrepStepFieldInsetClass}`}
                    >
                      Back to records
                    </button>
                    <button
                      type="button"
                      onClick={generateVisitPrep}
                      disabled={!hasInstructions}
                      className="rounded-lg bg-[#183278] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#142a66] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      Generate pre-visit summary
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <SearchPreVisitSummaryTemplateOverlay
        isOpen={templateOverlayOpen}
        onClose={() => setTemplateOverlayOpen(false)}
        onSelectTemplate={handleSelectTemplate}
        onNewInstruction={handleNewInstruction}
        onCopyTemplate={handleCopyTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        cachedTemplates={cachedTemplates}
        setCachedTemplates={setCachedTemplates}
        isLoadingTemplates={isLoadingTemplates}
        setIsLoadingTemplates={setIsLoadingTemplates}
      />
    </div>
  );
}

export default function NewPreVisitSummaryPage() {
  return (
    <>
      <Auth />
      <NewPreVisitSummaryContent />
    </>
  );
}
