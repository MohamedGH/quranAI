import { describe, it, expect } from "vitest";
import {
  parseVoiceCommand,
  SURAH_NAMES,
  phonoCost,
  levenshteinChars,
  hasSolarLam,
  removeSolarLam,
  getSilentIndices,
  splitArabicClusters,
  computeMastery,
  calcPhase,
  calcDifficulty,
  ALL_Q_TYPES,
} from "../src/utils/quranExtended.js";

describe("Voice Command Parsing Engine", () => {
  it("parses playback control commands (play, pause, stop, next, prev)", () => {
    expect(parseVoiceCommand("play")).toEqual({ action: "play" });
    expect(parseVoiceCommand("lire")).toEqual({ action: "play" });
    expect(parseVoiceCommand("pause")).toEqual({ action: "pause" });
    expect(parseVoiceCommand("stopper")).toEqual({ action: "stop" });
    expect(parseVoiceCommand("verset suivant")).toEqual({ action: "next" });
    expect(parseVoiceCommand("précédent")).toEqual({ action: "prev" });
  });

  it("parses surah navigation commands by number and name", () => {
    expect(parseVoiceCommand("sourate 1")).toEqual({ action: "surah", number: 1 });
    expect(parseVoiceCommand("ouvre la sourate 18")).toEqual({ action: "surah", number: 18 });
    expect(parseVoiceCommand("va à la sourate fatiha")).toEqual({ action: "surah", number: 1 });
    expect(parseVoiceCommand("sourate al-baqara")).toEqual({ action: "surah", number: 2 });
    expect(parseVoiceCommand("sourate yasin")).toEqual({ action: "surah", number: 36 });
  });

  it("parses ayat navigation commands", () => {
    expect(parseVoiceCommand("verset 5")).toEqual({ action: "ayat", number: 5 });
    expect(parseVoiceCommand("va au verset 255")).toEqual({ action: "ayat", number: 255 });
  });

  it("parses loop and repetition commands", () => {
    expect(parseVoiceCommand("boucle versets 1 à 5")).toEqual({ action: "loop", from: 1, to: 5 });
    expect(parseVoiceCommand("répéter 3 fois")).toEqual({ action: "repeat", times: 3 });
    expect(parseVoiceCommand("arrêter la boucle")).toEqual({ action: "loop_off" });
  });

  it("returns null for unrecognized speech commands", () => {
    expect(parseVoiceCommand("bonjour tout le monde")).toBeNull();
  });
});

describe("Phonetic Distance & Solar/Lunar Lam Rules", () => {
  it("calculates articulation proximity costs for similar Arabic letters", () => {
    // Same letter = 0
    expect(phonoCost("س", "س")).toBe(0);
    // Emphatic pair س vs ص = 0.3 (near match)
    expect(phonoCost("س", "ص")).toBe(0.3);
    // Unrelated letters = 1
    expect(phonoCost("س", "م")).toBe(1);
  });

  it("performs phonetic-weighted Levenshtein character alignment", () => {
    const ref = ["س", "م", "ع"];
    const got = ["ص", "م", "ع"];
    const aligned = levenshteinChars(ref, got);
    expect(aligned[0].op).toBe("near"); // س and ص marked as near due to phonetics
    expect(aligned[1].op).toBe("match");
    expect(aligned[2].op).toBe("match");
  });

  it("detects and removes assimilated Solar Lam (ال الشمسية)", () => {
    expect(hasSolarLam("الشمس")).toBe(true);
    expect(hasSolarLam("القمر")).toBe(false);

    expect(removeSolarLam("الشمس")).toBe("شمس");
    expect(removeSolarLam("الرحمن")).toBe("رحمن");
  });
});

describe("Silent Letter & Cluster Detection", () => {
  it("splits words into accurate Arabic grapheme clusters (base + tashkeel)", () => {
    const clusters = splitArabicClusters("قُلْ");
    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toBe("قُ");
    expect(clusters[1]).toBe("لْ");
  });

  it("identifies silent alif al-fariqah at word endings", () => {
    const silent = getSilentIndices("قالوا", "قالُوا", 0);
    expect(silent.has(4)).toBe(true); // Trailing alif index
  });

  it("identifies silent Hamza wasl in connected speech (wordIndex > 0)", () => {
    const silent = getSilentIndices("الرحمن", "ٱلرَّحْمَٰنِ", 1);
    expect(silent.has(0)).toBe(true);
  });
});

describe("Mastery, Difficulty, & Learning Phase Calculation", () => {
  it("calculates ayat difficulty based on length, unique letters, and tajweed", () => {
    const easy = calcDifficulty("قُلْ هُوَ اللَّهُ أَحَدٌ");
    expect(easy.level).toBeLessThanOrEqual(2);

    const complex = calcDifficulty("يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا تَدَايَنتُم بِدَيْنٍ إِلَىٰ أَجَلٍ مُّسَمًّى فَاكْتُبُوهُ");
    expect(complex.level).toBeGreaterThanOrEqual(2);
  });

  it("determines user learning phase", () => {
    expect(calcPhase(null).label).toBe("NON COMMENCÉ");
    expect(calcPhase({ readCount: 3 }).label).toBe("EN LECTURE");
    expect(calcPhase({ parts: [{ learned: false }] }).label).toBe("EN DÉCOUPAGE");
    expect(calcPhase({ parts: [{ learned: true }] }).label).toBe("PARTIES MAÎTRISÉES");
    expect(calcPhase({ learned: true }).label).toBe("MAÎTRISÉ ✓");
  });

  it("computes mastery percentage based on revision markers", () => {
    const text = "الحمد لله رب العالمين";
    // Completely unrevised = 100% known
    expect(computeMastery({ toRevise: null }, text)).toBe(100);
    // Flagged entirely = 0% known
    expect(computeMastery({ toRevise: true }, text)).toBe(0);
  });

  it("includes all 15 question types in the quiz matrix", () => {
    expect(ALL_Q_TYPES).toHaveLength(15);
    expect(ALL_Q_TYPES).toContain("first_word");
    expect(ALL_Q_TYPES).toContain("reconstruct");
    expect(ALL_Q_TYPES).toContain("compare_verse");
    expect(ALL_Q_TYPES).toContain("page_structure");
    expect(ALL_Q_TYPES).toContain("revise_part");
  });
});
