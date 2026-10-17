import React from 'react';

export default function VisitPrepExplainerStepCard({
  stepLabel,
  optionalTag = false,
  title,
  description,
  icon,
}) {
  return (
    <li className="flex min-w-0 rounded-lg border border-[#183278]/10 bg-white/90 px-3.5 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#E8EEFB] text-[#183278]">
          {icon}
        </div>
        <div className="min-w-0 pt-0.5">
          {stepLabel ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#3166F7]">
                {stepLabel}
              </p>
              {optionalTag ? (
                <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-gray-400">
                  Optional
                </span>
              ) : null}
            </div>
          ) : null}
          <p className={`text-sm font-semibold text-gray-900 ${stepLabel ? 'mt-0.5' : ''}`}>
            {title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">{description}</p>
        </div>
      </div>
    </li>
  );
}
