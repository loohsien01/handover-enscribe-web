import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Auth from "@/components/Auth.jsx";
import NovaMarkdown from "@/components/NovaMarkdown.jsx";
import { BAA_ACCEPTANCE_CHECKBOX_LABEL } from "@/constants/baaAgreement.js";
import * as api from "@/lib/api";

function formatTimestamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function BaaPageContent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [baa, setBaa] = useState(null);
  const [baaStatus, setBaaStatus] = useState(null);
  const [checked, setChecked] = useState(false);
  const [acceptError, setAcceptError] = useState(null);
  const [versionNotice, setVersionNotice] = useState(null);
  const [accepting, setAccepting] = useState(false);

  const loadBaa = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    const [activeResult, statusResult] = await Promise.all([
      api.getActiveBaa(),
      api.getBaaStatus(),
    ]);
    setLoading(false);

    if (!activeResult.success) {
      if (activeResult.status === 401) {
        navigate("/login");
        return;
      }
      setLoadError(activeResult.error || "Could not load the Business Associate Addendum.");
      return;
    }

    if (!statusResult.success) {
      if (statusResult.status === 401) {
        navigate("/login");
        return;
      }
      setLoadError(statusResult.error || "Could not load BAA status.");
      return;
    }

    setBaa(activeResult.baa);
    setBaaStatus(statusResult.status);
  }, [navigate]);

  useEffect(() => {
    if (!api.getJWT()) {
      navigate("/login");
      return;
    }
    void loadBaa();
  }, [loadBaa, navigate]);

  const onAccept = async () => {
    if (!baa || !checked || !baaStatus?.can_accept || accepting) return;
    setAcceptError(null);
    setVersionNotice(null);
    setAccepting(true);
    const result = await api.acceptBaa(baa.version_number);
    setAccepting(false);

    if (!result.success) {
      if (result.status === 401) {
        navigate("/login");
        return;
      }
      if (result.status === 403) {
        setAcceptError("Only the organization owner can accept the BAA.");
        return;
      }
      if (result.status === 409) {
        setVersionNotice(
          "The active BAA version changed while you were reviewing it. The document below has been updated — please review and accept again.",
        );
        setChecked(false);
        await loadBaa();
        return;
      }
      setAcceptError(result.error || "Could not record acceptance.");
      return;
    }

    setChecked(false);
    await loadBaa();
  };

  const needsAcceptance = baaStatus?.needs_acceptance === true;
  const canAccept = baaStatus?.can_accept === true;
  const acceptance = baaStatus?.acceptance;
  const effectiveLabel = formatTimestamp(baa?.effective_date);
  const acceptedLabel = formatTimestamp(acceptance?.accepted_at);

  return (
    <div className="min-h-screen bg-[#F4F7FD]">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-6 shrink-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-[#183278]/70">
                Legal
              </p>
              <h1 className="mt-1 text-3xl font-bold text-gray-900">
                {baa?.title ?? "Business Associate Addendum"}
              </h1>
              {baa?.version_number && (
                <p className="mt-2 text-sm text-gray-600">
                  Version {baa.version_number}
                  {effectiveLabel ? ` · Effective ${effectiveLabel}` : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="shrink-0 self-start rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9DF9] focus-visible:ring-offset-2"
            >
              Back
            </button>
          </div>
        </header>

        {loading && (
          <p className="text-sm text-gray-600" role="status">
            Loading agreement…
          </p>
        )}

        {!loading && loadError && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {loadError}
          </div>
        )}

        {!loading && !loadError && baa && (
          <>
            {!needsAcceptance && acceptance && (
              <div
                className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
                role="status"
              >
                <p className="font-semibold">Last accepted BAA</p>
                <p className="mt-1">
                  Version {acceptance.version_number}
                  {acceptedLabel ? ` · Accepted ${acceptedLabel}` : ""}
                </p>
              </div>
            )}

            {needsAcceptance && !canAccept && (
              <div
                className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                role="alert"
              >
                A new Business Associate Addendum must be accepted for your organization.
                Contact your organization owner to complete acceptance.
              </div>
            )}

            {(acceptError || versionNotice) && (
              <div
                className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
                  versionNotice
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
                role="alert"
              >
                {versionNotice && <p>{versionNotice}</p>}
                {acceptError && <p className={versionNotice ? "mt-1" : ""}>{acceptError}</p>}
              </div>
            )}

            <article className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <NovaMarkdown content={baa.content_markdown} excerpts={false} />
            </article>

            {needsAcceptance && canAccept && (
              <footer className="mt-6 shrink-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-[#183278] focus:ring-[#7C9DF9]"
                  />
                  <span>{BAA_ACCEPTANCE_CHECKBOX_LABEL}</span>
                </label>
                <button
                  type="button"
                  disabled={!checked || accepting}
                  onClick={() => void onAccept()}
                  className="mt-4 w-full rounded-xl bg-[#183278] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#142a5e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9DF9] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[12rem]"
                >
                  {accepting ? "Accepting…" : "Accept BAA"}
                </button>
              </footer>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function BaaPage() {
  return (
    <>
      <Auth />
      <BaaPageContent />
    </>
  );
}
