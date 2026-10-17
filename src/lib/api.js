// lib/api.js - API-related functions

import { STORAGE_KEYS, clearAppStorage, setCurrentUserId } from '@/utils/storageConfig';
import { formatApiErrorBody } from '@/utils/errors';
import { normalizeNotesListResponse } from '@/utils/notesListResponse.js';
import { logNoteTemplateSectionsClassification } from '@/utils/noteTemplateSectionClassificationDebug.js';
import {
  isJwtExpiredOrNearExpiry,
} from '@/utils/jwtUser.js';

export const API_BASE = import.meta.env.VITE_API_URL || '';

// Global mutex lock for preventing concurrent session refresh attempts
let refreshPromise = null;

// Acquire mutex lock for session refresh - ensures only one refresh happens at a time
// Multiple concurrent callers will wait for the first refresh to complete
const acquireRefreshLock = async () => {
  while (refreshPromise) {
    await refreshPromise;
  }
  let releaseLock;
  refreshPromise = new Promise(resolve => {
    releaseLock = () => {
      refreshPromise = null;  // Clear the promise so next caller doesn't wait forever
      resolve();
    };
  });
  return releaseLock;
};

// Helper to get JWT from localStorage (client-side only)
export const getJWT = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.auth.jwt);
};

// Set or clear JWT in localStorage (client-side only)
export const setJWT = (token) => {
  if (typeof window === 'undefined') throw new Error('setJWT failed. Can only be called in the browser');
  localStorage.setItem(STORAGE_KEYS.auth.jwt, token);
};
export const deleteJWT = () => {
  if (typeof window === 'undefined') throw new Error('deleteJWT failed. Can only be called in the browser');
  localStorage.removeItem(STORAGE_KEYS.auth.jwt);
};

/** Routes where the app may broadcast session state to the Chrome extension. */
const EXTENSION_SESSION_SYNC_AUTH_PREFIXES = [
  '/login',
  '/signup',
  '/confirm-email',
  '/forgot-password',
  '/reset-password',
];

export const isExtensionSessionSyncRoute = (pathname) => {
  if (!pathname) return false;
  if (pathname === '/view-notes') return true; // Default route for newly logged in users
  return EXTENSION_SESSION_SYNC_AUTH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
};

/** Notify the Enscribe Chrome extension of the current session (if any). */
export const syncExtensionSession = () => {
  if (typeof window === 'undefined') return;
  if (!isExtensionSessionSyncRoute(window.location.pathname)) return;
  const jwt = getJWT();
  if (!jwt) return;
  const userEmail = localStorage.getItem(STORAGE_KEYS.auth.userEmail) || '';
  window.postMessage({ type: 'ENSCRIBE_LOGIN', jwt, userEmail }, '*');
};

/** Notify the Enscribe Chrome extension that the user signed out. */
export const notifyExtensionSignedOut = () => {
  if (typeof window === 'undefined') return;
  window.postMessage({ type: 'ENSCRIBE_LOGOUT' }, '*');
};

/** @param {Record<string, unknown>|null|undefined} body */
const parseAccessTokenFromAuthBody = (body) => {
  if (!body) return null;
  if (typeof body.token === 'string') return body.token;
  return body.access_token || body.token?.access_token || body.token?.accessToken || null;
};

/**
 * Persist canonical `auth.users.id` + email from auth API responses.
 * Handles sign-in, check-validity (`{ valid, user }`), and refresh (`{ accessToken, user }`).
 */
export const persistAuthUserFromAuthResponse = (body) => {
  if (!body || typeof body !== 'object' || typeof window === 'undefined') return;
  const row = /** @type {Record<string, unknown>} */ (body);
  const user =
    row.user && typeof row.user === 'object'
      ? /** @type {Record<string, unknown>} */ (row.user)
      : null;
  const userId =
    (typeof user?.id === 'string' && user.id.trim()) ||
    (typeof row.userId === 'string' && row.userId.trim()) ||
    (typeof row.user_id === 'string' && row.user_id.trim()) ||
    null;
  const email =
    (typeof user?.email === 'string' && user.email.trim()) ||
    (typeof row.email === 'string' && row.email.trim()) ||
    null;
  if (userId) setCurrentUserId(userId);
  if (email) localStorage.setItem(STORAGE_KEYS.auth.userEmail, email);
};

/** @deprecated Use {@link persistAuthUserFromAuthResponse}. */
const persistAuthUserFromBody = persistAuthUserFromAuthResponse;

const authHeadersWithBearer = (jwt) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  Authorization: `Bearer ${jwt}`,
});

