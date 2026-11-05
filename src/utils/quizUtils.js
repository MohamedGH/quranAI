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
 * Returns formatted streak multiplier string (e.g. 'x1.0', 'x1.2', 'x1.5', 'x2.0', 'x2.5').
 */
export const formatStreakMultiplier = (streak = 0) => {
  const celebration = getStreakCelebration(streak);
  const mult = celebration ? celebration.multiplier : 1.0;
  return `x${mult.toFixed(1)}`;
};

/**
 * Returns human-readable label for Tajweed toggle.
 */
export const getTajweedToggleLabel = (enabled = true) => {
  return enabled ? "🎨 Tajwîd actif" : "🎨 Tajwîd masqué";
};

/**
 * Maps font size level ('sm' | 'md' | 'lg' | 'xl') to inline typography styles.
 */
export const getFontSizeStyle = (sizeLevel = "md") => {
  switch (sizeLevel) {
    case "sm":
      return Object.freeze({ fontSize: "1.25rem", lineHeight: "2.2rem" });
    case "lg":
      return Object.freeze({ fontSize: "1.9rem", lineHeight: "3.2rem" });
    case "xl":
      return Object.freeze({ fontSize: "2.3rem", lineHeight: "3.8rem" });
    case "md":
    default:
      return Object.freeze({ fontSize: "1.55rem", lineHeight: "2.7rem" });
  }
};

/**
 * Groups mistakes by question type with human-readable French labels and counts.
 */
export const computeMistakesSummaryByCategory = (mistakes = []) => {
  if (!Array.isArray(mistakes) || mistakes.length === 0) return [];

  const TYPE_NAMES = {
    first_word: "Premier mot",
    last_word: "Dernier mot",
    missing_word: "Mot manquant",
    next_verse: "Verset suivant",
    previous_verse: "Verset précédent",
    verse_number: "Numéro de verset",
    find_ayat: "Trouver le verset",
    find_surah: "Trouver la sourate",
    reconstruct: "Reconstitution",
    unknown_word: "Mots inconnus",
    first_contact: "Premier contact",
  };

  const counts = {};
  mistakes.forEach((m) => {
    const typeKey = m.type || "autre";
    counts[typeKey] = (counts[typeKey] || 0) + 1;
  });

  return Object.keys(counts)
    .map((type) => ({
      type,
      label: TYPE_NAMES[type] || type,
      count: counts[type],
    }))
    .sort((a, b) => b.count - a.count);
};

/**
 * Builds a clean collection payload from mistakes for Redux collections.
 */
export const createMistakesCollectionPayload = (mistakes = [], contextName = "") => {
  if (!Array.isArray(mistakes) || mistakes.length === 0) return null;

  // Deduplicate by sn:ayatNum
  const seen = new Set();
  const ayats = [];
  mistakes.forEach((m) => {
    if (m.sn && m.ayatNum) {
      const key = `${m.sn}:${m.ayatNum}`;
      if (!seen.has(key)) {
        seen.add(key);
        ayats.push({ sn: m.sn, ayatNum: m.ayatNum });
      }
    }
  });

  if (ayats.length === 0) return null;

  const now = new Date();
  const dateStr = `${now.getHours()}h${String(now.getMinutes()).padStart(2, "0")}`;
  const prefix = contextName ? `Erreurs Quiz (${contextName})` : "Erreurs Quiz";
  const name = `${prefix} · ${dateStr}`;

  return Object.freeze({
    name,
    ayats,
    totalAyats: ayats.length,
    createdAt: now.toISOString(),
  });
};

/**
 * Calculates optimal audio clue duration for first-word hint from verse timestamps.
 */
export const calculateAudioClueDuration = (timestamps, defaultSec = 1.3) => {
  if (!timestamps || !Array.isArray(timestamps.words) || timestamps.words.length === 0) {
    return defaultSec;
  }
  const firstWord = timestamps.words[0];
  const firstWordChars = firstWord?.chars || [];
  const endMs = firstWordChars.length > 0 ? firstWordChars[firstWordChars.length - 1]?.end : null;

  if (typeof endMs === "number" && endMs > 0) {
    // Clamp duration between 0.8s and 2.5s for ideal first-word audio clue
    return Math.min(2.5, Math.max(0.8, Number((endMs / 1000).toFixed(2))));
  }
  return defaultSec;
};

