/**
 * Normalize GET /api/notes (or complete) JSON into a flat array of note rows.
 * Handles: array, { notes: [...] }, id-keyed map { "id": { id, ... } }, or a single note object.
 */
export function normalizeNotesListResponse(data) {
  if (data == null) return []
  if (Array.isArray(data)) return data
  if (typeof data === "object" && Array.isArray(data.notes)) return data.notes
  if (typeof data === "object" && data.id != null) {
    const values = Object.values(data)
    const eachValueIsNoteRecord =
      values.length > 0 &&
      values.every((v) => v && typeof v === "object" && v.id != null && v !== data)
    if (eachValueIsNoteRecord) return values
    return [data]
  }
  if (typeof data === "object") return Object.values(data)
  return []
}
