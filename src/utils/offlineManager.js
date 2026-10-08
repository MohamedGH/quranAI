// ─── Offline Resource & Download Manager ──────────────────────────────────────
// Manages per-Surah, per-Hizb, and global offline caching for text, timestamps & audio.

import {
  fetchAyats,
  fetchSurahSimple,
  fetchSurahDefault,
  fetchSurahMeta,
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
} from "./audioCache.js";
import { getHizbBounds, getHizbSegments } from "./hizbUtils.js";
import { SURAH_INFO } from "./arabicUtils.js";

/**
 * Resolves a playable audio URL:
 * If an ArrayBuffer or Blob is cached in IndexedDB, returns a blob: URL.
 * Otherwise returns the original network URL.
 */
export async function getPlayableAudioUrl(url) {
  if (!url) return "";
  const key = getAudioCacheKey(url);
  try {
    const buf = await getCachedAudioBuffer(key);
    if (buf && (buf.byteLength > 0 || buf.size > 0)) {
      const blob = buf instanceof Blob ? buf : new Blob([buf], { type: "audio/mpeg" });
      return URL.createObjectURL(blob);
    }
  } catch {}
  return url;
}

/**
 * Checks offline availability status for a Surah:
 * returns { hasText, audioCount, totalCount, isComplete }
 */
export async function getSurahOfflineStatus(surahNum, totalAyahs = null) {
  const count = totalAyahs || SURAH_INFO[surahNum - 1]?.count || 0;
  if (!count) return { hasText: false, audioCount: 0, totalCount: 0, isComplete: false };

  let hasText = false;
  try {
    const ayatsData = await fetchAyats(surahNum);
    hasText = Array.isArray(ayatsData?.ayahs) && ayatsData.ayahs.length >= count;
  } catch {
    hasText = false;
  }

  let audioCount = 0;
  try {
    const db = await openAudioDb();
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

  return {
    hasText,
    audioCount,
    totalCount: count,
    isComplete: hasText && audioCount === count,
  };
}

/**
 * Downloads all resources for a single Surah:
 * - Ayats text & metadata
 * - Simple concordance text
 * - Timestamps for active reciter
 * - Audio MP3s stored directly in IndexedDB
 */
export async function downloadSurahOffline(surahNum, onProgress = () => {}, abortSignal = null) {
  const surahInfo = SURAH_INFO[surahNum - 1];
  const count = surahInfo?.count || 1;
  const reciter = getGlobalRecitator();
  const audioBase = getAudioBase();

  onProgress({ phase: "text", done: 0, total: count, message: `Chargement du texte de la Sourate ${surahNum}...` });

  // 1. Fetch text & metadata
  const ayatData = await fetchAyats(surahNum);
  if (abortSignal?.aborted) throw new Error("Téléchargement annulé");
  await fetchSurahSimple(surahNum);
  if (abortSignal?.aborted) throw new Error("Téléchargement annulé");
  await fetchSurahDefault(surahNum);
  if (abortSignal?.aborted) throw new Error("Téléchargement annulé");
  await fetchSurahMeta(surahNum);

  // 2. Fetch timestamps
  onProgress({ phase: "timestamps", done: 0, total: count, message: `Chargement des timestamps (${reciter})...` });
  try {
    await loadTimestampsForSurah(surahNum, reciter);
  } catch {}

  if (abortSignal?.aborted) throw new Error("Téléchargement annulé");

  // 3. Download and cache Audio files into IndexedDB
  const ayahs = ayatData?.ayahs || [];
  let audioDone = 0;

  for (let i = 0; i < ayahs.length; i++) {
    if (abortSignal?.aborted) throw new Error("Téléchargement annulé");
    const a = ayahs[i];
    const url = `${audioBase}/${a.number}.mp3`;
    const key = getAudioCacheKey(url);

    // Check if already in cache
    const existing = await getCachedAudioBuffer(key);
    if (!existing) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          if (buf && buf.byteLength > 0) {
            await cacheAudioBuffer(key, buf);
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
function getGlobalVerseNum(surahNum, ayahNum) {
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
    if (abortSignal?.aborted) throw new Error("Téléchargement annulé");
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
export async function removeSurahOfflineAudio(surahNum) {
  const count = SURAH_INFO[surahNum - 1]?.count || 0;
  const audioBase = getAudioBase();
  const db = await openAudioDb();

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
