// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { Provider } from "react-redux";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { render, fireEvent, cleanup } from "@testing-library/react";

import {
  GLOSSARY_CATEGORIES,
  TAJWEED_GLOSSARY,
  normalizeGlossaryKey,
  getGlossaryTerm,
  searchGlossaryTerms,
  getRelatedGlossaryTerms,
} from "../src/utils/tajweedGlossary.js";
import { store, glossaryActions, uiActions, sel } from "../src/store.js";
import {
  VALID_PAGES,
  parseQuranRoute,
  buildGlossaryRoute,
  buildQuranRoute,
} from "../src/utils/routeManager.js";
import { getNavigationTabs } from "../src/utils/uxProfileManager.js";
import {
  GlossaryTermTooltip,
  GlossaryAutoText,
} from "../src/components/common/GlossaryTermTooltip.jsx";
import { GlossairePage } from "../src/components/pages/GlossairePage.jsx";

function LocationProbe() {
  const loc = useLocation();
  return React.createElement("div", { "data-testid": "location-probe" }, `${loc.pathname}${loc.search}`);
}

describe("tajweedGlossary - Pure Functional Glossary Database & Search", () => {
  it("exposes frozen categories and exhaustive frozen entries (>= 30 technical terms)", () => {
    expect(Object.isFrozen(GLOSSARY_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(TAJWEED_GLOSSARY)).toBe(true);
    expect(TAJWEED_GLOSSARY.length).toBeGreaterThanOrEqual(30);

    const requiredIds = [
      "tafkhim",
      "tarqiq",
      "istila",
      "istifal",
      "itbaq",
      "infitah",
      "makhraj",
      "jawf",
      "halq",
      "lisan",
      "shafatayn",
      "khayshum",
      "sifat",
      "hams",
      "jahr",
      "shiddah",
      "tawassut",
      "rakhawah",
      "qalqalah",
      "safir",
      "ghunnah",
      "istitalah",
      "tafashshi",
      "takrir",
      "inhiraf",
      "lin",
      "izhar",
      "idgham",
      "iqlab",
      "ikhfa",
      "shamsiyyah",
      "qamariyyah",
      "madd",
      "harakat",
      "sukun",
      "shaddah",
      "tanwin",
      "waqf",
      "muqattaat",
      "abjad",
    ];
    requiredIds.forEach((id) => {
      const entry = getGlossaryTerm(id);
      expect(entry, `Missing term ${id}`).toBeTruthy();
      expect(entry.shortDef).toBeTruthy();
      expect(entry.fullDef).toBeTruthy();
      expect(entry.childDef).toBeTruthy();
      expect(entry.arabic).toBeTruthy();
    });
  });

  it("normalizes accents, diacritics, and aliases in getGlossaryTerm", () => {
    expect(normalizeGlossaryKey("Isti‘lâ’")).toBe("istila");
    expect(getGlossaryTerm("tafkheem")?.id).toBe("tafkhim");
    expect(getGlossaryTerm("Tafkhîm")?.id).toBe("tafkhim");
    expect(getGlossaryTerm("qalqala")?.id).toBe("qalqalah");
    expect(getGlossaryTerm("ghunna")?.id).toBe("ghunnah");
    expect(getGlossaryTerm("makharij")?.id).toBe("makhraj");
    expect(getGlossaryTerm("nonexistent_xyz")).toBeNull();
  });

  it("filters glossary entries by category, French keyword, and Arabic letter", () => {
    const sifatOnly = searchGlossaryTerms("", "sifat");
    expect(sifatOnly.length).toBeGreaterThan(5);
    expect(sifatOnly.every((x) => x.category === "sifat")).toBe(true);

    const dadResults = searchGlossaryTerms("ض", "all");
    const dadIds = dadResults.map((x) => x.id);
    expect(dadIds).toContain("istitalah");
    expect(dadIds).toContain("itbaq");
    expect(dadIds).toContain("tafkhim");

    const related = getRelatedGlossaryTerms("tafkhim");
    expect(related.map((r) => r.id)).toContain("tarqiq");
    expect(related.map((r) => r.id)).toContain("istila");
  });
});

describe("Redux Glossary Slice, Route Manager & UX Profile Navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch(glossaryActions.clearFilters());
    store.dispatch(uiActions.setUxMode("standard"));
  });

  it("manages searchQuery, category, activeTermId, and deduplicated recentTermIds in Redux", () => {
    store.dispatch(glossaryActions.setSearchQuery("qalqalah"));
    store.dispatch(glossaryActions.setCategory("sifat"));
    store.dispatch(glossaryActions.setActiveTermId("qalqalah"));
    store.dispatch(glossaryActions.setActiveTermId("tafkhim"));
    store.dispatch(glossaryActions.setActiveTermId("qalqalah"));

    const state = store.getState();
    expect(sel.glossaryQuery(state)).toBe("qalqalah");
    expect(sel.glossaryCategory(state)).toBe("sifat");
    expect(sel.glossaryActiveTermId(state)).toBe("qalqalah");
    expect(sel.glossaryRecentIds(state)[0]).toBe("qalqalah");
    expect(sel.glossaryRecentIds(state)[1]).toBe("tafkhim");
    expect(new Set(sel.glossaryRecentIds(state)).size).toBe(sel.glossaryRecentIds(state).length);

    store.dispatch(glossaryActions.clearFilters());
    expect(sel.glossaryQuery(store.getState())).toBe("");
    expect(sel.glossaryCategory(store.getState())).toBe("all");
  });

  it("parses and builds /glossaire/:termId routes cleanly via routeManager", () => {
    expect(VALID_PAGES).toContain("glossaire");

    const parsed = parseQuranRoute("/glossaire/tafkhim", "?cat=tafkhim&ux=expert");
    expect(parsed.activePage).toBe("glossaire");
    expect(parsed.glossaryTermId).toBe("tafkhim");
    expect(parsed.glossaryCategory).toBe("tafkhim");
    expect(parsed.uxMode).toBe("expert");

    expect(buildGlossaryRoute("qalqalah", { category: "sifat", uxMode: "standard" })).toBe(
      "/glossaire/qalqalah?cat=sifat&ux=standard"
    );
    expect(buildQuranRoute({ activePage: "glossaire", glossaryTermId: "tarqiq" })).toBe("/glossaire/tarqiq");
  });

  it("includes glossaire tab in standard and expert UX profiles while keeping simplified modes streamlined", () => {
    expect(getNavigationTabs("standard").some((t) => t.id === "glossaire")).toBe(true);
    expect(getNavigationTabs("expert").some((t) => t.id === "glossaire")).toBe(true);
    expect(getNavigationTabs("child")).toHaveLength(3);
    expect(getNavigationTabs("beginner")).toHaveLength(4);
  });
});

