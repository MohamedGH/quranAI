// ─── Pure Functional Cross-Surah Quarter of Hizb (Rub' al-Hizb) Engine ────────
import { SURAH_INFO } from "./arabicUtils.js";
import { ERROR_CODES, withErrorRecovery } from "./errorManager.js";
import {
  getGlobalAyahNumber,
  getHizbForSurahAyah,
  ayahsBelongToSurah,
  enrichAyahWithSurahMeta,
} from "./hizbUtils.js";

/**
 * Canonical 240 Quarter-of-Hizb (Rub' al-Hizb, 1..240) start coordinates:
 * [quarterNum, surah, ayah, startPage, juz]
 * Verified against Mushaf al-Madinah / api.alquran.cloud (`hizbQuarter` 1..240).
 */
const RAW_QUARTER_HIZB_REFS = [
  [1,1,1,1,1],[2,2,26,5,1],[3,2,44,7,1],[4,2,60,9,1],
  [5,2,75,11,1],[6,2,92,14,1],[7,2,106,17,1],[8,2,124,19,1],
  [9,2,142,22,2],[10,2,158,24,2],[11,2,177,27,2],[12,2,189,29,2],
  [13,2,203,32,2],[14,2,219,34,2],[15,2,233,37,2],[16,2,243,39,2],
  [17,2,253,42,3],[18,2,263,44,3],[19,2,272,46,3],[20,2,283,49,3],
  [21,3,15,51,3],[22,3,33,54,3],[23,3,52,56,3],[24,3,75,59,3],
  [25,3,93,62,4],[26,3,113,64,4],[27,3,133,67,4],[28,3,153,69,4],
  [29,3,171,72,4],[30,3,186,74,4],[31,4,1,77,4],[32,4,12,79,4],
  [33,4,24,82,5],[34,4,36,84,5],[35,4,58,87,5],[36,4,74,89,5],
  [37,4,88,92,5],[38,4,100,94,5],[39,4,114,97,5],[40,4,135,100,5],
  [41,4,148,102,6],[42,4,163,104,6],[43,5,1,106,6],[44,5,12,109,6],
  [45,5,27,112,6],[46,5,41,114,6],[47,5,51,117,6],[48,5,67,119,6],
  [49,5,82,121,7],[50,5,97,124,7],[51,5,109,126,7],[52,6,13,129,7],
  [53,6,36,132,7],[54,6,59,134,7],[55,6,74,137,7],[56,6,95,140,7],
  [57,6,111,142,8],[58,6,127,144,8],[59,6,141,146,8],[60,6,151,148,8],
  [61,7,1,151,8],[62,7,31,154,8],[63,7,47,156,8],[64,7,65,158,8],
  [65,7,88,162,9],[66,7,117,164,9],[67,7,142,167,9],[68,7,156,170,9],
  [69,7,171,173,9],[70,7,189,175,9],[71,8,1,177,9],[72,8,22,179,9],
  [73,8,41,182,10],[74,8,61,184,10],[75,9,1,187,10],[76,9,19,189,10],
  [77,9,34,192,10],[78,9,46,194,10],[79,9,60,196,10],[80,9,75,199,10],
  [81,9,93,201,11],[82,9,111,204,11],[83,9,122,206,11],[84,10,11,209,11],
  [85,10,26,212,11],[86,10,53,214,11],[87,10,71,217,11],[88,10,90,219,11],
  [89,11,6,222,12],[90,11,24,224,12],[91,11,41,226,12],[92,11,61,228,12],
  [93,11,84,231,12],[94,11,108,233,12],[95,12,7,236,12],[96,12,30,238,12],
  [97,12,53,242,13],[98,12,77,244,13],[99,12,101,247,13],[100,13,5,249,13],
  [101,13,19,252,13],[102,13,35,254,13],[103,14,10,256,13],[104,14,28,259,13],
  [105,15,1,262,14],[106,15,50,264,14],[107,16,1,267,14],[108,16,30,270,14],
  [109,16,51,272,14],[110,16,75,275,14],[111,16,90,277,14],[112,16,111,280,14],
  [113,17,1,282,15],[114,17,23,284,15],[115,17,50,287,15],[116,17,70,289,15],
  [117,17,99,292,15],[118,18,17,295,15],[119,18,32,297,15],[120,18,51,299,15],
  [121,18,75,302,16],[122,18,99,304,16],[123,19,22,306,16],[124,19,59,309,16],
  [125,20,1,312,16],[126,20,55,315,16],[127,20,83,317,16],[128,20,111,319,16],
  [129,21,1,322,17],[130,21,29,324,17],[131,21,51,326,17],[132,21,83,329,17],
  [133,22,1,332,17],[134,22,19,334,17],[135,22,38,336,17],[136,22,60,339,17],
  [137,23,1,342,18],[138,23,36,344,18],[139,23,75,347,18],[140,24,1,350,18],
  [141,24,21,352,18],[142,24,35,354,18],[143,24,53,356,18],[144,25,1,359,18],
  [145,25,21,362,19],[146,25,53,364,19],[147,26,1,367,19],[148,26,52,369,19],
  [149,26,111,371,19],[150,26,181,374,19],[151,27,1,377,19],[152,27,27,379,19],
  [153,27,56,382,20],[154,27,82,384,20],[155,28,12,386,20],[156,28,29,389,20],
  [157,28,51,392,20],[158,28,76,394,20],[159,29,1,396,20],[160,29,26,399,20],
  [161,29,46,402,21],[162,30,1,404,21],[163,30,31,407,21],[164,30,54,410,21],
  [165,31,22,413,21],[166,32,11,415,21],[167,33,1,418,21],[168,33,18,420,21],
  [169,33,31,422,22],[170,33,51,425,22],[171,33,60,426,22],[172,34,10,429,22],
  [173,34,24,431,22],[174,34,46,433,22],[175,35,15,436,22],[176,35,41,439,22],
  [177,36,28,442,23],[178,36,60,444,23],[179,37,22,446,23],[180,37,83,449,23],
  [181,37,145,451,23],[182,38,21,454,23],[183,38,52,456,23],[184,39,8,459,23],
  [185,39,32,462,24],[186,39,53,464,24],[187,40,1,467,24],[188,40,21,469,24],
  [189,40,41,472,24],[190,40,66,474,24],[191,41,9,477,24],[192,41,25,479,24],
  [193,41,47,482,25],[194,42,13,484,25],[195,42,27,486,25],[196,42,51,488,25],
  [197,43,24,491,25],[198,43,57,493,25],[199,44,17,496,25],[200,45,12,499,25],
  [201,46,1,502,26],[202,46,21,505,26],[203,47,10,507,26],[204,47,33,510,26],
  [205,48,18,513,26],[206,49,1,515,26],[207,49,14,517,26],[208,50,27,519,26],
  [209,51,31,522,27],[210,52,24,524,27],[211,53,26,526,27],[212,54,9,529,27],
  [213,55,1,531,27],[214,56,1,534,27],[215,56,75,536,27],[216,57,16,539,27],
  [217,58,1,542,28],[218,58,14,544,28],[219,59,11,547,28],[220,60,7,550,28],
  [221,62,1,553,28],[222,63,4,554,28],[223,65,1,558,28],[224,66,1,560,28],
  [225,67,1,562,29],[226,68,1,564,29],[227,69,1,566,29],[228,70,19,569,29],
  [229,72,1,572,29],[230,73,20,575,29],[231,75,1,577,29],[232,76,19,579,29],
  [233,78,1,582,30],[234,80,1,585,30],[235,82,1,587,30],[236,84,1,589,30],
  [237,87,1,591,30],[238,90,1,594,30],[239,94,1,596,30],[240,100,9,599,30],
];

