import React, { useEffect, useRef, useCallback } from "react";
import { useSelector, useDispatch, shallowEqual } from "react-redux";
import { sel, learnActions, collectionsActions, goalsActions, revisionActions } from "../../store.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseDb, isFirebaseConfigured } from "../../firebase.js";
import { DATA_KEYS, getDeviceId } from "../../utils/syncUtils.js";
import { safeGetItem } from "../../utils/safeStorage.js";
import { PersistenceRepository } from "../../utils/persistenceRepository.js";

export function CloudSyncManager({ uid }) {
  const dispatch = useDispatch();
  const learnData       = useSelector(sel.learnData);
  const collections     = useSelector(sel.collections, shallowEqual);
  const activity        = useSelector(sel.activity);
  const goals           = useSelector(sel.goals, shallowEqual);
  const options         = useSelector(sel.options, shallowEqual);
  const revision = useSelector(sel.revision, shallowEqual);

  const isSyncingRef  = useRef(false);
  const saveTimerRef  = useRef(null);

  // Apply data fetched from Firestore to local storage + Redux
  const applyCloudData = useCallback((cloudData) => {
    if (!cloudData) return;
    const mergedState = PersistenceRepository.mergeCloudData(cloudData);
    if (!mergedState) return;

    if (mergedState.learnData) {
      dispatch(learnActions.restoreFromCloud(mergedState.learnData));
    }
    if (mergedState.collections) {
      dispatch(collectionsActions.restoreFromCloud(mergedState.collections));
    }
    if (mergedState.activity) {
      dispatch(goalsActions.restoreActivityFromCloud(mergedState.activity));
    }
    if (mergedState.revision) {
      dispatch(revisionActions.restoreFromCloud(mergedState.revision));
    }
  }, [dispatch]);

  // Save current local state to Firestore
  const pushToCloud = useCallback(async () => {
    if (!uid || !firebaseDb || !isFirebaseConfigured || isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      const get = (k) => safeGetItem(k, null);
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
    if (!uid || !firebaseDb || !isFirebaseConfigured) return;
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
    if (!uid || !isFirebaseConfigured) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(pushToCloud, 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [uid, learnData, collections, activity, goals, options, revision, pushToCloud]);

  return null;
}
