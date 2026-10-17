/** Preset ids for `POST /api/nova/chat-sessions/:chatId/completions` */
export const NOVA_MODEL_PRESETS = /** @type {const} */ (['haiku', 'sonnet', 'opus']);

/** @type {Record<(typeof NOVA_MODEL_PRESETS)[number], string>} */
export const NOVA_MODEL_LABELS = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
};

/**
 * Approximate max input context per preset (UI token meter only; server is source of truth).
 * Adjust if Bedrock model IDs change.
 */
export const NOVA_CONTEXT_LIMIT_BY_MODEL = {
  haiku: 200_000,
  sonnet: 200_000,
  opus: 200_000,
};

/** Rolling summarization is typically enqueued around this fraction of context (see NOVA_AI_ARCHITECTURE.md). */
export const NOVA_SUMMARIZE_TRIGGER_RATIO = 0.7;

/** UI ring turns amber at or above this fraction of the ~70% “summarize trigger” band (not medical). */
export const NOVA_TOKEN_RING_WARN_RATIO = 0.75;

/**
 * Max wall-clock wait for enqueue + job polling (async Bedrock; much longer than a single HTTP call).
 * @see `novaPollCompletionJob` in `@/lib/novaChatApi.js`
 */
export const NOVA_COMPLETION_MAX_WAIT_MS = 240_000;

/** @deprecated Prefer state-specific intervals below; kept as fallback override. */
export const NOVA_COMPLETION_POLL_INTERVAL_MS = 5000;

/** Poll interval while job is `pending`. @see NOVA_AI_ARCHITECTURE.md */
export const NOVA_COMPLETION_POLL_INTERVAL_PENDING_MS = 800;

/** Poll interval while `running` before first `assistant_partial`. */
export const NOVA_COMPLETION_POLL_INTERVAL_RUNNING_MS = 400;

/** Poll interval while `assistant_partial` is updating. */
export const NOVA_COMPLETION_POLL_INTERVAL_PARTIAL_MS = 300;

/** @deprecated Use NOVA_COMPLETION_MAX_WAIT_MS (job mode). Kept for any stray imports. */
export const NOVA_COMPLETION_TIMEOUT_MS = NOVA_COMPLETION_MAX_WAIT_MS;

/** If `summarize_pending` stays true longer than this, show a loud “summarize may have failed” banner. */
export const NOVA_SUMMARIZE_STUCK_MS = 90_000;

/** Server default when create omits `title` (see NOVA_AI_ARCHITECTURE.md). */
export const NOVA_DEFAULT_SESSION_TITLE = 'New Chat';

/** Max length for `POST` / `PATCH` session `title`. */
export const NOVA_SESSION_TITLE_MAX_CHARS = 40;

/** Light re-fetch window for async Haiku title after first completion. */
export const NOVA_AI_TITLE_POLL_MS = 30_000;

/** Interval between session re-fetches while waiting for AI title. */
export const NOVA_AI_TITLE_POLL_INTERVAL_MS = 3000;