export const QUARTER_HIZB_START_REFS = Object.freeze(
  RAW_QUARTER_HIZB_REFS.map(([quarter, surah, ayah, startPage, juz]) =>
    Object.freeze({
      quarter,
      hizb: Math.ceil(quarter / 4),
      quarterInHizb: ((quarter - 1) % 4) + 1,
      surah,
      ayah,
      startPage,
      juz,
    })
  )
);

/**
 * Purely clamps a Quarter-of-Hizb number to the valid range [1, 240].
 */
export const clampQuarterHizbNumber = (quarterNum, fallback = null) => {
  if (quarterNum == null || quarterNum === "") return fallback;
  const n = Number(quarterNum);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(240, Math.round(n)));
};

/**
 * Returns fraction metadata for a Quarter-of-Hizb (1..240).
 * quarterInHizb = 1 (¼, Al-Rub'), 2 (½, Al-Nisf), 3 (¾, Al-Thalathat Arba'), 4 (4/4, Fin Hizb / Al-Hizb).
 */
export const getQuarterFractionMeta = (quarterNum) => {
  const q = clampQuarterHizbNumber(quarterNum);
  if (!q) return null;
  const hizb = Math.ceil(q / 4);
  const quarterInHizb = ((q - 1) % 4) + 1;
  const TABLE = {
    1: { fractionLabel: "1/4", symbol: "¼", frenchLabel: "1er quart", arabicLabel: "الربع" },
    2: { fractionLabel: "2/4", symbol: "½", frenchLabel: "2ᵉ quart (Nisf)", arabicLabel: "النصف" },
    3: { fractionLabel: "3/4", symbol: "¾", frenchLabel: "3ᵉ quart", arabicLabel: "الثلاثة أرباع" },
    4: { fractionLabel: "4/4", symbol: "4/4", frenchLabel: "4ᵉ quart (Hizb)", arabicLabel: "تمام الحزب" },
  };
  const entry = TABLE[quarterInHizb];
  return Object.freeze({
    quarter: q,
    hizb,
    quarterInHizb,
    ...entry,
    shortLabel: `H.${hizb} · ${entry.symbol}`,
    fullLabel: `Quart ${q}/240 · Hizb ${hizb} (${entry.frenchLabel})`,
  });
};

