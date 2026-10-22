// ─── Quran Metadata & Ayat Historical Analytics Engine ────────────────────────
import { getHizbBounds, getHizbPages, getHizbSegments, getHizbForSurahAyah } from "./hizbUtils.js";
import { getJuzForHizb, getHizbsForJuz } from "./quranDomain.js";
import { SURAH_INFO } from "./arabicUtils.js";
import { computeMastery, getAyatLetterStats } from "../components/common/Mastery.jsx";

/**
 * Extracts and consolidates all chronological metadata and lifecycle milestones for an Ayat.
 * Handles first & last occurrences of:
 * - Lecture (Reading): firstReadAt, lastReadAt, readCount, readDates
 * - Apprentissage (Learning): firstLearnedAt, lastLearnedAt, isLearned
 * - Découpage (Parts / Segmentation): firstCutAt, lastCutAt, partsCount, learnedPartsCount
 * - Mots (Word memorisation): firstWordLearnedAt, lastWordLearnedAt, wordsCount, wordsLearnedCount
 * - Révision (toRevise sessions): firstRevisedAt, lastRevisedAt, activeRevise, reviseHistory
 * - Récitation & Écriture: firstRecitAt, lastRecitAt, firstWriteAt, lastWriteAt
 */
export function extractAyatHistoricalMetadata(key, ld = {}, ayatText = "", surahMeta = null) {
  const [sNumStr, aNumStr] = (key || "1:1").split(":");
  const surahNum = parseInt(sNumStr, 10) || 1;
  const ayatNum = parseInt(aNumStr, 10) || 1;

  const nowIso = new Date().toISOString();
  const info = SURAH_INFO[surahNum - 1] || { n: surahNum, en: `Surah ${surahNum}`, ar: `${surahNum}`, count: 1 };
  const hizb = getHizbForSurahAyah(surahNum, ayatNum);
  const juz = hizb ? getJuzForHizb(hizb) : 1;

  // Words list & Letter statistics
  const words = ayatText ? ayatText.split(/\s+/).filter(Boolean) : [];
  const letterStats = getAyatLetterStats(ld, ayatText);
  const masteryPct = computeMastery(ld, ayatText);

  // 1. LECTURE (READING)
  const readCount = ld.readCount || 0;
  const readDates = Array.isArray(ld.readDates) ? ld.readDates : [];
  const sortedReadDates = [...readDates].sort();
  const firstReadAt = ld.firstReadAt || sortedReadDates[0] || (readCount > 0 ? (ld.createdAt || ld.updatedAt || null) : null);
  const lastReadAt = ld.lastReadAt || sortedReadDates[sortedReadDates.length - 1] || (readCount > 0 ? (ld.updatedAt || ld.createdAt || null) : null);

  // 2. APPRENTISSAGE (MEMORISATION / LEARNING)
  const isLearned = !!ld.learned;
  const firstLearnedAt = ld.firstLearnedAt || ld.learnedAt || null;
  const lastLearnedAt = ld.lastLearnedAt || ld.learnedAt || null;

  // 3. DÉCOUPAGE (PARTS / SEGMENTS)
  const parts = Array.isArray(ld.parts) ? ld.parts : [];
  const partsCount = parts.length;
  const learnedPartsCount = parts.filter(p => p.learned).length;
  const partDates = parts.map(p => p.createdAt || p.updatedAt).filter(Boolean).sort();
  const firstCutAt = ld.firstCutAt || partDates[0] || (partsCount > 0 ? (ld.createdAt || ld.updatedAt || null) : null);
  const lastCutAt = ld.lastCutAt || partDates[partDates.length - 1] || (partsCount > 0 ? (ld.updatedAt || ld.createdAt || null) : null);

  // 4. MOTS (WORDS LEARNED)
  const wordsLearned = ld.wordsLearned || {};
  const wordsLearnedKeys = Object.keys(wordsLearned).filter(k => wordsLearned[k]);
  const wordsLearnedCount = wordsLearnedKeys.length;
  const wordsLearnedDates = ld.wordsLearnedDates || {};
  const wDates = Object.values(wordsLearnedDates).filter(Boolean).sort();
  const firstWordLearnedAt = ld.firstWordLearnedAt || wDates[0] || (wordsLearnedCount > 0 ? (ld.updatedAt || ld.createdAt || null) : null);
  const lastWordLearnedAt = ld.lastWordLearnedAt || wDates[wDates.length - 1] || (wordsLearnedCount > 0 ? (ld.updatedAt || ld.createdAt || null) : null);

  // 5. RÉVISION (TO REVISE)
  const reviseHistory = Array.isArray(ld.reviseHistory) ? ld.reviseHistory : [];
  const toRevise = ld.toRevise;
  const isCurrentlyToRevise = !!toRevise;
  const revStartDates = reviseHistory.map(h => h.startDate).filter(Boolean).sort();
  const revEndDates = reviseHistory.map(h => h.endDate).filter(Boolean).sort();
  const firstRevisedAt = ld.firstRevisedAt || revStartDates[0] || (isCurrentlyToRevise ? (ld.updatedAt || null) : null);
  const lastRevisedAt = ld.lastRevisedAt || revStartDates[revStartDates.length - 1] || (isCurrentlyToRevise ? (ld.updatedAt || null) : null);

  // Revision details: which words/letters/parts need review
  let reviseScope = "none";
  let reviseWordIndices = [];
  let reviseWordList = [];
  let revisePartIds = [];
  let reviseCharMap = {};

  if (isCurrentlyToRevise) {
    if (toRevise === true) {
      reviseScope = "all";
      reviseWordIndices = words.map((_, i) => i);
      reviseWordList = words;
    } else if (typeof toRevise === "object") {
      reviseScope = "partial";
      reviseWordIndices = Array.isArray(toRevise.words) ? toRevise.words : [];
      reviseWordList = reviseWordIndices.map(i => words[i] || `Mot ${i + 1}`);
      revisePartIds = Array.isArray(toRevise.parts) ? toRevise.parts : [];
      reviseCharMap = toRevise.chars || {};
    }
  }

  // 6. RÉCITATIONS & ÉCRITURE (WRITING & ORAL ATTEMPTS)
  const recitAttempts = Array.isArray(ld.recitAttempts) ? ld.recitAttempts : [];
  const recitDates = recitAttempts.map(r => r.date).filter(Boolean).sort();
  const firstRecitAt = recitDates[0] || null;
  const lastRecitAt = recitDates[recitDates.length - 1] || null;
  const bestRecitScore = recitAttempts.length > 0 ? Math.max(...recitAttempts.map(r => r.score || 0)) : null;

  const writingAttempts = Array.isArray(ld.writingAttempts) ? ld.writingAttempts : [];
  const writeDates = writingAttempts.map(w => w.date).filter(Boolean).sort();
  const firstWriteAt = writeDates[0] || null;
  const lastWriteAt = writeDates[writeDates.length - 1] || null;
  const bestWriteScore = writingAttempts.length > 0 ? Math.max(...writingAttempts.map(w => w.score || 0)) : null;

  // General timestamps
  const createdAt = ld.createdAt || firstReadAt || firstLearnedAt || firstCutAt || null;
  const updatedAt = ld.updatedAt || lastReadAt || lastLearnedAt || null;

  // Consolidated timeline of all events for this ayat (chronological)
  const timelineEvents = [];
  if (firstReadAt) timelineEvents.push({ type: "first_read", label: "1ère Lecture", date: firstReadAt, icon: "📖", color: "var(--teal2)" });
  if (lastReadAt && lastReadAt !== firstReadAt) timelineEvents.push({ type: "last_read", label: "Dernière Lecture", date: lastReadAt, icon: "📖", color: "var(--teal)" });
  if (firstCutAt) timelineEvents.push({ type: "first_cut", label: "1er Découpage", date: firstCutAt, icon: "✂", color: "var(--gold)" });
  if (lastCutAt && lastCutAt !== firstCutAt) timelineEvents.push({ type: "last_cut", label: "Dernier Découpage", date: lastCutAt, icon: "✂", color: "var(--gold2)" });
  if (firstWordLearnedAt) timelineEvents.push({ type: "first_word", label: "1er Mot appris", date: firstWordLearnedAt, icon: "🔤", color: "#a8edea" });
  if (lastWordLearnedAt && lastWordLearnedAt !== firstWordLearnedAt) timelineEvents.push({ type: "last_word", label: "Dernier Mot appris", date: lastWordLearnedAt, icon: "🔤", color: "#a8edea" });
  if (firstLearnedAt) timelineEvents.push({ type: "first_learned", label: "1er Apprentissage (Validé)", date: firstLearnedAt, icon: "✓", color: "var(--green2)" });
  if (lastLearnedAt && lastLearnedAt !== firstLearnedAt) timelineEvents.push({ type: "last_learned", label: "Dernier Apprentissage", date: lastLearnedAt, icon: "✓", color: "var(--green)" });
  if (firstRevisedAt) timelineEvents.push({ type: "first_revise", label: "1ère Mise à réviser", date: firstRevisedAt, icon: "🔖", color: "#ff9f43" });
  if (lastRevisedAt && lastRevisedAt !== firstRevisedAt) timelineEvents.push({ type: "last_revise", label: "Dernière Mise à réviser", date: lastRevisedAt, icon: "🔖", color: "#ff9f43" });
  if (firstRecitAt) timelineEvents.push({ type: "first_recit", label: "1ère Récitation", date: firstRecitAt, icon: "🎙", color: "#5bc8f5" });
  if (lastRecitAt && lastRecitAt !== firstRecitAt) timelineEvents.push({ type: "last_recit", label: "Dernière Récitation", date: lastRecitAt, icon: "🎙", color: "#5bc8f5" });
  if (firstWriteAt) timelineEvents.push({ type: "first_write", label: "1ère Écriture", date: firstWriteAt, icon: "✍", color: "#c878ff" });
  if (lastWriteAt && lastWriteAt !== firstWriteAt) timelineEvents.push({ type: "last_write", label: "Dernière Écriture", date: lastWriteAt, icon: "✍", color: "#c878ff" });

  timelineEvents.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

  return {
    key,
    surahNum,
    ayatNum,
    surahNameEn: info.en,
    surahNameAr: info.ar,
    surahTotalAyahs: info.count,
    hizb,
    juz,
    ayatText,
    words,
    wordsCount: words.length,
    letterStats,
    masteryPct,

    // Reading
    readCount,
    firstReadAt,
    lastReadAt,
    readDates: sortedReadDates,

    // Learning
    isLearned,
    firstLearnedAt,
    lastLearnedAt,

    // Segmentation
    partsCount,
    learnedPartsCount,
    parts,
    firstCutAt,
    lastCutAt,

    // Words
    wordsLearnedCount,
    wordsLearned,
    firstWordLearnedAt,
    lastWordLearnedAt,

    // Revision
    isCurrentlyToRevise,
    reviseScope,
    reviseWordIndices,
    reviseWordList,
    revisePartIds,
    reviseCharMap,
    firstRevisedAt,
    lastRevisedAt,
    reviseHistory,

    // Audio & Write tests
    recitAttempts,
    firstRecitAt,
    lastRecitAt,
    bestRecitScore,
    writingAttempts,
    firstWriteAt,
    lastWriteAt,
    bestWriteScore,

    // Dates & Timeline
    createdAt,
    updatedAt,
    timelineEvents,
  };
}

