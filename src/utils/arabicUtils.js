import { normalizeArabic } from './recitationDiff.js';


export const QALQALA_LETTERS = new Set(['ق','ط','ب','ج','د']);
export const SUKUN = 'ْ';
export const MADD_MARK = new Set(['ٓ','ٰ']);
export const LONG_VOWEL = new Set(['َ','ُ','ِ']);
export const MADD_LETTER = new Set(['ا','و','ي']);
export const HAMZA_SET = new Set(['ء','أ','إ','آ','ؤ','ئ']);


export const ARABIC_ROOTS = {
  'الله': 'Allah', 'رحمن': 'Miséricordieux', 'رحيم': 'Très Miséricordieux',
  'حمد': 'Louange', 'رب': 'Seigneur', 'عالم': 'Monde/Univers',
  'ملك': 'Roi/Maître', 'يوم': 'Jour', 'دين': 'Jugement/Religion',
  'عبد': 'Adorer/Serviteur', 'استعن': 'Implorer aide', 'هدي': 'Guide',
  'صراط': 'Chemin/Voie', 'مستقيم': 'Droit', 'نعم': 'Bienfait',
  'غضب': 'Colère', 'ضلل': 'Égaré', 'قلب': 'Cœur', 'نفس': 'Âme',
  'سمع': 'Entendre', 'بصر': 'Voir', 'علم': 'Savoir/Science',
  'كتب': 'Écriture/Livre', 'آمن': 'Croire', 'صلح': 'Bien/Vertu',
};

export const QURAN_NON_LETTER_RE = /[\u06D6-\u06ED\u0660-\u0669\u06F0-\u06F9\uFD3E\uFD3F]/;

// Split Arabic text into grapheme clusters (letter + harakat), skipping
// non-letter Quranic annotation marks (juz/hizb/sajda/pause/etc.) entirely —
// they neither form their own cluster nor attach to a neighbouring letter.
export function splitArabicClusters(text) {
  if (!text) return [];
  const clusters = [];
  const base = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const diac = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/;
  let cur = '';
  for (const ch of text) {
    if (QURAN_NON_LETTER_RE.test(ch)) { continue; } // ignore entirely — not a letter or harakat
    if (ch === ' ') { if (cur) { clusters.push(cur); cur = ''; } }
    else if (base.test(ch)) { if (cur) clusters.push(cur); cur = ch; }
    else if (diac.test(ch) && cur) { cur += ch; }
    else { if (cur) clusters.push(cur); cur = ch; }
  }
  if (cur) clusters.push(cur);
  return clusters;
}

