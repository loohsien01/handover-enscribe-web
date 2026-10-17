import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";
import Auth from "@/components/Auth.jsx";
import Select from "@/components/Select.jsx";
import PageLoading from "@/components/PageLoading.jsx";
import parseNotes from "@/utils/parseNotes";
import {
  encounterNameMapFromListData,
  mergeEncounterNamesFromListResponse,
  readEncounterNameCache,
} from "@/utils/encounterNameSessionCache.js";
import NoteCard from "@/components/NoteCard.jsx";
import PageHeaderCountBadge from "@/components/PageHeaderCountBadge.jsx";

export default function ViewNotesPage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [sortBy, setSortBy] = useState("created_at");
  const [patientEncounterMap, setPatientEncounterMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotes = async () => {
      const jwt = api.getJWT();
      if (!jwt) {
        navigate("/login");
        return;
      }
      try {
        const result = await api.getAllNotesComplete();
        const data = result.data;
        if (!data || Object.keys(data).length === 0) {
          setNotes([]);
          return;
        }
        const parsedNotes = parseNotes(data);
        setNotes(parsedNotes);

        const patientEncounters = await api.getAllPatientEncounters({
          decryptName: true,
        });
        if (patientEncounters.success) {
          mergeEncounterNamesFromListResponse(patientEncounters.data);
          const fresh = encounterNameMapFromListData(patientEncounters.data);
          setPatientEncounterMap({ ...readEncounterNameCache(), ...fresh });
        } else {
          setPatientEncounterMap({ ...readEncounterNameCache() });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, [navigate]);

  const sortedNotes = [...notes].sort((a, b) => {
    if (sortBy === "created_at") {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    if (sortBy === "updated_at") {
      return new Date(b.updated_at) - new Date(a.updated_at);
    }
    if (sortBy === "A-Z") {
      return (a.text || "").localeCompare(b.text || "");
    }
    return 0;
  });

  const handleCardClick = (id) => {
    navigate(`/edit-note/${id}`);
  };

  return (
    <>
      <Auth />
      <div className="max-w-8xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold flex flex-wrap items-center gap-3">
            <span>View Notes</span>
            {!loading && <PageHeaderCountBadge count={notes.length} />}
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
            id="allNotes"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "20px",
              width: "100%",
              margin: "0 auto",
            }}
            className="responsive-grid"
          >
            {sortedNotes.length === 0 ? (
              <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                <div className="empty-icon">📋</div>
                <div className="empty-text">No notes found</div>
              </div>
            ) : (
              sortedNotes.map((note) => {
                const encounterId =
                  note.patientEncounter_id ?? note.patientEncounterId;
                return (
                  <NoteCard
                    key={note.id}
                    note={note}
                    patientEncounterName={
                      patientEncounterMap[encounterId] ??
                      patientEncounterMap[String(encounterId)]
                    }
                    onCardClick={handleCardClick}
                  />
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
}
