// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { render, fireEvent, cleanup } from "@testing-library/react";

import {
  MAKHRAJ_NEIGHBOR_LINKS,
  ANATOMICAL_ZONES,
  getZoneById,
  computeAnatomicalDistance,
  buildLetterDifferenceNote,
  getRelatedArticulationLetters,
} from "../src/utils/makharijData.js";
import { store, uiActions, sel } from "../src/store.js";
import { MakharijSimilarLettersDiagrams } from "../src/components/common/MakharijSimilarLettersDiagrams.jsx";
import { PrononciationPage } from "../src/components/pages/PrononciationPage.jsx";

describe("Makharij Similar Letters Logic (makharijData.js)", () => {
  it("provides frozen neighbor zone links and valid Euclidean anatomical distances", () => {
    expect(Object.isFrozen(MAKHRAJ_NEIGHBOR_LINKS)).toBe(true);
    Object.entries(MAKHRAJ_NEIGHBOR_LINKS).forEach(([zoneId, neighbors]) => {
      expect(getZoneById(zoneId)).toBeTruthy();
      expect(Array.isArray(neighbors)).toBe(true);
      neighbors.forEach((nId) => {
        expect(getZoneById(nId)).toBeTruthy();
      });
    });

    const dSame = computeAnatomicalDistance(ANATOMICAL_ZONES.THROAT_DEEP, ANATOMICAL_ZONES.THROAT_DEEP);
    const dDiff = computeAnatomicalDistance(ANATOMICAL_ZONES.THROAT_DEEP, ANATOMICAL_ZONES.LIPS_BILABIAL);
    expect(dSame).toBe(0);
    expect(dDiff).toBeGreaterThan(100);
    expect(computeAnatomicalDistance(null, ANATOMICAL_ZONES.LIPS_BILABIAL)).toBe(999);
  });

  it("groups exact same-Makhraj letters and nearby letters for ت (Ta, Dal + alveolar neighbors)", () => {
    const res = getRelatedArticulationLetters("ت");
    expect(res).toBeTruthy();
    expect(res.targetLetter).toBe("ت");
    expect(res.targetPosture.isTafkhim).toBe(false);

    const sameLetters = res.sameZone.map((x) => x.letter);
    expect(sameLetters).toContain("ط");
    expect(sameLetters).toContain("د");

    const emphaticTa = res.sameZone.find((x) => x.letter === "ط");
    expect(emphaticTa.posture.isTafkhim).toBe(true);
    expect(emphaticTa.posture.isItbaq).toBe(true);
    expect(emphaticTa.diffNote).toContain("Tafkhîm");

    const nearbyLetters = res.nearbyZones.map((x) => x.letter);
    expect(nearbyLetters.length).toBeGreaterThan(0);
    expect(res.items.length).toBe(res.sameZone.length + res.nearbyZones.length);
  });

  it("pairs أ and ء consistently with ه in throat_deep, and handles shared groups (ع/ح, خ/غ, س/ص/ز, ب/م/و)", () => {
    const hamzaRes = getRelatedArticulationLetters("ء");
    expect(hamzaRes.targetLetter).toBe("أ");
    expect(hamzaRes.sameZone.map((x) => x.letter)).toContain("ه");

    expect(getRelatedArticulationLetters("ع").sameZone.map((x) => x.letter)).toContain("ح");
    expect(getRelatedArticulationLetters("خ").sameZone.map((x) => x.letter)).toContain("غ");

    const sinSame = getRelatedArticulationLetters("س").sameZone.map((x) => x.letter);
    expect(sinSame).toContain("ص");
    expect(sinSame).toContain("ز");

    const baSame = getRelatedArticulationLetters("ب").sameZone.map((x) => x.letter);
    expect(baSame).toContain("م");
    expect(baSame).toContain("و");
  });

  it("returns empty sameZone and rich nearbyZones for unique-Makhraj letters (ق, ك, ض, ل, ف)", () => {
    ["ق", "ك", "ض", "ل", "ف"].forEach((ltr) => {
      const res = getRelatedArticulationLetters(ltr, { maxNearby: 6 });
      expect(res.sameZone).toHaveLength(0);
      expect(res.nearbyZones.length).toBeGreaterThan(0);
    });

    const qafNearby = getRelatedArticulationLetters("ق").nearbyZones.map((x) => x.letter);
    expect(qafNearby).toContain("ك");
    expect(qafNearby).toContain("خ");
    expect(qafNearby).toContain("غ");

    // Dual-zone nasal/labial inclusion for ن & م & ا
    const nunNearby = getRelatedArticulationLetters("ن").nearbyZones.map((x) => x.letter);
    expect(nunNearby).toContain("م");
  });

  it("adapts diffNote and relationLabel cleanly for Child Mode (isChild=true)", () => {
    const adultRes = getRelatedArticulationLetters("ت", { isChild: false });
    const childRes = getRelatedArticulationLetters("ت", { isChild: true });
    expect(childRes.sameZone[0].relationLabel).toContain("Même maison");
    expect(adultRes.sameZone[0].relationLabel).toContain("Même makhraj");

    const taEmphaticChild = childRes.sameZone.find((x) => x.letter === "ط");
    expect(taEmphaticChild.diffNote).toContain("voix forte");

    expect(buildLetterDifferenceNote(null, null, "nearby", false)).toBe("");
    const nearbyNote = adultRes.nearbyZones[0]?.diffNote || "";
    expect(nearbyNote.length).toBeGreaterThan(5);
  });

  it("handles unknown characters gracefully without throwing", () => {
    const unknown = getRelatedArticulationLetters("?");
    expect(unknown.targetLetter).toBe("أ");
  });
});