export function splitArabicWords(text) {
  if (!text) return [];

  const PREFIXES = [
    { p: 'و', alefOnly: false },
    { p: 'ف', alefOnly: false },
    { p: 'ل', alefOnly: false },
    { p: 'ب', alefOnly: true  },
  ];
  const ALEF_VARIANTS = new Set(['ا','أ','إ','آ','ٱ','\u0671','\u0622','\u0623','\u0625']);

  // Zero-width / invisible joiners that should NOT cause word breaks
  const ZW_RE = /[\u2060\uFEFF\u200B\u200C\u200D]/;
  const ZW_STRIP = /[\u2060\uFEFF\u200B\u200C\u200D]/g;

  // Step 1: split on whitespace, then merge tokens around ZW chars
  const rawTokens = text.trim().split(/[ \t\n\r\u00A0\u202F\u2009]+/).filter(t => t.length > 0);

  const merged = [];
  let i = 0;
  while (i < rawTokens.length) {
    const raw = rawTokens[i];
    const tok = raw.replace(ZW_STRIP, '');
    if (!tok) {
      // Purely ZW token → merge previous and next
      if (merged.length > 0 && i + 1 < rawTokens.length) {
        merged[merged.length - 1] += rawTokens[i + 1].replace(ZW_STRIP, '');
        i += 2; continue;
      }
    } else if (ZW_RE.test(raw)) {
      // Token contains ZW (at start, end, or middle)
      // If ZW is at the end, merge with next token
      if (/[\u2060\uFEFF\u200B\u200C\u200D]$/.test(raw) && i + 1 < rawTokens.length) {
        merged.push(tok + rawTokens[i + 1].replace(ZW_STRIP, ''));
        i += 2; continue;
      }
      // If ZW is at the start, merge into previous token
      if (/^[\u2060\uFEFF\u200B\u200C\u200D]/.test(raw) && merged.length > 0) {
        merged[merged.length - 1] += tok;
      } else {
        merged.push(tok);
      }
    } else {
      merged.push(tok);
    }
    i++;
  }

  // Also merge any token that is purely diacritics/starts with dagger alif into the previous token,
  // AND merge any token with only 1 Arabic consonant (incomplete word, e.g. فَ split by newline) with the next
  const COMBINING = /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0870-\u08FF]+$/;
  const STARTS_COMBINING = /^[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/; // starts with diacritic/dagger alif
  const ARABIC_CONS = /[\u0600-\u063F\u0641-\u064A\u066E-\u066F\u0671-\u06D3\u06D5\u06EE-\u06EF\u06FA-\u06FC\u06FF]/g;
  const isSingleConsonant = (tok) => (tok.match(ARABIC_CONS) || []).length === 1;

  const cleaned = [];
  for (let j = 0; j < merged.length; j++) {
    const tok = merged[j];
    if (cleaned.length > 0 && (COMBINING.test(tok) || STARTS_COMBINING.test(tok))) {
      // Token is purely diacritics OR starts with dagger alif — belongs to previous word
      cleaned[cleaned.length - 1] += tok;
    } else if (isSingleConsonant(tok) && j + 1 < merged.length) {
      // Single consonant token (e.g. فَ from فَضۡلِ split by newline): merge with next
      merged[j + 1] = tok + merged[j + 1];
    } else {
      cleaned.push(tok);
    }
  }

  // Step 3: prefix splitting
  const result = [];
  cleaned.forEach(token => {
    const norm = normalizeArabic(token);
    let split = false;
    for (const { p, alefOnly } of PREFIXES) {
      const rest = norm.slice(p.length);
      if (norm.startsWith(p) && norm.length > 2 && (!alefOnly || ALEF_VARIANTS.has(rest[0]))) {
        let i = 0;
        const originalChars = [...token];
        let letterCount = 0;
        while (i < originalChars.length) {
          const cp = originalChars[i].codePointAt(0);
          const isDiacritic = (cp >= 0x064B && cp <= 0x065F) || cp === 0x0670 || (cp >= 0x0610 && cp <= 0x061A) ||
                              (cp >= 0x06D6 && cp <= 0x06ED) || (cp >= 0x0870 && cp <= 0x08FF);
          if (!isDiacritic) letterCount++;
          i++;
          if (letterCount === 1) {
            while (i < originalChars.length) {
              const cp2 = originalChars[i].codePointAt(0);
              const isDia2 = (cp2 >= 0x064B && cp2 <= 0x065F) || cp2 === 0x0670 || (cp2 >= 0x0610 && cp2 <= 0x061A) ||
                             (cp2 >= 0x06D6 && cp2 <= 0x06ED) || (cp2 >= 0x0870 && cp2 <= 0x08FF);
              if (!isDia2) break;
              i++;
            }
            break;
          }
        }
        if (i < originalChars.length) {
          result.push(originalChars.slice(0, i).join(''));
          result.push(originalChars.slice(i).join(''));
          split = true;
          break;
        }
      }
    }
    if (!split) result.push(token);
  });
  return result;
}

