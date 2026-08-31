import { describe, it, expect } from "vitest";
import {
  detectTajweedRule,
  QALQALAH_LETTERS,
  IKHFA_LETTERS,
  IDGHAM_GHUNNAH_LETTERS,
  IDGHAM_NO_GHUNNAH_LETTERS,
  IQLAB_LETTERS,
  TAJWEED_COLORS,
} from "../src/utils/quranCore.js";

describe("Tajweed Rule Detection Engine", () => {
  it("contains all correct Qalqalah letters (ق, ط, ب, ج, د)", () => {
    expect(QALQALAH_LETTERS.size).toBe(5);
    ["ق", "ط", "ب", "ج", "د"].forEach((l) => {
      expect(QALQALAH_LETTERS.has(l)).toBe(true);
    });
  });

  it("identifies Qalqalah on Sakin Qutb Jad letters", () => {
    const ruleQaf = detectTajweedRule("ق", null, null, true, false);
    expect(ruleQaf).not.toBeNull();
    expect(ruleQaf.rule).toBe("qalqalah");
    expect(ruleQaf.color).toBe(TAJWEED_COLORS.qalqalah);

    const ruleDal = detectTajweedRule("د", null, null, true, false);
    expect(ruleDal.rule).toBe("qalqalah");

    // Non-sakin letter should not trigger Qalqalah
    const activeQaf = detectTajweedRule("ق", null, null, false, false);
    expect(activeQaf).toBeNull();
  });

  it("identifies Iqlab (Nun Sakinah or Tanween followed by Ba)", () => {
    const iqlabRes = detectTajweedRule("ن", "ب", null, true, false);
    expect(iqlabRes).not.toBeNull();
    expect(iqlabRes.rule).toBe("iqlab");
    expect(iqlabRes.color).toBe(TAJWEED_COLORS.iqlab);

    const tanweenIqlab = detectTajweedRule("م", "ب", "tanween", false, false);
    expect(tanweenIqlab.rule).toBe("iqlab");
  });

  it("identifies Idgham with Ghunnah (followed by ي, ن, م, و)", () => {
    ["ي", "ن", "م", "و"].forEach((next) => {
      const res = detectTajweedRule("ن", next, null, true, false);
      expect(res).not.toBeNull();
      expect(res.rule).toBe("idgham_ghunnah");
      expect(res.color).toBe(TAJWEED_COLORS.ghunnah);
    });
  });

  it("identifies Idgham without Ghunnah (followed by ل, ر)", () => {
    ["ل", "ر"].forEach((next) => {
      const res = detectTajweedRule("ن", next, null, true, false);
      expect(res).not.toBeNull();
      expect(res.rule).toBe("idgham_no_ghunnah");
      expect(res.color).toBe(TAJWEED_COLORS.idgham_no_ghunnah);
    });
  });

  it("identifies Ikhfa (followed by any of the 15 Ikhfa letters)", () => {
    ["ت", "ث", "ج", "د", "ذ", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ف", "ق", "ك"].forEach((next) => {
      const res = detectTajweedRule("ن", next, null, true, false);
      expect(res).not.toBeNull();
      expect(res.rule).toBe("ikhfa");
      expect(res.color).toBe(TAJWEED_COLORS.ikhfa);
    });
  });

  it("identifies Ghunnah Mushaddadah on Noon and Meem with Shaddah", () => {
    const noonShaddah = detectTajweedRule("ن", null, null, false, true);
    expect(noonShaddah).not.toBeNull();
    expect(noonShaddah.rule).toBe("ghunnah");

    const meemShaddah = detectTajweedRule("م", null, null, false, true);
    expect(meemShaddah).not.toBeNull();
    expect(meemShaddah.rule).toBe("ghunnah");
  });

  it("identifies Madd rules", () => {
    const madd = detectTajweedRule("ا", null, "madd", false, false);
    expect(madd).not.toBeNull();
    expect(madd.rule).toBe("madd_lazim");
  });
});
