// ─── Tajweed Audio Coach & Predictive Pause Engine ───────────────────────────
// Detects all Tajweed rules in an ayat using Uthmani text analysis,
// correlates them with word/character audio timestamps,
// triggers pre-emptive pause when coming near, and announces the rule and letter vocally.

import { scanAyatTajweed, TAJWEED_RULES } from "./tajweedRules.js";
import { fixChars } from "./reciterAudio.js";

export const ARABIC_LETTER_NAMES = {
  'ا': { fr: 'Alif', ar: 'الألف' },
  'أ': { fr: 'Hamza', ar: 'الهمزة' },
  'إ': { fr: 'Hamza', ar: 'الهمزة' },
  'آ': { fr: 'Alif Madda', ar: 'الألف الممدودة' },
  'ء': { fr: 'Hamza', ar: 'الهمزة' },
  'ئ': { fr: 'Hamza', ar: 'الهمزة' },
  'ؤ': { fr: 'Hamza', ar: 'الهمزة' },
  'ب': { fr: 'Bâ', ar: 'الباء' },
  'ت': { fr: 'Tâ', ar: 'التاء' },
  'ث': { fr: 'Thâ', ar: 'الثاء' },
  'ج': { fr: 'Jîm', ar: 'الجيم' },
  'ح': { fr: 'Ḥâ', ar: 'الحاء' },
  'خ': { fr: 'Khâ', ar: 'الخاء' },
  'د': { fr: 'Dâl', ar: 'الدال' },
  'ذ': { fr: 'Dhâl', ar: 'الذال' },
  'ر': { fr: 'Râ', ar: 'الراء' },
  'ز': { fr: 'Zây', ar: 'الزاي' },
  'س': { fr: 'Sîn', ar: 'السين' },
  'ش': { fr: 'Chîn', ar: 'الشين' },
  'ص': { fr: 'Ṣâd', ar: 'الصاد' },
  'ض': { fr: 'Ḍâd', ar: 'الضاد' },
  'ط': { fr: 'Ṭâ', ar: 'الطاء' },
  'ظ': { fr: 'Ẓâ', ar: 'الظاء' },
  'ع': { fr: 'Ayn', ar: 'العين' },
  'غ': { fr: 'Ghayn', ar: 'الغين' },
  'ف': { fr: 'Fâ', ar: 'الفاء' },
  'ق': { fr: 'Qâf', ar: 'القاف' },
  'ك': { fr: 'Kâf', ar: 'الكاف' },
  'ل': { fr: 'Lâm', ar: 'اللام' },
  'م': { fr: 'Mîm', ar: 'الميم' },
  'ن': { fr: 'Nûn', ar: 'النون' },
  'ه': { fr: 'Hâ', ar: 'الهاء' },
  'و': { fr: 'Wâw', ar: 'الواو' },
  'ي': { fr: 'Yâ', ar: 'الياء' },
  'ى': { fr: 'Alif Maqsura', ar: 'الألف المقصورة' },
};

