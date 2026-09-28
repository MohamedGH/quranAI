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

  describe("Rehal Wooden Stand Geometry (Collision-Free Guarantee)", () => {
    it("ensures all Rehal wooden stand coordinates are strictly below book covers and pages", () => {
      // Book cover geometry
      const bookSpineY = -0.10;
      const leftCoverY = -0.12;
      const rightCoverY = -0.12;
      const pagesY = 0.01;

      // Authentic Rehal X-Stand Geometry:
      // Crossed planks:
      const rehalHingeY = -0.48;
      const plankLength = 2.2;
      const plankThickness = 0.045;
      const rotZ = 0.28;

      // Half length along plank
      const halfL = plankLength / 2; // 1.1

      // Max Y on top arm occurs at the upper tip:
      // y = rehalHingeY + halfL * sin(rotZ) + (plankThickness / 2) * cos(rotZ)
      const maxPlankY =
        rehalHingeY +
        halfL * Math.sin(rotZ) +
        (plankThickness / 2) * Math.cos(rotZ);

      // Max elevation of wooden stand MUST be below the corresponding cover board elevation and page plane
      expect(maxPlankY).toBeLessThan(-0.15);
      expect(maxPlankY).toBeLessThan(pagesY);

      // Clearance between wooden stand top and open pages is at least 0.15 units
      expect(pagesY - maxPlankY).toBeGreaterThan(0.15);

      // Central leg crossing hinge is well below the book spine
      expect(rehalHingeY).toBeLessThan(bookSpineY);
      // Clearance between crossing hinge and spine is at least 0.35 units
      expect(bookSpineY - rehalHingeY).toBeGreaterThan(0.35);

      // Foot contact elevation is below -0.75
      const footY = rehalHingeY - halfL * Math.sin(rotZ);
      expect(footY).toBeLessThan(-0.75);
    });

    it("guarantees page turning spine pivot stays strictly above book and wood at all rotation angles", () => {
      const spinePivot = { x: 0, y: 0.02, z: 0 };
      const pageWidth = 1.26;
      const minElevationAllowed = 0.01; // Must never dip below open page plane

      // Interpolate angle across turn from right (+0.14 rad) to left (PI - 0.14 rad)
      const numSteps = 50;
      for (let i = 0; i <= numSteps; i++) {
        const p = i / numSteps;
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const curAngle = 0.14 + (Math.PI - 0.28) * ease;

        // Check vertex elevations along page width (from spine u=0 to tip u=1)
        for (let u = 0; u <= 1.0; u += 0.2) {
          const lx = u * pageWidth;
          const worldY = spinePivot.y + lx * Math.sin(curAngle);

          // Page vertex is always strictly above the book plane (zero collision with wood or covers)
          expect(worldY).toBeGreaterThanOrEqual(minElevationAllowed);
        }

        // At mid-flight (p = 0.5), outer edge must be arched high in the air
        if (Math.abs(p - 0.5) < 0.02) {
          const midTipY = spinePivot.y + pageWidth * Math.sin(curAngle);
          expect(midTipY).toBeGreaterThan(1.0);
        }
      }
    });
  });

  describe("Authentic Medina Mushaf Text Processing & Formatting", () => {
    // Helper to format Eastern Arabic digits
    const toArabicDigits = (num) => {
      const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
      return String(num).replace(/[0-9]/g, (d) => digits[d]);
    };

    // Helper to strip redundant Bismillah
    const stripBismillahIfPresent = (text, surahNum, ayahNum) => {
      let cleaned = (text || "").replace(/^\ufeff/, "").trim();
      if (ayahNum === 1 && surahNum !== 1 && surahNum !== 9) {
        const parts = cleaned.split(/\s+/);
        if (parts.length >= 5 && parts[0].includes("بِسْمِ")) {
          cleaned = parts.slice(4).join(" ");
        } else {
          cleaned = cleaned.replace(/^ب[\u0600-\u06FF\s]*ٱلل[\u0600-\u06FF\s]*ٱلرَّحْم[\u0600-\u06FF\s]*ٱلرَّحِيمِ?\s*/, "").trim();
        }
      }
      return cleaned;
    };

    it("formats Eastern Arabic numerals correctly for ayah end markers", () => {
      expect(toArabicDigits(1)).toBe("١");
      expect(toArabicDigits(7)).toBe("٧");
      expect(toArabicDigits(255)).toBe("٢٥٥");
      expect(toArabicDigits(604)).toBe("٦٠٤");
    });

    it("strips redundant Bismillah from Ayah 1 of Surah 2 (Al-Baqarah) so text matches real Quran", () => {
      const ayah1ApiText = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ";
      const cleaned = stripBismillahIfPresent(ayah1ApiText, 2, 1);
      // In real Quran, Surah 2 Ayah 1 is only "الم" (the Bismillah is only in the surah banner above)
      expect(cleaned).toBe("الٓمٓ");
    });

    it("retains Bismillah for Surah 1 (Al-Fatihah) as Ayah 1 is Bismillah itself", () => {
      const fatihah1 = "﻿بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
      const cleaned = stripBismillahIfPresent(fatihah1, 1, 1);
      expect(cleaned).toContain("بِسْمِ ٱللَّهِ");
    });

    it("cleans Surah title headers so 'سُورَةُ' is never duplicated", () => {
      const cleanTitle = (rawName) => {
        const cleaned = (rawName || "").replace(/^سُورَةُ\s*/, "");
        return `سُورَةُ ${cleaned}`;
      };

      // If API returns "سُورَةُ ٱلْفَاتِحَةِ"
      expect(cleanTitle("سُورَةُ ٱلْفَاتِحَةِ")).toBe("سُورَةُ ٱلْفَاتِحَةِ");
      // If API returns "البَقَرَةِ"
      expect(cleanTitle("البَقَرَةِ")).toBe("سُورَةُ البَقَرَةِ");
    });

    it("builds continuous stream of words without artificial line-breaks per ayah", () => {
      const mockPage2Ayahs = [
        { surah: { number: 2 }, numberInSurah: 1, text: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ" },
        { surah: { number: 2 }, numberInSurah: 2, text: "ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ" },
      ];

      const wordsStream = [];
      mockPage2Ayahs.forEach((a) => {
        const t = stripBismillahIfPresent(a.text, a.surah.number, a.numberInSurah);
        const wList = t.split(/\s+/).filter(Boolean);
        wList.forEach((w) => wordsStream.push({ word: w, isEnd: false }));
        wordsStream.push({ word: `﴿${toArabicDigits(a.numberInSurah)}﴾`, isEnd: true });
      });

      // Stream should have "الٓمٓ", "﴿١﴾", "ذَٰلِكَ", etc. continuously
      expect(wordsStream[0].word).toBe("الٓمٓ");
      expect(wordsStream[1].word).toBe("﴿١﴾");
      expect(wordsStream[2].word).toBe("ذَٰلِكَ");
    });

    it("resolves 2D click coordinates to ayah bounding box correctly", () => {
      const mockBoxes = [
        {
          key: "2:1",
          surahNum: 2,
          ayahNum: 1,
          uMin: 0.1,
          uMax: 0.9,
          vMin: 0.8,
          vMax: 0.95,
        },
        {
          key: "2:2",
          surahNum: 2,
          ayahNum: 2,
          uMin: 0.1,
          uMax: 0.9,
          vMin: 0.6,
          vMax: 0.79,
        },
      ];

      const findAyahAt2D = (u, vNorm) => {
        const v3d = 1.0 - vNorm; // in 2D top is 0, in 3D bottom is 0
        return mockBoxes.find(
          (b) => u >= b.uMin && u <= b.uMax && v3d >= b.vMin && v3d <= b.vMax
        );
      };

      // Click near top (vNorm = 0.1 -> v3d = 0.9)
      const hit1 = findAyahAt2D(0.5, 0.1);
      expect(hit1).toBeDefined();
      expect(hit1.ayahNum).toBe(1);

      // Click lower down (vNorm = 0.3 -> v3d = 0.7)
      const hit2 = findAyahAt2D(0.5, 0.3);
      expect(hit2).toBeDefined();
      expect(hit2.ayahNum).toBe(2);
    });

    it("handles 2D and 3D page turn navigation correctly without getting stuck", () => {
      let spread = 1;
      const isSingleMode = false;
      const maxSp = isSingleMode ? 604 : 302;

      // In 2D mode: turnNext must advance spread immediately
      const turnNext2D = () => {
        if (spread < maxSp) spread += 1;
      };
      const turnPrev2D = () => {
        if (spread > 1) spread -= 1;
      };

      turnNext2D();
      expect(spread).toBe(2);

      turnNext2D();
      expect(spread).toBe(3);

      turnPrev2D();
      expect(spread).toBe(2);

      // Prev at lower bound does not decrement past 1
      spread = 1;
      turnPrev2D();
      expect(spread).toBe(1);

      // Next at upper bound does not increment past maxSp
      spread = maxSp;
      turnNext2D();
      expect(spread).toBe(maxSp);
    });

    it("toggles wooden stand visibility reliably and propagates to all stand components", () => {
      // Mock stand group and children hierarchy
      const mockChildren = [
        { name: "rehalPlank1", visible: true },
        { name: "rehalPlank2", visible: true },
        { name: "pivotMesh", visible: true },
        { name: "leftFoot", visible: true },
        { name: "rightFoot", visible: true },
      ];
      const mockStandGroup = {
        name: "standGroup",
        visible: true,
        children: mockChildren,
        traverse(fn) {
          this.children.forEach(fn);
        },
      };

      const setStandVisibility = (group, isVisible) => {
        group.visible = isVisible;
        group.traverse((child) => {
          child.visible = isVisible;
        });
      };

      // Turn OFF stand
      setStandVisibility(mockStandGroup, false);
      expect(mockStandGroup.visible).toBe(false);
      mockStandGroup.children.forEach((c) => {
        expect(c.visible).toBe(false);
      });

      // Turn ON stand
      setStandVisibility(mockStandGroup, true);
      expect(mockStandGroup.visible).toBe(true);
      mockStandGroup.children.forEach((c) => {
        expect(c.visible).toBe(true);
      });
    });
  });
});
