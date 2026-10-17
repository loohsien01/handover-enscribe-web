import React from "react";

/** Full-width form select — extra right padding for the custom chevron. */
export const SELECT_CLASSNAME =
  "h-auto w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-10 text-sm text-gray-900 shadow-sm transition focus:border-[#7C9DF9] focus:outline-none focus:ring-2 focus:ring-[#7C9DF9]/30 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";

/** Compact toolbar / sort dropdown. */
export const SELECT_COMPACT_CLASSNAME =
  "h-auto w-auto min-w-[8rem] appearance-none rounded border border-gray-300 bg-white py-1 pl-2 pr-8 text-sm text-gray-900 transition focus:border-[#7C9DF9] focus:outline-none focus:ring-2 focus:ring-[#7C9DF9]/30 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";

/** Borderless inline select (e.g. Nova model picker). */
export const SELECT_INLINE_CLASSNAME =
  "h-6 w-auto appearance-none border-0 bg-transparent py-0 pl-0 pr-6 text-sm font-medium leading-none text-gray-800 transition hover:text-[#183278] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183278]/25 disabled:cursor-not-allowed disabled:opacity-50";

const SIZE_CONFIG = {
  md: {
    select: SELECT_CLASSNAME,
    chevronRight: "right-3",
    chevronSize: "h-4 w-4",
  },
  sm: {
    select: SELECT_COMPACT_CLASSNAME,
    chevronRight: "right-2",
    chevronSize: "h-3.5 w-3.5",
  },
  inline: {
    select: SELECT_INLINE_CLASSNAME,
    chevronRight: "right-0",
    chevronSize: "h-2.5 w-2.5",
  },
};

function IconChevronDown({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

/**
 * Native `<select>` with consistent chevron spacing (browser default chevrons sit on the border).
 * @param {"md"|"sm"|"inline"} [size="md"]
 */
const Select = React.forwardRef(function Select(
  {
    className = "",
    wrapperClassName = "",
    disabled = false,
    size = "md",
    ...props
  },
  ref,
) {
  const config = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;

  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <select
        ref={ref}
        disabled={disabled}
        className={`${config.select} ${className}`.trim()}
        {...props}
      />
      <span
        className={`pointer-events-none absolute inset-y-0 flex items-center ${config.chevronRight} ${
          disabled ? "text-gray-400" : "text-gray-500"
        }`}
        aria-hidden
      >
        <IconChevronDown className={config.chevronSize} />
      </span>
    </div>
  );
});

export default Select;
