// ─── Pure Functional Cross-Surah Hizb Engine ─────────────────────────────────
import { SURAH_INFO } from "./arabicUtils.js";
import { ERROR_CODES, withErrorRecovery } from "./errorManager.js";

/**
 * Canonical start coordinates (surah, ayah) for each of the 60 Hizbs of the Quran.
 */
export const HIZB_START_REFS = Object.freeze([
  Object.freeze({ hizb: 1, surah: 1, ayah: 1 }),
  Object.freeze({ hizb: 2, surah: 2, ayah: 75 }),
  Object.freeze({ hizb: 3, surah: 2, ayah: 142 }),
  Object.freeze({ hizb: 4, surah: 2, ayah: 203 }),
  Object.freeze({ hizb: 5, surah: 2, ayah: 253 }),
  Object.freeze({ hizb: 6, surah: 3, ayah: 15 }),
  Object.freeze({ hizb: 7, surah: 3, ayah: 93 }),
  Object.freeze({ hizb: 8, surah: 3, ayah: 171 }),
  Object.freeze({ hizb: 9, surah: 4, ayah: 24 }),
  Object.freeze({ hizb: 10, surah: 4, ayah: 88 }),
  Object.freeze({ hizb: 11, surah: 4, ayah: 148 }),
  Object.freeze({ hizb: 12, surah: 5, ayah: 27 }),
  Object.freeze({ hizb: 13, surah: 5, ayah: 82 }),
  Object.freeze({ hizb: 14, surah: 6, ayah: 36 }),
  Object.freeze({ hizb: 15, surah: 6, ayah: 111 }),
  Object.freeze({ hizb: 16, surah: 7, ayah: 1 }),
  Object.freeze({ hizb: 17, surah: 7, ayah: 88 }),
  Object.freeze({ hizb: 18, surah: 7, ayah: 171 }),
  Object.freeze({ hizb: 19, surah: 8, ayah: 41 }),
  Object.freeze({ hizb: 20, surah: 9, ayah: 34 }),
  Object.freeze({ hizb: 21, surah: 9, ayah: 93 }),
  Object.freeze({ hizb: 22, surah: 10, ayah: 26 }),
  Object.freeze({ hizb: 23, surah: 11, ayah: 6 }),
  Object.freeze({ hizb: 24, surah: 11, ayah: 84 }),
  Object.freeze({ hizb: 25, surah: 12, ayah: 53 }),
  Object.freeze({ hizb: 26, surah: 13, ayah: 19 }),
  Object.freeze({ hizb: 27, surah: 15, ayah: 1 }),
  Object.freeze({ hizb: 28, surah: 16, ayah: 51 }),
  Object.freeze({ hizb: 29, surah: 17, ayah: 1 }),
  Object.freeze({ hizb: 30, surah: 17, ayah: 99 }),
  Object.freeze({ hizb: 31, surah: 18, ayah: 75 }),
  Object.freeze({ hizb: 32, surah: 20, ayah: 1 }),
  Object.freeze({ hizb: 33, surah: 21, ayah: 1 }),
  Object.freeze({ hizb: 34, surah: 22, ayah: 1 }),
  Object.freeze({ hizb: 35, surah: 23, ayah: 1 }),
  Object.freeze({ hizb: 36, surah: 24, ayah: 21 }),
  Object.freeze({ hizb: 37, surah: 25, ayah: 21 }),
  Object.freeze({ hizb: 38, surah: 26, ayah: 111 }),
  Object.freeze({ hizb: 39, surah: 27, ayah: 56 }),
  Object.freeze({ hizb: 40, surah: 28, ayah: 51 }),
  Object.freeze({ hizb: 41, surah: 29, ayah: 46 }),
  Object.freeze({ hizb: 42, surah: 31, ayah: 22 }),
  Object.freeze({ hizb: 43, surah: 33, ayah: 31 }),
  Object.freeze({ hizb: 44, surah: 34, ayah: 24 }),
  Object.freeze({ hizb: 45, surah: 36, ayah: 28 }),
  Object.freeze({ hizb: 46, surah: 37, ayah: 145 }),
  Object.freeze({ hizb: 47, surah: 39, ayah: 32 }),
  Object.freeze({ hizb: 48, surah: 40, ayah: 41 }),
  Object.freeze({ hizb: 49, surah: 41, ayah: 47 }),
  Object.freeze({ hizb: 50, surah: 43, ayah: 24 }),
  Object.freeze({ hizb: 51, surah: 46, ayah: 1 }),
  Object.freeze({ hizb: 52, surah: 48, ayah: 18 }),
  Object.freeze({ hizb: 53, surah: 51, ayah: 31 }),
  Object.freeze({ hizb: 54, surah: 55, ayah: 1 }),
  Object.freeze({ hizb: 55, surah: 58, ayah: 1 }),
  Object.freeze({ hizb: 56, surah: 62, ayah: 1 }),
  Object.freeze({ hizb: 57, surah: 67, ayah: 1 }),
  Object.freeze({ hizb: 58, surah: 72, ayah: 1 }),
  Object.freeze({ hizb: 59, surah: 78, ayah: 1 }),
  Object.freeze({ hizb: 60, surah: 87, ayah: 1 }),
]);

