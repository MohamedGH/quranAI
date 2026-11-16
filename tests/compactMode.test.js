// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { store, sel, uiActions } from "../src/store.js";
import {
  UX_MODES,
  getCompactLayoutConfig,
  getAppRootClassNames,
} from "../src/utils/uxProfileManager.js";
import {
  parseQuranRoute,
  buildQuranRoute,
  buildGlossaryRoute,
  setRouteCompactMode,
} from "../src/utils/routeManager.js";
import { HeaderToolsModal } from "../src/components/common/HeaderToolsModal.jsx";
import { UxModeSelectorModal } from "../src/components/common/UxModeSelectorModal.jsx";
import { BeginnerGuideBanner } from "../src/components/common/BeginnerGuideBanner.jsx";
import { SurahHeader } from "../src/components/common/SurahHeader.jsx";
import { PrononciationPage } from "../src/components/pages/PrononciationPage.jsx";
import { GlossairePage } from "../src/components/pages/GlossairePage.jsx";
import { CSS as APP_GLOBAL_CSS } from "../src/components/common/StyleTag.jsx";

describe("Global Mode Compact — State, Routing, Pure Helpers & All User Types", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    store.dispatch(uiActions.setCompactMode(false));
    store.dispatch(uiActions.setUxMode("standard"));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("Redux store persistence & UX mode independence", () => {
    it("defaults to false and toggles cleanly with localStorage persistence", () => {
      expect(sel.compactMode(store.getState())).toBe(false);

      store.dispatch(uiActions.toggleCompactMode());
      expect(sel.compactMode(store.getState())).toBe(true);
      expect(localStorage.getItem("quran_compactMode")).toBe("true");

      store.dispatch(uiActions.setCompactMode(false));
      expect(sel.compactMode(store.getState())).toBe(false);
      expect(localStorage.getItem("quran_compactMode")).toBe("false");
    });

    it("preserves compactMode when switching across ALL user profiles (child, beginner, standard, expert)", () => {
      store.dispatch(uiActions.setCompactMode(true));
      expect(sel.compactMode(store.getState())).toBe(true);

      ["child", "beginner", "expert", "standard"].forEach((mode) => {
        store.dispatch(uiActions.setUxMode(mode));
        expect(sel.uxMode(store.getState())).toBe(mode);
        expect(sel.compactMode(store.getState())).toBe(true);
      });
    });
  });

  describe("Pure functional helpers (uxProfileManager)", () => {
    it("getCompactLayoutConfig returns frozen density metrics for normal and compact modes across all user profiles", () => {
      Object.values(UX_MODES).forEach((mode) => {
        const normalCfg = getCompactLayoutConfig(false, mode);
        const compactCfg = getCompactLayoutConfig(true, mode);

        expect(Object.isFrozen(normalCfg)).toBe(true);
        expect(Object.isFrozen(compactCfg)).toBe(true);
        expect(normalCfg.isCompact).toBe(false);
        expect(compactCfg.isCompact).toBe(true);
        expect(compactCfg.headerHeightPx).toBeLessThan(normalCfg.headerHeightPx);
        expect(compactCfg.playerHeightPx).toBeLessThan(normalCfg.playerHeightPx);
        expect(compactCfg.sidebarWidthPx).toBeLessThan(normalCfg.sidebarWidthPx);
        expect(compactCfg.showHeaderMetrics).toBe(false);
        expect(compactCfg.showVerboseMeta).toBe(false);
        expect(compactCfg.badgeLabel).toBe("Compact ON");
      });
    });

    it("getAppRootClassNames combines active UX profile class and compact-mode cleanly", () => {
      expect(getAppRootClassNames("child", false)).toBe("ux-profile-child");
      expect(getAppRootClassNames("child", true)).toBe("ux-profile-child compact-mode");
      expect(getAppRootClassNames("beginner", true)).toBe("ux-profile-beginner compact-mode");
      expect(getAppRootClassNames("standard", true)).toBe("ux-profile-standard compact-mode");
      expect(getAppRootClassNames("expert", true)).toBe("ux-profile-expert compact-mode");
      expect(getAppRootClassNames("unknown-mode", true)).toBe("ux-profile-standard compact-mode");
    });
  });

  describe("routeManager ?compact=1 query parameter integration", () => {
    it("parses compact=1 / compact=0 and preserves null when absent", () => {
      expect(parseQuranRoute("/quran/2/255", "?compact=1").compactMode).toBe(true);
      expect(parseQuranRoute("/prononciation", "?ux=child&compact=true").compactMode).toBe(true);
      expect(parseQuranRoute("/quran/1", "?compact=0").compactMode).toBe(false);
      expect(parseQuranRoute("/quran/1", "").compactMode).toBeNull();
    });

    it("serializes compact=1 cleanly in buildQuranRoute and buildGlossaryRoute", () => {
      expect(buildQuranRoute({ activePage: "quran", surahNum: 2, compactMode: true })).toBe("/quran/2?compact=1");
      expect(buildQuranRoute({ activePage: "prononciation", uxMode: "child", compactMode: true })).toBe(
        "/prononciation?ux=child&compact=1"
      );
      expect(buildGlossaryRoute("tafkhim", { uxMode: "expert", compactMode: true })).toBe(
        "/glossaire/tafkhim?ux=expert&compact=1"
      );
      expect(buildQuranRoute({ activePage: "quran", surahNum: 1, compactMode: false })).toBe("/quran/1");
    });

    it("setRouteCompactMode toggles ?compact=1 idempotently on existing URLs", () => {
      const enabled = setRouteCompactMode("/quran/18", "?hizb=30", true);
      expect(enabled).toContain("/quran/18");
      expect(enabled).toContain("compact=1");
      expect(enabled).toContain("hizb=30");

      const disabled = setRouteCompactMode("/quran/18", "?compact=1&hizb=30", false);
      expect(disabled).not.toContain("compact=1");
      expect(disabled).toContain("hizb=30");
    });
  });

  describe("Modal switches (HeaderToolsModal & UxModeSelectorModal)", () => {
    it("toggles compactMode via both OUTILS and MODE & PROFIL tabs inside HeaderToolsModal", () => {
      const props = {
        isOpen: true,
        onClose: vi.fn(),
        currentUser: { displayName: "Amin", email: "amin@test.dev" },
        onSignOut: vi.fn(),
        showArabicKeyboard: false,
        setShowArabicKeyboard: vi.fn(),
        showRappel: false,
        setShowRappel: vi.fn(),
        onOpenScheduledReminders: vi.fn(),
        onOpenOptionsModal: vi.fn(),
        toggleVoice: vi.fn(),
        listening: false,
        selectedSurah: { number: 1, englishName: "Al-Fatiha" },
        activeHizb: 1,
        initialTab: "tools",
      };

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            { initialEntries: ["/"] },
            React.createElement(HeaderToolsModal, props)
          )
        )
      );

      const toolsSwitch = document.getElementById("toggle-compact-mode-switch");
      expect(toolsSwitch).toBeTruthy();
      expect(toolsSwitch.getAttribute("aria-checked")).toBe("false");

      fireEvent.click(toolsSwitch);
      expect(sel.compactMode(store.getState())).toBe(true);
      expect(toolsSwitch.getAttribute("aria-checked")).toBe("true");

      // Switch to MODE & PROFIL tab (accessible even in child mode via header UX badge)
      fireEvent.click(document.getElementById("modal-tab-ux"));
      const uxSwitch = document.getElementById("toggle-ux-compact-mode-switch");
      expect(uxSwitch).toBeTruthy();
      expect(uxSwitch.getAttribute("aria-checked")).toBe("true");

      fireEvent.click(uxSwitch);
      expect(sel.compactMode(store.getState())).toBe(false);
    });

    it("toggles compactMode via UxModeSelectorModal alongside user profile selection", () => {
      store.dispatch(uiActions.setUxMode("child"));

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(UxModeSelectorModal, { isOpen: true, onClose: vi.fn() })
        )
      );

      const modalSwitch = document.getElementById("ux-modal-compact-toggle");
      expect(modalSwitch).toBeTruthy();
      expect(modalSwitch.getAttribute("aria-checked")).toBe("false");

      fireEvent.click(modalSwitch);
      expect(sel.compactMode(store.getState())).toBe(true);
      expect(sel.uxMode(store.getState())).toBe("child");
      expect(modalSwitch.getAttribute("aria-checked")).toBe("true");
    });
  });

  describe("Component & Page adaptation across user types", () => {
    it("BeginnerGuideBanner applies slim data-compact-mode styles for child & beginner", () => {
      store.dispatch(uiActions.setUxMode("child"));
      store.dispatch(uiActions.setCompactMode(true));

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(BeginnerGuideBanner, { context: "quran" })
        )
      );

      const banner = document.querySelector('[data-simplified-banner="true"]');
      expect(banner).toBeTruthy();
      expect(banner.getAttribute("data-compact-mode")).toBe("true");
      expect(banner.style.flexWrap).toBe("nowrap");
    });

    it("SurahHeader hides verbose meta in compact mode across all profiles while retaining data-compact-mode", () => {
      const mockSurah = {
        number: 2,
        name: "سُورَةُ ٱلْبَقَرَةِ",
        englishName: "Al-Baqarah",
        numberOfAyahs: 286,
        revelationType: "Medinan",
      };
      const mockAyats = [
        { number: 8, numberInSurah: 1, text: "الم", page: 2, juz: 1, hizbQuarter: 1 },
      ];

      store.dispatch(uiActions.setUxMode("expert"));
      store.dispatch(uiActions.setCompactMode(true));

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(SurahHeader, {
            selectedSurah: mockSurah,
            surahs: [mockSurah],
            setSelectedSurah: vi.fn(),
            setSidebarOpen: vi.fn(),
            ayats: mockAyats,
            getLData: () => ({}),
            setLData: vi.fn(),
            surahStats: {},
            pageMode: false,
            setPageMode: vi.fn(),
            activePageCoran: null,
            setactivePageCoran: vi.fn(),
            mainAyatIdx: 0,
            learnData: {},
            lkey: (s, a) => `${s}:${a}`,
            jumpToAyatNumber: vi.fn(),
            translationLang: "fr",
            setTranslationLang: vi.fn(),
            TRANS_LABELS: { fr: "FR" },
            RECITATORS: [],
          })
        )
      );

      const header = document.getElementById("surah-header-mobile");
      expect(header.getAttribute("data-compact-mode")).toBe("true");
      const meta = header.querySelector(".m-compact-meta");
      expect(meta.textContent).toBe("286v");
    });

    it("PrononciationPage and GlossairePage reflect data-compact-mode=true when enabled", () => {
      store.dispatch(uiActions.setCompactMode(true));
      store.dispatch(uiActions.setUxMode("beginner"));

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
      expect(document.querySelector('main.main[data-compact-mode="true"]')).toBeTruthy();

      cleanup();

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            { initialEntries: ["/glossaire"] },
            React.createElement(GlossairePage)
          )
        )
      );
      expect(document.getElementById("glossaire-page").getAttribute("data-compact-mode")).toBe("true");
    });

    it("Global StyleTag CSS includes compact-mode rules for all 4 UX profiles, all pages, and mobile breakpoint", () => {
      expect(APP_GLOBAL_CSS).toContain(".app.compact-mode");
      expect(APP_GLOBAL_CSS).toContain(".header-compact-btn");
      expect(APP_GLOBAL_CSS).toContain(".app.compact-mode.ux-profile-standard");
      expect(APP_GLOBAL_CSS).toContain(".app.compact-mode.ux-profile-beginner");
      expect(APP_GLOBAL_CSS).toContain(".app.compact-mode.ux-profile-child");
      expect(APP_GLOBAL_CSS).toContain(".app.compact-mode.ux-profile-expert");
      expect(APP_GLOBAL_CSS).toContain(".app.compact-mode .pronon-page");
      expect(APP_GLOBAL_CSS).toContain(".app.compact-mode .dash-page");
      expect(APP_GLOBAL_CSS).toContain(".app.compact-mode .rev-page");
      expect(APP_GLOBAL_CSS).toContain("@media (max-width: 640px)");
    });
  });
});
