/**
 * Access-token helpers for Supabase- and Cognito-shaped JWTs.
 * Cognito access tokens use `sub` (cognito_sub) and often omit `email` (use `username`).
 */

/**
 * @param {string} token
 * @returns {Record<string, unknown> | null}
 */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    const payload = JSON.parse(jsonPayload);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} token
 * @returns {number | null} expiry in ms since epoch
 */
export function getJwtExpiryMs(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp * 1000;
}

/**
 * @param {string} token
 * @param {number} [bufferMs]
 */
export function isJwtExpiredOrNearExpiry(token, bufferMs = 60_000) {
  const expiryMs = getJwtExpiryMs(token);
  if (!expiryMs) return true;
  return Date.now() >= expiryMs - bufferMs;
}

/** Lead time before access token `exp` to run proactive refresh (pool-agnostic). */
export const ACCESS_TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000;

/** Floor so very short TTLs do not tight-loop refresh timers. */
export const ACCESS_TOKEN_REFRESH_MIN_DELAY_MS = 30 * 1000;

/**
 * Ms until the next proactive refresh: `exp − margin − now`.
 * Works for any pool TTL (e.g. prod 3600s, dev 300s) — read from JWT `exp`.
 *
 * @param {string | null | undefined} token
 * @param {number} [marginMs]
 * @returns {number}
 */
export function msUntilAccessTokenRefresh(
  token,
  marginMs = ACCESS_TOKEN_REFRESH_MARGIN_MS,
) {
  const expiryMs = getJwtExpiryMs(token);
  if (!expiryMs) return ACCESS_TOKEN_REFRESH_MIN_DELAY_MS;
  const delay = expiryMs - marginMs - Date.now();
  if (delay <= 0) return 0;
  return Math.max(ACCESS_TOKEN_REFRESH_MIN_DELAY_MS, delay);
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string | null}
 */
export function resolveEmailFromJwtPayload(payload) {
  const candidates = [
    payload.email,
    payload.username,
    payload['cognito:username'],
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

/**
 * @param {string} jwt
 * @returns {{ id: string, email: string | null } | null}
 */
export function resolveIdentityFromAccessToken(jwt) {
  const payload = decodeJwtPayload(jwt);
  if (!payload) return null;
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!sub) return null;
  return {
    id: sub,
    email: resolveEmailFromJwtPayload(payload),
  };
}
