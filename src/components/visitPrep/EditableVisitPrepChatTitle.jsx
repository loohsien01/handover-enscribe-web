import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NOVA_SESSION_TITLE_MAX_CHARS } from '@/constants/novaChat.js';
import IconEdit from '@/components/IconEdit.jsx';

function PencilIcon() {
  return <IconEdit className="h-3.5 w-3.5" />;
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin text-gray-500"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * @param {{
 *   value: string;
 *   editable?: boolean;
 *   inline?: boolean;
 *   merged?: boolean;
 *   hero?: boolean;
 *   inlineRow?: boolean;
 *   className?: string;
 *   onSave: (title: string) => void | Promise<void>;
 * }} props
 */
export default function EditableVisitPrepChatTitle({
  value,
  editable = true,
  inline = false,
  merged = false,
  hero = false,
  inlineRow = false,
  className = '',
  onSave,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(/** @type {string | null} */ (null));
  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const iconButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const draftRef = useRef(value);
  const savedValueRef = useRef(value);
  const isEditingRef = useRef(false);
  const isSavingRef = useRef(false);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    savedValueRef.current = value;
    if (!isEditingRef.current) {
      draftRef.current = value;
      setDraft(value);
      setSaveError(null);
    }
  }, [value]);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el || inline || hero) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [hero, inline]);

  useEffect(() => {
    if (!isEditing) return;
    const el = textareaRef.current;
    el?.focus();
    el?.select();
  }, [isEditing]);

  useEffect(() => {
    resizeTextarea();
  }, [draft, isEditing, resizeTextarea]);

  const cancelEdit = useCallback(() => {
    draftRef.current = savedValueRef.current;
    setDraft(savedValueRef.current);
    setSaveError(null);
    setIsEditing(false);
  }, []);

  const commit = useCallback(async () => {
    if (!editable || isSavingRef.current || !isEditingRef.current) return;

    const trimmed = draftRef.current.trim();
    if (!trimmed) {
      setSaveError('Title cannot be empty.');
      return;
    }
    if (trimmed.length > NOVA_SESSION_TITLE_MAX_CHARS) {
      setSaveError(`Title must be ${NOVA_SESSION_TITLE_MAX_CHARS} characters or fewer.`);
      return;
    }
    if (trimmed === savedValueRef.current.trim()) {
      setSaveError(null);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveRef.current(trimmed);
      savedValueRef.current = trimmed;
      draftRef.current = trimmed;
      setDraft(trimmed);
      setSaveError(null);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save title.');
    } finally {
      setIsSaving(false);
    }
  }, [editable]);

  const startEdit = useCallback(() => {
    if (!editable || isSavingRef.current) return;
    draftRef.current = savedValueRef.current;
    setDraft(savedValueRef.current);
    setSaveError(null);
    setIsEditing(true);
  }, [editable]);

  const onDraftChange = useCallback(
    (next) => {
      draftRef.current = next;
      setDraft(next);
      setSaveError(null);
      resizeTextarea();
    },
    [resizeTextarea],
  );

  const onFieldMouseDown = useCallback(
    (/** @type {React.MouseEvent<HTMLElement>} */ e) => {
      if (!editable || isSavingRef.current || isEditingRef.current) return;
      if (iconButtonRef.current?.contains(/** @type {Node} */ (e.target))) return;
      e.preventDefault();
      startEdit();
    },
    [editable, startEdit],
  );

  const onIconClick = useCallback(() => {
    if (isEditingRef.current) {
      void commit();
      return;
    }
    startEdit();
  }, [commit, startEdit]);

  if (!value) return null;

  const showIcon = editable;
  // Modes that render the pencil inline right after a content-sized title
  // (so it hugs the text) instead of pinned absolutely at the field's right edge.
  const inlinePencil = merged || (hero && inlineRow);
  const draftLength = draft.trim().length;
  const hasFieldError = !!saveError;
  const fieldShellClass = hero
    ? `relative transition-[border-color,box-shadow] ${
        inlineRow ? 'inline-flex min-w-0 max-w-full items-center' : 'w-full'
      } ${
        hasFieldError
          ? 'border-b-2 border-red-400'
          : isEditing
            ? 'border-b-2 border-[#183278]'
            : 'border-b border-transparent'
      }`
    : merged
      ? `relative w-full border-b transition-[border-color,box-shadow] ${
          hasFieldError
            ? 'border-red-400'
            : isEditing
              ? 'border-[#183278]'
              : 'border-gray-100'
        }`
      : `relative w-full rounded-lg border bg-white transition-[border-color,box-shadow] ${
          inline ? 'h-9 flex items-center' : ''
        } ${
          hasFieldError
            ? 'border-red-400 ring-2 ring-red-200'
            : isEditing
              ? 'border-[#183278] ring-2 ring-[#183278]/20'
              : 'border-gray-200'
        }`;

  const outerSpacingClass =
    hero || merged ? '' : inline ? '' : 'mt-2';

  const heroTextClass = inlineRow
    ? 'min-w-[3rem] max-w-[min(42vw,14rem)] px-0 py-1 text-left text-lg font-semibold leading-snug text-gray-900 sm:max-w-[min(36vw,18rem)] sm:text-xl'
    : 'px-2 py-0.5 text-center text-lg font-semibold leading-snug text-gray-900 sm:text-xl';

  return (
    <div
      className={`relative ${inlineRow ? 'min-w-0 shrink' : 'w-full'} ${outerSpacingClass} ${className}`.trim()}
    >
      <div
        className={fieldShellClass}
        onMouseDown={onFieldMouseDown}
      >
        <div
          className={`relative items-center ${
            merged
              ? 'inline-flex min-h-9 max-w-full gap-1'
              : hero && inlineRow
                ? 'inline-flex max-w-full min-w-0 gap-1'
                : `flex ${editable ? 'pr-8' : ''} ${inlineRow ? 'min-w-0' : 'min-h-9 w-full'}`
          }`}
        >
          {inlinePencil && !isEditing ? (
            <span
              className={`block min-w-0 truncate cursor-text ${
                merged
                  ? 'max-w-full px-3 py-2.5 text-base font-semibold leading-snug text-[#183278]'
                  : 'max-w-[min(42vw,14rem)] px-0 py-1 text-left text-lg font-semibold leading-snug text-gray-900 sm:max-w-[min(36vw,18rem)] sm:text-xl'
              }`}
            >
              {draft}
            </span>
          ) : (
          <textarea
            ref={textareaRef}
            value={draft}
            readOnly={!isEditing || isSaving}
            maxLength={NOVA_SESSION_TITLE_MAX_CHARS}
            style={
              merged
                ? {
                    width: `calc(${Math.min(
                      Math.max(draft.length, 4) + 1,
                      NOVA_SESSION_TITLE_MAX_CHARS,
                    )}ch + 1.5rem)`,
                  }
                : hero && inlineRow
                  ? {
                      width: `${Math.min(
                        Math.max(draft.length, 4) + 1,
                        NOVA_SESSION_TITLE_MAX_CHARS,
                      )}ch`,
                    }
                  : undefined
            }
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={(e) => {
              if (!isEditingRef.current) return;
              if (e.relatedTarget && e.relatedTarget === iconButtonRef.current) return;
              void commit();
            }}
            onKeyDown={(e) => {
              if (!isEditingRef.current) return;
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void commit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
              }
            }}
            rows={1}
            aria-label="Pre-visit summary title"
            aria-invalid={hasFieldError}
            aria-describedby={hasFieldError ? 'visit-prep-chat-title-error' : undefined}
            className={`resize-none overflow-hidden border-0 bg-transparent focus:outline-none focus:ring-0 ${
              hero
                ? `${heroTextClass}${inlineRow ? '' : ' w-full'}`
                : merged
                  ? 'max-w-full px-3 py-2.5 text-base font-semibold leading-snug text-[#183278]'
                  : `w-full px-3 text-[#183278] ${
                      inline
                        ? 'py-2.5 text-[1rem] font-semibold leading-none'
                        : 'py-2 text-sm font-semibold leading-snug'
                    }`
            } ${(inline || merged || (hero && !isEditing)) && !isEditing ? 'truncate' : ''} ${!isEditing ? 'cursor-text' : ''}`}
          />
          )}
          {inlinePencil && showIcon ? (
            <button
              ref={iconButtonRef}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void onIconClick()}
              disabled={isSaving}
              aria-label={
                isSaving
                  ? 'Saving pre-visit summary title'
                  : isEditing
                    ? 'Save pre-visit summary title'
                    : 'Edit pre-visit summary title'
              }
              title={isSaving ? 'Saving' : isEditing ? 'Save' : 'Edit'}
              className="relative z-[2] flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-[#183278]/8 hover:text-[#183278] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <SpinnerIcon /> : isEditing ? <CheckIcon /> : <PencilIcon />}
            </button>
          ) : null}
        </div>

        {editable && !isEditing && !hero && !inlinePencil ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-16 rounded-r-lg bg-gradient-to-l from-white from-30% via-white/80 to-transparent backdrop-blur-[3px]"
            aria-hidden
          />
        ) : null}

        {!inlinePencil && showIcon ? (
          <button
            ref={iconButtonRef}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void onIconClick()}
            disabled={isSaving}
            aria-label={
              isSaving
                ? 'Saving pre-visit summary title'
                : isEditing
                  ? 'Save pre-visit summary title'
                  : 'Edit pre-visit summary title'
            }
            title={isSaving ? 'Saving' : isEditing ? 'Save' : 'Edit'}
            className="absolute inset-y-0 right-0 z-[2] flex w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-[#183278]/8 hover:text-[#183278] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <SpinnerIcon /> : isEditing ? <CheckIcon /> : <PencilIcon />}
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <p
          className={`absolute left-0 top-full z-10 mt-0.5 whitespace-nowrap text-xs ${hero && inlineRow ? '' : hero ? 'mt-1 text-center' : merged ? 'px-4 pb-2' : 'mt-1'} ${draftLength > NOVA_SESSION_TITLE_MAX_CHARS ? 'text-red-600' : 'text-gray-500'}`}
        >
          {draftLength}/{NOVA_SESSION_TITLE_MAX_CHARS} characters
        </p>
      ) : null}

      {saveError ? (
        <p
          id="visit-prep-chat-title-error"
          className={`text-xs leading-snug text-red-600 ${hero ? 'mt-1 text-center' : merged ? 'px-4 pb-2' : 'mt-1'}`}
          role="alert"
        >
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