export const TAJWEED_COACH_RULES = {
  qalqala: {
    nameFr: 'Qalqala',
    nameAr: 'قلقلة',
    fr: 'Règle de Qalqala (rebond)',
    ar: 'قلقلة',
    prepFr: 'sur la lettre',
    prepAr: 'على حرف',
    descFr: 'Légère résonance ou rebond de la consonne avec soukoun',
    color: '#fbbf24'
  },
  iqlab: {
    nameFr: 'Iqlâb',
    nameAr: 'إقلاب',
    fr: 'Règle d\'Iqlâb (transformation en Mîm)',
    ar: 'إقلاب',
    prepFr: 'avec la lettre',
    prepAr: 'عند حرف',
    descFr: 'Transformation du Noun Sakin en son Mîm avec Ghunnah',
    color: '#2dd4bf'
  },
  ikhfa: {
    nameFr: 'Ikhfâ',
    nameAr: 'إخفاء حقيقي',
    fr: 'Règle d\'Ikhfâ (dissimulation)',
    ar: 'إخفاء حقيقي',
    prepFr: 'devant la lettre',
    prepAr: 'عند حرف',
    descFr: 'Prononciation dissimulée avec Ghunnah de 2 temps',
    color: '#c084fc'
  },
  izhar: {
    nameFr: 'Iẓhâr',
    nameAr: 'إظهار حلقي',
    fr: 'Règle d\'Iẓhâr (prononciation claire)',
    ar: 'إظهار حلقي',
    prepFr: 'devant la lettre',
    prepAr: 'عند حرف',
    descFr: 'Prononciation nette et distincte sans nasalisation',
    color: '#38bdf8'
  },
  idgham_ghunnah: {
    nameFr: 'Idghâm avec Ghunnah',
    nameAr: 'إدغام بغنة',
    fr: 'Règle d\'Idghâm avec Ghunnah (fusion avec nasalisation)',
    ar: 'إدغام بغنة',
    prepFr: 'dans la lettre',
    prepAr: 'في حرف',
    descFr: 'Fusion avec résonance nasale de 2 temps',
    color: '#10b981'
  },
  idgham_no_ghunnah: {
    nameFr: 'Idghâm sans Ghunnah',
    nameAr: 'إدغام بغير غنة',
    fr: 'Règle d\'Idghâm complet sans Ghunnah',
    ar: 'إدغام بغير غنة',
    prepFr: 'dans la lettre',
    prepAr: 'في حرف',
    descFr: 'Assimilation totale et directe sans nasalisation',
    color: '#94a3b8'
  },
  idgham: {
    nameFr: 'Idghâm',
    nameAr: 'إدغام',
    fr: 'Règle d\'Idghâm (fusion)',
    ar: 'إدغام',
    prepFr: 'dans la lettre',
    prepAr: 'في حرف',
    descFr: 'Assimilation de la consonne dans la suivante',
    color: '#10b981'
  },
  ghunnah: {
    nameFr: 'Ghunnah',
    nameAr: 'غنة مشددة',
    fr: 'Règle de Ghunnah (nasalisation)',
    ar: 'غنة مشددة',
    prepFr: 'sur la lettre',
    prepAr: 'على حرف',
    descFr: 'Nasalisation appuyée de 2 temps sur Noun ou Mîm avec Chadda',
    color: '#f43f5e'
  },
  madd_lazim: {
    nameFr: 'Madd Lâzim (6 temps)',
    nameAr: 'مد لازم',
    fr: 'Allongement obligatoire Madd Lâzim de 6 temps',
    ar: 'مد لازم ست حركات',
    prepFr: 'sur la lettre',
    prepAr: 'على حرف',
    descFr: 'Allongement de 6 temps',
    color: '#ec4899'
  },
  madd_muttasil: {
    nameFr: 'Madd Muttaṣil (4-5 temps)',
    nameAr: 'مد متصل',
    fr: 'Allongement Madd Muttaṣil de 4 à 5 temps',
    ar: 'مد متصل واجب',
    prepFr: 'sur la lettre',
    prepAr: 'على حرف',
    descFr: 'Allongement obligatoire dans un même mot',
    color: '#f59e0b'
  },
  madd_munfasil: {
    nameFr: 'Madd Munfaṣil (2-4 temps)',
    nameAr: 'مد منفصل',
    fr: 'Allongement Madd Munfaṣil de 2 à 4 temps',
    ar: 'مد منفصل جائز',
    prepFr: 'sur la lettre',
    prepAr: 'على حرف',
    descFr: 'Allongement séparé entre deux mots',
    color: '#eab308'
  },
  madd: {
    nameFr: 'Madd',
    nameAr: 'مد',
    fr: 'Allongement Madd de 2 temps',
    ar: 'مد طبيعي',
    prepFr: 'sur la lettre',
    prepAr: 'على حرف',
    descFr: 'Prolongation naturelle de la voyelle longue',
    color: '#eab308'
  }
};

export function getTajweedRuleDetails(ruleId) {
  if (TAJWEED_COACH_RULES[ruleId]) return TAJWEED_COACH_RULES[ruleId];
  const meta = TAJWEED_RULES.find(r => r.id === ruleId);
  return {
    nameFr: meta?.name || ruleId,
    nameAr: meta?.nameAr || ruleId,
    fr: `Règle de ${meta?.name || ruleId}`,
    ar: meta?.nameAr || ruleId,
    prepFr: 'sur la lettre',
    prepAr: 'على حرف',
    descFr: meta?.desc || '',
    color: meta?.color || '#fbbf24'
  };
}

