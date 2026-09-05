// ─── Quranic Text Normalization, Search, Tajweed, & Alignment Utilities ───────

export const AR_ROWS = ["ضصثقفغعهخحجدشسيبلاتنمكطئءؤرلاىةوزظ"];
export const AR_DIACRITICS = /[\u064B-\u0652\u0670\u06D6-\u06ED]/g;

export function cleanDiacritics(text) {
  if (!text) return "";
  return text.replace(AR_DIACRITICS, "");
}

export function stripAllHarakat(text) {
  if (!text) return "";
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627") // alef variants -> bare alef
    .replace(/\u0649/g, "\u064A")                      // alef maksura -> ya
    .replace(/\u0629/g, "\u0647")                      // ta marbuta -> ha
    .replace(/[\s\-_]+/g, " ")
    .trim();
}

export function normalizeArabicSearch(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, "")
    .trim();
}

export const HAMZA_MAP = {
  "ء": "ء",
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ؤ": "و",
  "ئ": "ي",
};

export function fuzzyMatchArabic(query, target) {
  if (!query || !target) return false;
  const q = normalizeArabicSearch(query);
  const t = normalizeArabicSearch(target);
  if (!q || !t) return false;
  if (t.includes(q)) return true;
  const qWords = q.split(/\s+/).filter(Boolean);
  return qWords.every(w => t.includes(w));
}

export function matchesArabicSearch(query, text) {
  return fuzzyMatchArabic(query, text);
}

export function isLatinOnly(text) {
  return /^[a-zA-Z0-9\s\-',.:;!?]+$/.test(text);
}

export function detectSearchType(query) {
  if (!query || !query.trim()) return "empty";
  const trimmed = query.trim();
  if (/^\d+$/.test(trimmed)) return "number";
  if (/^\d+:\d+$/.test(trimmed)) return "verse_ref";
  if (isLatinOnly(trimmed)) return "phonetic_or_translation";
  return "arabic";
}

export function getVerseAudioUrl(surahNum, ayatNum, reciterKey = "ar.alafasy", bitrate = "128") {
  const padS = String(surahNum).padStart(3, "0");
  const padA = String(ayatNum).padStart(3, "0");
  return `https://everyayah.com/data/${reciterKey}_${bitrate}kbps/${padS}${padA}.mp3`;
}

export function formatAudioTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export const TRANS_EDITIONS = {
  fr: "fr.hamidullah",
  en: "en.sahih",
  es: "es.cortes",
  de: "de.bubenheim",
  tr: "tr.diyanet",
  ur: "ur.jalandhry",
  id: "id.indonesian",
  ru: "ru.kuliev",
};

export const TRANS_LABELS = {
  fr: "Français (Hamidullah)",
  en: "English (Sahih International)",
  es: "Español (Cortes)",
  de: "Deutsch (Bubenheim)",
  tr: "Türkçe (Diyanet)",
  ur: "اردو (Jalandhry)",
  id: "Bahasa Indonesia",
  ru: "Русский (Кулиев)",
};

// ─── Voice & Speech Diffing ──────────────────────────────────────────────────

export function normalizeVoiceText(text) {
  if (!text) return "";
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") // remove harakat
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0600-\u06FF\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function diffWords(targetWords, spokenWords) {
  const result = [];
  for (let i = 0; i < targetWords.length; i++) {
    const tw = targetWords[i];
    const sw = spokenWords[i];
    if (!sw) {
      result.push({ word: tw, status: "missing", spoken: "" });
    } else {
      const ntw = normalizeVoiceText(tw);
      const nsw = normalizeVoiceText(sw);
      if (ntw === nsw) {
        result.push({ word: tw, status: "correct", spoken: sw });
      } else {
        result.push({ word: tw, status: "incorrect", spoken: sw });
      }
    }
  }
  for (let j = targetWords.length; j < spokenWords.length; j++) {
    result.push({ word: spokenWords[j], status: "extra", spoken: spokenWords[j] });
  }
  return result;
}

// ─── Letter-by-Letter Alignment & Phonetics ──────────────────────────────────

export const SILENT_WORD_MAP = {
  "مِاْئَةَ": "مِئَةَ",
  "مِائَتَيْنِ": "مِئَتَيْنِ",
  "أُولَئِكَ": "أُلَئِكَ",
  "أُولُوا": "أُلُوا",
  "أُولِي": "أُلِي",
  "أُولَاتِ": "أُلَاتِ",
  "عَمْرٌو": "عَمْرٌ",
  "عَمْرًا": "عَمْرًا",
};

export function normalizeCharForSpeech(ch) {
  if (!ch) return "";
  const c = ch.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  if (/^[إأآٱآ]/.test(c)) return "ا";
  if (c === "ة") return "ه";
  if (c === "ى") return "ي";
  return c;
}

export function alignCharacters(refStr, gotStr) {
  const ref = [...refStr];
  const got = [...gotStr];
  const n = ref.length;
  const m = got.length;

  if (n === 0 && m === 0) return [];
  if (n === 0) return got.map(c => ({ refChar: "", gotChar: c, status: "extra" }));
  if (m === 0) return ref.map(c => ({ refChar: c, gotChar: "", status: "missing" }));

  const MATCH = 2;
  const MISMATCH = -1;
  const GAP = -1;

  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 0; i <= n; i++) dp[i][0] = i * GAP;
  for (let j = 0; j <= m; j++) dp[0][j] = j * GAP;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const rC = normalizeCharForSpeech(ref[i - 1]);
      const gC = normalizeCharForSpeech(got[j - 1]);
      const score = (rC === gC) ? MATCH : MISMATCH;
      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + score,
        dp[i - 1][j] + GAP,
        dp[i][j - 1] + GAP
      );
    }
  }

  let i = n;
  let j = m;
  const aligned = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const rC = normalizeCharForSpeech(ref[i - 1]);
      const gC = normalizeCharForSpeech(got[j - 1]);
      const score = (rC === gC) ? MATCH : MISMATCH;
      if (dp[i][j] === dp[i - 1][j - 1] + score) {
        aligned.unshift({
          refChar: ref[i - 1],
          gotChar: got[j - 1],
          status: (rC === gC) ? "correct" : "incorrect",
        });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + GAP) {
      aligned.unshift({
        refChar: ref[i - 1],
        gotChar: "",
        status: "missing",
      });
      i--;
    } else {
      aligned.unshift({
        refChar: "",
        gotChar: got[j - 1],
        status: "extra",
      });
      j--;
    }
  }

  return aligned;
}

