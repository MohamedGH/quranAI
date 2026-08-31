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
});
