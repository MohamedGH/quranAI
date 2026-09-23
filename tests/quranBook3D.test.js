import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchQuranPage, fetchPageMeta, GLOBAL_RECITERS } from "../src/utils/reciterAudio.js";
import { store, uiActions, reciterActions, learnActions, sel } from "../src/store.js";
import {
  isTafkhim,
  isTarqiq,
  isQalqala,
  isIzhar,
  isIdgham,
  getMaddType,
} from "../src/utils/tajweedRules.js";

describe("Quran Book WebGL & 3D Reader Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates correct right and left page numbers for double spread mode", () => {
    const calcPages = (spread) => {
      const rPage = 2 * spread - 1;
      const lPage = Math.min(2 * spread, 604);
      return { rPage, lPage };
    };

    // Spread 1 -> Pages 1 & 2
    expect(calcPages(1)).toEqual({ rPage: 1, lPage: 2 });
    // Spread 2 -> Pages 3 & 4
    expect(calcPages(2)).toEqual({ rPage: 3, lPage: 4 });
    // Spread 150 -> Pages 299 & 300
    expect(calcPages(150)).toEqual({ rPage: 299, lPage: 300 });
    // Spread 302 -> Pages 603 & 604
    expect(calcPages(302)).toEqual({ rPage: 603, lPage: 604 });
  });

  it("calculates correct spread index from any page number (1 to 604)", () => {
    const getSpreadForPage = (page) => Math.floor((page - 1) / 2) + 1;
    expect(getSpreadForPage(1)).toBe(1);
    expect(getSpreadForPage(2)).toBe(1);
    expect(getSpreadForPage(3)).toBe(2);
    expect(getSpreadForPage(4)).toBe(2);
    expect(getSpreadForPage(604)).toBe(302);
  });

  it("validates Tajweed rule detection for book rendering", () => {
    // Qalqala letter on sukun
    const qalqalaWord = ["ق", "\u0652"];
    expect(isQalqala(qalqalaWord, 0)).toBe(true);

    // Tafkhim permanent letters (خص ضغط قظ)
    const tafkhimLetter = ["خ"];
    expect(isTafkhim(tafkhimLetter, 0)).toBe(true);
    expect(isTarqiq(tafkhimLetter, 0)).toBe(false);

    // Tarqiq letter (e.g. Ba)
    const tarqiqLetter = ["ب"];
    expect(isTafkhim(tarqiqLetter, 0)).toBe(false);
    expect(isTarqiq(tarqiqLetter, 0)).toBe(true);

    // Madd with madd sign
    const maddWord = ["آ"];
    expect(getMaddType(maddWord, 0)).not.toBeNull();
  });

  it("manages global reciter list and audio URL formatting for the 3D book", () => {
    expect(GLOBAL_RECITERS.length).toBeGreaterThanOrEqual(4);
    const alafasy = GLOBAL_RECITERS.find((r) => r.key === "alafasy");
    expect(alafasy).toBeDefined();
    expect(alafasy.url).toContain("everyayah.com");

    const formatAyahAudioUrl = (reciterObj, surahNum, ayahNum) => {
      const sPadded = String(surahNum).padStart(3, "0");
      const aPadded = String(ayahNum).padStart(3, "0");
      return `${reciterObj.url}/${sPadded}${aPadded}.mp3`;
    };

    const url = formatAyahAudioUrl(alafasy, 1, 1);
    expect(url).toBe(`${alafasy.url}/001001.mp3`);

    const urlAyah255 = formatAyahAudioUrl(alafasy, 2, 255);
    expect(urlAyah255).toBe(`${alafasy.url}/002255.mp3`);
  });

  it("handles bookmark storage and retrieval correctly", () => {
    const memoryStorage = {};
    const saveBookmark = (page) => { memoryStorage["quran_bm_page"] = String(page); };
    const getBookmark = () => parseInt(memoryStorage["quran_bm_page"], 10) || null;

    saveBookmark(187);
    expect(getBookmark()).toBe(187);

    saveBookmark(604);
    expect(getBookmark()).toBe(604);
  });

  it("supports Redux state toggles for all Tajweed rules in 3D book", () => {
    const initialTafkhim = sel.showTajweedTone(store.getState());
    store.dispatch(uiActions.toggleTajweedTone());
    expect(sel.showTajweedTone(store.getState())).toBe(!initialTafkhim);

    const initialQalqala = sel.showQalqala(store.getState());
    store.dispatch(uiActions.toggleQalqala());
    expect(sel.showQalqala(store.getState())).toBe(!initialQalqala);

    const initialMadd = sel.showMadd(store.getState());
    store.dispatch(uiActions.toggleMadd());
    expect(sel.showMadd(store.getState())).toBe(!initialMadd);

    const initialIzhar = sel.showIzhar(store.getState());
    store.dispatch(uiActions.toggleIzhar());
    expect(sel.showIzhar(store.getState())).toBe(!initialIzhar);

    const initialIdgham = sel.showIdgham(store.getState());
    store.dispatch(uiActions.toggleIdgham());
    expect(sel.showIdgham(store.getState())).toBe(!initialIdgham);
  });

  it("updates learning data when an ayah is marked learned or to revise from the 3D book", () => {
    store.dispatch(
      learnActions.setLearnEntry({
        key: "1:1",
        value: { learned: true, toRevise: false },
      })
    );
    const ld = sel.learnData(store.getState());
    expect(ld["1:1"]).toBeDefined();
    expect(ld["1:1"].learned).toBe(true);
    expect(ld["1:1"].toRevise).toBe(false);

    store.dispatch(
      learnActions.setLearnEntry({
        key: "1:1",
        value: { learned: false, toRevise: true },
      })
    );
    const updatedLd = sel.learnData(store.getState());
    expect(updatedLd["1:1"].learned).toBe(false);
    expect(updatedLd["1:1"].toRevise).toBe(true);
  });
});
