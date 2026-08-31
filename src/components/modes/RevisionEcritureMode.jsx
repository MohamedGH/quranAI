import React, { useState, useRef } from "react";
import { useArabicKeyboard } from "../common/ArabicKeyboard.jsx";
import { stripDiacritics } from "../../utils/arabicUtils.js";

export function RevisionEcritureMode({ ayat, surahNum, ld, setLData, spellCheck = false }) {
  const { activeInput: arabicActiveInput } = useArabicKeyboard();
  // Persisted attempts: ld.writingAttempts = [{ date, text, score, correct }]
  const attempts  = ld?.writingAttempts || [];
  const [input, setInput]   = useState('');
  const [result, setResult] = useState(null); // { score, expected, typed, diff }
  const [showRef, setShowRef] = useState(false);
  const [phase, setPhase]   = useState('write'); // 'write' | 'result'

  const saveAttempt = (attempt) =>
    setLData(surahNum, ayat.numberInSurah, d => ({
      ...d,
      writingAttempts: [...(d.writingAttempts || []).slice(-19), attempt],
    }));

  const normalizeW = s => s.replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '').trim();

  const checkAnswer = () => {
    const typed    = input.trim();
    const expected = ayat.text.trim();
    if (!typed) return;

    const tWords = normalizeW(typed).split(/\s+/).filter(Boolean);
    const eWords = normalizeW(expected).split(/\s+/).filter(Boolean);
    const correct = tWords.filter((w, i) => w === eWords[i]).length;
    const score   = eWords.length > 0 ? Math.round((correct / eWords.length) * 100) : 0;

    // Word-level diff
    const diff = eWords.map((w, i) => ({
      word: w,
      typed: tWords[i] || '',
      ok: tWords[i] === w,
    }));

    const attempt = { date: new Date().toISOString(), text: typed, score, correct, total: eWords.length };
    saveAttempt(attempt);
    setResult({ score, diff, expected, typed, correct, total: eWords.length });
    setPhase('result');
  };

  const reset = () => { setInput(''); setResult(null); setPhase('write'); setShowRef(false); };

  const scoreColor = result
    ? result.score === 100 ? '#4caf81' : result.score >= 70 ? '#ffd166' : result.score >= 40 ? '#ff9f43' : '#ff6b6b'
    : 'var(--gold)';

  return (
    <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:14 }}>

      {phase === 'write' && (
        <>
          {/* Hint toggle */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:9, letterSpacing:2, color:'var(--text3)' }}>RÉCRIRE L'AYAT DE MÉMOIRE</div>
            <button onClick={()=>setShowRef(v=>!v)}
              style={{ fontSize:8, letterSpacing:1, padding:'3px 10px', border:`1px solid ${showRef?'var(--gold)':'var(--border2)'}`,
                background:'transparent', color:showRef?'var(--gold)':'var(--text3)', borderRadius:12, cursor:'pointer', fontFamily:"'Cinzel',serif" }}>
              {showRef ? 'CACHER' : 'AFFICHER'}
            </button>
          </div>

          {showRef && (
            <div style={{ background:'var(--surface2)', borderRadius:'var(--radius-sm)', padding:'10px 14px',
              fontFamily:"'Amiri Quran',serif", fontSize:22, direction:'rtl', textAlign:'right', color:'var(--gold)', lineHeight:1.8, opacity:.7 }}>
              {ayat.text}
            </div>
          )}

          <textarea spellCheck={spellCheck} lang="fr"
            onFocus={e => { if (arabicActiveInput) arabicActiveInput.current = e.target; }}
            value={input}
            onChange={e => setInput(e.target.value)}
            dir="rtl"
            placeholder="اكتب الآية من الذاكرة…"
            rows={4}
            style={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)',
              padding:'10px 12px', color:'var(--text)', fontSize:20, fontFamily:"'Amiri Quran',serif",
              direction:'rtl', textAlign:'right', resize:'vertical', outline:'none', lineHeight:1.8,
              transition:'border-color .2s' }}
          />

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={checkAnswer} disabled={!input.trim()}
              style={{ flex:1, padding:'8px 20px', fontSize:10, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                background:'transparent', border:'1px solid var(--gold)', color:'var(--gold)',
                borderRadius:'var(--radius-sm)', cursor:'pointer', opacity: input.trim()?1:0.4, transition:'all .2s' }}>
              VÉRIFIER
            </button>
            <button onClick={() => { setLData(surahNum, ayat.numberInSurah, d=>({...d,learned:true})); reset(); }}
              style={{ flex:1, padding:'8px 20px', fontSize:10, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                background:'rgba(76,175,129,.1)', border:'1px solid #4caf81', color:'#4caf81',
                borderRadius:'var(--radius-sm)', cursor:'pointer', transition:'all .2s' }}>
              ✓ JE ME SOUVIENS
            </button>
          </div>
        </>
      )}

      {phase === 'result' && result && (
        <>
          {/* Score */}
          <div style={{ textAlign:'center', padding:'8px 0' }}>
            <div style={{ fontSize:36, fontFamily:"'Cinzel',serif", color:scoreColor, lineHeight:1 }}>{result.score}%</div>
            <div style={{ fontSize:9, letterSpacing:2, color:'var(--text3)', marginTop:4 }}>
              {result.correct}/{result.total} MOTS CORRECTS
            </div>
            <div style={{ height:4, background:'var(--surface3)', borderRadius:2, marginTop:10, overflow:'hidden' }}>
              <div style={{ width:`${result.score}%`, height:'100%', background:scoreColor, borderRadius:2, transition:'width .5s' }}/>
            </div>
          </div>

          {/* Word diff */}
          <div>
            <div style={{ fontSize:9, letterSpacing:2, color:'var(--text3)', marginBottom:8 }}>COMPARAISON MOT PAR MOT</div>
            <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:17, direction:'rtl', textAlign:'right', lineHeight:2.2, flexWrap:'wrap', display:'flex', gap:4, justifyContent:'flex-end' }}>
              {result.diff.map((item, i) => (
                <span key={i} style={{ position:'relative', padding:'2px 4px', borderRadius:4,
                  background: item.ok ? 'rgba(76,175,129,.15)' : 'rgba(255,107,107,.15)',
                  border: `1px solid ${item.ok ? '#4caf81' : '#ff6b6b'}22`,
                  color: item.ok ? '#4caf81' : '#ff6b6b' }}>
                  {item.ok ? item.word : (
                    <span>
                      <span style={{ textDecoration:'line-through', opacity:.5 }}>{item.typed||'—'}</span>
                      {' '}
                      <span style={{ color:'#4caf81' }}>{item.word}</span>
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={reset}
              style={{ flex:1, padding:'7px', fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                background:'transparent', border:'1px solid var(--gold)', color:'var(--gold)',
                borderRadius:'var(--radius-sm)', cursor:'pointer' }}>
              RÉESSAYER
            </button>
            {result.score === 100 && (
              <button onClick={()=>setLData(surahNum, ayat.numberInSurah, d=>({...d,learned:true}))}
                style={{ flex:1, padding:'7px', fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                  background:'rgba(76,175,129,.12)', border:'1px solid #4caf81', color:'#4caf81',
                  borderRadius:'var(--radius-sm)', cursor:'pointer' }}>
                ✓ MARQUER APPRIS
              </button>
            )}
          </div>
        </>
      )}

      {/* Historique */}
      {attempts.length > 0 && (
        <div>
          <div style={{ fontSize:9, letterSpacing:2, color:'var(--text3)', marginBottom:6 }}>HISTORIQUE ({attempts.length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {[...attempts].reverse().map((a, i) => {
              const c = a.score===100?'#4caf81':a.score>=70?'#ffd166':a.score>=40?'#ff9f43':'#ff6b6b';
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px',
                  background:'var(--surface2)', borderRadius:'var(--radius-sm)', border:`1px solid ${c}22` }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', border:`1px solid ${c}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:c, fontFamily:"'Cinzel',serif", flexShrink:0 }}>{a.score}%</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:8, color:'var(--text3)', marginBottom:2 }}>{a.correct}/{a.total} mots</div>
                    <div style={{ fontSize:9, color:'var(--text3)' }}>{new Date(a.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
