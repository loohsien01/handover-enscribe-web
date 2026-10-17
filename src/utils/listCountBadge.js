/** Aligns with sidebar encounter badge: at this count we show `99+`. */
export const LIST_COUNT_BADGE_CAP = 100

/** @param {number} count */
export function formatListCountForBadge(count) {
  if (typeof count !== "number" || !Number.isFinite(count)) {
    return String(count)
  }
  return count >= LIST_COUNT_BADGE_CAP ? "99+" : count
}
