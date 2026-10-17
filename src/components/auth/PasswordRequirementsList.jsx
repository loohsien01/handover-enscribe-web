import React from "react";

export default function PasswordRequirementsList({ requirements }) {
  if (!requirements?.length) return null;

  return (
    <ul className="space-y-1 pt-0.5" aria-live="polite">
      {requirements.map((req) => (
        <li
          key={req.id}
          className={`flex items-start gap-2 text-xs leading-relaxed ${
            req.met ? "text-green-700" : "text-slate-400"
          }`}
        >
          <span className="w-3.5 shrink-0 text-center" aria-hidden="true">
            {req.met ? "✓" : "○"}
          </span>
          {req.label}
        </li>
      ))}
    </ul>
  );
}
