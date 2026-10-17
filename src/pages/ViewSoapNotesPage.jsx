import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";
import Auth from "@/components/Auth.jsx";
import Select from "@/components/Select.jsx";
import parseSoapNotes from "@/utils/parseSoapNotes";
import SoapNoteCard from "@/components/SoapNoteCard.jsx";
import PageHeaderCountBadge from "@/components/PageHeaderCountBadge.jsx";

export default function ViewSoapNotesPage() {
  const navigate = useNavigate();
  const [soapNotes, setSoapNotes] = useState([]);
  const [sortBy, setSortBy] = useState("created_at");

  useEffect(() => {
    const fetchSoapNotes = async () => {
      const jwt = api.getJWT();
      if (!jwt) {
        navigate("/login");
        return;
      }
      const result = await api.getAllSoapNotes();
      if (!result.success) {
        if (result.status === 401) {
          navigate("/login");
        } else {
          console.error('Error loading SOAP notes:', result.error);
        }
        return;
      }
      const data = result.data;
      if (!data || Object.keys(data).length === 0) {
        navigate("/login");
        return;
      }
      const parsedSoapNotes = parseSoapNotes(data);
      setSoapNotes(parsedSoapNotes);
      console.log("Fetched SOAP notes:", parsedSoapNotes);
    };
    fetchSoapNotes();
  }, [navigate]);

  const sortedSoapNotes = [...soapNotes].sort((a, b) => {
    if (sortBy === "created_at") {
      return new Date(b.created_at) - new Date(a.created_at);
    }
    if (sortBy === "updated_at") {
      return new Date(b.updated_at) - new Date(a.updated_at);
    }
    if (sortBy === "A-Z") {
      return (a.soapNote_text?.soapNote?.subjective || "").localeCompare(
        b.soapNote_text?.soapNote?.subjective || ""
      );
    }
    return 0;
  });

  const handleCardClick = (id) => {
    navigate(`/edit-soap-note/${id}`);
  };

  return (
    <>
      <Auth />
      <div className="max-w-8xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold flex flex-wrap items-center gap-3">
            <span>View SOAP Notes</span>
            <PageHeaderCountBadge count={soapNotes.length} />
          </h1>
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
        </div>
        <div
          id="allSoapNotes"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "20px",
            width: "100%",
            margin: "0 auto",
          }}
          className="responsive-grid"
        >
          {sortedSoapNotes.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
              <div className="empty-icon">📋</div>
              <div className="empty-text">No SOAP notes found</div>
            </div>
          ) : (
            sortedSoapNotes.map((soapNote) => (
              <SoapNoteCard
                key={soapNote.id}
                soapNote={soapNote}
                onCardClick={handleCardClick}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
