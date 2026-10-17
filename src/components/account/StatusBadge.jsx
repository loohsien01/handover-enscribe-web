import React from "react";

export default function StatusBadge({ tone = "neutral", children }) {
  const tones = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    neutral: "border-gray-200 bg-gray-50 text-gray-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${tones[tone] || tones.neutral}`}
    >
      {children}
    </span>
  );
}