// Sign-in helper: calls server to authenticate user and set session.
// options.turnstileToken (optional) is verified server-side when present (verify-if-present);
// options.channel (optional, 'beta' | 'stable') is metrics-only and never gates verification.
export const signIn = async (email, password, options = {}) => {
  try {
    const payload = { action: 'sign-in', email, password };
    if (typeof options.turnstileToken === 'string' && options.turnstileToken) {
      payload.turnstileToken = options.turnstileToken;
    }
    if (typeof options.channel === 'string' && options.channel) {
      payload.channel = options.channel;
    }

    const resp = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/html' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(formatApiErrorBody(body, resp.status) || `Sign-in failed (${resp.status})`);
    }

    const body = await resp.json().catch(() => ({}));

    const jwt = parseAccessTokenFromAuthBody(body);

    if (!jwt) {
      throw new Error('No access token returned from server sign-in');
    }

    // Check if user has changed (different email) and clear all user-specific data if so
    const storedEmail = localStorage.getItem(STORAGE_KEYS.auth.userEmail);
    if (storedEmail && storedEmail !== email) {
      clearAppStorage();
    }

    // Store JWT and user email
    setJWT(jwt);
    localStorage.setItem(STORAGE_KEYS.auth.userEmail, email);
    persistAuthUserFromBody(body);

    syncExtensionSession();

    return { success: true, jwt, email };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Sign-up helper: atomic auth user + userProfile creation (see docs/AUTH_SIGN_UP_API.md).
// When the server returns a session access token, it is stored like sign-in.
/**
 * @param {string} email
 * @param {string} password
 * @param {{ username: string, specialty: string }} userProfile
 * @param {{ turnstileToken?: string }} [options] - turnstileToken verified server-side when present (verify-if-present)
 * @returns {Promise<
 *   | { success: true, message: string, jwt: string|null, userProfile: object }
 *   | { success: false, error: string, status?: number, code?: string }
 * >}
 */
export const signUp = async (email, password, userProfile, options = {}) => {
  try {
    if (
      !userProfile ||
      typeof userProfile.username !== 'string' ||
      typeof userProfile.specialty !== 'string' ||
      !userProfile.username.trim() ||
      !userProfile.specialty.trim()
    ) {
      return { success: false, error: 'Username and specialty are required for sign-up.' };
    }

    const payload = {
      action: 'sign-up',
      email,
      password,
      userProfile: {
        username: userProfile.username.trim(),
        specialty: userProfile.specialty.trim(),
      },
    };
    if (typeof options.turnstileToken === 'string' && options.turnstileToken) {
      payload.turnstileToken = options.turnstileToken;
    }

    const resp = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await resp.json().catch(() => ({}));

    console.log('[api signUp] response', { status: resp.status, body });

    if (!resp.ok) {
      return {
        success: false,
        error: formatApiErrorBody(body, resp.status) || `Sign-up failed (${resp.status})`,
        status: resp.status,
        code: body.code,
      };
    }

    const jwt = parseAccessTokenFromAuthBody(body);
    if (jwt && typeof window !== 'undefined') {
      const storedEmail = localStorage.getItem(STORAGE_KEYS.auth.userEmail);
      if (storedEmail && storedEmail !== email) {
        clearAppStorage();
      }
      setJWT(jwt);
      localStorage.setItem(STORAGE_KEYS.auth.userEmail, email);
      persistAuthUserFromBody(body);
      syncExtensionSession();
    }

    return {
      success: true,
      message: body?.message || 'Account created successfully. Please check your email for confirmation.',
      jwt: jwt || null,
      userProfile: body?.userProfile,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * GET /api/user-profile — current user's profile row (requires Bearer JWT).
 * @returns {Promise<{ success: true, profile: object } | { success: false, error: string, status?: number }>}
 */
export const getUserProfile = async () => {
  const jwt = getJWT();
  if (!jwt) {
    return { success: false, error: 'Not authenticated.', status: 401 };
  }
  try {
    const resp = await fetch(`${API_BASE}/api/user-profile`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${jwt}` },
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        success: false,
        error: formatApiErrorBody(body, resp.status),
        status: resp.status,
      };
    }
    return { success: true, profile: body };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * POST /api/user-profile — create or upsert profile (requires Bearer JWT). See docs/USER_PROFILE_API.md.
 * @param {object} params
 * @param {string} params.username — non-empty, globally unique
 * @param {string} params.specialty — non-empty (e.g. medical specialty label)
 * @param {string} [params.jwt] — optional; defaults to stored JWT from sign-up / sign-in
 * @returns {Promise<{ success: true, profile: object } | { success: false, error: string, status?: number, code?: string }>}
 */
export const postUserProfile = async ({ username, specialty, jwt: jwtOverride }) => {
  const jwt = jwtOverride ?? getJWT();
  if (!jwt) {
    return {
      success: false,
      error:
        'No active session. If email confirmation is required, confirm your email and sign in, then try again.',
      status: 401,
    };
  }
  try {
    const resp = await fetch(`${API_BASE}/api/user-profile`, {
      method: 'POST',
      headers: authHeadersWithBearer(jwt),
      body: JSON.stringify({ username: username.trim(), specialty: specialty.trim() }),
    });
    const body = await resp.json().catch(() => ({}));

    console.log('[api postUserProfile] response', { status: resp.status, ok: resp.ok, body });

    if (!resp.ok) {
      return {
        success: false,
        error: formatApiErrorBody(body, resp.status),
        status: resp.status,
        code: body.code,
      };
    }
    return { success: true, profile: body };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * PATCH /api/user-profile — partial update (existing row only). At least one of username or specialty.
 * @returns {Promise<{ success: true, profile: object } | { success: false, error: string, status?: number, code?: string }>}
 */
export const patchUserProfile = async (partial) => {
  const jwt = getJWT();
  if (!jwt) {
    return { success: false, error: 'Not authenticated.', status: 401 };
  }
  const payload = {};
  if (partial.username != null) payload.username = partial.username;
  if (partial.specialty != null) payload.specialty = partial.specialty;
  if (Object.keys(payload).length === 0) {
    return { success: false, error: 'Nothing to update.', status: 400 };
  }
  try {
    const resp = await fetch(`${API_BASE}/api/user-profile`, {
      method: 'PATCH',
      headers: authHeadersWithBearer(jwt),
      body: JSON.stringify(payload),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        success: false,
        error: formatApiErrorBody(body, resp.status),
        status: resp.status,
        code: body.code,
      };
    }
    return { success: true, profile: body };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/** @deprecated Use {@link postUserProfile}. Kept for signup flow naming. */
export const saveSignupProviderProfile = postUserProfile;

// Resend confirmation email helper
export const resendConfirmationEmail = async (email) => {
  try {
    const resp = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action: 'resend', email }),
    });

    // Always return success for security (avoid email enumeration)
    // The server should handle the actual logic and return neutral responses
    return {
      success: true,
      message:
        'If an account exists for that email, a confirmation code has been sent. Check your inbox and spam.',
    };
  } catch (error) {
    return {
      success: false,
      error: 'Unable to send confirmation now — please try again later.'
    };
  }
};

/**
 * POST /api/auth with action confirm-sign-up (Cognito email verification code).
 * Distinct from confirm-forgot-password — codes are not interchangeable.
 * @param {string} email
 * @param {string} code — 6-digit code from the confirmation email
 * @returns {Promise<{ success: true, message: string } | { success: false, error: string }>}
 */
export const confirmSignUp = async (email, code) => {
  try {
    const resp = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        action: 'confirm-sign-up',
        email,
        code,
      }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        success: false,
        error: formatApiErrorBody(body, resp.status) || `Request failed (${resp.status})`,
      };
    }
    return {
      success: true,
      message: body?.message || 'Email confirmed successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to confirm email — please try again later.',
    };
  }
};

/**
 * POST /api/auth with action forgot-password. Cognito sends a 6-digit code by email.
 * Same neutral messaging whether or not the email exists (anti-enumeration).
 * @param {string} email
 * @param {{ turnstileToken?: string }} [options] - turnstileToken verified server-side when present (verify-if-present)
 * @returns {Promise<{ success: true, message: string } | { success: false, error: string }>}
 */
export const forgotPassword = async (email, options = {}) => {
  try {
    const payload = {
      action: 'forgot-password',
      email,
    };
    if (typeof options.turnstileToken === 'string' && options.turnstileToken) {
      payload.turnstileToken = options.turnstileToken;
    }

    const resp = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        success: false,
        error: formatApiErrorBody(body, resp.status) || `Request failed (${resp.status})`,
      };
    }
    return {
      success: true,
      message:
        body?.message ||
        'If an account exists for that email, a 6-digit reset code has been sent.',
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to send reset email — please try again later.',
    };
  }
};

/**
 * POST /api/auth with action confirm-forgot-password (Cognito code + new password).
 * @param {string} email
 * @param {string} code — 6-digit code from email
 * @param {string} newPassword
 * @returns {Promise<{ success: true, message: string } | { success: false, error: string }>}
 */
export const confirmForgotPassword = async (email, code, newPassword) => {
  try {
    const resp = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        action: 'confirm-forgot-password',
        email,
        code,
        newPassword,
      }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        success: false,
        error: formatApiErrorBody(body, resp.status) || `Request failed (${resp.status})`,
      };
    }
    return {
      success: true,
      message: body?.message || 'Your password has been updated.',
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unable to reset password — please try again later.',
    };
  }
};

// Sign-out helper: calls server to revoke session + clear httpOnly cookie (server-side),
// then clears local client token and tries to clear any non-httpOnly cookie named "refresh_token".
// By default this helper will NOT perform a redirect; pass { redirectTo: '/login' }
// or another URL if you want the function to navigate after sign-out.
// Name chosen as `handleSignOut` to match React event-handler naming conventions.
export const handleSignOut = async ({ redirectTo } = {}) => {
  if (typeof window === 'undefined') throw new Error('handleSignOut must be called in the browser');
  const jwt = getJWT();
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

  try {
    // POST to server endpoint which will revoke server-side refresh token and clear the httpOnly cookie
    const res = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      credentials: 'include', // send cookie so server can revoke and clear it
      headers,
      body: JSON.stringify({ action: 'sign-out' }),
    });

    // Always clear local JWT storage regardless of server response
    try { deleteJWT(); } catch (e) { /* ignore */ }
    notifyExtensionSignedOut();

    // Best-effort: clear non-httpOnly cookie named refresh_token (if any)
    try {
      document.cookie = 'refresh_token=; Path=/; Max-Age=0; SameSite=Lax;';
    } catch (e) { /* ignore */ }

    // If caller wants a redirect (default to /login), perform it now.
    if (redirectTo) {
      // use assign so back button behavior is normal
      try { window.location.assign(redirectTo); } catch (e) { window.location.href = redirectTo; }
      // return after initiating redirect
      return { success: res.ok, status: res.status };
    }

    if (res.ok) {
      return { success: true };
    }

    const body = await res.json().catch(() => null);
    return { success: false, status: res.status, error: body?.error || res.statusText };
  } catch (error) {
    // Network failure — still clear local state
    try { deleteJWT(); } catch (e) { /* ignore */ }
    notifyExtensionSignedOut();
    try { document.cookie = 'refresh_token=; Path=/; Max-Age=0; SameSite=Lax;'; } catch (e) { }
    if (redirectTo) {
      try { window.location.assign(redirectTo); } catch (e) { window.location.href = redirectTo; }
      return { success: false, error: error?.message || String(error) };
    }
    return { success: false, error: error?.message || String(error) };
  }
};

// Generic fetch helper that will try the request, and on 401 attempt a single
// refresh via /api/auth/refresh (credentials included) and retry once using
// the refreshed access token. Returns the original response if refresh fails.
export const fetchWithRefresh = async (input, init = {}) => {
  // Ensure input URL has API_BASE prefix if it's a relative path starting with /api
  const url = input.startsWith('/api') ? `${API_BASE}${input}` : input;

  const makeRequest = async (token) => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // default content-type if body present and not set
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const opts = { ...init, headers };
    return fetch(url, opts);
  };

  // try with existing client token if available
  let currentToken = getJWT();
  let resp = await makeRequest(currentToken);
  if (resp.status !== 401) return resp;

  // try refresh endpoint once
  const refreshResult = await refreshSession();
  if (!refreshResult.success) {
    return resp; // return original 401 response if refresh fails
  }

  // retry with new token
  try {
    resp = await makeRequest(refreshResult.token);
    return resp;
  } catch (e) {
    return resp;
  }
};

// Fetch all transcripts from backend
// Returns: { success: true, data: object } or { success: false, error: string }
export const getAllTranscripts = async () => {
  const result = await fetchWithRefreshRetry('/api/transcripts', {
    method: 'GET',
  });
  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Fetch all SOAP notes from backend
// Returns: { success: true, data: object } or { success: false, error: string }
// Fetch all SOAP notes from backend
// Returns: { success: true, data: object } or { success: false, error: string, status?: number }
export const getAllSoapNotes = async () => {
  const result = await fetchWithRefreshRetry('/api/soap-notes', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Fetch single SOAP note by ID
// Returns: { success: true, data: object } or { success: false, error: string, status?: number }
export const getSoapNoteById = async (id) => {
  const result = await fetchWithRefreshRetry(`/api/soap-notes/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Fetch single patient encounter by ID
// Returns: { success: true, data: object } or { success: false, error: string, status?: number }
export const getPatientEncounterById = async (id) => {
  const result = await fetchWithRefreshRetry(`/api/patient-encounters/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};
// Fetch all patient encounters from backend
// Returns: { success: true, data: object } or { success: false, error: string, status?: number }
/** @param {{ decryptName?: boolean }} [options] — backend defaults decryptName=false; pass true for decrypted names (legacy). */
export const getAllPatientEncounters = async (options = {}) => {
  const { decryptName = true } = options;
  const { limit = 50, offset = 0 } = options;
  const qs = new URLSearchParams({
    decryptName: decryptName ? 'true' : 'false',
    limit: limit.toString(),
    offset: offset.toString(),
  }).toString();
  const result = await fetchWithRefreshRetry(`/api/patient-encounters?${qs}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Fetch complete patient encounter bundle (encounter + recording + notes array)
// Returns: { success: true, data: object } or { success: false, error: string, status?: number }
export const getPatientEncounterComplete = async (id) => {
  const result = await fetchWithRefreshRetry(`/api/patient-encounters/complete/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Update patient encounter (e.g. name)
// Returns: { success: true, data: object, status?: number } or { success: false, error: string, status?: number }
export const patchPatientEncounter = async (id, { name }) => {
  const result = await fetchWithRefreshRetry(`/api/patient-encounters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
    cache: 'no-store',
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

/**
 * Hard-delete a patient encounter and cascaded rows (notes, recordings, PVS, Nova chats, jobs).
 * Does not cascade legacy SOAP notes.
 *
 * Success: { success: true, data, deleted, warnings, status }
 * Failure: { success: false, error, status?, code?, in_flight? }
 *   — 409 + code ENCOUNTER_DELETE_IN_FLIGHT when generation jobs are still running
 */
export const deletePatientEncounter = async (id) => {
  try {
    const response = await fetchWithRefresh(`/api/patient-encounters/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const body = /** @type {Record<string, unknown>} */ (
      await response.json().catch(() => ({}))
    );

    if (!response.ok) {
      return {
        success: false,
        error: formatApiErrorBody(body, response.status),
        status: response.status,
        code: typeof body.code === 'string' ? body.code : null,
        in_flight:
          body.in_flight && typeof body.in_flight === 'object' ? body.in_flight : null,
      };
    }

    return {
      success: true,
      data: body.data ?? null,
      deleted: body.deleted && typeof body.deleted === 'object' ? body.deleted : null,
      warnings: Array.isArray(body.warnings) ? body.warnings : [],
      status: response.status,
    };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
};

export const checkRefreshCookie = async () => {
  try {
    const resp = await fetch(`${API_BASE}/api/auth/cookie-status`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) return false;
    const body = await resp.json();
    return !!body?.cookiePresent;
  } catch (e) {
    console.warn("checkRefreshCookie failed:", e);
    return false;
  }
};

// Centralized session refresh function with mutex lock
// Rotates refresh token (httpOnly cookie) and returns fresh access token (JWT)
// Ensures only one refresh happens at a time, protecting against race conditions
export const refreshSession = async () => {
  const releaseLock = await acquireRefreshLock();

  try {
    const refreshResponse = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });

    if (!refreshResponse.ok) {
      const errorData = await refreshResponse.json().catch(() => ({}));
      return { success: false, error: errorData?.error || `Refresh failed: ${refreshResponse.status}` };
    }

    const refreshData = await refreshResponse.json();
    const newToken = refreshData?.accessToken || null;

    if (!newToken) {
      return { success: false, error: 'No token returned from refresh' };
    }

    // Store the new token
    setJWT(newToken);
    persistAuthUserFromBody(refreshData);
    syncExtensionSession();
    return { success: true, token: newToken };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      networkError: isNetworkFailure(error),
    };
  } finally {
    releaseLock();
  }
};

/** True for offline / transport failures — not invalid credentials. */
export const isNetworkFailure = (error) => {
  if (error == null) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  const name = typeof error === 'object' && error !== null ? error.name : '';
  const msg = String(
    typeof error === 'string' ? error : error?.message || error,
  );
  if (name === 'AbortError') return true;
  if (name === 'TypeError' && /failed to fetch|load failed|networkerror/i.test(msg)) {
    return true;
  }
  return /network|timed out|timeout|econnrefused|enotfound|err_internet_disconnected/i.test(
    msg,
  );
};

// Check JWT validity with automatic refresh attempt
export const checkJWTValidity = async () => {
  const jwt = getJWT();
  if (!jwt) {
    return { valid: false, error: 'No JWT found' };
  }

  const makeValidityRequest = async (token) => {
    return fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'check-validity' }),
    });
  };

  try {
    // First attempt with current JWT
    let response = await makeValidityRequest(jwt);

    // If unauthorized (401), try to refresh the token
    if (response.status === 401) {
      console.log('JWT invalid, attempting refresh...');
      const refreshResult = await refreshSession();

      if (refreshResult.success) {
        // No need to re-check validity - refresh success means token is valid
        console.log('Token refreshed successfully');
        return {
          valid: true,
          refreshed: true,
          data: { valid: true, message: 'Token refreshed successfully' }
        };
      }

      // Refresh failed, return original error with refresh attempt info
      console.warn('Token refresh failed:', refreshResult.error);
      return {
        valid: false,
        error: `Token invalid and refresh failed: ${refreshResult.error}`,
        refreshAttempted: true
      };
    }

    // Token was valid on first try
    if (!response.ok) {
      return {
        valid: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    return { valid: data.valid || false, data };

  } catch (error) {
    return { valid: false, error: error.message };
  }
};

// Check auth with retry: validates JWT, on 401 attempts refresh, returns whether user is authenticated
// This is a pre-validation approach (validates before making the actual request)
export const checkAuthWithRetry = async () => {
  const jwt = getJWT();
  if (!jwt) {
    return { valid: false, requiresLogin: true, error: 'No JWT found' };
  }
  
  const makeValidityRequest = async (token) => {
    return fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'check-validity' }),
    });
  };

  try {
    // First attempt with current JWT
    let response = await makeValidityRequest(jwt);
    
    // If unauthorized (401), try to refresh the token
    if (response.status === 401) {
      console.log('[Auth] JWT invalid, attempting refresh...');
      const refreshResult = await refreshSession();
      
      if (refreshResult.success) {
        console.log('[Auth] Token refreshed successfully');
        return { 
          valid: true, 
          refreshed: true,
          data: { valid: true, message: 'Token refreshed successfully' }
        };
      }
      
      // Refresh failed, user needs to login
      console.warn('[Auth] Token refresh failed:', refreshResult.error);
      return { 
        valid: false, 
        requiresLogin: true,
        error: `Token invalid and refresh failed: ${refreshResult.error}`,
        refreshAttempted: true
      };
    }
    
    // Token was valid on first try
    if (!response.ok) {
      return { 
        valid: false, 
        requiresLogin: true,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
    
    const data = await response.json();
    return { valid: data.valid || false, data };
    
  } catch (error) {
    return { valid: false, requiresLogin: true, error: error.message };
  }
};

// Check auth with refresh retry: validates JWT via fetchWithRefreshRetry (Tier 3)
// On 401: automatically refreshes token and retries
// Returns: { valid, data?, requiresLogin?, networkError?, error?, status? }
export const checkAuthWithRefreshRetry = async () => {
  const jwt = getJWT();
  if (!jwt) {
    return { valid: false, requiresLogin: true, error: 'No JWT found' };
  }

  try {
    // Use Tier 3 (fetchWithRefreshRetry): try request, on 401 refresh & retry
    const result = await fetchWithRefreshRetry('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-validity' }),
    });

    if (!result.success) {
      const networkError =
        result.networkError === true ||
        (result.status == null && isNetworkFailure(result.error));
      return {
        valid: false,
        requiresLogin: !networkError && result.status === 401,
        networkError,
        error: result.error,
        status: result.status,
      };
    }

    const resp = result.response;
    if (!resp.ok) {
      const networkError = resp.status >= 500;
      return {
        valid: false,
        requiresLogin: !networkError && (resp.status === 401 || resp.status === 403),
        networkError,
        error: `HTTP ${resp.status}: ${resp.statusText}`,
        status: resp.status,
      };
    }

    const data = await resp.json();
    const valid = data.valid || false;
    if (valid) {
      persistAuthUserFromAuthResponse(data);
      syncExtensionSession();
    }
    return {
      valid,
      requiresLogin: !valid,
      data,
    };

  } catch (error) {
    const networkError = isNetworkFailure(error);
    return {
      valid: false,
      requiresLogin: !networkError,
      networkError,
      error: error.message,
    };
  }
};

// Fetch with automatic auth validation: pre-validates JWT, refreshes if needed, then makes request
export const fetchWithAuthValidation = async (input, init = {}) => {
  // First, validate and refresh auth if necessary
  const authCheck = await checkAuthWithRetry();

  if (!authCheck.valid) {
    throw new Error(authCheck.error || 'Authentication failed. Please log in again.');
  }

  // Auth is valid, get the current (possibly refreshed) JWT
  const jwt = getJWT();
  if (!jwt) {
    throw new Error('No valid JWT available after auth check');
  }

  // Ensure input URL has API_BASE prefix if it's a relative path starting with /api
  const url = input.startsWith('/api') ? `${API_BASE}${input}` : input;

  // Make the actual request with validated token
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${jwt}`);

  // Set default content-type if body present and not set
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const opts = { ...init, headers };
  return fetch(url, opts);
};

/**
 * Refresh the access token when missing, expired, or within `bufferMs` of expiry.
 * @param {number} [bufferMs]
 */
export const ensureFreshAccessToken = async (bufferMs = 60_000) => {
  const jwt = getJWT();
  if (!jwt) {
    return { success: false, requiresLogin: true, error: 'No JWT found' };
  }
  if (!isJwtExpiredOrNearExpiry(jwt, bufferMs)) {
    return { success: true, token: jwt };
  }
  const refreshResult = await refreshSession();
  if (!refreshResult.success) {
    return {
      success: false,
      requiresLogin: !refreshResult.networkError,
      networkError: refreshResult.networkError === true,
      error: refreshResult.error,
    };
  }
  return { success: true, token: refreshResult.token };
};

/**
 * Resolve canonical `auth.users.id` and email from sign-in cache or check-validity.
 * Does not decode Cognito JWT `sub` or call profile endpoints.
 *
 * @param {{ refresh?: boolean }} [options]
 * @returns {Promise<
 *   | { success: true, userId: string, email: string }
 *   | { success: false, requiresLogin?: boolean, networkError?: boolean, error: string }
 * >}
 */
export const resolveAuthenticatedAppUser = async ({ refresh = true } = {}) => {
  if (refresh) {
    const fresh = await ensureFreshAccessToken();
    if (!fresh.success) {
      return {
        success: false,
        requiresLogin: fresh.requiresLogin === true,
        networkError: fresh.networkError === true,
        error: fresh.error || 'Authentication failed',
      };
    }
  }

  const jwt = getJWT();
  if (!jwt) {
    return { success: false, requiresLogin: true, error: 'No JWT found' };
  }

  const storedUserId = localStorage.getItem(STORAGE_KEYS.auth.currentUserId);
  const storedEmail = localStorage.getItem(STORAGE_KEYS.auth.userEmail);
  if (storedUserId && storedEmail) {
    return { success: true, userId: storedUserId, email: storedEmail };
  }

  const validity = await fetchWithRefreshRetry('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'check-validity' }),
  });

  if (!validity.success) {
    return {
      success: false,
      requiresLogin: validity.status === 401,
      networkError: validity.networkError === true,
      error: validity.error || 'Session validation failed',
    };
  }

  if (!validity.response.ok) {
    return {
      success: false,
      requiresLogin: validity.response.status === 401,
      networkError: validity.response.status >= 500,
      error: `HTTP ${validity.response.status}: ${validity.response.statusText}`,
    };
  }

  const data = await validity.response.json().catch(() => ({}));
  const user =
    data?.user && typeof data.user === 'object' ? data.user : null;
  const appUserId = user?.id || null;
  const email = user?.email || storedEmail || null;
  if (!appUserId || !email) {
    return { success: false, requiresLogin: true, error: 'Invalid session' };
  }

  setCurrentUserId(String(appUserId));
  localStorage.setItem(STORAGE_KEYS.auth.userEmail, String(email));
  return { success: true, userId: String(appUserId), email: String(email) };
};

/**
 * Tier 3: Simple fetch with 401 refresh-retry (lightweight alternative)
 * Use for: Lightweight data fetches where proactive checks aren't needed
 * Minimizes: Complexity, only refreshes on actual 401
 * Returns: { success: true, response, status } or { success: false, error, status? }
 */
// Helper to extract error message from error response
const parseErrorResponse = async (response) => {
  try {
    const body = await response.json();
    return formatApiErrorBody(body, response.status);
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
};

export const fetchWithRefreshRetry = async (url, options = {}) => {
  try {
    // Normalize URL
    const normalizedUrl = url.startsWith('/api') ? `${API_BASE}${url}` : url;

    // Step 1: Initial fetch attempt
    const jwt = getJWT();
    const headers = new Headers(options.headers || {});
    if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
    if (
      options.body &&
      !headers.has('Content-Type') &&
      !(options.body instanceof FormData)
    ) {
      headers.set('Content-Type', 'application/json');
    }

    let response = await fetch(normalizedUrl, {
      ...options,
      headers,
    });

    // Step 1 result: non-401 error or success
    if (response.status !== 401) {
      if (!response.ok) {
        const error = await parseErrorResponse(response);
        return {
          success: false,
          error,
          status: response.status,
        };
      }
      return { success: true, response, status: response.status };
    }

    // Step 2a: 401 received, attempt refresh
    const refreshResult = await refreshSession();

    if (!refreshResult.success) {
      const networkError = refreshResult.networkError === true;
      return {
        success: false,
        error: refreshResult.error,
        status: networkError ? undefined : 401,
        networkError,
        response: null,
      };
    }

    // Step 3: Refresh successful, retry fetch
    const newHeaders = new Headers(options.headers || {});
    newHeaders.set('Authorization', `Bearer ${refreshResult.token}`);
    if (
      options.body &&
      !newHeaders.has('Content-Type') &&
      !(options.body instanceof FormData)
    ) {
      newHeaders.set('Content-Type', 'application/json');
    }

    response = await fetch(normalizedUrl, {
      ...options,
      headers: newHeaders,
    });

    // Step 3: Return response with status (caller checks .ok)
    if (!response.ok) {
      const error = await parseErrorResponse(response);
      return {
        success: false,
        error,
        status: response.status,
        response: null,
      };
    }

    return { success: true, response, status: response.status };
  } catch (error) {
    return {
      success: false,
      response: null,
      error: error.message || 'Unknown error occurred',
      networkError: isNetworkFailure(error),
    };
  }
};

/**
 * Normalize org billing fields from API (snake_case and camelCase).
 * @param {Record<string, unknown>|null|undefined} source
 * @returns {Record<string, unknown>|null}
 */
function normalizeOrganizationFromApi(source) {
  if (!source || typeof source !== "object") return null;
  const s = /** @type {Record<string, unknown>} */ (source);
  const out = { ...s };
  const cancelRaw =
    "cancel_at_period_end" in s ? s.cancel_at_period_end : s.cancelAtPeriodEnd;
  if (cancelRaw !== undefined) {
    out.cancel_at_period_end = Boolean(cancelRaw);
  }
  const endRaw = "current_period_end" in s ? s.current_period_end : s.currentPeriodEnd;
  if (endRaw != null && String(endRaw).trim() !== "") {
    out.current_period_end = String(endRaw);
  }
  return out;
}

/**
 * GET /api/me/entitlements — plan and UX entitlements (Bearer JWT).
 * Optional `organization` (billing snapshot: period end, cancel-at-period-end, etc.) when the API includes it.
 * @returns {Promise<
 *   | { success: true; entitlements: object; organization: object | null; status: number }
 *   | { success: false; error: string; status?: number }
 * >}
 */
export const getMeEntitlements = async () => {
  const result = await fetchWithRefreshRetry('/api/me/entitlements', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      status: result.status,
    };
  }
  const body = await result.response.json().catch(() => ({}));
  const entitlements = body?.entitlements;
  if (!entitlements || typeof entitlements !== 'object') {
    return {
      success: false,
      error: 'Invalid entitlements response',
      status: result.status,
    };
  }
  const rawOrg = body?.organization;
  const merged =
    typeof rawOrg === "object" && rawOrg != null ? { ...rawOrg } : {};
  if (
    Object.prototype.hasOwnProperty.call(entitlements, "cancel_at_period_end") ||
    Object.prototype.hasOwnProperty.call(entitlements, "cancelAtPeriodEnd")
  ) {
    const c = entitlements.cancel_at_period_end ?? entitlements.cancelAtPeriodEnd;
    merged.cancel_at_period_end = Boolean(c);
  }
  const entEnd = entitlements.current_period_end ?? entitlements.currentPeriodEnd;
  if (entEnd != null && String(entEnd).trim() !== "") {
    merged.current_period_end = String(entEnd);
  }
  const organization =
    Object.keys(merged).length > 0 ? normalizeOrganizationFromApi(merged) : null;
  return {
    success: true,
    entitlements,
    organization,
    status: result.status,
  };
};

/**
 * POST /api/billing/checkout-session — Stripe Checkout (Bearer JWT).
 * Server accepts `{ "planKey": "pro" }` only; free and other keys return 400.
 * @param {'pro'} [planKey]
 * @returns {Promise<{ success: true, url: string, status: number } | { success: false, error: string, status?: number }>}
 */
export const createBillingCheckoutSession = async (planKey = 'pro') => {
  const result = await fetchWithRefreshRetry('/api/billing/checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ planKey }),
    cache: 'no-store',
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      status: result.status,
    };
  }
  const body = await result.response.json().catch(() => ({}));
  const url = body?.url;
  if (!url || typeof url !== 'string') {
    return {
      success: false,
      error: 'Invalid checkout response',
      status: result.status,
    };
  }
  return { success: true, url, status: result.status };
};

/**
 * GET /api/billing/status — personal org billing snapshot (Bearer JWT).
 * @returns {Promise<
 *   | {
 *       success: true;
 *       entitlements: object | null;
 *       organization: object | null;
 *       status: number;
 *     }
 *   | { success: false; error: string; status?: number }
 * >}
 */
/**
 * GET /api/baa/active — currently active BAA document (Bearer JWT).
 * @returns {Promise<
 *   | {
 *       success: true;
 *       baa: {
 *         version_number: string;
 *         title: string;
 *         content_markdown: string;
 *         effective_date: string;
 *       };
 *       status: number;
 *     }
 *   | { success: false; error: string; status?: number; code?: string }
 * >}
 */
export const getActiveBaa = async () => {
  const result = await fetchWithRefreshRetry('/api/baa/active', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      status: result.status,
    };
  }
  const body = await result.response.json().catch(() => ({}));
  if (!body?.content_markdown || typeof body.version_number !== 'string') {
    return {
      success: false,
      error: 'Invalid BAA response',
      status: result.status,
    };
  }
  return {
    success: true,
    status: result.status,
    baa: {
      version_number: body.version_number,
      title: typeof body.title === 'string' ? body.title : 'Business Associate Addendum',
      content_markdown: body.content_markdown,
      effective_date: body.effective_date != null ? String(body.effective_date) : '',
    },
  };
};

/**
 * GET /api/me/baa/status — org BAA acceptance gate (Bearer JWT).
 * @returns {Promise<
 *   | {
 *       success: true;
 *       status: {
 *         organization_id: string;
 *         active_version: string | null;
 *         acceptance: {
 *           id: string;
 *           version_number: string;
 *           accepted_at: string;
 *           accepted_by_user_id: string;
 *         } | null;
 *         needs_acceptance: boolean;
 *         can_accept: boolean;
 *       };
 *       httpStatus: number;
 *     }
 *   | { success: false; error: string; status?: number; code?: string }
 * >}
 */
export const getBaaStatus = async () => {
  const result = await fetchWithRefreshRetry('/api/me/baa/status', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      status: result.status,
    };
  }
  const body = await result.response.json().catch(() => ({}));
  return {
    success: true,
    httpStatus: result.status,
    status: {
      organization_id: body.organization_id != null ? String(body.organization_id) : '',
      active_version: body.active_version != null ? String(body.active_version) : null,
      acceptance:
        body.acceptance && typeof body.acceptance === 'object'
          ? {
              id: String(body.acceptance.id ?? ''),
              version_number: String(body.acceptance.version_number ?? ''),
              accepted_at: String(body.acceptance.accepted_at ?? ''),
              accepted_by_user_id: String(body.acceptance.accepted_by_user_id ?? ''),
            }
          : null,
      needs_acceptance: Boolean(body.needs_acceptance),
      can_accept: Boolean(body.can_accept),
    },
  };
};

/**
 * POST /api/me/baa/accept — record electronic BAA acceptance (Bearer JWT, org owner).
 * @param {string} [versionNumber] — active version from GET /api/baa/active
 * @returns {Promise<
 *   | {
 *       success: true;
 *       acceptance: {
 *         id: string;
 *         version_number: string;
 *         accepted_at: string;
 *         organization_id: string;
 *         accepted_by_user_id: string;
 *       };
 *       httpStatus: number;
 *     }
 *   | {
 *       success: false;
 *       error: string;
 *       status?: number;
 *       code?: string;
 *       active_version?: string;
 *     }
 * >}
 */
export const acceptBaa = async (versionNumber) => {
  const payload =
    versionNumber != null && String(versionNumber).trim() !== ''
      ? { version_number: String(versionNumber).trim() }
      : {};
  const result = await fetchWithRefreshRetry('/api/me/baa/accept', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Could not accept BAA.',
      status: result.status,
    };
  }
  const body = await result.response.json().catch(() => ({}));
  const acceptance = body?.acceptance;
  if (!acceptance || typeof acceptance !== 'object') {
    return {
      success: false,
      error: 'Invalid accept response',
      status: result.status,
    };
  }
  return {
    success: true,
    httpStatus: result.status,
    acceptance: {
      id: String(acceptance.id ?? ''),
      version_number: String(acceptance.version_number ?? ''),
      accepted_at: String(acceptance.accepted_at ?? ''),
      organization_id: String(acceptance.organization_id ?? ''),
      accepted_by_user_id: String(acceptance.accepted_by_user_id ?? ''),
    },
  };
};

export const getBillingStatus = async () => {
  const result = await fetchWithRefreshRetry('/api/billing/status', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      status: result.status,
    };
  }
  const body = await result.response.json().catch(() => ({}));
  const entitlements = body?.entitlements;
  const organization = body?.organization;
  return {
    success: true,
    status: result.status,
    entitlements:
      entitlements && typeof entitlements === 'object' ? entitlements : null,
    organization:
      organization && typeof organization === 'object'
        ? normalizeOrganizationFromApi(organization)
        : null,
  };
};

/**
 * POST /api/billing/schedule-cancel — set Stripe cancel_at_period_end (Bearer JWT, owner only).
 * No body. 400 `STRIPE_SUBSCRIPTION_MISSING` when org has no stored subscription id.
 * @returns {Promise<
 *   | {
 *       success: true;
 *       status: number;
 *       cancel_at_period_end: boolean;
 *       current_period_end: string | null;
 *       subscription_status: string | null;
 *     }
 *   | { success: false; error: string; status?: number }
 * >}
 */
export const postBillingScheduleCancel = async () => {
  const result = await fetchWithRefreshRetry('/api/billing/schedule-cancel', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      status: result.status,
    };
  }
  const body = await result.response.json().catch(() => ({}));
  return {
    success: true,
    status: result.status,
    cancel_at_period_end: Boolean(body?.cancel_at_period_end),
    current_period_end:
      body?.current_period_end != null ? String(body.current_period_end) : null,
    subscription_status:
      body?.subscription_status != null ? String(body.subscription_status) : null,
  };
};

/**
 * POST /api/billing/unschedule-cancel — clear Stripe cancel_at_period_end (Bearer JWT, owner only).
 * No body. Same response shape as schedule-cancel.
 * @returns {Promise<
 *   | {
 *       success: true;
 *       status: number;
 *       cancel_at_period_end: boolean;
 *       current_period_end: string | null;
 *       subscription_status: string | null;
 *     }
 *   | { success: false; error: string; status?: number }
 * >}
 */
export const postBillingUnscheduleCancel = async () => {
  const result = await fetchWithRefreshRetry('/api/billing/unschedule-cancel', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      status: result.status,
    };
  }
  const body = await result.response.json().catch(() => ({}));
  return {
    success: true,
    status: result.status,
    cancel_at_period_end: Boolean(body?.cancel_at_period_end),
    current_period_end:
      body?.current_period_end != null ? String(body.current_period_end) : null,
    subscription_status:
      body?.subscription_status != null ? String(body.subscription_status) : null,
  };
};

/**
 * Extract note template sections from a PDF via LLM.
 * POST multipart/form-data with field name `file` (application/pdf).
 * Success: 200 JSON { sections: [{ name, layout, details }, ...] }
 */
export const llmExtractNoteTemplateFromPdf = async (file) => {
  const formData = new FormData();
  formData.append('file', file, file.name);
  return fetchWithRefreshRetry('/api/note-templates/llm-extract', {
    method: 'POST',
    body: formData,
  });
};

// Fetch all dot phrases from backend
// Returns: { success: true, data: object } or { success: false, error: string, status?: number }
export const getAllDotPhrases = async () => {
  const result = await fetchWithRefreshRetry('/api/dot-phrases', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Fetch all note template sections from backend
// Returns: { success: true, data: array } or { success: false, error: string, status?: number }
// Data includes decrypted section.details (BE handles decryption)
export const getAllNoteSections = async () => {
  const result = await fetchWithRefreshRetry('/api/note-template-sections', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!result.success) {
    return result;
  }

  const data = await result.response.json();

  console.info('[getAllNoteSections] raw parsed JSON body', data);
  logNoteTemplateSectionsClassification(
    'getAllNoteSections immediately after response.json()',
    data
  );

  return { success: true, data, status: result.status };
};

// Save transcript to backend
// Returns: { success: true, data: object, status?: number } or { success: false, error: string, status?: number }
export const saveTranscript = async (transcriptObj) => {
  const result = await fetchWithRefreshRetry('/api/transcripts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(transcriptObj)
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Save SOAP note to backend
// Returns: { success: true, data: object, status?: number } or { success: false, error: string, status?: number }
export const saveSoapNote = async (soapNoteObj) => {
  const result = await fetchWithRefreshRetry('/api/soap-notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(soapNoteObj)
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Update SOAP note (including billing suggestion)
// Update SOAP note (including billing suggestion)
// Returns: { success: true, data: object, status?: number } or { success: false, error: string, status?: number }
export const patchSoapNote = async (id, { soapNote_text }) => {
  const result = await fetchWithRefreshRetry(`/api/soap-notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ soapNote_text }),
    cache: 'no-store',
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Create new dot phrase
// Returns: { success: true, data: object, status?: number } or { success: false, error: string, status?: number }
export const createDotPhrase = async (dotPhraseObj) => {
  const result = await fetchWithRefreshRetry('/api/dot-phrases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dotPhraseObj),
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Update existing dot phrase (ID in URL path)
// Returns: { success: true, data: object } or { success: false, error: string, status?: number }
export const updateDotPhrase = async (id, dotPhraseObj) => {
  const result = await fetchWithRefreshRetry(`/api/dot-phrases/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dotPhraseObj),
  });
  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Delete transcript by ID
// Returns: { success: true, data: object, status?: number } or { success: false, error: string, status?: number }
export const deleteTranscript = async (id) => {
  const result = await fetchWithRefreshRetry(`/api/transcripts/${id}`, {
    method: 'DELETE',
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Delete SOAP note by ID
// Returns: { success: true, data: object, status?: number } or { success: false, error: string, status?: number }
export const deleteSoapNote = async (id) => {
  const result = await fetchWithRefreshRetry(`/api/soap-notes/${id}`, {
    method: 'DELETE',
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Delete dot phrase by ID
// Returns: { success: true, data: object, status?: number } or { success: false, error: string, status?: number }
export const deleteDotPhrase = async (id) => {
  const result = await fetchWithRefreshRetry(`/api/dot-phrases/${id}`, {
    method: 'DELETE',
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Fetch recordings with attachment status filter
export const getRecordingsByAttached = async ({ attached, limit = 100, offset = 0, sortBy = 'name', order = 'asc' }) => {
  const queryParams = new URLSearchParams({
    attached: attached.toString(),
    limit: limit.toString(),
    offset: offset.toString(),
    sortBy,
    order
  });

  const result = await fetchWithRefreshRetry(`/api/recordings/attachments?${queryParams}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Fetch single recording by ID
// Fetch single recording by ID
// Returns: { success: true, data: object, status?: number } or { success: false, error: string, status?: number }
export const getRecordingById = async (id) => {
  const result = await fetchWithRefreshRetry(`/api/recordings/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Search transcripts by text (client-side after fetching all)
export const searchTranscripts = async (query) => {
  const result = await getAllTranscripts();
  if (!result.success) {
    console.error('Failed to search transcripts:', result.error);
    return [];
  }
  const transcripts = result.data;
  const results = [];

  for (const [id, transcript] of Object.entries(transcripts)) {
    if (transcript.text?.toLowerCase().includes(query.toLowerCase()) ||
      transcript.chiefComplaint?.toLowerCase().includes(query.toLowerCase())) {
      results.push(transcript);
    }
  }

  return results.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Step 2: Upload file to signed URL using XHR with progress tracking
 * 
 * Use case: After obtaining a signed URL from backend, upload file directly to it
 * 
 * Why XHR:
 * - Native progress events for real-time tracking
 * - Simpler error handling than fetch streams
 * - Works with all browsers
 * 
 * Note: Signed URL is self-authenticating (no JWT needed for this operation)
 */
export const xhrUploadToSignedUrl = async (signedUrl, file, onProgress) => {
  console.log('[xhrUploadToSignedUrl] Starting XHR upload to signed URL:', {
    fileName: file.name,
    fileSize: file.size
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = {
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
          };
          console.log('[xhrUploadToSignedUrl] Progress:', progress);
          onProgress(progress);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('[xhrUploadToSignedUrl] Upload successful:', {
          status: xhr.status,
        });
        resolve({ status: xhr.status });
      } else {
        console.error('[xhrUploadToSignedUrl] Upload returned non-2xx status:', xhr.status);
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      console.error('[xhrUploadToSignedUrl] XHR network error');
      reject(new Error('Upload failed: network error'));
    });

    xhr.addEventListener('abort', () => {
      console.warn('[xhrUploadToSignedUrl] Upload aborted by user');
      reject(new Error('Upload aborted'));
    });

    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
};

/**
 * Job-based LLM Processing API Functions
 * 
 * Workflow:
 * 1. createPromptLlmJob (generate-note) or createPromptLlmGenerateAndSaveJob (persist encounter + note) → jobId
 * 2. Poll getPromptLlmJobStatus(jobId) until complete/error (generate-and-save may include note_id when complete)
 * 3. getPromptLlmJobResult(jobId) → Full result with parsed SOAP note
 */

/**
 * @param {Record<string, unknown>} body
 * @param {object} [options]
 * @param {string|number} [options.noteTemplate_id]
 * @param {string} [options.pre_visit_summary_id]
 */
function appendOptionalPromptLlmJobFields(body, options = {}) {
  const tid = options.noteTemplate_id;
  if (tid !== undefined && tid !== null && tid !== '') {
    body.noteTemplate_id = tid;
  }
  const pvsId = options.pre_visit_summary_id;
  if (typeof pvsId === 'string' && pvsId.trim()) {
    body.pre_visit_summary_id = pvsId.trim();
  }
}

/**
 * @param {Response} response
 * @param {Record<string, unknown>} errorData
 * @returns {never}
 */
function throwPromptLlmJobCreateError(response, errorData) {
  const code = typeof errorData.code === 'string' ? errorData.code : undefined;
  const message =
    formatApiErrorBody(errorData, response.status) ||
    `Failed to create job: ${response.status}`;
  const err = new Error(message);
  if (code) err.code = code;
  err.status = response.status;
  throw err;
}

/**
 * Create a new prompt LLM job
 * @param {string} recordingPath - Path to recording file (backend derives signed URL)
 * @param {object} [options]
 * @param {string|number} [options.noteTemplate_id] - Note template id from UI; omit for backend default template
 * @param {string} [options.pre_visit_summary_id] - Optional pre-visit summary for spelling/vocabulary context
 * @returns {Promise<{id: string, status: string}>}
 */
export const createPromptLlmJob = async (recordingPath, options = {}) => {
  const jwt = getJWT();
  if (!jwt) throw new Error('Not authenticated');

  const body = {
    recording_file_path: recordingPath,
  };
  appendOptionalPromptLlmJobFields(body, options);

  try {
    const response = await fetch(`${API_BASE}/api/jobs/prompt-llm/generate-note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      throw new Error('Unauthorized: Please log in again');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throwPromptLlmJobCreateError(response, errorData);
    }

    const data = await response.json();
    console.log('[createPromptLlmJob] Job created:', { jobId: data.id, status: data.status });
    return data; // { id, status }
  } catch (error) {
    console.error('[createPromptLlmJob] Error:', error);
    throw error;
  }
};

/**
 * Create a prompt LLM job that generates SOAP and persists encounter + note (same as patient-encounters/complete).
 * @param {string} recordingPath - Path to recording file
 * @param {object} options
 * @param {string} options.patient_encounter_name - Required display name for the new encounter (encrypted server-side)
 * @param {string|number} [options.noteTemplate_id] - Optional note template id
 * @param {string} [options.pre_visit_summary_id] - Optional pre-visit summary; links to encounter when save succeeds
 * @returns {Promise<{id: string, status: string}>}
 */
export const createPromptLlmGenerateAndSaveJob = async (recordingPath, options = {}) => {
  const jwt = getJWT();
  if (!jwt) throw new Error('Not authenticated');

  const name = options.patient_encounter_name;
  if (name === undefined || name === null || String(name).trim() === '') {
    throw new Error('patient_encounter_name is required');
  }

  const body = {
    recording_file_path: recordingPath,
    patient_encounter_name: String(name).trim(),
  };
  appendOptionalPromptLlmJobFields(body, options);

  try {
    const response = await fetch(`${API_BASE}/api/jobs/prompt-llm/generate-and-save-note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      throw new Error('Unauthorized: Please log in again');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throwPromptLlmJobCreateError(response, errorData);
    }

    const data = await response.json();
    console.log('[createPromptLlmGenerateAndSaveJob] Job created:', { jobId: data.id, status: data.status });
    return data;
  } catch (error) {
    console.error('[createPromptLlmGenerateAndSaveJob] Error:', error);
    throw error;
  }
};

/**
 * Poll job status (lightweight - status only, no transcript/result)
 * @param {string} jobId - Job ID to poll
 * @returns {Promise<{id: string, status: string, error_message?: string, transcript_text?: string}>}
 */
export const getPromptLlmJobStatus = async (jobId) => {
  const jwt = getJWT();
  if (!jwt) throw new Error('Not authenticated');

  try {
    const response = await fetch(`${API_BASE}/api/jobs/prompt-llm/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
      },
    });

    if (response.status === 404) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Job not found: ${errorData.error || jobId}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusText = response.status === 500 ? 'Server error' : response.statusText;
      // Note: message must NOT start with 'Failed to fetch' or it will be
      // misclassified as a network error by isNetworkError()
      throw new Error(errorData.error || `Job status request failed: ${response.status} ${statusText}`);
    }

    const data = await response.json();
    return data; // { id, status, transcript_text?, error_message? }
  } catch (error) {
    console.error('[getPromptLlmJobStatus] Error:', error);
    throw error;
  }
};

/**
 * Get job result with parsed SOAP note (call when status === 'complete')
 * @param {string} jobId - Job ID to fetch result for
 * @returns {Promise<{id: string, status: string, transcript_text: string, soap_note: object, billing: object}>}
 */
export const getPromptLlmJobResult = async (jobId) => {
  const jwt = getJWT();
  if (!jwt) throw new Error('Not authenticated');

  try {
    const response = await fetch(`${API_BASE}/api/jobs/prompt-llm/${jobId}?includeResult=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
      },
    });

    if (response.status === 404) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Job not found: ${errorData.error || jobId}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const statusText = response.status === 500 ? 'Server error' : response.statusText;
      throw new Error(errorData.error || `Failed to fetch job result: ${response.status} ${statusText}`);
    }

    const data = await response.json();
    console.log('[getPromptLlmJobResult] Result fetched for job:', jobId);
    return data; // { id, status, transcript_text, soap_note, billing }
  } catch (error) {
    console.error('[getPromptLlmJobResult] Error:', error);
    throw error;
  }
};

// Lightweight list: id, patientEncounter_id, updated_at per note (no decrypted text).
// GET /api/notes
// Returns: { success: true, data: array } or { success: false, error: string, status?: number }
export const getAllNotes = async () => {
  const result = await fetchWithRefreshRetry('/api/notes', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!result.success) {
    return result;
  }

  const raw = await result.response.json();
  const data = normalizeNotesListResponse(raw);
  return { success: true, data, status: result.status };
};

// Full notes for the authenticated user (includes text and fields needed for editing/list previews).
// Uses GET /api/notes?complete=true so it is not mistaken for GET /api/notes/:id (id "complete" → "Invalid note ID format").
// Same payload shape as the former GET /api/notes response (array or id-keyed object of full note rows).
// Returns: { success: true, data: array } or { success: false, error: string, status?: number }
export const getAllNotesComplete = async (options = {}) => {
  const params = new URLSearchParams();
  if (options && typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (options && typeof options.offset === 'number') {
    params.set('offset', String(options.offset));
  }
  const qs = params.toString();
  const url = qs ? `/api/notes/complete?${qs}` : '/api/notes/complete';

  const result = await fetchWithRefreshRetry(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!result.success) {
    return result;
  }

  const raw = await result.response.json();
  const data = normalizeNotesListResponse(raw);
  return { success: true, data, status: result.status };
};

// Fetch single note by ID
// Returns: { success: true, data: object } or { success: false, error: string, status?: number }
export const getNoteById = async (id) => {
  const result = await fetchWithRefreshRetry(`/api/notes/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

// Update note (text content)
// Returns: { success: true, data: object, status?: number } or { success: false, error: string, status?: number }
export const patchNote = async (id, { text }) => {
  const result = await fetchWithRefreshRetry(`/api/notes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    cache: 'no-store',
  });

  if (!result.success) {
    return result;
  }

  const data = await result.response.json();
  return { success: true, data, status: result.status };
};

