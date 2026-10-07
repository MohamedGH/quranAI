// ─── Unified Persistence & Repository Manager ────────────────────────────────
// Encapsulates local state, IndexedDB audio cache, and Cloud Sync operations.

import { safeGetItem, safeSetItem, safeRemoveItem } from "./safeStorage.js";
import { DATA_KEYS, mergeLearnData, mergeActivity, mergeCollections } from "./syncUtils.js";
import { cacheAudioBuffer, getCachedAudioBuffer, clearAudioCache } from "./audioCache.js";

/**
 * High-level Persistence Repository
 */
export const PersistenceRepository = {
  // Local storage access
  getLocal(key, fallback = null) {
    return safeGetItem(key, fallback);
  },

  setLocal(key, value) {
    return safeSetItem(key, value);
  },

  removeLocal(key) {
    return safeRemoveItem(key);
  },

  // Audio caching
  async cacheAudio(key, buffer) {
    try {
      return await cacheAudioBuffer(key, buffer);
    } catch (e) {
      console.warn("[PersistenceRepository] cacheAudio error:", e);
      return false;
    }
  },

  async getCachedAudio(key) {
    try {
      return await getCachedAudioBuffer(key);
    } catch (e) {
      console.warn("[PersistenceRepository] getCachedAudio error:", e);
      return null;
    }
  },

  async clearAudio() {
    try {
      return await clearAudioCache();
    } catch (e) {
      console.warn("[PersistenceRepository] clearAudio error:", e);
      return false;
    }
  },

  // Merge cloud payload into local and return merged state for Redux hydration
  mergeCloudData(cloudData) {
    if (!cloudData || typeof cloudData !== "object") return null;

    const mergedState = {};

    // 1. Learn Data
    if (cloudData[DATA_KEYS.LEARN]) {
      const local = safeGetItem(DATA_KEYS.LEARN, {});
      const merged = mergeLearnData(local, cloudData[DATA_KEYS.LEARN]);
      safeSetItem(DATA_KEYS.LEARN, merged);
      mergedState.learnData = merged;
    }

    // 2. Activity
    if (cloudData[DATA_KEYS.ACTIVITY]) {
      const local = safeGetItem(DATA_KEYS.ACTIVITY, {});
      const merged = mergeActivity(local, cloudData[DATA_KEYS.ACTIVITY]);
      safeSetItem(DATA_KEYS.ACTIVITY, merged);
      mergedState.activity = merged;
    }

    // 3. Collections
    if (cloudData[DATA_KEYS.COLLECTIONS]) {
      const local = safeGetItem(DATA_KEYS.COLLECTIONS, []);
      const merged = mergeCollections(local, cloudData[DATA_KEYS.COLLECTIONS]);
      safeSetItem(DATA_KEYS.COLLECTIONS, merged);
      mergedState.collections = merged;
    }

    // 4. Goals & Revision
    if (cloudData[DATA_KEYS.REVISION]) {
      safeSetItem(DATA_KEYS.REVISION, cloudData[DATA_KEYS.REVISION]);
      mergedState.revision = cloudData[DATA_KEYS.REVISION];
    }

    if (cloudData[DATA_KEYS.GOALS]) {
      safeSetItem(DATA_KEYS.GOALS, cloudData[DATA_KEYS.GOALS]);
      mergedState.goals = cloudData[DATA_KEYS.GOALS];
    }

    return mergedState;
  }
};
