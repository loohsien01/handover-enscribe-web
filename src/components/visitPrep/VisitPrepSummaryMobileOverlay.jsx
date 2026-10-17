import React, { useEffect } from 'react';

/**
 * Almost full-screen overlay for the pre-visit summary panel (Proceed to Patient Visit).
 * Mirrors {@link PatientEncounterPreviewOverlay} — dimmed backdrop + centered sheet.
 * On desktop (`lg+`), inset from the main nav via `--shell-content-inset`.
 *
 * @param {{
 *   open: boolean;
 *   onRequestClose?: () => void;
 *   closeBusy?: boolean;
 *   fullBleed?: boolean;
 *   children: React.ReactNode;
 * }} props
 */
export default function VisitPrepSummaryMobileOverlay({
  open,
  onRequestClose,
  closeBusy = false,
  fullBleed = false,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !onRequestClose) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !closeBusy) {
        e.preventDefault();
        onRequestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onRequestClose, closeBusy]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${
        fullBleed
          ? ''
          : 'lg:left-[var(--shell-content-inset)] lg:transition-[left] lg:duration-200 lg:ease-out'
      }`}
    >
      <div
        className="absolute inset-0 bg-black/50"
        style={{ cursor: closeBusy ? 'default' : 'pointer' }}
        onClick={closeBusy ? undefined : onRequestClose}
        aria-hidden
      />

      <div
        className="relative flex h-[min(90vh,960px)] w-full max-w-[2000px] min-h-0 flex-col overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Pre-visit summary"
      >
        {children}
      </div>
    </div>
  );
}