/**
 * Scans an ayat, resolves all Tajweed findings, and associates each with
 * an exact or interpolated audio timestamp (startMs, endMs) using the words timestamp data.
 */
export function extractAyatTajweedTimestamps(ayatText, timestamps) {
  if (!ayatText) return [];
  const findings = scanAyatTajweed(ayatText);
  if (!findings || findings.length === 0) return [];

  const words = Array.isArray(timestamps?.words) ? timestamps.words : [];
  const hasValidTs = words.length > 0;
  const textWords = ayatText.trim().split(/\s+/).filter(Boolean);

  const list = [];
  findings.forEach((f, idx) => {
    let startMs = null;
    let endMs = null;

    if (hasValidTs) {
      const wordObj = words[f.wordIdx];
      if (wordObj) {
        const chars = fixChars(wordObj.chars || []);
        if (chars.length > 0) {
          // Exact char search:
          const targetChar = f.char;
          const matchedCharObj = chars.find(
            c => c.char === targetChar || c.char?.includes(targetChar) || targetChar.includes(c.char)
          );
          if (matchedCharObj && typeof matchedCharObj.start === 'number') {
            startMs = Math.round(matchedCharObj.start);
            endMs = Math.round(matchedCharObj.end || matchedCharObj.start + 250);
          } else {
            // Interpolate based on character ratio in the word
            const wStart = wordObj.start ?? chars[0]?.start ?? 0;
            const wEnd = wordObj.end ?? chars[chars.length - 1]?.end ?? (wStart + 800);
            const wText = textWords[f.wordIdx] || "";
            const ratio = wText.length > 1 ? Math.min(1, Math.max(0, (f.idx % (wText.length || 1)) / wText.length)) : 0;
            startMs = Math.round(wStart + ratio * (wEnd - wStart));
            endMs = Math.round(startMs + 250);
          }
        } else if (typeof wordObj.start === 'number') {
          const wStart = wordObj.start;
          const wEnd = typeof wordObj.end === 'number' ? wordObj.end : wStart + 800;
          const wText = textWords[f.wordIdx] || "";
          const ratio = wText.length > 1 ? Math.min(1, Math.max(0, (f.idx % (wText.length || 1)) / wText.length)) : 0;
          startMs = Math.round(wStart + ratio * (wEnd - wStart));
          endMs = Math.round(startMs + 250);
        }
      }
    }

    const letterInfo = ARABIC_LETTER_NAMES[f.char] || { fr: f.char, ar: f.char };
    const matchedLetterInfo = f.matchedWith ? (ARABIC_LETTER_NAMES[f.matchedWith] || { fr: f.matchedWith, ar: f.matchedWith }) : null;
    const ruleDetail = getTajweedRuleDetails(f.ruleId);

    // Form spoken texts in French and Arabic
    let letterFr = letterInfo.fr;
    let letterAr = letterInfo.ar;
    if (matchedLetterInfo) {
      if (f.ruleId === 'iqlab') {
        letterFr = `${letterInfo.fr} transformé en Mîm devant ${matchedLetterInfo.fr}`;
        letterAr = `${letterInfo.ar} المنقلبة إلى ميم عند ${matchedLetterInfo.ar}`;
      } else {
        letterFr = `${letterInfo.fr} avec la lettre ${matchedLetterInfo.fr}`;
        letterAr = `${letterInfo.ar} عند حرف ${matchedLetterInfo.ar}`;
      }
    }

    const speechFr = `Attention : ${ruleDetail.fr} ${ruleDetail.prepFr} ${letterFr}.`;
    const speechAr = `تنبيه : ${ruleDetail.ar} ${ruleDetail.prepAr} ${letterAr}.`;

    list.push({
      id: `tj_rule_${idx}_${f.idx}_${f.ruleId}`,
      findingIndex: idx,
      charIndex: f.idx,
      char: f.char,
      letterNameFr: letterInfo.fr,
      letterNameAr: letterInfo.ar,
      matchedWith: f.matchedWith,
      matchedLetterNameFr: matchedLetterInfo?.fr || '',
      matchedLetterNameAr: matchedLetterInfo?.ar || '',
      ruleId: f.ruleId,
      ruleNameFr: ruleDetail.nameFr,
      ruleNameAr: ruleDetail.nameAr,
      ruleDescFr: ruleDetail.descFr,
      color: f.rule?.color || ruleDetail.color,
      startMs,
      endMs,
      wordIdx: f.wordIdx,
      wordText: textWords[f.wordIdx] || '',
      speechFr,
      speechAr
    });
  });

  return list.sort((a, b) => {
    if (a.startMs != null && b.startMs != null) return a.startMs - b.startMs;
    return a.charIndex - b.charIndex;
  });
}

