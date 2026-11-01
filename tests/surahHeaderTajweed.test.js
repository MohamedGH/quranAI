import { describe, it, expect, beforeEach } from "vitest";
import { store, uiActions, sel } from "../src/store.js";
import { getTajweedStyleForChar, isIkhfa, isIqlab, isGhunnah } from "../src/utils/tajweedRules.js";

describe("SurahHeader Tajweed Drawer & Rule Activation", () => {
  beforeEach(() => {
    // Reset all Tajweed rules to false
    if (sel.showQalqala(store.getState())) store.dispatch(uiActions.toggleQalqala());
    if (sel.showMadd(store.getState())) store.dispatch(uiActions.toggleMadd());
    if (sel.showIzhar(store.getState())) store.dispatch(uiActions.toggleIzhar());
    if (sel.showIdgham(store.getState())) store.dispatch(uiActions.toggleIdgham());
    if (sel.showIkhfa(store.getState())) store.dispatch(uiActions.toggleIkhfa());
    if (sel.showIqlab(store.getState())) store.dispatch(uiActions.toggleIqlab());
    if (sel.showGhunnah(store.getState())) store.dispatch(uiActions.toggleGhunnah());
    if (sel.showTajweedTone(store.getState())) store.dispatch(uiActions.toggleTajweedTone());
  });

  it("allows Ikhfa (IRFA) to be activated and toggled in Redux store", () => {
    expect(sel.showIkhfa(store.getState())).toBe(false);

    // Click toggle in SurahHeader
    store.dispatch(uiActions.toggleIkhfa());
    expect(sel.showIkhfa(store.getState())).toBe(true);

    // Click toggle again to deactivate
    store.dispatch(uiActions.toggleIkhfa());
    expect(sel.showIkhfa(store.getState())).toBe(false);
  });

  it("allows Iqlab (IQLAB) to be activated and toggled in Redux store", () => {
    expect(sel.showIqlab(store.getState())).toBe(false);

    // Click toggle in SurahHeader
    store.dispatch(uiActions.toggleIqlab());
    expect(sel.showIqlab(store.getState())).toBe(true);

    // Click toggle again to deactivate
    store.dispatch(uiActions.toggleIqlab());
    expect(sel.showIqlab(store.getState())).toBe(false);
  });

  it("allows Ghunnah (ROUHNAA) to be activated and toggled in Redux store", () => {
    expect(sel.showGhunnah(store.getState())).toBe(false);

    // Click toggle in SurahHeader
    store.dispatch(uiActions.toggleGhunnah());
    expect(sel.showGhunnah(store.getState())).toBe(true);

    // Click toggle again to deactivate
    store.dispatch(uiActions.toggleGhunnah());
    expect(sel.showGhunnah(store.getState())).toBe(false);
  });

  it("computes active rules count including Ikhfa, Iqlab, Ghunnah (activeTjCount / 8)", () => {
    const getActiveCount = (s) => [
      sel.showQalqala(s),
      sel.showMadd(s),
      sel.showIzhar(s),
      sel.showIdgham(s),
      sel.showIkhfa(s),
      sel.showIqlab(s),
      sel.showGhunnah(s),
      sel.showTajweedTone(s),
    ].filter(Boolean).length;

    expect(getActiveCount(store.getState())).toBe(0);

    store.dispatch(uiActions.toggleIkhfa());
    store.dispatch(uiActions.toggleIqlab());
    store.dispatch(uiActions.toggleGhunnah());

    expect(getActiveCount(store.getState())).toBe(3);
  });

  it("activates and deactivates all 8 rules simultaneously using toggle-all logic", () => {
    const s = store.getState;
    const isAnyActive = () =>
      sel.showQalqala(s()) ||
      sel.showMadd(s()) ||
      sel.showIzhar(s()) ||
      sel.showIdgham(s()) ||
      sel.showIkhfa(s()) ||
      sel.showIqlab(s()) ||
      sel.showGhunnah(s()) ||
      sel.showTajweedTone(s());

    expect(isAnyActive()).toBe(false);

    // Simulate "✓ TOUT ACTIVER" in SurahHeader
    const activateAll = () => {
      if (!sel.showTajweedTone(s())) store.dispatch(uiActions.toggleTajweedTone());
      if (!sel.showQalqala(s())) store.dispatch(uiActions.toggleQalqala());
      if (!sel.showMadd(s())) store.dispatch(uiActions.toggleMadd());
      if (!sel.showIzhar(s())) store.dispatch(uiActions.toggleIzhar());
      if (!sel.showIdgham(s())) store.dispatch(uiActions.toggleIdgham());
      if (!sel.showIkhfa(s())) store.dispatch(uiActions.toggleIkhfa());
      if (!sel.showIqlab(s())) store.dispatch(uiActions.toggleIqlab());
      if (!sel.showGhunnah(s())) store.dispatch(uiActions.toggleGhunnah());
    };

    activateAll();

    expect(sel.showQalqala(s())).toBe(true);
    expect(sel.showMadd(s())).toBe(true);
    expect(sel.showIzhar(s())).toBe(true);
    expect(sel.showIdgham(s())).toBe(true);
    expect(sel.showIkhfa(s())).toBe(true);
    expect(sel.showIqlab(s())).toBe(true);
    expect(sel.showGhunnah(s())).toBe(true);
    expect(sel.showTajweedTone(s())).toBe(true);

    // Simulate "✕ DÉSACTIVER TOUT" in SurahHeader
    const deactivateAll = () => {
      if (sel.showTajweedTone(s())) store.dispatch(uiActions.toggleTajweedTone());
      if (sel.showQalqala(s())) store.dispatch(uiActions.toggleQalqala());
      if (sel.showMadd(s())) store.dispatch(uiActions.toggleMadd());
      if (sel.showIzhar(s())) store.dispatch(uiActions.toggleIzhar());
      if (sel.showIdgham(s())) store.dispatch(uiActions.toggleIdgham());
      if (sel.showIkhfa(s())) store.dispatch(uiActions.toggleIkhfa());
      if (sel.showIqlab(s())) store.dispatch(uiActions.toggleIqlab());
      if (sel.showGhunnah(s())) store.dispatch(uiActions.toggleGhunnah());
    };

    deactivateAll();

    expect(isAnyActive()).toBe(false);
  });

  it("renders correct styling for Ikhfa, Iqlab, and Ghunnah when activated independently", () => {
    // Noon with Shaddah (Ghunnah)
    const inna = ["إ", "ِ", "ن", "ّ", "َ"];
    const ghunnahStyle = getTajweedStyleForChar(inna, 2, {
      showGhunnah: true,
      showIzhar: false,
      showIdgham: false,
    });
    expect(ghunnahStyle).not.toBeNull();
    expect(ghunnahStyle.color).toBe("#10b981");

    // Nun Sakinah before Ba (Iqlab)
    const iqlabLetters = ["م", "ِ", "ن", "ۢ", " ", "ب", "َ", "ع", "ْ", "د", "ِ"];
    const iqlabStyle = getTajweedStyleForChar(iqlabLetters, 2, {
      showIqlab: true,
    });
    expect(iqlabStyle).not.toBeNull();
    expect(iqlabStyle.color).toBe("#2dd4bf");

    // Nun Sakinah before Qaf (Ikhfa)
    const ikhfaLetters = ["م", "ِ", "ن", " ", "ق", "َ", "ب", "ْ", "ل", "ِ"];
    const ikhfaStyle = getTajweedStyleForChar(ikhfaLetters, 2, {
      showIkhfa: true,
    });
    expect(ikhfaStyle).not.toBeNull();
    expect(ikhfaStyle.color).toBe("#c084fc");
  });
});
