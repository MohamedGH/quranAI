// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { store, sel, uiActions } from "../src/store.js";
import {
  QURAN_READING_TIERS,
  QURAN_PRIORITY_ORDER_SIMPLIFIED,
  QURAN_PRIORITY_ORDER_STANDARD,
  isPriority3DProfile,
  getQuranReadingPriorityOrder,
  resolveInitialQuranReadingTier,
  resolveStepDownQuranTier,
  resolveQuranEntryNavigation,
} from "../src/utils/uxProfileManager.js";
import { parseQuranRoute, buildQuranRoute } from "../src/utils/routeManager.js";
import {
  resolveExitToNormalModeState,
  resolveCloseFullScreenState,
  resolveBook3DStepDownNavigation,
} from "../src/utils/fullScreenNavigation.js";
import * as reciterAudio from "../src/utils/reciterAudio.js";
import { ChildUnlockQuranCelebrationModal } from "../src/components/common/ChildUnlockQuranCelebrationModal.jsx";
import { PrononciationPage } from "../src/components/pages/PrononciationPage.jsx";
import { QuranBook3DPage } from "../src/components/pages/QuranBook3DPage.jsx";
import { AyatFullScreenModal } from "../src/components/common/AyatFullScreenModal.jsx";

function LocationProbe() {
  const loc = useLocation();
  return React.createElement(
    "div",
    { "data-testid": "location-probe" },
    `${loc.pathname}${loc.search}`
  );
}

