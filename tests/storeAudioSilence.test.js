import { describe, it, expect, beforeEach } from "vitest";
import { store, sel, playerActions } from "../src/store.js";

describe("Redux State Manager - Audio Silence & Revision Slice", () => {
  beforeEach(() => {
    store.dispatch(playerActions.setSilenceWordsToRevise(false));
    store.dispatch(playerActions.setSilenceMode("mute"));
    store.dispatch(playerActions.clearCustomSilencedWords(null)); // clear all
  });

  it("toggles silenceWordsToRevise flag", () => {
    expect(sel.silenceWordsToRevise(store.getState())).toBe(false);

    store.dispatch(playerActions.setSilenceWordsToRevise(true));
    expect(sel.silenceWordsToRevise(store.getState())).toBe(true);

    store.dispatch(playerActions.setSilenceWordsToRevise(false));
    expect(sel.silenceWordsToRevise(store.getState())).toBe(false);
  });

  it("switches silenceMode between mute and skip", () => {
    expect(sel.silenceMode(store.getState())).toBe("mute");

    store.dispatch(playerActions.setSilenceMode("skip"));
    expect(sel.silenceMode(store.getState())).toBe("skip");

    store.dispatch(playerActions.setSilenceMode("mute"));
    expect(sel.silenceMode(store.getState())).toBe("mute");
  });

  it("manages custom silenced words per ayat key", () => {
    const key = "2:255";
    expect(sel.customSilencedWordsMap(store.getState())[key]).toBeUndefined();

    // Toggle word 2 ON
    store.dispatch(playerActions.toggleCustomSilencedWord({ key, wordIndex: 2 }));
    expect(sel.customSilencedWordsMap(store.getState())[key]).toEqual([2]);

    // Toggle word 5 ON
    store.dispatch(playerActions.toggleCustomSilencedWord({ key, wordIndex: 5 }));
    expect(sel.customSilencedWordsMap(store.getState())[key]).toEqual([2, 5]);

    // Toggle word 2 OFF
    store.dispatch(playerActions.toggleCustomSilencedWord({ key, wordIndex: 2 }));
    expect(sel.customSilencedWordsMap(store.getState())[key]).toEqual([5]);

    // Explicitly set array of words
    store.dispatch(playerActions.setCustomSilencedWords({ key, wordIndices: [0, 1, 3] }));
    expect(sel.customSilencedWordsMap(store.getState())[key]).toEqual([0, 1, 3]);

    // Clear specific key
    store.dispatch(playerActions.clearCustomSilencedWords(key));
    expect(sel.customSilencedWordsMap(store.getState())[key]).toBeUndefined();
  });
});
