import { ERROR_CODES, normalizeError } from "./errorManager.js";

// ─── IndexedDB helpers for voice recordings ───────────────────────────────────
const DB_NAME = "QuranRecordings";
const DB_VER = 1;
const STORE = "recordings";

/**
 * Pure parser converting "surahNum:ayatNum" into numeric fields.
 */
export const parseAyatKey = (ayatKey) => {
  if (!ayatKey || typeof ayatKey !== "string") return { surahNum: null, ayatNum: null };
  const [sRaw, aRaw] = ayatKey.split(":");
  const surahNum = Number.parseInt(sRaw, 10);
  const ayatNum = Number.parseInt(aRaw, 10);
  return {
    surahNum: Number.isFinite(surahNum) && surahNum > 0 ? surahNum : null,
    ayatNum: Number.isFinite(ayatNum) && ayatNum > 0 ? ayatNum : null,
  };
};

/**
 * Pure helper mapping an audio MIME type to a file extension.
 */
export const getExtensionFromMimeType = (mimeType = "") => {
  const m = String(mimeType || "").toLowerCase();
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  return "webm";
};

/**
 * Pure normalizer unifying legacy VoiceRecorder records and enriched cloud/local records.
 */
export const normalizeRecordingRecord = (rec) => {
  if (!rec || typeof rec !== "object") return rec;
  const parsed = parseAyatKey(rec.ayatKey);
  const surahNum = Number(rec.surahNum) || parsed.surahNum || 1;
  const ayatNum = Number(rec.ayatNum) || parsed.ayatNum || 1;
  const ayatKey = rec.ayatKey || `${surahNum}:${ayatNum}`;

  const rawDate = rec.date || (rec.timestamp ? new Date(rec.timestamp).toISOString() : null) || (typeof rec.id === "number" ? new Date(rec.id).toISOString() : new Date().toISOString());
  const timestamp = Number(rec.timestamp) || (Date.parse(rawDate) || Number(rec.id) || Date.now());

  const rawDur = Number(rec.durationMs ?? rec.duration ?? 0);
  const durationMs = rec.durationUnit === "s" ? Math.round(rawDur * 1000) : Math.max(0, rawDur);
  const durationSec = Math.max(0, Math.round(durationMs / 1000));

  const sizeBytes = Number(rec.sizeBytes) || Number(rec.blob?.size) || 0;
  const mimeType = rec.mimeType || rec.blob?.type || "audio/webm";

  return {
    ...rec,
    ayatKey,
    surahNum,
    ayatNum,
    date: rawDate,
    timestamp,
    duration: durationMs,
    durationMs,
    durationSec,
    sizeBytes,
    mimeType,
    compressionPreset: rec.compressionPreset || "balanced",
    bitrateKbps: Number(rec.bitrateKbps) || 32,
  };
};

/**
 * Pure helper building a deterministic, descriptive download filename.
 */
export const buildRecordingFilename = (rec) => {
  const norm = normalizeRecordingRecord(rec || {});
  const s = String(norm.surahNum || 0).padStart(3, "0");
  const a = String(norm.ayatNum || 0).padStart(3, "0");
  const d = new Date(norm.timestamp || Date.now());
  const isoDay = Number.isNaN(d.getTime()) ? "audio" : d.toISOString().slice(0, 10);
  const ext = getExtensionFromMimeType(norm.mimeType);
  return `recitation-s${s}-v${a}-${isoDay}-${norm.id || "rec"}.${ext}`;
};

export function openRecDB() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") {
      rej(normalizeError("IndexedDB indisponible", ERROR_CODES.STORAGE_ERROR));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => res(e.target.result);
    req.onerror = () => rej(normalizeError(req.error, ERROR_CODES.STORAGE_ERROR, "Erreur d'ouverture IndexedDB"));
  });
}

export async function saveRecording(rec) {
  const normalized = normalizeRecordingRecord(rec);
  const db = await openRecDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(normalized);
    tx.oncomplete = () => res(normalized);
    tx.onerror = () => rej(normalizeError(tx.error, ERROR_CODES.STORAGE_ERROR, "Impossible de sauvegarder l'enregistrement"));
  });
}

export async function updateRecordingMeta(id, patch = {}) {
  const db = await openRecDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) {
        res(null);
        return;
      }
      const updated = normalizeRecordingRecord({ ...existing, ...patch });
      store.put(updated);
      tx.oncomplete = () => res(updated);
    };
    getReq.onerror = () => rej(normalizeError(getReq.error, ERROR_CODES.STORAGE_ERROR));
    tx.onerror = () => rej(normalizeError(tx.error, ERROR_CODES.STORAGE_ERROR));
  });
}

export async function loadRecordings(ayatKey) {
  const db = await openRecDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      res(
        (req.result || [])
          .map(normalizeRecordingRecord)
          .filter((r) => r.ayatKey === ayatKey)
      );
    req.onerror = () => rej(normalizeError(req.error, ERROR_CODES.STORAGE_ERROR));
  });
}

export async function deleteRecording(id) {
  const db = await openRecDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(normalizeError(tx.error, ERROR_CODES.STORAGE_ERROR));
  });
}

export async function getAllRecordings() {
  const db = await openRecDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => res((req.result || []).map(normalizeRecordingRecord));
    req.onerror = () => rej(normalizeError(req.error, ERROR_CODES.STORAGE_ERROR));
  });
}

/**
 * Triggers a direct file download of a recording blob in the browser.
 */
export const downloadRecordingFile = (rec, doc = typeof document !== "undefined" ? document : null) => {
  if (!rec?.blob || !doc) return false;
  const filename = buildRecordingFilename(rec);
  const url = URL.createObjectURL(rec.blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  doc.body?.appendChild(a);
  a.click();
  doc.body?.removeChild(a);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }, 1500);
  return filename;
};

/**
 * Requests browser persistent storage (`navigator.storage.persist()`) so IndexedDB
 * recordings are protected from automatic eviction when disk space runs low.
 */
export async function requestPersistentStorage(nav = typeof navigator !== "undefined" ? navigator : null) {
  try {
    if (!nav?.storage?.persist) {
      return { supported: false, persisted: false };
    }
    const persisted = await nav.storage.persist();
    return { supported: true, persisted: Boolean(persisted) };
  } catch (err) {
    return { supported: false, persisted: false, error: normalizeError(err, ERROR_CODES.STORAGE_ERROR) };
  }
}

/**
 * Computes storage persistence status, browser quota estimate, and recordings total size.
 */
export async function getStoragePersistenceInfo(nav = typeof navigator !== "undefined" ? navigator : null) {
  let persisted = false;
  let persistSupported = false;
  let usage = 0;
  let quota = 0;

  try {
    if (nav?.storage?.persisted) {
      persistSupported = true;
      persisted = Boolean(await nav.storage.persisted());
    }
    if (nav?.storage?.estimate) {
      const est = await nav.storage.estimate();
      usage = Number(est?.usage || 0);
      quota = Number(est?.quota || 0);
    }
  } catch {}

  let recordingsCount = 0;
  let recordingsBytes = 0;
  try {
    const all = await getAllRecordings();
    recordingsCount = all.length;
    recordingsBytes = all.reduce((sum, r) => sum + (Number(r.sizeBytes) || Number(r.blob?.size) || 0), 0);
  } catch {}

  return {
    persistSupported,
    persisted,
    usage,
    quota,
    recordingsCount,
    recordingsBytes,
  };
}
