import { marked } from 'marked';
import { capitalizeJsonRootKey, withCapitalizedJsonRootKeys } from './jsonRootKeys.js';

export { capitalizeJsonRootKey, withCapitalizedJsonRootKeys };

const DEBUG_PRINT_JSON_OBJECT =
    false;

/** @param {...unknown} args */
function logPrintJsonObject(...args) {
    if (DEBUG_PRINT_JSON_OBJECT) {
        console.log('[printJsonObject]', ...args);
    }
}

// Print a JSON object as indented plain text (for display, logging, or export)
export function printJsonObject(obj, level = 0) {
    const indent = (lvl) => ' '.repeat(lvl * 5);
    const indentStr = indent(level);
    logPrintJsonObject('enter', {
        valueType:
            obj === null
                ? 'null'
                : Array.isArray(obj)
                  ? 'array'
                  : typeof obj,
        level,
        indentSpaces: level * 5,
        indentRepr: JSON.stringify(indentStr),
    });

    if (typeof obj === 'string' || typeof obj === 'number') {
        const lines = String(obj).split('\n');
        const out = lines
            .map((line, i) => {
                const prefixed = indentStr + line;
                logPrintJsonObject('  string/number line', {
                    lineIndex: i + 1,
                    lineCount: lines.length,
                    level,
                    indentSpaces: level * 5,
                    line: line.length > 120 ? `${line.slice(0, 120)}…` : line,
                    withIndent:
                        prefixed.length > 140
                            ? `${prefixed.slice(0, 140)}…`
                            : prefixed,
                });
                return prefixed;
            })
            .join('\n');
        logPrintJsonObject('exit string/number', {
            level,
            lineCount: lines.length,
        });
        return out;
    }
    if (Array.isArray(obj)) {
        logPrintJsonObject('array branch', {
            length: obj.length,
            level,
            childLevel: level + 1,
        });
        return obj
            .map((item, idx) => {
                logPrintJsonObject('  array item', {
                    index: idx,
                    fromLevel: level,
                    toLevel: level + 1,
                });
                return printJsonObject(item, level + 1);
            })
            .join('\n');
    }
    if (typeof obj === 'object' && obj !== null) {
        logPrintJsonObject('object branch', {
            keys: Object.keys(obj),
            level,
            keyIndentSpaces: level * 5,
        });
        let result = '';
        for (const [key, value] of Object.entries(obj)) {
            const keyLine = indentStr + key + ':\n';
            logPrintJsonObject('  object key', {
                key,
                level,
                keyLineIndentSpaces: level * 5,
                keyLine: keyLine.replace(/\n$/, ''),
                valueChildLevel: level + 1,
            });
            result += keyLine;
            result += printJsonObject(value, level + 1) + '\n';
        }
        const trimmed = result.trim();
        logPrintJsonObject('exit object', {
            level,
            keyCount: Object.keys(obj).length,
            resultCharCount: trimmed.length,
        });
        return trimmed;
    }
    const fallback = indentStr + String(obj);
    logPrintJsonObject('exit fallback (boolean/undefined/etc.)', {
        level,
        indentSpaces: level * 5,
        value: String(obj),
        out: fallback.length > 120 ? `${fallback.slice(0, 120)}…` : fallback,
    });
    return fallback;
}

/** Root keys for nested SOAP JSON from LLM (per-field editors). */
export const SOAP_SECTION_KEYS = [
    'subjective',
    'objective',
    'assessment',
    'plan',
];

/**
 * Per-root note field for save: normalize CRLF to LF only — preserves spaces, newlines, and content as-is (no JSON re-parse).
 * @param {string} text
 * @returns {string}
 */
export function normalizeNoteFieldPlainText(text) {
    return String(text ?? '').replace(/\r\n/g, '\n');
}

/**
 * Plain text for copy from per-root-key editors: each root key is a top-level label (`key:`),
 * textarea content is unchanged but every line is prefixed with one indent step (5 spaces),
 * matching {@link printJsonObject}'s indent step without parsing or JSON.stringify.
 * After each block, inserts a single blank line before the next block.
 * @param {string[]} orderedKeys
 * @param {Record<string, string>} fieldTexts
 * @returns {string}
 */
