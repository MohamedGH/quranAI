import { describe, it, expect, beforeEach } from "vitest";
import { PersistenceRepository } from "../src/utils/persistenceRepository.js";
import { DATA_KEYS } from "../src/utils/syncUtils.js";

// Mock localStorage if running in a node environment without window.localStorage
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] ?? null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = new MockStorage();
}

describe("Unified Persistence Repository", () => {
  beforeEach(() => {
    if (globalThis.localStorage) {
      globalThis.localStorage.clear();
    }
  });

  it("handles getLocal and setLocal with safe serialization", () => {
    PersistenceRepository.setLocal("test_key", { a: 1, b: "hello" });
    const res = PersistenceRepository.getLocal("test_key");
    expect(res).toEqual({ a: 1, b: "hello" });
  });

  it("merges cloud data into local storage properly and returns merged state", () => {
    // Initial local data
    PersistenceRepository.setLocal(DATA_KEYS.LEARN, {
      "1:1": { learned: false, readCount: 3, updatedAt: "2026-01-01T00:00:00Z" }
    });

    // Cloud incoming data with updated state
    const cloudPayload = {
      [DATA_KEYS.LEARN]: {
        "1:1": { learned: true, readCount: 5, updatedAt: "2026-02-01T00:00:00Z" },
        "1:2": { learned: true, readCount: 1, updatedAt: "2026-02-01T00:00:00Z" }
      },
      [DATA_KEYS.COLLECTIONS]: [
        { id: 101, name: "Favorite Ayahs", ayats: [{ surahNum: 1, ayatNum: 1 }] }
      ]
    };

    const merged = PersistenceRepository.mergeCloudData(cloudPayload);
    expect(merged).toBeDefined();
    expect(merged.learnData["1:1"].learned).toBe(true);
    expect(merged.learnData["1:1"].readCount).toBe(5);
    expect(merged.learnData["1:2"].learned).toBe(true);
    expect(merged.collections.length).toBe(1);

    // Verify localStorage has the merged content
    const storedLearn = PersistenceRepository.getLocal(DATA_KEYS.LEARN);
    expect(storedLearn["1:1"].learned).toBe(true);
  });
});
