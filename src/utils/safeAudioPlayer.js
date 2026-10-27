// ─── Safe Audio Player Manager ───────────────────────────────────────────────
// Functional, resilient audio controller preventing unhandled play() promise rejections
// and "The play() request was interrupted by a new load request" DOMExceptions.

import { ERROR_CODES, createAppError, normalizeError } from "./errorManager.js";

/**
 * Pure predicate checking if an error is a benign audio playback interruption.
 * Occurs naturally in HTML5 Audio when switching verses or changing src/load
 * while a previous play() promise is resolving.
 * Reference: https://goo.gl/LdLk22
 *
 * @param {any} error
 * @returns {boolean}
 */
export const isAudioAbortError = (error) => {
  if (!error) return false;
  const name = typeof error === "object" ? error.name || "" : "";
  const msg = typeof error === "string" ? error : error.message || String(error || "");
  const lowerMsg = msg.toLowerCase();

  return (
    name === "AbortError" ||
    lowerMsg.includes("interrupted by a new load request") ||
    lowerMsg.includes("interrupted by a call to pause") ||
    lowerMsg.includes("play() request was interrupted") ||
    lowerMsg.includes("the play() request was interrupted") ||
    lowerMsg.includes("request was interrupted")
  );
};

/**
 * Pure predicate checking if an error is an autoplay permission restriction.
 *
 * @param {any} error
 * @returns {boolean}
 */
export const isAutoplayBlockedError = (error) => {
  if (!error) return false;
  const name = typeof error === "object" ? error.name || "" : "";
  const msg = typeof error === "string" ? error : error.message || String(error || "");
  return name === "NotAllowedError" || msg.toLowerCase().includes("notallowederror") || msg.toLowerCase().includes("user gesture");
};

/**
 * Safely plays an HTMLAudioElement or audio-like object.
 * Catches all promise rejections, gracefully silencing expected browser
 * abort/interruption errors and handling autoplay policy boundaries.
 *
 * @param {HTMLAudioElement|null|undefined} audioEl
 * @param {Function} [onSuccess]
 * @param {Function} [onError]
 * @returns {Promise<{ ok: boolean, aborted: boolean, error: any }>}
 */
export const safePlayAudio = async (audioEl, onSuccess = null, onError = null) => {
  if (!audioEl || typeof audioEl.play !== "function") {
    return { ok: false, aborted: false, error: null };
  }

  try {
    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.then === "function") {
      await playPromise;
      if (typeof onSuccess === "function") {
        try { onSuccess(); } catch {}
      }
      return { ok: true, aborted: false, error: null };
    }
    // Browser returned undefined/void for play() (older browsers)
    if (typeof onSuccess === "function") {
      try { onSuccess(); } catch {}
    }
    return { ok: true, aborted: false, error: null };
  } catch (err) {
    if (isAudioAbortError(err)) {
      // Benign lifecycle abort: playback was superseded by a load() or pause()
      return { ok: false, aborted: true, error: err };
    }

    if (isAutoplayBlockedError(err)) {
      console.warn("[SafeAudio] Lecture automatique bloquée par la politique du navigateur (interaction utilisateur requise).");
      if (typeof onError === "function") {
        try { onError(err); } catch {}
      }
      return { ok: false, aborted: false, error: err };
    }

    // Normalized error handling for unexpected audio failures
    const appError = normalizeError(
      err,
      ERROR_CODES.AUDIO_PLAYBACK_ERROR,
      "Erreur de lecture audio",
      { src: audioEl?.src }
    );
    console.warn("[SafeAudio] Erreur de lecture audio:", appError.message);
    if (typeof onError === "function") {
      try { onError(appError); } catch {}
    }
    return { ok: false, aborted: false, error: appError };
  }
};

/**
 * Safely pauses an audio element without throwing exceptions.
 *
 * @param {HTMLAudioElement|null|undefined} audioEl
 * @returns {boolean} True if pause succeeded
 */
export const safePauseAudio = (audioEl) => {
  if (!audioEl || typeof audioEl.pause !== "function") return false;
  try {
    audioEl.pause();
    return true;
  } catch (err) {
    if (!isAudioAbortError(err)) {
      console.warn("[SafeAudio] Pause ignorée suite à une erreur:", err);
    }
    return false;
  }
};

/**
 * Safely triggers load() on an audio element, catching any state exceptions.
 *
 * @param {HTMLAudioElement|null|undefined} audioEl
 * @returns {boolean} True if load succeeded
 */
export const safeLoadAudio = (audioEl) => {
  if (!audioEl || typeof audioEl.load !== "function") return false;
  try {
    audioEl.load();
    return true;
  } catch (err) {
    if (!isAudioAbortError(err)) {
      console.warn("[SafeAudio] Load ignoré suite à une erreur:", err);
    }
    return false;
  }
};

/**
 * Safely seeks to a given time in seconds, clamping between 0 and duration.
 *
 * @param {HTMLAudioElement|null|undefined} audioEl
 * @param {number} timeInSeconds
 * @returns {number} The actual currentTime applied
 */
export const safeSeekAudio = (audioEl, timeInSeconds) => {
  if (!audioEl) return 0;
  try {
    const rawSec = typeof timeInSeconds === "number" && !isNaN(timeInSeconds) ? timeInSeconds : 0;
    const dur = typeof audioEl.duration === "number" && !isNaN(audioEl.duration) ? audioEl.duration : Infinity;
    const target = Math.max(0, Math.min(dur, rawSec));
    audioEl.currentTime = target;
    return target;
  } catch {
    return 0;
  }
};

/**
 * Robust play-when-ready helper:
 * Tries playing immediately via safePlayAudio.
 * If the media is not yet ready (readyState < 2), registers a single canplay listener
 * that safely executes playback once enough data is buffered.
 *
 * @param {HTMLAudioElement|null|undefined} audioEl
 * @param {Function} [onSuccess]
 * @param {Function} [onError]
 * @returns {() => void} Cleanup function to remove listeners
 */
export const playWhenAudioReady = (audioEl, onSuccess = null, onError = null) => {
  if (!audioEl) return () => {};

  let cleanedUp = false;

  const tryPlay = () => {
    if (cleanedUp) return;
    safePlayAudio(audioEl, onSuccess, onError);
  };

  tryPlay();

  if (typeof audioEl.readyState === "number" && audioEl.readyState < 2) {
    const onCanPlay = () => {
      if (cleanedUp) return;
      audioEl.removeEventListener("canplay", onCanPlay);
      tryPlay();
    };
    audioEl.addEventListener("canplay", onCanPlay, { once: true });
    return () => {
      cleanedUp = true;
      audioEl.removeEventListener("canplay", onCanPlay);
    };
  }

  return () => {
    cleanedUp = true;
  };
};