describe("GlossaryTermTooltip & GlossaryAutoText Interactive Infobulles", () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch(uiActions.setUxMode("standard"));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders safely even without Redux Provider or Router, and toggles infobulle on click/Escape", () => {
    render(React.createElement(GlossaryTermTooltip, { termId: "tafkhim" }, "Tafkhîm"));
    const trigger = document.querySelector('[data-glossary-term="tafkhim"]');
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toBe("Tafkhîm");

    fireEvent.click(trigger);
    const dialog = document.getElementById("glossary-tooltip-tafkhim");
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain("تَفْخِيم");
    expect(dialog.textContent).toContain("Épaississement");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.getElementById("glossary-tooltip-tafkhim")).toBeNull();
  });

  it("adapts definition in Child Mode and navigates to /glossaire/:termId from tooltip CTA", () => {
    render(
      React.createElement(
        Provider,
        { store },
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/prononciation"] },
          React.createElement(
            React.Fragment,
            null,
            React.createElement(GlossaryTermTooltip, { termId: "tarqiq", isChild: true }, "Tarqîq"),
            React.createElement(LocationProbe)
          )
        )
      )
    );

    const trigger = document.querySelector('[data-glossary-term="tarqiq"]');
    fireEvent.click(trigger);

    const dialog = document.getElementById("glossary-tooltip-tarqiq");
    expect(dialog.textContent).toContain("voix FINE");

    const goBtn = dialog.querySelector(".btn-open-glossary-from-tooltip");
    fireEvent.click(goBtn);

    const probe = document.querySelector('[data-testid="location-probe"]');
    expect(probe.textContent).toBe("/glossaire/tarqiq");
    expect(sel.glossaryActiveTermId(store.getState())).toBe("tarqiq");
  });

  it("auto-annotates technical terms inside strings using GlossaryAutoText", () => {
    const { container } = render(
      React.createElement(GlossaryAutoText, {
        text: "Contraste entre Tafkhîm et Tarqîq avec Qalqalah.",
      })
    );
    expect(container.querySelector('[data-glossary-term="tafkhim"]')).toBeTruthy();
    expect(container.querySelector('[data-glossary-term="tarqiq"]')).toBeTruthy();
    expect(container.querySelector('[data-glossary-term="qalqalah"]')).toBeTruthy();
  });
});

