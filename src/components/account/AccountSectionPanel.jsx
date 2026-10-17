import React from "react";

/** White content card used on every account subpage. */
export default function AccountSectionPanel({
  title,
  titleAddon = null,
  description,
  children,
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="mb-6 border-b border-gray-100 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {titleAddon}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