/**
 * Detects touch swipe direction from coordinates (pure functional).
 * Returns 'left' | 'right' | 'up' | 'down' | null.
 */
export const detectSwipeDirection = ({
  startX = 0,
  startY = 0,
  endX = 0,
  endY = 0,
  minDistance = 60,
  maxVerticalRatio = 1.5,
} = {}) => {
  const dx = endX - startX;
  const dy = endY - startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx >= minDistance && absDx >= absDy * maxVerticalRatio) {
    return dx < 0 ? "left" : "right";
  }
  if (absDy >= minDistance && absDy >= absDx * maxVerticalRatio) {
    return dy < 0 ? "up" : "down";
  }
  return null;
};

/**
 * Estimates total questions generated for a given number of ayats and selected question types.
 */
export const estimateQuizQuestionCount = ({ itemsCount = 0, selectedTypes = [] } = {}) => {
  const count = Math.max(0, Number(itemsCount) || 0);
  const types = Array.isArray(selectedTypes)
    ? selectedTypes
    : selectedTypes instanceof Set
    ? Array.from(selectedTypes)
    : [];

  if (count === 0 || types.length === 0) return 0;

  // Approximate weight multiplier per question type (some types yield multiple per ayah, others 1)
  const isAll = types.length >= 10;
  if (isAll) return count * 4;
  return Math.max(count, Math.round(count * (types.length * 0.75)));
};

/**
 * Returns accuracy badge and achievement title based on quiz percentage.
 */