export function computeLetterHighlight(referenceAyah, spokenOrTypedText) {
  if (!referenceAyah) return { aligned: [], accuracy: 0, correctCount: 0, totalRef: 0, isComplete: false };
  const refClean = referenceAyah.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  const spokenClean = (spokenOrTypedText || "").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");

  const refLetters = [...refClean];
  const spokenLetters = [...spokenClean];

  const aligned = alignCharacters(refClean, spokenClean);

  let correctCount = 0;
  let totalRef = 0;

  aligned.forEach(item => {
    if (item.refChar) {
      totalRef++;
      if (item.status === "correct") correctCount++;
    }
  });

  const accuracy = totalRef > 0 ? Math.round((correctCount / totalRef) * 100) : 0;

  return {
    aligned,
    accuracy,
    correctCount,
    totalRef,
    isComplete: accuracy >= 90 && spokenLetters.length >= refLetters.length * 0.85,
  };
}

// ─── Tajweed Detection Engine ────────────────────────────────────────────────

export const TAJWEED_COLORS = {
  ghunnah: "#10b981",
  idgham_no_ghunnah: "#94a3b8",
  idgham_ghunnah: "#fbbf24",
  qalqalah: "#38bdf8",
  madd_lazim: "#e11d48",
  madd_wajib: "#f43f5e",
  madd_jaiz: "#fb923c",
  madd_tabii: "#eab308",
  izhar: "#34d399",
  ikhfa: "#c084fc",
  iqlab: "#2dd4bf",
};

export const QALQALAH_LETTERS = new Set(["ق", "ط", "ب", "ج", "د"]);
export const IKHFA_LETTERS = new Set([
  "ت", "ث", "ج", "د", "ذ", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ف", "ق", "ك"
]);
export const IDGHAM_GHUNNAH_LETTERS = new Set(["ي", "ن", "م", "و"]);
export const IDGHAM_NO_GHUNNAH_LETTERS = new Set(["ل", "ر"]);
export const IQLAB_LETTERS = new Set(["ب"]);
export const THROAT_LETTERS = new Set(["ء", "ه", "ع", "ح", "غ", "خ", "أ", "إ", "ؤ", "ئ", "آ"]);

export function detectTajweedRule(letter, nextLetter, diacritic, isSakin, isShaddah) {
  if (!letter) return null;
  
  if (QALQALAH_LETTERS.has(letter) && isSakin) {
    return { rule: "qalqala", color: TAJWEED_COLORS.qalqalah, label: "Qalqala (قلقلة)" };
  }

  const isNunSakin = (letter === "ن" && isSakin) || diacritic === "tanween";
  if (isNunSakin && nextLetter) {
    if (IQLAB_LETTERS.has(nextLetter)) {
      return { rule: "iqlab", color: TAJWEED_COLORS.iqlab, label: "Iqlab (إقلاب)" };
    }
    if (THROAT_LETTERS.has(nextLetter)) {
      return { rule: "izhar", color: TAJWEED_COLORS.izhar, label: "Idh-har Halqi (إظهار حلقي)" };
    }
    if (IDGHAM_GHUNNAH_LETTERS.has(nextLetter)) {
      return { rule: "idgham_ghunnah", color: TAJWEED_COLORS.idgham_ghunnah, label: "Idgham bi-Ghunnah (إدغام بغنة)" };
    }
    if (IDGHAM_NO_GHUNNAH_LETTERS.has(nextLetter)) {
      return { rule: "idgham_no_ghunnah", color: TAJWEED_COLORS.idgham_no_ghunnah, label: "Idgham bila-Ghunnah (إدغام بغير غنة)" };
    }
    if (IKHFA_LETTERS.has(nextLetter)) {
      return { rule: "ikhfa", color: TAJWEED_COLORS.ikhfa, label: "Ikhfa (إخفاء)" };
    }
  }

  if (diacritic === "madd" || letter === "ۤ" || letter === "~" || letter === "آ" || letter === "ٓ") {
    if (nextLetter && (nextLetter === "ّ" || isShaddah)) {
      return { rule: "madd_lazim", color: TAJWEED_COLORS.madd_lazim, label: "Madd Lazim (مد لازم - 6 temps)" };
    }
    if (nextLetter && (nextLetter === "ء" || nextLetter === "أ" || nextLetter === "إ")) {
      return { rule: "madd_wajib", color: TAJWEED_COLORS.madd_wajib, label: "Madd Muttasil (مد متصل - 4-5 temps)" };
    }
    return { rule: "madd_jaiz", color: TAJWEED_COLORS.madd_jaiz, label: "Madd (مد)" };
  }

  if ((letter === "ن" || letter === "م") && isShaddah) {
    return { rule: "ghunnah", color: TAJWEED_COLORS.ghunnah, label: "Ghunnah Mushaddadah (غنة مشددة)" };
  }

  return null;
}
