import React from "react";
import { Link } from "react-router-dom";
import AccountSectionPanel from "@/components/account/AccountSectionPanel.jsx";
import StatusBadge from "@/components/account/StatusBadge.jsx";
import { useEntitlements } from "@/context/EntitlementsContext.jsx";
import { planDisplayLabelFromEntitlements } from "@/utils/entitlementsUi.js";

function formatPeriodEnd(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function AccountBillingPage() {
  const { planTier, status: entitlementsStatus, organization, entitlements } =
    useEntitlements();

  const tierReady = entitlementsStatus === "ready";
  const planLabel = tierReady
    ? planDisplayLabelFromEntitlements(entitlements)
    : null;
  const cancelScheduled = Boolean(organization?.cancel_at_period_end);
  const periodEndLabel = formatPeriodEnd(organization?.current_period_end);

  return (
    <AccountSectionPanel
      title="Plan & billing"
      description="Your subscription and plan details."
    >
      {!tierReady && (
        <p className="text-sm text-gray-600" role="status">
          Loading plan…
        </p>
      )}

      {tierReady && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-700">
              Current plan:{" "}
              <span className="font-semibold text-gray-900">{planLabel}</span>
            </p>
            <StatusBadge tone={planTier === "pro" ? "success" : "neutral"}>
              {planTier === "pro" ? "Pro" : "Free"}
            </StatusBadge>
          </div>

          {planTier === "pro" && cancelScheduled && periodEndLabel && (
            <p className="text-sm text-amber-950">
              Downgrade to Free scheduled for {periodEndLabel}.
            </p>
          )}

          <Link
            to="/billing/plans"
            className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9DF9] focus-visible:ring-offset-2"
          >
            Manage plan
          </Link>
        </div>
      )}
    </AccountSectionPanel>
  );
}
