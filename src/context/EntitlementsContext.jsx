import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import * as api from "@/lib/api";
import {
  isBetaUiFromEntitlements,
  planTierFromEntitlements,
} from "@/utils/entitlementsUi.js";

const EntitlementsContext = createContext(null);

const AUTH_ROUTE_PREFIXES = [
  "/login",
  "/beta-login",
  "/signup",
  "/confirm-email",
  "/forgot-password",
  "/reset-password",
];

function isAuthPathname(pathname) {
  return AUTH_ROUTE_PREFIXES.some((r) => pathname.startsWith(r));
}

export function EntitlementsProvider({ children }) {
  const { pathname } = useLocation();
  const isAuthPage = isAuthPathname(pathname);
  const [entitlements, setEntitlements] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (isAuthPage || !api.getJWT()) {
      setEntitlements(null);
      setOrganization(null);
      setStatus("idle");
      setError(null);
      return;
    }
    setError(null);
    // Keep `status === "ready"` during refresh so BetaOnly does not unmount children.
    setStatus((prev) => (prev === "ready" ? "ready" : "loading"));
    const result = await api.getMeEntitlements();
    if (result.success && result.entitlements) {
      setEntitlements(result.entitlements);
      setOrganization(result.organization ?? null);
      setStatus("ready");
    } else {
      setEntitlements(null);
      setOrganization(null);
      setStatus("error");
      setError(result.error || "Failed to load entitlements");
    }
  }, [isAuthPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isAuthPage || !api.getJWT()) {
        if (!cancelled) {
          setEntitlements(null);
          setOrganization(null);
          setStatus("idle");
          setError(null);
        }
        return;
      }
      if (!cancelled) {
        setError(null);
        // Stay "ready" if we already have entitlements so in-app navigation
        // (including Settings tabs) does not unmount BetaOnly children.
        setStatus((prev) => (prev === "ready" ? "ready" : "loading"));
      }
      const result = await api.getMeEntitlements();
      if (cancelled) return;
      if (result.success && result.entitlements) {
        setEntitlements(result.entitlements);
        setOrganization(result.organization ?? null);
        setStatus("ready");
      } else {
        setEntitlements(null);
        setOrganization(null);
        setStatus("error");
        setError(result.error || "Failed to load entitlements");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthPage]);

  useEffect(() => {
    if (isAuthPage) return;
    const onMsg = (e) => {
      if (e?.data?.type === "ENSCRIBE_LOGIN" && api.getJWT()) {
        void refetch();
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [isAuthPage, refetch]);

  const value = useMemo(() => {
    const ready = status === "ready" && entitlements != null;
    const isBeta = ready && isBetaUiFromEntitlements(entitlements);
    const planTier = ready ? planTierFromEntitlements(entitlements) : null;
    return {
      entitlements,
      organization,
      status,
      error,
      isBeta,
      planTier,
      refetch,
    };
  }, [entitlements, organization, status, error, refetch]);

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements() {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) {
    throw new Error("useEntitlements must be used within EntitlementsProvider");
  }
  return ctx;
}
