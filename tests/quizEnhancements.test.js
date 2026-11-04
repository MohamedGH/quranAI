import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateQuizPoints,
  getStreakCelebration,
  formatQuizTimer,
  computeSessionSummary,
  filterQuestionsForReview,
  playQuizSound,
} from "../src/utils/quizUtils.js";
import { store, sel, quizActions } from "../src/store.js";
import { buildQuizRoute, parseQuizRoute } from "../src/utils/routeManager.js";
import { ERROR_CODES, createAppError } from "../src/utils/errorManager.js";

describe("Quiz Enhancements & Pure Functions", () => {
  describe("quizUtils - calculateQuizPoints", () => {
    it("awards base 100 points for a correct answer with 0 streak and no time bonus", () => {
      const pts = calculateQuizPoints(0, 100, 0);
      expect(pts).toBe(100);
    });

    it("calculates streak bonuses and caps streak bonus at 100 points", () => {
      const ptsStreak2 = calculateQuizPoints(2, 100, 0);
      expect(ptsStreak2).toBe(130); // 100 base + 2*15

      const ptsStreak10 = calculateQuizPoints(10, 100, 0);
      expect(ptsStreak10).toBe(200); // 100 base + min(100, 10*15=150) = 200
    });

    it("adds time bonus when provided", () => {
      const pts = calculateQuizPoints(3, 100, 25);
      // 100 base + 3*15 (45) + 25 = 170
      expect(pts).toBe(170);
    });
  });

  describe("quizUtils - getStreakCelebration", () => {
    it("returns null for streaks under 3", () => {
      expect(getStreakCelebration(0)).toBeNull();
      expect(getStreakCelebration(1)).toBeNull();
      expect(getStreakCelebration(2)).toBeNull();
    });

    it("returns appropriate celebrations for milestones 3, 5, 10, and 15+", () => {
      const c3 = getStreakCelebration(3);
      expect(c3).toBeDefined();
      expect(c3.label).toContain("3 d'affilée");

      const c5 = getStreakCelebration(5);
      expect(c5).toBeDefined();
      expect(c5.label).toContain("5 d'affilée");

      const c10 = getStreakCelebration(10);
      expect(c10).toBeDefined();
      expect(c10.label).toContain("10 !");

      const c15 = getStreakCelebration(15);
      expect(c15).toBeDefined();
      expect(c15.label).toContain("15 !");

      const c20 = getStreakCelebration(20);
      expect(c20).toBeDefined();
      expect(c20.label).toContain("20 !");
    });
  });

  describe("quizUtils - formatQuizTimer", () => {
    it("formats zero and small numbers as MM:SS", () => {
      expect(formatQuizTimer(0)).toBe("00:00");
      expect(formatQuizTimer(9)).toBe("00:09");
      expect(formatQuizTimer(15)).toBe("00:15");
      expect(formatQuizTimer(59)).toBe("00:59");
    });

    it("formats minutes and seconds accurately", () => {
      expect(formatQuizTimer(60)).toBe("01:00");
      expect(formatQuizTimer(75)).toBe("01:15");
      expect(formatQuizTimer(615)).toBe("10:15");
    });

    it("handles negative or non-finite numbers safely", () => {
      expect(formatQuizTimer(-5)).toBe("00:00");
      expect(formatQuizTimer(null)).toBe("00:00");
      expect(formatQuizTimer(undefined)).toBe("00:00");
    });
  });

  describe("quizUtils - computeSessionSummary", () => {
    it("computes accurate percentage and stats for full success session", () => {
      const results = Array.from({ length: 10 }, () => ({ correct: true }));
      const summary = computeSessionSummary(results, 120, 10, 1800);

      expect(summary.accuracyPct).toBe(100);
      expect(summary.evaluation).toContain("Parfait");
      expect(summary.total).toBe(10);
      expect(summary.correct).toBe(10);
      expect(summary.incorrect).toBe(0);
      expect(summary.formattedDuration).toBe("02:00");
    });

    it("computes accurate percentage and encouragement for partial success", () => {
      const results = [
        { correct: true },
        { correct: true },
        { correct: true },
        { correct: false },
      ];
      const summary = computeSessionSummary(results, 45, 3, 350);

      expect(summary.accuracyPct).toBe(75);
      expect(summary.evaluation).toContain("Bon travail");
      expect(summary.incorrect).toBe(1);
      expect(summary.correct).toBe(3);
    });

    it("handles zero total questions gracefully", () => {
      const summary = computeSessionSummary([], 0, 0, 0);
      expect(summary.accuracyPct).toBe(0);
      expect(summary.evaluation).toBe("Continue tes efforts !");
    });
  });

  describe("quizUtils - filterQuestionsForReview", () => {
    it("filters an array of questions to only those matching mistakes", () => {
      const allQuestions = [
        { id: "q1", sn: 1, an: 1, text: "Verset 1" },
        { id: "q2", sn: 1, an: 2, text: "Verset 2" },
        { id: "q3", sn: 1, an: 3, text: "Verset 3" },
        { id: "q4", sn: 112, an: 1, text: "Sourate 112:1" },
      ];

      const mistakes = [
        { qId: "q2", sn: 1, ayatNum: 2 },
        { qId: "q4", sn: 112, ayatNum: 1 },
      ];

      const reviewSet = filterQuestionsForReview(allQuestions, mistakes);
      expect(reviewSet).toHaveLength(2);
      expect(reviewSet.map(q => q.id)).toEqual(["q2", "q4"]);
    });

    it("returns empty array if mistakes list is empty", () => {
      const allQuestions = [{ id: "q1", sn: 1, an: 1 }];
      expect(filterQuestionsForReview(allQuestions, [])).toEqual([]);
    });
  });

  describe("quizUtils - playQuizSound", () => {
    it("executes without throwing even in environments without Web Audio API", () => {
      expect(() => playQuizSound("correct", true)).not.toThrow();
      expect(() => playQuizSound("streak", true)).not.toThrow();
      expect(() => playQuizSound("incorrect", true)).not.toThrow();
      expect(() => playQuizSound("tick", false)).not.toThrow();
    });
  });
});