export function formatJsonFieldEditorsPlainCopy(orderedKeys, fieldTexts) {
    const step = 5;
    const inner = ' '.repeat(step);
    /** One newline so the next `key:` starts after one empty line. */
    const blockSuffix = '\n';
    let result = '';
    for (const k of orderedKeys) {
        const body = normalizeNoteFieldPlainText(fieldTexts[k] ?? '');
        result += k + ':\n';
        if (body.length > 0) {
            result += body.split('\n').map((line) => inner + line).join('\n') + '\n';
        }
        result += blockSuffix;
    }
    return result.trim();
}

export function hasAllSoapFourKeys(o) {
    return (
        o != null &&
        typeof o === 'object' &&
        !Array.isArray(o) &&
        SOAP_SECTION_KEYS.every((k) => k in o)
    );
}

/**
 * @returns {{ root: object | null, wrapper: 'none' | 'soap_note' }}
 */
export function getSoapNoteRootAndWrapper(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { root: null, wrapper: 'none' };
    }
    if (hasAllSoapFourKeys(parsed)) {
        return { root: parsed, wrapper: 'none' };
    }
    if (
        parsed.soap_note &&
        typeof parsed.soap_note === 'object' &&
        !Array.isArray(parsed.soap_note) &&
        hasAllSoapFourKeys(parsed.soap_note)
    ) {
        return { root: parsed.soap_note, wrapper: 'soap_note' };
    }
    return { root: null, wrapper: 'none' };
}

/**
 * When true, note JSON built for save/export may have top-level keys rewritten via {@link withCapitalizedJsonRootKeys}.
 * @param {unknown} parsed
 */
export function shouldCapitalizeNoteParsedObjectRoots(parsed) {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return false;
    }
    return true;
}

/** True if at least one SOAP section value is a nested plain object (LLM "Chief complaint" style). */
export function shouldUseSoapFieldEditors(root) {
    if (!root || typeof root !== 'object') return false;
    return SOAP_SECTION_KEYS.some((k) => {
        const v = root[k];
        return v !== null && typeof v === 'object' && !Array.isArray(v);
    });
}

/**
 * Parse edited note field text: JSON if `{`/`[`, else indented printJsonObject format, else raw string.
 * @param {string} text
 */
export function tryParseNoteField(text) {
    const t = String(text ?? '').replace(/\r\n/g, '\n');
    if (!t.trim()) return '';
    const tr = t.trim();
    if (tr.startsWith('{') || tr.startsWith('[')) {
        try {
            return JSON.parse(tr);
        } catch {
            /* fall through to indented parser */
        }
    }
    try {
        return parsePrintJsonObjectFormat(t);
    } catch {
        return t;
    }
}

/**
 * Build `{ soapNote: { subjective, objective, assessment, plan } }` for V1 SOAP conversion from various LLM/API shapes.
 * @param {unknown} parsed
 * @returns {{ soapNote: object } | null}
 */
export function soapStructureFromParsed(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.soapNote && typeof parsed.soapNote === 'object') {
        return parsed;
    }
    const inner = parsed.soap_note || parsed;
    if (inner && typeof inner === 'object') {
        if (inner.soapNote && typeof inner.soapNote === 'object') {
            return inner;
        }
        const subj = inner.subjective;
        const obj = inner.objective;
        const ass = inner.assessment;
        const pl = inner.plan;
        if (
            subj !== undefined ||
            obj !== undefined ||
            ass !== undefined ||
            pl !== undefined
        ) {
            return {
                soapNote: {
                    subjective:
                        typeof subj === 'string' ? subj : printJsonObject(subj, 0),
                    objective:
                        typeof obj === 'string' ? obj : printJsonObject(obj, 0),
                    assessment:
                        typeof ass === 'string' ? ass : printJsonObject(ass, 0),
                    plan: typeof pl === 'string' ? pl : printJsonObject(pl, 0),
                },
            };
        }
    }
    return null;
}

/**
 * Plain text for a JSON object whose only root key is empty/whitespace ("unlabeled" blob from API).
 * Otherwise null. Used to show/save as plain `note_text` instead of re-stringifying as JSON.
 * @param {unknown} parsed
 * @returns {string | null}
 */
export function getSingleAnonymousRootNotePlainText(parsed) {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }
    const keys = Object.keys(parsed);
    if (keys.length !== 1 || keys[0].trim() !== '') return null;
    const v = parsed[keys[0]];
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (v === null) return '';
    if (typeof v === 'object') return printJsonObject(v, 0);
    return String(v);
}