/**
 * Precomputed cumulative verse offsets per Surah (1-indexed) for O(1) global ayah calculation.
 */
const SURAH_OFFSETS = Object.freeze(
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
 * Purely clamps a Hizb number to the valid range [1, 60].
 */
export const clampHizbNumber = (hizbNum, fallback = null) => {
  if (hizbNum == null || hizbNum === "") return fallback;
  const n = Number(hizbNum);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(60, Math.round(n)));
};

/**
 * Purely computes the global Quranic ayah number (1..6236) from (surahNum, numberInSurah).
 */
export const getGlobalAyahNumber = (surahNum, numberInSurah) => {
  const sn = Number(surahNum);
  const an = Number(numberInSurah);
  if (!Number.isFinite(sn) || !Number.isFinite(an) || sn < 1 || sn > 114 || an < 1) return null;
  return (SURAH_OFFSETS[sn] ?? 0) + an;
};

/**
 * Purely resolves the Hizb number (1..60) for any (surahNum, ayahNum) coordinate.
 */
export const getHizbForSurahAyah = (surahNum, ayahNum = 1) => {
  const sn = Number(surahNum);
  const an = Number(ayahNum);
  if (!Number.isFinite(sn) || sn < 1 || sn > 114) return null;
  const safeAyah = Number.isFinite(an) && an >= 1 ? an : 1;

  for (let i = HIZB_START_REFS.length - 1; i >= 0; i--) {
    const ref = HIZB_START_REFS[i];
    if (sn > ref.surah || (sn === ref.surah && safeAyah >= ref.ayah)) {
      return ref.hizb;
    }
  }
  return 1;
};

/**
 * Purely computes the start and end (surah, ayah) boundaries for a given Hizb (1..60).
 */
export const getHizbBounds = (hizbNum) => {
  const h = clampHizbNumber(hizbNum);
  if (!h) return null;
  const startRef = HIZB_START_REFS[h - 1];
  const nextRef = h < 60 ? HIZB_START_REFS[h] : null;

  if (!nextRef) {
    return Object.freeze({
      hizb: 60,
      startSurah: startRef.surah,
      startAyah: startRef.ayah,
      endSurah: 114,
      endAyah: SURAH_INFO[113].count,
    });
  }

  const endSurah = nextRef.ayah === 1 ? nextRef.surah - 1 : nextRef.surah;
  const endAyah =
    nextRef.ayah === 1
      ? SURAH_INFO[endSurah - 1]?.count || 1
      : nextRef.ayah - 1;

  return Object.freeze({
    hizb: h,
    startSurah: startRef.surah,
    startAyah: startRef.ayah,
    endSurah,
    endAyah,
  });
};

/**
 * Purely returns the ordered array of Surah segments that compose a Hizb (1..60).
 * Each segment specifies { hizb, surahNum, surahEn, surahAr, fromAyah, toAyah, totalInSurah, isFullSurah }.
 */
