import { describe, it, expect, beforeEach } from "vitest";
import {
  UX_MODES,
  UX_PROFILES,
  isValidUxMode,
  getUxProfile,
  getAvailableUxProfiles,
  applyUxProfileToSettings,
  getBeginnerTip,
  getUxModeClassName,
  formatFriendlyErrorMessage,
} from "../src/utils/uxProfileManager.js";
import { parseQuranRoute, buildQuranRoute, setRouteUxMode } from "../src/utils/routeManager.js";
import { ERROR_CODES, createAppError } from "../src/utils/errorManager.js";
import { store, sel, uiActions } from "../src/store.js";

describe("uxProfileManager - Pure functional profiles & metadata", () => {
  it("defines the 4 distinct user UX modes", () => {
    expect(UX_MODES.BEGINNER).toBe("beginner");
    expect(UX_MODES.STANDARD).toBe("standard");
    expect(UX_MODES.EXPERT).toBe("expert");
    expect(UX_MODES.CHILD).toBe("child");
  });

  it("provides comprehensive metadata for each profile", () => {
    const profiles = getAvailableUxProfiles();
    expect(profiles).toHaveLength(4);

    profiles.forEach((p) => {
      expect(p.id).toBeDefined();
      expect(p.name).toBeTruthy();
      expect(p.shortLabel).toBeTruthy();
      expect(p.icon).toBeTruthy();
      expect(p.targetAudience).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(Array.isArray(p.features)).toBe(true);
      expect(p.features.length).toBeGreaterThanOrEqual(3);
      expect(p.defaultSettings).toBeDefined();
      expect(p.defaultSettings.ayatFontSize).toBeGreaterThanOrEqual(20);
    });
  });

  it("correctly identifies valid vs invalid UX modes", () => {
    expect(isValidUxMode("beginner")).toBe(true);
    expect(isValidUxMode("standard")).toBe(true);
    expect(isValidUxMode("expert")).toBe(true);
    expect(isValidUxMode("child")).toBe(true);
    expect(isValidUxMode("unknown")).toBe(false);
    expect(isValidUxMode(null)).toBe(false);
    expect(isValidUxMode(123)).toBe(false);
  });

  it("retrieves profile metadata with fallback to standard", () => {
    const beginner = getUxProfile("beginner");
    expect(beginner.id).toBe("beginner");
    expect(beginner.name).toContain("Débutant");

    const fallback = getUxProfile("invalid_mode");
    expect(fallback.id).toBe("standard");
  });

  it("applies target UX profile settings immutably", () => {
    const current = { currentTheme: "dark", ayatFontSize: 26 };
    const beginnerSettings = applyUxProfileToSettings(current, "beginner");

    expect(beginnerSettings.uxMode).toBe("beginner");
    expect(beginnerSettings.ayatFontSize).toBe(32);
    expect(beginnerSettings.enableAnimations).toBe(false);
    expect(beginnerSettings.showBeginnerGuides).toBe(true);
    // Original settings preserved
    expect(beginnerSettings.currentTheme).toBe("dark");

    const expertSettings = applyUxProfileToSettings(current, "expert");
    expect(expertSettings.uxMode).toBe("expert");
    expect(expertSettings.ayatFontSize).toBe(24);
    expect(expertSettings.enableHeavyCompute).toBe(true);
  });

  it("provides contextual tips for beginner and child guidance", () => {
    expect(getBeginnerTip("quran")).toContain("Pour lire");
    expect(getBeginnerTip("audio")).toContain("Écoute audio");
    expect(getBeginnerTip("quiz")).toContain("Quiz");
    expect(getBeginnerTip("unknown_context")).toContain("Astuce");
  });

  it("generates predictable CSS class names for styling hooks", () => {
    expect(getUxModeClassName("beginner")).toBe("ux-profile-beginner");
    expect(getUxModeClassName("expert")).toBe("ux-profile-expert");
    expect(getUxModeClassName("child")).toBe("ux-profile-child");
    expect(getUxModeClassName("unknown")).toBe("ux-profile-standard");
  });

  it("formats reassuring, friendly error messages for beginners", () => {
    const netErr = new Error("Failed to fetch surah data");
    const friendly = formatFriendlyErrorMessage(netErr, "beginner");
    expect(friendly).toContain("Connexion internet");
    expect(friendly).not.toContain("Failed to fetch");

    const audioErr = new Error("The play() request was interrupted");
    const audioFriendly = formatFriendlyErrorMessage(audioErr, "child");
    expect(audioFriendly).toContain("lecture audio");

    // Standard mode receives standard error message
    const standardMsg = formatFriendlyErrorMessage(netErr, "standard");
    expect(standardMsg).toBe("Failed to fetch surah data");
  });
});

