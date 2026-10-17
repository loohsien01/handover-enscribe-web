import React, { useEffect, useId, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as api from "@/lib/api";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import PasswordInput, { AUTH_INPUT_CLASSNAME } from "@/components/auth/PasswordInput";
import PasswordRequirementsList from "@/components/auth/PasswordRequirementsList";
import { SESSION_KEYS, STORAGE_KEYS } from "@/utils/storageConfig";
import {
  MIN_PASSWORD_LENGTH,
  getPasswordRequirementStatus,
  passwordMeetsRequirements,
  passwordRequirementsErrorMessage,
} from "@/utils/passwordRequirements";

const RESEND_COOLDOWN_MS = 60 * 1000;

function readPrefillEmail(searchParams) {
  const fromQuery = searchParams.get("email")?.trim();
  if (fromQuery) return fromQuery;
  try {
    return sessionStorage.getItem(SESSION_KEYS.resetPasswordEmail) || "";
  } catch {
    return "";
  }
}

function getRemainingResendSeconds() {
  try {
    const ts = Number(localStorage.getItem(STORAGE_KEYS.resetPassword.resendCodeCooldownTs) || 0);
    if (!ts) return 0;
    const rem = Math.ceil((ts - Date.now()) / 1000);
    return rem > 0 ? rem : 0;
  } catch {
    return 0;
  }
}

function startResendCooldown() {
  try {
    const ts = Date.now() + RESEND_COOLDOWN_MS;
    localStorage.setItem(STORAGE_KEYS.resetPassword.resendCodeCooldownTs, String(ts));
  } catch {
    // ignore
  }
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const emailId = useId();
  const codeId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const [email, setEmail] = useState(() => {
    const fromState = location.state?.email?.trim();
    if (fromState) return fromState;
    return readPrefillEmail(searchParams);
  });
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [resendInfo, setResendInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [showCodeSentNotice, setShowCodeSentNotice] = useState(() =>
    Boolean(location.state?.codeSent),
  );
  const [cooldownSeconds, setCooldownSeconds] = useState(() =>
    getRemainingResendSeconds(),
  );

  const passwordRequirements = useMemo(
    () => getPasswordRequirementStatus(password),
    [password],
  );

  useEffect(() => {
    let timer = null;
    if (cooldownSeconds > 0) {
      timer = setInterval(() => {
        const rem = getRemainingResendSeconds();
        setCooldownSeconds(rem);
        if (rem <= 0 && timer) {
          clearInterval(timer);
        }
      }, 1000);
    }

    const onStorage = (e) => {
      if (e.key === STORAGE_KEYS.resetPassword.resendCodeCooldownTs) {
        setCooldownSeconds(getRemainingResendSeconds());
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, [cooldownSeconds]);

  const handleResendCode = async () => {
    setResendInfo("");
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email before requesting a new code.");
      return;
    }
    if (getRemainingResendSeconds() > 0) {
      setResendInfo(`Please wait ${getRemainingResendSeconds()}s before requesting another code.`);
      setCooldownSeconds(getRemainingResendSeconds());
      return;
    }

    setResendLoading(true);
    const result = await api.forgotPassword(trimmedEmail);
    setResendLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setCode("");
    setShowCodeSentNotice(true);
    setResendInfo("If an account exists for that email, a new code has been sent.");
    startResendCooldown();
    setCooldownSeconds(Math.ceil(RESEND_COOLDOWN_MS / 1000));

    try {
      sessionStorage.setItem(SESSION_KEYS.resetPasswordEmail, trimmedEmail);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResendInfo("");

    const trimmedEmail = email.trim();
    const normalizedCode = code.replace(/\D/g, "");

    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }
    if (normalizedCode.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (!passwordMeetsRequirements(password)) {
      setError(passwordRequirementsErrorMessage());
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await api.confirmForgotPassword(trimmedEmail, normalizedCode, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    try {
      sessionStorage.removeItem(SESSION_KEYS.resetPasswordEmail);
    } catch {
      // ignore
    }

    navigate("/login?reset=1", { replace: true });
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
                Reset password
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Enter your account email, the 6-digit code from your email, and
                choose a new password.
              </p>

              {showCodeSentNotice ? (
                <div
                  className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 leading-relaxed"
                  role="status"
                >
                  If <strong>{email.trim() || "that email"}</strong> matches an
                  email address we have on file, we&apos;ve sent you an email with
                  a code to reset your password. If you haven&apos;t received the
                  email in 5 minutes, check your spam folder.
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

              {resendInfo ? (
                <div
                  className="mt-5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
                  role="status"
                >
                  {resendInfo}
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
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                    className={AUTH_INPUT_CLASSNAME}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor={codeId}
                    className="text-sm font-medium text-slate-700"
                  >
                    Verification code
                  </label>
                  <input
                    id={codeId}
                    type="text"
                    placeholder="6-digit code"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    disabled={loading}
                    className={AUTH_INPUT_CLASSNAME}
                  />
                  <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                    <span>Didn&apos;t get a code?</span>
                    {cooldownSeconds > 0 ? (
                      <span>Resend in {cooldownSeconds}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={loading || resendLoading}
                        className="font-medium text-[#183278] hover:text-[#142a5e] disabled:text-slate-400 disabled:cursor-not-allowed"
                      >
                        {resendLoading ? "Sending…" : "Resend code"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor={passwordId}
                    className="text-sm font-medium text-slate-700"
                  >
                    New password
                  </label>
                  <PasswordInput
                    id={passwordId}
                    placeholder="••••••••"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <PasswordRequirementsList requirements={passwordRequirements} />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor={confirmPasswordId}
                    className="text-sm font-medium text-slate-700"
                  >
                    Confirm new password
                  </label>
                  <PasswordInput
                    id={confirmPasswordId}
                    placeholder="••••••••"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                    toggleLabel="confirm password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 h-11 w-full rounded-xl bg-[#183278] text-white font-semibold shadow-sm transition hover:bg-[#142a5e] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#183278]/25 disabled:opacity-60 disabled:hover:bg-[#183278]"
                >
                  {loading ? "Saving…" : "Update password"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
