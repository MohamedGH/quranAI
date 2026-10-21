import { describe, it, expect } from "vitest";
import { extractAyatHistoricalMetadata, computeRevisionQueue, computeQuranAggregations } from "../src/utils/quranHistoryAnalytics.js";

describe("quranHistoryAnalytics", () => {
  it("extracts first and last lifecycle milestones for an Ayat", () => {
    const key = "2:255";
    const ld = {
      readCount: 14,
      readDates: ["2026-01-10T10:00:00Z", "2026-02-15T12:00:00Z", "2026-10-18T18:00:00Z"],
      firstReadAt: "2026-01-10T10:00:00Z",
      lastReadAt: "2026-10-18T18:00:00Z",
      learned: true,
      firstLearnedAt: "2026-02-01T08:00:00Z",
      lastLearnedAt: "2026-02-01T08:00:00Z",
      parts: [
        { id: 1, text: "part1", createdAt: "2026-01-12T09:00:00Z", learned: true },
        { id: 2, text: "part2", createdAt: "2026-01-14T11:00:00Z", learned: true },
      ],
      firstCutAt: "2026-01-12T09:00:00Z",
      lastCutAt: "2026-01-14T11:00:00Z",
      wordsLearned: { "0": true, "1": true, "2": true },
      toRevise: { words: [1, 2] },
      reviseHistory: [
        { startDate: "2026-09-01T10:00:00Z", endDate: "2026-09-05T10:00:00Z", words: [0] },
        { startDate: "2026-10-15T14:00:00Z", endDate: null, words: [1, 2] },
      ],
    };
    const ayatText = "اللَّهُ لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ";

    const res = extractAyatHistoricalMetadata(key, ld, ayatText);

    expect(res.surahNum).toBe(2);
    expect(res.ayatNum).toBe(255);
    expect(res.readCount).toBe(14);
    expect(res.firstReadAt).toBe("2026-01-10T10:00:00Z");
    expect(res.lastReadAt).toBe("2026-10-18T18:00:00Z");
    expect(res.firstLearnedAt).toBe("2026-02-01T08:00:00Z");
    expect(res.firstCutAt).toBe("2026-01-12T09:00:00Z");
    expect(res.lastCutAt).toBe("2026-01-14T11:00:00Z");
    expect(res.partsCount).toBe(2);
    expect(res.isCurrentlyToRevise).toBe(true);
    expect(res.reviseWordIndices).toEqual([1, 2]);
    expect(res.timelineEvents.length).toBeGreaterThan(3);
  });

  it("builds the revision queue sorted chronologically with targeted words", () => {
    const learnData = {
      "1:1": {
        toRevise: true, // entire ayat
        updatedAt: "2026-10-01T10:00:00Z",
      },
      "1:2": {
        toRevise: { words: [0, 1] }, // partial
        reviseHistory: [{ startDate: "2026-09-20T10:00:00Z", endDate: null, words: [0, 1] }],
      },
      "1:3": {
        learned: true,
        toRevise: false, // not in queue
      },
    };
    const surahTextCache = {
      1: {
        1: "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ",
        2: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
        3: "الرَّحْمَنِ الرَّحِيمِ",
      },
    };

    const queue = computeRevisionQueue(learnData, [{ number: 1, englishName: "Al-Fatihah", numberOfAyahs: 7 }], surahTextCache);

    expect(queue.length).toBe(2);
    // Chronological order: 1:2 was flagged on 2026-09-20, earlier than 1:1 (2026-10-01)
    expect(queue[0].key).toBe("1:2");
    expect(queue[0].reviseScope).toBe("partial");
    expect(queue[0].reviseWordIndices).toEqual([0, 1]);
    expect(queue[1].key).toBe("1:1");
    expect(queue[1].reviseScope).toBe("all");
  });

  it("computes multi-level hierarchical aggregations for Surah, Hizb and Juz", () => {
    const learnData = {
      "1:1": { learned: true, readCount: 10 },
      "1:2": { learned: true, readCount: 5 },
      "112:1": { learned: true, readCount: 20 },
      "114:1": { learned: true, toRevise: true, readCount: 2 },
    };
    const surahTextCache = {
      1: { 1: "test", 2: "test" },
      112: { 1: "test" },
      114: { 1: "test" },
    };

    const agg = computeQuranAggregations(learnData, [], surahTextCache);

    // Surahs aggregation
    expect(agg.surahs.length).toBe(114);
    const s1 = agg.surahs.find(s => s.number === 1);
    expect(s1.learnedCount).toBe(2);
    expect(s1.readCountTotal).toBe(15);

    // Hizbs aggregation
    expect(agg.hizbs.length).toBe(60);
    const h1 = agg.hizbs.find(h => h.hizbNumber === 1);
    expect(h1.learnedCount).toBe(2);
    expect(h1.readCountTotal).toBe(15);

    const h60 = agg.hizbs.find(h => h.hizbNumber === 60);
    expect(h60.learnedCount).toBe(2); // S112:1 and S114:1 both belong to Hizb 60!
    expect(h60.toReviseCount).toBe(1);

    // Juz aggregation
    expect(agg.juzs.length).toBe(30);
    const j1 = agg.juzs.find(j => j.juzNumber === 1);
    expect(j1.learnedCount).toBe(2);

    const j30 = agg.juzs.find(j => j.juzNumber === 30);
    expect(j30.learnedCount).toBe(2); // contains Hizb 59 and 60
    expect(j30.toReviseCount).toBe(1);
  });
});
