import { describe, it, expect } from "vitest";
import {
  DEFAULT_SWIPE_CONFIG,
  detectSwipeGesture,
  clampVerseNumber,
  resolveTargetSurahNumber,
  resolveActiveAyatNumber,
  isInteractiveElement,
  computeSurahSwipeNavigation,
  computeSurahNavigationByDirection,
  formatSwipeToastMessage,
  calculateTouchDistance,
  detectPinchGesture,
  detectPlayerGesture,
  detectSheetDismissGesture,
  detectEdgeSwipeGesture,
  detectTabSwipeGesture,
} from "../src/utils/swipeNavigation.js";

const mockSurahs = [
  { number: 1, name: "الفاتحة", englishName: "Al-Fatiha", numberOfAyahs: 7 },
  { number: 2, name: "البقرة", englishName: "Al-Baqarah", numberOfAyahs: 286 },
  { number: 3, name: "آل عمران", englishName: "Aal-i-Imraan", numberOfAyahs: 200 },
  { number: 108, name: "الكوثر", englishName: "Al-Kawthar", numberOfAyahs: 3 },
  { number: 114, name: "الناس", englishName: "An-Nas", numberOfAyahs: 6 },
];

describe("detectSwipeGesture", () => {
  it("rejects small horizontal distance below minDistance", () => {
    const gesture = detectSwipeGesture({
      startX: 100,
      startY: 100,
      endX: 130, // dx = 30 < 70
      endY: 105,
      startTime: 1000,
      endTime: 1200,
    });
    expect(gesture.isStrongSwipe).toBe(false);
    expect(gesture.direction).toBeNull();
  });

  it("rejects vertical scrolling gesture where deltaY dominates", () => {
    const gesture = detectSwipeGesture({
      startX: 100,
      startY: 100,
      endX: 180, // dx = 80
      endY: 260, // dy = 160 -> absX < absY * 1.5
      startTime: 1000,
      endTime: 1250,
    });
    expect(gesture.isStrongSwipe).toBe(false);
    expect(gesture.direction).toBeNull();
  });

  it("rejects slow drags taking too long unless largeDistance", () => {
    const gesture = detectSwipeGesture({
      startX: 200,
      startY: 100,
      endX: 125, // dx = -75
      endY: 105,
      startTime: 1000,
      endTime: 2200, // 1200ms -> duration > maxDuration and velocity < minVelocity
    });
    expect(gesture.isStrongSwipe).toBe(false);
  });

  it("detects strong swipe left (finger moves right to left)", () => {
    const gesture = detectSwipeGesture({
      startX: 250,
      startY: 150,
      endX: 150, // dx = -100
      endY: 160, // dy = 10
      startTime: 1000,
      endTime: 1220, // duration 220ms -> velocity ~0.45 px/ms
    });
    expect(gesture.isStrongSwipe).toBe(true);
    expect(gesture.direction).toBe("left");
    expect(gesture.deltaX).toBe(-100);
  });

  it("detects strong swipe right (finger moves left to right)", () => {
    const gesture = detectSwipeGesture({
      startX: 100,
      startY: 150,
      endX: 205, // dx = 105
      endY: 145, // dy = -5
      startTime: 1000,
      endTime: 1250,
    });
    expect(gesture.isStrongSwipe).toBe(true);
    expect(gesture.direction).toBe("right");
    expect(gesture.deltaX).toBe(105);
  });

  it("detects large distance horizontal drag even if duration is longer", () => {
    const gesture = detectSwipeGesture({
      startX: 300,
      startY: 150,
      endX: 160, // dx = -140 >= largeDistance (120)
      endY: 160,
      startTime: 1000,
      endTime: 2000,
    });
    expect(gesture.isStrongSwipe).toBe(true);
    expect(gesture.direction).toBe("left");
  });
});

describe("isInteractiveElement", () => {
  it("returns false for null or undefined target", () => {
    expect(isInteractiveElement(null)).toBe(false);
    expect(isInteractiveElement(undefined)).toBe(false);
  });

  it("returns true for button or slider elements", () => {
    const mockBtn = {
      closest: (sel) => (sel.includes("button") ? {} : null),
    };
    expect(isInteractiveElement(mockBtn)).toBe(true);

    const mockSlider = {
      closest: (sel) => (sel.includes("role=\"slider\"") ? {} : null),
    };
    expect(isInteractiveElement(mockSlider)).toBe(true);
  });

  it("returns false for non-interactive text elements", () => {
    const mockSpan = {
      closest: () => null,
    };
    expect(isInteractiveElement(mockSpan)).toBe(false);
  });
});

