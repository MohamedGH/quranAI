// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { store, sel, uiActions } from "../src/store.js";
import {
  UI_CATEGORIES,
  UI_ELEMENTS,
  UI_PRESETS,
  getDefaultUiVisibility,
  isElementVisible,
  toggleElement,
  setElement,
  setCategoryVisibility,
  setAllElementsVisibility,
  applyPreset,
  getVisibilityStats,
  getElementsByCategory,
  searchUiElements,
} from "../src/utils/uiVisibilityManager.js";
import {
  parseQuranRoute,
  buildQuranRoute,
} from "../src/utils/routeManager.js";
import { UiElementsVisibilityModal } from "../src/components/common/UiElementsVisibilityModal.jsx";
import { OptionsModal } from "../src/components/sync/OptionsModal.jsx";
import { SurahHeader } from "../src/components/common/SurahHeader.jsx";
import { BeginnerGuideBanner } from "../src/components/common/BeginnerGuideBanner.jsx";

describe("UI Visibility Manager — Granular Element Activation/Deactivation", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    store.dispatch(uiActions.resetUiElementsVisibility());
    store.dispatch(uiActions.setShowUiVisibilityModal(false));
    store.dispatch(uiActions.setUxMode("standard"));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("1. Pure Functional Architecture & Schema Validation", () => {
    it("defines 6 frozen UI categories with valid IDs and names", () => {
      expect(UI_CATEGORIES).toHaveLength(6);
      const catIds = UI_CATEGORIES.map((c) => c.id);
      expect(catIds).toEqual([
        "header",
        "surahHeader",
        "ayat",
        "player",
        "sidebar",
        "guides",
      ]);
      expect(Object.isFrozen(UI_CATEGORIES)).toBe(true);
      UI_CATEGORIES.forEach((c) => expect(Object.isFrozen(c)).toBe(true));
    });

    it("defines 32 modular UI elements across all defined categories", () => {
      expect(UI_ELEMENTS).toHaveLength(32);
      expect(Object.isFrozen(UI_ELEMENTS)).toBe(true);

      const validCatIds = new Set(UI_CATEGORIES.map((c) => c.id));
      UI_ELEMENTS.forEach((el) => {
        expect(validCatIds.has(el.category)).toBe(true);
        expect(typeof el.id).toBe("string");
        expect(typeof el.label).toBe("string");
        expect(typeof el.desc).toBe("string");
        expect(el.defaultVisible).toBe(true);
      });
    });

    it("defines 4 presets (all, zen, minimal, audioFocus) with frozen configuration", () => {
      expect(UI_PRESETS).toHaveProperty("all");
      expect(UI_PRESETS).toHaveProperty("zen");
      expect(UI_PRESETS).toHaveProperty("minimal");
      expect(UI_PRESETS).toHaveProperty("audioFocus");
      expect(Object.isFrozen(UI_PRESETS)).toBe(true);
    });

    it("getDefaultUiVisibility returns all elements set to true by default", () => {
      const def = getDefaultUiVisibility();
      expect(Object.keys(def)).toHaveLength(32);
      UI_ELEMENTS.forEach((el) => {
        expect(def[el.id]).toBe(true);
      });
    });

    it("isElementVisible safely evaluates visibility and defaults to true for undefined/null keys", () => {
      expect(isElementVisible(null, "headerLogo")).toBe(true);
      expect(isElementVisible({}, "headerLogo")).toBe(true);
      expect(isElementVisible({ headerLogo: false }, "headerLogo")).toBe(false);
      expect(isElementVisible({ headerLogo: true }, "headerLogo")).toBe(true);
      expect(isElementVisible(undefined, "unknownKey")).toBe(true);
    });

    it("toggleElement and setElement return new immutable visibility maps", () => {
      const initial = getDefaultUiVisibility();
      const updated = toggleElement(initial, "headerVoice");
      expect(updated.headerVoice).toBe(false);
      expect(initial.headerVoice).toBe(true); // immutability

      const reUpdated = toggleElement(updated, "headerVoice");
      expect(reUpdated.headerVoice).toBe(true);

      const explicitSet = setElement(initial, "ayatTranslation", false);
      expect(explicitSet.ayatTranslation).toBe(false);
      expect(initial.ayatTranslation).toBe(true);
    });

    it("setCategoryVisibility bulk toggles all items of a single category without affecting others", () => {
      const initial = getDefaultUiVisibility();
      const updated = setCategoryVisibility(initial, "header", false);

      // Header items must be false
      expect(updated.headerLogo).toBe(false);
      expect(updated.headerNav).toBe(false);
      expect(updated.headerVoice).toBe(false);
      expect(updated.headerCompact).toBe(false);
      expect(updated.headerUxBadge).toBe(false);
      expect(updated.headerToolsBtn).toBe(false);
      expect(updated.headerAccount).toBe(false);

      // SurahHeader and Ayat items must remain true
      expect(updated.surahTitle).toBe(true);
      expect(updated.ayatNumber).toBe(true);
    });

    it("setAllElementsVisibility enables or disables every single element", () => {
      const initial = getDefaultUiVisibility();
      const allFalse = setAllElementsVisibility(initial, false);
      UI_ELEMENTS.forEach((el) => {
        expect(allFalse[el.id]).toBe(false);
      });

      const allTrue = setAllElementsVisibility(allFalse, true);
      UI_ELEMENTS.forEach((el) => {
        expect(allTrue[el.id]).toBe(true);
      });
    });

    it("applyPreset sets predefined states accurately", () => {
      const zenMap = applyPreset("zen");
      expect(zenMap.surahActionsBar).toBe(false);
      expect(zenMap.ayatTranslation).toBe(false);
      expect(zenMap.ayatMastery).toBe(false);
      expect(zenMap.headerNav).toBe(false);
      expect(zenMap.headerVoice).toBe(false);
      // Essential Quran reading text remains
      expect(zenMap.surahTitle).toBe(true);
      expect(zenMap.ayatNumber).toBe(true);

      const audioMap = applyPreset("audioFocus");
      expect(audioMap.playerControls).toBe(true);
      expect(audioMap.playerSurahTitle).toBe(true);
      expect(audioMap.playerLoop).toBe(true);
      expect(audioMap.ayatPlayBtn).toBe(true);
      expect(audioMap.ayatMastery).toBe(false);
      expect(audioMap.ayatTranslation).toBe(false);
    });

    it("getVisibilityStats computes totals, visible count, and percentage accurately", () => {
      const def = getDefaultUiVisibility();
      const initialStats = getVisibilityStats(def);
      expect(initialStats.total).toBe(32);
      expect(initialStats.visible).toBe(32);
      expect(initialStats.hidden).toBe(0);
      expect(initialStats.pct).toBe(100);

      const modified = setElement(def, "headerLogo", false);
      const modStats = getVisibilityStats(modified);
      expect(modStats.visible).toBe(31);
      expect(modStats.hidden).toBe(1);
      expect(modStats.pct).toBe(97);
    });

    it("searchUiElements filters elements by label or description case-insensitively", () => {
      const tajweedResults = searchUiElements(UI_ELEMENTS, "tajwid");
      expect(tajweedResults.length).toBeGreaterThan(0);
      expect(tajweedResults.some((el) => el.id === "playerTajweedModal")).toBe(true);

      const bismillahResults = searchUiElements(UI_ELEMENTS, "Basmala");
      expect(bismillahResults.some((el) => el.id === "surahBismillah")).toBe(true);
    });
  });

  describe("2. Redux Store Management & State Persistence", () => {
    it("initializes with default visibility in store", () => {
      const state = store.getState();
      const visibility = sel.uiElementsVisibility(state);
      expect(visibility).toBeDefined();
      expect(sel.isUiElementVisible(state, "headerLogo")).toBe(true);
      expect(sel.showUiVisibilityModal(state)).toBe(false);
    });

    it("dispatches toggleUiElementVisibility and persists to localStorage", () => {
      store.dispatch(uiActions.toggleUiElementVisibility("headerLogo"));
      let state = store.getState();
      expect(sel.isUiElementVisible(state, "headerLogo")).toBe(false);

      const stored = JSON.parse(localStorage.getItem("quran_uiElementsVisibility") || "{}");
      expect(stored.headerLogo).toBe(false);

      store.dispatch(uiActions.toggleUiElementVisibility("headerLogo"));
      state = store.getState();
      expect(sel.isUiElementVisible(state, "headerLogo")).toBe(true);
    });

    it("dispatches setCategoryUiVisibility for bulk updates", () => {
      store.dispatch(uiActions.setCategoryUiVisibility({ category: "surahHeader", visible: false }));
      const state = store.getState();
      expect(sel.isUiElementVisible(state, "surahNavigation")).toBe(false);
      expect(sel.isUiElementVisible(state, "surahTitle")).toBe(false);
      expect(sel.isUiElementVisible(state, "surahMeta")).toBe(false);
      expect(sel.isUiElementVisible(state, "surahBismillah")).toBe(false);

      // Other categories remain visible
      expect(sel.isUiElementVisible(state, "headerLogo")).toBe(true);
    });

    it("dispatches applyUiVisibilityPreset and resetUiElementsVisibility", () => {
      store.dispatch(uiActions.applyUiVisibilityPreset("zen"));
      let state = store.getState();
      expect(sel.isUiElementVisible(state, "ayatTranslation")).toBe(false);
      expect(sel.isUiElementVisible(state, "headerNav")).toBe(false);

      store.dispatch(uiActions.resetUiElementsVisibility());
      state = store.getState();
      expect(sel.isUiElementVisible(state, "ayatTranslation")).toBe(true);
      expect(sel.isUiElementVisible(state, "headerNav")).toBe(true);
    });

    it("controls showUiVisibilityModal visibility flag cleanly", () => {
      expect(sel.showUiVisibilityModal(store.getState())).toBe(false);

      store.dispatch(uiActions.setShowUiVisibilityModal(true));
      expect(sel.showUiVisibilityModal(store.getState())).toBe(true);

      store.dispatch(uiActions.toggleShowUiVisibilityModal());
      expect(sel.showUiVisibilityModal(store.getState())).toBe(false);
    });
  });

  describe("3. Route Manager Integration", () => {
    it("parses ?uiPreset query param in parseQuranRoute", () => {
      const parsedZen = parseQuranRoute("/quran/1", "?uiPreset=zen");
      expect(parsedZen.uiPreset).toBe("zen");

      const parsedMinimal = parseQuranRoute("/quran/1", "?preset=minimal");
      expect(parsedMinimal.uiPreset).toBe("minimal");

      const parsedNone = parseQuranRoute("/quran/1", "");
      expect(parsedNone.uiPreset).toBeNull();
    });

    it("buildQuranRoute retains uiPreset query parameter when requested", () => {
      const route = buildQuranRoute({ surahNum: 2, ayatNum: 10, uiPreset: "zen" });
      expect(route).toContain("uiPreset=zen");
    });
  });

  describe("4. UiElementsVisibilityModal Interactive Rendering", () => {
    it("renders modal with header, categories, preset shortcuts, stats pill, and search", () => {
      const handleClose = vi.fn();
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(UiElementsVisibilityModal, {
            isOpen: true,
            onClose: handleClose,
          })
        )
      );

      expect(screen.getByRole("dialog")).toBeDefined();
      expect(screen.getByText("VISIBILITÉ DES ÉLÉMENTS")).toBeDefined();
      expect(screen.getByPlaceholderText(/Rechercher un élément/i)).toBeDefined();

      // Check category tab buttons
      expect(screen.getByText("Tous")).toBeDefined();
      expect(screen.getByText("En-tête")).toBeDefined();
      expect(screen.getByText("Sourate")).toBeDefined();
      expect(screen.getByText("Versets")).toBeDefined();
      expect(screen.getByText("Lecteur")).toBeDefined();
      expect(screen.getByText("Barre Latérale")).toBeDefined();
      expect(screen.getByText("Bannières")).toBeDefined();

      // Check preset action buttons
      expect(screen.getByText("Zen")).toBeDefined();
      expect(screen.getByText("Minimal")).toBeDefined();
      expect(screen.getByText("Audio")).toBeDefined();
      expect(screen.getByText("Tout")).toBeDefined();
    });

    it("allows toggling individual elements with switch buttons", () => {
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(UiElementsVisibilityModal, {
            isOpen: true,
            onClose: () => {},
          })
        )
      );

      const headerLogoSwitch = screen.getByTestId("switch-ui-headerLogo");
      expect(headerLogoSwitch.getAttribute("aria-checked")).toBe("true");

      fireEvent.click(headerLogoSwitch);
      expect(sel.isUiElementVisible(store.getState(), "headerLogo")).toBe(false);
      expect(headerLogoSwitch.getAttribute("aria-checked")).toBe("false");
    });

    it("applies preset buttons directly from inside the modal", () => {
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(UiElementsVisibilityModal, {
            isOpen: true,
            onClose: () => {},
          })
        )
      );

      const zenBtn = screen.getByTestId("btn-preset-zen");
      fireEvent.click(zenBtn);

      expect(sel.isUiElementVisible(store.getState(), "ayatTranslation")).toBe(false);
      expect(sel.isUiElementVisible(store.getState(), "headerNav")).toBe(false);

      const allBtn = screen.getByTestId("btn-preset-all");
      fireEvent.click(allBtn);
      expect(sel.isUiElementVisible(store.getState(), "ayatTranslation")).toBe(true);
    });

    it("filters elements by real-time search term", () => {
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(UiElementsVisibilityModal, {
            isOpen: true,
            onClose: () => {},
          })
        )
      );

      const searchInput = screen.getByPlaceholderText(/Rechercher un élément/i);
      fireEvent.change(searchInput, { target: { value: "Bismillah" } });

      expect(screen.getByText("Ligne Calligraphique de la Basmala")).toBeDefined();
      expect(screen.queryByText("Bouton Mode Compact")).toBeNull();
    });
  });

  describe("5. OptionsModal UI Customization Section", () => {
    it("renders quick preset buttons and launcher in OptionsModal", () => {
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            {},
            React.createElement(OptionsModal, {
              isOpen: true,
              onClose: () => {},
              currentUser: null,
            })
          )
        )
      );

      const presetZenBtn = document.getElementById("btn-options-preset-zen");
      expect(presetZenBtn).not.toBeNull();

      fireEvent.click(presetZenBtn);
      expect(sel.isUiElementVisible(store.getState(), "ayatTranslation")).toBe(false);

      const openCustomizerBtn = document.getElementById("btn-options-open-ui-customizer");
      expect(openCustomizerBtn).not.toBeNull();
      fireEvent.click(openCustomizerBtn);
      expect(sel.showUiVisibilityModal(store.getState())).toBe(true);
    });
  });

  describe("6. Conditional DOM Rendering in SurahHeader & BeginnerBanner", () => {
    const mockSurah = {
      number: 1,
      name: "الفاتحة",
      englishName: "Al-Fatihah",
      numberOfAyahs: 7,
      revelationType: "Meccan",
    };

    it("hides surahNavigation, surahTitle, and surahBismillah when disabled", () => {
      const { rerender } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(SurahHeader, {
            selectedSurah: mockSurah,
            surahs: [mockSurah],
            setSelectedSurah: () => {},
            setSidebarOpen: () => {},
            ayats: [{ numberInSurah: 1, text: "بسم الله" }],
            getLData: () => ({ learned: false }),
            setLData: () => {},
            surahStats: { 1: { mastery: 0 } },
            pageMode: false,
            setPageMode: () => {},
            activePageCoran: null,
            setactivePageCoran: () => {},
            mainAyatIdx: 0,
            learnData: {},
            lkey: () => "1:1",
            jumpToAyatNumber: () => {},
          })
        )
      );

      // Initially title and bismillah are visible
      expect(screen.getByText("Al-Fatihah")).toBeDefined();
      expect(screen.getByText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ")).toBeDefined();

      // Disable surahTitle and surahBismillah
      store.dispatch(uiActions.setUiElementVisibility({ id: "surahTitle", visible: false }));
      store.dispatch(uiActions.setUiElementVisibility({ id: "surahBismillah", visible: false }));

      rerender(
        React.createElement(
          Provider,
          { store },
          React.createElement(SurahHeader, {
            selectedSurah: mockSurah,
            surahs: [mockSurah],
            setSelectedSurah: () => {},
            setSidebarOpen: () => {},
            ayats: [{ numberInSurah: 1, text: "بسم الله" }],
            getLData: () => ({ learned: false }),
            setLData: () => {},
            surahStats: { 1: { mastery: 0 } },
            pageMode: false,
            setPageMode: () => {},
            activePageCoran: null,
            setactivePageCoran: () => {},
            mainAyatIdx: 0,
            learnData: {},
            lkey: () => "1:1",
            jumpToAyatNumber: () => {},
          })
        )
      );

      expect(screen.queryByText("Al-Fatihah")).toBeNull();
      expect(screen.queryByText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ")).toBeNull();
    });

    it("respects beginnerBanner visibility in BeginnerGuideBanner", () => {
      store.dispatch(uiActions.setUxMode("beginner"));
      store.dispatch(uiActions.setBeginnerGuides(true));

      const { rerender } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(BeginnerGuideBanner, { context: "quran" })
        )
      );

      expect(screen.getByRole("region", { name: "Guide débutant" })).toBeDefined();

      store.dispatch(uiActions.setUiElementVisibility({ id: "beginnerBanner", visible: false }));

      rerender(
        React.createElement(
          Provider,
          { store },
          React.createElement(BeginnerGuideBanner, { context: "quran" })
        )
      );

      expect(screen.queryByRole("region", { name: "Guide débutant" })).toBeNull();
    });
  });
});
