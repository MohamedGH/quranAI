import { describe, it, expect, beforeEach, vi } from "vitest";
import { indexedDB } from "fake-indexeddb";
import {
  getPlayableAudioUrl,
  getSurahOfflineStatus,
  downloadSurahOffline,
  removeSurahOfflineAudio,
} from "../src/utils/offlineManager.js";
import { cacheAudioBuffer, clearAudioCache, getAudioCacheKey } from "../src/utils/audioCache.js";

// Mock global indexedDB for the offline manager test environment
if (typeof globalThis.indexedDB === "undefined") {
  globalThis.indexedDB = indexedDB;
}

describe("Offline Manager & Download Engine", () => {
  beforeEach(async () => {
    await clearAudioCache(indexedDB);
  });

  it("reports correct offline status for an uncached surah", async () => {
    const status = await getSurahOfflineStatus(1, 7);
    expect(status.totalCount).toBe(7);
    expect(status.audioCount).toBe(0);
    expect(status.isComplete).toBe(false);
  });

  it("resolves original URL when audio is not offline", async () => {
    const url = "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3";
    const res = await getPlayableAudioUrl(url);
    expect(res).toBe(url);
  });

  it("resolves object URL when audio is cached in IndexedDB", async () => {
    const url = "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3";
    const key = getAudioCacheKey(url);
    const buf = new Uint8Array([0x49, 0x44, 0x33]).buffer;

    await cacheAudioBuffer(key, buf, indexedDB);
    const res = await getPlayableAudioUrl(url);
    expect(res).toBeDefined();
    expect(typeof res).toBe("string");
  });

  it("handles empty or invalid inputs gracefully", async () => {
    const emptyUrl = await getPlayableAudioUrl("");
    expect(emptyUrl).toBe("");

    const invalidStatus = await getSurahOfflineStatus(999);
    expect(invalidStatus.hasText).toBe(false);
    expect(invalidStatus.audioCount).toBe(0);
    expect(invalidStatus.isComplete).toBe(false);
  });
});