describe("clampVerseNumber", () => {
  it("keeps verse within limits if surah has enough ayahs", () => {
    expect(clampVerseNumber(15, 286)).toBe(15);
    expect(clampVerseNumber(1, 7)).toBe(1);
    expect(clampVerseNumber(7, 7)).toBe(7);
  });

  it("clamps to max ayahs when target surah has fewer ayahs", () => {
    // Al-Baqarah verse 25 -> Al-Fatiha (7 ayahs) clamped to 7
    expect(clampVerseNumber(25, 7)).toBe(7);
    // Verse 100 -> Al-Kawthar (3 ayahs) clamped to 3
    expect(clampVerseNumber(100, 3)).toBe(3);
  });

  it("defaults to verse 1 on invalid or 0 values", () => {
    expect(clampVerseNumber(0, 10)).toBe(1);
    expect(clampVerseNumber(-5, 10)).toBe(1);
    expect(clampVerseNumber("invalid", 10)).toBe(1);
  });
});

describe("resolveTargetSurahNumber", () => {
  it("navigates to next surah on left swipe", () => {
    expect(resolveTargetSurahNumber({ currentSurahNum: 1, direction: "left" })).toBe(2);
    expect(resolveTargetSurahNumber({ currentSurahNum: 113, direction: "left" })).toBe(114);
  });

  it("returns null at last surah (114) when swiping left", () => {
    expect(resolveTargetSurahNumber({ currentSurahNum: 114, direction: "left" })).toBeNull();
  });

  it("navigates to previous surah on right swipe", () => {
    expect(resolveTargetSurahNumber({ currentSurahNum: 2, direction: "right" })).toBe(1);
    expect(resolveTargetSurahNumber({ currentSurahNum: 114, direction: "right" })).toBe(113);
  });

  it("returns null at first surah (1) when swiping right", () => {
    expect(resolveTargetSurahNumber({ currentSurahNum: 1, direction: "right" })).toBeNull();
  });
});

describe("resolveActiveAyatNumber", () => {
  it("prioritizes openAyatNum if open", () => {
    const res = resolveActiveAyatNumber({
      openAyatNum: 25,
      playingAyatNum: 10,
      mainAyatIdx: 5,
      ayats: [{ numberInSurah: 1 }, { numberInSurah: 5 }],
    });
    expect(res).toBe(25);
  });

  it("uses playingAyatNum if openAyatNum is null", () => {
    const res = resolveActiveAyatNumber({
      openAyatNum: null,
      playingAyatNum: 12,
      mainAyatIdx: 2,
    });
    expect(res).toBe(12);
  });

  it("uses first visible element in container when scrollContainer is provided", () => {
    const mockContainer = {
      getBoundingClientRect: () => ({ top: 100, bottom: 600 }),
    };
    const mockRefs = {
      1: { getBoundingClientRect: () => ({ top: -200, bottom: 50 }) },
      2: { getBoundingClientRect: () => ({ top: 120, bottom: 250 }) },
      3: { getBoundingClientRect: () => ({ top: 260, bottom: 400 }) },
    };
    const res = resolveActiveAyatNumber({
      scrollContainerEl: mockContainer,
      ayatRefs: mockRefs,
      ayats: [{ numberInSurah: 1 }, { numberInSurah: 2 }, { numberInSurah: 3 }],
      mainAyatIdx: 0,
    });
    expect(res).toBe(2);
  });

  it("falls back to ayats[mainAyatIdx] or 1", () => {
    const res = resolveActiveAyatNumber({
      mainAyatIdx: 1,
      ayats: [{ numberInSurah: 1 }, { numberInSurah: 8 }],
    });
    expect(res).toBe(8);

    const fallback = resolveActiveAyatNumber({});
    expect(fallback).toBe(1);
  });
});

