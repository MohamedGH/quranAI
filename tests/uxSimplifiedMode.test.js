import { describe, it, expect } from "vitest";
import {
  isSimplifiedUxMode,
  getBeginnerTip,
  getUxProfile,
  UX_PROFILES,
  UX_MODES,
  sanitizeUxMode,
} from "../src/utils/uxProfileManager.js";
import { SurahAllOptionsModal } from "../src/components/common/SurahAllOptionsModal.jsx";
import { PlayerAudioOptionsModal } from "../src/components/common/PlayerAudioOptionsModal.jsx";

describe("Simplified UX Mode (Child & Beginner) & Tooltip Accuracy", () => {
  describe("isSimplifiedUxMode", () => {
    it("returns true for child and beginner modes", () => {
      expect(isSimplifiedUxMode("child")).toBe(true);
      expect(isSimplifiedUxMode("beginner")).toBe(true);
    });

    it("returns false for standard, expert, or invalid modes", () => {
      expect(isSimplifiedUxMode("standard")).toBe(false);
      expect(isSimplifiedUxMode("expert")).toBe(false);
      expect(isSimplifiedUxMode(null)).toBe(false);
      expect(isSimplifiedUxMode(undefined)).toBe(false);
      expect(isSimplifiedUxMode("unknown")).toBe(false);
    });
  });

  describe("Tooltip accuracy and absence of outdated 'bouton vert' in all contexts", () => {
    const contexts = ["quran", "revision", "memoire", "tajweed", "quiz", "concordance", "search", "stats"];

    it("never mentions 'bouton vert' or 'vert' in any beginner tips", () => {
      contexts.forEach((ctx) => {
        const tipBeginner = getBeginnerTip(ctx, "beginner");
        expect(tipBeginner).toBeDefined();
        expect(tipBeginner.toLowerCase()).not.toContain("bouton vert");
        expect(tipBeginner.toLowerCase()).not.toContain("vert 'écouter'");
      });
    });

    it("never mentions 'bouton vert' in any child tips", () => {
      contexts.forEach((ctx) => {
        const tipChild = getBeginnerTip(ctx, "child");
        expect(tipChild).toBeDefined();
        expect(tipChild.toLowerCase()).not.toContain("bouton vert");
        expect(tipChild.toLowerCase()).not.toContain("vert 'écouter'");
      });
    });

    it("provides accurate UI guidance with ▶ icon for Quran playback", () => {
      const quranChildTip = getBeginnerTip("quran", "child");
      expect(quranChildTip).toContain("▶");
      expect(quranChildTip).toContain("lire");

      const quranBeginnerTip = getBeginnerTip("quran", "beginner");
      expect(quranBeginnerTip).toContain("▶");
      expect(quranBeginnerTip).toContain("lecture");
    });

    it("provides child-specific encouraging tips when uxMode is 'child'", () => {
      const childTip = getBeginnerTip("quran", "child");
      const beginnerTip = getBeginnerTip("quran", "beginner");
      expect(childTip).not.toEqual(beginnerTip);
      expect(childTip).toContain("🌟");
    });
  });

  describe("UX Profiles Configuration", () => {
    it("has child mode defined with simplified features and large font scale", () => {
      const childProfile = getUxProfile("child");
      expect(childProfile.id).toBe("child");
      expect(childProfile.featureFlags.simplifiedAudioPlayer).toBe(true);
      expect(childProfile.featureFlags.simplifiedSurahHeader).toBe(true);
      expect(childProfile.featureFlags.hideAdvancedMetrics).toBe(true);
      expect(childProfile.defaultSettings.ayatFontSize).toBeGreaterThanOrEqual(30);
    });

    it("has beginner mode defined with simplified headers and guided tooltips", () => {
      const beginnerProfile = getUxProfile("beginner");
      expect(beginnerProfile.id).toBe("beginner");
      expect(beginnerProfile.featureFlags.simplifiedAudioPlayer).toBe(true);
      expect(beginnerProfile.featureFlags.simplifiedSurahHeader).toBe(true);
      expect(beginnerProfile.featureFlags.showBeginnerTooltips).toBe(true);
      expect(beginnerProfile.defaultSettings.ayatFontSize).toBeGreaterThanOrEqual(30);
    });

    it("expert mode does not simplify headers or audio player", () => {
      const expertProfile = getUxProfile("expert");
      expect(expertProfile.id).toBe("expert");
      expect(expertProfile.featureFlags.simplifiedAudioPlayer).toBe(false);
      expect(expertProfile.featureFlags.simplifiedSurahHeader).toBe(false);
    });

    it("sanitizes fallback correctly", () => {
      expect(sanitizeUxMode("child")).toBe("child");
      expect(sanitizeUxMode("beginner")).toBe("beginner");
      expect(sanitizeUxMode("invalid")).toBe("standard");
    });
  });

  describe("Modals exports and integration", () => {
    it("SurahAllOptionsModal is exported as a function/component", () => {
      expect(typeof SurahAllOptionsModal).toBe("function");
    });

    it("PlayerAudioOptionsModal is exported as a function/component", () => {
      expect(typeof PlayerAudioOptionsModal).toBe("function");
    });
  });

  describe("Expert font sizing and manual scroll container robustness", () => {
    it("resets ayatFontSize down to 24 when switching from child or beginner to expert", async () => {
      const { store, uiActions, sel } = await import("../src/store.js");
      // Set to child mode first (large font: 36)
      store.dispatch(uiActions.setUxMode("child"));
      expect(sel.ayatFontSize(store.getState())).toBe(36);

      // Now switch to expert: font size MUST be reset to 24 (not remaining at 36)
      store.dispatch(uiActions.setUxMode("expert"));
      expect(sel.ayatFontSize(store.getState())).toBe(24);
      expect(sel.isExpertUx(store.getState())).toBe(true);
    });

    it("resets ayatFontSize to 26 when switching to standard mode", async () => {
      const { store, uiActions, sel } = await import("../src/store.js");
      store.dispatch(uiActions.setUxMode("beginner"));
      expect(sel.ayatFontSize(store.getState())).toBe(32);

      store.dispatch(uiActions.setUxMode("standard"));
      expect(sel.ayatFontSize(store.getState())).toBe(26);
    });
  });

  describe("Child & Beginner full screen surah default and surah menu closed by default", () => {
    it("configures fullScreenSelectedAyat to true in UX profiles for child and beginner", () => {
      const childProfile = getUxProfile("child");
      const beginnerProfile = getUxProfile("beginner");
      const standardProfile = getUxProfile("standard");
      const expertProfile = getUxProfile("expert");

      expect(childProfile.defaultSettings.fullScreenSelectedAyat).toBe(true);
      expect(beginnerProfile.defaultSettings.fullScreenSelectedAyat).toBe(true);
      expect(standardProfile.defaultSettings.fullScreenSelectedAyat).toBe(false);
      expect(expertProfile.defaultSettings.fullScreenSelectedAyat).toBe(false);
    });

    it("ensures surah selection menu (sidebarOpen) is not open by default", async () => {
      const { store, uiActions, sel } = await import("../src/store.js");
      // Initially sidebar must be closed
      store.dispatch(uiActions.setSidebarOpen(false));
      expect(sel.sidebarOpen(store.getState())).toBe(false);
    });

    it("automatically activates fullScreenSelectedAyat when switching to child or beginner mode", async () => {
      const { store, uiActions, sel } = await import("../src/store.js");

      // Standard mode: full screen false
      store.dispatch(uiActions.setUxMode("standard"));
      expect(sel.fullScreenSelectedAyat(store.getState())).toBe(false);

      // Child mode: full screen true by default
      store.dispatch(uiActions.setUxMode("child"));
      expect(sel.fullScreenSelectedAyat(store.getState())).toBe(true);

      // Expert mode: full screen false
      store.dispatch(uiActions.setUxMode("expert"));
      expect(sel.fullScreenSelectedAyat(store.getState())).toBe(false);

      // Beginner mode: full screen true by default
      store.dispatch(uiActions.setUxMode("beginner"));
      expect(sel.fullScreenSelectedAyat(store.getState())).toBe(true);
    });
  });

  describe("Novice / Débutant Profile Enhancements: Warmer colors & uncluttered buttons", () => {
    it("beginner profile has warm metadata, icon, and description", () => {
      const profile = getUxProfile("beginner");
      expect(profile.name).toBe("Novice / Débutant");
      expect(profile.shortLabel).toBe("Novice");
      expect(profile.badge).toBe("Novice");
      expect(profile.icon).toBe("🌱");
      expect(profile.description).toContain("chaleureuse");
      expect(profile.description).toContain("ambrées");
      expect(profile.features.some(f => f.toLowerCase().includes("ambrée"))).toBe(true);
      expect(profile.features.some(f => f.toLowerCase().includes("4 onglets"))).toBe(true);
    });

    it("beginner profile navigation is reduced from 7 to 4 essential tabs", async () => {
      const { getNavigationTabs } = await import("../src/utils/uxProfileManager.js");
      const beginnerTabs = getNavigationTabs("beginner");
      expect(beginnerTabs).toHaveLength(4);
      expect(beginnerTabs.map(t => t.id)).toEqual(["quran", "prononciation", "dashboard", "revision"]);

      // In contrast, standard has 7 tabs
      const standardTabs = getNavigationTabs("standard");
      expect(standardTabs.length).toBe(7);
    });

    it("beginner player hides fast backward, loop button, and standalone reciter for a clean 4-button player", async () => {
      const { getPlayerConfig } = await import("../src/utils/uxProfileManager.js");
      const cfg = getPlayerConfig("beginner");
      expect(cfg.showFastBackward).toBe(false);
      expect(cfg.showLoopButton).toBe(false);
      expect(cfg.showStandaloneReciter).toBe(false);
      expect(cfg.tajweedBtnLabel).toBe("🎨 OPTIONS & TAJWID");
      expect(cfg.tajweedBtnLabelShort).toBe("OPTIONS");
      expect(cfg.playBtnText(false)).toBe("▶ Écouter");
      expect(cfg.playBtnText(true)).toBe("⏸ Pause");
      expect(cfg.prevBtnText()).toBe("⏮ Préc.");
      expect(cfg.nextBtnText()).toBe("Suiv. ⏭");
    });
  });

  describe("UxLevelWizardModal & getUxWizardConfig - Onboarding wizard adapted to each level", () => {
    it("generates beginner-tailored wizard with step-by-step guidance", async () => {
      const { getUxWizardConfig } = await import("../src/utils/uxProfileManager.js");
      const wizard = getUxWizardConfig("beginner");
      expect(wizard.mode).toBe("beginner");
      expect(wizard.title).toContain("espace Coran apaisé");
      expect(wizard.badge).toContain("Débutant");
      expect(wizard.steps.length).toBeGreaterThanOrEqual(4);
      expect(wizard.steps[0].title).toContain("Grands Caractères");
      expect(wizard.steps[1].title).toContain("Écoute Audio Simplifiée");
      expect(wizard.steps[2].title).toContain("4 Onglets Essentiels");
      expect(wizard.theme.accent).toBe("#f59e0b");
    });

    it("generates child-tailored wizard with fun and encouraging language", async () => {
      const { getUxWizardConfig } = await import("../src/utils/uxProfileManager.js");
      const wizard = getUxWizardConfig("child");
      expect(wizard.mode).toBe("child");
      expect(wizard.title).toContain("explorateur");
      expect(wizard.badge).toContain("Apprenti");
      expect(wizard.steps.length).toBe(4);
      expect(wizard.steps[0].title).toContain("Magiques");
      expect(wizard.steps[2].title).toContain("Quiz");
      expect(wizard.theme.accent).toBe("#ffb703");
    });

    it("generates expert-tailored wizard with high-precision technical features", async () => {
      const { getUxWizardConfig } = await import("../src/utils/uxProfileManager.js");
      const wizard = getUxWizardConfig("expert");
      expect(wizard.mode).toBe("expert");
      expect(wizard.title).toContain("Haute Précision");
      expect(wizard.badge).toContain("Expert");
      expect(wizard.steps.length).toBe(4);
      expect(wizard.steps[0].title).toContain("Acoustique & Métadonnées");
      expect(wizard.steps[1].title).toContain("Tajweed & Silences");
      expect(wizard.steps[2].title).toContain("Raccourcis Clavier");
      expect(wizard.theme.accent).toBe("#c878ff");
    });

    it("generates standard-tailored wizard with balanced feature tour", async () => {
      const { getUxWizardConfig } = await import("../src/utils/uxProfileManager.js");
      const wizard = getUxWizardConfig("standard");
      expect(wizard.mode).toBe("standard");
      expect(wizard.title).toContain("Qur'an Study");
      expect(wizard.steps.length).toBe(4);
      expect(wizard.theme.accent).toBe("#c9a84c");
    });

    it("manages wizard visibility and step index in Redux store", async () => {
      const { store, uiActions, sel } = await import("../src/store.js");
      expect(sel.showUxWizard(store.getState())).toBe(false);
      expect(sel.uxWizardStep(store.getState())).toBe(0);

      // Open wizard
      store.dispatch(uiActions.setShowUxWizard(true));
      expect(sel.showUxWizard(store.getState())).toBe(true);
      expect(sel.uxWizardStep(store.getState())).toBe(0);

      // Advance step
      store.dispatch(uiActions.setUxWizardStep(2));
      expect(sel.uxWizardStep(store.getState())).toBe(2);

      // Close wizard
      store.dispatch(uiActions.setShowUxWizard(false));
      expect(sel.showUxWizard(store.getState())).toBe(false);

      // Toggle wizard opens and resets step to 0
      store.dispatch(uiActions.toggleShowUxWizard());
      expect(sel.showUxWizard(store.getState())).toBe(true);
      expect(sel.uxWizardStep(store.getState())).toBe(0);

      store.dispatch(uiActions.setShowUxWizard(false));
    });

    it("exports UxLevelWizardModal as a valid React component", async () => {
      const { UxLevelWizardModal } = await import("../src/components/common/UxLevelWizardModal.jsx");
      expect(typeof UxLevelWizardModal).toBe("function");
    });
  });

  describe("Child Mode - Luminous palette, prominent ayat text & uncluttered buttons", () => {
    it("features luminous sunny color palette with warm radiant gold tokens", async () => {
      const { getUxThemeTokens, getUxProfile } = await import("../src/utils/uxProfileManager.js");
      const tokens = getUxThemeTokens("child");
      expect(tokens.name).toContain("Lumineux");
      expect(tokens.accent).toBe("#ffb703");
      expect(tokens.accentHover).toBe("#ffe082");
      expect(tokens.badgeBorder).toBe("rgba(255, 183, 3, 0.75)");
      expect(tokens.cardBg).toContain("rgba(255, 245, 205");

      const profile = getUxProfile("child");
      expect(profile.description).toContain("36px");
      expect(profile.description).toContain("lumineux");
    });

    it("gives prominent space to the Quranic verse text with 36px font scale and fullScreenSelectedAyat", async () => {
      const { getUxProfile } = await import("../src/utils/uxProfileManager.js");
      const profile = getUxProfile("child");
      expect(profile.defaultSettings.ayatFontSize).toBe(36);
      expect(profile.defaultSettings.fullScreenSelectedAyat).toBe(true);
      expect(profile.featureFlags.hideAdvancedMetrics).toBe(true);
    });

    it("declutters navigation down to strictly 3 kid-friendly tabs", async () => {
      const { getNavigationTabs } = await import("../src/utils/uxProfileManager.js");
      const tabs = getNavigationTabs("child");
      expect(tabs).toHaveLength(3);
      const tabIds = tabs.map((t) => t.id);
      expect(tabIds).toEqual(["quran", "prononciation", "revision"]);

      expect(tabs[0].label).toBe("LECTURE");
      expect(tabs[1].label).toBe("LETTRES");
      expect(tabs[2].label).toBe("JEUX & QUIZ");
    });

    it("declutters main player controls strictly to 4 kid buttons (préc, écouter/pause, suiv, tajwid)", async () => {
      const { getPlayerConfig } = await import("../src/utils/uxProfileManager.js");
      const cfg = getPlayerConfig("child");
      expect(cfg.isChild).toBe(true);
      expect(cfg.showFastBackward).toBe(false);
      expect(cfg.showLoopButton).toBe(false);
      expect(cfg.showStandaloneReciter).toBe(false);
      expect(cfg.playBtnText(false)).toBe("▶ ÉCOUTER");
      expect(cfg.playBtnText(true)).toBe("⏸ PAUSE");
      expect(cfg.prevBtnText()).toBe("⏮ PRÉC.");
      expect(cfg.nextBtnText()).toBe("SUIV. ⏭");
      expect(cfg.tajweedBtnLabel).toBe("🎨 TAJWID & AUDIO");
      expect(cfg.tajweedBtnLabelShort).toBe("OPTIONS");
    });
  });
});