/**
 * Computes all items currently marked for revision across the entire Quran,
 * sorted chronologically by when they were flagged (or updated).
 * Contains full word/letter/part details.
 */
export function computeRevisionQueue(learnData = {}, surahs = [], surahTextCache = {}) {
  const queue = [];

  for (const [key, ld] of Object.entries(learnData || {})) {
    if (!ld?.toRevise) continue;
    const [sNumStr, aNumStr] = key.split(":");
    const surahNum = parseInt(sNumStr, 10);
    const ayatNum = parseInt(aNumStr, 10);
    if (!surahNum || !ayatNum) continue;

    const text = surahTextCache[surahNum]?.[ayatNum] || "";
    const meta = extractAyatHistoricalMetadata(key, ld, text, surahs.find(s => s.number === surahNum));

    // Determine the date this revision was requested
    const lastRevSession = [...meta.reviseHistory].reverse().find(s => !s.endDate);
    const reviseDate = lastRevSession?.startDate || meta.lastRevisedAt || ld.updatedAt || ld.createdAt || "1970-01-01";

    queue.push({
      ...meta,
      reviseDate,
      session: lastRevSession || null,
    });
  }

  // Sort chronologically (oldest revision requests first, or customizable)
  queue.sort((a, b) => (a.reviseDate > b.reviseDate ? 1 : -1));
  return queue;
}

