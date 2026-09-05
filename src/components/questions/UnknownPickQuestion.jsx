import React, { useState } from "react";
import { normalizeArabic } from "../../utils/recitationDiff.js";

export function UnknownPickQuestion({ q, onAnswer }) {
  const [selected, setSelected] = React.useState(new Set());
  const [checked,  setChecked]  = React.useState(false);
  const [result,   setResult]   = React.useState(null); // true/false

  const correctSet = new Set((q.answer || '').split('|').filter(Boolean));

  const toggle = (w) => {
    if (checked) return;
    setSelected(prev => {
      const n = new Set(prev);
      n.has(w) ? n.delete(w) : n.add(w);
      return n;
    });
  };

  const check = () => {
    // correct if selected set equals correctSet — empty selection is a valid
    // submission (e.g. no unknown/marked words left), not blocked anymore
    const correct = selected.size === correctSet.size &&
      [...selected].every(w => correctSet.has(w));
    setResult(correct);
    setChecked(true);
  };

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      {/* Full ayat display */}
      <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:20, direction:'rtl',
        textAlign:'center', color:'var(--text1)', padding:'12px 16px', width:'100%',
        background:'var(--surface3)', borderRadius:9, border:'1px solid var(--border)', lineHeight:2.4 }}>
        {q.questionData}
      </div>

      {/* Word chips */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center',
        direction:'rtl', width:'100%' }}>
        {(q.options || []).map((w, i) => {
          const isSel  = selected.has(w);
          const isCorr = checked && correctSet.has(w);
          const isWrong= checked && isSel && !correctSet.has(w);
          const isMissed=checked && !isSel && correctSet.has(w);
          return (
            <button key={i} onClick={() => toggle(w)}
              style={{
                fontFamily:"'Amiri Quran',serif", fontSize:18, direction:'rtl',
                padding:'6px 14px', borderRadius:8, cursor: checked?'default':'pointer',
                border: isCorr  ? '2px solid var(--green)'
                      : isWrong ? '2px solid var(--red)'
                      : isMissed? '2px dashed var(--gold)'
                      : isSel   ? '2px solid var(--teal)'
                      :           '1px solid var(--border2)',
                background: isCorr   ? 'rgba(76,175,129,.15)'
                           : isWrong  ? 'rgba(255,80,80,.12)'
                           : isMissed ? 'rgba(201,168,76,.10)'
                           : isSel    ? 'rgba(62,184,160,.12)'
                           :            'var(--surface3)',
                color:'var(--text1)',
                transition:'all .15s',
              }}>
              {w}
              {isCorr  && <span style={{fontSize:9,marginRight:4,color:'var(--green)'}}> ✓</span>}
              {isWrong && <span style={{fontSize:9,marginRight:4,color:'var(--red)'}}>  ✗</span>}
              {isMissed&& <span style={{fontSize:9,marginRight:4,color:'var(--gold)'}}>  !</span>}
            </button>
          );
        })}
      </div>

      {/* Hint */}
      <div style={{ fontSize:8, color:'var(--text3)', letterSpacing:.5 }}>
        {checked ? '' : q.toRevise
          ? `Sélectionne ${correctSet.size} mot${correctSet.size>1?'s':''} marqué${correctSet.size>1?'s':''} à réviser`
          : `Sélectionne ${correctSet.size} mot${correctSet.size>1?'s':''} inconnu${correctSet.size>1?'s':''}`}
      </div>

      {/* Actions */}
      {!checked ? (
        <button onClick={check}
          style={{ padding:'8px 24px', background:'var(--teal)',
            border:'none', borderRadius:7, color:'#fff',
            fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
            cursor:'pointer', transition:'all .2s' }}>
          VALIDER
        </button>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
          <div style={{ fontSize:11, letterSpacing:1,
            color: result?'var(--green)':'var(--red)',
            fontFamily:"'Cinzel',serif" }}>
            {result ? '✓ EXACT !' : '✗ PAS TOUT À FAIT'}
          </div>
          {!result && (
            <div style={{ color:'var(--text3)', textAlign:'center', direction:'rtl',
              fontFamily:"'Amiri Quran',serif", fontSize:14 }}>
              {correctSet.size === 0
                ? (q.toRevise ? 'Aucun mot marqué à réviser' : 'Aucun mot inconnu')
                : `${q.toRevise ? 'Mots à réviser' : 'Mots inconnus'} : ${[...correctSet].join('  ·  ')}`}
            </div>
          )}
          {/* If toRevise: ask whether to keep or remove from à-réviser */}
          {q.toRevise ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center', width:'100%' }}>
              <div style={{ fontSize:8, letterSpacing:1.5, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>
                🔖 RETIRER DE LA LISTE À RÉVISER ?
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => onAnswer(result, true)}
                  style={{ padding:'7px 16px', background:'rgba(76,175,129,.1)',
                    border:'1px solid var(--green)', borderRadius:7, color:'var(--green)',
                    fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                  ✓ OUI — MAÎTRISÉ
                </button>
                <button onClick={() => onAnswer(result, false)}
                  style={{ padding:'7px 16px', background:'rgba(255,80,80,.08)',
                    border:'1px solid var(--red)', borderRadius:7, color:'var(--red)',
                    fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                  🔖 GARDER
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              {!result && (
                <button onClick={() => { setChecked(false); setSelected(new Set()); }}
                  style={{ padding:'8px 16px', background:'transparent',
                    border:'1px solid var(--teal)', borderRadius:7, color:'var(--teal2)',
                    fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                  ↺ RÉESSAYER
                </button>
              )}
              <button onClick={() => onAnswer(result)}
                style={{ padding:'9px 24px', background: result ? 'rgba(76,175,129,.18)' : 'rgba(224,90,90,.12)',
                  border:'1px solid ' + (result ? 'var(--green)' : 'var(--red)'), borderRadius:7,
                  color: result ? 'var(--green)' : 'var(--red)',
                  fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                CONTINUER →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── RevisePartQuestion ───────────────────────────────────────────────────────
