// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { store, sel, uiActions } from "../src/store.js";
import { getSimplifiedLayoutConfig } from "../src/utils/uxProfileManager.js";
import { BeginnerGuideBanner } from "../src/components/common/BeginnerGuideBanner.jsx";
import { SurahHeader } from "../src/components/common/SurahHeader.jsx";
import { PrononciationPage } from "../src/components/pages/PrononciationPage.jsx";
import { HeavyLettersGuide } from "../src/components/common/HeavyLettersGuide.jsx";

describe("Simplified UI & Progressive Disclosure for Child & Novice Modes", () => {
  beforeEach(() => {
    store.dispatch(uiActions.setUxMode("standard"));
    store.dispatch(uiActions.resetValidatedLetters());
  });

  afterEach(() => {
    cleanup();
  });

  describe("getSimplifiedLayoutConfig pure layout helper", () => {
    it("enables simplified layout flags for child and beginner modes", () => {
      ["child", "beginner"].forEach((mode) => {
        const cfg = getSimplifiedLayoutConfig(mode);
        expect(cfg.isSimplified).toBe(true);
        expect(cfg.isChild).toBe(mode === "child");
        expect(cfg.isBeginner).toBe(mode === "beginner");
        expect(cfg.showHeaderMetrics).toBe(false);
        expect(cfg.showDuplicateUxBadge).toBe(false);
        expect(cfg.showSidebarMasteryBars).toBe(false);
        expect(cfg.showLetterEncyclopediaTabs).toBe(false);
        expect(cfg.showLetterTechnicalMeta).toBe(false);
        expect(cfg.showUnvalidatedDots).toBe(false);
        expect(cfg.showHeavyCardPills).toBe(false);
        expect(cfg.compactGuideBanner).toBe(true);
      });
    });

    it("keeps full layout flags enabled for standard, expert, and fallback", () => {
      ["standard", "expert", "invalid"].forEach((mode) => {
        const cfg = getSimplifiedLayoutConfig(mode);
        expect(cfg.isSimplified).toBe(false);
        expect(cfg.showHeaderMetrics).toBe(true);
        expect(cfg.showDuplicateUxBadge).toBe(true);
        expect(cfg.showSidebarMasteryBars).toBe(true);
        expect(cfg.showLetterEncyclopediaTabs).toBe(true);
        expect(cfg.showLetterTechnicalMeta).toBe(true);
        expect(cfg.showUnvalidatedDots).toBe(false);
        expect(cfg.showHeavyCardPills).toBe(true);
        expect(cfg.compactGuideBanner).toBe(false);
      });
    });
  });

  describe("BeginnerGuideBanner compact layout", () => {
    it("renders single-line compact banner without duplicate mode switcher in child and beginner modes", () => {
      store.dispatch(uiActions.setUxMode("child"));
      const { rerender } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(BeginnerGuideBanner, { context: "quran" })
        )
      );

      const banner = document.querySelector('[data-simplified-banner="true"]');
      expect(banner).toBeTruthy();
      expect(document.getElementById("btn-open-wizard-banner").textContent).toContain("Guide");
      expect(screen.queryByText(/Changer de mode/i)).toBeNull();

      // Switch to beginner
      store.dispatch(uiActions.setUxMode("beginner"));
      rerender(
        React.createElement(
          Provider,
          { store },
          React.createElement(BeginnerGuideBanner, { context: "quran" })
        )
      );
      expect(document.getElementById("btn-open-wizard-banner").textContent).toContain("Aide");
      expect(screen.queryByText(/Changer de mode/i)).toBeNull();

      // Dismiss button works via Redux
      const closeBtn = banner.querySelector('button[aria-label="Masquer cette aide"]');
      expect(closeBtn).toBeTruthy();
      fireEvent.click(closeBtn);
      expect(sel.showBeginnerGuides(store.getState())).toBe(false);
    });

    it("renders nothing in standard or expert modes", () => {
      store.dispatch(uiActions.setUxMode("standard"));
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(BeginnerGuideBanner, { context: "quran" })
        )
      );
      expect(document.querySelector('[data-simplified-banner="true"]')).toBeNull();
    });
  });

  describe("SurahHeader simplified density", () => {
    const mockSurah = {
      number: 1,
      name: "سُورَةُ ٱلْفَاتِحَةِ",
      englishName: "Al-Fatiha",
      numberOfAyahs: 7,
      revelationType: "Meccan",
    };
    const mockAyats = [
      { number: 1, numberInSurah: 1, text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", page: 1, juz: 1, hizbQuarter: 1 },
      { number: 2, numberInSurah: 2, text: "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَالَمِينَ", page: 1, juz: 1, hizbQuarter: 1 },
    ];
    const baseProps = {
      selectedSurah: mockSurah,
      surahs: [mockSurah],
      setSelectedSurah: () => {},
      setSidebarOpen: () => {},
      ayats: mockAyats,
      getLData: () => ({}),
      setLData: () => {},
      surahStats: { 1: { mastery: 0, learned: 0 } },
      pageMode: false,
      setPageMode: () => {},
      activePageCoran: 1,
      setactivePageCoran: () => {},
      mainAyatIdx: 0,
      learnData: {},
      lkey: (s, a) => `${s}:${a}`,
      pageMeta: {},
      surahMeta: { wordCount: 29, page: 1, hizb: 1, juz: 1 },
      jumpToAyatNumber: () => {},
      translationLang: "fr",
      setTranslationLang: () => {},
      TRANS_LABELS: { fr: "FRANÇAIS" },
      RECITATORS: [],
      navigate: () => {},
    };

    it("hides Page/Hizb/Juz telemetry, mastery badge pill, and duplicate UX badge in child and beginner modes", () => {
      ["child", "beginner"].forEach((mode) => {
        store.dispatch(uiActions.setUxMode(mode));
        const { container, unmount } = render(
          React.createElement(
            Provider,
            { store },
            React.createElement(SurahHeader, baseProps)
          )
        );

        const meta = container.querySelector(".m-compact-meta");
        expect(meta).toBeTruthy();
        expect(meta.textContent).toBe("7 versets");
        expect(meta.textContent).not.toContain("P.");
        expect(meta.textContent).not.toContain("H.");
        expect(meta.textContent).not.toContain("J.");

        expect(container.querySelector(".m-compact-mastery")).toBeNull();
        expect(document.getElementById("surah-header-ux-badge")).toBeNull();
        expect(document.getElementById("surah-header-all-options-btn")).toBeTruthy();
        unmount();
      });
    });

    it("restores full metadata, mastery pill, and UX badge in standard mode", () => {
      store.dispatch(uiActions.setUxMode("standard"));
      const { container } = render(
        React.createElement(
          Provider,
          { store },
          React.createElement(SurahHeader, baseProps)
        )
      );

      const meta = container.querySelector(".m-compact-meta");
      expect(meta.textContent).toContain("7v");
      expect(meta.textContent).toContain("P.1");
      expect(container.querySelector(".m-compact-mastery")).toBeTruthy();
      expect(document.getElementById("surah-header-ux-badge")).toBeTruthy();
    });
  });

  describe("PrononciationPage simplified experience for Child & Beginner modes", () => {
    const renderPronon = () =>
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

    it("declutters filters, hides white dots and GRAVE pills, and collapses advanced sections behind #btn-pronon-toggle-advanced in beginner and child modes", () => {
      ["beginner", "child"].forEach((mode) => {
        store.dispatch(uiActions.setUxMode(mode));
        const { container, unmount } = renderPronon();

        // Top glossary button hidden in simplified mode (now inside OUTILS)
        expect(document.getElementById("btn-pronon-open-glossary")).toBeNull();

        // 4 simplified organ filters instead of 6
        const filterButtons = document.getElementById("pronon-organ-filters").querySelectorAll("button");
        expect(filterButtons).toHaveLength(4);

        // No white circle dots (⚪) and no "GRAVE" tile micro-pills
        const gridText = container.querySelector(".pronon-grid").textContent;
        expect(gridText).not.toContain("⚪");
        expect(gridText).not.toContain("GRAVE");

        // Identity meta hides Abjad & Unicode in both child and beginner
        const meta = document.getElementById("letter-identity-meta").textContent;
        expect(meta).not.toContain("Abjad :");
        expect(meta).not.toContain("U+0628");

        // Advanced technical tabs and similar-letters multi-diagram hidden initially
        expect(document.getElementById("letter-detail-section-tabs")).toBeNull();
        expect(container.querySelector(".makharij-similar-diagrams")).toBeNull();

        // Progressive disclosure toggle reveals advanced sections on demand
        const toggleBtn = document.getElementById("btn-pronon-toggle-advanced");
        expect(toggleBtn).toBeTruthy();
        expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
        fireEvent.click(toggleBtn);
        expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
        expect(document.getElementById("letter-detail-section-tabs")).toBeTruthy();

        // Clicking again hides advanced details cleanly
        fireEvent.click(toggleBtn);
        expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
        expect(document.getElementById("letter-detail-section-tabs")).toBeNull();

        unmount();
      });
    });

    it("keeps all 6 organ filters, technical meta, and detail tabs visible by default in standard mode", () => {
      store.dispatch(uiActions.setUxMode("standard"));
      renderPronon();

      expect(document.getElementById("btn-pronon-open-glossary")).toBeTruthy();
      expect(document.getElementById("pronon-organ-filters").querySelectorAll("button")).toHaveLength(6);
      expect(document.getElementById("letter-detail-section-tabs")).toBeTruthy();
      expect(document.getElementById("btn-pronon-toggle-advanced")).toBeNull();
    });
  });

  describe("HeavyLettersGuide simplified mode", () => {
    it("hides tile badges and collapses the 5 Tafkhim degrees behind a toggle when simplified", () => {
      const { container } = render(
        React.createElement(HeavyLettersGuide, {
          isChild: false,
          isSimplified: true,
        })
      );

      expect(container.textContent).not.toContain("ITBÂQ\n");
      const toggleBtn = document.getElementById("btn-heavy-toggle-degrees");
      expect(toggleBtn).toBeTruthy();
      expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByText(/Niveau 1/i)).toBeNull();

      fireEvent.click(toggleBtn);
      expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText(/Niveau 1/i)).toBeTruthy();
    });
  });
});
