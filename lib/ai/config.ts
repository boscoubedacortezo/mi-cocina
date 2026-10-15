/** Model used for every AI task. Change it here. */
export const AI_MODEL = "claude-opus-5-5";

/** Thinking depth for recipe extraction: low | medium | high | xhigh | max. */
export const AI_EFFORT = "medium" as const;

/** Thinking depth for small, quick tasks such as estimating times and tags. */
export const AI_EFFORT_LIGHT = "low" as const;

/** Upper bound for a single extraction response. */
export const AI_MAX_TOKENS = 16_000;

/**
 * Must stay below the route's `maxDuration` so users get a clear error
 * instead of a platform timeout.
 */
export const AI_TIMEOUT_MS = 55_000;