describe("computeSurahSwipeNavigation", () => {
  it("successfully navigates forward on left swipe and preserves same verse number", () => {
    const gesture = { isStrongSwipe: true, direction: "left" };
    const currentSurah = { number: 1, numberOfAyahs: 7, englishName: "Al-Fatiha" };
    const currentAyatNum = 5;

    const nav = computeSurahSwipeNavigation({
      gesture,
      currentSurah,
      currentAyatNum,
      surahs: mockSurahs,
    });

    expect(nav.canNavigate).toBe(true);
    expect(nav.targetSurahNum).toBe(2);
    expect(nav.targetSurah.englishName).toBe("Al-Baqarah");
    expect(nav.targetAyatNum).toBe(5); // Preserves same verse number!
    expect(nav.wasClamped).toBe(false);
    expect(nav.feedbackMessage).toContain("Al-Baqarah");
    expect(nav.feedbackMessage).toContain("Verset 5");
  });

  it("successfully clamps verse number when target surah has fewer ayahs", () => {
    // Current surah Al-Baqarah (286 ayahs), on verse 20
    const gesture = { isStrongSwipe: true, direction: "right" }; // Swiping right -> prev surah (Al-Fatiha, 7 ayahs)
    const currentSurah = { number: 2, numberOfAyahs: 286, englishName: "Al-Baqarah" };
    const currentAyatNum = 20;

    const nav = computeSurahSwipeNavigation({
      gesture,
      currentSurah,
      currentAyatNum,
      surahs: mockSurahs,
    });

    expect(nav.canNavigate).toBe(true);
    expect(nav.targetSurahNum).toBe(1);
    expect(nav.targetSurah.englishName).toBe("Al-Fatiha");
    expect(nav.targetAyatNum).toBe(7); // Clamped to 7 because Al-Fatiha has only 7 ayahs!
    expect(nav.wasClamped).toBe(true);
    expect(nav.feedbackMessage).toContain("ajusté de v.20");
  });

  it("blocks navigation at first surah (Al-Fatiha) when swiping right", () => {
    const gesture = { isStrongSwipe: true, direction: "right" };
    const currentSurah = { number: 1, numberOfAyahs: 7, englishName: "Al-Fatiha" };

    const nav = computeSurahSwipeNavigation({
      gesture,
      currentSurah,
      currentAyatNum: 3,
      surahs: mockSurahs,
    });

    expect(nav.canNavigate).toBe(false);
    expect(nav.reason).toBe("AT_FIRST_SURAH");
    expect(nav.feedbackMessage).toContain("Première sourate atteinte");
  });

  it("blocks navigation at last surah (An-Nas) when swiping left", () => {
    const gesture = { isStrongSwipe: true, direction: "left" };
    const currentSurah = { number: 114, numberOfAyahs: 6, englishName: "An-Nas" };

    const nav = computeSurahSwipeNavigation({
      gesture,
      currentSurah,
      currentAyatNum: 2,
      surahs: mockSurahs,
    });

    expect(nav.canNavigate).toBe(false);
    expect(nav.reason).toBe("AT_LAST_SURAH");
    expect(nav.feedbackMessage).toContain("Dernière sourate atteinte");
  });

  it("does not navigate if gesture is not a strong swipe", () => {
    const gesture = { isStrongSwipe: false, direction: null };
    const nav = computeSurahSwipeNavigation({
      gesture,
      currentSurah: { number: 2, numberOfAyahs: 286 },
      currentAyatNum: 10,
      surahs: mockSurahs,
    });
    expect(nav.canNavigate).toBe(false);
    expect(nav.reason).toBe("NOT_A_SWIPE");
  });
});

describe("formatSwipeToastMessage", () => {
  it("formats standard swipe message", () => {
    const msg = formatSwipeToastMessage({
      direction: "left",
      targetSurah: { number: 3, englishName: "Aal-i-Imraan" },
      targetAyatNum: 12,
      wasClamped: false,
      originalAyatNum: 12,
    });
    expect(msg).toBe("➡️ Aal-i-Imraan (3) · Verset 12");
  });

  it("formats clamped swipe message", () => {
    const msg = formatSwipeToastMessage({
      direction: "right",
      targetSurah: { number: 108, englishName: "Al-Kawthar" },
      targetAyatNum: 3,
      wasClamped: true,
      originalAyatNum: 50,
    });
    expect(msg).toBe("⬅️ Al-Kawthar (108) · Verset 3 (ajusté de v.50)");
  });
});

