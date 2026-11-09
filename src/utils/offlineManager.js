// ─── Offline Resource & Download Manager ──────────────────────────────────────
// Manages per-Surah, per-Hizb, and global offline caching for text, translations, timestamps & audio.

import {
  fetchAyats,
  fetchSurahSimple,
  fetchSurahDefault,
  fetchSurahMeta,
  fetchSurahTranslation,
  fetchSurahWbw,
  loadTimestampsForSurah,
  getAudioBase,
  getGlobalRecitator,
} from "./reciterAudio.js";
import {
  openAudioDb,
  cacheAudioBuffer,
  getCachedAudioBuffer,
  getAudioCacheKey,
  IDB_AUDIO_STORE,
  IDB_QURAN_STORE,
} from "./audioCache.js";
import { getHizbBounds, getHizbSegments } from "./hizbUtils.js";
import { SURAH_INFO } from "./arabicUtils.js";
import { ERROR_CODES, createAppError } from "./errorManager.js";

/**
 * Pure functional helper to format bytes into readable units (B, KB, MB, GB).
 */
export const formatBytes = (bytes = 0, decimals = 1) => {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${parseFloat((num / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || "MB"}`;
};

/**
 * Pure functional progress calculation helper.
 */
export const calcProgressPercent = (done = 0, total = 0) => {
  const d = Math.max(0, Number(done) || 0);
  const t = Math.max(0, Number(total) || 0);
  if (t === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((d / t) * 100)));
};

/**
 * Retrieves browser storage usage estimate (quota & used space in IndexedDB & Cache).
 */
export async function getStorageUsage() {
  if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.estimate === "function") {
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : 0;
      return {
        usedBytes: usage,
        quotaBytes: quota,
        percentUsed,
        formattedUsed: formatBytes(usage),
        formattedQuota: formatBytes(quota),
      };
    } catch {
      // Fallback
    }
  }
  return {
    usedBytes: 0,
    quotaBytes: 0,
    percentUsed: 0,
    formattedUsed: "Non supporté",
    formattedQuota: "Illimité",
  };
}

/**
 * Resolves a playable audio URL:
 * 1. Checks IndexedDB cache for an existing buffer/blob.
 * 2. Checks Cache API (if supported).
 * 3. Otherwise returns the original network URL.
 */
export async function getPlayableAudioUrl(url, customIndexedDB = null) {
  if (!url) return "";
  const key = getAudioCacheKey(url);

  // 1. IndexedDB lookup
  try {
    const buf = await getCachedAudioBuffer(key, customIndexedDB);
    if (buf && (buf.byteLength > 0 || buf.size > 0)) {
      if (typeof URL !== "undefined" && typeof Blob !== "undefined") {
        const blob = buf instanceof Blob ? buf : new Blob([buf], { type: "audio/mpeg" });
        return URL.createObjectURL(blob);
      }
    }
  } catch {}

  // 2. Cache API lookup
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const match = await window.caches.match(url);
      if (match) {
        const blob = await match.blob();
        if (blob && blob.size > 0 && typeof URL !== "undefined") {
          return URL.createObjectURL(blob);
        }
      }
    } catch {}
  }

  return url;
}

/**
 * Checks offline availability status for a Surah:
 * returns { hasText, audioCount, totalCount, isComplete, percent }
 */
export async function getSurahOfflineStatus(surahNum, totalAyahs = null, customIndexedDB = null) {
  const count = totalAyahs || SURAH_INFO[surahNum - 1]?.count || 0;
  if (!count) return { hasText: false, audioCount: 0, totalCount: 0, isComplete: false, percent: 0 };

  let hasText = false;
  try {
    const ayatsData = await fetchAyats(surahNum);
    hasText = Array.isArray(ayatsData?.ayahs) && ayatsData.ayahs.length >= count;
  } catch {
    hasText = false;
  }

  let audioCount = 0;
  try {
    const db = await openAudioDb(customIndexedDB);
    const tx = db.transaction(IDB_AUDIO_STORE, "readonly");
    const store = tx.objectStore(IDB_AUDIO_STORE);
    const audioBase = getAudioBase();

    // Check each ayah in this surah
    const checks = [];
    for (let an = 1; an <= count; an++) {
      const globalNum = getGlobalVerseNum(surahNum, an);
      const url = `${audioBase}/${globalNum}.mp3`;
      const key = getAudioCacheKey(url);
      checks.push(
        new Promise((resolve) => {
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ? 1 : 0);
          req.onerror = () => resolve(0);
        })
      );
    }
    const results = await Promise.all(checks);
    audioCount = results.reduce((s, c) => s + c, 0);
  } catch {
    audioCount = 0;
  }

  const isComplete = hasText && audioCount === count;
  const percent = calcProgressPercent(audioCount, count);

  return {
    hasText,
    audioCount,
    totalCount: count,
    isComplete,
    percent,
  };
}

/**
 * Scans offline status for all 114 Surahs in batch.
 */
export async function getAllSurahsOfflineStatus(customIndexedDB = null) {
  let db = null;
  try {
    db = await openAudioDb(customIndexedDB);
  } catch {}

  const audioBase = getAudioBase();
  const surahsMap = {};
  let totalDownloadedSurahs = 0;
  let totalCachedAudio = 0;

  let cachedKeysSet = new Set();
  if (db) {
    try {
      const tx = db.transaction(IDB_AUDIO_STORE, "readonly");
      const store = tx.objectStore(IDB_AUDIO_STORE);
      const allKeys = await new Promise((resolve) => {
        const req = store.getAllKeys ? store.getAllKeys() : null;
        if (!req) return resolve([]);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      cachedKeysSet = new Set(allKeys);
    } catch {}
  }

  for (let s = 1; s <= 114; s++) {
    const count = SURAH_INFO[s - 1]?.count || 0;
    let audioCount = 0;

    if (cachedKeysSet.size > 0) {
      for (let an = 1; an <= count; an++) {
        const globalNum = getGlobalVerseNum(s, an);
        const url = `${audioBase}/${globalNum}.mp3`;
        const key = getAudioCacheKey(url);
        if (cachedKeysSet.has(key)) {
          audioCount++;
        }
      }
    }

    const isComplete = audioCount === count && count > 0;
    if (isComplete) totalDownloadedSurahs++;
    totalCachedAudio += audioCount;

    surahsMap[s] = {
      surahNum: s,
      hasText: true,
      audioCount,
      totalCount: count,
      isComplete,
      percent: calcProgressPercent(audioCount, count),
    };
  }

  return {
    surahsMap,
    totalDownloadedSurahs,
    totalCachedAudio,
    isAllSurahsDownloaded: totalDownloadedSurahs === 114,
  };
}

/**
 * Downloads all resources for a single Surah:
 * - Ayats text & metadata
 * - Translations (French Hamidullah & English Sahih)
 * - Word-by-word data
 * - Timestamps for active reciter
 * - Audio MP3s stored directly in IndexedDB
 */
export async function downloadSurahOffline(
  surahNum,
  onProgress = () => {},
  abortSignal = null,
  options = {}
) {
  const surahInfo = SURAH_INFO[surahNum - 1];
  const count = surahInfo?.count || 1;
  const reciter = options.reciter || getGlobalRecitator();
  const audioBase = getAudioBase();
  const customIndexedDB = options.customIndexedDB || null;

  onProgress({
    phase: "text",
    done: 0,
    total: count,
    message: `Chargement du texte de la Sourate ${surahNum}...`,
  });

  // 1. Fetch text & metadata
  const ayatData = await fetchAyats(surahNum);
  if (abortSignal?.aborted) throw createAppError(ERROR_CODES.DOWNLOAD_ERROR, "Téléchargement annulé");
  await fetchSurahSimple(surahNum);
  if (abortSignal?.aborted) throw createAppError(ERROR_CODES.DOWNLOAD_ERROR, "Téléchargement annulé");
  await fetchSurahDefault(surahNum);
  if (abortSignal?.aborted) throw createAppError(ERROR_CODES.DOWNLOAD_ERROR, "Téléchargement annulé");
  await fetchSurahMeta(surahNum);

  // 2. Fetch translations & Word-by-Word
  onProgress({
    phase: "translations",
    done: 0,
    total: count,
    message: `Chargement des traductions (FR / EN)...`,
  });
  try {
    await fetchSurahTranslation(surahNum, "fr");
    await fetchSurahTranslation(surahNum, "en");
    await fetchSurahWbw(surahNum, "fr");
  } catch {}

  if (abortSignal?.aborted) throw createAppError(ERROR_CODES.DOWNLOAD_ERROR, "Téléchargement annulé");

  // 3. Fetch timestamps
  onProgress({
    phase: "timestamps",
    done: 0,
    total: count,
    message: `Chargement des timestamps (${reciter})...`,
  });
  try {
    await loadTimestampsForSurah(surahNum, reciter);
  } catch {}

  if (abortSignal?.aborted) throw createAppError(ERROR_CODES.DOWNLOAD_ERROR, "Téléchargement annulé");

  // 4. Download and cache Audio files into IndexedDB
  const ayahs = ayatData?.ayahs || [];
  let audioDone = 0;

  for (let i = 0; i < ayahs.length; i++) {
    if (abortSignal?.aborted) throw createAppError(ERROR_CODES.DOWNLOAD_ERROR, "Téléchargement annulé");
    const a = ayahs[i];
    const url = `${audioBase}/${a.number}.mp3`;
    const key = getAudioCacheKey(url);

    // Check if already in cache
    const existing = await getCachedAudioBuffer(key, customIndexedDB);
    if (!existing) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          if (buf && buf.byteLength > 0) {
            await cacheAudioBuffer(key, buf, customIndexedDB);
          }
        }
      } catch (err) {
        console.warn(`Erreur cache audio v.${a.numberInSurah}:`, err);
      }
    }

    audioDone++;
    onProgress({
      phase: "audio",
      done: audioDone,
      total: ayahs.length,
      message: `Audio Sourate ${surahNum} : ${audioDone}/${ayahs.length} versets`,
    });
  }

  return { success: true, count: audioDone };
}

/**
 * Helper to compute global ayah number (1..6236)
 */
export function getGlobalVerseNum(surahNum, ayahNum) {
  let acc = 0;
  for (let s = 1; s < surahNum; s++) {
    acc += SURAH_INFO[s - 1]?.count || 0;
  }
  return acc + ayahNum;
}

/**
 * Downloads all Surahs composing a Hizb for offline reading and listening.
 */
export async function downloadHizbOffline(hizbNum, onProgress = () => {}, abortSignal = null) {
  const segments = getHizbSegments(hizbNum);
  if (!segments || segments.length === 0) return { success: false };

  const totalSegments = segments.length;
  for (let idx = 0; idx < totalSegments; idx++) {
    if (abortSignal?.aborted) throw createAppError(ERROR_CODES.DOWNLOAD_ERROR, "Téléchargement annulé");
    const seg = segments[idx];
    onProgress({
      phase: "segment",
      done: idx,
      total: totalSegments,
      message: `Hizb ${hizbNum} · Sourate ${seg.surahNum} (${seg.surahEn})...`,
    });
    await downloadSurahOffline(seg.surahNum, onProgress, abortSignal);
  }

  return { success: true };
}

/**
 * Clears cached audio for a specific surah to save storage space.
 */
export async function removeSurahOfflineAudio(surahNum, customIndexedDB = null) {
  const count = SURAH_INFO[surahNum - 1]?.count || 0;
  const audioBase = getAudioBase();
  const db = await openAudioDb(customIndexedDB);

  const keysToDelete = [];
  for (let an = 1; an <= count; an++) {
    const globalNum = getGlobalVerseNum(surahNum, an);
    const url = `${audioBase}/${globalNum}.mp3`;
    keysToDelete.push(getAudioCacheKey(url));
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_AUDIO_STORE, "readwrite");
    const store = tx.objectStore(IDB_AUDIO_STORE);
    keysToDelete.forEach((k) => store.delete(k));
    tx.oncomplete = () => resolve(keysToDelete.length);
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Clears both audio and quran text data for a surah from IndexedDB.
 */
export async function removeSurahAllData(surahNum, customIndexedDB = null) {
  await removeSurahOfflineAudio(surahNum, customIndexedDB);
  try {
    const db = await openAudioDb(customIndexedDB);
    const tx = db.transaction(IDB_QURAN_STORE, "readwrite");
    const store = tx.objectStore(IDB_QURAN_STORE);
    store.delete(`alafasy:${surahNum}`);
    store.delete(`text:${surahNum}`);
    store.delete(`simple:${surahNum}`);
  } catch {}
  return true;
}
