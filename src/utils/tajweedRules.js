// Tajweed letter detection rules and word category classifiers
// Conforme aux règles authentiques des sciences du Tajweed (Hafs 'an 'Asim)

// ─── Unicode Diacritics & Special Marks ──────────────────────────────────────
export const SUKUN = 'ْ'; // standard sukun U+0652
export const SUKUN_CHARS = new Set(['\u0652', '\u06DF', '\u06E1']); // standard sukun ْ, uthmani jazm ۡ, and small high head of khah
export const TANWIN = new Set(['ً', 'ٌ', 'ٍ']); // standard tanwin
export const TANWIN_CHARS = new Set(['\u064B', '\u064C', '\u064D', '\u08F0', '\u08F1', '\u08F2']); // tanwin fath, damm, kasr & uthmani open forms
export const SHORT_VOWELS = new Set(['\u064E', '\u064F', '\u0650', '\u064B', '\u064C', '\u064D']);
export const SHADDAH = '\u0651'; // ّ
export const SMALL_MIM = '\u06E2'; // ۢ (sign of Iqlab in Uthmani text)
export const MADD_MARK = new Set(['ٓ', 'ٰ', '\u0653', '\u06E4', '~', 'آ']);
export const MADD_CHARS = new Set(['ا', 'و', 'ي', 'آ', '\u0670']);
export const MADD_SIGNS = new Set(['\u0653', '\u06E4', '~', 'ٓ']);
export const LONG_VOWEL = new Set(['َ', 'ُ', 'ِ']);
export const MADD_LETTER = new Set(['ا', 'و', 'ي']);
export const HAMZA_SET = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ', 'آ', 'ٱ']);

// ─── Rule Letter Sets ────────────────────────────────────────────────────────
// 1. Qalqala letters: ق ط ب ج د (قطب جد)
export const QALQALA_LETTERS = new Set(['ق', 'ط', 'ب', 'ج', 'د']);

// 2. Izhar halqi letters: 6 throat letters (ء هـ ع غ ح خ)
export const IZHAR_LETTERS = new Set(['ء', 'ه', 'ع', 'غ', 'ح', 'خ', 'أ', 'إ', 'ؤ', 'ئ', 'آ', 'ٱ']);

// 3. Idgham letters: يرملون
export const IDGHAM_GHUNNAH_LETTERS = new Set(['ي', 'ن', 'م', 'و']); // ينمو
export const IDGHAM_NO_GHUNNAH_LETTERS = new Set(['ل', 'ر']);        // ل، ر
export const IDGHAM_LETTERS = new Set(['ي', 'ن', 'م', 'و', 'ل', 'ر']); // يرملون

// 4. Iqlab letter: ب (devant Ba)
export const IQLAB_LETTERS = new Set(['ب']);

// 5. Ikhfa haqiqi letters: 15 letters
export const IKHFA_LETTERS = new Set([
  'ت', 'ث', 'ج', 'د', 'ذ', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ف', 'ق', 'ك'
]);

// Helper: is Arabic base consonant or letter
export function isArabicLetter(c) {
  if (!c) return false;
  return (c >= '\u0621' && c <= '\u064A') || c === '\u0671';
}

// ─── Qalqala Detection (قلقلة) ───────────────────────────────────────────────
export function isQalqala(arr, i) {
  if (!arr || !QALQALA_LETTERS.has(arr[i])) return false;
  // Look forward for sukun or waqf (end of word / end of ayah without a vowel)
  let hasSukun = false;
  let hasVowel = false;
  let atWaqf = false;
  for (let j = i + 1; j < arr.length; j++) {
    const nc = arr[j];
    if (SUKUN_CHARS.has(nc)) { hasSukun = true; break; }
    if (SHORT_VOWELS.has(nc)) { hasVowel = true; break; }
    if (nc === ' ' || j === arr.length - 1) { atWaqf = true; break; }
    if (isArabicLetter(nc)) break;
  }
  return hasSukun || (atWaqf && !hasVowel);
}

