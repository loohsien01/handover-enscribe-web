import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useLocation, useNavigate } from "react-router-dom"
import * as api from "@/lib/api"
import { getNotePreviewText } from "@/utils/notePreview"
import {
  clampHoverPreviewText,
  loadRecentNotesCached,
} from "@/utils/recentNotesSessionCache.js"

function toArray(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data === "object") return Object.values(data)
  return []
}

function encounterNameMap(encountersData) {
  const map = {}
  const list = toArray(encountersData)
  for (const enc of list) {
    if (enc?.id == null) continue
    const name = enc.name || "Unknown"
    map[enc.id] = name
    map[String(enc.id)] = name
  }
  return map
}

/**
 * Fixed recent-notes rail (desktop). Sits right of the collapsed main nav; main nav z-index covers it when expanded.
 * Wired from App.jsx (currently commented): needs `--notes-rail-width` + inset math in `ShellContentInsetVars`; see `shellLayout.js`.
 */
export default function RecentNotesRail() {
  const location = useLocation()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  /** @type {{ left: number, top: number, encounterName: string, noteText: string } | null} */
  const [hoverTip, setHoverTip] = useState(null)

  const authRoutes = ["/login", "/signup", "/confirm-email", "/forgot-password", "/reset-password"]
  const isAuthPage = authRoutes.some((r) => location.pathname.startsWith(r))

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (isAuthPage) {
        setRows([])
        setLoading(false)
        setError(null)
        return
      }
      if (!api.getJWT()) {
        setRows([])
        setLoading(false)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      const [notesRes, encRes] = await Promise.all([
        loadRecentNotesCached(),
        api.getAllPatientEncounters({ decryptName: true }),
      ])
      if (cancelled) return

      if (!notesRes.success) {
        setError(notesRes.error || "Could not load notes")
        setRows([])
        setLoading(false)
        return
      }

      const encMap = encRes.success ? encounterNameMap(encRes.data) : {}
      const built = notesRes.recentNotes.map((note) => {
        const id = String(note.id)
        const encId = note.patientEncounter_id ?? note.patientEncounterId
        const encounterName =
          encMap[encId] ?? encMap[String(encId)] ?? "Unknown encounter"
        const raw = getNotePreviewText(note).trim().replace(/\s+/g, " ")
        const preview =
          raw.length > 160 ? `${raw.slice(0, 157)}…` : raw || "No content"
        const hoverNote = clampHoverPreviewText(raw, 1000)
        return {
          id,
          encounterName,
          preview: preview || "No content",
          hoverNote,
          updated_at: note.updated_at != null ? String(note.updated_at) : "",
        }
      })

      if (cancelled) return
      setRows(built)
      setLoading(false)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [isAuthPage, location.pathname])

  if (isAuthPage) {
    return null
  }

  return (
    <aside
      className="hidden lg:flex lg:flex-col fixed inset-y-0 left-[var(--shell-nav-collapsed-width)] z-30 w-[var(--notes-rail-width)] border-r border-slate-200/90 bg-slate-50 shadow-sm"
      aria-label="Recent notes"
    >
      <div className="px-3 pt-5 pb-3 border-b border-slate-200/80 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent notes</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-2">
        {loading && (
          <div className="px-1 py-8 text-center text-sm text-slate-400">Loading…</div>
        )}
        {!loading && error && (
          <div className="px-1 py-5 text-xs text-red-600/90 leading-relaxed">{error}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="px-1 py-8 text-center text-sm text-slate-400">No notes yet</div>
        )}
        {!loading &&
          !error &&
          rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => navigate(`/edit-note/${r.id}`)}
              className="w-full text-left rounded-xl px-2 py-2.5 hover:bg-white border border-transparent hover:border-slate-200/80 hover:shadow-sm transition-colors"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const tipW = 288
                let left = rect.right + 8
                if (left + tipW > window.innerWidth - 8) {
                  left = Math.max(8, rect.left - tipW - 8)
                }
                setHoverTip({
                  left,
                  top: rect.top,
                  encounterName: r.encounterName,
                  noteText: r.hoverNote ?? r.preview,
                })
              }}
              onMouseLeave={() => setHoverTip(null)}
            >
              <div className="text-xs font-semibold text-slate-800 truncate">{r.encounterName}</div>
              <div className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed break-words">
                {r.preview}
              </div>
            </button>
          ))}
      </div>

      <div className="shrink-0 px-3 pt-3 pb-4 border-t border-slate-200/80 bg-slate-50/95">
        <button
          type="button"
          onClick={() => navigate("/generate-note")}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-sm font-medium text-white bg-[#183278] hover:bg-[#11275C] transition-colors shadow-sm"
        >
          <span className="text-lg leading-none" aria-hidden>
            +
          </span>
          New Note
        </button>
      </div>

      {hoverTip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[100] w-72 max-w-[min(18rem,calc(100vw-1rem))] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left shadow-lg pointer-events-none"
            style={{ left: hoverTip.left, top: hoverTip.top }}
          >
            <div className="text-sm font-bold text-slate-900 leading-snug">{hoverTip.encounterName}</div>
            <div className="mt-2 max-h-64 overflow-y-auto text-xs font-normal text-slate-600 whitespace-pre-wrap break-words leading-relaxed">
              {hoverTip.noteText}
            </div>
          </div>,
          document.body
        )}
    </aside>
  )
}