describe("computeSurahNavigationByDirection (button-based navigation)", () => {
  it("navigates to next surah on 'next' button click and preserves same verse number", () => {
    const res = computeSurahNavigationByDirection({
      direction: "next",
      currentSurah: { number: 1, numberOfAyahs: 7, englishName: "Al-Fatiha" },
      currentAyatNum: 4,
      surahs: mockSurahs,
    });
    expect(res.canNavigate).toBe(true);
    expect(res.targetSurahNum).toBe(2);
    expect(res.targetAyatNum).toBe(4);
    expect(res.wasClamped).toBe(false);
    expect(res.feedbackMessage).toContain("Al-Baqarah");
  });

  it("navigates to previous surah on 'prev' button click and clamps verse if needed", () => {
    const res = computeSurahNavigationByDirection({
      direction: "prev",
      currentSurah: { number: 2, numberOfAyahs: 286, englishName: "Al-Baqarah" },
      currentAyatNum: 15,
      surahs: mockSurahs,
    });
    expect(res.canNavigate).toBe(true);
    expect(res.targetSurahNum).toBe(1);
    expect(res.targetAyatNum).toBe(7); // Clamped from 15 to 7!
    expect(res.wasClamped).toBe(true);
  });

  it("blocks navigation at first surah (1) when clicking previous button", () => {
    const res = computeSurahNavigationByDirection({
      direction: "prev",
      currentSurah: { number: 1, numberOfAyahs: 7 },
      currentAyatNum: 1,
      surahs: mockSurahs,
    });
    expect(res.canNavigate).toBe(false);
    expect(res.reason).toBe("AT_FIRST_SURAH");
    expect(res.feedbackMessage).toContain("Première sourate atteinte");
  });

  it("blocks navigation at last surah (114) when clicking next button", () => {
    const res = computeSurahNavigationByDirection({
      direction: "next",
      currentSurah: { number: 114, numberOfAyahs: 6 },
      currentAyatNum: 1,
      surahs: mockSurahs,
    });
    expect(res.canNavigate).toBe(false);
    expect(res.reason).toBe("AT_LAST_SURAH");
    expect(res.feedbackMessage).toContain("Dernière sourate atteinte");
  });

  it("returns error on invalid direction", () => {
    const res = computeSurahNavigationByDirection({
      direction: "invalid",
      currentSurah: { number: 2 },
      currentAyatNum: 1,
      surahs: mockSurahs,
    });
    expect(res.canNavigate).toBe(false);
    expect(res.reason).toBe("INVALID_DIRECTION");
  });
});

describe("calculateTouchDistance", () => {
  it("calculates accurate euclidean distance between two touch points", () => {
    const t1 = { clientX: 100, clientY: 100 };
    const t2 = { clientX: 130, clientY: 140 }; // dx = 30, dy = 40 -> hypot = 50
    expect(calculateTouchDistance(t1, t2)).toBe(50);
  });

  it("returns 0 if either touch point is missing", () => {
    expect(calculateTouchDistance(null, { clientX: 10 })).toBe(0);
    expect(calculateTouchDistance({ clientX: 10 }, null)).toBe(0);
  });
});

describe("detectPinchGesture", () => {
  it("detects pinch-to-zoom out (increasing distance enlarges font size)", () => {
    const pinch = detectPinchGesture({
      initialDistance: 100,
      currentDistance: 150, // 1.5x scale
      initialFontSize: 24,
      minFontSize: 16,
      maxFontSize: 48,
    });
    expect(pinch.isPinching).toBe(true);
    expect(pinch.scaleRatio).toBe(1.5);
    expect(pinch.newFontSize).toBe(36); // 24 * 1.5 = 36
    expect(pinch.deltaFontSize).toBe(12);
  });

  it("detects pinch-to-zoom in (decreasing distance shrinks font size)", () => {
    const pinch = detectPinchGesture({
      initialDistance: 100,
      currentDistance: 80, // 0.8x scale
      initialFontSize: 30,
      minFontSize: 16,
      maxFontSize: 48,
    });
    expect(pinch.isPinching).toBe(true);
    expect(pinch.scaleRatio).toBe(0.8);
    expect(pinch.newFontSize).toBe(24); // 30 * 0.8 = 24
  });

  it("clamps font size to maxFontSize and minFontSize", () => {
    const zoomedInTooMuch = detectPinchGesture({
      initialDistance: 50,
      currentDistance: 250, // 5x scale
      initialFontSize: 30,
      minFontSize: 16,
      maxFontSize: 48,
    });
    expect(zoomedInTooMuch.newFontSize).toBe(48);

    const zoomedOutTooMuch = detectPinchGesture({
      initialDistance: 200,
      currentDistance: 30,
      initialFontSize: 24,
      minFontSize: 16,
      maxFontSize: 48,
    });
    expect(zoomedOutTooMuch.newFontSize).toBe(16);
  });

  it("ignores micro adjustments below threshold", () => {
    const subtle = detectPinchGesture({
      initialDistance: 100,
      currentDistance: 105,
      initialFontSize: 26,
    });
    expect(subtle.isPinching).toBe(false);
  });
});

