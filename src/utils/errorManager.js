// ─── Functional Error Manager ────────────────────────────────────────────────
// Pure functional helpers + safe async/sync wrappers for resilient state & API operations

export const ERROR_CODES = Object.freeze({
  NETWORK_ERROR: "NETWORK_ERROR",
  HIZB_LOAD_ERROR: "HIZB_LOAD_ERROR",
  HIZB_FETCH_FAILED: "HIZB_FETCH_FAILED",
  SURAH_LOAD_ERROR: "SURAH_LOAD_ERROR",
  ROUTE_PARSE_ERROR: "ROUTE_PARSE_ERROR",
  AUDIO_PLAYBACK_ERROR: "AUDIO_PLAYBACK_ERROR",
  STORAGE_ERROR: "STORAGE_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
});

/**
 * Pure factory creating an immutable, serializable error descriptor.
 */
export const createAppError = (
  code = ERROR_CODES.UNKNOWN_ERROR,
  message = "Une erreur inattendue est survenue",
  context = {},
  severity = "error"
) =>
  Object.freeze({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code: String(code || ERROR_CODES.UNKNOWN_ERROR),
    message: String(message || "Une erreur inattendue est survenue"),
    context: context && typeof context === "object" ? { ...context } : {},
    severity: ["info", "warning", "error", "critical"].includes(severity) ? severity : "error",
    timestamp: new Date().toISOString(),
  });

/**
 * Normalizes any thrown value (Error instance, string, or plain object) into an AppError.
 */
export const normalizeError = (
  rawError,
  fallbackCode = ERROR_CODES.UNKNOWN_ERROR,
  fallbackMessage = "Une erreur inattendue est survenue",
  context = {}
) => {
  if (!rawError) {
    return createAppError(fallbackCode, fallbackMessage, context);
  }
  if (typeof rawError === "object" && rawError.code && rawError.message && rawError.timestamp) {
    return createAppError(rawError.code, rawError.message, { ...rawError.context, ...context }, rawError.severity);
  }
  if (rawError instanceof Error) {
    return createAppError(
      rawError.name && rawError.name !== "Error" ? rawError.name : fallbackCode,
      rawError.message || fallbackMessage,
      context
    );
  }
  if (typeof rawError === "string") {
    return createAppError(fallbackCode, rawError, context);
  }
  return createAppError(
    rawError.code || fallbackCode,
    rawError.message || fallbackMessage,
    context
  );
};

/**
 * Functional synchronous tuple wrapper [error, result] for safe execution.
 */
export const safeSync = (fn, fallbackValue = null) => {
  try {
    return [null, fn()];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), fallbackValue];
  }
};

/**
 * Functional asynchronous tuple wrapper [error, result] for safe execution.
 */
export const safeAsync = async (asyncFn, fallbackValue = null) => {
  try {
    return [null, await asyncFn()];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), fallbackValue];
  }
};

/**
 * Pure functional synchronous wrapper that catches exceptions and returns { ok, value, error }.
 */
export const trySync = (fn, fallbackValue = null, context = {}) => {
  try {
    const value = fn();
    return Object.freeze({ ok: true, value, error: null });
  } catch (err) {
    const appError = normalizeError(err, ERROR_CODES.UNKNOWN_ERROR, "Erreur d'exécution synchrone", context);
    return Object.freeze({ ok: false, value: fallbackValue, error: appError });
  }
};

/**
 * Functional asynchronous wrapper that catches rejected promises and returns fallbackValue
 * while optionally reporting the normalized AppError to a handler/dispatcher.
 */
export const withErrorRecovery = async (
  asyncFn,
  fallbackValue = null,
  {
    code = ERROR_CODES.UNKNOWN_ERROR,
    message = "Opération échouée",
    context = {},
    onError = null,
  } = {}
) => {
  try {
    return await asyncFn();
  } catch (err) {
    const appError = normalizeError(err, code, message, context);
    if (typeof onError === "function") {
      try {
        onError(appError);
      } catch {}
    }
    return fallbackValue;
  }
};
