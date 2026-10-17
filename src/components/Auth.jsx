import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "@/lib/api";

const AUTH_CHECK_MAX_ATTEMPTS = 3;
const AUTH_CHECK_RETRY_BASE_MS = 1200;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function checkAuthWithRetries() {
  let lastCheck = null;

  for (let attempt = 1; attempt <= AUTH_CHECK_MAX_ATTEMPTS; attempt += 1) {
    lastCheck = await api.checkAuthWithRefreshRetry();

    if (lastCheck.valid) {
      return lastCheck;
    }

    if (!lastCheck.networkError || attempt === AUTH_CHECK_MAX_ATTEMPTS) {
      return lastCheck;
    }

    console.warn(
      `<Auth/> Tier 2: Network error on attempt ${attempt}, retrying…`,
      lastCheck.error,
    );
    await delay(AUTH_CHECK_RETRY_BASE_MS * attempt);
  }

  return lastCheck;
}

// Validates JWT, attempts refresh on 401; only signs out on definitive auth failure.
async function checkAuthAndRedirect(navigate) {
  try {
    console.log("<Auth/> Tier 2: Validating session with reactive auth…");

    const authCheck = await checkAuthWithRetries();

    if (authCheck.valid) {
      console.log("<Auth/> Tier 2: Session validation successful");
      return;
    }

    if (authCheck.networkError) {
      console.warn(
        "<Auth/> Tier 2: Offline or transient network error — keeping session",
        authCheck.error,
      );
      return;
    }

    if (!authCheck.requiresLogin) {
      console.warn(
        "<Auth/> Tier 2: Auth check failed without login required — staying on page",
        authCheck.error,
      );
      return;
    }

    console.error("<Auth/> Tier 2: Auth error:", authCheck.error);
    await api.handleSignOut();
    navigate("/login");
  } catch (err) {
    if (api.isNetworkFailure(err)) {
      console.warn(
        "<Auth/> Tier 2: Unexpected network error — keeping session",
        err,
      );
      return;
    }
    console.error(
      "<Auth/> Tier 2: Unexpected error during session validation:",
      err,
    );
    await api.handleSignOut();
    navigate("/login");
  }
}

export default function Auth() {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndRedirect(navigate);
  }, [navigate]);

  return null;
}