describe("detectPlayerGesture", () => {
  it("detects double tap to toggle play/pause", () => {
    const res = detectPlayerGesture({
      startX: 150,
      startY: 200,
      endX: 152,
      endY: 201,
      startTime: 1000,
      endTime: 1100,
      lastTapTime: 900, // 200ms ago -> within 350ms window
      doubleTapWindow: 350,
    });
    expect(res.action).toBe("toggle_play");
    expect(res.isDoubleTap).toBe(true);
  });

  it("detects single tap when not within double-tap window", () => {
    const res = detectPlayerGesture({
      startX: 150,
      startY: 200,
      endX: 151,
      endY: 200,
      startTime: 2000,
      endTime: 2100,
      lastTapTime: 1000, // 1100ms ago -> exceeds doubleTapWindow
    });
    expect(res.action).toBe("tap");
    expect(res.isDoubleTap).toBe(false);
  });

  it("detects swipe up on player to open audio options", () => {
    const res = detectPlayerGesture({
      startX: 150,
      startY: 300,
      endX: 155,
      endY: 240, // dy = -60 (upward movement)
      startTime: 1000,
      endTime: 1200,
    });
    expect(res.action).toBe("open_options");
  });

  it("detects horizontal swipe left on player for next verse", () => {
    const res = detectPlayerGesture({
      startX: 250,
      startY: 300,
      endX: 170, // dx = -80
      endY: 305,
      startTime: 1000,
      endTime: 1250,
    });
    expect(res.action).toBe("next");
  });

  it("detects horizontal swipe right on player for previous verse", () => {
    const res = detectPlayerGesture({
      startX: 100,
      startY: 300,
      endX: 180, // dx = +80
      endY: 298,
      startTime: 1000,
      endTime: 1250,
    });
    expect(res.action).toBe("prev");
  });
});

describe("detectSheetDismissGesture", () => {
  it("detects downward pull gesture to dismiss modal", () => {
    const res = detectSheetDismissGesture({
      startY: 100,
      endY: 180, // dy = +80
      startX: 200,
      endX: 205, // dx = 5
      minDismissDistance: 55,
    });
    expect(res.shouldDismiss).toBe(true);
    expect(res.deltaY).toBe(80);
  });

  it("rejects upward drag or horizontal drag", () => {
    const upward = detectSheetDismissGesture({
      startY: 200,
      endY: 120, // dy = -80
      startX: 200,
      endX: 200,
    });
    expect(upward.shouldDismiss).toBe(false);

    const horizontal = detectSheetDismissGesture({
      startY: 100,
      endY: 140, // dy = 40
      startX: 100,
      endX: 250, // dx = 150
    });
    expect(horizontal.shouldDismiss).toBe(false);
  });
});

describe("detectEdgeSwipeGesture", () => {
  it("opens drawer on swipe right starting near left screen edge", () => {
    const res = detectEdgeSwipeGesture({
      startX: 15, // <= 35px from edge
      endX: 95, // dx = 80 >= 50
      startY: 200,
      endY: 205,
      isOpen: false,
    });
    expect(res.action).toBe("open_drawer");
  });

  it("does not open drawer if swipe did not start from screen edge", () => {
    const res = detectEdgeSwipeGesture({
      startX: 120, // Not near edge
      endX: 200,
      startY: 200,
      endY: 205,
      isOpen: false,
    });
    expect(res.action).toBeNull();
  });

  it("closes drawer on swipe left when drawer is open", () => {
    const res = detectEdgeSwipeGesture({
      startX: 220,
      endX: 140, // dx = -80
      startY: 200,
      endY: 205,
      isOpen: true,
    });
    expect(res.action).toBe("close_drawer");
  });
});

describe("detectTabSwipeGesture", () => {
  const tabs = ["tajweed", "silence", "loop", "reciter"];

  it("swipes left to advance to next tab", () => {
    const res = detectTabSwipeGesture({
      startX: 250,
      endX: 180, // dx = -70
      startY: 100,
      endY: 105,
      currentTab: "tajweed",
      tabs,
    });
    expect(res.shouldChange).toBe(true);
    expect(res.targetTab).toBe("silence");
    expect(res.direction).toBe("next");
  });

  it("swipes right to retreat to previous tab", () => {
    const res = detectTabSwipeGesture({
      startX: 150,
      endX: 230, // dx = +80
      startY: 100,
      endY: 98,
      currentTab: "loop",
      tabs,
    });
    expect(res.shouldChange).toBe(true);
    expect(res.targetTab).toBe("silence");
    expect(res.direction).toBe("prev");
  });

  it("does not advance beyond boundary tabs", () => {
    const atLast = detectTabSwipeGesture({
      startX: 250,
      endX: 180,
      currentTab: "reciter",
      tabs,
    });
    expect(atLast.shouldChange).toBe(false);

    const atFirst = detectTabSwipeGesture({
      startX: 150,
      endX: 230,
      currentTab: "tajweed",
      tabs,
    });
    expect(atFirst.shouldChange).toBe(false);
  });
});

