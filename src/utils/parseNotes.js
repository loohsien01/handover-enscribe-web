import { shouldCapitalizeNoteParsedObjectRoots } from './format.js';
import { withCapitalizedJsonRootKeys } from './jsonRootKeys.js';

/** Strip outer double-quote wrapping, trailing commas, and disallowed control chars. */
function cleanNoteJsonText(text) {
    return text
        .replace(/^"+|"+$/g, "")
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, " ");
}

/**
 * Parse notes with flexible structure
 * Attempts to parse text field as JSON if it contains valid JSON, otherwise keeps as plain text
 */
function parseNotes(input) {
    // Helper to parse and clean a single note
    function parseSingleNote(note) {
        if (typeof note?.text === "string") {
            const variants = [note.text, () => cleanNoteJsonText(note.text)];
            let parseSucceeded = false;
            let lastError = null;
            for (const get of variants) {
                const cleaned = typeof get === "function" ? get() : get;
                try {
                    const parsed = JSON.parse(cleaned);
                    parseSucceeded = true;
                    if (typeof parsed === "object" && parsed !== null) {
                        note.parsedObject = shouldCapitalizeNoteParsedObjectRoots(
                            parsed,
                        )
                            ? withCapitalizedJsonRootKeys(parsed)
                            : parsed;
                    }
                    break;
                } catch (e) {
                    lastError = e;
                }
            }
            if (!parseSucceeded && lastError) {
                console.log(
                    "Note text is not JSON, treating as plain text:",
                    lastError.message,
                );
            }
        }
        return note;
    }

    if (Array.isArray(input)) {
        return input.map(parseSingleNote);
    } else if (input && typeof input === "object") {
        return parseSingleNote(input);
    } else {
        return input;
    }
}

export default parseNotes;