describe("Redux State Manager - similarLettersFilter", () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch(uiActions.setSimilarLettersFilter("all"));
  });

  it("updates similarLettersFilter, persists to localStorage, and sanitizes invalid values", () => {
    expect(sel.similarLettersFilter(store.getState())).toBe("all");

    store.dispatch(uiActions.setSimilarLettersFilter("same"));
    expect(sel.similarLettersFilter(store.getState())).toBe("same");
    expect(JSON.parse(localStorage.getItem("quran_similarLettersFilter"))).toBe("same");

    store.dispatch(uiActions.setSimilarLettersFilter("nearby"));
    expect(sel.similarLettersFilter(store.getState())).toBe("nearby");

    store.dispatch(uiActions.setSimilarLettersFilter("invalid_mode"));
    expect(sel.similarLettersFilter(store.getState())).toBe("all");
  });
});

describe("MakharijSimilarLettersDiagrams Component (1 dedicated SVG per letter)", () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch(uiActions.setSimilarLettersFilter("all"));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders one individual anatomical SVG per letter card with unique SVG gradient IDs", () => {
    const { container } = render(
      React.createElement(
        Provider,
        { store },
        React.createElement(MakharijSimilarLettersDiagrams, {
          activeLetter: "ت",
          isChild: false,
        })
      )
    );

    const cards = container.querySelectorAll(".similar-letter-diagram-card");
    const svgs = container.querySelectorAll("svg.mini-makhraj-svg");
    expect(cards.length).toBeGreaterThanOrEqual(4); // ت + ط + د + nearby
    expect(svgs.length).toBe(cards.length);

    // Every SVG has unique linearGradient & radialGradient IDs (no duplicate IDs across multiple SVGs)
    const gradientIds = Array.from(
      container.querySelectorAll("svg.mini-makhraj-svg linearGradient, svg.mini-makhraj-svg radialGradient")
    ).map((el) => el.getAttribute("id"));
    expect(gradientIds.length).toBe(svgs.length * 2);
    expect(new Set(gradientIds).size).toBe(gradientIds.length);

    // Verify Tafkhim / Itbaq vs Tarqiq posture per card
    const taCard = container.querySelector('.similar-letter-diagram-card[data-letter="ط"]');
    expect(taCard).toBeTruthy();
    expect(taCard.querySelector("svg.mini-makhraj-svg").getAttribute("data-tafkhim")).toBe("true");
    expect(taCard.querySelector("svg.mini-makhraj-svg").getAttribute("data-itbaq")).toBe("true");

    const dalCard = container.querySelector('.similar-letter-diagram-card[data-letter="د"]');
    expect(dalCard).toBeTruthy();
    expect(dalCard.querySelector("svg.mini-makhraj-svg").getAttribute("data-tafkhim")).toBe("false");

    // Nearby letters display a shift vector line from the reference Makhraj to their own Makhraj
    const nearbyCards = container.querySelectorAll('.similar-letter-diagram-card[data-relation="nearby"]');
    expect(nearbyCards.length).toBeGreaterThan(0);
    expect(nearbyCards[0].querySelector("line")).toBeTruthy();
  });

  it("filters between 'all', 'same', and 'nearby' and shows unique-Makhraj notice when 'same' is empty", () => {
    const { container } = render(
      React.createElement(
        Provider,
        { store },
        React.createElement(MakharijSimilarLettersDiagrams, {
          activeLetter: "ق",
          isChild: false,
        })
      )
    );

    fireEvent.click(document.getElementById("btn-similar-filter-same"));
    expect(sel.similarLettersFilter(store.getState())).toBe("same");
    expect(document.getElementById("no-exact-same-makhraj-note")).toBeTruthy();
    expect(container.querySelectorAll(".similar-letter-diagram-card")).toHaveLength(1); // Only reference ق

    fireEvent.click(document.getElementById("btn-similar-filter-nearby"));
    expect(sel.similarLettersFilter(store.getState())).toBe("nearby");
    expect(container.querySelectorAll(".similar-letter-diagram-card").length).toBeGreaterThan(1);
    expect(container.querySelector('.similar-letter-diagram-card[data-letter="ك"]')).toBeTruthy();
  });

  it("invokes onSpeak and onSelectLetter callbacks when card buttons are clicked", () => {
    const onSpeak = vi.fn();
    const onSelectLetter = vi.fn();

    const { container } = render(
      React.createElement(
        Provider,
        { store },
        React.createElement(MakharijSimilarLettersDiagrams, {
          activeLetter: "ت",
          onSpeak,
          onSelectLetter,
        })
      )
    );

    const taCard = container.querySelector('.similar-letter-diagram-card[data-letter="ط"]');
    const buttons = Array.from(taCard.querySelectorAll("button"));
    const listenBtn = buttons.find((b) => b.textContent.includes("Écouter"));
    const switchBtn = buttons.find((b) => b.textContent.includes("Voir fiche"));
    expect(listenBtn).toBeTruthy();
    expect(switchBtn).toBeTruthy();

    fireEvent.click(listenBtn); // 🔊 Écouter
    expect(onSpeak).toHaveBeenCalledWith("ط", "sim-ط");

    fireEvent.click(switchBtn); // Voir fiche →
    expect(onSelectLetter).toHaveBeenCalledWith("ط");
  });
});

