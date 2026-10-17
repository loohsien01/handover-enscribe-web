/**
 * Session cache for patient encounter display names (decrypted), keyed by encounter id.
 * Warmed from Dashboard, View Notes, View Recordings (attached), etc.
 */
import { SESSION_KEYS } from '@/utils/storageConfig.js'

const CACHE_VERSION = 1

function toArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data === 'object') return Object.values(data)
  return []
}

/**
 * @returns {Record<string, string>}
 */
export function readEncounterNameCache() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEYS.encounterNames)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed?.version !== CACHE_VERSION || typeof parsed?.byId !== 'object') {
      return {}
    }
    return { ...parsed.byId }
  } catch {
    return {}
  }
}

/**
 * @param {Record<string, string>} byId
 */
function writeEncounterNameCache(byId) {
  try {
    sessionStorage.setItem(
      SESSION_KEYS.encounterNames,
      JSON.stringify({ version: CACHE_VERSION, byId }),
    )
  } catch {
    /* ignore quota */
  }
}

/**
 * Merge entries into the session cache (newer values win). Skips empty names.
 * @param {Record<string, string>} entries
 * @returns {Record<string, string>} full cache after merge
 */
export function mergeEncounterNameEntries(entries) {
  const cur = readEncounterNameCache()
  const next = { ...cur }
  for (const [id, name] of Object.entries(entries)) {
    if (id == null || id === '') continue
    const n = typeof name === 'string' ? name.trim() : ''
    if (!n) continue
    next[String(id)] = n
  }
  writeEncounterNameCache(next)
  return next
}

/**
 * Build a display map from GET /patient-encounters list (or similar) including "Unknown" fallback.
 * @returns {Record<string, string>}
 */
export function encounterNameMapFromListData(data) {
  const map = {}
  for (const enc of toArray(data)) {
    if (enc?.id == null) continue
    const raw = enc.name != null ? String(enc.name).trim() : ''
    map[String(enc.id)] = raw || 'Unknown'
  }
  return map
}

/**
 * Warm cache from list response; only stores non-empty names.
 * @returns {Record<string, string>} map of ids merged this call (truthy names only)
 */
export function mergeEncounterNamesFromListResponse(data) {
  const toMerge = {}
  for (const enc of toArray(data)) {
    if (enc?.id == null) continue
    const n = enc.name != null ? String(enc.name).trim() : ''
    if (n) toMerge[String(enc.id)] = n
  }
  mergeEncounterNameEntries(toMerge)
  return toMerge
}

/**
 * Remove one encounter id from the session name cache (e.g. after DELETE).
 * @param {string|number} id
 * @returns {Record<string, string>}
 */
export function removeEncounterNameFromCache(id) {
  if (id == null || id === '') return readEncounterNameCache()
  const key = String(id)
  const cur = readEncounterNameCache()
  if (!(key in cur)) return cur
  const next = { ...cur }
  delete next[key]
  writeEncounterNameCache(next)
  return next
}

/**
 * Warm cache from attached recordings rows (`patientEncounter.id` / `.name`).
 * @param {unknown} recordings
 */
export function mergeEncounterNamesFromAttachedRecordings(recordings) {
  const toMerge = {}
  for (const rec of toArray(recordings)) {
    const pe = rec?.patientEncounter
    if (!pe || pe.id == null) continue
    const n = pe.name != null ? String(pe.name).trim() : ''
    if (n) toMerge[String(pe.id)] = n
  }
  mergeEncounterNameEntries(toMerge)
}
