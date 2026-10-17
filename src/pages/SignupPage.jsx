import React, { useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import PasswordInput, { AUTH_INPUT_CLASSNAME } from "@/components/auth/PasswordInput";
import PasswordRequirementsList from "@/components/auth/PasswordRequirementsList";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import ProfessionCombobox from "@/components/ProfessionCombobox";
import useRedirectIfAuthenticated from "@/hooks/useRedirectIfAuthenticated";
import {
  MEDICAL_PROFESSIONS,
  PROFESSION_OTHER_VALUE,
} from "@/constants/medicalProfessions";
import {
  MIN_PASSWORD_LENGTH,
  getPasswordRequirementStatus,
  passwordMeetsRequirements,
  passwordRequirementsErrorMessage,
} from "@/utils/passwordRequirements";
import { SESSION_KEYS, STORAGE_KEYS } from "@/utils/storageConfig";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

const LICENSE_LABEL =
  "By checking this box, I confirm that I am a licensed healthcare provider";

const RESEND_COOLDOWN_MS = 60 * 1000;

function startConfirmEmailCooldown() {
  try {
    const ts = Date.now() + RESEND_COOLDOWN_MS;
    localStorage.setItem(
      STORAGE_KEYS.confirmEmail.resendConfirmationCooldownTs,
      String(ts),
    );
  } catch {
    // ignore
  }
}

export default function SignupPage() {
  useRedirectIfAuthenticated();

  const emailId = useId();
  const usernameId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const licensedProviderId = useId();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [licensedConfirmed, setLicensedConfirmed] = useState(false);
  const [professionValue, setProfessionValue] = useState("");
  const [professionOther, setProfessionOther] = useState("");
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const navigate = useNavigate();

  const selectedProfession = useMemo(
    () => MEDICAL_PROFESSIONS.find((p) => p.value === professionValue),
    [professionValue],
  );

  const passwordRequirements = useMemo(
    () => getPasswordRequirementStatus(password),
    [password],
  );

  const getSpecialtyForProfile = () =>
    professionValue === PROFESSION_OTHER_VALUE
      ? professionOther.trim()
      : selectedProfession?.label?.trim() || "";

  const refreshTurnstile = () => {
    setTurnstileToken("");
    setTurnstileResetKey((k) => k + 1);
  };

  const validateForm = () => {
    if (
      !email.trim() ||
      !username.trim() ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      setError(
        "All fields are required, including email, username, password, and confirm password.",
      );
      return false;
    }
    if (!passwordMeetsRequirements(password)) {
      setError(passwordRequirementsErrorMessage());
      return false;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    if (!professionValue) {
      setError("Please select your medical profession.");
      return false;
    }
    if (professionValue === PROFESSION_OTHER_VALUE && !professionOther.trim()) {
      setError('Please describe your profession when "Other" is selected.');
      return false;
    }
    if (!getSpecialtyForProfile()) {
      setError("Please select a valid medical profession.");
      return false;
    }
    if (!licensedConfirmed) {
      setError(`Please confirm: ${LICENSE_LABEL}`);
      return false;
    }
    return true;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setUsernameError("");
    if (!validateForm()) return;

    if (!turnstileToken) {
      setError("Please complete the verification challenge.");
      return;
    }

    setLoading(true);
    try {
      const specialty = getSpecialtyForProfile();
      const result = await api.signUp(
        email,
        password,
        {
          username: username.trim(),
          specialty,
        },
        { turnstileToken },
      );
      if (!result.success) {
        const message = result.error || "Signup failed. Please try again.";
        if (result.code === "USERNAME_TAKEN") {
          setUsernameError(message);
        } else {
          setError(message);
        }
        // Tokens are single-use; force a fresh challenge before the next attempt.
        refreshTurnstile();
        return;
      }

      try {
        sessionStorage.setItem(SESSION_KEYS.confirmEmail, email);
        sessionStorage.removeItem("confirm_email");
      } catch {
        // ignore storage errors
      }

      startConfirmEmailCooldown();
      navigate("/confirm-email", {
        replace: true,
        state: { codeSent: true, email },
      });
    } catch (err) {
      setError(err?.message || "Network error during signup");
      refreshTurnstile();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] xl:grid-cols-[0.8fr_1.2fr]">
        <AuthBrandPanel />

        <section className="flex items-start justify-center px-5 py-10 lg:items-center lg:px-10 lg:py-12 bg-[#f7f8fb]">
          <div className="w-full max-w-md py-4 lg:py-0">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_18px_45px_rgba(2,6,23,0.12)] px-8 py-9">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-[#183278] transition"
              >
                ← Back to login
              </button>

              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                Create account
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Join EnScribe — all fields are required.
              </p>

              {error ? (
                <div
                  className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <form className="mt-6 space-y-5" onSubmit={handleSignup}>
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
                    htmlFor={usernameId}
                    className="text-sm font-medium text-slate-700"
                  >
                    Username
                  </label>
                  <input
                    id={usernameId}
                    type="text"
                    placeholder="Username"
                    required
                    minLength={1}
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (usernameError) setUsernameError("");
                    }}
                    disabled={loading}
                    autoComplete="username"
                    aria-invalid={usernameError ? true : undefined}
                    aria-describedby={usernameError ? `${usernameId}-error` : undefined}
                    className={`${AUTH_INPUT_CLASSNAME}${
                      usernameError
                        ? " border-red-300 focus:border-red-500 focus:ring-red-500/15"
                        : ""
                    }`}
                  />
                  {usernameError ? (
                    <p
                      id={`${usernameId}-error`}
                      className="text-sm text-red-700"
                      role="alert"
                    >
                      {usernameError}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor={passwordId}
                    className="text-sm font-medium text-slate-700"
                  >
                    Password
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
                    Confirm password
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

                <ProfessionCombobox
                  professionValue={professionValue}
                  professionOther={professionOther}
                  onProfessionValueChange={setProfessionValue}
                  onProfessionOtherChange={setProfessionOther}
                  disabled={loading}
                />

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={licensedProviderId}
                    required
                    checked={licensedConfirmed}
                    onChange={(e) => setLicensedConfirmed(e.target.checked)}
                    disabled={loading}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#183278] focus:ring-[#183278]/25"
                  />
                  <label
                    htmlFor={licensedProviderId}
                    className="text-sm leading-relaxed text-slate-700"
                  >
                    {LICENSE_LABEL}
                  </label>
                </div>

                <div className="w-full">
                  <TurnstileWidget
                    siteKey={TURNSTILE_SITE_KEY}
                    action="sign-up"
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
                  {loading ? "Signing up…" : "Sign up"}
                </button>

                <div className="pt-2 text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="font-semibold text-[#183278] hover:text-[#142a5e]"
                  >
                    Sign in
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