describe("PrononciationPage Integration with Multi-Diagram Similar Letters & ErrorManager", () => {
  beforeEach(() => {
    localStorage.clear();
    store.dispatch(uiActions.setSimilarLettersFilter("all"));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders similar letters diagrams in PrononciationPage and switches active letter via 'Voir fiche →'", () => {
    const { container } = render(
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

    // Tab 🔀 Similaires is present in #letter-detail-section-tabs
    const tabsBar = document.getElementById("letter-detail-section-tabs");
    expect(tabsBar.textContent).toContain("Similaires");

    // Click '🔀 Similaires' tab
    const simTabBtn = Array.from(tabsBar.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Similaires")
    );
    fireEvent.click(simTabBtn);

    const simSection = document.getElementById("similar-letters-diagrams-section");
    expect(simSection).toBeTruthy();

    // Default letter is ب (index 0); its same-Makhraj neighbor م should appear
    const mimCard = container.querySelector('.similar-letter-diagram-card[data-letter="م"]');
    expect(mimCard).toBeTruthy();

    const switchBtn = Array.from(mimCard.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Voir fiche")
    );
    fireEvent.click(switchBtn);

    // After clicking, the active reference card becomes م
    const refCard = container.querySelector('.similar-letter-diagram-card[data-relation="reference"]');
    expect(refCard.getAttribute("data-letter")).toBe("م");
  });

  it("catches speechSynthesis failure via errorManager and records error in Redux store", () => {
    const originalSpeech = window.speechSynthesis;
    const originalUtterance = globalThis.SpeechSynthesisUtterance;

    globalThis.SpeechSynthesisUtterance = function MockUtterance(text) {
      this.text = text;
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: vi.fn(() => {
          throw new Error("Synth hardware failure");
        }),
      },
    });

    const { container } = render(
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

    const refCard = container.querySelector('.similar-letter-diagram-card[data-relation="reference"]');
    const listenBtn = Array.from(refCard.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Écouter")
    );
    fireEvent.click(listenBtn);

    const lastErr = store.getState().errors.lastError;
    expect(lastErr).toBeTruthy();
    expect(lastErr.code).toBe("AUDIO_PLAYBACK_ERROR");

    // Cleanup global mocks
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: originalSpeech,
    });
    globalThis.SpeechSynthesisUtterance = originalUtterance;
  });
});
