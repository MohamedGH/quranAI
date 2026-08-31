import React, { useState } from "react";
import { splitArabicClusters } from "../../utils/arabicUtils.js";

export function computeMastery(ld, ayatText) {
  const toRevise    = ld?.toRevise;
  const words       = ayatText ? ayatText.split(' ').filter(Boolean) : [];
  const totalLetters = words.reduce((s, w) => s + splitArabicClusters(w).length, 0);

  if (totalLetters === 0) return 0;

  let reviseLetters = 0;
  if (toRevise === true) {
    reviseLetters = totalLetters;
  } else if (toRevise && typeof toRevise === 'object') {
    const chars    = toRevise.chars   || {};
    const revWords = toRevise.words   || [];
    reviseLetters += Object.values(chars).reduce((s, arr) => s + arr.length, 0);
    revWords.forEach(wi => {
      if (!chars[wi] && words[wi]) reviseLetters += splitArabicClusters(words[wi]).length;
    });
  }

  const knownLetters = Math.max(0, totalLetters - reviseLetters);
  return Math.round(knownLetters / totalLetters * 100);
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

  const toRevise     = ld.toRevise;
  const words        = ayatText ? ayatText.split(' ').filter(Boolean) : [];
  const totalLetters = words.reduce((s, w) => s + splitArabicClusters(w).length, 0);

  let reviseLetters = 0;
  if (toRevise === true) {
    reviseLetters = totalLetters;
  } else if (toRevise && typeof toRevise === 'object') {
    const chars    = toRevise.chars   || {};
    const revWords = toRevise.words   || [];
    reviseLetters += Object.values(chars).reduce((s, arr) => s + arr.length, 0);
    revWords.forEach(wi => { if (!chars[wi] && words[wi]) reviseLetters += splitArabicClusters(words[wi]).length; });
  }

  const knownLetters = Math.max(0, totalLetters - reviseLetters);
  const mastery      = totalLetters > 0 ? Math.round(knownLetters / totalLetters * 100) : 0;

  const rows = [
    { label:'📝 Lettres totales',     val: `${totalLetters}`,                                          color:'var(--text2)' },
    { label:'🔖 Lettres à réviser',   val: `${reviseLetters}`,                                         color: reviseLetters > 0 ? '#ff7eb3' : 'var(--text3)' },
    { label:'✅ Lettres connues',     val: `${knownLetters}`,                                           color:'var(--teal2)' },
    { label:'🎯 MAÎTRISE',            val: `${knownLetters} / ${totalLetters} = ${mastery}%`,           color: masteryColor(mastery), bold: true },
  ];

  return (
    <div style={{ marginTop:6 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ fontSize:7, letterSpacing:1.5, padding:'3px 10px', borderRadius:6, cursor:'pointer',
          fontFamily:"'Cinzel',serif", background:'transparent',
          border:`1px solid ${open ? masteryColor(mastery) : 'rgba(255,255,255,.1)'}`,
          color: open ? masteryColor(mastery) : 'var(--text3)', transition:'all .2s' }}>
        🔬 DEBUG MAÎTRISE {open ? '▲' : '▼'}
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