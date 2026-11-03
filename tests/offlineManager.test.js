import { describe, it, expect, beforeEach, vi } from "vitest";
import { indexedDB } from "fake-indexeddb";
import {
  formatBytes,
  calcProgressPercent,
  getStorageUsage,
  getPlayableAudioUrl,
  getSurahOfflineStatus,
  getAllSurahsOfflineStatus,
  removeSurahOfflineAudio,
  removeSurahAllData,
  getGlobalVerseNum,
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

  describe("Pure Functional Formatting & Calculation Helpers", () => {
    it("formatBytes formats byte values properly", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(-100)).toBe("0 B");
      expect(formatBytes(512)).toBe("512 B");
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1024 * 1024)).toBe("1 MB");
      expect(formatBytes(1024 * 1024 * 15.5)).toBe("15.5 MB");
      expect(formatBytes(1024 * 1024 * 1024 * 2.4)).toBe("2.4 GB");
    });

    it("calcProgressPercent calculates progress within [0, 100]", () => {
      expect(calcProgressPercent(0, 0)).toBe(0);
      expect(calcProgressPercent(5, 0)).toBe(0);
      expect(calcProgressPercent(5, 10)).toBe(50);
      expect(calcProgressPercent(7, 7)).toBe(100);
      expect(calcProgressPercent(15, 10)).toBe(100);
      expect(calcProgressPercent(-2, 10)).toBe(0);
    });

    it("getGlobalVerseNum calculates cumulative verse numbers correctly", () => {
      expect(getGlobalVerseNum(1, 1)).toBe(1);
      expect(getGlobalVerseNum(1, 7)).toBe(7);
      // Al-Baqarah (Surah 2) has 286 verses; Surah 1 has 7. First verse of Surah 2 is global 8.
      expect(getGlobalVerseNum(2, 1)).toBe(8);
    });
  });

  describe("Offline Status & Storage Usage", () => {
    it("reports correct offline status for an uncached surah", async () => {
      const status = await getSurahOfflineStatus(1, 7, indexedDB);
      expect(status.totalCount).toBe(7);
      expect(status.audioCount).toBe(0);
      expect(status.isComplete).toBe(false);
      expect(status.percent).toBe(0);
    });

    it("scans all surahs in batch and returns a map of 114 surahs", async () => {
      const { surahsMap, totalDownloadedSurahs, totalCachedAudio, isAllSurahsDownloaded } =
        await getAllSurahsOfflineStatus(indexedDB);

      expect(surahsMap).toBeDefined();
      expect(Object.keys(surahsMap).length).toBe(114);
      expect(surahsMap[1].totalCount).toBe(7);
      expect(typeof totalDownloadedSurahs).toBe("number");
      expect(typeof totalCachedAudio).toBe("number");
      expect(typeof isAllSurahsDownloaded).toBe("boolean");
    });

    it("queries storage usage estimate gracefully", async () => {
      const usage = await getStorageUsage();
      expect(usage).toBeDefined();
      expect(typeof usage.usedBytes).toBe("number");
      expect(typeof usage.quotaBytes).toBe("number");
      expect(typeof usage.formattedUsed).toBe("string");
      expect(typeof usage.formattedQuota).toBe("string");
    });
  });

  describe("Audio URL Resolution & Caching", () => {
    it("resolves original URL when audio is not offline", async () => {
      const url = "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3";
      const res = await getPlayableAudioUrl(url, indexedDB);
      expect(res).toBe(url);
    });

    it("resolves object URL when audio is cached in IndexedDB", async () => {
      const url = "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3";
      const key = getAudioCacheKey(url);
      const buf = new Uint8Array([0x49, 0x44, 0x33]).buffer;

      await cacheAudioBuffer(key, buf, indexedDB);
      const res = await getPlayableAudioUrl(url, indexedDB);
      expect(res).toBeDefined();
      expect(typeof res).toBe("string");
    });

    it("handles empty or invalid inputs gracefully", async () => {
      const emptyUrl = await getPlayableAudioUrl("", indexedDB);
      expect(emptyUrl).toBe("");

      const invalidStatus = await getSurahOfflineStatus(999, null, indexedDB);
      expect(invalidStatus.hasText).toBe(false);
      expect(invalidStatus.audioCount).toBe(0);
      expect(invalidStatus.isComplete).toBe(false);
    });

    it("clears cached audio for a specific surah", async () => {
      const url = "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3";
      const key = getAudioCacheKey(url);
      const buf = new Uint8Array([0x49, 0x44, 0x33]).buffer;

      await cacheAudioBuffer(key, buf, indexedDB);
      const countDeleted = await removeSurahOfflineAudio(1, indexedDB);
      expect(countDeleted).toBe(7);

      const res = await getPlayableAudioUrl(url, indexedDB);
      expect(res).toBe(url); // Should fall back to network URL
    });

    it("clears all data for a surah gracefully", async () => {
      const ok = await removeSurahAllData(1, indexedDB);
      expect(ok).toBe(true);
    });
  });
});
