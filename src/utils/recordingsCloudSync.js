import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy } from "firebase/firestore";
import { firebaseAuth, firebaseDb, firebaseStorage, isFirebaseConfigured } from "../firebase.js";
import { ERROR_CODES, createAppError, normalizeError } from "./errorManager.js";
import {
  getExtensionFromMimeType,
  normalizeRecordingRecord,
  saveRecording,
  updateRecordingMeta,
} from "./recordingsDb.js";

/**
 * Pure check indicating whether Firebase Storage + Firestore cloud sync is active.
 */
export const canSyncRecordingsToCloud = (
  configured = isFirebaseConfigured,
  auth = firebaseAuth
) => Boolean(configured && auth?.currentUser?.uid);

/**
 * Pure builder for Firebase Storage object path.
 */
export const buildRecordingStoragePath = (uid, rec) => {
  const safeUid = String(uid || "").trim();
  const norm = normalizeRecordingRecord(rec || {});
  const ext = getExtensionFromMimeType(norm.mimeType);
  return `users/${safeUid}/recordings/${norm.id}.${ext}`;
};

/**
 * Pure builder converting a local recording into a serializable Firestore metadata document.
 */
export const buildCloudRecordingMetadata = (uid, rec, { cloudUrl, storagePath, syncedAt }) => {
  const norm = normalizeRecordingRecord(rec);
  return {
    id: norm.id,
    uid,
    ayatKey: norm.ayatKey,
    surahNum: norm.surahNum,
    ayatNum: norm.ayatNum,
    text: norm.text || "",
    date: norm.date,
    timestamp: norm.timestamp,
    durationMs: norm.durationMs,
    durationSec: norm.durationSec,
    mimeType: norm.mimeType,
    sizeBytes: norm.sizeBytes,
    compressionPreset: norm.compressionPreset,
    bitrateKbps: norm.bitrateKbps,
    cloudUrl,
    storagePath,
    syncedAt,
  };
};

/**
 * Uploads an audio recording blob to Firebase Storage and mirrors its metadata to Firestore.
 * Updates the local IndexedDB entry with `{ cloudUrl, storagePath, syncedAt, cloudUid }`.
 */
export async function uploadRecordingToCloud(rec) {
  if (!canSyncRecordingsToCloud()) {
    return {
      ok: false,
      error: createAppError(
        ERROR_CODES.CLOUD_STORAGE_ERROR,
        "Connexion Firebase requise pour sauvegarder dans le cloud",
        { reason: "unauthenticated_or_unconfigured" },
        "warning"
      ),
    };
  }
  if (!rec?.blob) {
    return {
      ok: false,
      error: createAppError(
        ERROR_CODES.RECORDING_ERROR,
        "Fichier audio introuvable pour l'envoi vers le cloud",
        { id: rec?.id }
      ),
    };
  }

  try {
    const uid = firebaseAuth.currentUser.uid;
    const norm = normalizeRecordingRecord(rec);
    const storagePath = buildRecordingStoragePath(uid, norm);
    const storageRef = ref(firebaseStorage, storagePath);

    await uploadBytes(storageRef, norm.blob, {
      contentType: norm.mimeType || "audio/webm",
      customMetadata: {
        ayatKey: String(norm.ayatKey),
        compressionPreset: String(norm.compressionPreset),
        bitrateKbps: String(norm.bitrateKbps),
      },
    });

    const cloudUrl = await getDownloadURL(storageRef);
    const syncedAt = new Date().toISOString();
    const meta = buildCloudRecordingMetadata(uid, norm, { cloudUrl, storagePath, syncedAt });

    await setDoc(doc(firebaseDb, "users", uid, "recordings", String(norm.id)), meta, { merge: true });
    await updateRecordingMeta(norm.id, { cloudUrl, storagePath, syncedAt, cloudUid: uid });

    return { ok: true, cloudUrl, storagePath, syncedAt, meta };
  } catch (err) {
    return {
      ok: false,
      error: normalizeError(
        err,
        ERROR_CODES.CLOUD_STORAGE_ERROR,
        "Impossible de sauvegarder l'enregistrement dans Firebase Storage",
        { id: rec?.id }
      ),
    };
  }
}

/**
 * Deletes an audio recording from Firebase Storage and Firestore if synced.
 */
export async function deleteRecordingFromCloud(rec) {
  if (!canSyncRecordingsToCloud()) return { ok: true, skipped: true };
  try {
    const uid = firebaseAuth.currentUser.uid;
    const storagePath = rec?.storagePath || buildRecordingStoragePath(uid, rec);
    if (storagePath) {
      await deleteObject(ref(firebaseStorage, storagePath)).catch((err) => {
        if (err?.code !== "storage/object-not-found") throw err;
      });
    }
    if (rec?.id != null) {
      await deleteDoc(doc(firebaseDb, "users", uid, "recordings", String(rec.id))).catch(() => {});
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: normalizeError(err, ERROR_CODES.CLOUD_STORAGE_ERROR, "Suppression cloud échouée", { id: rec?.id }),
    };
  }
}

/**
 * Fetches metadata of cloud-backed voice recordings for the authenticated user.
 */
export async function fetchCloudRecordingsMeta() {
  if (!canSyncRecordingsToCloud()) return { ok: true, items: [], skipped: true };
  try {
    const uid = firebaseAuth.currentUser.uid;
    const q = query(collection(firebaseDb, "users", uid, "recordings"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => normalizeRecordingRecord(d.data()));
    return { ok: true, items };
  } catch (err) {
    return {
      ok: false,
      items: [],
      error: normalizeError(err, ERROR_CODES.CLOUD_STORAGE_ERROR, "Lecture des sauvegardes cloud échouée"),
    };
  }
}

/**
 * Downloads an audio blob from a Firebase Storage cloudUrl and saves it locally in IndexedDB.
 */
export async function restoreCloudRecordingToLocal(meta, fetchFn = typeof fetch !== "undefined" ? fetch : null) {
  if (!meta?.cloudUrl || typeof fetchFn !== "function") {
    return {
      ok: false,
      error: createAppError(ERROR_CODES.CLOUD_STORAGE_ERROR, "URL cloud manquante pour restaurer l'audio"),
    };
  }
  try {
    const res = await fetchFn(meta.cloudUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const restored = await saveRecording({
      ...meta,
      blob,
      sizeBytes: blob.size || meta.sizeBytes,
      mimeType: blob.type || meta.mimeType,
    });
    return { ok: true, recording: restored };
  } catch (err) {
    return {
      ok: false,
      error: normalizeError(err, ERROR_CODES.CLOUD_STORAGE_ERROR, "Téléchargement depuis Firebase Storage échoué", { id: meta?.id }),
    };
  }
}
