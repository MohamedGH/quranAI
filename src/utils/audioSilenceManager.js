// ─── Pure Functional Audio Silence & Masking Manager ──────────────────────────
// Enables muting or skipping designated words (e.g. words marked for revision)
// during recitation playback, strictly requiring valid word-level timestamps.

import { ERROR_CODES, trySync, createAppError } from "./errorManager.js";
import { fixChars } from "./reciterAudio.js";

/**
 * Pure check: verifies if timestamps are provided and contain valid word timing data.
 * @param {object|null|undefined} timestamps
 * @returns {boolean}
 */
export const hasAyatTimestamps = (timestamps) =>
  trySync(
    () => {
      if (!timestamps || typeof timestamps !== "object") return false;
      const words = Array.isArray(timestamps.words) ? timestamps.words : null;
      if (!words || words.length === 0) return false;

      // At least one word must have valid numeric start and end timings (either via chars or direct)
      return words.some((w) => {
        if (!w || typeof w !== "object") return false;
        if (typeof w.start === "number" && typeof w.end === "number" && w.end > w.start) {
          return true;
        }
        const chars = Array.isArray(w.chars) ? w.chars : [];
        if (chars.length > 0) {
          const first = chars[0];
          const last = chars[chars.length - 1];
          return (
            typeof first?.start === "number" &&
            typeof last?.end === "number" &&
            last.end > first.start
          );
        }
        return false;
      });
    },
    false,
    { code: ERROR_CODES.AUDIO_PLAYBACK_ERROR, context: "hasAyatTimestamps" }
  ).value;

/**
 * Pure function: extracts normalized word timings from timestamps data.
 * @param {object|null|undefined} timestamps
 * @returns {ReadonlyArray<{ index: number, text: string, startMs: number, endMs: number, durationMs: number }>}
 */
export const extractWordTimings = (timestamps) =>
  trySync(
    () => {
      if (!hasAyatTimestamps(timestamps)) return Object.freeze([]);
      const words = timestamps.words || [];

      const extracted = words.map((w, index) => {
        const fixed = fixChars(Array.isArray(w.chars) ? w.chars : []);
        const wordText =
          fixed.length > 0
            ? fixed.map((c) => c.char || "").join("")
            : typeof w.text === "string"
            ? w.text
            : `mot_${index + 1}`;

        let startMs = null;
        let endMs = null;

        if (fixed.length > 0) {
          startMs = fixed[0].start != null ? Math.round(fixed[0].start) : null;
          endMs = fixed[fixed.length - 1].end != null ? Math.round(fixed[fixed.length - 1].end) : null;
        }

        if (startMs == null && typeof w.start === "number") {
          startMs = Math.round(w.start);
        }
        if (endMs == null && typeof w.end === "number") {
          endMs = Math.round(w.end);
        }

        const validRange = startMs != null && endMs != null && endMs >= startMs;
        const s = validRange ? startMs : 0;
        const e = validRange ? endMs : 0;

        return Object.freeze({
          index,
          text: wordText.trim(),
          startMs: s,
          endMs: e,
          durationMs: Math.max(0, e - s),
          isValid: validRange,
        });
      });

      return Object.freeze(extracted);
    },
    Object.freeze([]),
    { code: ERROR_CODES.AUDIO_PLAYBACK_ERROR, context: "extractWordTimings" }
  ).value;

/**
 * Pure function: resolves which word indices should be silenced.
 * Combines verse learning data (toRevise flags) and any custom user selections.
 *
 * @param {object} params
 * @param {object|null} params.ld - Learn data for this ayat
 * @param {ReadonlyArray<number>|null} params.customIndices - Custom chosen indices
 * @param {number} params.totalWords - Total number of words in this ayat
 * @returns {ReadonlyArray<number>} sorted unique array of word indices
 */