describe("3-Tier Priority Reading Cascade (Coran 3D -> Fullscreen -> Liste Ayat) for Child & Beginner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      localStorage.clear();
    } catch {}
    store.dispatch(uiActions.resetUiElementsVisibility());
    store.dispatch(uiActions.setUxMode("standard"));
    store.dispatch(uiActions.resetValidatedLetters());
    store.dispatch(uiActions.setShowChildCelebrationModal(false));

    vi.spyOn(reciterAudio, "fetchQuranPage").mockImplementation(async (pageNum) => [
      {
        number: pageNum,
        numberInSurah: 1,
        text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
        page: pageNum,
        hizb: 1,
        hizbQuarter: 1,
        surah: { number: 1, name: "سُورَةُ ٱلْفَاتِحَةِ", englishName: "Al-Faatiha" },
      },
    ]);
    vi.spyOn(reciterAudio, "fetchPageMeta").mockResolvedValue({ page: 1 });
    vi.spyOn(reciterAudio, "fetchSurahTranslation").mockResolvedValue([
      { numberInSurah: 1, text: "Au nom d'Allah, le Tout Miséricordieux." },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("Pure functional uxProfileManager priority helpers", () => {
    it("identifies child and beginner (novice) as 3D-first priority profiles", () => {
      expect(isPriority3DProfile("child")).toBe(true);
      expect(isPriority3DProfile("beginner")).toBe(true);
      expect(isPriority3DProfile("standard")).toBe(false);
      expect(isPriority3DProfile("expert")).toBe(false);
    });

    it("returns ordered priority chains per profile", () => {
      expect(getQuranReadingPriorityOrder("child")).toEqual([
        "book3d",
        "fullscreen",
        "list",
      ]);
      expect(getQuranReadingPriorityOrder("beginner")).toEqual(
        QURAN_PRIORITY_ORDER_SIMPLIFIED
      );
      expect(getQuranReadingPriorityOrder("standard")).toEqual(
        QURAN_PRIORITY_ORDER_STANDARD
      );
      expect(getQuranReadingPriorityOrder("expert")).toEqual([
        "list",
        "fullscreen",
        "book3d",
      ]);
    });

    it("resolves initial tier cleanly with child 28-letter lock guard and 3D fallback", () => {
      expect(
        resolveInitialQuranReadingTier({ uxMode: "beginner", allow3D: true })
      ).toBe(QURAN_READING_TIERS.BOOK3D);
      expect(
        resolveInitialQuranReadingTier({
          uxMode: "child",
          isQuranUnlocked: false,
          allow3D: true,
        })
      ).toBe(QURAN_READING_TIERS.LOCKED);
      expect(
        resolveInitialQuranReadingTier({
          uxMode: "child",
          isQuranUnlocked: true,
          allow3D: true,
        })
      ).toBe(QURAN_READING_TIERS.BOOK3D);
      expect(
        resolveInitialQuranReadingTier({
          uxMode: "beginner",
          allow3D: false,
        })
      ).toBe(QURAN_READING_TIERS.FULLSCREEN);
      expect(resolveInitialQuranReadingTier({ uxMode: "standard" })).toBe(
        QURAN_READING_TIERS.LIST
      );
    });

    it("steps down strictly Book3D -> Fullscreen -> List for Child & Beginner", () => {
      expect(
        resolveStepDownQuranTier({ currentTier: "book3d", uxMode: "beginner" })
      ).toBe("fullscreen");
      expect(
        resolveStepDownQuranTier({ currentTier: "fullscreen", uxMode: "beginner" })
      ).toBe("list");
      expect(
        resolveStepDownQuranTier({ currentTier: "list", uxMode: "beginner" })
      ).toBe("list");

      expect(
        resolveStepDownQuranTier({ currentTier: "book3d", uxMode: "child" })
      ).toBe("fullscreen");
      expect(
        resolveStepDownQuranTier({ currentTier: "fullscreen", uxMode: "child" })
      ).toBe("list");

      expect(
        resolveStepDownQuranTier({ currentTier: "book3d", uxMode: "standard" })
      ).toBe("list");
    });

    it("resolves Quran entry navigation across tiers and explicit views", () => {
      const beginnerDefault = resolveQuranEntryNavigation({
        uxMode: "beginner",
        isQuranUnlocked: true,
        allow3D: true,
      });
      expect(beginnerDefault.tier).toBe("book3d");
      expect(beginnerDefault.route).toBe("/quran/book3d");

      const childLocked = resolveQuranEntryNavigation({
        uxMode: "child",
        isQuranUnlocked: false,
        allow3D: true,
      });
      expect(childLocked.tier).toBe("locked");
      expect(childLocked.route).toBe("/quran");

      const beginnerNo3D = resolveQuranEntryNavigation({
        uxMode: "beginner",
        isQuranUnlocked: true,
        allow3D: false,
      });
      expect(beginnerNo3D.tier).toBe("fullscreen");
      expect(beginnerNo3D.route).toBe("/quran/1/1?view=fullscreen");
      expect(beginnerNo3D.shouldEnableFullscreen).toBe(true);

      const childStepDownList = resolveQuranEntryNavigation({
        uxMode: "child",
        isQuranUnlocked: true,
        currentTier: "list",
        surahNum: 2,
        ayatNum: 255,
      });
      expect(childStepDownList.tier).toBe("list");
      expect(childStepDownList.route).toBe("/quran/2/255?view=list");
      expect(childStepDownList.shouldDisableFullscreen).toBe(true);
    });
  });

  describe("Pure routeManager & fullScreenNavigation helpers", () => {
    it("parses and builds /quran/book3d and ?view=fullscreen|list routes", () => {
      const parsed3d = parseQuranRoute("/quran/book3d", "?ux=child");
      expect(parsed3d.activePage).toBe("quran");
      expect(parsed3d.isBook3D).toBe(true);
      expect(parsed3d.isBook2D).toBe(false);
      expect(parsed3d.uxMode).toBe("child");

      const parsedFs = parseQuranRoute("/quran/1/1", "?view=fullscreen&ux=beginner");
      expect(parsedFs.surahNum).toBe(1);
      expect(parsedFs.ayatNum).toBe(1);
      expect(parsedFs.view).toBe("fullscreen");

      expect(
        buildQuranRoute({ activePage: "quran/book3d", uxMode: "beginner" })
      ).toBe("/quran/book3d?ux=beginner");
      expect(
        buildQuranRoute({
          activePage: "quran",
          surahNum: 1,
          ayatNum: 1,
          view: "fullscreen",
        })
      ).toBe("/quran/1/1?view=fullscreen");
      expect(
        buildQuranRoute({
          activePage: "quran",
          surahNum: 18,
          ayatNum: 10,
        })
      ).toBe("/quran/18/10");
    });

    it("resolves step-down navigation when leaving 3D Quran", () => {
      const childStep = resolveBook3DStepDownNavigation({
        uxMode: "child",
        selectedAyah: { surahNum: 112, ayahNum: 2 },
      });
      expect(childStep.nextTier).toBe("fullscreen");
      expect(childStep.enableFullscreen).toBe(true);
      expect(childStep.targetRoute).toBe("/quran/112/2?view=fullscreen");

      const beginnerFallbackStep = resolveBook3DStepDownNavigation({
        uxMode: "beginner",
        selectedAyah: null,
        lastAyatBySurah: { 1: 4 },
      });
      expect(beginnerFallbackStep.nextTier).toBe("fullscreen");
      expect(beginnerFallbackStep.surahNum).toBe(1);
      expect(beginnerFallbackStep.ayatNum).toBe(4);
      expect(beginnerFallbackStep.targetRoute).toBe("/quran/1/4?view=fullscreen");

      const standardStep = resolveBook3DStepDownNavigation({
        uxMode: "standard",
        selectedAyah: null,
      });
      expect(standardStep.nextTier).toBe("list");
      expect(standardStep.enableFullscreen).toBe(false);
      expect(standardStep.targetRoute).toBe("/quran");
    });

    it("includes nextTier=list in fullscreen exit state resolvers", () => {
      expect(resolveExitToNormalModeState({ fullScreenSelectedAyat: true }).nextTier).toBe("list");
      expect(resolveCloseFullScreenState({ fullScreenSelectedAyat: true }).nextTier).toBe("list");
    });
  });

  describe("Redux store quranReadingTier transitions", () => {
    it("sets quranReadingTier=book3d for beginner & unlocked child, locked for locked child, list for standard/expert", () => {
      store.dispatch(uiActions.setUxMode("beginner"));
      expect(sel.quranReadingTier(store.getState())).toBe("book3d");
      expect(sel.fullScreenSelectedAyat(store.getState())).toBe(true);

      store.dispatch(uiActions.setUxMode("child"));
      expect(sel.quranReadingTier(store.getState())).toBe("locked");

      store.dispatch(uiActions.validateAllLetters());
      expect(sel.quranReadingTier(store.getState())).toBe("book3d");

      store.dispatch(uiActions.setUxMode("standard"));
      expect(sel.quranReadingTier(store.getState())).toBe("list");

      store.dispatch(uiActions.setUxMode("expert"));
      expect(sel.quranReadingTier(store.getState())).toBe("list");
    });

    it("steps down Book3D -> Fullscreen -> List and resets back to Book3D", () => {
      store.dispatch(uiActions.setUxMode("beginner"));
      expect(sel.quranReadingTier(store.getState())).toBe("book3d");

      store.dispatch(uiActions.stepDownQuranReadingTier());
      expect(sel.quranReadingTier(store.getState())).toBe("fullscreen");
      expect(sel.fullScreenSelectedAyat(store.getState())).toBe(true);

      store.dispatch(uiActions.stepDownQuranReadingTier());
      expect(sel.quranReadingTier(store.getState())).toBe("list");
      expect(sel.fullScreenSelectedAyat(store.getState())).toBe(false);

      store.dispatch(uiActions.resetQuranPriorityTier());
      expect(sel.quranReadingTier(store.getState())).toBe("book3d");
      expect(sel.fullScreenSelectedAyat(store.getState())).toBe(true);
    });
  });

  describe("Component Integrations: Unlock CTAs, QuranBook3DPage Step-Down & AyatFullScreenModal", () => {
    it("ChildUnlockQuranCelebrationModal opens /quran/book3d first when unlocked", () => {
      store.dispatch(uiActions.setUxMode("child"));
      store.dispatch(uiActions.validateAllLetters());
      store.dispatch(uiActions.setShowChildCelebrationModal(true));

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            { initialEntries: ["/prononciation"] },
            React.createElement(LocationProbe),
            React.createElement(ChildUnlockQuranCelebrationModal)
          )
        )
      );

      fireEvent.click(document.getElementById("btn-celebration-open-quran"));
      expect(screen.getByTestId("location-probe").textContent).toBe("/quran/book3d");
      expect(sel.quranReadingTier(store.getState())).toBe("book3d");
    });

    it("PrononciationPage quest unlock CTA opens /quran/book3d first when unlocked", () => {
      store.dispatch(uiActions.setUxMode("child"));
      store.dispatch(uiActions.validateAllLetters());
      store.dispatch(uiActions.setShowChildCelebrationModal(false));

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            { initialEntries: ["/prononciation"] },
            React.createElement(LocationProbe),
            React.createElement(PrononciationPage)
          )
        )
      );

      fireEvent.click(document.getElementById("btn-quest-go-quran"));
      expect(screen.getByTestId("location-probe").textContent).toBe("/quran/book3d");
    });

    it("QuranBook3DPage shows 'PLEIN ÉCRAN' in child & beginner and steps down to /quran/1/1?view=fullscreen", () => {
      ["beginner", "child"].forEach((mode) => {
        store.dispatch(uiActions.setUxMode(mode));
        if (mode === "child") store.dispatch(uiActions.validateAllLetters());

        render(
          React.createElement(
            Provider,
            { store },
            React.createElement(
              MemoryRouter,
              { initialEntries: ["/quran/book3d"] },
              React.createElement(LocationProbe),
              React.createElement(QuranBook3DPage, { surahs: [] })
            )
          )
        );

        const backBtn = screen.getByTestId("q3d-back-btn");
        expect(backBtn.textContent).toContain("PLEIN ÉCRAN");

        fireEvent.click(backBtn);
        expect(screen.getByTestId("location-probe").textContent).toBe(
          "/quran/1/1?view=fullscreen"
        );
        expect(sel.quranReadingTier(store.getState())).toBe("fullscreen");
        expect(sel.fullScreenSelectedAyat(store.getState())).toBe(true);
        cleanup();
      });
    });

    it("QuranBook3DPage shows 'SOURATES' in standard mode and returns to /quran", () => {
      store.dispatch(uiActions.setUxMode("standard"));

      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            { initialEntries: ["/quran/book3d"] },
            React.createElement(LocationProbe),
            React.createElement(QuranBook3DPage, { surahs: [] })
          )
        )
      );

      const backBtn = screen.getByTestId("q3d-back-btn");
      expect(backBtn.textContent).toContain("SOURATES");

      fireEvent.click(backBtn);
      expect(screen.getByTestId("location-probe").textContent).toBe("/quran");
      expect(sel.quranReadingTier(store.getState())).toBe("list");
    });

    it("AyatFullScreenModal in beginner & child shows 3D shortcut and labels exit as LISTE AYATS", () => {
      if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
        Element.prototype.scrollTo = () => {};
      }
      const surah = { number: 1, name: "الفاتحة", englishName: "Al-Faatiha", numberOfAyahs: 7 };
      const ayat = { number: 1, numberInSurah: 1, text: "بِسْمِ ٱللَّهِ" };

      ["beginner", "child"].forEach((mode) => {
        store.dispatch(uiActions.setUxMode(mode));
        if (mode === "child") store.dispatch(uiActions.validateAllLetters());
        const onExit = vi.fn();
        const onOpen3D = vi.fn();

        render(
          React.createElement(
            Provider,
            { store },
            React.createElement(AyatFullScreenModal, {
              isOpen: true,
              onClose: onExit,
              onExitToNormalMode: onExit,
              onOpenBook3D: onOpen3D,
              ayat,
              selectedSurah: surah,
              ayats: [ayat],
              translationLang: "fr",
              translationText: "Au nom d'Allah",
            })
          )
        );

        const exitBtn = document.getElementById("btn-fs-return-normal");
        expect(exitBtn).toBeTruthy();
        expect(exitBtn.textContent).toContain("LISTE AYATS");

        const book3dBtn = document.getElementById("btn-fs-open-book3d");
        expect(book3dBtn).toBeTruthy();
        fireEvent.click(book3dBtn);
        expect(onOpen3D).toHaveBeenCalledTimes(1);

        fireEvent.click(exitBtn);
        expect(onExit).toHaveBeenCalledTimes(1);
        cleanup();
      });
    });
  });
});
