import { describe, it, expect } from "vitest";
import {
  getArabicWordConjunction,
  cleanArabicWord,
  cleanTransToken,
  getPartArabicBoundaryWords,
  segmentAllPartsTranslations,
  computePartsSegmentation,
} from "../src/utils/translationUtils.js";

describe("Translation Segmentation Engine", () => {
  describe("Arabic conjunction extraction", () => {
    it("extracts waw conjunction from word", () => {
      const res = getArabicWordConjunction("وَالَّذِينَ");
      expect(res.hasConjunction).toBe(true);
      expect(res.type).toBe("waw");
      expect(res.baseWord).toBe("الذين");
    });

    it("extracts fa conjunction from word", () => {
      const res = getArabicWordConjunction("فَقَالَ");
      expect(res.hasConjunction).toBe(true);
      expect(res.type).toBe("fa");
      expect(res.baseWord).toBe("قال");
    });

    it("respects root waw words without falsely identifying conjunction", () => {
      const res = getArabicWordConjunction("وَعَدَ");
      expect(res.hasConjunction).toBe(false);
      expect(res.baseWord).toBe("وعد");
    });
  });

  describe("Token sanitation", () => {
    it("cleans Arabic words removing harakat and punctuation", () => {
      expect(cleanArabicWord("الرَّحْمَٰنِ")).toBe("الرحمان");
      expect(cleanArabicWord("بِسْمِ")).toBe("بسم");
    });

    it("cleans translation tokens", () => {
      expect(cleanTransToken("l'univers,")).toBe("univers");
      expect(cleanTransToken("«béni»")).toBe("beni");
      expect(cleanTransToken("God's")).toBe("gods");
    });
  });

  describe("Part boundary words extraction", () => {
    it("identifies first and last words of a part", () => {
      const arabicWords = ["الْحَمْدُ", "لِلَّهِ", "رَبِّ", "الْعَالَمِينَ"];
      const currentPart = { id: "p1", wordIndices: [0, 1, 2, 3], text: arabicWords.join(" ") };
      const boundaries = getPartArabicBoundaryWords({
        currentPart,
        arabicWords,
      });
      expect(boundaries.firstArWord).toBe("الْحَمْدُ");
      expect(boundaries.lastArWord).toBe("الْعَالَمِينَ");
    });
  });

  describe("Sequential part translations segmentation", () => {
    it("segments a multi-part ayah accurately", () => {
      const arabicWords = ["بِسْمِ", "اللَّهِ", "الرَّحْمَٰنِ", "الرَّحِيمِ"];
      const parts = [
        { id: "p1", wordIndices: [0, 1], text: "بِسْمِ اللَّهِ" },
        { id: "p2", wordIndices: [2, 3], text: "الرَّحْمَٰنِ الرَّحِيمِ" },
      ];
      const translation = "Au nom d'Allah, le Tout Miséricordieux, le Très Miséricordieux.";
      const segmented = segmentAllPartsTranslations({
        parts,
        ayatTranslation: translation,
        translationLang: "fr",
        arabicWords,
        totalWords: 4,
      });

      expect(segmented).toBeDefined();
      expect(segmented["p1"]).toBeDefined();
      expect(segmented["p2"]).toBeDefined();
      expect(segmented["p1"]).toContain("Allah");
      expect(segmented["p2"]).toContain("Miséricordieux");
    });

    it("handles fallback gracefully when translation is empty", () => {
      const parts = [{ id: "p1", wordIndices: [0, 1, 2, 3], text: "قُلْ هُوَ اللَّهُ أَحَدٌ" }];
      const segmented = segmentAllPartsTranslations({
        parts,
        ayatTranslation: "",
        translationLang: "fr",
        arabicWords: ["قُلْ", "هُوَ", "اللَّهُ", "أَحَدٌ"],
        totalWords: 4,
      });
      expect(segmented["p1"]).toBe("");
    });
  });

  describe("computePartsSegmentation & whole ayah segmentation", () => {
    it("handles single-part ayahs without data loss", () => {
      const arabicWords = ["إِيَّاكَ", "نَعْبُدُ", "وَإِيَّاكَ", "نَسْتَعِينُ"];
      const parts = [{ id: "p1", wordIndices: [0, 1, 2, 3], text: arabicWords.join(" ") }];
      const trans = "C'est Toi [Seul] que nous adorons, et c'est Toi [Seul] dont nous implorons secours.";
      const { segments } = computePartsSegmentation({
        parts,
        ayatTranslation: trans,
        translationLang: "fr",
        arabicWords,
        totalWords: 4,
      });
      expect(segments["p1"]).toBe(trans);
    });
  });
});