export const getAccuracyBadge = (accuracyPct = 0) => {
  const pct = Math.max(0, Math.min(100, Math.round(Number(accuracyPct) || 0)));
  if (pct === 100) {
    return Object.freeze({ emoji: "👑", title: "Maître Coranique (100%)", color: "#f1c40f" });
  }
  if (pct >= 85) {
    return Object.freeze({ emoji: "🌟", title: "Hāfiz Confirmé", color: "#2ecc71" });
  }
  if (pct >= 70) {
    return Object.freeze({ emoji: "🎯", title: "Solide Rétention", color: "#3498db" });
  }
  if (pct >= 50) {
    return Object.freeze({ emoji: "📖", title: "En Progression", color: "#e67e22" });
  }
  return Object.freeze({ emoji: "🌱", title: "Initiation & Découverte", color: "#95a5a6" });
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

/**
 * Triggers safe haptic vibration feedback for mobile devices (non-blocking).
 */
export const triggerQuizHaptic = (type = "success", enabled = true) => {
  if (!enabled || typeof navigator === "undefined" || !navigator.vibrate) return;
  trySync(
    () => {
      if (type === "success") {
        navigator.vibrate(25);
      } else if (type === "streak") {
        navigator.vibrate([30, 40, 30]);
      } else if (type === "error") {
        navigator.vibrate([40, 60, 40]);
      }
    },
    null,
    { code: ERROR_CODES.QUIZ_ERROR, context: { hapticType: type } }
  );
};

/**
 * Quiz presets defining focused session configurations.
 */
export const QUIZ_PRESETS = Object.freeze([
  {
    id: "all",
    label: "Tous types",
    icon: "🌟",
    desc: "Session complète avec tous les types de questions",
    types: null,
  },
  {
    id: "express",
    label: "Quiz Express",
    icon: "⚡",
    desc: "10 questions rapides avec chrono 15s",
    types: ["first_word", "last_word", "missing_word", "verse_number"],
    timer: "15s",
  },
  {
    id: "starts_ends",
    label: "Début & Fin",
    icon: "🎯",
    desc: "Premier mot, dernier mot et mots manquants",
    types: ["first_word", "last_word", "missing_word"],
  },
  {
    id: "transitions",
    label: "Enchaînements",
    icon: "🔗",
    desc: "Verset suivant et verset précédent",
    types: ["next_verse", "previous_verse", "find_ayat"],
  },
  {
    id: "reconstruct",
    label: "Reconstitution",
    icon: "🧩",
    desc: "Reconstituer les versets dans le bon ordre",
    types: ["reconstruct", "missing_word"],
  },
]);

/**
 * Pure generator of smart multiple-choice options for a given quiz question.
 * Returns an array of option objects: [{ id, text, isCorrect }]
 */
export const generateMultipleChoiceOptions = ({
  question,
  allAyatTexts = {},
  surahs = [],
  count = 4,
} = {}) => {
  if (!question || !question.answer) return [];

  const rawAnswer = String(question.answer || "").trim();
  if (!rawAnswer) return [];

  const cleanText = (t) =>
    String(t || "")
      .replace(/[۝۩۞ۖ-ۜ]/g, "")
      .trim();

  const targetAnswer = cleanText(rawAnswer);
  const distractors = new Set();
  const qType = question.type || "";
  const sn = question.sn || 1;
  const an = question.ayatNum || 1;

  if (qType === "verse_number") {
    const num = parseInt(targetAnswer, 10) || an;
    const candidates = [num - 2, num - 1, num + 1, num + 2, num + 3, num - 3];
    candidates
      .filter((n) => n >= 1 && n !== num)
      .slice(0, count - 1)
      .forEach((n) => distractors.add(String(n)));
  } else if (qType === "find_surah" && Array.isArray(surahs) && surahs.length > 0) {
    const otherSurahs = surahs.filter((s) => s.englishName !== targetAnswer && s.name !== targetAnswer);
    const shuffled = [...otherSurahs].sort(() => 0.5 - Math.random());
    shuffled.slice(0, count - 1).forEach((s) => {
      distractors.add(s.englishName || s.name);
    });
  } else {
    // For word-based and verse-based questions: first_word, last_word, missing_word, next_verse, previous_verse, find_ayat
    const nearbyKeys = [
      `${sn}:${an - 1}`,
      `${sn}:${an}`,
      `${sn}:${an + 1}`,
      `${sn}:${an - 2}`,
      `${sn}:${an + 2}`,
      `${sn}:${Math.max(1, an - 3)}`,
      `${sn}:${an + 3}`,
    ];

    const isFullVerse = qType === "next_verse" || qType === "previous_verse" || qType === "find_ayat";

    if (isFullVerse) {
      for (const k of nearbyKeys) {
        const text = allAyatTexts[k];
        if (text) {
          const cleaned = cleanText(text);
          if (cleaned && cleaned !== targetAnswer && !distractors.has(cleaned)) {
            distractors.add(cleaned);
            if (distractors.size >= count - 1) break;
          }
        }
      }
    } else {
      // Word distractors
      for (const k of nearbyKeys) {
        const text = allAyatTexts[k];
        if (text) {
          const words = text
            .split(/\s+/)
            .map(cleanText)
            .filter((w) => w.length >= 2 && w !== targetAnswer);
          for (const w of words) {
            if (!distractors.has(w)) {
              distractors.add(w);
              if (distractors.size >= count - 1) break;
            }
          }
        }
        if (distractors.size >= count - 1) break;
      }
    }
  }

  // Fallbacks if not enough distractors found
  const defaultDistractors = ["اللَّهِ", "الرَّحْمَٰنِ", "آمَنُوا", "الصَّالِحَاتِ", "الْجَنَّةِ", "الْأَرْضِ"];
  let fallbackIdx = 0;
  while (distractors.size < count - 1 && fallbackIdx < defaultDistractors.length) {
    const fb = defaultDistractors[fallbackIdx++];
    if (fb !== targetAnswer) {
      distractors.add(fb);
    }
  }

  const options = [
    { id: "correct", text: targetAnswer, isCorrect: true },
    ...Array.from(distractors)
      .slice(0, count - 1)
      .map((txt, idx) => ({ id: `dist_${idx}`, text: txt, isCorrect: false })),
  ];

  // Deterministic pseudo-shuffle based on question ID so options don't jump around on re-renders
  const seed = (question.id || "q").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const shuffled = [...options].sort((a, b) => {
    const valA = ((a.text.charCodeAt(0) || 0) * 17 + seed) % 100;
    const valB = ((b.text.charCodeAt(0) || 0) * 17 + seed) % 100;
    return valA - valB;
  });

  return Object.freeze(shuffled);
};