export function stripDiacritics(s) {
  return s.replace(/[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g, '');
}
export function wordTranslit(w) {
  const clean = stripDiacritics(w);
  for (const [k,v] of Object.entries(ARABIC_ROOTS)) {
    if (clean.includes(k)) return v;
  }
  return null;
}
export function calcDifficulty(text, ld) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const clean = stripDiacritics(text);
  const uniqueLetters = new Set([...clean].filter(c => c >= '\u0621' && c <= '\u064A')).size;
  const qCount = [...text].filter((c,i,a) => QALQALA_LETTERS.has(c) && (a[i+1]===SUKUN||i===a.length-1)).length;
  const hasMadd = MADD_MARK.size > 0 && [...text].some(c => MADD_MARK.has(c));
  let score = 0;
  score += Math.min(words.length / 3, 3);
  score += Math.min(uniqueLetters / 8, 2);
  score += qCount * 0.5;
  score += hasMadd ? 0.5 : 0;
  if (score < 2) return { level: 1, label: 'FACILE', color: '#4caf81', bar: 20 };
  if (score < 4) return { level: 2, label: 'MODÉRÉ', color: '#ffd166', bar: 50 };
  if (score < 6) return { level: 3, label: 'INTERMÉDIAIRE', color: '#ff9f43', bar: 75 };
  return { level: 4, label: 'AVANCÉ', color: '#ff6b6b', bar: 100 };
}
export function calcPhase(ld) {
  if (!ld) return { label: 'NON COMMENCÉ', color: 'var(--text3)', step: 0 };
  if (ld.learned) return { label: 'MAÎTRISÉ ✓', color: '#4caf81', step: 4 };
  const partsCount = ld.parts?.length || 0;
  const allPartsLearned = partsCount > 0 && ld.parts.every(p => p.learned);
  if (allPartsLearned) return { label: 'PARTIES MAÎTRISÉES', color: '#ffd166', step: 3 };
  if (partsCount > 0) return { label: 'EN DÉCOUPAGE', color: '#ff9f43', step: 2 };
  if ((ld.readCount||0) > 0) return { label: 'EN LECTURE', color: '#5bc8f5', step: 1 };
  return { label: 'NON COMMENCÉ', color: 'var(--text3)', step: 0 };
}
// Split a word into grapheme clusters (letter + combining diacritics)
export function splitArabicChars(word) {
  const clusters = [];
  const base = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const diac  = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/;
  let cur = '';
  for (const ch of word) {
    if (base.test(ch)) {
      if (cur) clusters.push(cur);
      cur = ch;
    } else if (diac.test(ch) && cur) {
      cur += ch;
    } else {
      if (cur) clusters.push(cur);
      cur = ch;
    }
  }
  if (cur) clusters.push(cur);
  return clusters;
}

// Shared toRevise state/actions (ayat / words / chars / parts) with history tracking.
// Used by ToRevisePanel and DecouverteMode so the marking logic lives in one place.

export function arabicRoot(word) {
  if (!word) return '';
  const clean = stripDiacritics(word).replace(/[^ء-ي]/g, '');
  if (ARABIC_ROOTS && ARABIC_ROOTS[clean]) return clean;
  // Basic prefix removal for Alif-Lam, Waw, Ba, Fa, etc.
  let r = clean;
  if (r.startsWith('ال') && r.length > 4) r = r.slice(2);
  if ((r.startsWith('و') || r.startsWith('ف') || r.startsWith('ب') || r.startsWith('ل') || r.startsWith('ك')) && r.length > 3) r = r.slice(1);
  if (r.startsWith('ال') && r.length > 4) r = r.slice(2);
  return r;
}