// ─── Ghunnah Mushaddadah Detection (غنة مشددة) ──────────────────────────────
export function isGhunnah(arr, i) {
  if (!arr) return false;
  const ch = arr[i];
  if (ch !== 'ن' && ch !== 'م') return false;
  for (let j = i + 1; j < arr.length && j <= i + 3; j++) {
    if (arr[j] === SHADDAH) return true;
    if (isArabicLetter(arr[j])) break;
  }
  return false;
}

// Helper: check if char is Nun Sakina or Tanwin
export function isNunSakinOrTanwin(arr, i) {
  if (!arr) return false;
  const ch = arr[i];
  if (TANWIN_CHARS.has(ch)) return true;
  if (ch === SMALL_MIM) return true;
  if (ch === 'ن') {
    let hasVowel = false;
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[j] === SMALL_MIM) return true;
      if (SUKUN_CHARS.has(arr[j])) return true;
      if (SHORT_VOWELS.has(arr[j])) { hasVowel = true; break; }
      if (arr[j] === ' ') return true; // unvoweled nun at end of word
      if (isArabicLetter(arr[j])) {
        if (!hasVowel) return true; // unvoweled nun before next letter (Idgham/Ikhfa in Uthmani)
        break;
      }
    }
  }
  return false;
}

// Helper: get the next significant consonant after char at i
function getNextSignificantLetter(arr, i) {
  let nextL = null;
  let hadSpace = false;
  let hadSmallMim = false;
  for (let j = i + 1; j < arr.length; j++) {
    const nc = arr[j];
    if (nc === ' ') { hadSpace = true; continue; }
    if (nc === SMALL_MIM) { hadSmallMim = true; continue; }
    if (isArabicLetter(nc)) {
      nextL = nc;
      break;
    }
  }
  return { nextL, hadSpace, hadSmallMim };
}

// ─── Izhar Halqi (إظهار حلقي) ────────────────────────────────────────────────
export function isIzhar(arr, i) {
  if (!isNunSakinOrTanwin(arr, i)) return false;
  const { nextL } = getNextSignificantLetter(arr, i);
  return !!(nextL && IZHAR_LETTERS.has(nextL));
}

// ─── Idgham (إدغام بغنة وبغير غنة) ──────────────────────────────────────────
export function isIdgham(arr, i) {
  if (!isNunSakinOrTanwin(arr, i)) return false;
  const { nextL, hadSpace } = getNextSignificantLetter(arr, i);
  const isTanwin = TANWIN_CHARS.has(arr[i]);
  // In Hafs, Idgham occurs across word boundary (or with tanwin)
  return !!(nextL && IDGHAM_LETTERS.has(nextL) && (hadSpace || isTanwin));
}

// ─── Iqlab (إقلاب) ──────────────────────────────────────────────────────────
export function isIqlab(arr, i) {
  if (!isNunSakinOrTanwin(arr, i)) return false;
  const { nextL, hadSmallMim } = getNextSignificantLetter(arr, i);
  return hadSmallMim || (nextL && IQLAB_LETTERS.has(nextL));
}

// ─── Ikhfa Haqiqi (إخفاء حقيقي) ─────────────────────────────────────────────
export function isIkhfa(arr, i) {
  if (!isNunSakinOrTanwin(arr, i)) return false;
  const { nextL } = getNextSignificantLetter(arr, i);
  return !!(nextL && IKHFA_LETTERS.has(nextL));
}