export const resolveSilencedWordIndices = ({
  ld = null,
  customIndices = [],
  totalWords = 0,
} = {}) =>
  trySync(
    () => {
      const indicesSet = new Set();
      const count = Number.isFinite(totalWords) && totalWords > 0 ? totalWords : 0;

      // 1. Check ld.toRevise
      const toRevise = ld?.toRevise;
      if (toRevise === true && count > 0) {
        // Entire ayat is to revise -> all words
        for (let i = 0; i < count; i++) {
          indicesSet.add(i);
        }
      } else if (toRevise && typeof toRevise === "object") {
        // Specific words in toRevise.words
        if (Array.isArray(toRevise.words)) {
          toRevise.words
            .filter((i) => typeof i === "number" && i >= 0 && (count === 0 || i < count))
            .forEach((i) => indicesSet.add(i));
        }

        // Parts marked for revision in toRevise.parts
        if (Array.isArray(toRevise.parts) && Array.isArray(ld?.parts)) {
          const partsToRevise = ld.parts.filter((p) => toRevise.parts.includes(p.id));
          partsToRevise.forEach((p) => {
            if (Array.isArray(p.wordIndices)) {
              p.wordIndices
                .filter((i) => typeof i === "number" && i >= 0 && (count === 0 || i < count))
                .forEach((i) => indicesSet.add(i));
            }
          });
        }
      }

      // 2. Add custom indices
      if (Array.isArray(customIndices)) {
        customIndices
          .filter((i) => typeof i === "number" && i >= 0 && (count === 0 || i < count))
          .forEach((i) => indicesSet.add(i));
      }

      return Object.freeze([...indicesSet].sort((a, b) => a - b));
    },
    Object.freeze([]),
    { code: ERROR_CODES.AUDIO_PLAYBACK_ERROR, context: "resolveSilencedWordIndices" }
  ).value;

/**
 * Pure function: merges adjacent or overlapping time intervals.
 * @param {ReadonlyArray<{ startMs: number, endMs: number, wordIndex?: number, text?: string }>} intervals
 * @returns {ReadonlyArray<{ startMs: number, endMs: number, wordIndices: number[], texts: string[] }>}
 */
export const mergeSilenceIntervals = (intervals = []) =>
  trySync(
    () => {
      if (!intervals || intervals.length === 0) return Object.freeze([]);

      // Sort copy by startMs
      const sorted = [...intervals]
        .filter((inv) => inv && inv.endMs > inv.startMs)
        .sort((a, b) => a.startMs - b.startMs);

      if (sorted.length === 0) return Object.freeze([]);

      const merged = sorted.reduce((acc, curr) => {
        if (acc.length === 0) {
          return [
            {
              startMs: curr.startMs,
              endMs: curr.endMs,
              wordIndices: curr.wordIndex != null ? [curr.wordIndex] : curr.wordIndices || [],
              texts: curr.text ? [curr.text] : curr.texts || [],
            },
          ];
        }

        const prev = acc[acc.length - 1];
        // Allow a small gap (e.g. 30ms) between adjacent words to avoid audio clicking/stutter
        if (curr.startMs <= prev.endMs + 30) {
          prev.endMs = Math.max(prev.endMs, curr.endMs);
          if (curr.wordIndex != null && !prev.wordIndices.includes(curr.wordIndex)) {
            prev.wordIndices.push(curr.wordIndex);
          }
          if (curr.text && !prev.texts.includes(curr.text)) {
            prev.texts.push(curr.text);
          }
          return acc;
        }

        acc.push({
          startMs: curr.startMs,
          endMs: curr.endMs,
          wordIndices: curr.wordIndex != null ? [curr.wordIndex] : curr.wordIndices || [],
          texts: curr.text ? [curr.text] : curr.texts || [],
        });
        return acc;
      }, []);

      return Object.freeze(merged.map((m) => Object.freeze(m)));
    },
    Object.freeze([]),
    { code: ERROR_CODES.AUDIO_PLAYBACK_ERROR, context: "mergeSilenceIntervals" }
  ).value;

/**
 * Pure function: computes the silence intervals given timestamps and silenced word indices.
 * @param {object|null|undefined} timestamps
 * @param {ReadonlyArray<number>} silencedIndices
 * @returns {ReadonlyArray<{ startMs: number, endMs: number, wordIndex: number, text: string }>}
 */
export const computeSilenceIntervals = (timestamps, silencedIndices = []) =>
  trySync(
    () => {
      if (!hasAyatTimestamps(timestamps)) return Object.freeze([]);
      const wordTimings = extractWordTimings(timestamps);
      if (!wordTimings.length || !silencedIndices.length) return Object.freeze([]);

      const targetSet = new Set(silencedIndices);

      const rawIntervals = wordTimings
        .filter((w) => targetSet.has(w.index) && w.isValid)
        .map((w) =>
          Object.freeze({
            startMs: w.startMs,
            endMs: w.endMs,
            wordIndex: w.index,
            text: w.text,
          })
        );

      return Object.freeze(rawIntervals);
    },
    Object.freeze([]),
    { code: ERROR_CODES.AUDIO_PLAYBACK_ERROR, context: "computeSilenceIntervals" }
  ).value;

