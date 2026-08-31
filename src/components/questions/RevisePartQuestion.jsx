import React, { useState } from "react";
import { normalizeArabic } from "../../utils/recitationDiff.js";

export function RevisePartQuestion({ q, onAnswer }) {
  const [revealed, setRevealed] = React.useState(false);
  const audioRef = React.useRef(null);

  const partWords = q.partText ? q.partText.split(' ').filter(Boolean) : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, alignItems:'center', width:'100%' }}>
      {/* Context: full ayat text with part highlighted */}
      {q.questionData && (
        <div style={{ direction:'rtl', fontFamily:"'Amiri Quran',serif", fontSize:17,
          textAlign:'center', lineHeight:1.9, color:'var(--text3)',
          background:'var(--surface3)', borderRadius:8, padding:'10px 14px', width:'100%' }}>
          {q.questionData.split(' ').filter(Boolean).map((w, i) => {
            const partWs = q.partText?.split(' ').filter(Boolean) || [];
            const startIdx = q.questionData.split(' ').filter(Boolean).findIndex((_, si) =>
              q.questionData.split(' ').filter(Boolean).slice(si, si + partWs.length).join(' ') === q.partText
            );
            const inPart = startIdx >= 0 && i >= startIdx && i < startIdx + partWs.length;
            return (
              <span key={i} style={{ color: inPart ? '#c878ff' : 'var(--text3)',
                background: inPart ? 'rgba(200,120,255,.08)' : 'transparent',
                borderRadius:3, padding:'0 2px', marginLeft:4 }}>{w}</span>
            );
          })}
        </div>
      )}

      {!revealed ? (
        <>
          <div style={{ fontSize:9, letterSpacing:1.5, color:'#c878ff', fontFamily:"'Cinzel',serif" }}>
            PARTIE {q.partIdx + 1} · {partWords.length} MOTS
          </div>
          <div style={{ fontSize:9, color:'var(--text3)', textAlign:'center', lineHeight:1.6 }}>
            Récite cette partie de mémoire, puis révèle pour vérifier
          </div>
          <button onClick={() => setRevealed(true)}
            style={{ padding:'8px 28px', background:'rgba(200,120,255,.12)',
              border:'1px solid #c878ff', borderRadius:7, color:'#c878ff',
              fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
            RÉVÉLER
          </button>
        </>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center', width:'100%' }}>
          <div style={{ direction:'rtl', fontFamily:"'Amiri Quran',serif", fontSize:22,
            textAlign:'center', lineHeight:2, color:'var(--text1)',
            background:'rgba(200,120,255,.06)', borderRadius:8, padding:'12px 16px', width:'100%',
            border:'1px solid rgba(200,120,255,.2)' }}>
            {q.partText}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => onAnswer(false)}
              style={{ padding:'7px 20px', background:'rgba(229,115,115,.1)',
                border:'1px solid var(--red)', borderRadius:7, color:'var(--red)',
                fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
              ✗ À REVOIR
            </button>
            <button onClick={() => onAnswer(true)}
              style={{ padding:'7px 20px', background:'rgba(76,175,129,.1)',
                border:'1px solid var(--green)', borderRadius:7, color:'var(--green)',
                fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
              ✓ SU
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PageStructureQuestion ────────────────────────────────────────────────────
