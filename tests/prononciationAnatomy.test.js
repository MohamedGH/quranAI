import { describe, it, expect } from "vitest";
import React from "react";
import {
  GENERAL_MAKHAREJ,
  ANATOMICAL_ZONES,
  DETAILED_ARABIC_LETTERS,
  HEAVY_LETTERS_DATA,
  getLetterAnatomy,
  isHeavyLetter,
  isItbaqLetter,
} from "../src/utils/makharijData.js";
import { MakharijAnatomyDiagram } from "../src/components/common/MakharijAnatomyDiagram.jsx";
import { HeavyLettersGuide } from "../src/components/common/HeavyLettersGuide.jsx";
import { PrononciationPage } from "../src/components/pages/PrononciationPage.jsx";

describe("makharijData - Anatomical speech organs & Tajweed phonetics", () => {
  it("defines the 5 universal general Makharij (Al-Makharij al-'Ammah)", () => {
    expect(GENERAL_MAKHAREJ.JAWF).toBeDefined();
    expect(GENERAL_MAKHAREJ.HALQ).toBeDefined();
    expect(GENERAL_MAKHAREJ.LISAN).toBeDefined();
    expect(GENERAL_MAKHAREJ.SHAFATAYN).toBeDefined();
    expect(GENERAL_MAKHAREJ.KHAYSHUM).toBeDefined();

    expect(GENERAL_MAKHAREJ.JAWF.arabic).toBe("الجَوْف");
    expect(GENERAL_MAKHAREJ.HALQ.arabic).toBe("الحَلْق");
    expect(GENERAL_MAKHAREJ.LISAN.arabic).toBe("اللِّسَان");
    expect(GENERAL_MAKHAREJ.SHAFATAYN.arabic).toBe("الشَّفَتَان");
    expect(GENERAL_MAKHAREJ.KHAYSHUM.arabic).toBe("الخَيْشُوم");
  });

  it("covers all 15+ precise anatomical zones with coordinates for SVG rendering", () => {
    const zones = Object.values(ANATOMICAL_ZONES);
    expect(zones.length).toBeGreaterThanOrEqual(14);

    zones.forEach((zone) => {
      expect(zone.id).toBeTruthy();
      expect(zone.label).toBeTruthy();
      expect(zone.arabic).toBeTruthy();
      expect(zone.area).toBeTruthy();
      expect(typeof zone.cx).toBe("number");
      expect(typeof zone.cy).toBe("number");
      expect(Array.isArray(zone.letters)).toBe(true);
      expect(zone.letters.length).toBeGreaterThan(0);
    });
  });

  it("provides complete anatomical details for all 29 Arabic letters", () => {
    expect(DETAILED_ARABIC_LETTERS.length).toBe(29);

    DETAILED_ARABIC_LETTERS.forEach((item) => {
      expect(item.letter).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.trans).toBeTruthy();
      expect(item.makhrajGeneral).toBeTruthy();
      expect(["jawf", "halq", "lisan", "shafatayn", "khayshum"]).toContain(item.makhrajGeneral);
      expect(item.makhrajZone).toBeTruthy();
      expect(item.organTitle).toBeTruthy();
      expect(item.howToPronounce).toBeTruthy();
      expect(item.anatomicalTip).toBeTruthy();
      expect(Array.isArray(item.exampleWords)).toBe(true);
      expect(item.exampleWords.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("retrieves letter anatomy with getLetterAnatomy", () => {
    const ba = getLetterAnatomy("ب");
    expect(ba).toBeDefined();
    expect(ba.name).toBe("Ba");
    expect(ba.makhrajGeneral).toBe("shafatayn");

    const ayn = getLetterAnatomy("ع");
    expect(ayn).toBeDefined();
    expect(ayn.makhrajGeneral).toBe("halq");
    expect(ayn.organTitle).toContain("Épiglotte");

    const nonExistent = getLetterAnatomy("X");
    expect(nonExistent).toBeNull();
  });

  describe("Tafkhim & Heavy Letters (خُصَّ ضَغْطٍ قِظْ)", () => {
    it("defines the 7 letters of Istila' accurately in HEAVY_LETTERS_DATA", () => {
      const letters = HEAVY_LETTERS_DATA.letters.map((l) => l.letter);
      expect(letters).toHaveLength(7);
      expect(letters).toContain("خ");
      expect(letters).toContain("ص");
      expect(letters).toContain("ض");
      expect(letters).toContain("غ");
      expect(letters).toContain("ط");
      expect(letters).toContain("ق");
      expect(letters).toContain("ظ");

      expect(HEAVY_LETTERS_DATA.formula).toBe("خُصَّ ضَغْطٍ قِظْ");
      expect(HEAVY_LETTERS_DATA.formulaMnemonic).toContain("Khuṣṣa");
    });

    it("accurately identifies heavy letters with isHeavyLetter", () => {
      expect(isHeavyLetter("ط")).toBe(true);
      expect(isHeavyLetter("ض")).toBe(true);
      expect(isHeavyLetter("ص")).toBe(true);
      expect(isHeavyLetter("ظ")).toBe(true);
      expect(isHeavyLetter("ق")).toBe(true);
      expect(isHeavyLetter("غ")).toBe(true);
      expect(isHeavyLetter("خ")).toBe(true);

      // Thin letters must return false
      expect(isHeavyLetter("ت")).toBe(false);
      expect(isHeavyLetter("د")).toBe(false);
      expect(isHeavyLetter("س")).toBe(false);
      expect(isHeavyLetter("ك")).toBe(false);
      expect(isHeavyLetter("ب")).toBe(false);
      expect(isHeavyLetter(null)).toBe(false);
    });

    it("identifies the 4 supreme Itbaq letters (ط, ض, ص, ظ)", () => {
      expect(HEAVY_LETTERS_DATA.itbaqLetters).toEqual(["ط", "ض", "ص", "ظ"]);

      expect(isItbaqLetter("ط")).toBe(true);
      expect(isItbaqLetter("ض")).toBe(true);
      expect(isItbaqLetter("ص")).toBe(true);
      expect(isItbaqLetter("ظ")).toBe(true);

      expect(isItbaqLetter("ق")).toBe(false);
      expect(isItbaqLetter("خ")).toBe(false);
      expect(isItbaqLetter("غ")).toBe(false);
      expect(isItbaqLetter("ت")).toBe(false);
    });

    it("provides crucial contrast pairs between thin and heavy letters", () => {
      expect(HEAVY_LETTERS_DATA.contrastPairs.length).toBeGreaterThanOrEqual(5);

      const taPair = HEAVY_LETTERS_DATA.contrastPairs.find((p) => p.id === "ta_ta");
      expect(taPair).toBeDefined();
      expect(taPair.thin.letter).toBe("ت");
      expect(taPair.heavy.letter).toBe("ط");
      expect(taPair.thin.example).toContain("تَابَ");
      expect(taPair.heavy.example).toContain("طَابَ");

      const kafPair = HEAVY_LETTERS_DATA.contrastPairs.find((p) => p.id === "kaf_qaf");
      expect(kafPair).toBeDefined();
      expect(kafPair.thin.letter).toBe("ك");
      expect(kafPair.heavy.letter).toBe("ق");
      expect(kafPair.thin.example).toContain("كَلْب");
      expect(kafPair.heavy.example).toContain("قَلْب");
    });

    it("defines the 5 canonical degrees of Tafkhim according to Ibn al-Jazari", () => {
      expect(HEAVY_LETTERS_DATA.degrees).toHaveLength(5);
      expect(HEAVY_LETTERS_DATA.degrees[0].level).toBe(1);
      expect(HEAVY_LETTERS_DATA.degrees[0].condition).toContain("Fatḥa");
      expect(HEAVY_LETTERS_DATA.degrees[0].condition).toContain("Alif");
      expect(HEAVY_LETTERS_DATA.degrees[4].level).toBe(5);
      expect(HEAVY_LETTERS_DATA.degrees[4].condition).toContain("Kasra");
    });

    it("provides 4 practical physiological pronunciation steps", () => {
      expect(HEAVY_LETTERS_DATA.pronunciationSteps).toHaveLength(4);
      expect(HEAVY_LETTERS_DATA.pronunciationSteps[0].title).toContain("arrière de la langue");
      expect(HEAVY_LETTERS_DATA.pronunciationSteps[1].title).toContain("cuillère");
    });
  });

  describe("Child-adapted pedagogical explanations (Mode Enfant)", () => {
    it("provides child-friendly names and descriptions for all 5 general organs", () => {
      Object.values(GENERAL_MAKHAREJ).forEach((org) => {
        expect(org.childName).toBeTruthy();
        expect(org.childDescription).toBeTruthy();
      });

      expect(GENERAL_MAKHAREJ.JAWF.childName).toContain("Toboggan");
      expect(GENERAL_MAKHAREJ.HALQ.childName).toContain("Grotte");
      expect(GENERAL_MAKHAREJ.LISAN.childName).toContain("Langue Magicienne");
      expect(GENERAL_MAKHAREJ.SHAFATAYN.childName).toContain("Portes");
      expect(GENERAL_MAKHAREJ.KHAYSHUM.childName).toContain("Clochette");
    });

    it("provides child-friendly labels and descriptions for all anatomical zones", () => {
      Object.values(ANATOMICAL_ZONES).forEach((zone) => {
        expect(zone.childLabel).toBeTruthy();
        expect(zone.childDescription).toBeTruthy();
        expect(typeof zone.childLabel).toBe("string");
        expect(typeof zone.childDescription).toBe("string");
      });
    });

    it("equips every one of the 29 letters with kid-friendly childTip, childOrgan, and howToPronounceChild", () => {
      DETAILED_ARABIC_LETTERS.forEach((l) => {
        expect(l.childTip).toBeTruthy();
        expect(typeof l.childTip).toBe("string");
        expect(l.childOrgan).toBeTruthy();
        expect(typeof l.childOrgan).toBe("string");
        expect(l.howToPronounceChild).toBeTruthy();
        expect(typeof l.howToPronounceChild).toBe("string");
      });

      // Sample key letters
      const ba = DETAILED_ARABIC_LETTERS.find((x) => x.letter === "ب");
      expect(ba.childTip).toContain("bisou");

      const ha = DETAILED_ARABIC_LETTERS.find((x) => x.letter === "ح");
      expect(ha.childTip).toContain("buée");

      const kha = DETAILED_ARABIC_LETTERS.find((x) => x.letter === "خ");
      expect(kha.childTip).toContain("lion");

      const dad = DETAILED_ARABIC_LETTERS.find((x) => x.letter === "ض");
      expect(dad.childOrgan).toContain("couronne");
      expect(dad.childTip).toContain("magique");

      const ta = DETAILED_ARABIC_LETTERS.find((x) => x.letter === "ط");
      expect(ta.childTip).toContain("tambour");
    });

    it("provides child adaptations for Tafkhim formula, letters, steps, degrees, and contrast pairs", () => {
      expect(HEAVY_LETTERS_DATA.childFormulaTitle).toContain("Champions");
      expect(HEAVY_LETTERS_DATA.childDefinition).toContain("super-héros");

      HEAVY_LETTERS_DATA.letters.forEach((l) => {
        expect(l.childNickname).toBeTruthy();
        expect(l.childSoundTip).toBeTruthy();
      });

      HEAVY_LETTERS_DATA.pronunciationSteps.forEach((s) => {
        expect(s.childTitle).toBeTruthy();
        expect(s.childExplanation).toBeTruthy();
      });

      HEAVY_LETTERS_DATA.contrastPairs.forEach((p) => {
        expect(p.childTitle).toBeTruthy();
        expect(p.childLesson).toBeTruthy();
      });

      HEAVY_LETTERS_DATA.degrees.forEach((d) => {
        expect(d.childTitle).toBeTruthy();
        expect(d.childDesc).toBeTruthy();
      });
    });
  });
});

describe("Prononciation Visual Components", () => {
  it("exports MakharijAnatomyDiagram as a valid React component", () => {
    expect(typeof MakharijAnatomyDiagram).toBe("function");
  });

  it("exports HeavyLettersGuide as a valid React component", () => {
    expect(typeof HeavyLettersGuide).toBe("function");
  });

  it("exports PrononciationPage as a valid React component", () => {
    expect(typeof PrononciationPage).toBe("function");
  });
});
