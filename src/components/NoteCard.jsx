import React from "react";
import * as format from "@/utils/format.js";
import { getNotePreviewText } from "@/utils/notePreview.js";

export default function NoteCard({
  note,
  patientEncounterName,
  onCardClick,
}) {
  return (
    <div
      className="note-card"
      data-note-id={note.id}
      style={{
        position: "relative",
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
          "0 4px 16px rgba(0,0,0,0.16)";
        e.currentTarget.style.transform =
          "translateY(-4px) scale(1.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow =
          "0 2px 8px rgba(0,0,0,0.08)";
        e.currentTarget.style.transform = "none";
      }}
      onClick={() => onCardClick(note.id)}
    >
      <div
        className="note-icon"
        style={{ fontSize: "2rem", marginBottom: "8px" }}
      >
        📝
      </div>
      <div
        className="note-title"
        style={{ fontWeight: "bold", marginBottom: "6px" }}
      >
        {patientEncounterName || "Unknown Patient"}
      </div>
      <div
        className="note-metadata"
        style={{ fontSize: "0.85em", color: "#999", marginBottom: "12px" }}
      >
        {format.formatTimestamp(note.created_at)}
      </div>
      <div
        className="note-preview"
        style={{
          color: "#555",
          marginBottom: "12px",
          fontSize: "0.95em",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 4,
          overflow: "hidden",
        }}
      >
        {getNotePreviewText(note) || "No content"}
      </div>
    </div>
  );
}
