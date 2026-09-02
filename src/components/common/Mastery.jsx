import React, { useState } from "react";
import { splitArabicClusters } from "../../utils/arabicUtils.js";

/**
 * Calculates letter breakdown for an Ayat:
 * - totalLetters: total letters (clusters) in the ayat
 * - learnedLetters: number of letters learned (nbr lettres apprises)
 * - reviseLetters: number of letters marked to revise
 * - masteryPct: (learnedLetters / totalLetters) * 100 (rounded, 0-100)
 */
export function getAyatLetterStats(ld, ayatText) {
  const words = ayatText ? ayatText.split(' ').filter(Boolean) : [];
  const wordLetterCounts = words.map(w => splitArabicClusters(w).length);
  const totalLetters = wordLetterCounts.reduce((s, c) => s + c, 0);

  if (!ld) {
    return { totalLetters, learnedLetters: 0, reviseLetters: 0, masteryPct: 0 };
  }

  const toRevise = ld.toRevise;

  // If no text is available yet, fallback to high-level indicators
  if (totalLetters === 0) {
    if (ld.learned) {
      const pct = toRevise ? 0 : 100;
      return { totalLetters: 0, learnedLetters: 0, reviseLetters: 0, masteryPct: pct };
    }
    if (ld.parts && ld.parts.length > 0) {
      const lp = ld.parts.filter(p => p.learned).length;
      const pct = Math.round((lp / ld.parts.length) * 100);
      return { totalLetters: 0, learnedLetters: 0, reviseLetters: 0, masteryPct: pct };
    }
    return { totalLetters: 0, learnedLetters: 0, reviseLetters: 0, masteryPct: 0 };
  }

  // Calculate revise letters count
  let reviseLetters = 0;
  if (toRevise === true) {
    reviseLetters = totalLetters;
  } else if (toRevise && typeof toRevise === 'object') {
    const chars = toRevise.chars || {};
    const revWords = toRevise.words || [];
    reviseLetters += Object.values(chars).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
    revWords.forEach(wi => {
      if (!chars[wi] && wordLetterCounts[wi]) {
        reviseLetters += wordLetterCounts[wi];
      }
    });
  }

  let learnedLetters = 0;

  if (ld.learned) {
    // When the ayat is marked as learned, all letters are learned minus any active toRevise letters
    learnedLetters = Math.max(0, totalLetters - reviseLetters);
  } else {
    // When not fully marked learned, sum letters from learned parts and learned words
    const learnedWordIndices = new Set();

    if (Array.isArray(ld.parts)) {
      ld.parts.forEach(p => {
        if (p.learned && Array.isArray(p.wordIndices)) {
          p.wordIndices.forEach(wi => learnedWordIndices.add(wi));
        }
      });
    }

    if (ld.wordsLearned && typeof ld.wordsLearned === 'object') {
      Object.keys(ld.wordsLearned).forEach(wi => {
        if (ld.wordsLearned[wi]) {
          learnedWordIndices.add(Number(wi));
        }
      });
    }

    learnedWordIndices.forEach(wi => {
      const wLen = wordLetterCounts[wi] || 0;
      if (wLen > 0) {
        let wLearned = wLen;
        if (toRevise === true) {
          wLearned = 0;
        } else if (toRevise && typeof toRevise === 'object') {
          if (toRevise.words && toRevise.words.includes(wi)) {
            wLearned = 0;
          } else if (toRevise.chars && Array.isArray(toRevise.chars[wi])) {
            wLearned = Math.max(0, wLen - toRevise.chars[wi].length);
          }
        }
        learnedLetters += wLearned;
      }
    });
  }

  const masteryPct = totalLetters > 0
    ? Math.min(100, Math.max(0, Math.round((learnedLetters / totalLetters) * 100)))
    : (ld.learned ? 100 : 0);

  return { totalLetters, learnedLetters, reviseLetters, masteryPct };
}

