import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as api from "@/lib/api";
import Auth from "@/components/Auth.jsx";
import { useEntitlements } from "@/context/EntitlementsContext.jsx";
import { planDisplayLabelFromEntitlements } from "@/utils/entitlementsUi.js";

const POLL_ATTEMPTS = 40;
const POLL_INTERVAL_MS = 2000;

function formatSessionIdForDisplay(id) {
  if (!id || typeof id !== "string") return null;
  if (id.length <= 28) return id;
  return `${id.slice(0, 14)}…${id.slice(-10)}`;
}

export default function BillingSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const sessionIdDisplay = formatSessionIdForDisplay(sessionId);

  const { refetch } = useEntitlements();
  const [phase, setPhase] = useState("verifying");
  const [errorMsg, setErrorMsg] = useState(null);
  const [pollKey, setPollKey] = useState(0);
  const [successEntitlements, setSuccessEntitlements] = useState(null);

  useEffect(() => {
    if (!api.getJWT()) {
      navigate("/login");
      return;
    }

    let cancelled = false;
    setPhase("verifying");
    setErrorMsg(null);
    setSuccessEntitlements(null);

    (async () => {
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        if (cancelled) return;
        const res = await api.getBillingStatus();
        if (cancelled) return;

        if (res.success && res.entitlements?.has_pro_plan === true) {
          setSuccessEntitlements(res.entitlements);
          setPhase("success");
          void refetch();
          return;
        }

        if (!res.success && res.status === 404) {
          setPhase("error");
          setErrorMsg(
            res.error ||
              "We could not load your billing profile. Make sure your account setup is complete.",
          );
          return;
        }

        if (!res.success && res.status === 401) {
          navigate("/login");
          return;
        }

        if (i < POLL_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          if (cancelled) return;
        }
      }

      if (!cancelled) {
        setPhase("delayed");
        void refetch();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, refetch, pollKey]);

  const onCheckAgain = () => {
    setPollKey((k) => k + 1);
  };

  const successPlanLabel = planDisplayLabelFromEntitlements(successEntitlements);

  return (
    <>
      <Auth />
      <div className="max-w-lg mx-auto p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>

        {sessionIdDisplay && (
          <p className="mt-2 text-xs text-gray-500 font-mono break-all">
            Checkout session: {sessionIdDisplay}
          </p>
        )}

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {phase === "verifying" && (
            <div className="text-center">
              <div
                className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#183278] border-t-transparent"
                aria-hidden
              />
              <p className="mt-4 text-base font-medium text-gray-900">
                Confirming your subscription…
              </p>
              {/* <p className="mt-2 text-sm text-gray-600">
                Waiting for your EnScribe account to show an active Pro
                subscription in our systems (after Stripe notifies us). This is
                separate from the redirect—you are on the right page.
              </p> */}
            </div>
          )}

          {phase === "success" && (
            <div className="text-center">
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700 text-2xl"
                aria-hidden
              >
                ✓
              </div>
              <p className="mt-4 text-lg font-semibold text-gray-900">
                {successPlanLabel} Plan Active
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Your {successPlanLabel} plan subscription is active. Check out your new plan features.
              </p>
              <button
                type="button"
                onClick={() => navigate("/view-notes")}
                className="mt-6 w-full rounded-xl bg-[#183278] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#142a5e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9DF9] focus-visible:ring-offset-2"
              >
                View notes
              </button>
            </div>
          )}

          {phase === "delayed" && (
            <div className="text-center">
              <p className="text-base font-medium text-gray-900">
                Awaiting sync
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Waiting for payment sync between Stripe and EnScribe.
                (5 - 10s, but sometimes longer due to network issues).
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onCheckAgain}
                  className="flex-1 rounded-xl border-2 border-[#183278] bg-white px-4 py-3 text-sm font-semibold text-[#183278] transition hover:bg-[#E8EEFB]"
                >
                  Check again
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/view-notes")}
                  className="flex-1 rounded-xl bg-[#183278] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#142a5e]"
                >
                  View notes
                </button>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="text-center">
              <p className="text-base font-medium text-red-800">
                Something went wrong
              </p>
              <p className="mt-2 text-sm text-red-700/90">{errorMsg}</p>
              <button
                type="button"
                onClick={() => navigate("/view-notes")}
                className="mt-6 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                View notes
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
