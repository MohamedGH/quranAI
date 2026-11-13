// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { store, uiActions } from "../src/store.js";
import { ARABIC_LETTERS } from "../src/utils/arabicUtils.js";
import {
  SHAMSIYYAH_LETTERS,
  NON_CONNECTING_LEFT_LETTERS,
  MUQATTAAT_INFO,
  LETTER_ENCYCLOPEDIA_MAP,
  getAccurateContextualForms,
  getLetterSifat,
  getLetterQuranRules,
  getCompleteLetterProfile,
} from "../src/utils/arabicLetterEncyclopedia.js";
import { PrononciationPage } from "../src/components/pages/PrononciationPage.jsx";

describe("arabicLetterEncyclopedia - Complete Pure Functional Letter Encyclopedia", () => {
  it("provides a complete profile for every one of the 29 Arabic letters with unique alphabetOrder 1..29", () => {
    expect(ARABIC_LETTERS).toHaveLength(29);
    const seenOrders = new Set();

    ARABIC_LETTERS.forEach((item) => {
      const profile = getCompleteLetterProfile(item.letter);
      expect(profile).not.toBeNull();
      expect(profile.letter).toBe(item.letter);
      expect(profile.name).toBe(item.name);
      expect(profile.arabicName).toBeTruthy();
      expect(profile.trans).toBe(item.trans);
      expect(profile.alphabetOrder).toBeGreaterThanOrEqual(1);
      expect(profile.alphabetOrder).toBeLessThanOrEqual(29);
      expect(seenOrders.has(profile.alphabetOrder)).toBe(false);
      seenOrders.add(profile.alphabetOrder);

      expect(profile.abjadValue).toBeGreaterThan(0);
      expect(profile.unicodeHex).toMatch(/^U\+06[0-9A-F]{2}$/);
      expect(profile.dots).toBeTruthy();

      expect(profile.forms).toBeDefined();
      expect(profile.forms.isolated).toBeTruthy();
      expect(profile.forms.initial).toBeTruthy();
      expect(profile.forms.medial).toBeTruthy();
      expect(profile.forms.final).toBeTruthy();

      expect(profile.anatomy).toBeTruthy();
      expect(profile.posture).toBeTruthy();
      expect(profile.sifat).toBeTruthy();
      expect(profile.quranRules).toBeTruthy();

      expect(profile.writingSteps).toBeTruthy();
      expect(profile.childWritingTip).toBeTruthy();
      expect(Array.isArray(profile.confusionPairs)).toBe(true);
      expect(profile.confusionPairs.length).toBeGreaterThanOrEqual(1);
      expect(profile.commonMistake).toBeTruthy();
      expect(profile.childMistakeTip).toBeTruthy();
      expect(profile.quranFact).toBeTruthy();
      expect(profile.childFact).toBeTruthy();

      expect(profile.maddaForms).toHaveLength(3);
      expect(profile.advancedHarakatForms).toHaveLength(4);
    });

    expect(seenOrders.size).toBe(29);
    expect(Object.keys(LETTER_ENCYCLOPEDIA_MAP)).toHaveLength(29);
  });

  it("returns null safely for empty or unknown characters", () => {
    expect(getCompleteLetterProfile(null)).toBeNull();
    expect(getCompleteLetterProfile("")).toBeNull();
    expect(getCompleteLetterProfile("Z")).toBeNull();
  });

  describe("getAccurateContextualForms", () => {
    it("accurately prevents left-attachment for the 7 non-left-connecting letters", () => {
      const nonConn = ["ا", "أ", "د", "ذ", "ر", "ز", "و"];
      expect(NON_CONNECTING_LEFT_LETTERS.size).toBe(7);

      nonConn.forEach((ltr) => {
        const forms = getAccurateContextualForms(ltr);
        expect(forms.connectsLeft).toBe(false);
        expect(forms.isolated).toBe(ltr);
        expect(forms.initial).toBe(ltr);
        expect(forms.medial).toBe(`ـ${ltr}`);
        expect(forms.final).toBe(`ـ${ltr}`);
        expect(forms.connectivityLabel).toContain("Ne se lie jamais");
        expect(forms.childConnectivityLabel).toContain("Ne donne pas la main");
      });
    });

    it("supports bidirectional attachment for all 22 remaining connecting letters", () => {
      ARABIC_LETTERS.filter((l) => !NON_CONNECTING_LEFT_LETTERS.has(l.letter)).forEach((l) => {
        const forms = getAccurateContextualForms(l.letter, l);
        expect(forms.connectsLeft).toBe(true);
        expect(forms.initial).toBe(`${l.letter}ـ`);
        expect(forms.medial).toBe(`ـ${l.letter}ـ`);
        expect(forms.final).toBe(`ـ${l.letter}`);
        expect(forms.connectivityLabel).toContain("2 côtés");
      });
    });
  });

  describe("getLetterSifat", () => {
    it("computes the 5 paired Sifat and Qalqalah for ط", () => {
      const s = getLetterSifat("ط");
      expect(s.airflow.name).toContain("Jahr");
      expect(s.duration.name).toContain("Shiddah");
      expect(s.elevation.name).toContain("Isti'lâ'");
      expect(s.adhesion.name).toContain("Itbâq");
      expect(s.fluency.name).toContain("Iṣmât");
      expect(s.unique.some((u) => u.name.includes("Qalqalah"))).toBe(true);
    });

    it("identifies Istitalah exclusively for ض", () => {
      const dad = getLetterSifat("ض");
      expect(dad.elevation.isHeavy).toBe(true);
      expect(dad.adhesion.isItbaq).toBe(true);
      expect(dad.unique.some((u) => u.name.includes("Istiṭâlah"))).toBe(true);

      const sad = getLetterSifat("ص");
      expect(sad.unique.some((u) => u.name.includes("Istiṭâlah"))).toBe(false);
    });

    it("identifies Tafash-shi exclusively for ش", () => {
      const shin = getLetterSifat("ش");
      expect(shin.airflow.name).toContain("Hams");
      expect(shin.duration.name).toContain("Rakhâwah");
      expect(shin.elevation.isHeavy).toBe(false);
      expect(shin.unique.some((u) => u.name.includes("Tafash-shî"))).toBe(true);
    });

    it("identifies Safir (ص/ز/س), Lin (و/ي), Ghunnah (ن/م), Inhiraf (ل/ر), and Takrir (ر)", () => {
      ["ص", "ز", "س"].forEach((ltr) => {
        expect(getLetterSifat(ltr).unique.some((u) => u.name.includes("Ṣafîr"))).toBe(true);
      });
      ["و", "ي"].forEach((ltr) => {
        expect(getLetterSifat(ltr).unique.some((u) => u.name.includes("Lîn"))).toBe(true);
      });
      ["ن", "م"].forEach((ltr) => {
        expect(getLetterSifat(ltr).unique.some((u) => u.name.includes("Ghunnah"))).toBe(true);
      });
      expect(getLetterSifat("ل").unique.some((u) => u.name.includes("Inḥirâf"))).toBe(true);
      expect(getLetterSifat("ل").elevation.isHeavy).toBe("conditional");

      const ra = getLetterSifat("ر");
      expect(ra.unique.some((u) => u.name.includes("Inḥirâf"))).toBe(true);
      expect(ra.unique.some((u) => u.name.includes("Takrîr"))).toBe(true);
      expect(ra.elevation.isHeavy).toBe("conditional");
    });
  });

  describe("getLetterQuranRules", () => {
    it("partitions the 29 letters into 14 Solar (Shamsiyyah) and 15 Lunar (Qamariyyah)", () => {
      expect(SHAMSIYYAH_LETTERS.size).toBe(14);
      let solarCount = 0;
      let lunarCount = 0;
      ARABIC_LETTERS.forEach((l) => {
        const rules = getLetterQuranRules(l.letter, LETTER_ENCYCLOPEDIA_MAP[l.letter]);
        if (rules.solarLunar.isSolar) {
          solarCount += 1;
          expect(rules.solarLunar.type).toContain("Solaire");
        } else {
          lunarCount += 1;
          expect(rules.solarLunar.type).toContain("Lunaire");
        }
        expect(rules.solarLunar.example).toBeTruthy();
      });
      expect(solarCount).toBe(14);
      expect(lunarCount).toBe(15);
    });

    it("assigns correct Nun Sakin rules (Izhar, Idgham w/ & w/o Ghunnah, Iqlab, Ikhfa)", () => {
      ["أ", "ه", "ع", "ح", "غ", "خ"].forEach((ltr) => {
        expect(getLetterQuranRules(ltr).nunSakinRule.rule).toContain("Iẓhâr Ḥalqî");
      });
      ["ي", "ن", "م", "و"].forEach((ltr) => {
        expect(getLetterQuranRules(ltr).nunSakinRule.rule).toContain("Idghâm avec Ghunnah");
      });
      ["ل", "ر"].forEach((ltr) => {
        expect(getLetterQuranRules(ltr).nunSakinRule.rule).toContain("Idghâm sans Ghunnah");
      });
      expect(getLetterQuranRules("ب").nunSakinRule.rule).toContain("Iqlâb");
      ["ت", "ث", "ج", "د", "ذ", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ف", "ق", "ك"].forEach((ltr) => {
        expect(getLetterQuranRules(ltr).nunSakinRule.rule).toContain("Ikhfâ'");
      });
      expect(getLetterQuranRules("ا").nunSakinRule.rule).toContain("Prolongation");
    });

    it("assigns correct Mim Sakin rules (Idgham Shafawi, Ikhfa Shafawi, Izhar Strict/Normal)", () => {
      expect(getLetterQuranRules("م").mimSakinRule.rule).toContain("Idghâm Shafawî");
      expect(getLetterQuranRules("ب").mimSakinRule.rule).toContain("Ikhfâ' Shafawî");
      expect(getLetterQuranRules("و").mimSakinRule.rule).toContain("Iẓhâr Shafawî Strict");
      expect(getLetterQuranRules("ف").mimSakinRule.rule).toContain("Iẓhâr Shafawî Strict");
      expect(getLetterQuranRules("س").mimSakinRule.rule).toBe("Iẓhâr Shafawî (إِظْهَار شَفَوِي)");
    });

    it("identifies the exact 14 Muqatta'at Quranic opening letters", () => {
      const muqKeys = Object.keys(MUQATTAAT_INFO);
      expect(muqKeys).toHaveLength(14);
      ["ا", "ل", "م", "ص", "ر", "ك", "ه", "ي", "ع", "ط", "س", "ح", "ق", "ن"].forEach((ltr) => {
        const info = getLetterQuranRules(ltr).muqattaat;
        expect(info).not.toBeNull();
        expect(info.combinations.length).toBeGreaterThanOrEqual(1);
        expect(info.surahsCount).toBeGreaterThanOrEqual(1);
      });

      ["ب", "ت", "ف", "ض", "أ"].forEach((ltr) => {
        expect(getLetterQuranRules(ltr).muqattaat).toBeNull();
      });
    });
  });
});

