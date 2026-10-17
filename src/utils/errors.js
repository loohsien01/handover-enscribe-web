/**
 * Error detection and categorization utilities
 */

/**
 * Turn a parsed JSON error response body into a single user-facing string.
 * Handles ZodError (issues serialized in error.message), string errors, and common API shapes.
 *
 * @param {Record<string, unknown>|null|undefined} body
 * @param {number} [status] - HTTP status for fallback text
 * @returns {string}
 */
export const formatApiErrorBody = (body, status) => {
  const fallback = Number.isFinite(status) ? `Request failed (${status})` : 'Request failed';

  if (!body || typeof body !== 'object') {
    return fallback;
  }

  if (body.code === 'USERNAME_TAKEN') {
    return typeof body.error === 'string' ? body.error : 'That username is already taken.';
  }
  if (body.code === 'AUTH_USER_NOT_FOUND' || body.code === 'AUTH_USER_CHECK_FAILED') {
    return typeof body.error === 'string' ? body.error : 'Account could not be verified.';
  }
  if (body.code === 'FOREIGN_KEY_VIOLATION') {
    return typeof body.error === 'string' ? body.error : 'Invalid user reference.';
  }
  if (body.code === 'PRE_VISIT_SUMMARY_ALREADY_LINKED') {
    return typeof body.error === 'string'
      ? body.error
      : 'This pre-visit summary is already attached to a patient visit.';
  }
  if (body.code === 'PRE_VISIT_SUMMARY_NOT_FOUND') {
    return typeof body.error === 'string'
      ? body.error
      : 'Pre-visit summary not found.';
  }
  if (body.code === 'PRE_VISIT_SUMMARY_INVALID_ID') {
    return typeof body.error === 'string' ? body.error : 'Invalid pre-visit summary id.';
  }
  if (body.code === 'ENCOUNTER_DELETE_IN_FLIGHT') {
    return typeof body.error === 'string'
      ? body.error
      : 'Cannot delete encounter while jobs are in flight.';
  }

  const err = body.error;

  if (err && typeof err === 'object' && err.name === 'ZodError' && typeof err.message === 'string') {
    try {
      const parsed = JSON.parse(err.message);
      if (Array.isArray(parsed)) {
        const parts = parsed
          .map((issue) => (issue && typeof issue.message === 'string' ? issue.message : null))
          .filter(Boolean);
        if (parts.length > 0) {
          return parts.join('; ');
        }
      }
    } catch {
      // ignore invalid JSON in message
    }
    return 'Validation failed.';
  }

  if (err && typeof err === 'object' && typeof err.message === 'string') {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (typeof body.message === 'string') {
    return body.message;
  }

  return fallback;
};

/**
 * Detect if an error is network-related
 * Checks for common network failure patterns (connection loss, timeouts, offline, etc.)
 * @param {Error} error - The error to check
 * @returns {boolean} True if error is network-related
 */
export const isNetworkError = (error) => {
  const message = error.message || '';
  const errorMsg = message.toLowerCase();

  // Server-generated errors arrive as colon-chained messages
  // (e.g. "Transcription failed: Binary upload failed: 400 Bad Request").
  // These always have content like "Word(s): more detail" and are NOT browser
  // connectivity failures. Exclude them before checking any patterns.
  // Browser-native errors are short, standardized, and never have this shape.
  const SERVER_ERROR_PATTERN = /^[A-Za-z][A-Za-z0-9 _]+: .+/;
  if (SERVER_ERROR_PATTERN.test(message) &&
      !errorMsg.startsWith('failed to fetch') &&
      !errorMsg.startsWith('network') &&
      !errorMsg.startsWith('load failed')) {
    return false;
  }

  if (error.name === 'TypeError' && errorMsg.includes('fetch')) return true;
  return errorMsg.includes('failed to fetch') ||
         errorMsg.includes('networkerror') ||
         errorMsg.includes('network error') ||
         errorMsg.includes('load failed') ||
         errorMsg.includes('connection') ||
         errorMsg.includes('offline') ||
         errorMsg.includes('timeout') ||
         errorMsg.includes('aborted');
};
