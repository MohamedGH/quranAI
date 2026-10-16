import { describe, it, expect } from "vitest";
import {
  hasAyatTimestamps,
  extractWordTimings,
  resolveSilencedWordIndices,
  mergeSilenceIntervals,
  computeSilenceIntervals,
  isTimeInSilenceInterval,
  findActiveSilenceInterval,
  calculateNextPlaybackTime,
  toggleWordInList,
  formatSilenceStatus,
} from "../src/utils/audioSilenceManager.js";

describe("audioSilenceManager - Functional Audio Masking & Silence Engine", () => {
  const mockTimestamps = {
    words: [
      {
        text: "بِسْمِ",
        chars: [
          { char: "ب", start: 0, end: 120 },
          { char: "س", start: 120, end: 280 },
          { char: "م", start: 280, end: 450 },
        ],
      },
      {
        text: "اللَّهِ",
        chars: [
          { char: "ا", start: 450, end: 550 },
          { char: "ل", start: 550, end: 700 },
          { char: "ه", start: 700, end: 950 },
        ],
      },
      {
        text: "الرَّحْمَٰنِ",
        start: 950,
        end: 1800,
      },
      {
        text: "الرَّحِيمِ",
        start: 1800,
        end: 2600,
      },
    ],
  };

  describe("hasAyatTimestamps", () => {
    it("returns false when timestamps is null, undefined or empty", () => {
      expect(hasAyatTimestamps(null)).toBe(false);
      expect(hasAyatTimestamps(undefined)).toBe(false);
      expect(hasAyatTimestamps({})).toBe(false);
      expect(hasAyatTimestamps({ words: [] })).toBe(false);
    });

    it("returns false when words contain no valid start/end timings", () => {
      const invalid = { words: [{ text: "كلمة" }, { chars: [] }] };
      expect(hasAyatTimestamps(invalid)).toBe(false);
    });

    it("returns true when words have valid numeric character or word timings", () => {
      expect(hasAyatTimestamps(mockTimestamps)).toBe(true);
    });
  });

  describe("extractWordTimings", () => {
    it("extracts clean immutable word timings", () => {
      const timings = extractWordTimings(mockTimestamps);
      expect(timings).toHaveLength(4);

      expect(timings[0]).toEqual({
        index: 0,
        text: "بسم",
        startMs: 0,
        endMs: 450,
        durationMs: 450,
        isValid: true,
      });

      expect(timings[2]).toEqual({
        index: 2,
        text: "الرَّحْمَٰنِ",
        startMs: 950,
        endMs: 1800,
        durationMs: 850,
        isValid: true,
      });

      expect(Object.isFrozen(timings)).toBe(true);
    });

    it("returns empty array when timestamps are missing", () => {
      expect(extractWordTimings(null)).toEqual([]);
    });
  });

  describe("resolveSilencedWordIndices", () => {
    it("silences all words when ld.toRevise is true", () => {
      const indices = resolveSilencedWordIndices({
        ld: { toRevise: true },
        totalWords: 4,
      });
      expect(indices).toEqual([0, 1, 2, 3]);
    });

    it("silences specific words marked in ld.toRevise.words", () => {
      const indices = resolveSilencedWordIndices({
        ld: { toRevise: { words: [1, 3] } },
        totalWords: 4,
      });
      expect(indices).toEqual([1, 3]);
    });

    it("silences words belonging to parts marked in ld.toRevise.parts", () => {
      const ld = {
        parts: [
          { id: "part-1", wordIndices: [0, 1] },
          { id: "part-2", wordIndices: [2, 3] },
        ],
        toRevise: {
          parts: ["part-2"],
        },
      };
      const indices = resolveSilencedWordIndices({ ld, totalWords: 4 });
      expect(indices).toEqual([2, 3]);
    });

    it("merges toRevise words with customSilencedIndices without duplicates", () => {
      const indices = resolveSilencedWordIndices({
        ld: { toRevise: { words: [1] } },
        customIndices: [1, 2],
        totalWords: 4,
      });
      expect(indices).toEqual([1, 2]);
    });

    it("returns empty array if nothing is marked for revision", () => {
      expect(resolveSilencedWordIndices({ ld: null, totalWords: 4 })).toEqual([]);
    });
  });

  describe("computeSilenceIntervals & mergeSilenceIntervals", () => {
    it("computes exact millisecond intervals for silenced words", () => {
      const intervals = computeSilenceIntervals(mockTimestamps, [1, 3]);
      expect(intervals).toHaveLength(2);
      expect(intervals[0].wordIndex).toBe(1);
      expect(intervals[0].startMs).toBe(450);
      expect(intervals[0].endMs).toBe(950);

      expect(intervals[1].wordIndex).toBe(3);
      expect(intervals[1].startMs).toBe(1800);
      expect(intervals[1].endMs).toBe(2600);
    });

    it("merges contiguous or adjacent intervals", () => {
      const contiguous = [
        { startMs: 100, endMs: 500, wordIndex: 0, text: "A" },
        { startMs: 510, endMs: 900, wordIndex: 1, text: "B" }, // gap <= 30ms
      ];
      const merged = mergeSilenceIntervals(contiguous);
      expect(merged).toHaveLength(1);
      expect(merged[0].startMs).toBe(100);
      expect(merged[0].endMs).toBe(900);
      expect(merged[0].wordIndices).toEqual([0, 1]);
    });

    it("returns empty array if timestamps are not provided", () => {
      expect(computeSilenceIntervals(null, [0])).toEqual([]);
    });
  });

  describe("isTimeInSilenceInterval & findActiveSilenceInterval", () => {
    const intervals = [
      { startMs: 500, endMs: 1000, wordIndex: 1, text: "مريم" },
      { startMs: 2000, endMs: 2500, wordIndex: 3, text: "عيسى" },
    ];

    it("detects whether a playback timestamp falls inside a silence interval", () => {
      expect(isTimeInSilenceInterval(400, intervals)).toBe(false);
      expect(isTimeInSilenceInterval(500, intervals)).toBe(true);
      expect(isTimeInSilenceInterval(750, intervals)).toBe(true);
      expect(isTimeInSilenceInterval(1000, intervals)).toBe(false);
      expect(isTimeInSilenceInterval(2200, intervals)).toBe(true);
    });

    it("finds the exact active silence interval object", () => {
      const found = findActiveSilenceInterval(750, intervals);
      expect(found).not.toBeNull();
      expect(found.wordIndex).toBe(1);
      expect(found.text).toBe("مريم");

      expect(findActiveSilenceInterval(1500, intervals)).toBeNull();
    });
  });

  describe("calculateNextPlaybackTime", () => {
    const intervals = [{ startMs: 500, endMs: 1000, wordIndex: 1 }];

    it("calculates skip destination time when inside an interval", () => {
      const targetTime = calculateNextPlaybackTime(600, intervals, 10);
      expect(targetTime).toBe(1010);
    });

    it("keeps current playback time when outside any interval", () => {
      expect(calculateNextPlaybackTime(200, intervals)).toBe(200);
    });
  });

  describe("toggleWordInList", () => {
    it("purely adds an unselected index", () => {
      const res = toggleWordInList([0, 2], 1);
      expect(res).toEqual([0, 1, 2]);
    });

    it("purely removes an already selected index", () => {
      const res = toggleWordInList([0, 1, 2], 1);
      expect(res).toEqual([0, 2]);
    });
  });

  describe("formatSilenceStatus", () => {
    it("flags missing timestamps appropriately", () => {
      const status = formatSilenceStatus({ hasTimestamps: false });
      expect(status.canSilence).toBe(false);
      expect(status.requiresTimestampsNotice).toBe(true);
      expect(status.badgeText).toBe("Timestamps requis");
    });

    it("formats ready state when timestamps are provided but 0 words are marked", () => {
      const status = formatSilenceStatus({ hasTimestamps: true, silencedCount: 0 });
      expect(status.canSilence).toBe(true);
      expect(status.badgeText).toContain("Timestamps fournis");
    });

    it("formats active silence state with word count and mode", () => {
      const status = formatSilenceStatus({
        hasTimestamps: true,
        silencedCount: 3,
        mode: "mute",
      });
      expect(status.canSilence).toBe(true);
      expect(status.badgeText).toContain("3 mots sous silence (Muet)");
    });

    it("displays live notice during active word silence", () => {
      const status = formatSilenceStatus({
        hasTimestamps: true,
        silencedCount: 2,
        isCurrentlySilenced: true,
        activeWordText: "الرَّحْمَٰنِ",
      });
      expect(status.isSilencedNow).toBe(true);
      expect(status.badgeText).toContain("Silence en cours : الرَّحْمَٰنِ");
    });
  });
});
