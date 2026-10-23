import { describe, it, expect } from "vitest";
import {
  resolveExitToNormalModeState,
  resolveCloseFullScreenState,
  computeFullScreenLayout,
  formatFullScreenHeaderLabels,
  canNavigateFullScreenAyat,
} from "../src/utils/fullScreenNavigation.js";

describe("FullScreen Ayat Navigation & Responsive Layout Helpers", () => {
  describe("resolveExitToNormalModeState", () => {
    it("returns next state to disable auto-fullscreen while keeping the ayat focused in normal mode", () => {
      const result = resolveExitToNormalModeState({
        fullScreenSelectedAyat: true,
        explicitFullScreen: true,
        openAyatNum: 255,
      });

      expect(result.nextFullScreenSelectedAyat).toBe(false);
      expect(result.shouldUpdateReduxOption).toBe(true);
      expect(result.nextExplicitFullScreen).toBe(false);
      expect(result.nextOpenAyatNum).toBe(255);
      expect(result.message).toBe("Mode normal rétabli");
    });

    it("handles transition when fullScreenSelectedAyat was already false", () => {
      const result = resolveExitToNormalModeState({
        fullScreenSelectedAyat: false,
        explicitFullScreen: true,
        openAyatNum: 7,
      });

      expect(result.nextFullScreenSelectedAyat).toBe(false);
      expect(result.shouldUpdateReduxOption).toBe(false);
      expect(result.nextExplicitFullScreen).toBe(false);
      expect(result.nextOpenAyatNum).toBe(7);
    });

    it("handles defaults gracefully", () => {
      const result = resolveExitToNormalModeState();
      expect(result.nextFullScreenSelectedAyat).toBe(false);
      expect(result.nextExplicitFullScreen).toBe(false);
      expect(result.nextOpenAyatNum).toBeNull();
    });
  });

  describe("resolveCloseFullScreenState", () => {
    it("returns next state with openAyatNum null to completely close view", () => {
      const result = resolveCloseFullScreenState({
        fullScreenSelectedAyat: true,
        explicitFullScreen: true,
      });

      expect(result.nextFullScreenSelectedAyat).toBe(false);
      expect(result.shouldUpdateReduxOption).toBe(true);
      expect(result.nextExplicitFullScreen).toBe(false);
      expect(result.nextOpenAyatNum).toBeNull();
    });
  });

  describe("computeFullScreenLayout", () => {
    it("computes mobile layout for screens <= 640px", () => {
      const mobile = computeFullScreenLayout(480);
      expect(mobile.isMobile).toBe(true);
      expect(mobile.isSmallMobile).toBe(false);
      expect(mobile.isDesktop).toBe(false);
      expect(mobile.headerRowCount).toBe(2);
      expect(mobile.fontSizeClamped(48)).toBe(36);
      expect(mobile.audioButtonSize).toBe(38);
    });

    it("computes extra small mobile layout for screens <= 380px", () => {
      const small = computeFullScreenLayout(360);
      expect(small.isSmallMobile).toBe(true);
      expect(small.isMobile).toBe(true);
      expect(small.maxAyatSelectWidth).toBe(70);
      expect(small.audioButtonSize).toBe(34);
      expect(small.playButtonSize).toBe(44);
    });

    it("computes desktop layout for wide screens", () => {
      const desktop = computeFullScreenLayout(1280);
      expect(desktop.isMobile).toBe(false);
      expect(desktop.isDesktop).toBe(true);
      expect(desktop.headerRowCount).toBe(1);
      expect(desktop.fontSizeClamped(48)).toBe(48);
      expect(desktop.audioButtonSize).toBe(36);
      expect(desktop.playButtonSize).toBe(52);
    });
  });

  describe("formatFullScreenHeaderLabels", () => {
    it("formats surah and ayat labels cleanly", () => {
      const surah = { number: 2, englishName: "Al-Baqara", numberOfAyahs: 286 };
      const labels = formatFullScreenHeaderLabels(surah, 255, 286);

      expect(labels.shortLabel).toBe("2. Al-Baqara · V.255");
      expect(labels.fullLabel).toBe("2. Al-Baqara (255/286)");
      expect(labels.stepperLabel).toBe("V.255 / 286");
    });

    it("handles null surah safely", () => {
      const labels = formatFullScreenHeaderLabels(null, 1, 7);
      expect(labels.shortLabel).toBe("");
      expect(labels.fullLabel).toBe("");
    });
  });

  describe("canNavigateFullScreenAyat", () => {
    it("allows navigation when within verse boundaries", () => {
      expect(canNavigateFullScreenAyat({ currentAyatNum: 5, totalAyats: 10, direction: "prev" })).toBe(true);
      expect(canNavigateFullScreenAyat({ currentAyatNum: 5, totalAyats: 10, direction: "next" })).toBe(true);
    });

    it("disallows prev at verse 1 and next at last verse", () => {
      expect(canNavigateFullScreenAyat({ currentAyatNum: 1, totalAyats: 7, direction: "prev" })).toBe(false);
      expect(canNavigateFullScreenAyat({ currentAyatNum: 7, totalAyats: 7, direction: "next" })).toBe(false);
    });

    it("handles missing inputs safely", () => {
      expect(canNavigateFullScreenAyat({})).toBe(false);
    });
  });
});