/**
 * Purely resolves the Quarter-of-Hizb number (1..240) for any (surahNum, ayahNum) coordinate.
 */
export const getQuarterHizbForSurahAyah = (surahNum, ayahNum = 1) => {
  const sn = Number(surahNum);
  const an = Number(ayahNum);
  if (!Number.isFinite(sn) || sn < 1 || sn > 114) return null;
  const safeAyah = Number.isFinite(an) && an >= 1 ? an : 1;

  for (let i = QUARTER_HIZB_START_REFS.length - 1; i >= 0; i--) {
    const ref = QUARTER_HIZB_START_REFS[i];
    if (sn > ref.surah || (sn === ref.surah && safeAyah >= ref.ayah)) {
      return ref.quarter;
    }
  }
  return 1;
};

/**
 * Purely computes boundaries and metadata for a given Quarter-of-Hizb (1..240).
 */
export const getQuarterHizbBounds = (quarterNum) => {
  const q = clampQuarterHizbNumber(quarterNum);
  if (!q) return null;
  const startRef = QUARTER_HIZB_START_REFS[q - 1];
  const nextRef = q < 240 ? QUARTER_HIZB_START_REFS[q] : null;
  const fractionMeta = getQuarterFractionMeta(q);

  const startPage = startRef.startPage;
  const endPage = nextRef ? Math.max(startPage, nextRef.startPage) : 604;
  const pageLabel = startPage === endPage ? `Page ${startPage}` : `Pages ${startPage}–${endPage}`;
  const pageShort = startPage === endPage ? `P.${startPage}` : `P.${startPage}–${endPage}`;

  if (!nextRef) {
    return Object.freeze({
      quarter: 240,
      hizb: startRef.hizb,
      quarterInHizb: startRef.quarterInHizb,
      juz: startRef.juz,
      fractionMeta,
      startSurah: startRef.surah,
      startAyah: startRef.ayah,
      endSurah: 114,
      endAyah: SURAH_INFO[113].count,
      startPage,
      endPage: 604,
      totalPages: 604 - startPage + 1,
      pageLabel,
      pageShort,
    });
  }

  const endSurah = nextRef.ayah === 1 ? nextRef.surah - 1 : nextRef.surah;
  const endAyah =
    nextRef.ayah === 1
      ? SURAH_INFO[endSurah - 1]?.count || 1
      : nextRef.ayah - 1;

  return Object.freeze({
    quarter: q,
    hizb: startRef.hizb,
    quarterInHizb: startRef.quarterInHizb,
    juz: startRef.juz,
    fractionMeta,
    startSurah: startRef.surah,
    startAyah: startRef.ayah,
    endSurah,
    endAyah,
    startPage,
    endPage,
    totalPages: endPage - startPage + 1,
    pageLabel,
    pageShort,
  });
};

/**
 * Purely returns the ordered array of Surah segments that compose a Quarter-of-Hizb (1..240).
 */
