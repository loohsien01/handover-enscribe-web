import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";
import * as format from "@/utils/format.js";
import Auth from "@/components/Auth.jsx";
import Select from "@/components/Select.jsx";
import PageHeaderCountBadge from "@/components/PageHeaderCountBadge.jsx";
import TemplatePreviewOverlay from "@/components/TemplatePreviewOverlay.jsx";
import LlmExtractNoteTemplateOverlay from "@/components/LlmExtractNoteTemplateOverlay.jsx";
import IconEdit from "@/components/IconEdit.jsx";

export default function ViewTemplatesPage() {
  const navigate = useNavigate();
  const [predefinedTemplates, setPredefinedTemplates] = useState([]);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [predefinedSortBy, setPredefinedSortBy] = useState("created_at");
  const [customSortBy, setCustomSortBy] = useState("created_at");
  const [predefinedOrder, setPredefinedOrder] = useState("desc");
  const [customOrder, setCustomOrder] = useState("desc");
  const [activeTab, setActiveTab] = useState("predefined");
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateData, setTemplateData] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [hoveredTemplateId, setHoveredTemplateId] = useState(null);
  const [llmExtractOpen, setLlmExtractOpen] = useState(false);
  const [llmExtractSubmitting, setLlmExtractSubmitting] = useState(false);
  const [llmExtractError, setLlmExtractError] = useState("");
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);

  const fetchTemplates = useCallback(
    async (limit = 100, offset = 0, sortBy = "created_at", order = "desc") => {
      const result = await api.fetchWithRefreshRetry("/api/note-templates/complete", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!result.success) {
        console.error("Error fetching templates:", result.error);
        if (result.status === 401) {
          navigate("/login");
        }
        return [];
      }

      const data = await result.response.json();
      let templates = data.templates || [];

      // Sort templates
      templates = templates.sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];

        if (sortBy === "name") {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
          return order === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else {
          // Date sorting
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
          return order === "asc" ? aVal - bVal : bVal - aVal;
        }
      });

      return templates;
    },
    [navigate],
  );

  const loadAllTemplates = useCallback(
    async (predefinedSortBy = "created_at", predefinedOrder = "desc", customSortBy = "created_at", customOrder = "desc") => {
      setLoading(true);
      const templates = await fetchTemplates();
      
      // Filter and sort predefined templates
      let predefined = templates.filter((t) => t.user_id === null);
      predefined = sortTemplates(predefined, predefinedSortBy, predefinedOrder);
      
      // Filter and sort custom templates
      let custom = templates.filter((t) => t.user_id !== null);
      custom = sortTemplates(custom, customSortBy, customOrder);
      
      setPredefinedTemplates(predefined);
      setCustomTemplates(custom);
      setLoading(false);
    },
    [fetchTemplates],
  );

  const sortTemplates = (templates, sortBy, order) => {
    return templates.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === "name") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
        return order === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        // Date sorting
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
        return order === "asc" ? aVal - bVal : bVal - aVal;
      }
    });
  };

  // Load all templates on mount
  useEffect(() => {
    loadAllTemplates(predefinedSortBy, predefinedOrder, customSortBy, customOrder);
  }, [predefinedSortBy, predefinedOrder, customSortBy, customOrder, loadAllTemplates]);

  const handlePredefinedSortChange = (newSort) => {
    setPredefinedSortBy(newSort);
  };

  const handlePredefinedOrderToggle = () => {
    const newOrder = predefinedOrder === "asc" ? "desc" : "asc";
    setPredefinedOrder(newOrder);
  };

  const handleCustomSortChange = (newSort) => {
    setCustomSortBy(newSort);
  };

  const handleCustomOrderToggle = () => {
    const newOrder = customOrder === "asc" ? "desc" : "asc";
    setCustomOrder(newOrder);
  };

  const getSortDisplayName = (sortValue) => {
    switch (sortValue) {
      case "name":
        return "A-Z";
      case "created_at":
        return "Date Created";
      case "updated_at":
        return "Date Updated";
      default:
        return "A-Z";
    }
  };

  const handleCardClick = async (template) => {
    // For system-generated templates, redirect to create-template with copy data
    if (template.user_id === null) {
      const jwt = api.getJWT();
      if (!jwt) {
        navigate("/login");
        return;
      }

      try {
        const result = await api.fetchWithRefreshRetry(
          `/api/note-templates/complete/${template.id}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );

        if (!result.success) {
          if (result.status === 401) {
            navigate("/login");
          } else {
            console.error("Failed to fetch template data:", result.error);
          }
          return;
        }

        const data = await result.response.json();
        
        // Navigate to create new template with the original template data in location state
        navigate("/create-template", {
          state: { templateData: data }
        });
      } catch (error) {
        console.error("Error fetching template data:", error);
      }
    } else {
      // For custom templates, navigate to edit mode
      navigate(`/edit-template/${template.id}`);
    }
  };

  const handlePreviewClick = async (e, template) => {
    e.stopPropagation();
    setSelectedTemplate(template);
    setLoadingTemplate(true);
    setTemplateData(null);

    const jwt = api.getJWT();
    if (!jwt) {
      navigate("/login");
      return;
    }

    try {
      const result = await api.fetchWithRefreshRetry(
        `/api/note-templates/complete/${template.id}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!result.success) {
        if (result.status === 401) {
          navigate("/login");
        } else {
          console.error("Failed to fetch template data:", result.error);
        }
        return;
      }

      const data = await result.response.json();
      setTemplateData(data);
    } catch (error) {
      console.error("Error fetching template data:", error);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleCreateCopyClick = async (e, template) => {
    e.stopPropagation();
    
    const jwt = api.getJWT();
    if (!jwt) {
      navigate("/login");
      return;
    }

    try {
      const result = await api.fetchWithRefreshRetry(
        `/api/note-templates/complete/${template.id}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!result.success) {
        if (result.status === 401) {
          navigate("/login");
        } else {
          console.error("Failed to fetch template data:", result.error);
        }
        return;
      }

      const data = await result.response.json();
      
      // Navigate to create new template with the original template data in location state
      navigate("/create-template", {
        state: { templateData: data }
      });
    } catch (error) {
      console.error("Error fetching template data:", error);
    }
  };

  const closePreview = () => {
    setSelectedTemplate(null);
    setTemplateData(null);
  };

  const handleDeleteClick = async (e, template) => {
    e.stopPropagation();
    if (template.user_id === null) return;

    const jwt = api.getJWT();
    if (!jwt) {
      navigate("/login");
      return;
    }

    const ok = window.confirm(
      `Delete template "${template.name}"? This cannot be undone.`,
    );
    if (!ok) return;

    setDeletingTemplateId(template.id);
    try {
      const result = await api.fetchWithRefreshRetry(
        `/api/note-templates/${template.id}`,
        {
          method: "DELETE",
        },
      );

      if (!result.success) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        window.alert(result.error || "Failed to delete template");
        return;
      }

      if (selectedTemplate?.id === template.id) {
        closePreview();
      }
      await loadAllTemplates(
        predefinedSortBy,
        predefinedOrder,
        customSortBy,
        customOrder,
      );
    } catch (err) {
      console.error("Error deleting template:", err);
      window.alert(err.message || "Failed to delete template");
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const handleLlmExtractPdf = async (file) => {
    const jwt = api.getJWT();
    if (!jwt) {
      navigate("/login");
      return;
    }

    setLlmExtractSubmitting(true);
    setLlmExtractError("");
    try {
      const result = await api.llmExtractNoteTemplateFromPdf(file);
      if (!result.success) {
        if (result.status === 401) {
          navigate("/login");
          return;
        }
        setLlmExtractError(
          result.error || "Failed to extract template from PDF",
        );
        return;
      }

      const data = await result.response.json();
      const sections = Array.isArray(data.sections) ? data.sections : [];

      navigate("/create-template", {
        state: {
          createTemplateSource: "llm-extract",
          templateData: {
            template: { name: "AI Generated Template" },
            sections,
          },
        },
      });
    } catch (err) {
      setLlmExtractError(
        err.message || "Failed to extract template from PDF",
      );
    } finally {
      setLlmExtractSubmitting(false);
    }
  };

  const getOwnerLabel = (template) => {
    return template.user_id === null ? "Standard" : "Custom";
  };

  const getSectionNamesPreview = (sections) => {
    if (!sections || sections.length === 0) {
      return "No sections";
    }

    const sectionNames = sections.map((s) => s.name);
    const maxDisplay = 8;

    if (sectionNames.length <= maxDisplay) {
      return sectionNames.join(", ");
    }

    return sectionNames.slice(0, maxDisplay).join(", ") + " ...";
  };

  const TemplateCard = ({ template, isHovered }) => {
    return (
      <div
        className="template-card"
        key={template.id}
        onMouseEnter={() => setHoveredTemplateId(template.id)}
        onMouseLeave={() => setHoveredTemplateId(null)}
        style={{
          background: "#fff",
          borderRadius: "12px",
          boxShadow: isHovered ? "0 4px 16px rgba(0,0,0,0.16)" : "0 2px 8px rgba(0,0,0,0.08)",
          padding: "20px 20px 12px 20px",
          minWidth: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          transition: "box-shadow 0.2s, transform 0.2s",
          cursor: "pointer",
          border: "1px solid #e5e7eb",
          transform: isHovered ? "translateY(-4px) scale(1.02)" : "none",
        }}
        onClick={() => handleCardClick(template)}
      >
        <div
          className="template-title"
          style={{
            fontWeight: "bold",
            marginBottom: "6px",
            fontSize: "1rem",
            wordBreak: "break-word",
          }}
        >
          {template.name}
        </div>

        <div
          className="owner-badge"
          style={{
            display: "inline-block",
            padding: "4px 10px",
            borderRadius: "4px",
            fontSize: "0.75rem",
            fontWeight: "500",
            marginBottom: "12px",
            width: "fit-content",
            backgroundColor: template.user_id === null ? "#d1fae5" : "#dbeafe",
            color: template.user_id === null ? "#065f46" : "#0c4a6e",
          }}
        >
          {getOwnerLabel(template)}
        </div>

        <div
          className="section-names"
          style={{
            color: "#666",
            fontSize: "0.9rem",
            marginBottom: "6px",
            lineHeight: "1.4",
            minHeight: "2rem",
            display: "flex",
            alignItems: "center",
            flex: 1,
          }}
        >
          {getSectionNamesPreview(template.sections || [])}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <button
            onClick={(e) => handlePreviewClick(e, template)}
            style={{
              padding: "8px 12px",
              color: "#9ca3af",
              cursor: "pointer",
              borderRadius: "6px",
              border: "none",
              background: "transparent",
              transition: "color 0.2s, background-color 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.target.style.color = "#4b5563";
              e.target.style.backgroundColor = "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.target.style.color = "#9ca3af";
              e.target.style.backgroundColor = "transparent";
            }}
            title="Preview template"
            aria-label="Preview template"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path
                fillRule="evenodd"
                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {template.user_id !== null && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/edit-template/${template.id}`);
              }}
              style={{
                padding: "8px 12px",
                color: "#9ca3af",
                cursor: "pointer",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                transition: "color 0.2s, background-color 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                e.target.style.color = "#4b5563";
                e.target.style.backgroundColor = "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                e.target.style.color = "#9ca3af";
                e.target.style.backgroundColor = "transparent";
              }}
              title="Edit template"
              aria-label="Edit template"
            >
              <IconEdit className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={(e) => handleCreateCopyClick(e, template)}
            style={{
              padding: "8px 12px",
              color: "#9ca3af",
              cursor: "pointer",
              borderRadius: "6px",
              border: "none",
              background: "transparent",
              transition: "color 0.2s, background-color 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
            }}
            onMouseEnter={(e) => {
              e.target.style.color = "#4b5563";
              e.target.style.backgroundColor = "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.target.style.color = "#9ca3af";
              e.target.style.backgroundColor = "transparent";
            }}
            title="Create a new copy of this template"
            aria-label="Create a new copy of this template"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          {template.user_id !== null && (
            <button
              type="button"
              onClick={(e) => handleDeleteClick(e, template)}
              disabled={deletingTemplateId === template.id}
              style={{
                padding: "8px 12px",
                color: "#9ca3af",
                cursor: deletingTemplateId === template.id ? "not-allowed" : "pointer",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                transition: "color 0.2s, background-color 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: deletingTemplateId === template.id ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (deletingTemplateId === template.id) return;
                e.currentTarget.style.color = "#b91c1c";
                e.currentTarget.style.backgroundColor = "#fef2f2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#9ca3af";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              title="Delete template"
              aria-label="Delete template"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Auth />
      <div className="max-w-8xl mx-auto p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold flex flex-wrap items-center gap-3">
            <span>View Templates</span>
            <PageHeaderCountBadge
              count={predefinedTemplates.length + customTemplates.length}
            />
          </h1>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => navigate("/create-template")}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors whitespace-nowrap"
            >
              + New template
            </button>
            <button
              type="button"
              onClick={() => {
                setLlmExtractError("");
                setLlmExtractOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              📁 AI Generate Template
            </button>
          </div>
        </div>

        {loading && activeTab === "predefined" && predefinedTemplates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p>Loading templates...</p>
          </div>
        ) : (
          <>
            {/* Tabs for Predefined / Custom Templates */}
            <div
              className="tabs"
              style={{
                display: "flex",
                borderBottom: "2px solid #e0e0e0",
                marginBottom: "20px",
                backgroundColor: "#f8f9fa",
              }}
            >
              <button
                className={`tab-btn${activeTab === "predefined" ? " active" : ""}`}
                onClick={() => setActiveTab("predefined")}
                style={{
                  flex: 1,
                  padding: "12px 20px",
                  border: "none",
                  backgroundColor:
                    activeTab === "predefined" ? "#007bff" : "transparent",
                  color: activeTab === "predefined" ? "white" : "#495057",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  borderBottom:
                    activeTab === "predefined"
                      ? "3px solid #0056b3"
                      : "3px solid transparent",
                  transition: "all 0.3s ease",
                }}
              >
                📋 Standard ({predefinedTemplates.length})
              </button>
              <button
                className={`tab-btn${activeTab === "custom" ? " active" : ""}`}
                onClick={() => setActiveTab("custom")}
                style={{
                  flex: 1,
                  padding: "12px 20px",
                  border: "none",
                  backgroundColor:
                    activeTab === "custom" ? "#007bff" : "transparent",
                  color: activeTab === "custom" ? "white" : "#495057",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  borderBottom:
                    activeTab === "custom"
                      ? "3px solid #0056b3"
                      : "3px solid transparent",
                  transition: "all 0.3s ease",
                }}
              >
                📋 Custom ({customTemplates.length})
              </button>
            </div>
          </>
        )}

        {/* Predefined templates tab content */}
        {!loading && activeTab === "predefined" && (
          <div className="tab-content" style={{ display: "block" }}>
            {/* Sorting toolbar */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <label style={{ fontSize: "14px", fontWeight: "500" }}>Sort by:</label>
              <Select
                size="sm"
                value={predefinedSortBy}
                onChange={(e) => handlePredefinedSortChange(e.target.value)}
              >
                <option value="name">A-Z</option>
                <option value="created_at">Date Created</option>
                <option value="updated_at">Date Updated</option>
              </Select>
              <button
                onClick={handlePredefinedOrderToggle}
                style={{
                  padding: "6px 12px",
                  borderRadius: "4px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#f3f4f6",
                  fontSize: "14px",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                {predefinedOrder === "asc" ? "↑ Asc" : "↓ Desc"}
              </button>
            </div>

            {predefinedTemplates.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                <p>No predefined templates available</p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "20px",
                }}
              >
                {predefinedTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isHovered={hoveredTemplateId === template.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Custom templates tab content */}
        {!loading && activeTab === "custom" && (
          <div className="tab-content" style={{ display: "block" }}>
            {/* Sorting toolbar */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <label style={{ fontSize: "14px", fontWeight: "500" }}>Sort by:</label>
              <Select
                size="sm"
                value={customSortBy}
                onChange={(e) => handleCustomSortChange(e.target.value)}
              >
                <option value="name">A-Z</option>
                <option value="created_at">Date Created</option>
                <option value="updated_at">Date Updated</option>
              </Select>
              <button
                onClick={handleCustomOrderToggle}
                style={{
                  padding: "6px 12px",
                  borderRadius: "4px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#f3f4f6",
                  fontSize: "14px",
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                {customOrder === "asc" ? "↑ Asc" : "↓ Desc"}
              </button>
            </div>

            {customTemplates.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                <p>No custom templates created yet</p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "20px",
                }}
              >
                {customTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isHovered={hoveredTemplateId === template.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTemplate && (
        <TemplatePreviewOverlay
          template={selectedTemplate}
          templateData={templateData}
          loading={loadingTemplate}
          onClose={closePreview}
        />
      )}

      <LlmExtractNoteTemplateOverlay
        isOpen={llmExtractOpen}
        onClose={() => {
          setLlmExtractError("");
          setLlmExtractOpen(false);
        }}
        onConfirm={handleLlmExtractPdf}
        isSubmitting={llmExtractSubmitting}
        serverError={llmExtractError}
        onDismissServerError={() => setLlmExtractError("")}
        title="AI Generate Template"
      />
    </>
  );
}
