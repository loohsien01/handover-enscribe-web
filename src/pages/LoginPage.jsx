import React, { useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as api from "@/lib/api";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import PasswordInput from "@/components/auth/PasswordInput";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import useRedirectIfAuthenticated from "@/hooks/useRedirectIfAuthenticated";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

export default function LoginPage() {
  useRedirectIfAuthenticated();

  const emailId = useId();
  const passwordId = useId();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const passwordJustReset = searchParams.get("reset") === "1";
  const emailJustConfirmed = searchParams.get("confirmed") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const refreshTurnstile = () => {
    setTurnstileToken("");
    setTurnstileResetKey((k) => k + 1);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    if (!turnstileToken) {
      setError("Please complete the verification challenge.");
      return;
    }

    setLoading(true);
    const result = await api.signIn(email, password, {
      turnstileToken,
      channel: "stable",
    });

    if (result.success) {
      navigate("/view-notes");
    } else {
      setError(result.error);
      // Tokens are single-use; force a fresh challenge before the next attempt.
      refreshTurnstile();
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] xl:grid-cols-[0.8fr_1.2fr]">
        <AuthBrandPanel />

        <section className="flex items-center justify-center px-5 py-12 lg:px-10 bg-[#f7f8fb]">
          <div className="w-full max-w-md">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_18px_45px_rgba(2,6,23,0.12)] px-8 py-9">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Welcome back
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Sign in to your EnScribe account
              </p>

              {passwordJustReset ? (
                <div
                  className="mt-5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
                  role="status"
                >
                  Your password was updated. Sign in with your new password.
                </div>
              ) : null}

              {emailJustConfirmed ? (
                <div
                  className="mt-5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
                  role="status"
                >
                  Email confirmed. Sign in with the password you chose at
                  sign-up.
                </div>
              ) : null}

              {error ? (
                <div
                  className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <form className="mt-6 space-y-5" onSubmit={handleLogin}>
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor={passwordId}
                      className="text-sm font-medium text-slate-700"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      className="text-sm font-medium text-[#183278] hover:text-[#142a5e]"
                      onClick={() => navigate("/forgot-password")}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <PasswordInput
                    id={passwordId}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="w-full">
                  <TurnstileWidget
                    siteKey={TURNSTILE_SITE_KEY}
                    action="sign-in"
                    theme="light"
                    size="flexible"
                    appearance="interaction-only"
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
                  {loading ? "Signing in..." : "Sign In"}
                </button>

                <div className="pt-2 text-center text-sm text-slate-500">
                  New user?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/signup")}
                    className="font-semibold text-[#183278] hover:text-[#142a5e]"
                  >
                    Create an account
                  </button>
                </div>

                <div className="pt-1 text-center text-xs text-slate-400">
                  Secure clinician login
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