export function computeMastery(ld, ayatText) {
  return getAyatLetterStats(ld, ayatText).masteryPct;
}

export function computeSurahMastery(surahNum, numberOfAyahs, learnData, surahTextMap = {}) {
  const total = numberOfAyahs || 0;
  if (total === 0) return 0;
  let sumAyatMastery = 0;
  for (let a = 1; a <= total; a++) {
    const key = `${surahNum}:${a}`;
    const ld = learnData?.[key];
    const text = surahTextMap?.[a] || surahTextMap?.[`${surahNum}:${a}`];
    sumAyatMastery += computeMastery(ld, text);
  }
  return Math.min(100, Math.max(0, Math.round(sumAyatMastery / total)));
}

export function masteryColor(pct) {
  if (pct >= 80) return 'var(--green)';
  if (pct >= 50) return 'var(--gold)';
  if (pct > 0)   return 'var(--teal2)';
  return 'var(--border2)';
}

export function MasteryBar({ pct, size = 'sm' }) {
  const h = size === 'sm' ? 3 : 5;
  return (
    <div style={{ width:'100%', height:h, background:'var(--surface3)', borderRadius:h, overflow:'hidden' }}>
      <div style={{ height:'100%', width:pct+'%', background:masteryColor(pct), borderRadius:h, transition:'width .4s' }} />
    </div>
  );
}

export function MasteryBadge({ pct }) {
  return (
    <span style={{ fontSize:8, letterSpacing:1, padding:'2px 7px', borderRadius:10,
      border:'1px solid '+masteryColor(pct), color:masteryColor(pct),
      fontFamily:"'Cinzel',serif", flexShrink:0 }}>
      {pct}%
    </span>
  );
}

export function MasteryDebug({ ld, ayatText }) {
  const [open, setOpen] = React.useState(false);
  if (!ld) return null;

  const stats = getAyatLetterStats(ld, ayatText);
  const mastery = stats.masteryPct;

  const rows = [
    { label:'📝 Lettres totales',     val: `${stats.totalLetters}`,                                          color:'var(--text2)' },
    { label:'🔖 Lettres à réviser',   val: `${stats.reviseLetters}`,                                         color: stats.reviseLetters > 0 ? '#ff7eb3' : 'var(--text3)' },
    { label:'✅ Lettres apprises',    val: `${stats.learnedLetters}`,                                        color:'var(--teal2)' },
    { label:'🎯 MAÎTRISE',            val: `${stats.learnedLetters} / ${stats.totalLetters} = ${mastery}%`, color: masteryColor(mastery), bold: true },
  ];

  return (
    <div style={{ marginTop:6 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ fontSize:7, letterSpacing:1.5, padding:'3px 10px', borderRadius:6, cursor:'pointer',
          fontFamily:"'Cinzel',serif", background:'transparent',
          border:`1px solid ${open ? masteryColor(mastery) : 'rgba(255,255,255,.1)'}`,
          color: open ? masteryColor(mastery) : 'var(--text3)', transition:'all .2s' }}>
        🔬 DÉTAIL MAÎTRISE ({mastery}%) {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop:6, background:'var(--surface2)', border:'1px solid var(--border)',
          borderRadius:9, overflow:'hidden', fontSize:8 }}>
          {rows.map(({ label, val, color, bold }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'6px 12px', borderBottom:'1px solid rgba(255,255,255,.04)' }}>
              <span style={{ color:'var(--text3)', letterSpacing:.5 }}>{label}</span>
              <span style={{ color, fontWeight: bold ? 700 : 400, fontFamily: bold ? "'Cinzel',serif" : 'inherit',
                fontSize: bold ? 11 : 8 }}>{val}</span>
            </div>
          ))}
          <div style={{ padding:'8px 12px' }}>
            <MasteryBar pct={mastery} size="lg" />
          </div>
        </div>
      )}
    </div>
  );
}