import React from "react";
import * as format from "@/utils/format.js";

export default function SoapNoteCard({ soapNote, onCardClick }) {
  return (
    <div
      className="soap-card"
      data-soapnote-id={soapNote.id}
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
          "0 4px 16px rgba(0,0,0,0.16)";
        e.currentTarget.style.transform =
          "translateY(-4px) scale(1.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow =
          "0 2px 8px rgba(0,0,0,0.08)";
        e.currentTarget.style.transform = "none";
      }}
      onClick={() => onCardClick(soapNote.id)}
    >
      <div
        className="soap-icon"
        style={{ fontSize: "2rem", marginBottom: "8px" }}
      >
        📋
      </div>
      <div
        className="soap-title"
        style={{ fontWeight: "bold", marginBottom: "6px" }}
      >
        SOAP Note
      </div>
      <div
        className="soap-metadata"
        style={{ fontSize: "0.85em", color: "#999", marginBottom: "12px" }}
      >
        {format.formatTimestamp(soapNote.created_at)}
      </div>
      <div
        className="soap-preview"
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
        {soapNote.soapNote_text?.soapNote?.subjective
          ? soapNote.soapNote_text.soapNote.subjective
          : "No content"}
      </div>
    </div>
  );
}
