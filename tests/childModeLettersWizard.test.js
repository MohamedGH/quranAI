import { describe, it, expect, beforeEach } from "vitest";
import { store, sel, uiActions } from "../src/store.js";
import { getNavigationTabs, getUxWizardConfig, UX_MODES } from "../src/utils/uxProfileManager.js";
import { ARABIC_LETTERS } from "../src/utils/arabicUtils.js";

describe("Child Mode Wizard & Letter Validation to Unlock Quran Menu", () => {
  beforeEach(() => {
    store.dispatch(uiActions.setUxMode("child"));
    store.dispatch(uiActions.resetValidatedLetters());
    store.dispatch(uiActions.setChildWizardSeen(false));
    store.dispatch(uiActions.setShowChildCelebrationModal(false));
  });

  describe("getUxWizardConfig for Child Mode", () => {
    it("configures child wizard specifically to direct towards Arabic letters", () => {
      const config = getUxWizardConfig("child");
      expect(config.mode).toBe("child");
      expect(config.title).toContain("explorateur");
      expect(config.subtitle).toContain("28 lettres");

      // Verify step contents
      expect(config.steps).toHaveLength(4);

      const step1 = config.steps[0];
      expect(step1.title).toContain("Lettres Arabes");
      expect(step1.body).toContain("28 lettres");

      const step2 = config.steps[1];
      expect(step2.title).toContain("Écoute");
      expect(step2.body).toContain("LETTRES");

      const step3 = config.steps[2];
      expect(step3.title).toContain("Menu Coran Débloqué");
      expect(step3.body).toContain("menu LECTURE DU CORAN");

      const step4 = config.steps[3];
      expect(step4.title).toContain("En Route");
      expect(step4.body).toContain("LETTRES");
      expect(step4.keyAction).toContain("ALLER AUX LETTRES");
    });
  });

  describe("Navigation Tabs - Quran Menu Hidden Until All Letters Validated", () => {
    it("hides Quran menu tab in Child mode when letters are NOT validated", () => {
      const isQuranUnlocked = false;
      const tabs = getNavigationTabs("child", isQuranUnlocked);
      expect(tabs).toHaveLength(2);

      const ids = tabs.map((t) => t.id);
      expect(ids).not.toContain("quran");
      expect(ids).toContain("prononciation");
      expect(ids).toContain("revision");

      const lettersTab = tabs.find((t) => t.id === "prononciation");
      expect(lettersTab.label).toBe("LETTRES");
    });

    it("makes Quran menu tab appear in Child mode once all letters are validated", () => {
      const isQuranUnlocked = true;
      const tabs = getNavigationTabs("child", isQuranUnlocked);
      expect(tabs).toHaveLength(3);

      const ids = tabs.map((t) => t.id);
      expect(ids).toContain("quran");
      expect(ids).toContain("prononciation");
      expect(ids).toContain("revision");

      const quranTab = tabs.find((t) => t.id === "quran");
      expect(quranTab.label).toBe("LECTURE");
    });

    it("keeps Quran tab visible in other UX modes (beginner, standard, expert)", () => {
      ["beginner", "standard", "expert"].forEach((mode) => {
        const tabsUnlocked = getNavigationTabs(mode, true);
        const tabsLocked = getNavigationTabs(mode, false);
        expect(tabsUnlocked.some((t) => t.id === "quran")).toBe(true);
        expect(tabsLocked.some((t) => t.id === "quran")).toBe(true);
      });
    });
  });

  describe("Redux State Manager - Letter Validation & Unlocking Flow", () => {
    it("starts with 0 validated letters and locked Quran in child mode", () => {
      const state = store.getState();
      expect(sel.validatedLetters(state)).toEqual([]);
      expect(sel.validatedLettersCount(state)).toBe(0);
      expect(sel.allLettersValidated(state)).toBe(false);
      expect(sel.isQuranUnlockedForChild(state)).toBe(false);
    });

    it("validates individual letters and updates count", () => {
      store.dispatch(uiActions.validateLetter("ب"));
      store.dispatch(uiActions.validateLetter("ت"));
      store.dispatch(uiActions.validateLetter("ث"));

      let state = store.getState();
      expect(sel.validatedLettersCount(state)).toBe(3);
      expect(sel.validatedLetters(state)).toContain("ب");
      expect(sel.validatedLetters(state)).toContain("ت");
      expect(sel.validatedLetters(state)).toContain("ث");
      expect(sel.allLettersValidated(state)).toBe(false);
      expect(sel.isQuranUnlockedForChild(state)).toBe(false);

      // Does not duplicate on re-validating same letter
      store.dispatch(uiActions.validateLetter("ب"));
      state = store.getState();
      expect(sel.validatedLettersCount(state)).toBe(3);
    });

    it("unvalidates and toggles letter validation status", () => {
      store.dispatch(uiActions.toggleValidateLetter("ج"));
      expect(sel.validatedLetters(store.getState())).toContain("ج");

      store.dispatch(uiActions.toggleValidateLetter("ج"));
      expect(sel.validatedLetters(store.getState())).not.toContain("ج");

      store.dispatch(uiActions.validateLetter("ح"));
      store.dispatch(uiActions.unvalidateLetter("ح"));
      expect(sel.validatedLetters(store.getState())).not.toContain("ح");
    });

    it("validates all 28 letters d'un coup with validateAllLetters and unlocks Quran", () => {
      store.dispatch(uiActions.validateAllLetters());

      const state = store.getState();
      const count = sel.validatedLettersCount(state);
      expect(count).toBeGreaterThanOrEqual(28);
      expect(sel.allLettersValidated(state)).toBe(true);
      expect(sel.isQuranUnlockedForChild(state)).toBe(true);
      expect(sel.showChildCelebrationModal(state)).toBe(true);
    });

    it("resets validated letters back to 0 and locks Quran again", () => {
      store.dispatch(uiActions.validateAllLetters());
      expect(sel.isQuranUnlockedForChild(store.getState())).toBe(true);

      store.dispatch(uiActions.resetValidatedLetters());
      const state = store.getState();
      expect(sel.validatedLettersCount(state)).toBe(0);
      expect(sel.allLettersValidated(state)).toBe(false);
      expect(sel.isQuranUnlockedForChild(state)).toBe(false);
    });

    it("tracks child wizard seen state", () => {
      expect(sel.childWizardSeen(store.getState())).toBe(false);
      store.dispatch(uiActions.setChildWizardSeen(true));
      expect(sel.childWizardSeen(store.getState())).toBe(true);
    });

    it("always unlocks Quran in non-child modes even with 0 validated letters", () => {
      store.dispatch(uiActions.setUxMode("standard"));
      expect(sel.isQuranUnlockedForChild(store.getState())).toBe(true);

      store.dispatch(uiActions.setUxMode("beginner"));
      expect(sel.isQuranUnlockedForChild(store.getState())).toBe(true);

      store.dispatch(uiActions.setUxMode("expert"));
      expect(sel.isQuranUnlockedForChild(store.getState())).toBe(true);
    });
  });
});