export const SURAH_INFO = [
  { n:1, en:"Al-Fatihah", ar:"الفاتحة", count:7 },
  { n:2, en:"Al-Baqarah", ar:"البقرة", count:286 },
  { n:3, en:"Ali 'Imran", ar:"آل عمران", count:200 },
  { n:4, en:"An-Nisa", ar:"النساء", count:176 },
  { n:5, en:"Al-Ma'idah", ar:"المائدة", count:120 },
  { n:6, en:"Al-An'am", ar:"الأنعام", count:165 },
  { n:7, en:"Al-A'raf", ar:"الأعراف", count:206 },
  { n:8, en:"Al-Anfal", ar:"الأنفال", count:75 },
  { n:9, en:"At-Tawbah", ar:"التوبة", count:129 },
  { n:10, en:"Yunus", ar:"يونس", count:109 },
  { n:11, en:"Hud", ar:"هود", count:123 },
  { n:12, en:"Yusuf", ar:"يوسف", count:111 },
  { n:13, en:"Ar-Ra'd", ar:"الرعد", count:43 },
  { n:14, en:"Ibrahim", ar:"إبراهيم", count:52 },
  { n:15, en:"Al-Hijr", ar:"الحجر", count:99 },
  { n:16, en:"An-Nahl", ar:"النحل", count:128 },
  { n:17, en:"Al-Isra", ar:"الإسراء", count:111 },
  { n:18, en:"Al-Kahf", ar:"الكهف", count:110 },
  { n:19, en:"Maryam", ar:"مريم", count:98 },
  { n:20, en:"Taha", ar:"طه", count:135 },
  { n:21, en:"Al-Anbiya", ar:"الأنبياء", count:112 },
  { n:22, en:"Al-Hajj", ar:"الحج", count:78 },
  { n:23, en:"Al-Mu'minun", ar:"المؤمنون", count:118 },
  { n:24, en:"An-Nur", ar:"النور", count:64 },
  { n:25, en:"Al-Furqan", ar:"الفرقان", count:77 },
  { n:26, en:"Ash-Shu'ara", ar:"الشعراء", count:227 },
  { n:27, en:"An-Naml", ar:"النمل", count:93 },
  { n:28, en:"Al-Qasas", ar:"القصص", count:88 },
  { n:29, en:"Al-'Ankabut", ar:"العنكبوت", count:69 },
  { n:30, en:"Ar-Rum", ar:"الروم", count:60 },
  { n:31, en:"Luqman", ar:"لقمان", count:34 },
  { n:32, en:"As-Sajdah", ar:"السجدة", count:30 },
  { n:33, en:"Al-Ahzab", ar:"الأحزاب", count:73 },
  { n:34, en:"Saba", ar:"سبأ", count:54 },
  { n:35, en:"Fatir", ar:"فاطر", count:45 },
  { n:36, en:"Ya-Sin", ar:"يس", count:83 },
  { n:37, en:"As-Saffat", ar:"الصافات", count:182 },
  { n:38, en:"Sad", ar:"ص", count:88 },
  { n:39, en:"Az-Zumar", ar:"الزمر", count:75 },
  { n:40, en:"Ghafir", ar:"غافر", count:85 },
  { n:41, en:"Fussilat", ar:"فصلت", count:54 },
  { n:42, en:"Ash-Shura", ar:"الشورى", count:53 },
  { n:43, en:"Az-Zukhruf", ar:"الزخرف", count:89 },
  { n:44, en:"Ad-Dukhan", ar:"الدخان", count:59 },
  { n:45, en:"Al-Jathiyah", ar:"الجاثية", count:37 },
  { n:46, en:"Al-Ahqaf", ar:"الأحقاف", count:35 },
  { n:47, en:"Muhammad", ar:"محمد", count:38 },
  { n:48, en:"Al-Fath", ar:"الفتح", count:29 },
  { n:49, en:"Al-Hujurat", ar:"الحجرات", count:18 },
  { n:50, en:"Qaf", ar:"ق", count:45 },
  { n:51, en:"Adh-Dhariyat", ar:"الذاريات", count:60 },
  { n:52, en:"At-Tur", ar:"الطور", count:49 },
  { n:53, en:"An-Najm", ar:"النجم", count:62 },
  { n:54, en:"Al-Qamar", ar:"القمر", count:55 },
  { n:55, en:"Ar-Rahman", ar:"الرحمن", count:78 },
  { n:56, en:"Al-Waqi'ah", ar:"الواقعة", count:96 },
  { n:57, en:"Al-Hadid", ar:"الحديد", count:29 },
  { n:58, en:"Al-Mujadila", ar:"المجادلة", count:22 },
  { n:59, en:"Al-Hashr", ar:"الحشر", count:24 },
  { n:60, en:"Al-Mumtahanah", ar:"الممتحنة", count:13 },
  { n:61, en:"As-Saff", ar:"الصف", count:14 },
  { n:62, en:"Al-Jumu'ah", ar:"الجمعة", count:11 },
  { n:63, en:"Al-Munafiqun", ar:"المنافقون", count:11 },
  { n:64, en:"At-Taghabun", ar:"التغابن", count:18 },
  { n:65, en:"At-Talaq", ar:"الطلاق", count:12 },
  { n:66, en:"At-Tahrim", ar:"التحريم", count:12 },
  { n:67, en:"Al-Mulk", ar:"الملك", count:30 },
  { n:68, en:"Al-Qalam", ar:"القلم", count:52 },
  { n:69, en:"Al-Haqqah", ar:"الحاقة", count:52 },
  { n:70, en:"Al-Ma'arij", ar:"المعارج", count:44 },
  { n:71, en:"Nuh", ar:"نوح", count:28 },
  { n:72, en:"Al-Jinn", ar:"الجن", count:28 },
  { n:73, en:"Al-Muzzammil", ar:"المزمل", count:20 },
  { n:74, en:"Al-Muddaththir", ar:"المدثر", count:56 },
  { n:75, en:"Al-Qiyamah", ar:"القيامة", count:40 },
  { n:76, en:"Al-Insan", ar:"الإنسان", count:31 },
  { n:77, en:"Al-Mursalat", ar:"المرسلات", count:50 },
  { n:78, en:"An-Naba", ar:"النبأ", count:40 },
  { n:79, en:"An-Nazi'at", ar:"النازعات", count:46 },
  { n:80, en:"'Abasa", ar:"عبس", count:42 },
  { n:81, en:"At-Takwir", ar:"التكوير", count:29 },
  { n:82, en:"Al-Infitar", ar:"الانفطار", count:19 },
  { n:83, en:"Al-Mutaffifin", ar:"المطففين", count:36 },
  { n:84, en:"Al-Inshiqaq", ar:"الانشقاق", count:25 },
  { n:85, en:"Al-Buruj", ar:"البروج", count:22 },
  { n:86, en:"At-Tariq", ar:"الطارق", count:17 },
  { n:87, en:"Al-A'la", ar:"الأعلى", count:19 },
  { n:88, en:"Al-Ghashiyah", ar:"الغاشية", count:26 },
  { n:89, en:"Al-Fajr", ar:"الفجر", count:30 },
  { n:90, en:"Al-Balad", ar:"البلد", count:20 },
  { n:91, en:"Ash-Shams", ar:"الشمس", count:15 },
  { n:92, en:"Al-Layl", ar:"الليل", count:21 },
  { n:93, en:"Ad-Duhaa", ar:"الضحى", count:11 },
  { n:94, en:"Ash-Sharh", ar:"الشرح", count:8 },
  { n:95, en:"At-Tin", ar:"التين", count:8 },
  { n:96, en:"Al-'Alaq", ar:"العلق", count:19 },
  { n:97, en:"Al-Qadr", ar:"القدر", count:5 },
  { n:98, en:"Al-Bayyinah", ar:"البينة", count:8 },
  { n:99, en:"Az-Zalzalah", ar:"الزلزلة", count:8 },
  { n:100, en:"Al-'Adiyat", ar:"العاديات", count:11 },
  { n:101, en:"Al-Qari'ah", ar:"القارعة", count:11 },
  { n:102, en:"At-Takathur", ar:"التكاثر", count:8 },
  { n:103, en:"Al-'Asr", ar:"العصر", count:3 },
  { n:104, en:"Al-Humazah", ar:"الهمزة", count:9 },
  { n:105, en:"Al-Fil", ar:"الفيل", count:5 },
  { n:106, en:"Quraysh", ar:"قريش", count:4 },
  { n:107, en:"Al-Ma'un", ar:"الماعون", count:7 },
  { n:108, en:"Al-Kawthar", ar:"الكوثر", count:3 },
  { n:109, en:"Al-Kafirun", ar:"الكافرون", count:6 },
  { n:110, en:"An-Nasr", ar:"النصر", count:3 },
  { n:111, en:"Al-Masad", ar:"المسد", count:5 },
  { n:112, en:"Al-Ikhlas", ar:"الإخلاص", count:4 },
  { n:113, en:"Al-Falaq", ar:"الفلق", count:5 },
  { n:114, en:"An-Nas", ar:"الناس", count:6 }
];

