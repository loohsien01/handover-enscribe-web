import React from 'react';

/** Left inset shared by step hints and field labels below them. */
export const visitPrepStepFieldInsetClass = 'pl-3';

/**
 * Subtle step-level explainer for visit prep forms (icon + muted copy).
 */
export default function VisitPrepStepHint({ icon, children }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-md border border-[#183278]/10 bg-[#E8EEFB]/30 py-2.5 ${visitPrepStepFieldInsetClass}`}
    >
      <span
        aria-hidden
        className="mt-px flex h-5 w-5 shrink-0 items-center justify-center text-[#183278] [&_svg]:h-[18px] [&_svg]:w-[18px]"
      >
        {icon}
      </span>
      <p className="min-w-0 flex-1 pt-px text-sm leading-snug text-gray-600">{children}</p>
    </div>
  );
}