export const getQuarterHizbSegments = (quarterNum) => {
  const bounds = getQuarterHizbBounds(quarterNum);
  if (!bounds) return [];

  const segments = [];
  for (let sn = bounds.startSurah; sn <= bounds.endSurah; sn++) {
    const info = SURAH_INFO[sn - 1] || { n: sn, en: `Surah ${sn}`, ar: `${sn}`, count: 1 };
    const fromAyah = sn === bounds.startSurah ? bounds.startAyah : 1;
    const toAyah = sn === bounds.endSurah ? bounds.endAyah : info.count;
    segments.push(
      Object.freeze({
        quarter: bounds.quarter,
        hizb: bounds.hizb,
        quarterInHizb: bounds.quarterInHizb,
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
 * Purely returns the list of Surah numbers (1..114) contained in a Quarter-of-Hizb.
 */
export const getSurahsForQuarterHizb = (quarterNum) =>
  getQuarterHizbSegments(quarterNum).map((seg) => seg.surahNum);

/**
 * Pure predicate returning true if the given Quarter-of-Hizb spans across more than one Surah.
 */
export const isCrossSurahQuarterHizb = (quarterNum) =>
  getSurahsForQuarterHizb(quarterNum).length > 1;

/**
 * Purely returns the other Surah numbers in `quarterNum` excluding `currentSurahNum`.
 */
export const getOtherSurahsInQuarterHizb = (quarterNum, currentSurahNum) => {
  const cur = Number(currentSurahNum);
  return getSurahsForQuarterHizb(quarterNum).filter((sn) => sn !== cur);
};

/**
 * Purely returns all Quarter-of-Hizb numbers (1..240) that have at least one verse in `surahNum`.
 */
export const getQuarterHizbsForSurah = (surahNum) => {
  const sn = Number(surahNum);
  if (!Number.isFinite(sn) || sn < 1 || sn > 114) return [];
  const info = SURAH_INFO[sn - 1];
  if (!info) return [];
  const firstQuarter = getQuarterHizbForSurahAyah(sn, 1);
  const lastQuarter = getQuarterHizbForSurahAyah(sn, info.count);
  if (!firstQuarter || !lastQuarter) return [];
  const list = [];
  for (let q = firstQuarter; q <= lastQuarter; q++) list.push(q);
  return list;
};

/**
 * Pure functional builder that constructs the complete ordered list of verses for `quarterNum`
 * across all Surahs in that Quarter-of-Hizb, given `surahAyatsMap` ({ [surahNum]: ayahs[] }).
 */
export const buildCrossSurahQuarterHizbAyats = (
  quarterNum,
  surahAyatsMap = {},
  primarySurahNum = null
) => {
  const segments = getQuarterHizbSegments(quarterNum);
  if (segments.length === 0) return [];
  const multiSurah = segments.length > 1;
  const seenComposite = new Set();

  return segments.flatMap((seg) => {
    const rawAyahs = surahAyatsMap?.[seg.surahNum];
    if (!Array.isArray(rawAyahs) || rawAyahs.length === 0) return [];

    const filtered = rawAyahs.filter((a) => {
      if (!a) return false;
      const itemSurah = a.surahNumber ?? a.surah?.number;
      if (itemSurah != null && Number(itemSurah) !== seg.surahNum) {
        return false;
      }
      if (a.numberInSurah < seg.fromAyah || a.numberInSurah > seg.toAyah) {
        return false;
      }
      const compositeKey = `${seg.surahNum}:${a.numberInSurah}`;
      if (seenComposite.has(compositeKey)) return false;
      seenComposite.add(compositeKey);
      return true;
    });

    return filtered.map((a, idx) => ({
      ...enrichAyahWithSurahMeta(a, seg.surahNum, primarySurahNum),
      number: a.number ?? getGlobalAyahNumber(seg.surahNum, a.numberInSurah),
      hizb: a.hizb ?? getHizbForSurahAyah(seg.surahNum, a.numberInSurah) ?? seg.hizb,
      hizbQuarter: seg.quarter,
      isCrossSurahQuarterHizb: multiSurah,
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
 * Asynchronous functional loader that fetches any missing Surahs for `quarterNum`
 * using `fetchSurahFn` (wrapped in `withErrorRecovery`) and returns `{ surahMap, ayats, segments }`.
 */
export const fetchCrossSurahQuarterHizbAyats = async (
  quarterNum,
  {
    primarySurahNum = null,
    primaryAyats = [],
    existingMap = {},
    fetchSurahFn,
    onError = null,
  } = {}
) => {
  const segments = getQuarterHizbSegments(quarterNum);
  if (segments.length === 0) {
    return { surahMap: {}, ayats: [], segments: [] };
  }

  const baseMap = {
    ...existingMap,
    ...(primarySurahNum && ayahsBelongToSurah(primaryAyats, primarySurahNum)
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
                message: `Impossible de charger la sourate ${sn} pour le Quart de Hizb ${quarterNum}`,
                context: { quarterNum, surahNum: sn },
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

  const combinedAyats = buildCrossSurahQuarterHizbAyats(
    quarterNum,
    mergedMap,
    primarySurahNum
  );
  return {
    surahMap: mergedMap,
    ayats: combinedAyats,
    segments,
  };
};
