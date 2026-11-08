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
});
