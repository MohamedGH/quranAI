import React, { useState } from "react";
import { normalizeArabic } from "../../utils/recitationDiff.js";

export function UnknownWordQuestion({ q, onAnswer }) {
  const answerWords = React.useMemo(() => (q.answer || '').split('|').filter(Boolean), [q.answer]);
  const isMulti = answerWords.length > 1;
  const [vals,      setVals]     = React.useState(() => answerWords.map(() => ''));
  const [shaken,    setShaken]   = React.useState(false);
  const [revealed,  setRevealed] = React.useState(false);
  const [checked,   setChecked]  = React.useState(false);
  const [correctArr,setCorrectArr] = React.useState([]); // per-word correctness

  const correct = correctArr.length > 0 && correctArr.every(Boolean);

  const _normQ = s => s.trim().replace(/[ؐ-ًؚ-ٰٟۖ-ۭ\u200c]/g,'').replace(/أ|إ|آ/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');

  const setValAt = (i, v) => setVals(prev => prev.map((p, pi) => pi === i ? v : p));

  const submit = () => {
    if (vals.some(v => !v.trim())) return;
    const results = answerWords.map((w, i) => _normQ(vals[i]) === _normQ(w));
    if (results.some(r => !r)) { setShaken(true); setTimeout(() => setShaken(false), 500); }
    setCorrectArr(results);
    setChecked(true);
  };

  const reveal = () => { setRevealed(true); setChecked(true); setCorrectArr(answerWords.map(() => false)); };

  const proceed = (removeRevise) => onAnswer(correct, removeRevise);

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
      {/* Ayat with masked word(s) */}
      <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:20, direction:'rtl',
        textAlign:'center', color:'var(--text1)', padding:'12px 16px', width:'100%',
        background:'var(--surface3)', borderRadius:9, border:'1px solid var(--border)', lineHeight:2.4 }}>
        {q.questionData}
      </div>

      {!checked ? (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
            {answerWords.map((_, i) => (
              <input key={i} autoFocus={i === 0} value={vals[i]}
                onChange={e => setValAt(i, e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder={isMulti ? `Mot manquant ${i+1}/${answerWords.length}…` : "Écris le mot arabe manquant…"}
                dir="rtl"
                style={{ width:'100%', padding:'10px 14px', fontSize:18,
                  fontFamily:"'Amiri Quran',serif", direction:'rtl', textAlign:'center',
                  background:'var(--surface3)', border:`1px solid ${shaken?'var(--red)':'var(--border2)'}`,
                  borderRadius:8, color:'var(--text1)', outline:'none',
                  animation: shaken ? 'qshake .4s' : 'none' }} />
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={submit}
              style={{ padding:'8px 22px', background:'var(--teal)', border:'none',
                borderRadius:7, color:'#fff', fontSize:9, letterSpacing:2,
                fontFamily:"'Cinzel',serif", cursor:'pointer' }}>VALIDER</button>
            <button onClick={reveal}
              style={{ padding:'8px 16px', background:'transparent',
                border:'1px solid var(--border2)', borderRadius:7,
                color:'var(--text3)', fontSize:9, letterSpacing:1,
                fontFamily:"'Cinzel',serif", cursor:'pointer' }}>{isMulti ? 'VOIR LES MOTS' : 'VOIR LE MOT'}</button>
          </div>
        </>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', alignItems:'center' }}>
          {/* Feedback */}
          <div style={{ fontSize:13, fontFamily:"'Cinzel',serif", letterSpacing:1,
            color: correct ? 'var(--green)' : 'var(--red)' }}>
            {correct ? '✓ EXACT !' : revealed ? (isMulti ? '📖 RÉPONSES :' : '📖 RÉPONSE :') : (isMulti ? '✗ Réponses :' : '✗ Réponse :')}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
            {answerWords.map((w, i) => (
              <div key={i} style={{ fontFamily:"'Amiri Quran',serif", fontSize:24, direction:'rtl', textAlign:'center',
                padding:'10px 18px', borderRadius:8,
                background: correctArr[i] ? 'rgba(76,175,129,.08)' : 'rgba(201,168,76,.07)',
                border: `1px solid ${correctArr[i] ? 'var(--green)' : 'var(--gold)'}`,
                color: correctArr[i] ? 'var(--green)' : 'var(--gold2)' }}>
                {w}
                {isMulti && <span style={{fontSize:11,marginRight:6}}>{correctArr[i] ? ' ✓' : (revealed ? '' : ' ✗')}</span>}
              </div>
            ))}
          </div>

          {/* If toRevise: ask whether to keep or remove from à-réviser */}
          {q.toRevise ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'center', width:'100%' }}>
              <div style={{ fontSize:8, letterSpacing:1.5, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>
                🔖 RETIRER DE LA LISTE À RÉVISER ?
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => proceed(true)}
                  style={{ padding:'7px 16px', background:'rgba(76,175,129,.1)',
                    border:'1px solid var(--green)', borderRadius:7, color:'var(--green)',
                    fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                  ✓ OUI — MAÎTRISÉ
                </button>
                <button onClick={() => proceed(false)}
                  style={{ padding:'7px 16px', background:'rgba(255,80,80,.08)',
                    border:'1px solid var(--red)', borderRadius:7, color:'var(--red)',
                    fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                  🔖 GARDER
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', gap:10 }}>
              {!correct && (
                <button onClick={() => onAnswer(false)}
                  style={{ padding:'7px 18px', background:'rgba(255,80,80,.12)',
                    border:'1px solid var(--red)', borderRadius:7, color:'var(--red)',
                    fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                  ✗ À REVOIR
                </button>
              )}
              <button onClick={() => onAnswer(correct)}
                style={{ padding:'7px 18px', background: correct ? 'rgba(76,175,129,.12)' : 'rgba(255,255,255,.05)',
                  border:`1px solid ${correct ? 'var(--green)' : 'var(--border2)'}`,
                  borderRadius:7, color: correct ? 'var(--green)' : 'var(--text3)',
                  fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
                {correct ? '✓ CONTINUER' : 'CONTINUER →'}
              </button>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes qshake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}60%{transform:translateX(6px)}80%{transform:translateX(-3px)}}`}</style>
    </div>
  );
}

// ─── UnknownPickQuestion ──────────────────────────────────────────────────────
// Shows full ayat → user picks which words they don't know (multi-select MCQ)
// Correct = selecting exactly the unknown words