export const getHizbSegments = (hizbNum) => {
  const bounds = getHizbBounds(hizbNum);
  if (!bounds) return [];

  const segments = [];
  for (let sn = bounds.startSurah; sn <= bounds.endSurah; sn++) {
    const info = SURAH_INFO[sn - 1] || { n: sn, en: `Surah ${sn}`, ar: `${sn}`, count: 1 };
    const fromAyah = sn === bounds.startSurah ? bounds.startAyah : 1;
    const toAyah = sn === bounds.endSurah ? bounds.endAyah : info.count;
    segments.push(
      Object.freeze({
        hizb: bounds.hizb,
        surahNum: sn,
        surahEn: info.en,
        surahAr: info.ar,
        fromAyah,
        toAyah,
        totalInSurah: info.count,
        isFullSurah: fromAyah === 1 && toAyah === info.count,
      })
    );
  }
  return Object.freeze(segments);
};

/**
 * Purely returns the list of Surah numbers (1..114) contained in a Hizb.
 */
export const getSurahsForHizb = (hizbNum) =>
  getHizbSegments(hizbNum).map((seg) => seg.surahNum);

/**
 * Pure predicate returning true if the given Hizb spans across more than one Surah.
 */
export const isCrossSurahHizb = (hizbNum) => getSurahsForHizb(hizbNum).length > 1;

/**
 * Purely returns the other Surah numbers in `hizbNum` excluding `currentSurahNum`.
 */
export const getOtherSurahsInHizb = (hizbNum, currentSurahNum) => {
  const cur = Number(currentSurahNum);
  return getSurahsForHizb(hizbNum).filter((sn) => sn !== cur);
};

/**
 * Purely returns all Hizb numbers (1..60) that have at least one verse in `surahNum`.
 */
export const getHizbsForSurah = (surahNum) => {
  const sn = Number(surahNum);
  if (!Number.isFinite(sn) || sn < 1 || sn > 114) return [];
  const info = SURAH_INFO[sn - 1];
  if (!info) return [];
  const firstHizb = getHizbForSurahAyah(sn, 1);
  const lastHizb = getHizbForSurahAyah(sn, info.count);
  if (!firstHizb || !lastHizb) return [];
  const list = [];
  for (let h = firstHizb; h <= lastHizb; h++) list.push(h);
  return list;
};

/**
 * Purely enriches an ayah object with Surah identity and Hizb metadata.
 */
export const enrichAyahWithSurahMeta = (ayah, surahNum, primarySurahNum = null) => {
  if (!ayah) return ayah;
  const sn = Number(ayah.surahNumber ?? ayah.surah?.number ?? surahNum);
  const info = SURAH_INFO[sn - 1] || { n: sn, en: `Surah ${sn}`, ar: `${sn}`, count: 1 };
  const hizbVal =
    ayah.hizb ??
    (ayah.hizbQuarter != null
      ? Math.ceil(ayah.hizbQuarter / 4)
      : getHizbForSurahAyah(sn, ayah.numberInSurah));
  const globalNum = ayah.number ?? getGlobalAyahNumber(sn, ayah.numberInSurah);
  const isCrossSurah = primarySurahNum != null ? sn !== Number(primarySurahNum) : false;

  return {
    ...ayah,
    number: globalNum,
    hizb: hizbVal,
    surahNumber: sn,
    surahName: info.ar,
    surahEnglishName: info.en,
    surahTotalAyahs: info.count,
    isCrossSurah,
    surah: ayah.surah || {
      number: sn,
      name: info.ar,
      englishName: info.en,
      numberOfAyahs: info.count,
    },
  };
};

/**
 * Pure functional builder that constructs the complete ordered list of verses for `hizbNum`
 * across all Surahs in that Hizb, given `surahAyatsMap` ({ [surahNum]: ayahs[] }).
 */