export const SUGGESTED_SEARCHES = [
  "الله", "الرحمن", "الرحيم", "الصلاة", "الزكاة", "الصابرين",
  "الجنة", "النار", "المؤمنين", "يوم القيامة", "النور", "الهدى", "الحق"
];

export const ARABIC_LETTERS = [
  { letter:"ب", name:"Ba",  trans:"b",  isolated:"ب", initial:"بـ", medial:"ـبـ", final:"ـب", makhraj:"Lèvres", tip:"Bi-labiale occlusive sonore. Lèvres fermées, air expulsé." },
  { letter:"ت", name:"Ta",  trans:"t",  isolated:"ت", initial:"تـ", medial:"ـتـ", final:"ـت", makhraj:"Dents+langue", tip:"Apico-dentale. Pointe de la langue touche les dents supérieures." },
  { letter:"ث", name:"Tha", trans:"th", isolated:"ث", initial:"ثـ", medial:"ـثـ", final:"ـث", makhraj:"Dents+langue", tip:"Comme le 'th' anglais dans 'think'. Langue entre les dents." },
  { letter:"ج", name:"Jîm", trans:"j",  isolated:"ج", initial:"جـ", medial:"ـجـ", final:"ـج", makhraj:"Palais", tip:"Palatale. Son 'dj' profond, palais médian." },
  { letter:"ح", name:"Ḥa",  trans:"ḥ",  isolated:"ح", initial:"حـ", medial:"ـحـ", final:"ـح", makhraj:"Gorge", tip:"Fricative pharyngale sourde. Souffle chaud depuis la gorge, sans voix." },
  { letter:"خ", name:"Kha", trans:"kh", isolated:"خ", initial:"خـ", medial:"ـخـ", final:"ـخ", makhraj:"Gorge", tip:"Comme le 'j' espagnol ou le 'ch' allemand dans 'Bach'." },
  { letter:"د", name:"Dal", trans:"d",  isolated:"د", initial:"دـ", medial:"ـدـ", final:"ـد", makhraj:"Dents+langue", tip:"Apico-dentale sonore. Comme 'd' français mais contre les dents." },
  { letter:"ذ", name:"Dhal",trans:"dh", isolated:"ذ", initial:"ذـ", medial:"ـذـ", final:"ـذ", makhraj:"Dents+langue", tip:"Comme le 'th' anglais dans 'this'. Langue entre les dents, avec voix." },
  { letter:"ر", name:"Ra",  trans:"r",  isolated:"ر", initial:"رـ", medial:"ـرـ", final:"ـر", makhraj:"Langue", tip:"Roulé apical. Pointe de la langue vibre contre les alvéoles." },
  { letter:"ز", name:"Zay", trans:"z",  isolated:"ز", initial:"زـ", medial:"ـزـ", final:"ـز", makhraj:"Dents+langue", tip:"Sifflante sonore. Identique au 'z' français." },
  { letter:"س", name:"Sîn", trans:"s",  isolated:"س", initial:"سـ", medial:"ـسـ", final:"ـس", makhraj:"Dents+langue", tip:"Sifflante sourde fine. Langue derrière les dents, pas d'emphase." },
  { letter:"ش", name:"Chîn",trans:"sh", isolated:"ش", initial:"شـ", medial:"ـشـ", final:"ـش", makhraj:"Palais", tip:"Chuintante comme 'ch' en français. Palais antérieur." },
  { letter:"ص", name:"Ṣad", trans:"ṣ",  isolated:"ص", initial:"صـ", medial:"ـصـ", final:"ـص", makhraj:"Dents+langue", tip:"'S' emphatique. Langue basse, gorge contractée, son grave." },
  { letter:"ض", name:"Ḍad", trans:"ḍ",  isolated:"ض", initial:"ضـ", medial:"ـضـ", final:"ـض", makhraj:"Langue", tip:"Latérale emphatique unique à l'arabe. Bords de la langue touche les molaires." },
  { letter:"ط", name:"Ṭa",  trans:"ṭ",  isolated:"ط", initial:"طـ", medial:"ـطـ", final:"ـط", makhraj:"Dents+langue", tip:"'T' emphatique. Langue contre les dents supérieures, gorge contractée." },
  { letter:"ظ", name:"Ẓa",  trans:"ẓ",  isolated:"ظ", initial:"ظـ", medial:"ـظـ", final:"ـظ", makhraj:"Dents+langue", tip:"'Dh' emphatique. Comme ذ mais avec emphase, son grave et profond." },
  { letter:"ع", name:"Ayn", trans:"ʿ",  isolated:"ع", initial:"عـ", medial:"ـعـ", final:"ـع", makhraj:"Gorge", tip:"Pharyngale sonore. Constriction pharyngale, son vocalique profond." },
  { letter:"غ", name:"Ghayn",trans:"gh",isolated:"غ", initial:"غـ", medial:"ـغـ", final:"ـغ", makhraj:"Gorge", tip:"Uvulaire fricative sonore. Comme un 'r' parisien ou guttural." },
  { letter:"ف", name:"Fa",  trans:"f",  isolated:"ف", initial:"فـ", medial:"ـفـ", final:"ـف", makhraj:"Lèvres+dents", tip:"Labiodentale sourde. Identique au 'f' français." },
  { letter:"ق", name:"Qaf", trans:"q",  isolated:"ق", initial:"قـ", medial:"ـقـ", final:"ـق", makhraj:"Gorge", tip:"Occlusive uvulaire sourde. Plus en arrière que 'k', depuis la luette." },
  { letter:"ك", name:"Kaf", trans:"k",  isolated:"ك", initial:"كـ", medial:"ـكـ", final:"ـك", makhraj:"Palais", tip:"Vélaire sourde. Identique au 'k' français." },
  { letter:"ل", name:"Lam", trans:"l",  isolated:"ل", initial:"لـ", medial:"ـلـ", final:"ـل", makhraj:"Langue", tip:"Latérale alvéolaire. Identique au 'l' français mais plus clair." },
  { letter:"م", name:"Mîm", trans:"m",  isolated:"م", initial:"مـ", medial:"ـمـ", final:"ـم", makhraj:"Lèvres", tip:"Nasale bi-labiale. Identique au 'm' français." },
  { letter:"ن", name:"Nûn", trans:"n",  isolated:"ن", initial:"نـ", medial:"ـنـ", final:"ـن", makhraj:"Langue", tip:"Nasale alvéolaire. Identique au 'n' français." },
  { letter:"ه", name:"Ha",  trans:"h",  isolated:"ه", initial:"هـ", medial:"ـهـ", final:"ـه", makhraj:"Gorge", tip:"Glottale. Souffle doux depuis la gorge, comme un soupir." },
  { letter:"و", name:"Waw", trans:"w/û",isolated:"و", initial:"وـ", medial:"ـوـ", final:"ـو", makhraj:"Lèvres", tip:"Semi-consonne ou voyelle longue 'OU'. Lèvres arrondies." },
  { letter:"ي", name:"Ya",  trans:"y/î",isolated:"ي", initial:"يـ", medial:"ـيـ", final:"ـي", makhraj:"Palais", tip:"Semi-consonne ou voyelle longue 'I'. Palais antérieur." },
  { letter:"ا", name:"Alif",trans:"â/ā",isolated:"ا", initial:"اـ", medial:"ـاـ", final:"ـا", makhraj:"Gorge", tip:"Voyelle longue 'A' ou support de hamza. Ouverte centrale." },
  { letter:"أ", name:"Hamza",trans:"ʾ", isolated:"أ", initial:"أـ", medial:"ـأـ", final:"ـأ", makhraj:"Gorge", tip:"Occlusive glottale. Coupure de la voix, comme dans 'oh oh!'." }
];