describe("PrononciationPage Encyclopedic UI Integration", () => {
  beforeEach(() => {
    store.dispatch(uiActions.setUxMode("standard"));
    store.dispatch(uiActions.resetValidatedLetters());
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = () =>
    render(
      React.createElement(
        Provider,
        { store },
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/prononciation"] },
          React.createElement(PrononciationPage)
        )
      )
    );

  it("renders all encyclopedic sections in standard mode (identity meta, anatomy, Tajweed Sifat, Madd/Chadda/Tanwin, writing & pitfalls)", () => {
    renderPage();

    expect(document.getElementById("letter-encyclopedia-panel")).toBeTruthy();

    const identityMeta = document.getElementById("letter-identity-meta");
    expect(identityMeta).toBeTruthy();
    expect(identityMeta.textContent).toContain("N° 2/29"); // Ba is default index 0
    expect(identityMeta.textContent).toContain("Abjad : 2");
    expect(identityMeta.textContent).toContain("U+0628");

    expect(document.getElementById("letter-detail-section-tabs")).toBeTruthy();
    expect(document.getElementById("letter-tajweed-encyclopedia")).toBeTruthy();
    expect(document.getElementById("letter-sounds-encyclopedia")).toBeTruthy();
    expect(document.getElementById("letter-writing-pitfalls")).toBeTruthy();

    expect(screen.getByText(/Madd Alif/i)).toBeTruthy();
    expect(screen.getByText(/CHADDA & TANWÎN/i)).toBeTruthy();
    expect(screen.getByText(/ERREUR FRÉQUENTE À CORRIGER/i)).toBeTruthy();
    expect(screen.getByText(/REPÈRE DANS LE SAINT CORAN/i)).toBeTruthy();
  });

  it("filters encyclopedic detail sections via #letter-detail-section-tabs buttons", () => {
    renderPage();

    const tabsContainer = document.getElementById("letter-detail-section-tabs");
    const buttons = tabsContainer.querySelectorAll("button");
    expect(buttons).toHaveLength(5);

    // Click "Tajweed & Sifât"
    fireEvent.click(buttons[2]);
    expect(document.getElementById("letter-tajweed-encyclopedia")).toBeTruthy();
    expect(document.getElementById("letter-sounds-encyclopedia")).toBeNull();
    expect(document.getElementById("letter-writing-pitfalls")).toBeNull();

    // Click "Tracé & Pièges"
    fireEvent.click(buttons[4]);
    expect(document.getElementById("letter-writing-pitfalls")).toBeTruthy();
    expect(document.getElementById("letter-tajweed-encyclopedia")).toBeNull();

    // Click "Tout voir"
    fireEvent.click(buttons[0]);
    expect(document.getElementById("letter-tajweed-encyclopedia")).toBeTruthy();
    expect(document.getElementById("letter-sounds-encyclopedia")).toBeTruthy();
    expect(document.getElementById("letter-writing-pitfalls")).toBeTruthy();
  });

  it("updates complete encyclopedic profile when clicking heavy Muqatta'at letter ص and non-left-connecting letter د", () => {
    const { container } = renderPage();

    const cards = Array.from(container.querySelectorAll(".pronon-card"));
    const sadCard = cards.find((c) => c.querySelector(".pronon-letter")?.textContent === "ص");
    expect(sadCard).toBeTruthy();
    fireEvent.click(sadCard);

    expect(document.getElementById("letter-identity-meta").textContent).toContain("N° 14/29");
    expect(document.getElementById("letter-identity-meta").textContent).toContain("Abjad : 90");
    expect(document.getElementById("letter-tajweed-encyclopedia").textContent).toContain("LETTRE LUMINEUSE");
    expect(document.getElementById("letter-tajweed-encyclopedia").textContent).toContain("Ṣafîr");
    expect(container.querySelector("svg.makharij-svg").getAttribute("data-tafkhim")).toBe("true");
    expect(container.querySelector("svg.makharij-svg").getAttribute("data-itbaq")).toBe("true");

    // Click non-left-connecting letter د
    const dalCard = cards.find((c) => c.querySelector(".pronon-letter")?.textContent === "د");
    fireEvent.click(dalCard);
    expect(document.getElementById("letter-identity-meta").textContent).toContain("Ne se lie jamais à gauche");
    expect(document.getElementById("letter-encyclopedia-panel").textContent).toContain("NE S'ATTACHE PAS À GAUCHE");
  });

  it("adapts encyclopedia cards and hides technical Abjad/Unicode metadata in Child Mode", () => {
    store.dispatch(uiActions.setUxMode("child"));
    renderPage();

    const identityMeta = document.getElementById("letter-identity-meta");
    expect(identityMeta.textContent).not.toContain("Abjad :");
    expect(identityMeta.textContent).not.toContain("U+0628");
    expect(identityMeta.textContent).toContain("Donne la main à droite et à gauche !");

    expect(screen.getByText(/ASTUCE MAGIQUE DU PETIT CHAMPION/i)).toBeTruthy();
    expect(screen.getByText(/SUPER-POUVOIRS & RÈGLES MAGIQUES/i)).toBeTruthy();
    expect(screen.getByText(/ASTUCE DE DESSIN MAGIQUE/i)).toBeTruthy();
    expect(screen.getByText(/LE SAVIEZ-VOUS/i)).toBeTruthy();
  });
});