export const buildCrossSurahHizbAyats = (
  hizbNum,
  surahAyatsMap = {},
  primarySurahNum = null
) => {
  const segments = getHizbSegments(hizbNum);
  if (segments.length === 0) return [];
  const multiSurah = segments.length > 1;

  return segments.flatMap((seg) => {
    const rawAyahs = surahAyatsMap?.[seg.surahNum];
    if (!Array.isArray(rawAyahs) || rawAyahs.length === 0) return [];

    const filtered = rawAyahs.filter(
      (a) =>
        a &&
        a.numberInSurah >= seg.fromAyah &&
        a.numberInSurah <= seg.toAyah
    );

    return filtered.map((a, idx) => ({
      ...enrichAyahWithSurahMeta(a, seg.surahNum, primarySurahNum),
      hizb: seg.hizb,
      isCrossSurahHizb: multiSurah,
      isSurahSegmentStart: idx === 0,
      isSurahSegmentEnd: idx === filtered.length - 1,
      segmentFromAyah: seg.fromAyah,
      segmentToAyah: seg.toAyah,
      segmentTotalInSurah: seg.totalInSurah,
    }));
  });
};

/**
 * Purely groups a flat list of Hizb verses into Surah sections for rendering or analytics.
 */
export const groupHizbAyatsBySurah = (ayats = []) => {
  if (!Array.isArray(ayats) || ayats.length === 0) return [];
  return ayats.reduce((groups, ayat) => {
    const sn = ayat.surahNumber ?? ayat.surah?.number;
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.surahNum === sn) {
      lastGroup.ayats.push(ayat);
      lastGroup.toAyah = ayat.numberInSurah;
      return groups;
    }
    const info = SURAH_INFO[(sn || 1) - 1] || {};
    groups.push({
      surahNum: sn,
      surahEn: ayat.surahEnglishName || info.en || `Surah ${sn}`,
      surahAr: ayat.surahName || info.ar || "",
      fromAyah: ayat.numberInSurah,
      toAyah: ayat.numberInSurah,
      isCrossSurah: !!ayat.isCrossSurah,
      ayats: [ayat],
    });
    return groups;
  }, []);
};

/**
 * Asynchronous functional loader that fetches any missing Surahs for `hizbNum`
 * using `fetchSurahFn` (wrapped in `withErrorRecovery`) and returns `{ surahMap, ayats }`.
 */
export const fetchCrossSurahHizbAyats = async (
  hizbNum,
  {
    primarySurahNum = null,
    primaryAyats = [],
    existingMap = {},
    fetchSurahFn,
    onError = null,
  } = {}
) => {
  const segments = getHizbSegments(hizbNum);
  if (segments.length === 0) {
    return { surahMap: {}, ayats: [], segments: [] };
  }

  const baseMap = {
    ...existingMap,
    ...(primarySurahNum && Array.isArray(primaryAyats) && primaryAyats.length > 0
      ? { [Number(primarySurahNum)]: primaryAyats }
      : {}),
  };

  const missingSurahNums = segments
    .map((s) => s.surahNum)
    .filter((sn) => !Array.isArray(baseMap[sn]) || baseMap[sn].length === 0);

  const fetchedEntries =
    missingSurahNums.length > 0 && typeof fetchSurahFn === "function"
      ? await Promise.all(
          missingSurahNums.map(async (sn) => {
            const res = await withErrorRecovery(
              () => fetchSurahFn(sn),
              { ayahs: [] },
              {
                code: ERROR_CODES.HIZB_LOAD_ERROR,
                message: `Impossible de charger la sourate ${sn} pour le Hizb ${hizbNum}`,
                context: { hizbNum, surahNum: sn },
                onError,
              }
            );
            const list = Array.isArray(res) ? res : res?.ayahs || [];
            return [sn, list];
          })
        )
      : [];

  const mergedMap = fetchedEntries.reduce(
    (acc, [sn, list]) => (list.length > 0 ? { ...acc, [sn]: list } : acc),
    baseMap
  );

  const combinedAyats = buildCrossSurahHizbAyats(hizbNum, mergedMap, primarySurahNum);
  return {
    surahMap: mergedMap,
    ayats: combinedAyats,
    segments,
  };
};
