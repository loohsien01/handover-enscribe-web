import {
  MEDICAL_PROFESSIONS,
  PROFESSION_OTHER_VALUE,
  findKnownProfession,
} from "@/constants/medicalProfessions.js";

/**
 * Hydrate the profession combobox from a stored specialty (same list as sign-up).
 * Known labels/slugs select that option; anything else selects Other and fills
 * the free-text box with the API value.
 */
export function specialtyToFormValues(specialty) {
  const trimmed = String(specialty || "").trim();
  if (!trimmed) {
    return { professionValue: "", professionOther: "" };
  }
  const match = findKnownProfession(trimmed);
  if (match) {
    return { professionValue: match.value, professionOther: "" };
  }
  return { professionValue: PROFESSION_OTHER_VALUE, professionOther: trimmed };
}

export function specialtyFromFormValues(professionValue, professionOther) {
  if (professionValue === PROFESSION_OTHER_VALUE) {
    return professionOther.trim();
  }
  const selected = MEDICAL_PROFESSIONS.find((p) => p.value === professionValue);
  return selected?.label?.trim() || "";
}
