import { describe, it, expect } from "vitest";
import {
  API,
  AUDIO_CDN_ROOT,
  RECITATORS,
  getReciterBitrate,
  setReciterBitrate,
  getAudioBase,
  setGlobalRecitator,
  getGlobalRecitator,
  fixChars,
  _stripBasmalaWords,
  parseTimestampsFile,
  stripBasmalaFromAyah,
} from "../src/utils/reciterAudio.js";

describe("Reciter & Audio Utilities", () => {
  it("exports correct base API and CDN URLs", () => {
    expect(API).toContain("api.alquran.cloud");
    expect(AUDIO_CDN_ROOT).toContain("cdn.islamic.network");
  });

  it("contains catalog of recitators", () => {
    expect(RECITATORS.length).toBeGreaterThan(5);
    expect(RECITATORS.some(r => r.id === "ar.alafasy")).toBe(true);
  });

  it("manages global recitator and audio base URL", () => {
    setGlobalRecitator("ar.alafasy");
    expect(getGlobalRecitator()).toBe("ar.alafasy");
    const base = getAudioBase();
    expect(base).toContain("ar.alafasy");
  });

  it("fixes degenerate timestamp characters", () => {
    const chars = [
      { char: "ب", start: 100, end: 100 },
      { char: "س", start: 150, end: 200 },
    ];
    const fixed = fixChars(chars);
    expect(fixed[0].end).toBe(150);
  });

  it("parses timestamps files properly", () => {
    const data = {
      surah: 1,
      ayat: 1,
      words: [
        { chars: [{ char: "ب" }, { char: "س" }, { char: "م" }] },
      ],
    };
    const parsed = parseTimestampsFile(data, 1, "test");
    expect(parsed["test:1:1"]).toBeDefined();
    expect(parsed["test:1:1"].words.length).toBe(1);
  });

  it("handles verse and surah caching with multi-tier storage", async () => {
    const { idbGetQuran, idbSetQuran } = await import("../src/utils/reciterAudio.js");
    const testAyats = { number: 1, ayahs: [{ numberInSurah: 1, text: "بِسْمِ اللَّهِ" }] };

    await idbSetQuran("alafasy:1", testAyats);
    const retrieved = await idbGetQuran("alafasy:1");

    expect(retrieved).not.toBeNull();
    expect(retrieved.number).toBe(1);
    expect(retrieved.ayahs[0].text).toBe("بِسْمِ اللَّهِ");
  });

  it("strips Bismillah from verse 1 across all editions and Mushaf pages", () => {
    expect(
      stripBasmalaFromAyah("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ", 2, 1)
    ).toBe("الٓمٓ");
    expect(
      stripBasmalaFromAyah("بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِیمِ قُلۡ هُوَ ٱللَّهُ أَحَدٌ", 112, 1)
    ).toBe("قُلۡ هُوَ ٱللَّهُ أَحَدٌ");
    // Keeps Surah 1 (Al-Fatiha) verse 1 intact
    expect(
      stripBasmalaFromAyah("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", 1, 1)
    ).toBe("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");
    // Strips 4 Basmala words from timestamps for Surah 2
    const tsWords = [
      { chars: [{ char: "بِ" }, { char: "سْ" }, { char: "مِ" }] },
      { chars: [{ char: "ٱ" }, { char: "ل" }, { char: "لَّ" }, { char: "هِ" }] },
      { chars: [{ char: "ٱ" }, { char: "ل" }, { char: "رَّ" }, { char: "حْ" }] },
      { chars: [{ char: "ٱ" }, { char: "ل" }, { char: "رَّ" }, { char: "حِ" }] },
      { chars: [{ char: "ا" }, { char: "لٓ" }, { char: "مٓ" }] },
    ];
    expect(_stripBasmalaWords(tsWords, 2)).toHaveLength(1);
  });
});
