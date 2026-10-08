import { describe, it, expect } from "vitest";
import { computeMastery, computeDisplayedPartMastery, masteryColor } from "../src/components/common/Mastery.jsx";

describe("Mastery Engine", () => {
  it("computes 100% mastery when no toRevise is set", () => {
    const res = computeMastery(null, "بِسْمِ ٱللَّهِ");
    expect(res).toBe(100);
  });

  it("computes 0% mastery when toRevise is true", () => {
    const res = computeMastery({ toRevise: true }, "بِسْمِ ٱللَّهِ");
    expect(res).toBe(0);
  });

  it("computes correct mastery color based on score", () => {
    expect(masteryColor(0)).toBe("var(--border2)");
    expect(masteryColor(20)).toBe("var(--teal2)");
    expect(masteryColor(50)).toBe("var(--gold)");
    expect(masteryColor(90)).toBe("var(--green)");
  });

  it("computes displayed part mastery for a Page, Hizb, or Juz including cross-surah verses", () => {
    const crossHizbAyats = [
      { surahNumber: 1, numberInSurah: 1, text: "بِسْمِ ٱللَّهِ" },
      { surahNumber: 1, numberInSurah: 2, text: "ٱلْحَمْدُ لِلَّهِ" },
      { surahNumber: 2, numberInSurah: 1, text: "الم" },
      { surahNumber: 2, numberInSurah: 2, text: "ذَٰلِكَ ٱلْكِتَٰبُ" },
    ];
    const learnData = {
      "1:1": { learned: true },
      "1:2": { learned: true },
      "2:1": { learned: true },
      "2:2": { learned: false },
    };

    const stats = computeDisplayedPartMastery(crossHizbAyats, learnData, 1);
    expect(stats.totalCount).toBe(4);
    expect(stats.learnedCount).toBe(3);
    expect(stats.masteryPct).toBe(75);
    expect(stats.isFullyLearned).toBe(false);
  });

  it("returns 100% and isFullyLearned=true when all verses in displayed part are learned", () => {
    const pageAyats = [
      { numberInSurah: 1, text: "قُلْ هُوَ ٱللَّهُ أَحَدٌ" },
      { numberInSurah: 2, text: "ٱللَّهُ ٱلصَّمَدُ" },
    ];
    const learnData = {
      "112:1": { learned: true },
      "112:2": { learned: true },
    };

    const stats = computeDisplayedPartMastery(pageAyats, learnData, 112);
    expect(stats.masteryPct).toBe(100);
    expect(stats.learnedCount).toBe(2);
    expect(stats.totalCount).toBe(2);
    expect(stats.isFullyLearned).toBe(true);
  });

  it("handles empty or invalid verse lists safely", () => {
    const stats = computeDisplayedPartMastery([], {}, 1);
    expect(stats.totalCount).toBe(0);
    expect(stats.learnedCount).toBe(0);
    expect(stats.masteryPct).toBe(0);
    expect(stats.isFullyLearned).toBe(false);

    const nullStats = computeDisplayedPartMastery(null, null, 1);
    expect(nullStats.totalCount).toBe(0);
    expect(nullStats.masteryPct).toBe(0);
  });

  it("computes displayed part mastery with revise count and nested surah object", () => {
    const juzAyats = [
      { surah: { number: 67 }, numberInSurah: 1, text: "تَبَٰرَكَ ٱلَّذِى" },
      { surah: { number: 67 }, numberInSurah: 2, text: "ٱلَّذِى خَلَقَ" },
      { surah: { number: 67 }, numberInSurah: 3, text: "ٱلَّذِى خَلَقَ سَبْعَ" },
    ];
    const learnData = {
      "67:1": { learned: true },
      "67:2": { toRevise: true },
      "67:3": { learned: false },
    };

    const stats = computeDisplayedPartMastery(juzAyats, learnData, 67);
    expect(stats.totalCount).toBe(3);
    expect(stats.learnedCount).toBe(1);
    expect(stats.reviseCount).toBe(1);
    expect(stats.isFullyLearned).toBe(false);
  });
});
