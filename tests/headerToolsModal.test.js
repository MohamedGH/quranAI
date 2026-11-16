// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { Provider } from "react-redux";
import { MemoryRouter, useLocation } from "react-router-dom";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { HeaderToolsModal, HEADER_TOOLS_TABS, TOOLS_PAGE_LINKS } from "../src/components/common/HeaderToolsModal.jsx";
import { store, sel, uiActions } from "../src/store.js";
import { getAvailableUxProfiles, getUxProfile } from "../src/utils/uxProfileManager.js";

function ToolsLocationProbe() {
  const loc = useLocation();
  return React.createElement("div", { "data-testid": "tools-loc-probe" }, `${loc.pathname}${loc.search}`);
}

const createModalProps = (overrides = {}) => ({
  isOpen: true,
  onClose: vi.fn(),
  currentUser: { displayName: "Test User", email: "test@example.com" },
  onSignOut: vi.fn(),
  showArabicKeyboard: false,
  setShowArabicKeyboard: vi.fn(),
  showRappel: false,
  setShowRappel: vi.fn(),
  onOpenScheduledReminders: vi.fn(),
  onOpenOptionsModal: vi.fn(),
  toggleVoice: vi.fn(),
  listening: false,
  selectedSurah: { number: 1, englishName: "Al-Fatihah" },
  activeHizb: 1,
  initialTab: "tools",
  ...overrides,
});

describe("HeaderToolsModal - Tabs and UX Profile integration", () => {
  beforeEach(() => {
    store.dispatch(uiActions.setActivePage("quran"));
    store.dispatch(uiActions.setUxMode("standard"));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("defines exactly the 5 navigation tabs for the tools modal", () => {
    expect(HEADER_TOOLS_TABS).toHaveLength(5);

    const tabIds = HEADER_TOOLS_TABS.map((t) => t.id);
    expect(tabIds).toEqual(["tools", "ux", "voice", "offline", "account"]);
  });

  it("exposes frozen TOOLS_PAGE_LINKS for glossaire, recordings, and offline", () => {
    expect(Object.isFrozen(TOOLS_PAGE_LINKS)).toBe(true);
    expect(TOOLS_PAGE_LINKS.map((l) => l.id)).toEqual(["glossaire", "recordings", "offline"]);
    expect(TOOLS_PAGE_LINKS.map((l) => l.buildPath())).toEqual(["/glossaire", "/recordings", "/offline"]);
  });

  it("contains the 'MODE & PROFIL' tab with icon 🧭 at index 1", () => {
    const uxTab = HEADER_TOOLS_TABS.find((t) => t.id === "ux");
    expect(uxTab).toBeDefined();
    expect(uxTab.label).toBe("MODE & PROFIL");
    expect(uxTab.icon).toBe("🧭");
  });

  it("provides valid and complete metadata for all 5 tabs", () => {
    HEADER_TOOLS_TABS.forEach((tab) => {
      expect(tab.id).toBeTruthy();
      expect(tab.label).toBeTruthy();
      expect(tab.icon).toBeTruthy();
      expect(typeof tab.id).toBe("string");
      expect(typeof tab.label).toBe("string");
      expect(typeof tab.icon).toBe("string");
    });
  });

  it("allows activating each UX mode and updates Redux store", () => {
    const profiles = getAvailableUxProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(4);

    profiles.forEach((profile) => {
      store.dispatch(uiActions.setUxMode(profile.id));
      const state = store.getState();
      expect(sel.uxMode(state)).toBe(profile.id);

      const resolved = getUxProfile(sel.uxMode(state));
      expect(resolved.id).toBe(profile.id);
      expect(resolved.name).toBe(profile.name);
    });

    // Reset back to standard
    store.dispatch(uiActions.setUxMode("standard"));
    expect(sel.uxMode(store.getState())).toBe("standard");
  });

  it("manages modal visibility state in Redux store", () => {
    expect(sel.showUxModeModal(store.getState())).toBe(false);

    store.dispatch(uiActions.setShowUxModeModal(true));
    expect(sel.showUxModeModal(store.getState())).toBe(true);

    store.dispatch(uiActions.setShowUxModeModal(false));
    expect(sel.showUxModeModal(store.getState())).toBe(false);
  });

  it("renders links to Glossaire, Enregistrements, and Hors-Ligne inside OUTILS and navigates cleanly via RouteManager + Redux", () => {
    const cases = [
      { btnId: "btn-tools-nav-glossaire", expectedPage: "glossaire", expectedPath: "/glossaire" },
      { btnId: "btn-tools-nav-recordings", expectedPage: "recordings", expectedPath: "/recordings" },
      { btnId: "btn-tools-nav-offline", expectedPage: "offline", expectedPath: "/offline" },
    ];

    cases.forEach(({ btnId, expectedPage, expectedPath }) => {
      const onClose = vi.fn();
      const props = createModalProps({ onClose, initialTab: "tools" });
      render(
        React.createElement(
          Provider,
          { store },
          React.createElement(
            MemoryRouter,
            { initialEntries: ["/"] },
            React.createElement(
              React.Fragment,
              null,
              React.createElement(HeaderToolsModal, props),
              React.createElement(ToolsLocationProbe)
            )
          )
        )
      );

      const btn = document.getElementById(btnId);
      expect(btn).toBeTruthy();
      fireEvent.click(btn);

      expect(sel.activePage(store.getState())).toBe(expectedPage);
      expect(document.querySelector('[data-testid="tools-loc-probe"]').textContent).toBe(expectedPath);
      expect(onClose).toHaveBeenCalledTimes(1);

      cleanup();
    });
  });

  it("provides direct link to /offline inside the HORS-LIGNE tab and marks active page label", () => {
    store.dispatch(uiActions.setActivePage("offline"));
    const onClose = vi.fn();
    render(
      React.createElement(
        Provider,
        { store },
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/"] },
          React.createElement(
            React.Fragment,
            null,
            React.createElement(HeaderToolsModal, createModalProps({ onClose, initialTab: "tools" })),
            React.createElement(ToolsLocationProbe)
          )
        )
      )
    );

    // Explicit text indicator alongside color highlight in OUTILS tab
    const offlineShortcut = document.getElementById("btn-tools-nav-offline");
    expect(offlineShortcut.textContent).toContain("ACTIF");

    // Switch to HORS-LIGNE tab inside modal
    fireEvent.click(document.getElementById("modal-tab-offline"));
    const directOfflineBtn = document.getElementById("btn-tools-offline-open-page");
    expect(directOfflineBtn).toBeTruthy();
    fireEvent.click(directOfflineBtn);

    expect(document.querySelector('[data-testid="tools-loc-probe"]').textContent).toBe("/offline");
    expect(sel.activePage(store.getState())).toBe("offline");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("falls back safely without throwing when rendered outside a Router context", () => {
    const onClose = vi.fn();
    render(
      React.createElement(
        Provider,
        { store },
        React.createElement(HeaderToolsModal, createModalProps({ onClose, initialTab: "tools" }))
      )
    );

    const glossaireBtn = document.getElementById("btn-tools-nav-glossaire");
    expect(glossaireBtn).toBeTruthy();
    fireEvent.click(glossaireBtn);

    expect(sel.activePage(store.getState())).toBe("glossaire");
    expect(window.location.hash).toBe("#/glossaire");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