describe("routeManager - UX mode integration", () => {
  it("parses ux query parameter from URL", () => {
    const parsed1 = parseQuranRoute("/quran/1/1", "?ux=beginner");
    expect(parsed1.uxMode).toBe("beginner");

    const parsed2 = parseQuranRoute("/quran/2", "?ux=expert&hizb=1");
    expect(parsed2.uxMode).toBe("expert");
    expect(parsed2.hizbNum).toBe(1);

    const parsedInvalid = parseQuranRoute("/quran", "?ux=alien");
    expect(parsedInvalid.uxMode).toBeNull();
  });

  it("builds canonical route URLs containing ux parameter", () => {
    const url = buildQuranRoute({
      activePage: "quran",
      surahNum: 1,
      ayatNum: 1,
      uxMode: "beginner",
    });
    expect(url).toBe("/quran/1/1?ux=beginner");

    const revUrl = buildQuranRoute({
      activePage: "revision",
      uxMode: "child",
    });
    expect(revUrl).toBe("/revision?ux=child");
  });

  it("setRouteUxMode updates UX mode in route", () => {
    const nextUrl = setRouteUxMode("/quran/2/255", "", "expert");
    expect(nextUrl).toBe("/quran/2/255?ux=expert");
  });
});

describe("errorManager - UX error code", () => {
  it("includes UX_PROFILE_ERROR in ERROR_CODES", () => {
    expect(ERROR_CODES.UX_PROFILE_ERROR).toBe("UX_PROFILE_ERROR");
    const appErr = createAppError(ERROR_CODES.UX_PROFILE_ERROR, "Invalid profile");
    expect(appErr.code).toBe("UX_PROFILE_ERROR");
  });
});

describe("store - UX mode Redux state management", () => {
  beforeEach(() => {
    store.dispatch(uiActions.setUxMode("standard"));
    store.dispatch(uiActions.setShowUxModeModal(false));
    store.dispatch(uiActions.setShowBeginnerGuides(true));
  });

  it("initializes and selects default standard UX mode", () => {
    const state = store.getState();
    expect(sel.uxMode(state)).toBe("standard");
    expect(sel.isBeginnerUx(state)).toBe(false);
    expect(sel.isExpertUx(state)).toBe(false);
    expect(sel.isChildUx(state)).toBe(false);
  });

  it("switches to beginner UX mode and updates accessibility defaults", () => {
    store.dispatch(uiActions.setUxMode("beginner"));
    const state = store.getState();

    expect(sel.uxMode(state)).toBe("beginner");
    expect(sel.isBeginnerUx(state)).toBe(true);
    expect(sel.isExpertUx(state)).toBe(false);
    expect(sel.ayatFontSize(state)).toBe(32); // font increased for comfortable reading
    expect(sel.enableAnimations(state)).toBe(false);
    expect(sel.showBeginnerGuides(state)).toBe(true);
  });

  it("switches to child UX mode and updates typography defaults", () => {
    store.dispatch(uiActions.setUxMode("child"));
    const state = store.getState();

    expect(sel.uxMode(state)).toBe("child");
    expect(sel.isChildUx(state)).toBe(true);
    expect(sel.ayatFontSize(state)).toBe(34);
    expect(sel.showBeginnerGuides(state)).toBe(true);
  });

  it("switches to expert UX mode and enables advanced compute", () => {
    store.dispatch(uiActions.setUxMode("expert"));
    const state = store.getState();

    expect(sel.uxMode(state)).toBe("expert");
    expect(sel.isExpertUx(state)).toBe(true);
    expect(sel.enableHeavyCompute(state)).toBe(true);
    expect(sel.showBeginnerGuides(state)).toBe(false);
  });

  it("manages UX mode selector modal visibility", () => {
    expect(sel.showUxModeModal(store.getState())).toBe(false);

    store.dispatch(uiActions.setShowUxModeModal(true));
    expect(sel.showUxModeModal(store.getState())).toBe(true);

    store.dispatch(uiActions.toggleShowUxModeModal());
    expect(sel.showUxModeModal(store.getState())).toBe(false);
  });

  it("toggles beginner guidance tips", () => {
    store.dispatch(uiActions.setShowBeginnerGuides(true));
    expect(sel.showBeginnerGuides(store.getState())).toBe(true);

    store.dispatch(uiActions.toggleBeginnerGuides());
    expect(sel.showBeginnerGuides(store.getState())).toBe(false);
  });
});
