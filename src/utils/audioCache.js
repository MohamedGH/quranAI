// ─── Audio Caching & Offline Storage Utility ──────────────────────────────────
// Provides reliable IndexedDB storage, key derivation, and Cache-Fallback logic

export const IDB_NAME = "quran-ts-cache";
export const IDB_AUDIO_STORE = "audio";
export const IDB_QURAN_STORE = "quran";
export const IDB_TIMESTAMPS_STORE = "timestamps";
export const IDB_VERSION = 3;

/**
 * Generates an unambiguous, unique cache key for an audio file including reciter and bitrate.
 * Avoids collisions when switching reciters.
 * e.g. "https://cdn.islamic.network/quran/audio/128/ar.alafasy/7.mp3" -> "ar.alafasy_128_7.mp3"
 */
export function getAudioCacheKey(url) {
  if (!url) return "";
  try {
    const parts = url.split("/").filter(Boolean);
    if (parts.length === 1) return parts[0];
    const filename = parts.pop() || "";
    const reciter = parts.pop() || "default";
    const bitrate = parts.pop() || "128";
    if (filename.endsWith(".mp3")) {
      return `${reciter}_${bitrate}_${filename}`;
    }
    return filename;
  } catch {
    return url.split("/").pop() || url;
  }
}

/**
 * Opens or upgrades the IndexedDB Quran database
 */
export function openAudioDb(customIndexedDB = typeof indexedDB !== "undefined" ? indexedDB : null) {
  if (!customIndexedDB) {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }

  return new Promise((resolve, reject) => {
    const req = customIndexedDB.open(IDB_NAME, IDB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_AUDIO_STORE)) {
        db.createObjectStore(IDB_AUDIO_STORE);
      }
      if (!db.objectStoreNames.contains(IDB_QURAN_STORE)) {
        db.createObjectStore(IDB_QURAN_STORE);
      }
      if (!db.objectStoreNames.contains(IDB_TIMESTAMPS_STORE)) {
        db.createObjectStore(IDB_TIMESTAMPS_STORE);
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Stores raw audio ArrayBuffer or Blob in IndexedDB
 */
export async function cacheAudioBuffer(key, buffer, customIndexedDB) {
  const db = await openAudioDb(customIndexedDB);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_AUDIO_STORE, "readwrite");
    tx.objectStore(IDB_AUDIO_STORE).put(buffer, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Retrieves cached audio ArrayBuffer or Blob from IndexedDB
 */
export async function getCachedAudioBuffer(key, customIndexedDB) {
  const db = await openAudioDb(customIndexedDB);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_AUDIO_STORE, "readonly");
    const req = tx.objectStore(IDB_AUDIO_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Checks if an audio file exists in cache
 */
export async function isAudioCached(key, customIndexedDB) {
  const buf = await getCachedAudioBuffer(key, customIndexedDB);
  return !!buf;
}

/**
 * Clears audio cache
 */
export async function clearAudioCache(customIndexedDB) {
  const db = await openAudioDb(customIndexedDB);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_AUDIO_STORE, "readwrite");
    tx.objectStore(IDB_AUDIO_STORE).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Creates an offline-ready HTTP 200 / 206 audio response from cached ArrayBuffer
 */
export function createAudioResponseFromBuffer(arrayBuffer, rangeHeader = null) {
  if (!arrayBuffer) {
    return new Response(null, { status: 404, statusText: "Not Found in Cache" });
  }

  const totalLength = arrayBuffer.byteLength;

  if (rangeHeader) {
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalLength - 1;

      if (start < totalLength && end < totalLength && start <= end) {
        const chunk = arrayBuffer.slice(start, end + 1);
        return new Response(chunk, {
          status: 206,
          statusText: "Partial Content",
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Range": `bytes ${start}-${end}/${totalLength}`,
            "Content-Length": String(chunk.byteLength),
            "Accept-Ranges": "bytes",
          },
        });
      }
    }
  }

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(totalLength),
      "Accept-Ranges": "bytes",
    },
  });
}
