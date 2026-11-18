// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { store, sel, uiActions } from "../src/store.js";
import {
  UI_ELEMENTS,
  UI_ELEMENTS_BY_ID,
  getDefaultUiVisibility,
  getElementMeta,
  getShortElementLabel,
  getElementSlotState,
} from "../src/utils/uiVisibilityManager.js";
import { parseQuranRoute, buildQuranRoute } from "../src/utils/routeManager.js";
import { EditableUiSlot } from "../src/components/common/EditableUiSlot.jsx";
import { UiEditToolbar } from "../src/components/common/UiEditToolbar.jsx";
import { UiElementsVisibilityModal } from "../src/components/common/UiElementsVisibilityModal.jsx";
import { HeaderToolsModal } from "../src/components/common/HeaderToolsModal.jsx";
import { OptionsModal } from "../src/components/sync/OptionsModal.jsx";
import { SurahAllOptionsModal } from "../src/components/common/SurahAllOptionsModal.jsx";
import { SurahHeader } from "../src/components/common/SurahHeader.jsx";
import { BeginnerGuideBanner } from "../src/components/common/BeginnerGuideBanner.jsx";

describe("Direct Inline UI Editing Mode (+ / − on Live UI Canvas)", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {}
    store.dispatch(uiActions.resetUiElementsVisibility());
    store.dispatch(uiActions.setShowUiVisibilityModal(false));
    store.dispatch(uiActions.setUiEditMode(false));
    store.dispatch(uiActions.setUxMode("standard"));
    store.dispatch(uiActions.setCompactMode(false));
    store.dispatch(uiActions.setShowBeginnerGuides(true));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("1. Pure Functional Helpers (uiVisibilityManager)", () => {
    it("exposes frozen UI_ELEMENTS_BY_ID containing all 32 elements", () => {
      expect(Object.isFrozen(UI_ELEMENTS_BY_ID)).toBe(true);
      expect(Object.keys(UI_ELEMENTS_BY_ID)).toHaveLength(UI_ELEMENTS.length);
      expect(getElementMeta("surahBismillah")?.category).toBe("surahHeader");
      expect(getElementMeta("unknownInvalidId")).toBeNull();
      expect(getElementMeta(null)).toBeNull();
    });

    it("getShortElementLabel returns concise labels for every registered UI element", () => {
      UI_ELEMENTS.forEach((el) => {
        const lbl = getShortElementLabel(el.id);
        expect(typeof lbl).toBe("string");
        expect(lbl.length).toBeGreaterThan(0);
      });
      expect(getShortElementLabel("headerLogo")).toBe("Logo");
      expect(getShortElementLabel("")).toBe("");
    });

    it("getElementSlotState resolves normal vs edit mode states deterministically", () => {
      const def = getDefaultUiVisibility();
      const withHiddenLogo = { ...def, headerLogo: false };

      // Normal mode, visible
      const normalVis = getElementSlotState(def, "headerLogo", false, true);
      expect(normalVis.shouldRenderContent).toBe(true);
      expect(normalVis.shouldRenderGhost).toBe(false);
      expect(normalVis.showRemoveControl).toBe(false);

      // Normal mode, hidden
      const normalHidden = getElementSlotState(withHiddenLogo, "headerLogo", false, true);
      expect(normalHidden.shouldRenderContent).toBe(false);
      expect(normalHidden.shouldRenderGhost).toBe(false);
      expect(normalHidden.showRemoveControl).toBe(false);

      // Edit mode, visible -> content + remove button
      const editVis = getElementSlotState(def, "headerLogo", true, true);
      expect(editVis.shouldRenderContent).toBe(true);
      expect(editVis.shouldRenderGhost).toBe(false);
      expect(editVis.showRemoveControl).toBe(true);

      // Edit mode, hidden, placeholder allowed -> ghost add button
      const editGhost = getElementSlotState(withHiddenLogo, "headerLogo", true, true);
      expect(editGhost.shouldRenderContent).toBe(false);
      expect(editGhost.shouldRenderGhost).toBe(true);
      expect(editGhost.showRemoveControl).toBe(false);

      // Edit mode, hidden, placeholder suppressed -> nothing rendered
      const editSuppressed = getElementSlotState(withHiddenLogo, "headerLogo", true, false);
      expect(editSuppressed.shouldRenderContent).toBe(false);
      expect(editSuppressed.shouldRenderGhost).toBe(false);

      // Invalid ID fallback without crash
      const fallback = getElementSlotState(def, "", true, true);
      expect(fallback.shouldRenderContent).toBe(true);
    });
  });

  describe("2. Redux State & Route Manager Integration", () => {
    it("toggles and sets uiEditMode cleanly in Redux store", () => {
      expect(sel.uiEditMode(store.getState())).toBe(false);
      store.dispatch(uiActions.setUiEditMode(true));
      expect(sel.uiEditMode(store.getState())).toBe(true);
      store.dispatch(uiActions.toggleUiEditMode());
      expect(sel.uiEditMode(store.getState())).toBe(false);
      store.dispatch(uiActions.toggleUiEditMode());
      expect(sel.uiEditMode(store.getState())).toBe(true);
    });

    it("parses and builds ?uiEdit=1 in routeManager", () => {
      expect(parseQuranRoute("/quran/2", "?uiEdit=1").uiEditMode).toBe(true);
      expect(parseQuranRoute("/quran/2", "?uiEdit=0").uiEditMode).toBe(false);
      expect(parseQuranRoute("/quran/2", "").uiEditMode).toBeNull();
      expect(buildQuranRoute({ surahNum: 2, uiEditMode: true })).toBe("/quran/2?uiEdit=1");
      expect(buildQuranRoute({ surahNum: 2, uiEditMode: false })).toBe("/quran/2");
    });
  });

  describe("3. EditableUiSlot Component Behavior", () => {
    it("renders children with ZERO wrapper DOM elements when uiEditMode is false", () => {
      const { container, rerender } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            EditableUiSlot,
            { elementId: "headerLogo", inline: true },
            React.createElement("span", { id: "raw-child" }, "QUR'AN")
          )
        )
      );

      expect(container.querySelector("#raw-child")).toBeTruthy();
      expect(container.querySelector(".ui-edit-slot")).toBeNull();
      expect(container.querySelector(".ui-edit-remove-btn")).toBeNull();
      expect(container.querySelector(".ui-edit-add-ghost")).toBeNull();

      // When hidden in normal mode, returns null
      store.dispatch(uiActions.setUiElementVisibility({ id: "headerLogo", visible: false }));
      rerender(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            EditableUiSlot,
            { elementId: "headerLogo", inline: true },
            React.createElement("span", { id: "raw-child" }, "QUR'AN")
          )
        )
      );
      expect(container.querySelector("#raw-child")).toBeNull();
      expect(container.querySelector(".ui-edit-add-ghost")).toBeNull();
    });

    it("allows clicking − to hide and clicking + ghost to re-add directly in-place without bubbling to parent", () => {
      const parentClickSpy = vi.fn();
      store.dispatch(uiActions.setUiEditMode(true));

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            "div",
            { onClick: parentClickSpy },
            React.createElement(
              EditableUiSlot,
              { elementId: "headerLogo", inline: true },
              React.createElement("span", { "data-testid": "logo-inner" }, "QUR'AN")
            )
          )
        )
      );

      // Visible with remove (−) button
      expect(document.querySelector('[data-testid="logo-inner"]')).toBeTruthy();
      const removeBtn = document.querySelector('[data-testid="ui-edit-remove-headerLogo"]');
      expect(removeBtn).toBeTruthy();

      fireEvent.click(removeBtn);
      expect(parentClickSpy).not.toHaveBeenCalled();
      expect(sel.isUiElementVisible(store.getState(), "headerLogo")).toBe(false);
      expect(document.querySelector('[data-testid="logo-inner"]')).toBeNull();

      // Ghost add (+) button appears right in place
      const addGhost = document.querySelector('[data-testid="ui-edit-add-headerLogo"]');
      expect(addGhost).toBeTruthy();
      expect(addGhost.textContent).toContain("+");
      expect(addGhost.textContent).toContain("Logo");

      fireEvent.click(addGhost);
      expect(parentClickSpy).not.toHaveBeenCalled();
      expect(sel.isUiElementVisible(store.getState(), "headerLogo")).toBe(true);
      expect(document.querySelector('[data-testid="logo-inner"]')).toBeTruthy();
    });

    it("respects condition={false} and showPlaceholder={false}", () => {
      store.dispatch(uiActions.setUiEditMode(true));
      store.dispatch(uiActions.setUiElementVisibility({ id: "ayatPageBadge", visible: false }));

      const { container } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            "div",
            null,
            React.createElement(
              EditableUiSlot,
              { elementId: "surahBismillah", condition: false, inline: false },
              React.createElement("div", null, "Basmala")
            ),
            React.createElement(
              EditableUiSlot,
              { elementId: "ayatPageBadge", inline: true, showPlaceholder: false },
              React.createElement("span", null, "P.1")
            )
          )
        )
      );

      expect(container.querySelector('[data-testid="ui-edit-add-surahBismillah"]')).toBeNull();
      expect(container.querySelector('[data-testid="ui-edit-add-ayatPageBadge"]')).toBeNull();
    });
  });

  describe("4. UiEditToolbar Floating Controls & Escape Exit", () => {
    it("is hidden when uiEditMode is false and shows live stats, presets, show-all, list modal, and Terminer when active", () => {
      const { rerender } = render(
        React.createElement(Provider, { store }, React.createElement(UiEditToolbar))
      );
      expect(document.querySelector('[data-testid="ui-edit-toolbar"]')).toBeNull();

      store.dispatch(uiActions.setUiEditMode(true));
      rerender(React.createElement(Provider, { store }, React.createElement(UiEditToolbar)));

      const toolbar = document.querySelector('[data-testid="ui-edit-toolbar"]');
      expect(toolbar).toBeTruthy();
      expect(document.querySelector('[data-testid="ui-edit-active-count"]').textContent).toBe("32/32 actifs");

      // Click Zen preset
      fireEvent.click(document.getElementById("btn-ui-edit-preset-zen"));
      expect(document.querySelector('[data-testid="ui-edit-active-count"]').textContent).not.toBe("32/32 actifs");

      // Click + Tout
      fireEvent.click(document.getElementById("btn-ui-edit-show-all"));
      expect(document.querySelector('[data-testid="ui-edit-active-count"]').textContent).toBe("32/32 actifs");

      // Click Liste
      fireEvent.click(document.getElementById("btn-ui-edit-open-modal"));
      expect(sel.showUiVisibilityModal(store.getState())).toBe(true);

      // Click Terminer
      fireEvent.click(document.getElementById("btn-ui-edit-done"));
      expect(sel.uiEditMode(store.getState())).toBe(false);
    });

    it("exits uiEditMode when pressing Escape", () => {
      store.dispatch(uiActions.setUiEditMode(true));
      render(React.createElement(Provider, { store }, React.createElement(UiEditToolbar)));
      expect(sel.uiEditMode(store.getState())).toBe(true);
      fireEvent.keyDown(window, { key: "Escape" });
      expect(sel.uiEditMode(store.getState())).toBe(false);
    });
  });

  describe("5. Integration in SurahHeader, BeginnerGuideBanner, and Modal Launchers", () => {
    const mockSurah = {
      number: 1,
      name: "سُورَةُ ٱلْفَاتِحَةِ",
      englishName: "Al-Fatiha",
      numberOfAyahs: 7,
      revelationType: "Meccan",
    };
    const mockAyats = [
      { number: 1, numberInSurah: 1, text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", page: 1, juz: 1, hizbQuarter: 1 },
    ];
    const surahProps = {
      selectedSurah: mockSurah,
      surahs: [mockSurah],
      setSelectedSurah: () => {},
      setSidebarOpen: () => {},
      ayats: mockAyats,
      getLData: () => ({}),
      setLData: () => {},
      surahStats: {},
      pageMode: false,
      setPageMode: () => {},
      activePageCoran: null,
      setactivePageCoran: () => {},
      mainAyatIdx: 0,
      learnData: {},
      lkey: (s, a) => `${s}:${a}`,
      pageMeta: {},
      surahMeta: {},
      jumpToAyatNumber: () => {},
      showQalqala: false,
      toggleQalqala: () => {},
      showMadd: false,
      toggleMadd: () => {},
      showIzhar: false,
      toggleIzhar: () => {},
      showIdgham: false,
      toggleIdgham: () => {},
      showIkhfa: false,
      toggleIkhfa: () => {},
      showIqlab: false,
      toggleIqlab: () => {},
      showGhunnah: false,
      toggleGhunnah: () => {},
      showTajweedTone: false,
      toggleTajweedTone: () => {},
      translationLang: "",
      setTranslationLang: () => {},
      showWordButtons: false,
      setShowWordButtons: () => {},
      showPartColors: false,
      setShowPartColors: () => {},
      announceNum: false,
      toggleAnnounceNum: () => {},
      showParts: false,
      toggleShowParts: () => {},
      spellCheck: false,
      toggleSpellCheck: () => {},
      showTsBar: false,
      setShowTsBar: () => {},
    };

    it("enables direct in-place remove (−) and add (+) inside SurahHeader", () => {
      store.dispatch(uiActions.setUiEditMode(true));
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(SurahHeader, surahProps)
          )
        )
      );

      // Remove Bismillah directly in SurahHeader
      expect(document.querySelector(".m-compact-bismillah-bar")).toBeTruthy();
      fireEvent.click(document.querySelector('[data-testid="ui-edit-remove-surahBismillah"]'));
      expect(document.querySelector(".m-compact-bismillah-bar")).toBeNull();
      expect(sel.isUiElementVisible(store.getState(), "surahBismillah")).toBe(false);

      // Ghost placeholder appears in place and re-adds Bismillah on click
      const addBism = document.querySelector('[data-testid="ui-edit-add-surahBismillah"]');
      expect(addBism).toBeTruthy();
      fireEvent.click(addBism);
      expect(document.querySelector(".m-compact-bismillah-bar")).toBeTruthy();
      expect(sel.isUiElementVisible(store.getState(), "surahBismillah")).toBe(true);
    });

    it("enables direct remove (−) and add (+) in BeginnerGuideBanner", () => {
      store.dispatch(uiActions.setUxMode("beginner"));
      store.dispatch(uiActions.setUiEditMode(true));

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(BeginnerGuideBanner, { context: "quran" })
        )
      );

      expect(document.querySelector('[data-simplified-banner="true"]')).toBeTruthy();
      fireEvent.click(document.querySelector('[data-testid="ui-edit-remove-beginnerBanner"]'));
      expect(document.querySelector('[data-simplified-banner="true"]')).toBeNull();

      fireEvent.click(document.querySelector('[data-testid="ui-edit-add-beginnerBanner"]'));
      expect(document.querySelector('[data-simplified-banner="true"]')).toBeTruthy();
    });

    it("provides direct edit mode launch buttons in UiElementsVisibilityModal, HeaderToolsModal, OptionsModal, and SurahAllOptionsModal", () => {
      const onCloseSpy = vi.fn();

      // 1. UiElementsVisibilityModal
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(UiElementsVisibilityModal, { isOpen: true, onClose: onCloseSpy })
        )
      );
      fireEvent.click(document.getElementById("btn-ui-direct-edit"));
      expect(sel.uiEditMode(store.getState())).toBe(true);
      expect(onCloseSpy).toHaveBeenCalledTimes(1);
      cleanup();

      // Reset & test HeaderToolsModal
      store.dispatch(uiActions.setUiEditMode(false));
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            null,
            React.createElement(HeaderToolsModal, { isOpen: true, onClose: onCloseSpy, initialTab: "tools" })
          )
        )
      );
      fireEvent.click(document.getElementById("btn-header-tools-ui-direct-edit"));
      expect(sel.uiEditMode(store.getState())).toBe(true);
      cleanup();

      // Reset & test OptionsModal
      store.dispatch(uiActions.setUiEditMode(false));
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(OptionsModal, { onClose: onCloseSpy })
        )
      );
      fireEvent.click(document.getElementById("options-tab-settings"));
      fireEvent.click(document.getElementById("btn-options-ui-direct-edit"));
      expect(sel.uiEditMode(store.getState())).toBe(true);
      cleanup();

      // Reset & test SurahAllOptionsModal (tab display)
      store.dispatch(uiActions.setUiEditMode(false));
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(SurahAllOptionsModal, {
            isOpen: true,
            onClose: onCloseSpy,
            initialTab: "display",
            selectedSurah: mockSurah,
            totalAyas: 7,
          })
        )
      );
      fireEvent.click(document.getElementById("btn-surah-options-ui-direct-edit"));
      expect(sel.uiEditMode(store.getState())).toBe(true);
    });
  });
});