/**
 * Pure predicate: determines if current playback time (ms) falls into a silence interval.
 * @param {number} currentMs
 * @param {ReadonlyArray<{ startMs: number, endMs: number }>} intervals
 * @returns {boolean}
 */
export const isTimeInSilenceInterval = (currentMs, intervals = []) => {
  if (typeof currentMs !== "number" || !intervals || intervals.length === 0) return false;
  return intervals.some((inv) => currentMs >= inv.startMs && currentMs < inv.endMs);
};

/**
 * Pure finder: retrieves the active silence interval for the given playback time.
 * @param {number} currentMs
 * @param {ReadonlyArray<{ startMs: number, endMs: number, wordIndex?: number, text?: string }>} intervals
 * @returns {object|null}
 */
export const findActiveSilenceInterval = (currentMs, intervals = []) => {
  if (typeof currentMs !== "number" || !intervals || intervals.length === 0) return null;
  return intervals.find((inv) => currentMs >= inv.startMs && currentMs < inv.endMs) || null;
};

/**
 * Pure function: calculates the target seek time in "skip" mode.
 * If inside a silence interval, returns the interval end time (+ small offset).
 * Otherwise returns currentMs.
 * @param {number} currentMs
 * @param {ReadonlyArray<{ startMs: number, endMs: number }>} intervals
 * @param {number} [bufferMs=15]
 * @returns {number}
 */
export const calculateNextPlaybackTime = (currentMs, intervals = [], bufferMs = 15) => {
  const active = findActiveSilenceInterval(currentMs, intervals);
  return active ? active.endMs + bufferMs : currentMs;
};

/**
 * Pure functional toggle of an item in a list without mutation.
 * @param {ReadonlyArray<number>} list
 * @param {number} item
 * @returns {ReadonlyArray<number>}
 */
export const toggleWordInList = (list = [], item) => {
  if (!Array.isArray(list)) return Object.freeze([item]);
  const exists = list.includes(item);
  const next = exists ? list.filter((x) => x !== item) : [...list, item];
  return Object.freeze(next.sort((a, b) => a - b));
};

/**
 * Pure status generator: produces a complete descriptive report for UI display.
 */
export const formatSilenceStatus = ({
  hasTimestamps = false,
  totalWords = 0,
  silencedCount = 0,
  mode = "mute", // 'mute' | 'skip'
  isCurrentlySilenced = false,
  activeWordText = "",
} = {}) => {
  if (!hasTimestamps) {
    return Object.freeze({
      canSilence: false,
      isSilencedNow: false,
      badgeColor: "#f59e0b", // amber
      badgeText: "Timestamps requis",
      label: "Timestamps non fournis",
      description:
        "Le masquage audio précis mot par mot nécessite les timestamps audio de ce verset.",
      requiresTimestampsNotice: true,
    });
  }

  if (silencedCount === 0) {
    return Object.freeze({
      canSilence: true,
      isSilencedNow: false,
      badgeColor: "#3eb8a0", // teal
      badgeText: "Timestamps fournis ✓",
      label: "Aucun mot à réviser sélectionné",
      description:
        "Marquez des mots à réviser (🔖) ou cliquez sur un mot pour le passer sous silence pendant l'écoute.",
      requiresTimestampsNotice: false,
    });
  }

  return Object.freeze({
    canSilence: true,
    isSilencedNow: isCurrentlySilenced,
    badgeColor: isCurrentlySilenced ? "#ef4444" : "#ff7eb3", // pink / red
    badgeText: isCurrentlySilenced
      ? `🤫 Silence en cours : ${activeWordText || "Mot masqué"}`
      : `${silencedCount} mot${silencedCount > 1 ? "s" : ""} sous silence (${mode === "skip" ? "Saut" : "Muet"})`,
    label: `${silencedCount} sur ${totalWords || "?"} mots passés sous silence`,
    description:
      mode === "skip"
        ? "Les mots à réviser sont sautés automatiquement dans le flux audio."
        : "Le récitateur est passé sous silence pendant la durée exacte des mots à réviser.",
    requiresTimestampsNotice: false,
  });
};
