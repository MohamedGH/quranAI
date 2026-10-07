// ─── Quran Domain Model & Canonical Navigation Utilities ──────────────────────
// Pure functional computations for Surah, Ayah, Page, Juz, Hizb, Rub' (quarter),
// global ayah indices, and cross-surah boundaries.

import { SURAH_INFO } from "./arabicUtils.js";
import { HIZB_START_REFS } from "./hizbUtils.js";

/**
 * Total verses in the Holy Quran (Hafs).
 */
export const TOTAL_QURAN_VERSES = 6236;
export const TOTAL_SURAHS = 114;
export const TOTAL_HIZBS = 60;
export const TOTAL_JUZS = 30;
export const TOTAL_PAGES = 604;

/**
 * Precomputed cumulative offsets per Surah (1-indexed).
 */
export const SURAH_OFFSETS = Object.freeze(
  SURAH_INFO.reduce(
    (acc, s) => {
      const prevOffset = acc[s.n] || 0;
      acc[s.n + 1] = prevOffset + s.count;
      return acc;
    },
    { 1: 0 }
  )
);

/**
 * Purely computes the global Quranic verse index (1..6236).
 */
export function getGlobalVerseNumber(surahNum, numberInSurah) {
  const sn = Number(surahNum);
  const an = Number(numberInSurah);
  if (!Number.isFinite(sn) || !Number.isFinite(an) || sn < 1 || sn > 114 || an < 1) return null;
  return (SURAH_OFFSETS[sn] ?? 0) + an;
}

/**
 * Purely retrieves the Surah metadata (1..114).
 */
export function getSurahMeta(surahNum) {
  const sn = Math.max(1, Math.min(114, Number(surahNum) || 1));
  return SURAH_INFO[sn - 1] || { n: sn, en: `Surah ${sn}`, ar: `${sn}`, count: 1 };
}

/**
 * Purely validates if a verse (surahNum, numberInSurah) exists.
 */
export function isValidVerse(surahNum, numberInSurah) {
  const sn = Number(surahNum);
  const an = Number(numberInSurah);
  if (!Number.isFinite(sn) || !Number.isFinite(an)) return false;
  if (sn < 1 || sn > 114) return false;
  const meta = SURAH_INFO[sn - 1];
  return !!meta && an >= 1 && an <= meta.count;
}

/**
 * Computes next verse coordinates (cross-surah capable).
 */
export function getNextVerseCoordinates(surahNum, numberInSurah) {
  const sn = Number(surahNum);
  const an = Number(numberInSurah);
  const meta = getSurahMeta(sn);
  if (an < meta.count) {
    return { surahNum: sn, numberInSurah: an + 1, isNewSurah: false };
  }
  if (sn < 114) {
    return { surahNum: sn + 1, numberInSurah: 1, isNewSurah: true };
  }
  return null; // End of Quran
}

/**
 * Computes previous verse coordinates (cross-surah capable).
 */
export function getPreviousVerseCoordinates(surahNum, numberInSurah) {
  const sn = Number(surahNum);
  const an = Number(numberInSurah);
  if (an > 1) {
    return { surahNum: sn, numberInSurah: an - 1, isNewSurah: false };
  }
  if (sn > 1) {
    const prevMeta = getSurahMeta(sn - 1);
    return { surahNum: sn - 1, numberInSurah: prevMeta.count, isNewSurah: true };
  }
  return null; // Beginning of Quran
}

/**
 * Computes Juz number (1..30) from Hizb (1..60) or (surahNum, numberInSurah).
 */
export function getJuzForHizb(hizbNum) {
  const h = Math.max(1, Math.min(60, Number(hizbNum) || 1));
  return Math.ceil(h / 2);
}

/**
 * Computes Hizbs in a given Juz (1..30).
 */
export function getHizbsForJuz(juzNum) {
  const j = Math.max(1, Math.min(30, Number(juzNum) || 1));
  return [j * 2 - 1, j * 2];
}

/**
 * Purely computes navigation bounds for a given mode and index.
 */
export function getNavigationBounds(mode, index) {
  if (mode === "juz") {
    const j = Math.max(1, Math.min(30, Number(index) || 1));
    const hizbs = getHizbsForJuz(j);
    return { mode: "juz", index: j, hizbs, total: 30 };
  }
  if (mode === "hizb") {
    const h = Math.max(1, Math.min(60, Number(index) || 1));
    return { mode: "hizb", index: h, juz: getJuzForHizb(h), total: 60 };
  }
  if (mode === "page") {
    const p = Math.max(1, Math.min(604, Number(index) || 1));
    return { mode: "page", index: p, total: 604 };
  }
  const sn = Math.max(1, Math.min(114, Number(index) || 1));
  const meta = getSurahMeta(sn);
  return { mode: "surah", index: sn, count: meta.count, total: 114 };
}