describe("Quiz Redux State Manager (quizSlice)", () => {
  beforeEach(() => {
    store.dispatch(quizActions.resetQuizSession());
    store.dispatch(quizActions.clearQuizMistakes());
  });

  it("has valid initial quiz state and selectors", () => {
    const s = store.getState();
    expect(sel.quizStreak(s)).toBe(0);
    expect(sel.quizScore(s)).toBe(0);
    expect(sel.quizTimerMode(s)).toBeDefined();
    expect(sel.quizSoundEffects(s)).toBe(true);
    expect(sel.quizMistakes(s)).toEqual([]);
  });

  it("updates streak, bestStreak, and score on correct answers", () => {
    store.dispatch(
      quizActions.recordQuizAnswer({
        isCorrect: true,
        sn: 1,
        ayatNum: 1,
        timeBonus: 10,
      })
    );

    let state = store.getState();
    expect(sel.quizStreak(state)).toBe(1);
    expect(sel.quizBestStreak(state)).toBe(1);
    expect(sel.quizScore(state)).toBe(125); // 100 + 15 (streak) + 10 (bonus)

    // Record second correct answer
    store.dispatch(
      quizActions.recordQuizAnswer({
        isCorrect: true,
        sn: 1,
        ayatNum: 2,
        timeBonus: 0,
      })
    );

    state = store.getState();
    expect(sel.quizStreak(state)).toBe(2);
    expect(sel.quizBestStreak(state)).toBe(2);
    // 125 + (100 + 30) = 255
    expect(sel.quizScore(state)).toBe(255);
  });

  it("resets current streak and logs mistakes on incorrect answers without resetting bestStreak", () => {
    // First get a streak of 2
    store.dispatch(quizActions.recordQuizAnswer({ isCorrect: true }));
    store.dispatch(quizActions.recordQuizAnswer({ isCorrect: true }));
    expect(sel.quizStreak(store.getState())).toBe(2);
    expect(sel.quizBestStreak(store.getState())).toBe(2);

    // Fail next question
    store.dispatch(
      quizActions.recordQuizAnswer({
        isCorrect: false,
        sn: 112,
        ayatNum: 2,
        qId: "q_112_2",
        type: "first_word",
        question: "Premier mot de Al-Ikhlas:2 ?",
        answer: "اللَّهُ",
        userAnswer: "قُلْ",
      })
    );

    const state = store.getState();
    expect(sel.quizStreak(state)).toBe(0);
    expect(sel.quizBestStreak(state)).toBe(2);
    const mistakes = sel.quizMistakes(state);
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0].sn).toBe(112);
    expect(mistakes[0].ayatNum).toBe(2);
    expect(mistakes[0].userAnswer).toBe("قُلْ");
  });

  it("configures timer mode and sets corresponding timeRemaining", () => {
    store.dispatch(quizActions.setQuizTimerMode("15s"));
    let state = store.getState();
    expect(sel.quizTimerMode(state)).toBe("15s");
    expect(sel.quizTimeRemaining(state)).toBe(15);

    store.dispatch(quizActions.decrementTimeRemaining());
    expect(sel.quizTimeRemaining(store.getState())).toBe(14);

    store.dispatch(quizActions.setQuizTimerMode("off"));
    state = store.getState();
    expect(sel.quizTimerMode(state)).toBe("off");
    expect(sel.quizTimeRemaining(state)).toBe(0);
  });

  it("toggles sound effects", () => {
    const initial = sel.quizSoundEffects(store.getState());
    store.dispatch(quizActions.toggleQuizSound());
    expect(sel.quizSoundEffects(store.getState())).toBe(!initial);
    store.dispatch(quizActions.toggleQuizSound());
    expect(sel.quizSoundEffects(store.getState())).toBe(initial);
  });

  it("saves and retrieves quiz session summaries", () => {
    const summaryData = {
      score: 450,
      accuracy: 85,
      total: 10,
      timestamp: new Date().toISOString(),
    };
    store.dispatch(quizActions.saveQuizSummary(summaryData));
    expect(sel.quizLastSummary(store.getState())).toEqual(summaryData);
  });
});

