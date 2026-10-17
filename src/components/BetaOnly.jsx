import React from "react";
import { useEntitlements } from "@/context/EntitlementsContext.jsx";

/**
 * Renders `children` only when entitlements are loaded and `ui_experience_version` is beta.
 * Must sit under {@link EntitlementsProvider} (see App shell).
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.fallback=null] — stable users, errors, or idle (signed out)
 * @param {React.ReactNode} [props.loading=null] — while entitlements request is in flight (default: render nothing)
 */
export default function BetaOnly({ children, fallback = null, loading = null }) {
  const { status, isBeta } = useEntitlements();

  if (status === "loading") {
    return loading;
  }

  if (status !== "ready" || !isBeta) {
    return fallback;
  }

  return children;
}
