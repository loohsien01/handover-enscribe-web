import React, { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '@/lib/api'
import { loadRecentNotesCached } from '@/utils/recentNotesSessionCache.js'
import {
  encounterNameMapFromListData,
  mergeEncounterNamesFromListResponse,
  readEncounterNameCache,
} from '@/utils/encounterNameSessionCache.js'
import Auth from '@/components/Auth.jsx'
import NoteCard from '@/components/NoteCard.jsx'
import PageLoading from '@/components/PageLoading.jsx'

const PATIENT_ENCOUNTERS_BATCH_LIMIT = 15

const DashboardPage = () => {
  const navigate = useNavigate()
  const [notesCount, setNotesCount] = useState(0)
  const [recentNotes, setRecentNotes] = useState([])
  const [patientEncounterMap, setPatientEncounterMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadDashboardData = useCallback(async () => {
    const jwt = api.getJWT()
    if (!jwt) {
      navigate('/login')
      return
    }

    setPatientEncounterMap({})

    const [noteRes, encRes] = await Promise.all([
      loadRecentNotesCached(),
      api.getAllPatientEncounters({
        decryptName: true,
        limit: PATIENT_ENCOUNTERS_BATCH_LIMIT,
        offset: 0,
      }),
    ])

    if (!noteRes.success) {
      console.error('Error loading notes:', noteRes.error)
      if (noteRes.status === 401) {
        navigate('/login')
      } else {
        setError('Error loading notes: ' + noteRes.error)
      }
      return
    }

    if (encRes.success) {
      mergeEncounterNamesFromListResponse(encRes.data)
    }
    const fresh = encRes.success ? encounterNameMapFromListData(encRes.data) : {}
    setPatientEncounterMap({ ...readEncounterNameCache(), ...fresh })
    setRecentNotes(noteRes.recentNotes)
    setNotesCount(noteRes.totalCount)
  }, [navigate])

  useEffect(() => {
    const jwt = api.getJWT()
    if (!jwt) {
      navigate('/login')
      return
    }

    const loadData = async () => {
      setLoading(true)
      setError(null)
      await loadDashboardData()
      setLoading(false)
    }

    loadData()
  }, [loadDashboardData, navigate])

  // Navigation handlers
  const editNote = (id) => {
    navigate(`/edit-note/${id}`)
  }

  return (
    <>
      <Auth />
      <div className="dashboard-container" style={{ padding: '20px', width: '100%' }}>
      {error && (
        <div style={{ color: '#d32f2f', marginBottom: '20px', padding: '10px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>Dashboard</h1>
        <button
          onClick={() => navigate('/active-recording')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.95rem',
          }}
        >
          + New Patient Encounter
        </button>
      </div>

      {loading ? (
        <PageLoading />
      ) : (
        <>
      {/* Notes Tab */}
      <div>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '20px', fontWeight: '600' }}>Recent Notes ({notesCount})</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
            width: '100%',
          }}
        >
          {recentNotes.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '40px 20px',
                backgroundColor: '#f9f9f9',
                borderRadius: '8px',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📝</div>
              <div style={{ color: '#666', fontSize: '1.1rem' }}>No notes yet</div>
            </div>
          ) : (
            recentNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                patientEncounterName={
                  patientEncounterMap[note.patientEncounter_id ?? note.patientEncounterId]
                }
                onCardClick={editNote}
              />
            ))
          )}
        </div>
      </div>
        </>
      )}
      </div>
    </>
  )
}

export default DashboardPage
