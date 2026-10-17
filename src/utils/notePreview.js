/**
 * Single-line preview string for a note (plain or JSON body after parseNotes).
 * @param {object} note
 * @returns {string}
 */
export function getNotePreviewText(note) {
  if (!note) return ""
  if (note.parsedObject) {
    if (note.parsedObject.soapNote?.subjective) {
      return String(note.parsedObject.soapNote.subjective)
    }
    if (note.parsedObject.text) {
      return String(note.parsedObject.text)
    }
    for (const key of Object.keys(note.parsedObject)) {
      if (typeof note.parsedObject[key] === "string") {
        return note.parsedObject[key]
      }
    }
  }
  return typeof note.text === "string" ? note.text : ""
}
