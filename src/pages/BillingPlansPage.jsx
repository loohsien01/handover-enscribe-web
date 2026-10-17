import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";
import Auth from "@/components/Auth.jsx";
import { useEntitlements } from "@/context/EntitlementsContext.jsx";
import { planDisplayLabelFromEntitlements } from "@/utils/entitlementsUi.js";

const PLANS = [
  {
    key: "free",
    name: "Free",
    priceLine: "$0",
    detail: "Core documentation workflows for your practice.",
    bullets: ["Patient encounters and notes", "Templates and dot phrases"],
  },
  {
    key: "pro",
    name: "Pro",
    priceLine: "Monthly subscription",
    detail: "Full access to paid capabilities on your personal organization.",
    bullets: ["Everything in Free", "Stripe-managed subscription and renewals"],
  },
];

function formatPeriodEnd(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

const PLAN_GRID_MD_COLS =
  PLANS.length >= 4 ? "md:grid-cols-4" : PLANS.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

function PlansContent() {
  const navigate = useNavigate();
  const { planTier, status, refetch, organization, entitlements } = useEntitlements();
  const [checkoutError, setCheckoutError] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [downgradeError, setDowngradeError] = useState(null);
  const [downgradeLoading, setDowngradeLoading] = useState(false);
  const [resumeError, setResumeError] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  /** Filled from POST response until GET /me/entitlements includes `organization` (e.g. older API). */
  const [downgradeSuccess, setDowngradeSuccess] = useState(null);
  /** Fallback when GET /me/entitlements omits billing fields; same org snapshot as billing tools. */
  const [billingOrgSnapshot, setBillingOrgSnapshot] = useState(null);

  useEffect(() => {
    if (!api.getJWT()) {
      navigate("/login");
    }
  }, [navigate]);

  const onUpgradePro = async () => {
    setCheckoutError(null);
    setCheckoutLoading(true);
    const result = await api.createBillingCheckoutSession("pro");
    setCheckoutLoading(false);
    if (!result.success) {
      if (result.status === 401) {
        navigate("/login");
        return;
      }
      setCheckoutError(result.error || "Could not start checkout.");
      return;
    }
    window.location.assign(result.url);
  };

  const onScheduleDowngrade = async () => {
    setDowngradeError(null);
    setResumeError(null);
    setDowngradeLoading(true);
    const result = await api.postBillingScheduleCancel();
    setDowngradeLoading(false);
    if (!result.success) {
      if (result.status === 401) {
        navigate("/login");
        return;
      }
      setDowngradeError(result.error || "Could not schedule cancellation.");
      setDowngradeSuccess(null);
      return;
    }
    const endLabel = formatPeriodEnd(result.current_period_end);
    setDowngradeSuccess({
      cancelAtPeriodEnd: result.cancel_at_period_end,
      periodEndLabel: endLabel,
    });
    await refetch();
    const snap = await api.getBillingStatus();
    if (snap.success) setBillingOrgSnapshot(snap.organization);
  };

  const onResumeSubscription = async () => {
    setResumeError(null);
    setResumeLoading(true);
    const result = await api.postBillingUnscheduleCancel();
    setResumeLoading(false);
    if (!result.success) {
      if (result.status === 401) {
        navigate("/login");
        return;
      }
      setResumeError(result.error || "Could not resume subscription.");
      return;
    }
    setDowngradeSuccess(null);
    await refetch();
    const snap = await api.getBillingStatus();
    if (snap.success) setBillingOrgSnapshot(snap.organization);
  };

  const tierReady = status === "ready" && planTier != null;

  useEffect(() => {
    if (!tierReady || planTier !== "pro") {
      setBillingOrgSnapshot(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await api.getBillingStatus();
      if (cancelled || !r.success) return;
      setBillingOrgSnapshot(r.organization);
    })();
    return () => {
      cancelled = true;
    };
  }, [tierReady, planTier]);

  const cancelFromOrg =
    Boolean(organization?.cancel_at_period_end) ||
    Boolean(billingOrgSnapshot?.cancel_at_period_end);
  const cancelScheduled =
    cancelFromOrg || Boolean(downgradeSuccess?.cancelAtPeriodEnd);
  const periodEndLabel =
    formatPeriodEnd(organization?.current_period_end) ??
    formatPeriodEnd(billingOrgSnapshot?.current_period_end) ??
    downgradeSuccess?.periodEndLabel ??
    null;

  const planResumeLabel = tierReady
    ? planDisplayLabelFromEntitlements(entitlements)
    : "your plan";

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plans & Pricing</h1>
          {/* <p className="mt-2 text-gray-600 max-w-xl">
            Compare tiers for your account.
          </p> */}
        </div>
        {/* <button
          type="button"
          onClick={() => navigate("/view-notes")}
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          View notes
        </button> */}
      </div>

      {tierReady && (
        <p className="mb-6 text-sm font-medium text-[#183278]">
          Current plan:{" "}
          <span className="uppercase tracking-wide">
            {planTier === "pro" ? "Pro" : "Free"}
          </span>
        </p>
      )}

      {(checkoutError || downgradeError || resumeError) && (
        <div
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {checkoutError && <p>{checkoutError}</p>}
          {downgradeError && <p className={checkoutError ? "mt-1" : ""}>{downgradeError}</p>}
          {resumeError && (
            <p
              className={
                checkoutError || downgradeError ? "mt-1" : ""
              }
            >
              {resumeError}
            </p>
          )}
        </div>
      )}

      {tierReady && planTier === "pro" && cancelScheduled && (
        <div
          className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p className="min-w-0 text-sm text-amber-950">
            You have scheduled a downgrade to the Free Plan at the end of this billing period ({periodEndLabel}).
            
          </p>
          <button
            type="button"
            disabled={resumeLoading}
            onClick={() => void onResumeSubscription()}
            className="shrink-0 rounded-lg border border-amber-800/25 bg-white px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resumeLoading ? "Working…" : `Resume ${planResumeLabel}`}
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-6 ${PLAN_GRID_MD_COLS}`}>
          {PLANS.map((plan) => {
            const isCurrent = tierReady && plan.key === planTier;
            const isPro = plan.key === "pro";

            return (
              <div
                key={plan.key}
                className={`flex min-h-0 flex-1 flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  isCurrent
                    ? "border-[#183278] ring-2 ring-[#183278]/20"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {plan.name}
                  </h2>
                  {isCurrent && (
                    <span className="shrink-0 rounded-full bg-[#E8EEFB] px-2.5 py-0.5 text-xs font-semibold text-[#183278]">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-lg font-medium text-gray-800">
                  {plan.priceLine}
                </p>
                <p className="mt-3 text-sm text-gray-600">{plan.detail}</p>
                <ul className="mt-4 flex-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {plan.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>

                <div className="mt-6">
                  {!isPro && (
                    <div className="space-y-3">
                      {!tierReady ? (
                        <p className="text-sm text-gray-500">Loading plan…</p>
                      ) : isCurrent ? (
                        <button
                          type="button"
                          disabled
                          className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-500 cursor-not-allowed"
                        >
                          Current plan
                        </button>
                      ) : (
                        <>
                          <p className="rounded-lg border border-[#E8EEFB] bg-[#F4F7FD] px-3 py-2 text-sm text-gray-700">
                            Downgrade to Free Plan at the end of this billing period. Your Pro Plan stays
                            active until {periodEndLabel}.
                          </p>
                          <button
                            type="button"
                            disabled={downgradeLoading || cancelScheduled}
                            onClick={() => void onScheduleDowngrade()}
                            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-[#183278] shadow-sm transition hover:bg-[#E8EEFB] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9DF9] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {downgradeLoading
                              ? "Working…"
                              : cancelScheduled
                                ? "Downgrade scheduled"
                                : "Downgrade to Free"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {isPro &&
                    (isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-500 cursor-not-allowed"
                      >
                        Current plan
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={checkoutLoading || !tierReady}
                        onClick={() => void onUpgradePro()}
                        className="w-full rounded-xl bg-[#183278] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#142a5e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9DF9] focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none"
                      >
                        {checkoutLoading ? "Redirecting…" : "Upgrade to Pro"}
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default function BillingPlansPage() {
  return (
    <>
      <Auth />
      <PlansContent />
    </>
  );
}