// ─── Madd Detection (المدود) ────────────────────────────────────────────────
// Returns 'madd_lazim', 'madd_muttasil', 'madd_munfasil', 'madd' (tabii), or null
export function getMaddType(arr, i) {
  if (!arr) return null;
  const ch = arr[i];
  if (!MADD_CHARS.has(ch)) return null;

  let hasMaddMark = (ch === 'آ' || ch === '\u0670');
  if (!hasMaddMark) {
    for (let j = i + 1; j < arr.length && j <= i + 2; j++) {
      if (MADD_SIGNS.has(arr[j])) { hasMaddMark = true; break; }
      if (isArabicLetter(arr[j])) break;
    }
  }

  // Also check natural vowel prolongation
  let isVowelMadd = false;
  if (!hasMaddMark && i > 0) {
    let prevVowel = null;
    for (let k = i - 1; k >= 0 && k >= i - 3; k--) {
      if (SHORT_VOWELS.has(arr[k])) { prevVowel = arr[k]; break; }
      if (isArabicLetter(arr[k])) break;
    }
    isVowelMadd = (ch === 'ا' && prevVowel === '\u064E') ||
                  (ch === 'و' && prevVowel === '\u064F') ||
                  (ch === 'ي' && prevVowel === '\u0650');
  }

  if (!hasMaddMark && !isVowelMadd) return null;

  // Look forward for Hamza, Shaddah, or Sukun
  let hasHamzaSameWord = false;
  let hasHamzaNextWord = false;
  let nextLetterHasShaddahOrSukun = false;
  let hitSpace = false;

  for (let j = i + 1; j < arr.length; j++) {
    const nc = arr[j];
    if (nc === ' ') { hitSpace = true; continue; }
    if (isArabicLetter(nc)) {
      const isHamza = HAMZA_SET.has(nc);
      if (isHamza) {
        if (hitSpace) hasHamzaNextWord = true;
        else hasHamzaSameWord = true;
      } else if (!hitSpace) {
        // Check if this letter carries Shaddah or Sukun -> Madd Lazim (6 temps)
        for (let k = j + 1; k < arr.length && k <= j + 3; k++) {
          if (arr[k] === SHADDAH || SUKUN_CHARS.has(arr[k])) {
            nextLetterHasShaddahOrSukun = true;
            break;
          }
          if (isArabicLetter(arr[k])) break;
        }
      }
      break;
    }
  }

  if (nextLetterHasShaddahOrSukun) return 'madd_lazim';
  if (hasHamzaSameWord) return 'madd_muttasil';
  if (hasHamzaNextWord) return 'madd_munfasil';
  if (hasMaddMark) return 'madd';
  if (isVowelMadd) return 'normal';
  return null;
}

// Backward-compat single-char check
export function isMaddChar(arr, i) {
  return getMaddType(arr, i) !== null;
}

// ─── Combined Character-Level Detector ──────────────────────────────────────
export function detectTajweedAt(arr, i) {
  if (!arr || i < 0 || i >= arr.length) return null;
  const ch = arr[i];
  if (ch === ' ' || !ch) return null;

  // 1. Ghunnah on noon or meem with shaddah
  if (isGhunnah(arr, i)) {
    return TAJWEED_RULES.find(r => r.id === 'ghunnah') || null;
  }

  // 2. Qalqala
  if (isQalqala(arr, i)) {
    return TAJWEED_RULES.find(r => r.id === 'qalqala') || null;
  }

  // 3. Nun Sakina & Tanwin rules
  if (isNunSakinOrTanwin(arr, i)) {
    const { nextL, hadSmallMim, hadSpace } = getNextSignificantLetter(arr, i);
    const isTanwin = TANWIN_CHARS.has(ch);

    if (hadSmallMim || (nextL && IQLAB_LETTERS.has(nextL))) {
      return { ...TAJWEED_RULES.find(r => r.id === 'iqlab'), matchedWith: nextL || 'ب' };
    }
    if (nextL && IZHAR_LETTERS.has(nextL)) {
      return { ...TAJWEED_RULES.find(r => r.id === 'izhar'), matchedWith: nextL };
    }
    if (nextL && IDGHAM_GHUNNAH_LETTERS.has(nextL) && (hadSpace || isTanwin)) {
      return { ...TAJWEED_RULES.find(r => r.id === 'idgham_ghunnah' || r.id === 'idgham'), matchedWith: nextL };
    }
    if (nextL && IDGHAM_NO_GHUNNAH_LETTERS.has(nextL) && (hadSpace || isTanwin)) {
      return { ...TAJWEED_RULES.find(r => r.id === 'idgham_no_ghunnah' || r.id === 'idgham'), matchedWith: nextL };
    }
    if (nextL && IKHFA_LETTERS.has(nextL)) {
      return { ...TAJWEED_RULES.find(r => r.id === 'ikhfa'), matchedWith: nextL };
    }
  }

  // 4. Madd rules
  const madd = getMaddType(arr, i);
  if (madd) {
    if (madd === 'madd_lazim')   return TAJWEED_RULES.find(r => r.id === 'madd_lazim') || null;
    if (madd === 'madd_muttasil') return TAJWEED_RULES.find(r => r.id === 'madd_muttasil') || null;
    if (madd === 'madd_munfasil') return TAJWEED_RULES.find(r => r.id === 'madd_munfasil') || null;
    if (madd === 'madd' || madd === 'normal') return TAJWEED_RULES.find(r => r.id === 'madd') || null;
  }

  return null;
}

