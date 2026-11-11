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
  getNavigationTabs,
  getPlayerConfig,
  getSidebarConfig,
  getUxThemeTokens,
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
    expect(beginnerSettings.fullScreenSelectedAyat).toBe(true);
    // Original settings preserved
    expect(beginnerSettings.currentTheme).toBe("dark");

    const expertSettings = applyUxProfileToSettings(current, "expert");
    expect(expertSettings.uxMode).toBe("expert");
    expect(expertSettings.ayatFontSize).toBe(24);
    expect(expertSettings.enableHeavyCompute).toBe(true);
    expect(expertSettings.fullScreenSelectedAyat).toBe(false);
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

  describe("getNavigationTabs - Profile-adapted menu navigation", () => {
    it("provides 3 streamlined kid-friendly tabs and labels for child profile without button overload", () => {
      const tabs = getNavigationTabs("child");
      expect(tabs).toHaveLength(3);
      const ids = tabs.map((t) => t.id);
      expect(ids).toEqual(["quran", "prononciation", "revision"]);

      const quranTab = tabs.find((t) => t.id === "quran");
      expect(quranTab.label).toBe("LECTURE");
      expect(quranTab.title).toContain("belles sourates");

      const prononTab = tabs.find((t) => t.id === "prononciation");
      expect(prononTab.label).toBe("LETTRES");

      const revTab = tabs.find((t) => t.id === "revision");
      expect(revTab.label).toBe("JEUX & QUIZ");
    });

    it("provides 4 clear and essential tabs for beginner profile without button overload", () => {
      const tabs = getNavigationTabs("beginner");
      expect(tabs).toHaveLength(4);
      const tabIds = tabs.map((t) => t.id);
      expect(tabIds).toEqual(["quran", "prononciation", "dashboard", "revision"]);

      const prononTab = tabs.find((t) => t.id === "prononciation");
      expect(prononTab.label).toBe("PRONONCIATION");

      const dashTab = tabs.find((t) => t.id === "dashboard");
      expect(dashTab.label).toBe("PROGRESSION");
    });

    it("provides advanced pro tabs for expert profile", () => {
      const tabs = getNavigationTabs("expert");
      const prononTab = tabs.find((t) => t.id === "prononciation");
      expect(prononTab.label).toBe("TAJWEE" + "D");
      const dashTab = tabs.find((t) => t.id === "dashboard");
      expect(dashTab.label).toBe("MÉTRIQUES");
    });
  });

  describe("getPlayerConfig - Profile-adapted audio player", () => {
    it("provides child-friendly audio controls and labels", () => {
      const cfg = getPlayerConfig("child");
      expect(cfg.isChild).toBe(true);
      expect(cfg.isSimplified).toBe(true);
      expect(cfg.playBtnText(false)).toBe("▶ ÉCOUTER");
      expect(cfg.playBtnText(true)).toBe("⏸ PAUSE");
      expect(cfg.prevBtnText()).toBe("⏮ PRÉC.");
      expect(cfg.nextBtnText()).toBe("SUIV. ⏭");
      expect(cfg.loopBtnText()).toBe("🔁 RÉPÉTER");
      expect(cfg.showFastBackward).toBe(false);
      expect(cfg.showLoopButton).toBe(false);
      expect(cfg.showStandaloneReciter).toBe(false);
      expect(cfg.tajweedBtnLabel).toBe("🎨 TAJWID & AUDIO");
      expect(cfg.tajweedBtnLabelShort).toBe("OPTIONS");

      const status = cfg.verseCounterFormat(3, 7);
      expect(status).toContain("Verset 3 sur 7");
    });

    it("provides clear guided controls and uncluttered player for beginner profile", () => {
      const cfg = getPlayerConfig("beginner");
      expect(cfg.isBeginner).toBe(true);
      expect(cfg.isSimplified).toBe(true);
      expect(cfg.playBtnText(false)).toBe("▶ Écouter");
      expect(cfg.playBtnText(true)).toBe("⏸ Pause");
      expect(cfg.prevBtnText()).toBe("⏮ Préc.");
      expect(cfg.nextBtnText()).toBe("Suiv. ⏭");
      expect(cfg.loopBtnText()).toBe("🔁 Répéter");
      expect(cfg.showFastBackward).toBe(false);
      expect(cfg.showLoopButton).toBe(false);
      expect(cfg.showStandaloneReciter).toBe(false);
      expect(cfg.tajweedBtnLabel).toBe("🎨 OPTIONS & TAJWID");
      expect(cfg.tajweedBtnLabelShort).toBe("OPTIONS");
    });

    it("provides concise symbols for expert and standard profiles", () => {
      const cfg = getPlayerConfig("standard");
      expect(cfg.playBtnText(false)).toBe("▶");
      expect(cfg.playBtnText(true)).toBe("⏸");
      expect(cfg.prevBtnText()).toBe("⏮");
      expect(cfg.nextBtnText()).toBe("⏭");
      expect(cfg.loopBtnText()).toBe("↺");
    });
  });

  describe("getSidebarConfig - Profile-adapted surah selector menu", () => {
    it("provides kid-friendly placeholder and hides technical documentation", () => {
      const cfg = getSidebarConfig("child");
      expect(cfg.searchPlaceholder).toContain("🌟");
      expect(cfg.showArchitectureDoc).toBe(false);
      expect(cfg.revelationLabel("Meccan")).toBe("Mecquoise");
      expect(cfg.revelationLabel("Medinan")).toBe("Médinoise");
      expect(cfg.versesLabel(7)).toBe("7 versets");
      expect(cfg.showStars).toBe(true);
    });

    it("provides beginner-friendly placeholder and clear labels", () => {
      const cfg = getSidebarConfig("beginner");
      expect(cfg.searchPlaceholder).toContain("Rechercher une sourate");
      expect(cfg.showArchitectureDoc).toBe(false);
      expect(cfg.revelationLabel("Meccan")).toBe("Mecquoise");
      expect(cfg.versesLabel(114)).toBe("114 versets");
    });

    it("shows architecture doc and raw meta for expert and standard", () => {
      const expertCfg = getSidebarConfig("expert");
      expect(expertCfg.showArchitectureDoc).toBe(true);
      expect(expertCfg.revelationLabel("Meccan")).toBe("Meccan");
      expect(expertCfg.versesLabel(286)).toBe("286 AYATS");
    });
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
    expect(sel.fullScreenSelectedAyat(state)).toBe(true);
  });

  it("switches to child UX mode and updates typography defaults", () => {
    store.dispatch(uiActions.setUxMode("child"));
    const state = store.getState();

    expect(sel.uxMode(state)).toBe("child");
    expect(sel.isChildUx(state)).toBe(true);
    expect(sel.ayatFontSize(state)).toBe(36);
    expect(sel.showBeginnerGuides(state)).toBe(true);
    expect(sel.fullScreenSelectedAyat(state)).toBe(true);
  });

  it("switches to expert UX mode and enables advanced compute", () => {
    store.dispatch(uiActions.setUxMode("expert"));
    const state = store.getState();

    expect(sel.uxMode(state)).toBe("expert");
    expect(sel.isExpertUx(state)).toBe(true);
    expect(sel.enableHeavyCompute(state)).toBe(true);
    expect(sel.showBeginnerGuides(state)).toBe(false);
    expect(sel.fullScreenSelectedAyat(state)).toBe(false);
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

  describe("getUxThemeTokens - Dynamic theme colors adapted to each profile", () => {
    it("returns warm amber tokens for beginner mode", () => {
      const tokens = getUxThemeTokens("beginner");
      expect(tokens.accent).toBe("#f59e0b");
      expect(tokens.accentHover).toBe("#fbbf24");
      expect(tokens.name).toContain("Ambre");
      expect(tokens.accentGradient).toContain("#f59e0b");
    });

    it("returns cheerful sunny gold tokens for child mode", () => {
      const tokens = getUxThemeTokens("child");
      expect(tokens.accent).toBe("#ffb703");
      expect(tokens.accentHover).toBe("#ffe082");
      expect(tokens.name).toContain("Soleil");
      expect(tokens.accentGradient).toContain("#ffb703");
    });

    it("returns royal purple tokens for expert mode", () => {
      const tokens = getUxThemeTokens("expert");
      expect(tokens.accent).toBe("#c878ff");
      expect(tokens.accentHover).toBe("#d99aff");
      expect(tokens.name).toContain("Violet");
      expect(tokens.accentGradient).toContain("#a855f7");
    });

    it("returns classic warm gold tokens for standard mode", () => {
      const tokens = getUxThemeTokens("standard");
      expect(tokens.accent).toBe("#c9a84c");
      expect(tokens.accentHover).toBe("#e8c96e");
      expect(tokens.name).toContain("Or");
    });

    it("falls back to standard tokens when an invalid mode is provided", () => {
      const tokens = getUxThemeTokens("invalid-mode");
      expect(tokens.accent).toBe("#c9a84c");
    });
  });
});
