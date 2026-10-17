import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import * as api from "@/lib/api"
import * as format from "@/utils/format.js"
import Auth from "@/components/Auth.jsx"
import Select from "@/components/Select.jsx"
import PageLoading from "@/components/PageLoading.jsx"
import PageHeaderCountBadge from "@/components/PageHeaderCountBadge.jsx"

const ViewPatientEncountersPage = () => {
  const navigate = useNavigate()
  const [patientEncounters, setPatientEncounters] = useState([])
  const [sortBy, setSortBy] = useState("created_at")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEncounters = async () => {
      const jwt = api.getJWT()
      if (!jwt) {
        navigate("/login")
        return
      }
      try {
        const result = await api.getAllPatientEncounters({ decryptName: true })
        if (!result.success) {
          if (result.status === 401) {
            navigate("/login")
          } else {
            console.error('Error loading patient encounters:', result.error)
          }
          return
        }
        setPatientEncounters(Object.values(result.data))
      } finally {
        setLoading(false)
      }
    }
    fetchEncounters()
  }, [navigate])

  const sortedEncounters = [...patientEncounters].sort((a, b) => {
    if (sortBy === "created_at") {
      return new Date(b.created_at) - new Date(a.created_at)
    }
    if (sortBy === "updated_at") {
      return new Date(b.updated_at) - new Date(a.updated_at)
    }
    if (sortBy === "A-Z") {
      return (a.name || "").localeCompare(b.name || "")
    }
    return 0
  })

  const handleCardClick = (id) => {
    navigate(`/edit-patient-encounter/${id}`)
  }

  return (
    <>
      <Auth />
      <div className="max-w-8xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold flex flex-wrap items-center gap-3">
            <span>View Patient Encounters</span>
            {!loading && <PageHeaderCountBadge count={patientEncounters.length} />}
          </h1>
          {!loading && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="sortBy"
                className="text-sm font-medium text-gray-700"
              >
                Sort By:
              </label>
              <Select
                id="sortBy"
                size="sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="created_at">Date Created</option>
                <option value="updated_at">Date Updated</option>
                <option value="A-Z">A-Z</option>
              </Select>
            </div>
          )}
        </div>
        {loading ? (
          <PageLoading />
        ) : (
          <div
            id="allPatientEncounters"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "20px",
              width: "100%",
              margin: "0 auto",
            }}
            className="responsive-grid"
          >
            {sortedEncounters.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                <div className="empty-icon">🏥</div>
                <div className="empty-text">No patient encounters found</div>
              </div>
            ) : (
              sortedEncounters.map((encounter) => (
                <div
                  className="encounter-card"
                  data-encounter-id={encounter.id}
                  key={encounter.id}
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    padding: "20px",
                    minWidth: 0,
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    transition: "box-shadow 0.2s, transform 0.2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 4px 16px rgba(0,0,0,0.16)"
                    e.currentTarget.style.transform =
                      "translateY(-4px) scale(1.03)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 2px 8px rgba(0,0,0,0.08)"
                    e.currentTarget.style.transform = "none"
                  }}
                  onClick={() => handleCardClick(encounter.id)}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <div
                      aria-hidden
                      className="encounter-card-icon"
                      style={{
                        flexShrink: 0,
                        width: "2.875rem",
                        height: "2.875rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2.125rem",
                        lineHeight: 1,
                      }}
                    >
                      🏥
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="recent-title"
                        style={{ fontWeight: "bold", marginBottom: "4px", lineHeight: 1.35 }}
                      >
                        {encounter.name || ""}
                      </div>
                      <div
                        className="recent-preview"
                        style={{
                          color: "#555",
                          fontSize: "0.95em",
                          lineHeight: 1.35,
                        }}
                      >
                        {format.formatTimestamp(encounter.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default ViewPatientEncountersPage
