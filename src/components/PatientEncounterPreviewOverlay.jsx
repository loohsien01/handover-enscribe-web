import { useState } from "react";

export default function PatientEncounterPreviewOverlay({
  isOpen,
  onClose,
  noteText,
  soapSubjective,
  soapObjective,
  soapAssessment,
  soapPlan,
  patientEncounterName,
  setPatientEncounterName,
  onSave,
  isSaving,
  errorMessage,
  sections = ["note"],
  isPatientEncounterNameEditable = true,
  mode = "save",
}) {
  const [previewSection, setPreviewSection] = useState(sections[0]);

  const allMenuSections = [
    { key: "soapNote", label: "SOAP Note" },
    { key: "note", label: "Note" },
  ];
  const menuSections = allMenuSections.filter((s) => sections.includes(s.key));

  const initialReviewed = Object.fromEntries(
    menuSections.map((s) => [s.key, false]),
  );
  const [reviewedSections, setReviewedSections] = useState(initialReviewed);

  const handlePreviewNext = () => {
    if (mode === "save") {
      onSave();
      return;
    }

    setReviewedSections((prev) => ({
      ...prev,
      [previewSection]: true,
    }));

    const idx = menuSections.findIndex((s) => s.key === previewSection);
    if (idx < menuSections.length - 1) {
      setPreviewSection(menuSections[idx + 1].key);
    } else {
      onSave();
    }
  };

  const getNextButtonText = () => {
    if (mode === "save") {
      return "Save";
    }

    const idx = menuSections.findIndex((s) => s.key === previewSection);
    if (idx < menuSections.length - 1) {
      return `Next: ${menuSections[idx + 1].label}`;
    }
    return "Save";
  };

  const handleClose = () => {
    setPreviewSection(menuSections[0]?.key || "note");
    setReviewedSections(initialReviewed);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black opacity-50"
        style={{ cursor: "pointer" }}
        onClick={handleClose}
      />

      <div
        className="relative bg-white rounded-lg h-[85vh] flex flex-col"
        style={{
          width: "97vw",
          maxWidth: "2000px",
          marginTop: "7rem",
          marginBottom: "5rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6">
          <h2 className="text-2xl font-bold">Review Changes:</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-5xl"
          >
            ×
          </button>
        </div>

        <div className="overflow-x-auto whitespace-nowrap px-0.5 pt-2 border-b border-gray-400">
          <div className="flex w-full">
            {menuSections.map((section) => (
              <button
                key={section.key}
                onClick={() => setPreviewSection(section.key)}
                className={`flex-1 min-w-50 px-6 py-3 text-center font-medium transition-colors
          border border-gray-400 rounded-t-2xl
          ${
            previewSection === section.key
              ? "bg-white text-blue-700 border-b-white"
              : "bg-gray-50 text-gray-700 hover:bg-gray-100"
          }
          ${reviewedSections[section.key] ? "font-semibold" : ""}
        `}
                style={{
                  marginBottom: "-1px",
                  zIndex: previewSection === section.key ? 10 : 1,
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  {section.label}
                  {reviewedSections[section.key] && (
                    <span className="text-green-500">✓</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col lg:flex-row h-0 min-h-0">
          <div className="flex-1 p-6  h-full overflow-y-auto min-w-0">
            <div className="h-full">
              {previewSection === "soapNote" &&
                sections.includes("soapNote") && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subjective
                      </label>
                      <pre
                        className="w-full whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 border text-gray-800"
                        style={{ minHeight: "4rem", fontFamily: "sans-serif" }}
                      >
                        {soapSubjective}
                      </pre>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Objective
                      </label>
                      <pre
                        className="w-full whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 border text-gray-800"
                        style={{ minHeight: "4rem", fontFamily: "sans-serif" }}
                      >
                        {soapObjective}
                      </pre>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assessment
                      </label>
                      <pre
                        className="w-full whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 border text-gray-800"
                        style={{ minHeight: "4rem", fontFamily: "sans-serif" }}
                      >
                        {soapAssessment}
                      </pre>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Plan
                      </label>
                      <pre
                        className="w-full whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 border text-gray-800 mb-10"
                        style={{ minHeight: "4rem", fontFamily: "sans-serif" }}
                      >
                        {soapPlan}
                      </pre>
                    </div>
                  </div>
                )}
              {previewSection === "note" && sections.includes("note") && (
                <pre
                  className="w-full whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 border text-gray-800 mb-10"
                  style={{ minHeight: "10rem", fontFamily: "sans-serif" }}
                >
                  {noteText}
                </pre>
              )}

              <div className="h-0.5" />
            </div>
          </div>

          <div className="w-full lg:w-80 p-6 flex flex-col bg-gray-50 border-l border-black">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient Encounter Name
              </label>
              <input
                type="text"
                value={patientEncounterName}
                onChange={(e) => setPatientEncounterName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter patient encounter name"
                disabled={isSaving || !isPatientEncounterNameEditable}
              />
            </div>

            <div className="flex-1 flex flex-col justify-end">
              <button
                onClick={handlePreviewNext}
                disabled={isSaving}
                className={`w-full px-6 py-3 rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white ${
                  isSaving ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isSaving ? "Saving..." : getNextButtonText()}
              </button>

              {errorMessage && (
                <div className="mt-3 text-red-600 text-sm">{errorMessage}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
