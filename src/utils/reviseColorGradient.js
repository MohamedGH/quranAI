// ─── Pure Functional Elapsed Time Color Gradient Engine ───────────────────────
// Computes an urgent gradient from blanc (#ffffff) -> jaune (#fef08a) -> orange (#fb923c) -> rouge (#ef4444)
// based on elapsed time since an item (word, character, ayat) was marked to revise.

/**
 * Standard thresholds in days for the gradient transitions:
 * - 0 days: Blanc (#ffffff) — tout juste marqué
 * - 2-3 days: Jaune (#fef08a / #facc15) — récent
 * - 6-7 days: Orange (#fb923c / #f97316) — modéré
 * - 14+ days: Rouge (#ef4444 / #dc2626) — urgent / en retard
 */
export const REVISE_COLOR_STOPS = Object.freeze([
  { t: 0.0, r: 255, g: 255, b: 255, hex: "#ffffff", label: "Récent (< 1 jour)" },
  { t: 0.33, r: 254, g: 240, b: 138, hex: "#fef08a", label: "Modéré (~ 3 jours)" },
  { t: 0.66, r: 251, g: 146, b: 60,  hex: "#fb923c", label: "Attention (~ 7 jours)" },
  { t: 1.0, r: 239, g: 68,  b: 68,  hex: "#ef4444", label: "Urgent (> 14 jours)" },
]);

/**
 * Interpolates between two RGB colors.
 */
function interpolateRgb(c1, c2, factor) {
  const f = Math.max(0, Math.min(1, factor));
  const r = Math.round(c1.r + (c2.r - c1.r) * f);
  const g = Math.round(c1.g + (c2.g - c1.g) * f);
  const b = Math.round(c1.b + (c2.b - c1.b) * f);
  return { r, g, b };
}

/**
 * Converts days elapsed into a normalized ratio [0..1] with maximum threshold (default 14 days).
 */
export function getElapsedRatio(daysElapsed, maxDays = 14) {
  if (!Number.isFinite(daysElapsed) || daysElapsed <= 0) return 0;
  return Math.min(1, Math.max(0, daysElapsed / maxDays));
}

/**
 * Calculates days elapsed between a date and now.
 */
export function getDaysElapsed(dateIsoOrTimestamp, now = new Date()) {
  if (!dateIsoOrTimestamp) return 0;
  try {
    const d = new Date(dateIsoOrTimestamp);
    if (isNaN(d.getTime())) return 0;
    const diffMs = now.getTime() - d.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Pure function: calculates the exact RGB, hex, and text/background styles
 * along the Blanc -> Jaune -> Orange -> Rouge spectrum based on days elapsed or a start date.
 *
 * @param {string|number|Date} date - Timestamp or ISO date when the item was marked
 * @param {object} options - { maxDays: 14, now: Date, isDarkTheme: true }
 */
export function getReviseTimeColor(date, options = {}) {
  const maxDays = options.maxDays || 14;
  const now = options.now || new Date();
  const days = typeof date === "number" && date >= 0 && date <= 10000 && !options.isTimestamp
    ? date
    : getDaysElapsed(date, now);

  const ratio = getElapsedRatio(days, maxDays);

  // Gradient stops:
  // [0..0.33]: Blanc (255, 255, 255) -> Jaune (254, 240, 138)
  // [0.33..0.66]: Jaune (254, 240, 138) -> Orange (251, 146, 60)
  // [0.66..1.0]: Orange (251, 146, 60) -> Rouge (239, 68, 68)
  let rgb;
  if (ratio <= 0.33) {
    const f = ratio / 0.33;
    rgb = interpolateRgb(REVISE_COLOR_STOPS[0], REVISE_COLOR_STOPS[1], f);
  } else if (ratio <= 0.66) {
    const f = (ratio - 0.33) / 0.33;
    rgb = interpolateRgb(REVISE_COLOR_STOPS[1], REVISE_COLOR_STOPS[2], f);
  } else {
    const f = (ratio - 0.66) / 0.34;
    rgb = interpolateRgb(REVISE_COLOR_STOPS[2], REVISE_COLOR_STOPS[3], f);
  }

  const hex = `#${((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1)}`;
  const rgbaBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`;
  const rgbaBorder = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`;
  const rgbaGlow = `0 0 8px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`;

  // Human readable label for elapsed time
  let timeLabel = "";
  if (days < 0.05) {
    timeLabel = "À l'instant";
  } else if (days < 1) {
    const hours = Math.round(days * 24);
    timeLabel = `${hours}h`;
  } else {
    const d = Math.round(days);
    timeLabel = `${d}j`;
  }

  return {
    ratio,
    days: Math.round(days * 10) / 10,
    hex,
    rgb,
    rgbaBg,
    rgbaBorder,
    rgbaGlow,
    timeLabel,
    style: {
      color: hex,
      backgroundColor: rgbaBg,
      borderColor: rgbaBorder,
      boxShadow: rgbaGlow,
    },
  };
}

/**
 * Resolves the effective revision date for a specific word or ayat
 * using toRevise, wordsReviseDates, or reviseHistory.
 */
export function getWordReviseDate(ld, wordIdx = null) {
  if (!ld?.toRevise) return null;

  // 1. Direct word-level date if recorded
  if (wordIdx !== null && ld.wordsReviseDates?.[wordIdx]) {
    return ld.wordsReviseDates[wordIdx];
  }

  // 2. Look in reviseHistory for the session marking this word
  if (Array.isArray(ld.reviseHistory) && ld.reviseHistory.length > 0) {
    const openSession = [...ld.reviseHistory].reverse().find(s => !s.endDate);
    if (openSession?.startDate) {
      if (wordIdx === null || openSession.words === "all" || (Array.isArray(openSession.words) && openSession.words.includes(wordIdx))) {
        return openSession.startDate;
      }
    }
  }

  // 3. Fallback to ayat-level milestone
  return ld.lastRevisedAt || ld.firstRevisedAt || ld.updatedAt || ld.createdAt || null;
}