// ─── Scan Full Ayat for Tajweed Occurrences ──────────────────────────────────
export function scanAyatTajweed(text) {
  if (!text) return [];
  const arr = [...text];
  const results = [];
  let wordIdx = 0;

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === ' ') {
      wordIdx++;
      continue;
    }
    const detected = detectTajweedAt(arr, i);
    if (detected) {
      results.push({
        idx: i,
        char: arr[i],
        ruleId: detected.id,
        rule: detected,
        wordIdx,
        matchedWith: detected.matchedWith || ''
      });
    }
  }
  return results;
}

// ─── Arabic word categorizer for ReconstructQuestion ─────────────────────────
// Returns a category label for each Arabic word (approximate, pattern-based).
export const ARABIC_WORD_CATS = (() => {
  const n = (s) => {
    if (!s) return '';
    return s
      .replace(/[ٱأإآؤئءٔ]/g, 'ا')   // alef variants
      .replace(/ی/g, 'ي')
      .replace(/[\u0670\u0640]/g, '')  // dagger alef + tatweel
      .replace(/[ـً-ٟؐ-ؚۖ-ۭ\u0870-\u08FF\uFE70-\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Divine names / Allah set
  const ALLAH = new Set(['الله','الرحمن','الرحيم','الملك','القدوس','السلام','المؤمن','المهيمن','العزيز','الجبار','المتكبر','الخالق','البارئ','المصور','الغفور','القهار','ربك','ربه','ربنا','ربكم','إلهكم','إلهنا','إلههم']);

  // Proper nouns — all names of persons, peoples, places, books, angels cited in the Quran
  // Each entry in its base form; normalize() handles diacritics/alef variants at match time
  const PROPER = new Set([
    // ── Prophets (25 named in Quran) ──
    'آدم','ادريس','نوح','هود','صالح','ابراهيم','لوط','اسماعيل','اسحاق','يعقوب',
    'يوسف','شعيب','موسى','هارون','داود','سليمان','ايوب','يونس','ذوالكفل',
    'الياس','اليسع','زكريا','يحيى','عيسى','محمد','احمد',
    // ── Other Quranic persons ──
    'مريم','عمران','فرعون','هامان','قارون','جالوت','طالوت','لقمان',
    'ذوالقرنين','العزيز','ادريس','خضر','ابليس','عزير','لقمان',
    'حابيل','قابيل','اليسع','ارم','عاد','ثمود',
    // ── Angels ──
    'جبريل','جبرائيل','ميكائيل','ميكال','اسرافيل','هاروت','ماروت','مالك',
    // ── Peoples / tribes ──
    'اسرائيل','يهود','نصارى','قريش','اعراب','اصحاب','فرعون',
    'عاد','ثمود','مدين','سبا','ياجوج','ماجوج',
    // ── Places ──
    'مكة','بكة','مدينة','يثرب','طور','سيناء','بابل','مصر','الاحقاف',
    'الرس','ايكة','حجر','بدر','حنين','الاحزاب','تبوك',
    // ── Revealed books ──
    'توراة','انجيل','زبور','صحف',
    // ── Surahs referenced by name in Quran ──
    'الفرقان',
  ]);

  // Pronouns
  const PRON = new Set(['هو','هي','هم','هن','أنت','أنتم','أنتن','نحن','انا','انا','هما','هما','انتما']);

  // Particles / prepositions / conjunctions / negations
  const PART = new Set(['في','من','إلى','على','عن','ب','ل','ك','و','ف','ثم','أن','أنّ','إن','إنّ','ان','ان','لا','ما','لن','لم','لما','إذا','اذا','إذ','اذ','حتى','كي','لكي','قد','سوف','س','هل','أم','أو','ام','بل','لو','لولا','ولو','كم','الذي','التي','الذين','اللواتي','ماذا','متى','كيف','اين','أين','لماذا','عند','مع','بين','دون','تحت','فوق','خلف','امام','وراء','حول','وسط','غير','سوى','إلا','الا','ليس','لكن','لكنّ','لكن','اما','إما','حين','عندما','بعد','قبل','منذ']);

  // Pre-normalize all sets so classify(w) matches normalized input
  const ALLAH_N  = new Set([...ALLAH].map(n));
  const PROPER_N = new Set([...PROPER].map(n));
  // Also build sorted array by length desc for prefix matching
  const PROPER_LIST = [...PROPER_N].sort((a,b) => b.length - a.length);
  const PRON_N   = new Set([...PRON].map(n));
  const PART_N   = new Set([...PART].map(n));

  const isProperNoun = (w) => {
    if (PROPER_N.has(w)) return true;
    // Strip definite article and check
    const wNoAl = w.startsWith('ال') ? w.slice(2) : w;
    if (PROPER_N.has(wNoAl)) return true;
    // Strip vocative prefix يا (appears as يا or merged as first letters يا/يا)
    const wNoYa = w.startsWith('يا') ? w.slice(2) : w.startsWith('يـا') ? w.slice(3) : w;
    if (wNoYa !== w && PROPER_N.has(wNoYa)) return true;
    const wNoYaNoAl = wNoYa.startsWith('ال') ? wNoYa.slice(2) : wNoYa;
    if (wNoYaNoAl !== wNoYa && PROPER_N.has(wNoYaNoAl)) return true;
    // Check if word starts with a proper noun (handles case suffixes like تان، ين، ون)
    for (const p of PROPER_LIST) {
      if (p.length >= 3 && w.startsWith(p) && (w.length - p.length) <= 3) return true;
      if (p.length >= 3 && wNoAl.startsWith(p) && (wNoAl.length - p.length) <= 3) return true;
      if (p.length >= 3 && wNoYa.startsWith(p) && (wNoYa.length - p.length) <= 3) return true;
    }
    return false;
  };

  const classify = (rawWord) => {
    const w = n(rawWord);
    if (!w) return 'autre';

    // Allah / divine names first
    if (ALLAH_N.has(w) || w === 'الله') return 'allah';

    // Proper nouns (before other noun rules)
    if (isProperNoun(w)) return 'propre';

    // Pronouns
    if (PRON_N.has(w)) return 'pronom';

    // Particles (single letter or known set)
    if (PART_N.has(w) || (w.length === 1 && /[فوبلك]/.test(w))) return 'particule';

    // Verb detection: starts with ي / ت / ن / ا (أ normalized) (mudari') or matches madi pattern
    // Strip object pronoun suffixes before testing: هم،هن،ها،كم،كن،نا،ني،ك،ه
    const wNoSuffix = w.replace(/(هم|هن|ها|كم|كن|نا|ني|وا|ك|ه)$/, '');
    const verbRe = /^[يتن][ا-يء-غ]{2,9}$/;
    const verbReA = /^[ا][ن][ا-يء-غ]{1,7}$/; // أَن... imperative/form IV
    if (!w.startsWith('ال') && (verbRe.test(wNoSuffix) || verbRe.test(w) || verbReA.test(wNoSuffix) || verbReA.test(w))) return 'verbe';
    if (!w.startsWith('ال') && w.length === 3) return 'verbe';
    if (!w.startsWith('ال') && !/^[يتناأ]/.test(w)) {
      const madiM = w.match(/(تم|تن|تما|تا|نا|وا|ت)$/);
      if (madiM && (w.length - madiM[0].length) >= 2) return 'verbe';
    }
    // Words with definite article ال = noun
    if (w.startsWith('ال')) return 'nom';

    // Tanwin endings (indefinite nouns): ان، ون، ين
    if (/[ان]$/.test(w) || w.endsWith('ون') || w.endsWith('ين')) return 'nom';

    // Masdar / noun patterns: فِعَال، فُعُول، فَاعِل، مَفْعُول
    if (/^[مف]/.test(w) && w.length >= 4) return 'nom';

    // Default: if longer word, treat as noun; short = particule
    return w.length <= 2 ? 'particule' : 'nom';
  };

  return { classify };
})();

export const Q_CAT_LABELS = {
  allah:    { label: 'الله',   color: 'rgba(201,168,76,.18)',   border: 'var(--gold)',   text: 'var(--gold2)' },
  propre:   { label: 'أعلام',  color: 'rgba(100,160,255,.16)',  border: '#64a0ff',       text: '#64a0ff' },
  verbe:    { label: 'أفعال',  color: 'rgba(62,184,160,.14)',   border: 'var(--teal)',   text: 'var(--teal2)' },
  nom:      { label: 'أسماء',  color: 'rgba(111,207,154,.14)',  border: 'var(--green)',  text: 'var(--green)' },
  pronom:   { label: 'ضمائر',  color: 'rgba(200,120,255,.14)',  border: '#c878ff',       text: '#c878ff' },
  particule:{ label: 'حروف',   color: 'rgba(224,90,90,.12)',    border: 'var(--red)',    text: 'var(--red)' },
  autre:    { label: 'أخرى',   color: 'var(--surface3)',        border: 'var(--border2)',text: 'var(--text3)' },
};

// ─── Tajweed Rules Categories & Comprehensive Metadata ───────────────────────
export const TAJWEED_CATEGORIES = {
  qalqala: { id: 'qalqala', name: 'Qalqala', nameAr: 'القلقلة', color: '#38bdf8' },
  noun_tanwin: { id: 'noun_tanwin', name: 'Noun Sakin & Tanwin', nameAr: 'أحكام النون الساكنة والتنوين', color: '#34d399' },
  madd: { id: 'madd', name: 'Allongements (Madd)', nameAr: 'أحكام المدود', color: '#fb923c' },
  ghunnah: { id: 'ghunnah', name: 'Ghunnah', nameAr: 'الغنة المشددة', color: '#10b981' }
};

export const TAJWEED_RULES = [
  {
    id: 'qalqala',
    name: 'Qalqala',
    label: 'Qalqala',
    nameAr: 'قلقلة',
    labelAr: 'قلقلة',
    color: '#38bdf8',
    category: 'qalqala',
    duration: 'Écho / Rebond',
    letters: 'ق، ط، ب، ج، د (قُطْبُ جَدّ)',
    desc: 'Rebondement sonore distinct sur la lettre portant un soukoun ou lors de l’arrêt (Waqf).',
    ruleSummary: 'Sughra en milieu de mot, Kubra lors d’un arrêt.',
    example: 'الفَلَقْ · حَبْلٌ · يَقْطَعُونَ'
  },
  {
    id: 'izhar',
    name: 'Idh-har Halqi',
    label: 'Idh-har',
    nameAr: 'إظهار حلقي',
    labelAr: 'إظهار',
    color: '#34d399',
    category: 'noun_tanwin',
    duration: 'Sans allongement (naturel)',
    letters: 'ء، هـ، ع، ح، غ، خ',
    desc: 'Prononciation claire et distincte du Noun Sakin ou Tanwin devant les 6 lettres de la gorge.',
    ruleSummary: 'Prononciation nette sans nasillement supplémentaire.',
    example: 'مَنْ آمَنَ · أَنْعَمْتَ · عَلِيمٌ حَكِيمٌ'
  },
  {
    id: 'idgham',
    name: 'Idgham',
    label: 'Idgham',
    nameAr: 'إدغام',
    labelAr: 'إدغام',
    color: '#fbbf24',
    category: 'noun_tanwin',
    duration: '2 temps (avec Ghunnah) / 0 temps (sans Ghunnah)',
    letters: 'ي، ر، م، ل، و، ن (يَرْمَلُون)',
    desc: 'Assimilation et fusion du Noun Sakin ou Tanwin dans la lettre suivante.',
    ruleSummary: 'Avec Ghunnah (ي ن م و) ou Sans Ghunnah (ل ر).',
    example: 'مَن يَقُولُ · مِن رَّبِّهِمْ · هُدًى لِّلْمُتَّقِينَ'
  },
  {
    id: 'idgham_ghunnah',
    name: 'Idgham bi-Ghunnah',
    label: 'Idgham + Ghunnah',
    nameAr: 'إدغام بغنة',
    labelAr: 'إدغام بغنة',
    color: '#fbbf24',
    category: 'noun_tanwin',
    duration: '2 temps (harakat)',
    letters: 'ي، ن، م، و (يَنْمُو)',
    desc: 'Fusion du Noun/Tanwin avec nasillement prolongé de 2 temps.',
    ruleSummary: 'Fusion avec résonance nasale (Ghunnah).',
    example: 'مَن يَقُولُ · خَيْرًا يَرَهُ · مِّن مَّالٍ'
  },
  {
    id: 'idgham_no_ghunnah',
    name: 'Idgham bila-Ghunnah',
    label: 'Idgham sans Ghunnah',
    nameAr: 'إدغام بغير غنة',
    labelAr: 'إدغام بغير غنة',
    color: '#94a3b8',
    category: 'noun_tanwin',
    duration: 'Sans Ghunnah (complet)',
    letters: 'ل، ر',
    desc: 'Assimilation complète du Noun ou Tanwin dans Lam ou Ra sans aucun nasillement.',
    ruleSummary: 'Assimilation totale et directe.',
    example: 'مِن رَّبِّهِمْ · غَفُورٌ رَّحِيمٌ · هُدًى لِّلْمُتَّقِينَ'
  },
  {
    id: 'iqlab',
    name: 'Iqlab',
    label: 'Iqlab',
    nameAr: 'إقلاب',
    labelAr: 'إقلاب',
    color: '#2dd4bf',
    category: 'noun_tanwin',
    duration: '2 temps (harakat)',
    letters: 'ب (avec petit مـ)',
    desc: 'Transformation du Noun Sakin ou Tanwin en son Mim (م) doux avec Ghunnah devant la lettre Ba.',
    ruleSummary: 'Transformation en Mim avec léger contact des lèvres.',
    example: 'مِنۢ بَعْدِ · عَلِيمٌۢ بِذَاتِ · أَنۢبِئْهُم'
  },
  {
    id: 'ikhfa',
    name: 'Ikhfa Haqiqi',
    label: 'Ikhfa',
    nameAr: 'إخفاء حقيقي',
    labelAr: 'إخفاء',
    color: '#c084fc',
    category: 'noun_tanwin',
    duration: '2 temps (harakat)',
    letters: 'ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك',
    desc: 'Dissimulation intermédiaire du Noun/Tanwin avec Ghunnah de 2 temps devant les 15 lettres.',
    ruleSummary: 'Prononciation voilée entre Idh-har et Idgham avec Ghunnah.',
    example: 'مِن قَبْلُ · أَنفُسَهُمْ · رِزْقًا كَرِيمًا'
  },
  {
    id: 'ghunnah',
    name: 'Ghunnah Mushaddadah',
    label: 'Ghunnah',
    nameAr: 'غنة مشددة',
    labelAr: 'غنة',
    color: '#10b981',
    category: 'ghunnah',
    duration: '2 temps (harakat)',
    letters: 'نّ، مّ (Noun ou Mim avec Chadda)',
    desc: 'Résonance nasale complète et obligatoire de 2 temps sur Noun et Mim portant une Chaddah.',
    ruleSummary: 'Ghunnah pleine sur les lettres doublées.',
    example: 'إِنَّ · ثُمَّ · النَّاسِ · عَمَّ'
  },
  {
    id: 'madd_muttasil',
    name: 'Madd Muttasil (Obligatoire)',
    label: 'Madd Muttasil',
    nameAr: 'مد متصل واجب',
    labelAr: 'مد متصل',
    color: '#f43f5e',
    category: 'madd',
    duration: '4 à 5 temps (harakat)',
    letters: 'Lettre de Madd + ء dans le MÊME mot',
    desc: 'Allongement obligatoire lorsque la lettre de Madd est suivie d’une Hamza dans le même mot.',
    ruleSummary: 'Allongement obligatoire de 4 à 5 temps.',
    example: 'جَآءَ · السَّمَآءِ · سُوٓءَ'
  },
  {
    id: 'madd_munfasil',
    name: 'Madd Munfasil (Permis)',
    label: 'Madd Munfasil',
    nameAr: 'مد منفصل جائز',
    labelAr: 'مد منفصل',
    color: '#fb923c',
    category: 'madd',
    duration: '2, 4 ou 5 temps (harakat)',
    letters: 'Lettre de Madd en fin de mot + ء au début du mot suivant',
    desc: 'Allongement permis lorsque la lettre de Madd termine un mot et que la Hamza commence le suivant.',
    ruleSummary: 'Allongement permis de 2, 4 ou 5 temps.',
    example: 'يَآ أَيُّهَا · إِنَّآ أَعْطَيْنَاكَ · قُوٓا أَنفُسَكُمْ'
  },
  {
    id: 'madd_lazim',
    name: 'Madd Lazim (Nécessaire)',
    label: 'Madd Lazim',
    nameAr: 'مد لازم',
    labelAr: 'مد لازم',
    color: '#e11d48',
    category: 'madd',
    duration: '6 temps obligatoires',
    letters: 'Lettre de Madd + Soukoun originel ou Chaddah',
    desc: 'Allongement maximal et nécessaire de 6 temps causé par un Soukoun d’origine ou une Chaddah.',
    ruleSummary: 'Allongement maximal de 6 temps non réductible.',
    example: 'الضَّالِّينَ · الحَآقَّةُ · الٓمٓ'
  },
  {
    id: 'madd',
    name: 'Madd Tabii / Asli',
    label: 'Madd Tabii',
    nameAr: 'مد طبيعي / أصلي',
    labelAr: 'مد',
    color: '#eab308',
    category: 'madd',
    duration: '2 temps (harakat)',
    letters: 'ا (après Fatha), و (après Damma), ي (après Kasra)',
    desc: 'Allongement naturel de base de 2 temps sur les voyelles longues.',
    ruleSummary: 'Allongement naturel sans cause (ni hamza ni soukoun).',
    example: 'قَالَ · يَقُولُ · قِيلَ'
  },
];