describe("Quiz Route Manager Integration", () => {
  it("builds clean multi-surah quiz routes with query params", () => {
    const route = buildQuizRoute({ timer: "30s", preset: "first_contact" });
    expect(route).toBe("/revision/questions?preset=first_contact&timer=30s");
  });

  it("builds mono-surah quiz routes with path segments and timer query", () => {
    const route = buildQuizRoute({
      sn: 114,
      rf: 1,
      rt: 6,
      qi: 3,
      timer: "15s",
    });
    expect(route).toBe("/revision/questions/114/1/6/3?timer=15s");
  });

  it("parses quiz routes accurately with params and timer", () => {
    const parsed = parseQuizRoute("/revision/questions/112/1/4/2", "?timer=60s&preset=first_contact");
    expect(parsed.isQuiz).toBe(true);
    expect(parsed.surahNum).toBe(112);
    expect(parsed.rangeFrom).toBe(1);
    expect(parsed.rangeTo).toBe(4);
    expect(parsed.qIdx).toBe(2);
    expect(parsed.timer).toBe("60s");
    expect(parsed.preset).toBe("first_contact");
  });

  it("handles non-quiz routes safely", () => {
    const parsed = parseQuizRoute("/dashboard", "");
    expect(parsed.isQuiz).toBe(false);
    expect(parsed.surahNum).toBeNull();
  });
});

describe("Quiz Error Manager Integration", () => {
  it("defines QUIZ_ERROR code in ERROR_CODES", () => {
    expect(ERROR_CODES.QUIZ_ERROR).toBe("QUIZ_ERROR");
  });

  it("creates standard app error for quiz events", () => {
    const err = createAppError(ERROR_CODES.QUIZ_ERROR, "Échec de génération des questions de révision", {
      surahNum: 1,
      range: "1-7",
    });
    expect(err.code).toBe("QUIZ_ERROR");
    expect(err.message).toContain("Échec de génération");
    expect(err.context.surahNum).toBe(1);
  });
});