/**
 * Computes multi-level hierarchical aggregations (Sourate, Hizb, Juz)
 * with complete mastery, learned verses, read counts, words, parts, and revision quotas.
 */
export function computeQuranAggregations(learnData = {}, surahs = [], surahTextCache = {}) {
  // 1. SOURATES (1..114)
  const surahsAgg = [];
  const surahMap = {};

  for (let sn = 1; sn <= 114; sn++) {
    const info = SURAH_INFO[sn - 1] || { n: sn, en: `Surah ${sn}`, ar: `${sn}`, count: 1 };
    const metaFromSurahs = surahs.find(s => s.number === sn);
    const totalAyahs = metaFromSurahs?.numberOfAyahs || info.count || 1;

    let learnedCount = 0;
    let readCountTotal = 0;
    let partsCountTotal = 0;
    let learnedPartsTotal = 0;
    let wordsLearnedTotal = 0;
    let toReviseCount = 0;
    let masterySum = 0;
    let firstActivityDate = null;
    let lastActivityDate = null;

    for (let an = 1; an <= totalAyahs; an++) {
      const k = `${sn}:${an}`;
      const ld = learnData[k];
      const text = surahTextCache[sn]?.[an] || "";
      const m = computeMastery(ld, text);
      masterySum += m;

      if (ld) {
        if (ld.learned) learnedCount++;
        readCountTotal += ld.readCount || 0;
        const pts = ld.parts || [];
        partsCountTotal += pts.length;
        learnedPartsTotal += pts.filter(p => p.learned).length;
        wordsLearnedTotal += Object.keys(ld.wordsLearned || {}).filter(wk => ld.wordsLearned[wk]).length;
        if (ld.toRevise) toReviseCount++;

        // Track oldest / newest dates
        const dates = [
          ld.createdAt, ld.updatedAt, ld.learnedAt, ld.firstReadAt, ld.lastReadAt,
          ld.firstCutAt, ld.lastCutAt, ...(Array.isArray(ld.readDates) ? ld.readDates : []),
        ].filter(Boolean);

        for (const d of dates) {
          if (!firstActivityDate || d < firstActivityDate) firstActivityDate = d;
          if (!lastActivityDate || d > lastActivityDate) lastActivityDate = d;
        }
      }
    }

    const masteryPct = totalAyahs > 0 ? Math.min(100, Math.round(masterySum / totalAyahs)) : 0;
    const agg = {
      level: "surah",
      id: sn,
      number: sn,
      nameEn: info.en,
      nameAr: info.ar,
      totalAyahs,
      learnedCount,
      readCountTotal,
      partsCountTotal,
      learnedPartsTotal,
      wordsLearnedTotal,
      toReviseCount,
      masteryPct,
      masterySum,
      firstActivityDate,
      lastActivityDate,
      isFullyLearned: learnedCount === totalAyahs,
      revelationType: metaFromSurahs?.revelationType || (sn <= 5 ? "Medinan" : "Meccan"),
    };

    surahsAgg.push(agg);
    surahMap[sn] = agg;
  }

  // 2. HIZBS (1..60)
  const hizbsAgg = [];
  const hizbMap = {};

  for (let h = 1; h <= 60; h++) {
    const bounds = getHizbBounds(h);
    const pages = getHizbPages(h);
    const segments = getHizbSegments(h);
    const juz = getJuzForHizb(h);

    let totalAyahs = 0;
    let learnedCount = 0;
    let readCountTotal = 0;
    let partsCountTotal = 0;
    let learnedPartsTotal = 0;
    let wordsLearnedTotal = 0;
    let toReviseCount = 0;
    let masterySum = 0;
    let firstActivityDate = null;
    let lastActivityDate = null;

    for (const seg of segments) {
      const segAyahs = seg.toAyah - seg.fromAyah + 1;
      totalAyahs += segAyahs;

      for (let an = seg.fromAyah; an <= seg.toAyah; an++) {
        const k = `${seg.surahNum}:${an}`;
        const ld = learnData[k];
        const text = surahTextCache[seg.surahNum]?.[an] || "";
        const m = computeMastery(ld, text);
        masterySum += m;

        if (ld) {
          if (ld.learned) learnedCount++;
          readCountTotal += ld.readCount || 0;
          const pts = ld.parts || [];
          partsCountTotal += pts.length;
          learnedPartsTotal += pts.filter(p => p.learned).length;
          wordsLearnedTotal += Object.keys(ld.wordsLearned || {}).filter(wk => ld.wordsLearned[wk]).length;
          if (ld.toRevise) toReviseCount++;

          const dates = [
            ld.createdAt, ld.updatedAt, ld.learnedAt, ld.firstReadAt, ld.lastReadAt,
            ld.firstCutAt, ld.lastCutAt, ...(Array.isArray(ld.readDates) ? ld.readDates : []),
          ].filter(Boolean);

          for (const d of dates) {
            if (!firstActivityDate || d < firstActivityDate) firstActivityDate = d;
            if (!lastActivityDate || d > lastActivityDate) lastActivityDate = d;
          }
        }
      }
    }

    const masteryPct = totalAyahs > 0 ? Math.min(100, Math.round(masterySum / totalAyahs)) : 0;
    const agg = {
      level: "hizb",
      id: h,
      hizbNumber: h,
      juzNumber: juz,
      bounds,
      pages,
      segments,
      totalAyahs,
      learnedCount,
      readCountTotal,
      partsCountTotal,
      learnedPartsTotal,
      wordsLearnedTotal,
      toReviseCount,
      masteryPct,
      masterySum,
      firstActivityDate,
      lastActivityDate,
      isFullyLearned: totalAyahs > 0 && learnedCount === totalAyahs,
      isCrossSurah: segments.length > 1,
    };

    hizbsAgg.push(agg);
    hizbMap[h] = agg;
  }

  // 3. JUZ (1..30)
  const juzsAgg = [];

  for (let j = 1; j <= 30; j++) {
    const hizbNumbers = getHizbsForJuz(j);
    const h1 = hizbMap[hizbNumbers[0]] || {};
    const h2 = hizbMap[hizbNumbers[1]] || {};

    const totalAyahs = (h1.totalAyahs || 0) + (h2.totalAyahs || 0);
    const learnedCount = (h1.learnedCount || 0) + (h2.learnedCount || 0);
    const readCountTotal = (h1.readCountTotal || 0) + (h2.readCountTotal || 0);
    const partsCountTotal = (h1.partsCountTotal || 0) + (h2.partsCountTotal || 0);
    const learnedPartsTotal = (h1.learnedPartsTotal || 0) + (h2.learnedPartsTotal || 0);
    const wordsLearnedTotal = (h1.wordsLearnedTotal || 0) + (h2.wordsLearnedTotal || 0);
    const toReviseCount = (h1.toReviseCount || 0) + (h2.toReviseCount || 0);
    const masterySum = (h1.masterySum || 0) + (h2.masterySum || 0);

    const dates = [h1.firstActivityDate, h2.firstActivityDate].filter(Boolean).sort();
    const firstActivityDate = dates[0] || null;
    const endDates = [h1.lastActivityDate, h2.lastActivityDate].filter(Boolean).sort();
    const lastActivityDate = endDates[endDates.length - 1] || null;

    const masteryPct = totalAyahs > 0 ? Math.min(100, Math.round(masterySum / totalAyahs)) : 0;

    juzsAgg.push({
      level: "juz",
      id: j,
      juzNumber: j,
      hizbNumbers,
      hizbs: [h1, h2],
      totalAyahs,
      learnedCount,
      readCountTotal,
      partsCountTotal,
      learnedPartsTotal,
      wordsLearnedTotal,
      toReviseCount,
      masteryPct,
      masterySum,
      firstActivityDate,
      lastActivityDate,
      isFullyLearned: totalAyahs > 0 && learnedCount === totalAyahs,
    });
  }

  // Global Quran totals
  const totalQuranAyahs = 6236;
  const globalLearned = surahsAgg.reduce((s, a) => s + a.learnedCount, 0);
  const globalRead = surahsAgg.reduce((s, a) => s + a.readCountTotal, 0);
  const globalMasterySum = surahsAgg.reduce((s, a) => s + a.masterySum, 0);
  const globalMasteryPct = Math.min(100, Math.round(globalMasterySum / totalQuranAyahs));
  const globalToRevise = surahsAgg.reduce((s, a) => s + a.toReviseCount, 0);

  return {
    surahs: surahsAgg,
    hizbs: hizbsAgg,
    juzs: juzsAgg,
    global: {
      totalQuranAyahs,
      learnedAyahs: globalLearned,
      totalRead: globalRead,
      toReviseAyahs: globalToRevise,
      globalMasteryPct,
    },
  };
}
