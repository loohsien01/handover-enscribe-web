import React from "react";
import { Link } from "react-router-dom";
import AccountSectionPanel from "@/components/account/AccountSectionPanel.jsx";
import StatusBadge from "@/components/account/StatusBadge.jsx";

function formatTimestamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AccountLegalPage({ baaStatus, baaLoading, baaError }) {
  const needsBaaAcceptance = baaStatus?.needs_acceptance === true;
  const baaAccepted = baaStatus?.acceptance;
  const baaAcceptedLabel = formatTimestamp(baaAccepted?.accepted_at);

  return (
    <AccountSectionPanel
      title="Legal & compliance"
      description="Agreements and policies for your organization."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              Business Associate Addendum
            </p>
            {baaLoading && (
              <p className="mt-1 text-sm text-gray-600">Loading status…</p>
            )}
            {!baaLoading && baaError && (
              <p className="mt-1 text-sm text-red-700">{baaError}</p>
            )}
            {!baaLoading && !baaError && needsBaaAcceptance && (
              <p className="mt-1 text-sm text-amber-950">
                {baaStatus?.can_accept
                  ? "A new BAA must be accepted before HIPAA features are available."
                  : "Contact your organization owner to complete BAA acceptance."}
              </p>
            )}
            {!baaLoading && !baaError && !needsBaaAcceptance && baaAccepted && (
              <p className="mt-1 text-sm text-gray-600">
                Version {baaAccepted.version_number}
                {baaAcceptedLabel ? ` · Accepted ${baaAcceptedLabel}` : ""}
              </p>
            )}
            {!baaLoading && !baaError && !needsBaaAcceptance && !baaAccepted && (
              <p className="mt-1 text-sm text-gray-600">No active BAA on file.</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!baaLoading && !baaError && (
              <StatusBadge
                tone={
                  needsBaaAcceptance
                    ? "warning"
                    : baaAccepted
                      ? "success"
                      : "neutral"
                }
              >
                {needsBaaAcceptance
                  ? "Action needed"
                  : baaAccepted
                    ? "Accepted"
                    : "Not signed"}
              </StatusBadge>
            )}
            <Link
              to="/baa"
              className="inline-flex rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9DF9] focus-visible:ring-offset-2"
            >
              {needsBaaAcceptance && baaStatus?.can_accept
                ? "Review & accept"
                : "View BAA"}
            </Link>
          </div>
        </div>

        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          <li>
            <Link
              to="/privacy-policy"
              className="flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
            >
              Privacy Policy
              <span className="text-gray-400" aria-hidden>
                →
              </span>
            </Link>
          </li>
          <li>
            <Link
              to="/compliance-audit"
              className="flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
            >
              Compliance audit
              <span className="text-gray-400" aria-hidden>
                →
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </AccountSectionPanel>
  );
}
