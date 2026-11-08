import { describe, it, expect } from "vitest";
import { HEADER_TOOLS_TABS } from "../src/components/common/HeaderToolsModal.jsx";
import { store, sel, uiActions } from "../src/store.js";
import { getAvailableUxProfiles, getUxProfile } from "../src/utils/uxProfileManager.js";

describe("HeaderToolsModal - Tabs and UX Profile integration", () => {
  it("defines exactly the 5 navigation tabs for the tools modal", () => {
    expect(HEADER_TOOLS_TABS).toHaveLength(5);

    const tabIds = HEADER_TOOLS_TABS.map((t) => t.id);
    expect(tabIds).toEqual(["tools", "ux", "voice", "offline", "account"]);
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
});