/**
 * Plain object (not array) with labeled root keys — suitable for per-field note editors.
 * A single property whose key is empty/whitespace is treated as unstructured plain note (no editors).
 * @param {unknown} parsed
 */
export function shouldUseJsonRootFieldEditors(parsed) {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return false;
    }
    const keys = Object.keys(parsed);
    if (keys.length === 0) return false;
    if (keys.length === 1 && keys[0].trim() === '') return false;
    return true;
}

/**
 * Converts plain markdown text (with \n) to an array of docx Paragraphs for Word export.
 * Each line separated by \n becomes a new Paragraph.
 * @param {string} markdownText
 * @param {object} [options] - Optional: heading, color, spacing, etc.
 * @returns {Paragraph[]} Array of docx Paragraphs
 */
import { Paragraph, HeadingLevel } from "docx";

export function markdownTextToWord(markdownText, options = {}) {
    if (typeof markdownText !== "string") return [];

    const lines = markdownText.split("\n").map(line => line.trim()).filter(line => line.length > 0);

    return lines.map(line =>
        new Paragraph({
            text: line,
            heading: options.heading,
            color: options.color,
            spacing: options.spacing,
        })
    );
}
// Clean markdown for plain text display, removing all HTML/markdown and adding indentation for levels
export const cleanMarkdownText = (key, value, level = 0) => {
    // Helper for indentation
    const indent = (lvl) => ' '.repeat(lvl * 3);

    if (typeof value === 'string' || typeof value === 'number') {
        let str = String(value).trim();
        // Remove markdown markers
        str = str
            .replace(/\*{2,}/g, '') // Remove bold/italic markers
            .replace(/\*/g, '') // Remove list markers
            .replace(/`+/g, '') // Remove code markers
            .replace(/#+/g, '') // Remove heading markers
            .replace(/_/g, '') // Remove underscores
            .replace(/\[(.*?)\]\((.*?)\)/g, '$1') // Remove markdown links
            .replace(/\!\[(.*?)\]\((.*?)\)/g, '$1') // Remove images
            .replace(/<[^>]+>/g, '') // Remove any HTML tags
            .replace(/^-\s+/gm, '') // Remove dash list markers
            .replace(/\n{2,}/g, '\n'); // Collapse multiple newlines
        // Add indentation for each line
        return str.split('\n').map(line => indent(level) + line).join('\n');
    } else if (Array.isArray(value)) {
        return value.map(item => cleanMarkdownText('', item, level + 1)).join('\n');
    } else if (typeof value === 'object' && value !== null) {
        let result = '';
        for (const [k, v] of Object.entries(value)) {
            result += indent(level) + k + ':\n';
            result += cleanMarkdownText('', v, level + 1) + '\n';
        }
        return result.trim();
    }
    return String(value);
};
// lib/format.js - Formatting and utility functions
// Generate unique ID for transcripts/SOAP notes
export const generateId = (userId = 'default') => {
    const timestamp = Date.now();
    return `${timestamp}_${userId}`;
};

// Format timestamp for display
export const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Format display name for transcript (timestamp_chief complaint)
export const formatDisplayName = (timestamp, chiefComplaint = '') => {
    const dateStr = formatTimestamp(timestamp);
    return chiefComplaint ? `${dateStr}_${chiefComplaint}` : dateStr;
};

// Extract chief complaint from transcript text
export const extractChiefComplaint = (transcript) => {
    if (!transcript || typeof transcript !== 'string') {
        return 'No chief complaint';
    }

    // Simple extraction - look for common patterns
    const patterns = [
        /chief complaint[:\s]+(.+?)[\.\n]/i,
        /presenting with[:\s]+(.+?)[\.\n]/i,
        /complains? of[:\s]+(.+?)[\.\n]/i,
        /here for[:\s]+(.+?)[\.\n]/i
    ];

    for (const pattern of patterns) {
        const match = transcript.match(pattern);
        if (match) {
            return match[1].trim().substring(0, 50); // Limit to 50 chars
        }
    }

    // Fallback - use first sentence up to 50 chars
    const firstSentence = transcript.split('.')[0];
    return firstSentence ? firstSentence.substring(0, 50).trim() : 'No chief complaint';
};

// Format duration helper (moved from your component)
export const formatDuration = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Format file size
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Extract filename from path (e.g., "/folder/file.webm" -> "file.webm")
export const extractRecordingFilenameFromPath = (path) => {
    return path?.split("/").pop() || "recording.webm";
};

// Format SOAP section as HTML with bold and bullet structure
export const formatMarkdownText = (key, value, level = 0, fontSize = null) => {
    // Helper to wrap text in larger font if requested
    const wrapLarge = (html, size) => {
        if (!size) return html;
        return `<span style="font-size:${size};font-weight:bold;">${html}</span>`;
    };

    // Helper for indentation
    const indent = (level) => '&nbsp;'.repeat(level * 3);

    if (typeof value === 'string' || typeof value === 'number') {
        const str = String(value).trim();
        // Clean up the malformed markdown first
        let cleaned = str
            // Fix the *** separators to proper newlines
            .replace(/\*{3,}/g, '\n* ')
            // Ensure proper spacing after list markers
            .replace(/^\*([^*\s])/gm, '* $1')
            // Clean up any malformed bold markers
            .replace(/\*\*([^*]+?)\*(?!\*)/g, '**$1**');

        // Use marked to parse the markdown
        try {
            let html = marked.parse(cleaned, {
                breaks: true,
                gfm: true
            });
            // Level-based formatting
            if (level === 0 && fontSize) {
                html = `<span style="font-weight:bold;text-decoration:underline;">${html}</span>`;

                html = wrapLarge(html, fontSize);
                // } else if (level === 1) {
                //     // Bold and underline for level 1
                //     html = `<span style="font-weight:bold;">${html}</span>`;
            } else if (level > 0) {
                // Indent lower levels
                html = `<div style="margin-left:${level * 3}ch;">${html}</div>`;
            }
            return html;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return str; // Fallback to original text
        }
    } else if (Array.isArray(value)) {
        let result = '<ul>';
        for (const item of value) {
            result += `<li>${formatMarkdownText('', item, level + 1, fontSize)}</li>`;
        }
        result += '</ul>';
        return result;
    } else if (typeof value === 'object' && value !== null) {
        let result = '';
        let idx = 0;
        for (const [k, v] of Object.entries(value)) {
            // Level-based formatting for keys
            let keyHtml = k;
            if (level === 0 && fontSize) {
                keyHtml = wrapLarge(keyHtml, fontSize);
            } else if (level === 1) {
                keyHtml = `<span style="text-decoration:underline;">${keyHtml}</span>`;
            } else if (level > 1) {
                keyHtml = `<span style="margin-left:${level * 3}ch;">${keyHtml}</span>`;
            }
            result += `${indent(level)}${keyHtml}:<br>`;
            result += formatMarkdownText('', v, level + 1, fontSize) + '<br>';
            idx++;
        }
        return result;
    }
    return String(value);
};

/** Matches `formatEncounterTimestamp` output (e.g. May 14, 3:45pm). */
export const ENCOUNTER_TIMESTAMP_NAME_RE =
  /^[A-Za-z]{3}\s+\d{1,2},\s*\d{1,2}:\d{2}(am|pm)$/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export const isEncounterTimestampName = (value) =>
  ENCOUNTER_TIMESTAMP_NAME_RE.test(String(value ?? "").trim());

/**
 * Name for Active Recording: keep user-typed labels, refresh stale auto timestamps.
 * @param {unknown} stored — value from localStorage (or current field)
 * @param {Date} [now]
 * @returns {string}
 */
export const resolveActiveRecordingEncounterName = (stored, now = new Date()) => {
  const trimmed = String(stored ?? "").trim();
  if (trimmed.length > 0 && !isEncounterTimestampName(trimmed)) {
    return trimmed;
  }
  return formatEncounterTimestamp(now);
};

// Patient encounter auto-name: "MMM DD, h:mmam" (e.g. May 14, 3:45pm) in local time
export const formatEncounterTimestamp = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const monthStr = d.toLocaleString('en-US', { month: 'short' });
  const dayNum = d.getDate();
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const isPm = hours >= 12;
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mm = String(minutes).padStart(2, '0');
  const suffix = isPm ? 'pm' : 'am';
  return `${monthStr} ${dayNum}, ${hours}:${mm}${suffix}`;
};