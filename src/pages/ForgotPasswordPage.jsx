import React, { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import useRedirectIfAuthenticated from "@/hooks/useRedirectIfAuthenticated";
import { SESSION_KEYS, STORAGE_KEYS } from "@/utils/storageConfig";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
const RESEND_COOLDOWN_MS = 60 * 1000;

function startResendCooldown() {
  try {
    const ts = Date.now() + RESEND_COOLDOWN_MS;
    localStorage.setItem(STORAGE_KEYS.resetPassword.resendCodeCooldownTs, String(ts));
  } catch {
    // ignore
  }
}

export default function ForgotPasswordPage() {
  useRedirectIfAuthenticated();

  const emailId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const navigate = useNavigate();

  const refreshTurnstile = () => {
    setTurnstileToken("");
    setTurnstileResetKey((k) => k + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }

    if (!turnstileToken) {
      setError("Please complete the verification challenge.");
      return;
    }

    setLoading(true);
    const result = await api.forgotPassword(trimmedEmail, { turnstileToken });
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      // Tokens are single-use; force a fresh challenge before the next attempt.
      refreshTurnstile();
      return;
    }

    try {
      sessionStorage.setItem(SESSION_KEYS.resetPasswordEmail, trimmedEmail);
    } catch {
      // ignore
    }

    startResendCooldown();
    navigate("/reset-password", {
      replace: true,
      state: { codeSent: true, email: trimmedEmail },
    });
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] xl:grid-cols-[0.8fr_1.2fr]">
        <AuthBrandPanel />

        <section className="flex items-center justify-center px-5 py-12 lg:px-10 bg-[#f7f8fb]">
          <div className="w-full max-w-md">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_18px_45px_rgba(2,6,23,0.12)] px-8 py-9">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-[#183278] transition"
              >
                ← Back to login
              </button>

              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Forgot password
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Enter your email and we will send you a 6-digit code to reset
                your password.
              </p>

              {error ? (
                <div
                  className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label
                    htmlFor={emailId}
                    className="text-sm font-medium text-slate-700"
                  >
                    Email
                  </label>
                  <input
                    id={emailId}
                    type="email"
                    placeholder="email@address.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#183278] focus:ring-4 focus:ring-[#183278]/15 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div className="w-full">
                  <TurnstileWidget
                    siteKey={TURNSTILE_SITE_KEY}
                    action="forgot-password"
                    theme="light"
                    size="flexible"
                    appearance="always"
                    resetKey={turnstileResetKey}
                    onVerify={(token) => {
                      setTurnstileToken(token);
                      setError("");
                    }}
                    onExpire={() => setTurnstileToken("")}
                    onError={(message) => {
                      setTurnstileToken("");
                      setError(message);
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !turnstileToken}
                  className="mt-1 h-11 w-full rounded-xl bg-[#183278] text-white font-semibold shadow-sm transition hover:bg-[#142a5e] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#183278]/25 disabled:opacity-60 disabled:hover:bg-[#183278]"
                >
                  {loading ? "Sending…" : "Send reset code"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