// ─── Pleasant crystal chime sound using Web Audio API ────────────────────────
let _audioCtx = null;
export function playTajweedAlertSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!_audioCtx || _audioCtx.state === 'closed') {
      _audioCtx = new AudioContextClass();
    }
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }

    const now = _audioCtx.currentTime;

    // First bell tone (D5 ~ 587.33 Hz)
    const osc1 = _audioCtx.createOscillator();
    const gain1 = _audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(_audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);

    // Second bell tone (A5 ~ 880 Hz)
    const osc2 = _audioCtx.createOscillator();
    const gain2 = _audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.24, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(_audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.56);
  } catch (err) {
    console.warn("[TajweedAudioCoach] WebAudio chime error:", err);
  }
}

// ─── Spoken Audio Announcement via SpeechSynthesis ───────────────────────────
let _currentUtterance = null;
let _speechTimeout = null;

export function stopTajweedSpeech() {
  if (_speechTimeout) {
    clearTimeout(_speechTimeout);
    _speechTimeout = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  _currentUtterance = null;
}

/**
 * Speaks the Tajweed rule and letter using speech synthesis.
 * Returns a Promise that resolves ONLY when the rule audio announcement has completely finished.
 */
export function speakTajweedAnnouncement(item, lang = 'fr', playChime = true) {
  return new Promise((resolve) => {
    if (playChime) {
      playTajweedAlertSound();
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setTimeout(resolve, 800);
      return;
    }

    stopTajweedSpeech();

    // Determine speech text and voice language
    let textToSpeak = item.speechFr;
    let speechLang = 'fr-FR';

    if (lang === 'ar') {
      textToSpeak = item.speechAr;
      speechLang = 'ar-SA';
    } else if (lang === 'both') {
      textToSpeak = `${item.speechFr} — ${item.speechAr}`;
      speechLang = 'fr-FR';
    }

    const utter = new SpeechSynthesisUtterance(textToSpeak);
    utter.lang = speechLang;
    utter.rate = speechLang.startsWith('ar') ? 0.85 : 0.95;
    utter.pitch = 1.0;
    utter.volume = 1;

    let hasEnded = false;
    let keepAliveTimer = null;

    const cleanupAndResolve = () => {
      if (hasEnded) return;
      hasEnded = true;
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
      if (_speechTimeout) {
        clearTimeout(_speechTimeout);
        _speechTimeout = null;
      }
      _currentUtterance = null;
      resolve();
    };

    // Generous watchdog timeout (25 seconds) to ensure speech is never cut off
    _speechTimeout = setTimeout(() => {
      cleanupAndResolve();
    }, 25000);

    // Active keep-alive timer to prevent Chrome from pausing speech synthesis mid-utterance
    keepAliveTimer = setInterval(() => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    }, 200);

    utter.onend = () => {
      // Confirm that the speech synthesis engine has truly finished speaking
      const verifySpeakingStopped = () => {
        if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
          setTimeout(verifySpeakingStopped, 120);
        } else {
          // Brief 250ms buffer so speech audio naturally fades before resuming verse
          setTimeout(cleanupAndResolve, 250);
        }
      };
      setTimeout(verifySpeakingStopped, 100);
    };

    utter.onerror = (e) => {
      console.warn("[TajweedAudioCoach] Speech error/canceled:", e?.error || e);
      cleanupAndResolve();
    };

    _currentUtterance = utter;

    // Wait for chime sound (approx 450ms) before starting speech for clean audio separation
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utter);
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err) {
        console.warn("[TajweedAudioCoach] Speech speak() error:", err);
        cleanupAndResolve();
      }
    }, playChime ? 450 : 50);
  });
}
