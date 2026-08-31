import React, { useEffect, useRef, useCallback } from "react";
import { useSelector, shallowEqual } from "react-redux";
import { sel } from "../../store.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseDb } from "../../firebase.js";
import { DATA_KEYS, getDeviceId, mergeLearnData, mergeActivity, mergeCollections } from "../../utils/syncUtils.js";

export function CloudSyncManager({ uid }) {
  const learnData       = useSelector(sel.learnData);
  const collections     = useSelector(sel.collections, shallowEqual);
  const activity        = useSelector(sel.activity);
  const goals           = useSelector(sel.goals, shallowEqual);
  const options         = useSelector(sel.options, shallowEqual);
  const revision = useSelector(sel.revision, shallowEqual);

  const isSyncingRef  = useRef(false);
  const saveTimerRef  = useRef(null);
  const unsubRef      = useRef(null);

  // Apply data fetched from Firestore to local storage + Redux
  const applyCloudData = useCallback((cloudData) => {
    if (!cloudData) return;
    const mergeKey = (k, mergeFn) => {
      if (!cloudData[k]) return;
      try {
        let local = null;
        try { const raw = localStorage.getItem(k); if (raw) local = JSON.parse(raw); } catch {}
        const merged = mergeFn ? mergeFn(local, cloudData[k]) : cloudData[k];
        localStorage.setItem(k, JSON.stringify(merged));
      } catch (e) {
        console.warn(`[Sync] error merging ${k}:`, e);
      }
    };
    mergeKey(DATA_KEYS.LEARN,       mergeLearnData);
    mergeKey(DATA_KEYS.ACTIVITY,    mergeActivity);
    mergeKey(DATA_KEYS.COLLECTIONS, mergeCollections);
    mergeKey(DATA_KEYS.GOALS,       null);
    mergeKey(DATA_KEYS.OPTIONS,     null);
    mergeKey(DATA_KEYS.REVISION,    null);
    window.dispatchEvent(new Event('storage'));
  }, []);

  // Save current local state to Firestore
  const pushToCloud = useCallback(async () => {
    if (!uid || !firebaseDb || isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      const get = (k) => { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch { return null; } };
      const payload = {
        updatedAt: new Date().toISOString(),
        deviceId:  getDeviceId(),
        [DATA_KEYS.LEARN]:       get(DATA_KEYS.LEARN),
        [DATA_KEYS.ACTIVITY]:    get(DATA_KEYS.ACTIVITY),
        [DATA_KEYS.COLLECTIONS]: get(DATA_KEYS.COLLECTIONS),
        [DATA_KEYS.GOALS]:       get(DATA_KEYS.GOALS),
        [DATA_KEYS.OPTIONS]:     get(DATA_KEYS.OPTIONS),
        [DATA_KEYS.REVISION]:    get(DATA_KEYS.REVISION),
      };
      await setDoc(doc(firebaseDb, "users", uid), payload, { merge: true });
    } catch (e) {
      console.warn("[Sync] push error:", e);
    } finally {
      isSyncingRef.current = false;
    }
  }, [uid]);

  // Initial pull from Firestore on sign-in
  useEffect(() => {
    if (!uid || !firebaseDb) return;
    let cancelled = false;
    async function pull() {
      try {
        const snap = await getDoc(doc(firebaseDb, "users", uid));
        if (snap.exists() && !cancelled) {
          applyCloudData(snap.data());
        }
      } catch (e) {
        console.warn("[Sync] initial pull error:", e);
      }
    }
    pull();
    return () => { cancelled = true; };
  }, [uid, applyCloudData]);

  // Debounced push on state changes
  useEffect(() => {
    if (!uid) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(pushToCloud, 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [uid, learnData, collections, activity, goals, options, revision, pushToCloud]);

  return null;
}
