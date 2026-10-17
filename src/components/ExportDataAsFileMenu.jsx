import React, { useState } from "react";
import { exportDataAsFile } from "@/utils/export.js";

export default function ExportDataAsFileMenu({
  patientEncounterData,
  notes: notesPlainText = [],
  /** When true, root and trigger stretch to the full height of a flex row sibling (e.g. multi-line title). */
  fillRowHeight = false,
}) {
  const [show, setShow] = useState(false);
  const handleExport = async (type) => {
    const exportObj = {
      patientEncounterName: patientEncounterData?.name || "",
      notes: Array.isArray(notesPlainText) ? notesPlainText : [],
    };
    await exportDataAsFile(exportObj, type);
    setShow(false);
  };

  return (
    <div
      className={
        fillRowHeight
          ? "relative flex h-full min-h-0 flex-col items-end text-left"
          : "relative inline-block text-left"
      }
    >
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-expanded={show}
        aria-haspopup="menu"
        className={`items-center justify-center gap-2 rounded-lg border border-[#2751C4]/25 bg-[#183278] px-4 py-2.5 text-sm font-semibold leading-normal text-white shadow-sm transition-colors hover:bg-[#14285F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3166F7] focus-visible:ring-offset-2 ${
          fillRowHeight
            ? "flex h-full w-auto shrink-0"
            : "inline-flex"
        }`}
      >
        Export as…
      </button>
      {show && (
        <div
          className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/80"
          role="menu"
          onClick={() => setShow(false)}
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
            onClick={() => handleExport("word")}
          >
            Word document
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
            onClick={() => handleExport("pdf")}
          >
            PDF
          </button>
        </div>
      )}
    </div>
  );
}
