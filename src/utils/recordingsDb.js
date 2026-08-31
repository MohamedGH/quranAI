// ─── IndexedDB helpers for voice recordings ────────────────────────
const DB_NAME = "QuranRecordings";
const DB_VER = 1;
const STORE = "recordings";

export function openRecDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => rej(req.error);
  });
}

export async function saveRecording(rec) {
  const db = await openRecDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function loadRecordings(ayatKey) {
  const db = await openRecDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => res((req.result || []).filter(r => r.ayatKey === ayatKey));
    req.onerror = () => rej(req.error);
  });
}

export async function deleteRecording(id) {
  const db = await openRecDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
