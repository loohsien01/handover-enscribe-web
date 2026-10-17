import React, { useEffect, useRef } from "react";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

let scriptPromise = null;

// Loads the Turnstile script once and resolves when window.turnstile is ready.
function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    const onReady = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile script loaded but API unavailable"));
    };

    if (existing) {
      existing.addEventListener("load", onReady);
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed to load")));
      if (window.turnstile) onReady();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", onReady);
    script.addEventListener("error", () => {
      scriptPromise = null;
      reject(new Error("Turnstile script failed to load"));
    });
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Cloudflare Turnstile widget (explicit render).
 *
 * The challenge renders inside a cross-origin iframe, so its internal look
 * (borders, corners, fonts) cannot be styled with our CSS. The only levers are
 * the Cloudflare-provided `theme` / `size` / `appearance` options below.
 *
 * @param {object} props
 * @param {string} props.siteKey - Public Turnstile site key (VITE_TURNSTILE_SITE_KEY).
 * @param {string} [props.action] - Turnstile action label (e.g. "sign-in").
 * @param {"auto"|"light"|"dark"} [props.theme="light"] - Widget color theme.
 * @param {"normal"|"flexible"|"compact"} [props.size="flexible"] - Widget sizing; "flexible" fills the container width.
 * @param {"always"|"execute"|"interaction-only"} [props.appearance="interaction-only"] - When the widget is visible; "interaction-only" hides it unless an interactive challenge is required.
 * @param {(token: string) => void} props.onVerify - Called with a fresh token on success.
 * @param {() => void} [props.onExpire] - Called when the token expires.
 * @param {(message: string) => void} [props.onError] - Called on widget/script error.
 * @param {number} [props.resetKey=0] - Increment after a consumed/failed token to call turnstile.reset().
 */
export default function TurnstileWidget({
  siteKey,
  action,
  theme = "light",
  size = "flexible",
  appearance = "interaction-only",
  onVerify,
  onExpire,
  onError,
  resetKey = 0,
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  // Keep latest callbacks without forcing a re-render/re-mount of the widget.
  const handlersRef = useRef({ onVerify, onExpire, onError });
  handlersRef.current = { onVerify, onExpire, onError };

  useEffect(() => {
    let cancelled = false;

    if (!siteKey) {
      handlersRef.current.onError?.(
        "Turnstile is not configured (missing site key)."
      );
      return undefined;
    }

    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme,
          size,
          appearance,
          callback: (token) => handlersRef.current.onVerify?.(token),
          "expired-callback": () => handlersRef.current.onExpire?.(),
          "error-callback": () =>
            handlersRef.current.onError?.(
              "Verification failed. Please retry."
            ),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        handlersRef.current.onError?.(
          err?.message || "Could not load verification widget."
        );
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup errors
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action, theme, size, appearance]);

  // Tokens are single-use. After a failed submit the parent increments resetKey so
  // we can mint a fresh token (otherwise submit stays disabled forever).
  useEffect(() => {
    if (!resetKey || widgetIdRef.current == null || !window.turnstile) return;
    try {
      window.turnstile.reset(widgetIdRef.current);
    } catch {
      // ignore reset errors; parent can still show the form error
    }
  }, [resetKey]);

  return <div ref={containerRef} className="cf-turnstile w-full" />;
}
