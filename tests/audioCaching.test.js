import { describe, it, expect, beforeEach } from "vitest";
import { indexedDB } from "fake-indexeddb";
import {
  getAudioCacheKey,
  openAudioDb,
  cacheAudioBuffer,
  getCachedAudioBuffer,
  isAudioCached,
  clearAudioCache,
  createAudioResponseFromBuffer,
  IDB_NAME,
  IDB_AUDIO_STORE,
} from "../src/utils/audioCache.js";

describe("Audio Caching & Offline Storage Engine", () => {
  beforeEach(async () => {
    // Clear and reset database before each test
    await clearAudioCache(indexedDB);
  });

  describe("getAudioCacheKey (Collision Prevention)", () => {
    it("derives reciter-specific, bitrate-safe keys from CDN audio URLs", () => {
      const urlAlafasy = "https://cdn.islamic.network/quran/audio/128/ar.alafasy/7.mp3";
      expect(getAudioCacheKey(urlAlafasy)).toBe("ar.alafasy_128_7.mp3");

      const urlHusary = "https://cdn.islamic.network/quran/audio/64/ar.husary/7.mp3";
      expect(getAudioCacheKey(urlHusary)).toBe("ar.husary_64_7.mp3");
    });

    it("handles fallback URLs or basic filenames", () => {
      expect(getAudioCacheKey("7.mp3")).toBe("7.mp3");
      expect(getAudioCacheKey("")).toBe("");
    });
  });

  describe("IndexedDB Storage Operations", () => {
    it("opens and initializes the quran-ts-cache database with audio store", async () => {
      const db = await openAudioDb(indexedDB);
      expect(db.name).toBe(IDB_NAME);
      expect(db.objectStoreNames.contains(IDB_AUDIO_STORE)).toBe(true);
      expect(db.objectStoreNames.contains("quran")).toBe(true);
      expect(db.objectStoreNames.contains("timestamps")).toBe(true);
    });

    it("saves and retrieves audio binary data (ArrayBuffer)", async () => {
      const fakeAudioBuffer = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]).buffer;
      const key = "ar.alafasy_128_1.mp3";

      // Verify not cached yet
      expect(await isAudioCached(key, indexedDB)).toBe(false);

      // Save to cache
      await cacheAudioBuffer(key, fakeAudioBuffer, indexedDB);

      // Verify now cached
      expect(await isAudioCached(key, indexedDB)).toBe(true);

      // Retrieve and verify byte length
      const cached = await getCachedAudioBuffer(key, indexedDB);
      expect(cached).not.toBeNull();
      expect(cached.byteLength).toBe(fakeAudioBuffer.byteLength);
    });

    it("clears cached audio when requested", async () => {
      const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
      await cacheAudioBuffer("temp.mp3", buffer, indexedDB);
      expect(await isAudioCached("temp.mp3", indexedDB)).toBe(true);

      await clearAudioCache(indexedDB);
      expect(await isAudioCached("temp.mp3", indexedDB)).toBe(false);
    });
  });

  describe("Offline Audio HTTP Response Generation (Service Worker Simulation)", () => {
    it("creates standard 200 OK responses with correct audio/mpeg headers", async () => {
      const buffer = new Uint8Array([10, 20, 30, 40, 50]).buffer;
      const response = createAudioResponseFromBuffer(buffer);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
      expect(response.headers.get("Content-Length")).toBe("5");
      expect(response.headers.get("Accept-Ranges")).toBe("bytes");

      const body = await response.arrayBuffer();
      expect(body.byteLength).toBe(5);
    });

    it("supports HTTP 206 Partial Content for byte-range streaming", async () => {
      const buffer = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer; // 10 bytes
      const rangeHeader = "bytes=2-5";
      const response = createAudioResponseFromBuffer(buffer, rangeHeader);

      expect(response.status).toBe(206);
      expect(response.headers.get("Content-Range")).toBe("bytes 2-5/10");
      expect(response.headers.get("Content-Length")).toBe("4");

      const slice = await response.arrayBuffer();
      expect(slice.byteLength).toBe(4);
    });

    it("returns 404 response for missing audio buffer", () => {
      const response = createAudioResponseFromBuffer(null);
      expect(response.status).toBe(404);
    });
  });
});
