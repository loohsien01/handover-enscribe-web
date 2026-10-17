import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";

/**
 * For auth-only pages (login/signup/confirm-email/forgot-password):
 * If a user already has an active session, send them to /view-notes.
 *
 * "Active session" here means:
 * - a JWT is already present in localStorage, OR
 * - a refresh cookie exists and can successfully refresh to a new JWT.
 */
export default function useRedirectIfAuthenticated() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const redirectIfAuthed = async () => {
      try {
        // Fast path: JWT present.
        if (api.getJWT()) {
          navigate("/view-notes", { replace: true });
          return;
        }

        // Fallback: if refresh cookie exists, attempt refresh once.
        const hasCookie = await api.checkRefreshCookie();
        if (!hasCookie || cancelled) return;

        const refreshed = await api.refreshSession();
        if (cancelled) return;

        if (refreshed.success && api.getJWT()) {
          navigate("/view-notes", { replace: true });
        }
      } catch {
        // If anything fails, stay on the auth page.
      }
    };

    void redirectIfAuthed();
    return () => {
      cancelled = true;
    };
  }, [navigate]);
}

