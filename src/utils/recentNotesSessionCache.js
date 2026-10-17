/**
 * Shared session cache + loader for “recent notes” (rail + dashboard).
 * Uses lightweight GET /api/notes first; only calls GET /api/notes/complete when
 * cache is missing, stale (updated_at mismatch), or lacks full note rows.
 */
import * as api from "@/lib/api"
import parseNotes from "@/utils/parseNotes"
import { getNotePreviewText } from "@/utils/notePreview"
import { SESSION_KEYS, SESSION_KEYS_LEGACY } from "@/utils/storageConfig.js"

export const RECENT_NOTES_LIMIT = 10

/** @typedef {{ updated_at: string, preview: string, previewHover?: string, note?: object }} CachedNoteEntry */

const CACHE_VERSION = 3

function toArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data === "object") return Object.values(data)
  return []
}

function lightTimestamp(row) {
  return String(row.updated_at ?? "")
}

function sortNotesByRecencyDesc(rows) {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.updated_at || 0).getTime()
    const tb = new Date(b.updated_at || 0).getTime()
    return tb - ta
  })
}

/** Single-line-ish spaces; cap for hover tooltip body (chars). */
export function clampHoverPreviewText(s, max = 1000) {
  if (!s) return ""
  const t = String(s).replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/**
 * @returns {{ version: number, byId: Record<string, CachedNoteEntry> }}
 */
export function readRecentNotesCache() {
  try {
    let raw = sessionStorage.getItem(SESSION_KEYS.recentNotesPreview)
    if (!raw) {
      raw = sessionStorage.getItem(SESSION_KEYS_LEGACY.recentNotesPreview)
      if (raw) {
        try {
          sessionStorage.setItem(SESSION_KEYS.recentNotesPreview, raw)
          sessionStorage.removeItem(SESSION_KEYS_LEGACY.recentNotesPreview)
        } catch {
          /* ignore */
        }
      }
    }
    if (!raw) return { version: CACHE_VERSION, byId: {} }
    const parsed = JSON.parse(raw)
    if (parsed?.version !== CACHE_VERSION || typeof parsed?.byId !== "object") {
      return { version: CACHE_VERSION, byId: {} }
    }
    return parsed
  } catch {
    return { version: CACHE_VERSION, byId: {} }
  }
}

/**
 * @param {Record<string, CachedNoteEntry>} byId
 */
export function writeRecentNotesCache(byId) {
  try {
    sessionStorage.setItem(
      SESSION_KEYS.recentNotesPreview,
      JSON.stringify({ version: CACHE_VERSION, byId }),
    )
  } catch {
    /* ignore quota */
  }
}

/**
 * Drop note ids from the recent-notes session cache (e.g. after encounter DELETE).
 * @param {Iterable<string|number>} ids
 */
export function removeRecentNotesFromCache(ids) {
  const { byId } = readRecentNotesCache()
  const next = { ...byId }
  let changed = false
  for (const id of ids) {
    if (id == null || id === '') continue
    const key = String(id)
    if (key in next) {
      delete next[key]
      changed = true
    }
  }
  if (changed) writeRecentNotesCache(next)
}

function needsCompleteFetch(lightRecent, cacheById) {
  for (const row of lightRecent) {
    const id = String(row.id)
    const ts = lightTimestamp(row)
    const c = cacheById[id]
    if (!c) return true
    if (c.updated_at !== ts) return true
    if (!c.note || typeof c.note !== "object") return true
  }
  return false
}

function parseNoteClone(rawNote) {
  const copy =
    typeof structuredClone === "function"
      ? structuredClone(rawNote)
      : JSON.parse(JSON.stringify(rawNote))
  return parseNotes(copy)
}

/**
 * Raw note rows from complete API (no parseNotes), keyed by id string.
 * @param {unknown} completeData
 * @returns {Map<string, object>}
 */
function rawNotesByIdFromComplete(completeData) {
  const list = Array.isArray(completeData)
    ? completeData
    : Object.values(completeData || {})
  const map = new Map()
  for (const n of list) {
    if (n && typeof n === "object" && n.id != null) {
      map.set(String(n.id), n)
    }
  }
  return map
}

/**
 * @param {object[]} lightRecent
 * @param {Map<string, object>} fullById raw API rows
 */
function buildCacheForRecent(lightRecent, fullById) {
  /** @type {Record<string, CachedNoteEntry>} */
  const next = {}
  for (const row of lightRecent) {
    const id = String(row.id)
    const ts = lightTimestamp(row)
    const rawRow = fullById.get(id)
    if (!rawRow) continue
    const parsed = parseNoteClone(rawRow)
    const raw = getNotePreviewText(parsed).trim().replace(/\s+/g, " ")
    const preview = raw.length > 160 ? `${raw.slice(0, 157)}…` : raw || "No content"
    const previewHover = clampHoverPreviewText(raw, 1000)
    next[id] = {
      updated_at: ts,
      preview,
      previewHover,
      note: rawRow,
    }
  }
  return next
}

/**
 * Hydrate parsed notes from cache only (same order as lightRecent).
 * @param {object[]} lightRecent
 * @param {Record<string, CachedNoteEntry>} cacheById
 * @returns {object[]}
 */
function parsedNotesFromCache(lightRecent, cacheById) {
  const out = []
  for (const row of lightRecent) {
    const id = String(row.id)
    const c = cacheById[id]
    if (!c?.note) return null
    const ts = lightTimestamp(row)
    if (c.updated_at !== ts) return null
    out.push(parseNoteClone(c.note))
  }
  return out
}

/**
 * Load up to {@link RECENT_NOTES_LIMIT} most recent notes with text for cards/previews.
 * Skips GET /api/notes/complete when session cache matches lightweight list.
 *
 * @returns {Promise<{ success: true, recentNotes: object[], totalCount: number, usedComplete: boolean } | { success: false, error: string, status?: number }>}
 */
export async function loadRecentNotesCached() {
  const lightRes = await api.getAllNotes()
  if (!lightRes.success) {
    return { success: false, error: lightRes.error || "Could not load notes", status: lightRes.status }
  }

  const lightAll = toArray(lightRes.data).filter((n) => n && n.id != null)
  const totalCount = lightAll.length
  const lightRecent = sortNotesByRecencyDesc(lightAll).slice(0, RECENT_NOTES_LIMIT)

  if (lightRecent.length === 0) {
    writeRecentNotesCache({})
    return { success: true, recentNotes: [], totalCount: 0, usedComplete: false }
  }

  const cache = readRecentNotesCache()
  let usedComplete = false

  if (!needsCompleteFetch(lightRecent, cache.byId)) {
    const fromCache = parsedNotesFromCache(lightRecent, cache.byId)
    if (fromCache) {
      return { success: true, recentNotes: fromCache, totalCount, usedComplete: false }
    }
  }

  const completeRes = await api.getAllNotesComplete({
    limit: RECENT_NOTES_LIMIT,
    offset: 0,
  })
  if (!completeRes.success) {
    return {
      success: false,
      error: completeRes.error || "Could not load full notes",
      status: completeRes.status,
    }
  }

  usedComplete = true
  const fullById = rawNotesByIdFromComplete(completeRes.data)
  const nextById = buildCacheForRecent(lightRecent, fullById)
  writeRecentNotesCache(nextById)

  const recentNotes = lightRecent
    .map((row) => {
      const id = String(row.id)
      const rawRow = fullById.get(id)
      return rawRow ? parseNoteClone(rawRow) : null
    })
    .filter(Boolean)

  return { success: true, recentNotes, totalCount, usedComplete }
}
