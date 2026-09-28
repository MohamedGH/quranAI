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

  it("identifies Tafkhim (Graves) permanent letters (خص ضغط قظ)", async () => {
    const { isTafkhim, isTarqiq, getTajweedTone, TAFKHIM_LETTERS } = await import("../src/utils/tajweedRules.js");
    expect(TAFKHIM_LETTERS.size).toBe(7);
    ["خ", "ص", "ض", "غ", "ط", "ق", "ظ"].forEach((l) => {
      expect(TAFKHIM_LETTERS.has(l)).toBe(true);
      const arr = [l];
      expect(isTafkhim(arr, 0)).toBe(true);
      expect(isTarqiq(arr, 0)).toBe(false);
      expect(getTajweedTone(arr, 0)).toBe("tafkhim");
    });
  });

  it("identifies Tarqiq (Aiguës) letters correctly", async () => {
    const { isTafkhim, isTarqiq, getTajweedTone } = await import("../src/utils/tajweedRules.js");
    ["ب", "ت", "ث", "ج", "د", "ذ", "ز", "س", "ش", "ف", "ك", "ل", "م", "ن", "ه", "و", "ي"].forEach((l) => {
      const arr = [l];
      expect(isTafkhim(arr, 0)).toBe(false);
      expect(isTarqiq(arr, 0)).toBe(true);
      expect(getTajweedTone(arr, 0)).toBe("tarqiq");
    });
  });

  it("identifies Raa with Fatha/Damma as Tafkhim and Raa with Kasra as Tarqiq", async () => {
    const { isTafkhim, isTarqiq } = await import("../src/utils/tajweedRules.js");
    // Raa with Fatha (رَ)
    const raaFatha = ["ر", "\u064E"];
    expect(isTafkhim(raaFatha, 0)).toBe(true);
    expect(isTarqiq(raaFatha, 0)).toBe(false);

    // Raa with Kasra (رِ)
    const raaKasra = ["ر", "\u0650"];
    expect(isTafkhim(raaKasra, 0)).toBe(false);
    expect(isTarqiq(raaKasra, 0)).toBe(true);
  });

  it("handles Redux store showTajweedTone state and toggle action", async () => {
    const { store, uiActions, sel } = await import("../src/store.js");
    const initial = sel.showTajweedTone(store.getState());
    store.dispatch(uiActions.toggleTajweedTone());
    expect(sel.showTajweedTone(store.getState())).toBe(!initial);
    store.dispatch(uiActions.toggleTajweedTone());
    expect(sel.showTajweedTone(store.getState())).toBe(initial);
  });

  it("applies getTajweedStyleForChar correctly to words across all Tajweed rules in main text", async () => {
    const { getTajweedStyleForChar } = await import("../src/utils/tajweedRules.js");

    // 1. Qalqala on Sakin Dal (دْ)
    const qalqalaWord = ["ق", "َ", "د", "ْ"];
    const dalStyle = getTajweedStyleForChar(qalqalaWord, 2, { showQalqala: true });
    expect(dalStyle).not.toBeNull();
    expect(dalStyle.color).toBe("#38bdf8");

    // 2. Madd Lazim on Alif with Madd mark (~ or ٓ)
    const maddWord = ["ال", "ض", "َّ", "ا", "ٓ", "ل", "ّ", "ِ", "ي", "ن", "َ"];
    const maddStyle = getTajweedStyleForChar(maddWord, 3, { showMadd: true });
    expect(maddStyle).not.toBeNull();
    expect(maddStyle.color).toBeDefined();

    // 3. Tafkhim on Saad (ص)
    const tafkhimWord = ["ص", "ِ", "ر", "َ", "ٰ", "ط", "َ"];
    const saadStyle = getTajweedStyleForChar(tafkhimWord, 0, { showTajweedTone: true });
    expect(saadStyle).not.toBeNull();
    expect(saadStyle.color).toBe("#06b6d4");

    // 4. Returns null when rules are toggled off
    const disabledStyle = getTajweedStyleForChar(tafkhimWord, 0, { showTajweedTone: false });
    expect(disabledStyle).toBeNull();
  });

  it("supports customizable Tajweed color palettes and custom rule colors", async () => {
    const { TAJWEED_PALETTES, getActiveTajweedColors, getTajweedStyleForChar } = await import("../src/utils/tajweedRules.js");
    const { store, uiActions, sel } = await import("../src/store.js");

    // 1. Verify standard presets exist
    expect(TAJWEED_PALETTES.classic).toBeDefined();
    expect(TAJWEED_PALETTES.vibrant).toBeDefined();
    expect(TAJWEED_PALETTES.pastel).toBeDefined();
    expect(TAJWEED_PALETTES.gemstone).toBeDefined();
    expect(TAJWEED_PALETTES.golden).toBeDefined();

    // 2. Test getActiveTajweedColors
    const classicColors = getActiveTajweedColors("classic");
    expect(classicColors.qalqala).toBe("#38bdf8");

    const vibrantColors = getActiveTajweedColors("vibrant");
    expect(vibrantColors.qalqala).toBe("#00f0ff");

    // 3. Test overriding with custom colors
    const customMerged = getActiveTajweedColors("classic", { qalqala: "#ff007f" });
    expect(customMerged.qalqala).toBe("#ff007f");

    // 4. Test Redux store palette actions
    store.dispatch(uiActions.setTajweedPalette("vibrant"));
    expect(sel.tajweedPalette(store.getState())).toBe("vibrant");

    store.dispatch(uiActions.setTajweedCustomColor({ ruleId: "qalqala", color: "#123456" }));
    expect(sel.tajweedCustomColors(store.getState()).qalqala).toBe("#123456");

    // 5. Test getTajweedStyleForChar using custom colors
    const qalqalaWord = ["ق", "َ", "د", "ْ"];
    const styledWithCustom = getTajweedStyleForChar(qalqalaWord, 2, {
      showQalqala: true,
      customColors: { qalqala: "#123456" },
    });
    expect(styledWithCustom.color).toBe("#123456");

    // Reset back
    store.dispatch(uiActions.resetTajweedColors());
    expect(sel.tajweedPalette(store.getState())).toBe("classic");
    expect(sel.tajweedCustomColors(store.getState())).toEqual({});
  });
});
