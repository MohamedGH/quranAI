// Tajweed letter detection rules and word category classifiers

// ─── Qalqala letters (ق ط ب ج د)
export const QALQALA_LETTERS = new Set(['ق','ط','ب','ج','د']);
export function isQalqala(arr, i) {
  if (!QALQALA_LETTERS.has(arr[i])) return false;
  // Check next char is sukun, or last char of word (waqf = implicit sukun)
  for (let j = i + 1; j < arr.length; j++) {
    const nc = arr[j];
    if (nc === SUKUN) return true;
    if (nc === ' ' || j === arr.length - 1) return true; // waqf
    if (nc >= '؀' && nc <= 'ۿ') continue; // other diacritics — keep looking
    return false; // base letter follows — no sukun
  }
  return true; // end of text
}

// ─── Madd detection
export const MADD_MARK   = new Set(['ٓ','ٰ']);
export const LONG_VOWEL  = new Set(['َ','ُ','ِ']);
export const MADD_LETTER = new Set(['ا','و','ي']);
export const HAMZA_SET   = new Set(['ء','أ','إ','ؤ','ئ']); // ء أ إ ؤ ئ
// Izhar halqi letters: ء ه ع غ ح خ
export const IZHAR_LETTERS = new Set(['ء','ه','ع','غ','ح','خ']);
export const SUKUN = 'ْ'; // ْ
export const TANWIN = new Set(['ً','ٌ','ٍ']); // ً ٌ ٍ
// Returns true if char at i is a nun-sakin or tanwin that is followed (skip diacritics) by an izhar letter
export function isIzhar(arr, i) {
  const ch = arr[i];
  let isNunSakin = false;
  // Nun with sukun: ن followed by sukun OR sukun directly on this char
  if (ch === 'ن') { // ن
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[j] === ' ') break;
      if (arr[j] === SUKUN) { isNunSakin = true; break; }
      if (arr[j] >= 'ء' && arr[j] <= 'ي' && !TANWIN.has(arr[j])) break;
    }
  }
  // Tanwin on current char
  const isTanwin = TANWIN.has(ch);
  if (!isNunSakin && !isTanwin) return false;
  // Find next base letter (skip diacritics and spaces)
  const start = isTanwin ? i + 1 : i + 2; // skip sukun for nun-sakin
  for (let j = (isTanwin ? i + 1 : i + 1); j < arr.length; j++) {
    const nc = arr[j];
    if (nc === ' ') continue;
    if (IZHAR_LETTERS.has(nc)) return true;
    if (nc >= 'ء' && nc <= 'ي' && !TANWIN.has(nc) && nc !== SUKUN) return false;
  }
  return false;
}

// Idgham letters: ي ن م و ل ر
export const IDGHAM_LETTERS = new Set(['ي','ن','م','و','ل','ر']);
export function isIdgham(arr, i) {
  const ch = arr[i];
  let isNunSakin = false;
  if (ch === 'ن') {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[j] === SUKUN) { isNunSakin = true; break; }
      if (arr[j] >= 'ء' && arr[j] <= 'ي' && !TANWIN.has(arr[j])) break;
    }
  }
  const isTanwin = TANWIN.has(ch);
  if (!isNunSakin && !isTanwin) return false;
  // Must be at word boundary (next non-diacritic is in next word = after space)
  // For nun-sakin: skip to next word
  let hitSpace = false;
  for (let j = i + 1; j < arr.length; j++) {
    const nc = arr[j];
    if (nc === ' ') { hitSpace = true; continue; }
    if (!hitSpace && (nc >= '؀' && nc <= 'ۿ')) continue; // diacritics same word
    if (IDGHAM_LETTERS.has(nc)) return true;
    return false;
  }
  return false;
}

// Returns 'muttasil' (4-5 beats, madd before hamza same word), 'normal' (2 beats), or null
export function getMaddType(arr, i) {
  const ch = arr[i];
  // Explicit maddah/superscript-alif mark
  const hasMark = MADD_MARK.has(ch) || (i + 1 < arr.length && MADD_MARK.has(arr[i + 1]));
  // Long vowel + letter
  const isLongVowelLetter = MADD_LETTER.has(ch) && i > 0 && LONG_VOWEL.has(arr[i - 1]);
  if (!hasMark && !isLongVowelLetter) return null;
  // Check if a hamza follows (skip diacritics) within the same word
  for (let j = i + 1; j < arr.length; j++) {
    const nc = arr[j];
    if (nc === ' ') break; // word boundary
    if (HAMZA_SET.has(nc)) return 'muttasil';
    if (nc >= 'ء' && nc <= 'ي') break; // another base letter — no hamza follows immediately
  }
  return 'normal';
}
// Backward-compat single-char check
export function isMaddChar(arr, i) { return getMaddType(arr, i) !== null; }

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

// ─── ReconstructQuestion ───────────────────
export const TAJWEED_RULES = [
  { id: 'qalqala', name: 'Qalqala', nameAr: 'قلقلة', color: '#e06c75', desc: 'Rebondement sur les lettres قطبجد avec soukoun' },
  { id: 'izhar', name: 'Idh-har', nameAr: 'إظهار', color: '#98c379', desc: 'Prononciation claire du Noun Sakin / Tanwin devant lettres de la gorge' },
  { id: 'idgham', name: 'Idgham', nameAr: 'إدغام', color: '#61afef', desc: 'Assimilation du Noun Sakin / Tanwin dans les lettres يرملون' },
  { id: 'iqlab', name: 'Iqlab', nameAr: 'إقلاب', color: '#d19a66', desc: 'Transformation en Mim devant Ba' },
  { id: 'ikhfa', name: 'Ikhfa', nameAr: 'إخفاء', color: '#c678dd', desc: 'Dissimulation avec nasillement' },
  { id: 'madd_muttasil', name: 'Madd Muttasil', nameAr: 'مد متصل', color: '#e5c07b', desc: 'Allongement obligatoire (4-5 temps)' },
  { id: 'madd_munfasil', name: 'Madd Munfasil', nameAr: 'مد منفصل', color: '#56b6c2', desc: 'Allongement permis (2-4 temps)' },
  { id: 'madd_lazim', name: 'Madd Lazim', nameAr: 'مد لازم', color: '#be5046', desc: 'Allongement nécessaire (6 temps)' },
  { id: 'ghunnah', name: 'Ghunnah', nameAr: 'غنة', color: '#abb2bf', desc: 'Nasillement sur Noun et Mim avec Chadda' },
];
