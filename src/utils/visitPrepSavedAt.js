/** Idle delay before autosaving focused pre-visit summary / instruction fields. */
export const VISIT_PREP_INSTRUCTION_AUTOSAVE_IDLE_MS = 15_000;

/** @param {Date | null | undefined} date */
export function formatVisitPrepSavedAt(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
