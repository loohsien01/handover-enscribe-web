/**
 * Stable `value` keys for API / DB; `label` is display text.
 * Sorted alphabetically by label ("Other" included in sort).
 */
export const MEDICAL_PROFESSIONS = [
  { value: "anesthesiology", label: "Anesthesiology" },
  { value: "cardiology", label: "Cardiology" },
  { value: "certified_nurse_midwife", label: "Certified Nurse-Midwife (CNM)" },
  { value: "clinical_nurse_specialist", label: "Clinical Nurse Specialist" },
  {
    value: "social_worker_clinical",
    label: "Clinical Social Worker (LCSW / equivalent)",
  },
  { value: "dentist", label: "Dentist" },
  { value: "dermatology", label: "Dermatology" },
  { value: "emergency_medicine", label: "Emergency Medicine" },
  { value: "family_medicine", label: "Family Medicine" },
  { value: "general_surgery", label: "General Surgery" },
  { value: "hospitalist", label: "Hospitalist" },
  { value: "internal_medicine", label: "Internal Medicine" },
  { value: "neurology", label: "Neurology" },
  { value: "nurse_practitioner", label: "Nurse Practitioner (NP)" },
  {
    value: "obstetrics_gynecology",
    label: "Obstetrics & Gynecology",
  },
  { value: "occupational_therapist", label: "Occupational Therapist" },
  { value: "orthopedic_surgery", label: "Orthopedic Surgery" },
  
  { value: "pathology", label: "Pathology" },
  { value: "pediatrics", label: "Pediatrics" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "physician_assistant", label: "Physician Assistant (PA)" },
  { value: "physical_therapist", label: "Physical Therapist" },
  { value: "psychiatry", label: "Psychiatry" },
  { value: "psychologist", label: "Psychologist" },
  { value: "radiology", label: "Radiology" },
  { value: "registered_nurse", label: "Registered Nurse (RN)" },
  { value: "urgent_care", label: "Urgent Care" },
  { value: "other", label: "Other" },
];

export const PROFESSION_OTHER_VALUE = "other";

function normalizeProfessionText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Map a stored specialty string (API label or slug) to a known option.
 * "Other" is not a known match — callers should treat unmatched values as Other.
 */
export function findKnownProfession(specialty) {
  const needle = normalizeProfessionText(specialty);
  if (!needle) return null;
  return (
    MEDICAL_PROFESSIONS.find((p) => {
      if (p.value === PROFESSION_OTHER_VALUE) return false;
      return (
        normalizeProfessionText(p.label) === needle ||
        normalizeProfessionText(p.value) === needle
      );
    }) ?? null
  );
}
