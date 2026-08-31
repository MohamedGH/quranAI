import { describe, it, expect } from "vitest";
import {
  getVerseAudioUrl,
  formatAudioTime,
  TRANS_EDITIONS,
  TRANS_LABELS,
} from "../src/utils/quranCore.js";

describe("Audio and Translation Helper Functions", () => {
  describe("getVerseAudioUrl", () => {
    it("generates correctly padded EveryAyah URLs for surah and ayah", () => {
      const url1 = getVerseAudioUrl(1, 1);
      expect(url1).toBe("https://everyayah.com/data/ar.alafasy_128kbps/001001.mp3");

      const url2 = getVerseAudioUrl(2, 255, "ar.husary", "64");
      expect(url2).toBe("https://everyayah.com/data/ar.husary_64kbps/002255.mp3");

      const url3 = getVerseAudioUrl(114, 6);
      expect(url3).toBe("https://everyayah.com/data/ar.alafasy_128kbps/114006.mp3");
    });
  });

  describe("formatAudioTime", () => {
    it("formats seconds into mm:ss format", () => {
      expect(formatAudioTime(0)).toBe("0:00");
      expect(formatAudioTime(5)).toBe("0:05");
      expect(formatAudioTime(65)).toBe("1:05");
      expect(formatAudioTime(125)).toBe("2:05");
      expect(formatAudioTime(3600)).toBe("60:00");
    });

    it("handles invalid or negative seconds gracefully", () => {
      expect(formatAudioTime(-10)).toBe("0:00");
      expect(formatAudioTime(NaN)).toBe("0:00");
      expect(formatAudioTime(undefined)).toBe("0:00");
    });
  });

  describe("Translation Editions", () => {
    it("has supported translation languages defined", () => {
      expect(TRANS_EDITIONS.fr).toBe("fr.hamidullah");
      expect(TRANS_EDITIONS.en).toBe("en.sahih");
      expect(TRANS_EDITIONS.es).toBe("es.cortes");
      expect(TRANS_EDITIONS.de).toBe("de.bubenheim");
      expect(TRANS_EDITIONS.tr).toBe("tr.diyanet");
      expect(TRANS_EDITIONS.ur).toBe("ur.jalandhry");
      expect(TRANS_EDITIONS.id).toBe("id.indonesian");
      expect(TRANS_EDITIONS.ru).toBe("ru.kuliev");
    });

    it("has labels for each edition", () => {
      Object.keys(TRANS_EDITIONS).forEach((lang) => {
        expect(TRANS_LABELS[lang]).toBeDefined();
        expect(typeof TRANS_LABELS[lang]).toBe("string");
      });
    });
  });
});
