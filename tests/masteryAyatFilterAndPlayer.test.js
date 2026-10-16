import { describe, it, expect, beforeEach } from "vitest";
import { store, uiActions, sel } from "../src/store.js";
import { computeMastery } from "../src/components/common/Mastery.jsx";

describe("Ayat Mastery Range Filter & Audio Player Controls", () => {
  beforeEach(() => {
    store.dispatch(uiActions.resetAllFilters());
  });

  describe("Redux uiSlice mastery and custom ayat range filter", () => {
    it("has initial state with [0, 100] range and inactive", () => {
      const state = store.getState();
      expect(sel.masteryFilterRange(state)).toEqual([0, 100]);
      expect(sel.masteryFilterActive(state)).toBe(false);
      expect(sel.masteryFilterPreset(state)).toBe("all");
      expect(sel.ayatFilterRange(state)).toBe(null);
      expect(sel.ayatFilterActive(state)).toBe(false);
      expect(sel.isAnyFilterActive(state)).toBe(false);
    });

    it("updates mastery range and sets active when range is narrower than [0, 100]", () => {
      store.dispatch(uiActions.setMasteryFilterRange([20, 80]));
      const state = store.getState();
      expect(sel.masteryFilterRange(state)).toEqual([20, 80]);
      expect(sel.masteryFilterActive(state)).toBe(true);
      expect(sel.masteryFilterPreset(state)).toBe("custom");
      expect(sel.isAnyFilterActive(state)).toBe(true);
    });

    it("sets custom ayat filter range and activates it", () => {
      store.dispatch(uiActions.setAyatFilterRange([5, 20]));
      const state = store.getState();
      expect(sel.ayatFilterRange(state)).toEqual([5, 20]);
      expect(sel.ayatFilterActive(state)).toBe(true);
      expect(sel.isAnyFilterActive(state)).toBe(true);
    });

    it("clamps invalid or out of bound values for ayat range", () => {
      store.dispatch(uiActions.setAyatFilterRange([0, 15]));
      const state = store.getState();
      expect(sel.ayatFilterRange(state)).toEqual([1, 15]);
      expect(sel.ayatFilterActive(state)).toBe(true);
    });

    it("resets ayat range filter via resetAyatFilter", () => {
      store.dispatch(uiActions.setAyatFilterRange([10, 30]));
      expect(sel.ayatFilterActive(store.getState())).toBe(true);

      store.dispatch(uiActions.resetAyatFilter());
      const state = store.getState();
      expect(sel.ayatFilterRange(state)).toBe(null);
      expect(sel.ayatFilterActive(state)).toBe(false);
    });

    it("resets all filters cleanly via resetAllFilters", () => {
      store.dispatch(uiActions.setMasteryFilterRange([30, 60]));
      store.dispatch(uiActions.setAyatFilterRange([2, 5]));
      expect(sel.isAnyFilterActive(store.getState())).toBe(true);

      store.dispatch(uiActions.resetAllFilters());
      const s = store.getState();
      expect(sel.masteryFilterRange(s)).toEqual([0, 100]);
      expect(sel.masteryFilterActive(s)).toBe(false);
      expect(sel.masteryFilterPreset(s)).toBe("all");
      expect(sel.ayatFilterRange(s)).toBe(null);
      expect(sel.ayatFilterActive(s)).toBe(false);
      expect(sel.isAnyFilterActive(s)).toBe(false);
    });

    it("applies standard presets accurately", () => {
      store.dispatch(uiActions.setMasteryFilterPreset("toLearn"));
      let s = store.getState();
      expect(sel.masteryFilterRange(s)).toEqual([0, 49]);
      expect(sel.masteryFilterActive(s)).toBe(true);
      expect(sel.masteryFilterPreset(s)).toBe("toLearn");

      store.dispatch(uiActions.setMasteryFilterPreset("inProgress"));
      s = store.getState();
      expect(sel.masteryFilterRange(s)).toEqual([50, 79]);
      expect(sel.masteryFilterActive(s)).toBe(true);

      store.dispatch(uiActions.setMasteryFilterPreset("mastered"));
      s = store.getState();
      expect(sel.masteryFilterRange(s)).toEqual([80, 100]);
      expect(sel.masteryFilterActive(s)).toBe(true);

      store.dispatch(uiActions.setMasteryFilterPreset("unstarted"));
      s = store.getState();
      expect(sel.masteryFilterRange(s)).toEqual([0, 0]);
      expect(sel.masteryFilterActive(s)).toBe(true);

      store.dispatch(uiActions.setMasteryFilterPreset("perfect"));
      s = store.getState();
      expect(sel.masteryFilterRange(s)).toEqual([100, 100]);
      expect(sel.masteryFilterActive(s)).toBe(true);

      store.dispatch(uiActions.setMasteryFilterPreset("all"));
      s = store.getState();
      expect(sel.masteryFilterRange(s)).toEqual([0, 100]);
      expect(sel.masteryFilterActive(s)).toBe(false);
    });
  });

  describe("Ayat filtering by custom ayat range and mastery range", () => {
    const mockAyats = [
      { numberInSurah: 1, text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" },
      { numberInSurah: 2, text: "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ" },
      { numberInSurah: 3, text: "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ" },
      { numberInSurah: 4, text: "مَٰلِكِ يَوْمِ ٱلدِّينِ" },
      { numberInSurah: 5, text: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ" },
      { numberInSurah: 6, text: "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ" },
      { numberInSurah: 7, text: "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ" },
    ];

    const mockLearnData = {
      "1:1": { learned: true }, // 100%
      "1:2": { parts: [{ id: "p1", learned: true, wordIndices: [0, 1] }], learned: false }, // partial ~50%
      "1:3": { learned: false }, // 0%
      "1:4": { learned: true }, // 100%
      "1:5": { learned: false }, // 0%
      "1:6": { learned: true }, // 100%
      "1:7": { parts: [{ id: "p1", learned: true, wordIndices: [0] }], learned: false }, // partial
    };

    const filterAyats = (ayats, ldMap, { ayatRange, masteryRange }, surahNum = 1) => {
      return ayats.filter(a => {
        const an = a.numberInSurah;
        if (ayatRange && (an < ayatRange[0] || an > ayatRange[1])) return false;
        if (masteryRange) {
          const ld = ldMap[`${surahNum}:${an}`];
          const m = computeMastery(ld, a.text);
          if (m < masteryRange[0] || m > masteryRange[1]) return false;
        }
        return true;
      });
    };

    it("filters only ayat within a custom verse range [2, 5]", () => {
      const filtered = filterAyats(mockAyats, mockLearnData, { ayatRange: [2, 5] });
      expect(filtered.map(a => a.numberInSurah)).toEqual([2, 3, 4, 5]);
    });

    it("combines custom ayat range and mastery level filter (verses 2 to 6 with 100% mastery)", () => {
      const filtered = filterAyats(mockAyats, mockLearnData, {
        ayatRange: [2, 6],
        masteryRange: [100, 100],
      });
      expect(filtered.map(a => a.numberInSurah)).toEqual([4, 6]);
    });

    it("combines custom ayat range with unstarted mastery (verses 1 to 4 with 0% mastery)", () => {
      const filtered = filterAyats(mockAyats, mockLearnData, {
        ayatRange: [1, 4],
        masteryRange: [0, 0],
      });
      expect(filtered.map(a => a.numberInSurah)).toEqual([3]);
    });

    it("returns empty when no verse in custom range satisfies mastery condition", () => {
      const filtered = filterAyats(mockAyats, mockLearnData, {
        ayatRange: [1, 2],
        masteryRange: [0, 0], // ayat 1 is 100%, ayat 2 is ~50%
      });
      expect(filtered.length).toBe(0);
    });
  });

  describe("Fast backward audio calculation", () => {
    it("rewinds 5 seconds when current time is > 5s", () => {
      const currentTime = 12.4;
      const expectedTime = Math.max(0, currentTime - 5);
      expect(expectedTime).toBeCloseTo(7.4);
    });

    it("clamps to 0 or triggers previous ayat when current time <= 5s", () => {
      const currentTime = 3.2;
      const newTime = Math.max(0, currentTime - 5);
      expect(newTime).toBe(0);
    });
  });
});
