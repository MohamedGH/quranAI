// ─── Pure Functional Quiz Utilities ───────────────────────────────────────────
import { ERROR_CODES, createAppError, trySync } from "./errorManager.js";

/**
 * Calculates quiz points awarded for a correct answer with streak multipliers.
 */
export const calculateQuizPoints = (streak = 0, base = 100, timeBonus = 0) => {
  const s = Math.max(0, Number(streak) || 0);
  const b = Math.max(0, Number(base) || 100);
  const tb = Math.max(0, Number(timeBonus) || 0);
  const streakBonus = Math.min(100, s * 15);
  return b + streakBonus + tb;
};

/**
 * Returns streak milestone message and multiplier.
 */
export const getStreakCelebration = (streak = 0) => {
  const s = Math.max(0, Number(streak) || 0);
  if (s < 3) return null;
  if (s < 5) {
    return Object.freeze({
      badge: "🔥",
      label: "3 d'affilée !",
      sub: "Belle concentration",
      multiplier: 1.2,
      color: "#f39c12",
    });
  }
  if (s < 10) {
    return Object.freeze({
      badge: "⚡",
      label: `${s} d'affilée !`,
      sub: "En grande forme",
      multiplier: 1.5,
      color: "#e67e22",
    });
  }
  if (s < 15) {
    return Object.freeze({
      badge: "🌟",
      label: `Superbe série : ${s} !`,
      sub: "Mémorisation solide",
      multiplier: 2.0,
      color: "#e74c3c",
    });
  }
  return Object.freeze({
    badge: "👑",
    label: `Série magistrale : ${s} !`,
    sub: "Excellence coranique",
    multiplier: 2.5,
    color: "#9b59b6",
  });
};

/**
 * Formats seconds into MM:SS.
 */
export const formatQuizTimer = (totalSeconds = 0) => {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

/**
 * Pure calculation of a quiz session summary.
 */
export const computeSessionSummary = (results = [], durationSec = 0, bestStreak = 0, totalScore = 0) => {
  const res = Array.isArray(results) ? results : [];
  const total = res.length;
  const correct = res.filter((r) => r.correct).length;
  const incorrect = total - correct;
  const accuracyPct = total > 0 ? Math.round((correct / total) * 100) : 0;

  let evaluation = "Continue tes efforts !";
  if (accuracyPct === 100 && total > 0) evaluation = "Parfait ! Maîtrise totale 🌟";
  else if (accuracyPct >= 80) evaluation = "Très bien ! Excellente révision ✓";
  else if (accuracyPct >= 60) evaluation = "Bon travail, quelques versets à consolider.";

  return Object.freeze({
    total,
    correct,
    incorrect,
    accuracyPct,
    durationSec: Math.max(0, durationSec),
    formattedDuration: formatQuizTimer(durationSec),
    bestStreak: Math.max(0, bestStreak),
    totalScore: Math.max(0, totalScore),
    evaluation,
  });
};

/**
 * Filters questions to only those corresponding to mistakes in a session.
 */
export const filterQuestionsForReview = (questions = [], mistakesList = []) => {
  if (!Array.isArray(questions) || !Array.isArray(mistakesList) || mistakesList.length === 0) {
    return [];
  }
  const mistakeIds = new Set(mistakesList.map((m) => m.qId).filter(Boolean));
  return questions.filter((q) => mistakeIds.has(q.id));
};

/**
 * Synthesizes subtle UI sounds using Web Audio API (100% offline, zero asset dependencies).
 */
export const playQuizSound = (type = "correct", enabled = true) => {
  if (!enabled || typeof window === "undefined") return;
  trySync(() => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === "correct") {
      // Ascending major chime (G4 -> C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(392, now);
      osc1.frequency.setValueAtTime(523.25, now + 0.1);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);
    } else if (type === "streak") {
      // Arpeggiated joyful chord
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.15, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.3);
      });
    } else if (type === "incorrect") {
      // Soft gentle descending tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(180, now + 0.22);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "tick") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  }, null, { code: ERROR_CODES.QUIZ_ERROR, type });
};
