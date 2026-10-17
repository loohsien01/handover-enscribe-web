import React, { useState } from "react";

export const AUTH_INPUT_CLASSNAME =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#183278] focus:ring-4 focus:ring-[#183278]/15 disabled:bg-slate-50 disabled:text-slate-500";

function IconEye() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
    </svg>
  );
}

function IconEyeSlash() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

export default function PasswordInput({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = "••••••••",
  autoComplete,
  required,
  minLength,
  toggleLabel = "password",
  className = "",
  ...rest
}) {
  const [visible, setVisible] = useState(false);

  const toggleAriaLabel =
    toggleLabel === "confirm password"
      ? visible
        ? "Hide confirm password"
        : "Show confirm password"
      : visible
        ? "Hide password"
        : "Show password";

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className={`auth-password-input ${AUTH_INPUT_CLASSNAME} pr-11 ${className}`.trim()}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={toggleAriaLabel}
        aria-pressed={visible}
        className="auth-password-toggle absolute inset-y-0 right-1 m-0 flex w-9 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-slate-500 transition hover:bg-[#183278]/5 hover:text-[#183278] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {visible ? <IconEyeSlash /> : <IconEye />}
      </button>
    </div>
  );
}
