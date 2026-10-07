import { describe, it, expect } from "vitest";
import {
  TOTAL_QURAN_VERSES,
  TOTAL_SURAHS,
  TOTAL_HIZBS,
  TOTAL_JUZS,
  TOTAL_PAGES,
  getGlobalVerseNumber,
  getSurahMeta,
  isValidVerse,
  getNextVerseCoordinates,
  getPreviousVerseCoordinates,
  getJuzForHizb,
  getHizbsForJuz,
  getNavigationBounds,
} from "../src/utils/quranDomain.js";

describe("Quran Domain Core Model", () => {
  it("verifies canonical Quran constants", () => {
    expect(TOTAL_QURAN_VERSES).toBe(6236);
    expect(TOTAL_SURAHS).toBe(114);
    expect(TOTAL_HIZBS).toBe(60);
    expect(TOTAL_JUZS).toBe(30);
    expect(TOTAL_PAGES).toBe(604);
  });

  describe("Global verse index calculation", () => {
    it("returns 1 for Al-Fatiha verse 1", () => {
      expect(getGlobalVerseNumber(1, 1)).toBe(1);
    });

    it("returns 7 for Al-Fatiha verse 7", () => {
      expect(getGlobalVerseNumber(1, 7)).toBe(7);
    });

    it("returns 8 for Al-Baqarah verse 1", () => {
      expect(getGlobalVerseNumber(2, 1)).toBe(8);
    });

    it("returns 6236 for An-Nas verse 6", () => {
      expect(getGlobalVerseNumber(114, 6)).toBe(6236);
    });

    it("returns null for invalid inputs", () => {
      expect(getGlobalVerseNumber(115, 1)).toBeNull();
      expect(getGlobalVerseNumber(0, 1)).toBeNull();
      expect(getGlobalVerseNumber(1, 0)).toBeNull();
    });
  });

  describe("Verse validation and navigation boundaries", () => {
    it("validates legitimate verses", () => {
      expect(isValidVerse(1, 1)).toBe(true);
      expect(isValidVerse(1, 7)).toBe(true);
      expect(isValidVerse(1, 8)).toBe(false);
      expect(isValidVerse(2, 286)).toBe(true);
      expect(isValidVerse(2, 287)).toBe(false);
    });

    it("computes next verse with cross-surah transition", () => {
      // Intra-surah
      expect(getNextVerseCoordinates(1, 6)).toEqual({
        surahNum: 1,
        numberInSurah: 7,
        isNewSurah: false,
      });

      // Cross-surah at boundary
      expect(getNextVerseCoordinates(1, 7)).toEqual({
        surahNum: 2,
        numberInSurah: 1,
        isNewSurah: true,
      });

      // End of Quran
      expect(getNextVerseCoordinates(114, 6)).toBeNull();
    });

    it("computes previous verse with cross-surah transition", () => {
      // Intra-surah
      expect(getPreviousVerseCoordinates(1, 7)).toEqual({
        surahNum: 1,
        numberInSurah: 6,
        isNewSurah: false,
      });

      // Cross-surah at boundary
      expect(getPreviousVerseCoordinates(2, 1)).toEqual({
        surahNum: 1,
        numberInSurah: 7,
        isNewSurah: true,
      });

      // Beginning of Quran
      expect(getPreviousVerseCoordinates(1, 1)).toBeNull();
    });
  });

  describe("Juz and Hizb mapping", () => {
    it("maps Hizb to Juz accurately", () => {
      expect(getJuzForHizb(1)).toBe(1);
      expect(getJuzForHizb(2)).toBe(1);
      expect(getJuzForHizb(3)).toBe(2);
      expect(getJuzForHizb(4)).toBe(2);
      expect(getJuzForHizb(59)).toBe(30);
      expect(getJuzForHizb(60)).toBe(30);
    });

    it("maps Juz to its 2 Hizbs accurately", () => {
      expect(getHizbsForJuz(1)).toEqual([1, 2]);
      expect(getHizbsForJuz(30)).toEqual([59, 60]);
    });
  });

  describe("Navigation bounds lookup", () => {
    it("returns correct bounds for Juz, Hizb, Page, and Surah modes", () => {
      expect(getNavigationBounds("juz", 5)).toEqual({
        mode: "juz",
        index: 5,
        hizbs: [9, 10],
        total: 30,
      });
      expect(getNavigationBounds("hizb", 12)).toEqual({
        mode: "hizb",
        index: 12,
        juz: 6,
        total: 60,
      });
      expect(getNavigationBounds("page", 45)).toEqual({
        mode: "page",
        index: 45,
        total: 604,
      });
      expect(getNavigationBounds("surah", 1)).toEqual({
        mode: "surah",
        index: 1,
        count: 7,
        total: 114,
      });
    });
  });
});