export const HARAKATS = [
  { arabic:"بَ", name:"Fatḥa",     sign:"َ",  desc:"Voyelle courte A",    color:"var(--gold2)",  synth:"ba" },
  { arabic:"بِ", name:"Kasra",     sign:"ِ",  desc:"Voyelle courte I",    color:"var(--teal2)",  synth:"bi" },
  { arabic:"بُ", name:"Ḍamma",     sign:"ُ",  desc:"Voyelle courte OU",   color:"var(--green2)", synth:"bou" },
  { arabic:"بْ", name:"Soukoun",   sign:"ْ",  desc:"Consonne sans voyelle",color:"var(--text2)",  synth:"b" },
  { arabic:"بّ", name:"Chadda",    sign:"ّ",  desc:"Consonne doublée",    color:"var(--red)",    synth:"bb" },
  { arabic:"بً", name:"Tanwîn Fatḥ",sign:"ً",desc:"AN final (indéfini)",  color:"var(--gold)",   synth:"ban" },
  { arabic:"بٍ", name:"Tanwîn Kasr",sign:"ٍ",desc:"IN final (indéfini)",  color:"var(--teal)",   synth:"bin" },
  { arabic:"بٌ", name:"Tanwîn Ḍamm",sign:"ٌ",desc:"OUN final (indéfini)", color:"var(--green)",  synth:"boun" },
  { arabic:"آ",  name:"Madda",     sign:"ٓ",  desc:"Alif avec allongement",color:"var(--gold3)",  synth:"aa" }
];

export const SAJDA_AYATS = new Set([
  "7:206", "13:15", "16:50", "17:109", "19:58", "22:18", "22:77",
  "25:60", "27:26", "32:15", "38:24", "41:38", "53:62", "84:21", "96:19"
]);

export const PAGE_POSITION_LABELS = [
  { key: null, label: "Toutes", color: "var(--text3)" },
  { key: "top", label: "Haut de page", color: "var(--gold)" },
  { key: "middle", label: "Milieu de page", color: "var(--teal)" },
  { key: "bottom", label: "Bas de page", color: "var(--green)" }
];
