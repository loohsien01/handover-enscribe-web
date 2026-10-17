import React from "react";
import * as format from "@/utils/format.js";

export default function TemplatePreviewOverlay({ template, templateData, loading, onClose }) {
  if (!template) return null;

  const isSystemTemplate = template.user_id === null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          maxWidth: "700px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "32px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "24px" }}>
          <div>
            <h2 style={{ fontSize: "1.8rem", fontWeight: "bold", marginBottom: "8px" }}>
              {template.name}
            </h2>
            <div
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "0.75rem",
                fontWeight: "500",
                backgroundColor: isSystemTemplate ? "#d1fae5" : "#dbeafe",
                color: isSystemTemplate ? "#065f46" : "#0c4a6e",
              }}
            >
              {isSystemTemplate ? "Standard" : "Custom"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "#999",
            }}
          >
            ✕
          </button>
        </div>

        {/* Metadata */}
        <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "24px", paddingBottom: "16px", borderBottom: "1px solid #e5e7eb" }}>
          <p style={{ margin: "4px 0" }}>
            <strong>Created:</strong> {template.created_at ? format.formatTimestamp(template.created_at) : "Unknown"}
          </p>
          <p style={{ margin: "4px 0" }}>
            <strong>Updated:</strong> {template.updated_at ? format.formatTimestamp(template.updated_at) : "Unknown"}
          </p>
        </div>

        {/* Sections */}
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "16px" }}>
            Sections ({templateData?.sections?.length || 0})
          </h3>

          {loading ? (
            <div style={{ textAlign: "center", padding: "20px", color: "#999" }}>
              <p>Loading template details...</p>
            </div>
          ) : templateData && templateData.sections && templateData.sections.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {templateData.sections.map((section, index) => (
                <div
                  key={section.id}
                  style={{
                    padding: "16px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        width: "32px",
                        height: "32px",
                        backgroundColor: "#007bff",
                        color: "white",
                        borderRadius: "50%",
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                      }}
                    >
                      {index + 1}
                    </span>
                    <h4 style={{ fontSize: "1rem", fontWeight: "bold", margin: 0 }}>
                      {section.name}
                    </h4>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "#999",
                        backgroundColor: "#e5e7eb",
                        padding: "2px 8px",
                        borderRadius: "3px",
                      }}
                    >
                      {section.layout}
                    </span>
                  </div>

                  {section.details && (
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "0.9rem",
                        color: "#555",
                        backgroundColor: "white",
                        padding: "12px",
                        borderRadius: "4px",
                        border: "1px solid #e5e7eb",
                        lineHeight: "1.5",
                      }}
                    >
                      {section.details}
                    </div>
                  )}

                  <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "#999" }}>
                    {section.user_id === null ? "System Section" : "Custom Section"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px", color: "#999" }}>
              <p>No sections in this template</p>
            </div>
          )}
        </div>

        {/* Footer Actions (Placeholder) */}
        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: "12px" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              backgroundColor: "white",
              color: "#374151",
              fontWeight: "500",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Close
          </button>
          {/* Placeholder for future actions */}
          <button
            disabled
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              backgroundColor: "#f3f4f6",
              color: "#999",
              fontWeight: "500",
              cursor: "not-allowed",
              fontSize: "0.9rem",
            }}
          >
            Edit (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  );
}