describe("GlossairePage Dedicated View", () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch(glossaryActions.clearFilters());
    store.dispatch(uiActions.setUxMode("standard"));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads deep-linked term from URL, filters by search & category, and switches via related terms", () => {
    const { container } = render(
      React.createElement(
        Provider,
        { store },
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/glossaire/itbaq"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/glossaire/:termId?",
              element: React.createElement(GlossairePage),
            })
          )
        )
      )
    );

    expect(document.getElementById("glossary-detail-title").textContent).toBe("Itbâq");

    // Search for Qalqalah
    const searchInput = document.getElementById("glossary-search-input");
    fireEvent.change(searchInput, { target: { value: "qalqalah" } });
    const cards = container.querySelectorAll(".glossary-term-card");
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(cards[0].getAttribute("data-term-id")).toBe("qalqalah");

    // Empty state + reset
    fireEvent.change(searchInput, { target: { value: "zzzz_inexistant" } });
    expect(document.getElementById("glossary-empty-state")).toBeTruthy();
    fireEvent.click(document.getElementById("btn-glossary-clear-filters"));
    expect(container.querySelectorAll(".glossary-term-card").length).toBeGreaterThanOrEqual(30);

    // Filter by category "sifat"
    fireEvent.click(document.getElementById("btn-glossary-cat-sifat"));
    expect(sel.glossaryCategory(store.getState())).toBe("sifat");
    expect(container.querySelector('.glossary-term-card[data-term-id="qalqalah"]')).toBeTruthy();
    expect(container.querySelector('.glossary-term-card[data-term-id="tafkhim"]')).toBeNull();
  });

  it("protects speech synthesis playback with errorManager inside GlossairePage", () => {
    const originalSpeech = window.speechSynthesis;
    const originalUtterance = globalThis.SpeechSynthesisUtterance;

    globalThis.SpeechSynthesisUtterance = function MockUtt(txt) {
      this.text = txt;
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: vi.fn(() => {
          throw new Error("Audio synthesis blocked");
        }),
      },
    });

    render(
      React.createElement(
        Provider,
        { store },
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/glossaire/tafkhim"] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/glossaire/:termId?",
              element: React.createElement(GlossairePage),
            })
          )
        )
      )
    );

    const speakBtn = document.getElementById("btn-glossary-detail-speak");
    fireEvent.click(speakBtn);

    const err = store.getState().errors.lastError;
    expect(err).toBeTruthy();
    expect(err.code).toBe("AUDIO_PLAYBACK_ERROR");

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: originalSpeech,
    });
    globalThis.SpeechSynthesisUtterance = originalUtterance;
  });
});
