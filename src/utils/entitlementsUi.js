/**
 * Pure helpers for GET /api/me/entitlements payloads (see docs/BILLING_ARCHITECTURE.md).
 * @param {Record<string, unknown>|null|undefined} ent
 */
export function planTierFromEntitlements(ent) {
  if (!ent) return null;
  if (ent.has_pro_plan === true) return "pro";
  const key = String(ent.plan_key || "").toLowerCase();
  if (key === "pro") return "pro";
  if (key === "free") return "free";
  return "free";
}

/**
 * Short label for UI ("Pro", "Free", or title-cased `plan_key` for future SKUs).
 * Prefer server `plan_key`; falls back to tier when `plan_key` is empty.
 * @param {Record<string, unknown>|null|undefined} ent
 */
export function planDisplayLabelFromEntitlements(ent) {
  if (!ent) return "your current plan";
  const raw = String(ent.plan_key ?? "").trim();
  if (raw) {
    const lower = raw.toLowerCase();
    if (lower === "pro") return "Pro";
    if (lower === "free") return "Free";
    return lower
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  if (ent.has_pro_plan === true) return "Pro";
  const tier = planTierFromEntitlements(ent);
  if (tier === "pro") return "Pro";
  if (tier === "free") return "Free";
  return "your current plan";
}

/** @param {Record<string, unknown>|null|undefined} ent */
export function isBetaUiFromEntitlements(ent) {
  return String(ent?.ui_experience_version ?? "").toLowerCase() === "beta";
}
