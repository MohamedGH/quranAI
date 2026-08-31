// ─── Extended Functional Utilities for Refactoring & Testing ──────────────────
import { AR_DIACRITICS } from "./quranCore.js";

// SURAH NAMES MAP (French, Arabic, English names mapping to surah numbers)
export const SURAH_NAMES = {
  "fatiha": 1, "al-fatiha": 1, "fatihah": 1, "ouverture": 1,
  "baqara": 2, "al-baqara": 2, "vache": 2, "bakara": 2,
  "imran": 3, "al-imran": 3, "famille d'imran": 3,
  "nisa": 4, "an-nisa": 4, "femmes": 4,
  "maida": 5, "al-maida": 5, "table": 5,
  "anam": 6, "al-anam": 6, "troupeaux": 6,
  "araf": 7, "al-araf": 7,
  "ikhlas": 112, "al-ikhlas": 112, "monotheisme": 112,
  "falaq": 113, "al-falaq": 113, "aube": 113,
  "nas": 114, "an-nas": 114, "hommes": 114, "gens": 114,
  "yasin": 36, "ya-sin": 36, "kahf": 18, "al-kahf": 18,
  "mulk": 67, "al-mulk": 67, "royaute": 67,
};

// ─── Voice Command Parser ───────────────────────────────────────────────────
export function parseVoiceCommand(transcript) {
  if (!transcript) return null;
  const t = transcript.toLowerCase().trim()
    .replace(/[,;.!?]/g, ' ')
    .replace(/\s+/g, ' ');

  // Loop off: "arrêter la boucle", "stop loop"
  if (/\b(arrêter la boucle|stop loop|désactiver boucle|no loop|sans boucle)\b/.test(t)) {
    return { action: 'loop_off' };
  }

  // Play / pause / stop / navigation
  if (/\b(play|joue|lecture|lire|lancer|démarrer|start)\b/.test(t)) return { action: 'play' };
  if (/\b(pause|pauser|mettre en pause)\b/.test(t)) return { action: 'pause' };
  if (/\b(stop|arrêter|arrête|stopper)\b/.test(t)) return { action: 'stop' };
  if (/\b(suivant|next|verset suivant)\b/.test(t)) return { action: 'next' };
  if (/\b(précédent|retour|previous|verset précédent)\b/.test(t)) return { action: 'prev' };

  // Surah selection: "sourate fatiha", "ouvre al-baqara", "va à la sourate 2"
  const surahByNum = t.match(/\b(?:sourate|surah|sura|ouvre|va à la sourate|va sourate)\s+(\d+)\b/i);
  if (surahByNum) {
    const n = parseInt(surahByNum[1]);
    if (n >= 1 && n <= 114) return { action: 'surah', number: n };
  }

  // By name
  for (const [key, num] of Object.entries(SURAH_NAMES)) {
    if (t.includes(key)) return { action: 'surah', number: num };
  }

  // Ayat: "verset 5", "ayat 12", "va au verset 7"
  const ayatMatch = t.match(/\b(?:verset|ayat|ayah|aya|commence|va au|aller au verset|aller verset)\s+(\d+)\b/i);
  if (ayatMatch) {
    const n = parseInt(ayatMatch[1]);
    return { action: 'ayat', number: n };
  }

  // Loop range: "boucle versets 2 à 5", "répéter 3 à 7", "loop 1 5"
  const loopMatch = t.match(/\b(?:boucle|loop|répéter|répète|lire en boucle)\s+(?:versets?\s+)?(\d+)\s+(?:à|au|jusqu'à|to|-)\s+(\d+)\b/i);
  if (loopMatch) {
    return { action: 'loop', from: parseInt(loopMatch[1]), to: parseInt(loopMatch[2]) };
  }

  // Loop off: "arrêter la boucle", "stop loop"
  if (/\b(arrêter la boucle|stop loop|désactiver boucle|no loop|sans boucle)\b/.test(t)) {
    return { action: 'loop_off' };
  }

  // Repetitions: "répéter 3 fois", "5 fois"
  const repMatch = t.match(/\b(\d+)\s+fois\b/i);
  if (repMatch) return { action: 'repeat', times: parseInt(repMatch[1]) };

  return null;
}

// ─── Phonetic Proximity & Makhraj Cost Engine ───────────────────────────────
export const PHONO_PAIRS = new Map();
export function addPair(a, b, cost) {
  PHONO_PAIRS.set(a + b, cost);
  PHONO_PAIRS.set(b + a, cost);
}

// Emphatic ↔ non-emphatic
addPair('س', 'ص', 0.3);
addPair('ز', 'ظ', 0.3);
addPair('ز', 'ض', 0.35);
addPair('د', 'ض', 0.3);
addPair('ت', 'ط', 0.3);
addPair('ذ', 'ظ', 0.3);
// Gutturals / pharyngeals
addPair('ع', 'غ', 0.3);
addPair('ح', 'خ', 0.3);
addPair('ه', 'ح', 0.35);
addPair('ة', 'ه', 0.1);
addPair('ا', 'ع', 0.4);
// Sibilants
addPair('س', 'ش', 0.4);
addPair('ز', 'س', 0.4);
addPair('ص', 'ض', 0.4);
// Stops
addPair('ك', 'ق', 0.4);
addPair('ب', 'ف', 0.45);
addPair('ت', 'د', 0.4);
addPair('ك', 'خ', 0.45);
// Nasals / liquids
addPair('م', 'ن', 0.5);
addPair('ل', 'ن', 0.5);
addPair('ل', 'ر', 0.45);
// Semivowels
addPair('و', 'ب', 0.5);
addPair('ي', 'ء', 0.45);

// Solar letters (lam assimilates into them in ال)
export const SOLAR_LETTERS = new Set(['ت','ث','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ل','ن']);

export function phonoCost(a, b) {
  if (a === b) return 0;
  return PHONO_PAIRS.get(a + b) ?? 1;
}

export const NEAR_THRESHOLD = 0.5;

export function levenshteinChars(refChars, gotChars) {
  const R = refChars.length, G = gotChars.length;
  const dp = Array.from({ length: R + 1 }, (_, r) =>
    Array.from({ length: G + 1 }, (_, g) => (r === 0 ? g : g === 0 ? r : 0))
  );

  for (let r = 1; r <= R; r++) {
    for (let g = 1; g <= G; g++) {
      const cost = phonoCost(refChars[r-1], gotChars[g-1]);
      dp[r][g] = Math.min(
        dp[r-1][g] + 1,
        dp[r][g-1] + 1,
        dp[r-1][g-1] + cost
      );
    }
  }

  const aligned = [];
  let r = R, g = G;

  while (r > 0 || g > 0) {
    if (r > 0 && g > 0) {
      const cost = phonoCost(refChars[r-1], gotChars[g-1]);
      const diag = dp[r-1][g-1] + cost;
      const del  = dp[r-1][g]   + 1;
      const ins  = dp[r][g-1]   + 1;
      if (dp[r][g] >= diag - 1e-9 && diag <= del && diag <= ins) {
        const op = cost === 0 ? 'match' : cost <= NEAR_THRESHOLD ? 'near' : 'sub';
        aligned.push({ refChar: refChars[r-1], gotChar: gotChars[g-1], op, cost });
        r--; g--; continue;
      }
    }
    if (r > 0 && (g === 0 || dp[r-1][g] <= dp[r][g-1])) {
      aligned.push({ refChar: refChars[r-1], gotChar: null, op: 'del', cost: 1 });
      r--; continue;
    }
    g--;
  }

  return aligned.reverse();
}

export function hasSolarLam(word) {
  return /^ا?ل[تثدذرزسشصضطظلن]/u.test(word);
}

export function removeSolarLam(word) {
  return word.replace(/^(ا?ل)([تثدذرزسشصضطظلن])/u, '$2');
}

// ─── Arabic Clusters and Silent Indices ──────────────────────────────────────
export function splitArabicClusters(word) {
  if (!word) return [];
  const clusters = [];
  let cur = '';
  for (const ch of word) {
    const isDiac = /[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(ch);
    if (isDiac) {
      cur += ch;
    } else {
      if (cur) clusters.push(cur);
      cur = ch;
    }
  }
  if (cur) clusters.push(cur);
  return clusters;
}

export function getSilentIndices(normWord, rawWord, wordIndex = 0) {
  const silent = new Set();
  const isFirstWord = (wordIndex === 0);

  // Rule 1: Explicit silent word map
  if (normWord === "اولئك" || normWord === "أولئك") {
    silent.add(1); // Silent waw in أولئك
  }

  // Rule 2: Hamza wasl (ٱ) at position 0 in connected speech
  if (rawWord && rawWord[0] === '\u0671' && !isFirstWord) {
    silent.add(0);
  }

  // Rule 3: ال definite article leading wasl in connected speech
  if (/^\u0627\u0644/.test(normWord) && !isFirstWord) {
    const firstRaw = rawWord ? rawWord[0] : '';
    if (firstRaw === '\u0671' || firstRaw === '\u0627') {
      silent.add(0);
    }
  }

  // Rule 4: Alif al-fariqah (ألف الفارقة) after plural waw
  if (/\u0648\u0627$/.test(normWord) && normWord.length > 2) {
    silent.add(normWord.length - 1);
  }

  return silent;
}

// ─── Spaced Repetition, Learning Phase, & Mastery Score ──────────────────────
export function computeMastery(ld, ayatText) {
  const toRevise = ld?.toRevise;
  const words = ayatText ? ayatText.split(' ').filter(Boolean) : [];
  const totalLetters = words.reduce((s, w) => s + splitArabicClusters(w).length, 0);
  if (totalLetters === 0) return 0;

  let reviseLetters = 0;
  if (toRevise === true) {
    reviseLetters = totalLetters;
  } else if (toRevise && typeof toRevise === 'object') {
    const chars = toRevise.chars || {};
    const revWords = toRevise.words || [];
    reviseLetters += Object.values(chars).reduce((s, arr) => s + arr.length, 0);
    revWords.forEach(wi => {
      if (!chars[wi] && words[wi]) reviseLetters += splitArabicClusters(words[wi]).length;
    });
  }

  const knownLetters = Math.max(0, totalLetters - reviseLetters);
  return Math.round((knownLetters / totalLetters) * 100);
}

export function calcPhase(ld) {
  if (!ld) return { label: 'NON COMMENCÉ', color: 'var(--text3)', step: 0 };
  if (ld.learned) return { label: 'MAÎTRISÉ ✓', color: '#4caf81', step: 4 };
  const partsCount = ld.parts?.length || 0;
  const allPartsLearned = partsCount > 0 && ld.parts.every(p => p.learned);
  if (allPartsLearned) return { label: 'PARTIES MAÎTRISÉES', color: '#ffd166', step: 3 };
  if (partsCount > 0) return { label: 'EN DÉCOUPAGE', color: '#ff9f43', step: 2 };
  if ((ld.readCount || 0) > 0) return { label: 'EN LECTURE', color: '#5bc8f5', step: 1 };
  return { label: 'NON COMMENCÉ', color: 'var(--text3)', step: 0 };
}

export function calcDifficulty(text) {
  if (!text) return { level: 1, label: 'FACILE', color: '#4caf81', bar: 20 };
  const words = text.trim().split(/\s+/).filter(Boolean);
  const clean = text.replace(AR_DIACRITICS, "");
  const uniqueLetters = new Set([...clean].filter(c => c >= '\u0621' && c <= '\u064A')).size;
  const qCount = [...text].filter(c => ['ق','ط','ب','ج','د'].includes(c)).length;

  let score = 0;
  score += Math.min(words.length / 3, 3);
  score += Math.min(uniqueLetters / 8, 2);
  score += qCount * 0.5;

  if (score < 2) return { level: 1, label: 'FACILE', color: '#4caf81', bar: 20 };
  if (score < 4) return { level: 2, label: 'MODÉRÉ', color: '#ffd166', bar: 50 };
  if (score < 6) return { level: 3, label: 'INTERMÉDIAIRE', color: '#ff9f43', bar: 75 };
  return { level: 4, label: 'AVANCÉ', color: '#ef4444', bar: 100 };
}

// ─── Quiz Question Types ────────────────────────────────────────────────────
export const ALL_Q_TYPES = [
  "first_word",
  "last_word",
  "missing_word",
  "next_verse",
  "previous_verse",
  "verse_number",
  "find_ayat",
  "reconstruct",
  "compare_verse",
  "find_surah",
  "unknown_word",
  "unknown_pick",
  "page_structure",
  "revise_word",
  "revise_part"
];
