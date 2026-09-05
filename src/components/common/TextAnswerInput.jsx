import React, { useState, useRef, useEffect } from "react";
import { useArabicKeyboard } from "./ArabicKeyboard.jsx";
import { normalizeArabic } from "../../utils/recitationDiff.js";

/**
 * Normalizes input and expected answers:
 * - Unifies Eastern Arabic digits (٠-٩) and Western digits (0-9)
 * - Normalizes Arabic diacritics, wasla, dagger alif via normalizeArabic
 * - Leniently unifies teh marbuta (ة/ه) and alef maqsura (ى/ي)
 */
export function normalizeAnswer(str) {
  if (str === null || str === undefined) return "";
  const easternDigits = "٠١٢٣٤٥٦٧٨٩";
  let s = String(str)
    .replace(/[٠-٩]/g, d => easternDigits.indexOf(d))
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "")
    .trim();

  // If numeric answer (e.g. "4"), return digits
  if (/^\d+$/.test(s)) return s;

  return normalizeArabic(s)
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

export function TextAnswerInput({ q, onReveal, onInspect }) {
  const { activeInput } = useArabicKeyboard();
  const [value,     setValue]     = React.useState('');
  const [graded,    setGraded]    = React.useState(null); // null | true | false
  const [diffWords, setDiffWords] = React.useState(null); // [{word, correct}]
  const inputRef = React.useRef(null);

  const isNumeric = /^\d+$/.test(String(q?.answer || '').trim());

  React.useEffect(() => {
    setValue('');
    setGraded(null);
    setDiffWords(null);
    inputRef.current?.focus();
  }, [q?.id]);

  const submit = () => {
    if (!value.trim()) {
      onReveal(null);
      return;
    }
    const userNorm = normalizeAnswer(value);
    const corrNorm = normalizeAnswer(q.answer);
    const correct  = userNorm === corrNorm;

    if (!correct && !isNumeric) {
      const userWords = value.trim().split(/\s+/);
      const corrWords = String(q.answer).trim().split(/\s+/);
      const diff = corrWords.map((w, i) => ({
        word: w,
        correct: i < userWords.length && normalizeAnswer(userWords[i]) === normalizeAnswer(w),
      }));
      setDiffWords(diff);
    }
    setGraded(correct);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (graded === null) submit();
    }
  };

  const borderColor = graded === true  ? 'var(--green)'
                    : graded === false ? 'var(--red)'
                    : 'var(--border)';

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
      {/* Input field */}
      <div style={{ position:'relative', width:'100%' }}>
        {isNumeric ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={e => { if (graded === null) setValue(e.target.value); }}
            onKeyDown={handleKey}
            disabled={graded !== null}
            placeholder="Numéro (ex: 4 ou ٤)…"
            style={{
              width:'100%', boxSizing:'border-box',
              padding:'12px 14px', fontSize:20,
              fontFamily:"'Cinzel',serif",
              textAlign:'center',
              background:'var(--surface3)',
              border:'1.5px solid ' + borderColor,
              borderRadius:10, color:'var(--text1)',
              outline:'none',
              transition:'border-color .25s',
            }}
          />
        ) : (
          <textarea
            ref={inputRef}
            value={value}
            onChange={e => { if (graded === null) setValue(e.target.value); }}
            onKeyDown={handleKey}
            disabled={graded !== null}
            placeholder="اكتب إجابتك بالعربية…"
            rows={2}
            onFocus={e => { if (activeInput) activeInput.current = e.target; }}
            style={{
              width:'100%', boxSizing:'border-box',
              padding:'10px 12px', fontSize:19,
              fontFamily:"'Amiri Quran',serif",
              direction:'rtl', textAlign:'right',
              background:'var(--surface3)',
              border:'1.5px solid ' + borderColor,
              borderRadius:10, color:'var(--text)',
              resize:'none', outline:'none',
              transition:'border-color .25s',
              lineHeight:1.8,
            }}
          />
        )}
        {graded !== null && (
          <div style={{ position:'absolute', top:10, left:12, fontSize:18,
            fontWeight:700, color: graded ? 'var(--green)' : 'var(--red)' }}>
            {graded ? '✓' : '✗'}
          </div>
        )}
      </div>

      {/* Word-level diff on wrong Arabic answer */}
      {graded === false && diffWords && diffWords.length > 0 && (
        <div style={{ padding:'10px 14px', background:'rgba(224,90,90,.06)',
          border:'1px solid var(--red)', borderRadius:8, direction:'rtl' }}>
          <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)',
            direction:'ltr', marginBottom:6, fontFamily:"'Cinzel',serif" }}>COMPARAISON MOT PAR MOT</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {diffWords.map((d, i) => (
              <span key={i} style={{
                fontFamily:"'Amiri Quran',serif", fontSize:17,
                padding:'3px 10px', borderRadius:6,
                background: d.correct ? 'rgba(76,175,129,.18)' : 'rgba(224,90,90,.18)',
                border:'1px solid ' + (d.correct ? 'var(--green)' : 'var(--red)'),
                color: d.correct ? 'var(--green)' : 'var(--red)',
              }}>{d.word}</span>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {graded === null ? (
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => onReveal(null)}
            style={{ padding:'8px 16px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:'transparent', border:'1px solid var(--border2)', color:'var(--text3)',
              borderRadius:8, cursor:'pointer', whiteSpace:'nowrap' }}>
            👁 VOIR
          </button>
          <button onClick={submit} disabled={!value.trim()}
            style={{ flex:1, padding:'10px', fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background: value.trim() ? 'rgba(201,168,76,.12)' : 'transparent',
              border:'1px solid ' + (value.trim() ? 'var(--gold)' : 'var(--border2)'),
              color: value.trim() ? 'var(--gold2)' : 'var(--text3)',
              borderRadius:8, cursor: value.trim() ? 'pointer' : 'default', transition:'all .2s' }}>
            VALIDER
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
          <div style={{
            textAlign:'center', fontSize:11, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
            padding:'8px 12px', borderRadius:8,
            color: graded ? 'var(--green)' : 'var(--red)',
            background: graded ? 'rgba(76,175,129,.1)' : 'rgba(224,90,90,.1)',
            border:'1px solid ' + (graded ? 'var(--green)' : 'var(--red)')
          }}>
            {graded ? '✓ RÉPONSE EXACTE !' : '✗ RÉPONSE INCORRECTE'}
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {!graded && (
              <button onClick={() => { setGraded(null); setDiffWords(null); inputRef.current?.focus(); }}
                style={{ padding:'9px 14px', fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                  background:'transparent', border:'1px solid var(--teal)', color:'var(--teal2)',
                  borderRadius:8, cursor:'pointer' }}>
                ↺ RÉESSAYER
              </button>
            )}

            <button onClick={() => onInspect ? onInspect(graded) : onReveal(null)}
              style={{ flex:1, minWidth:120, padding:'9px 14px', fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                background:'rgba(201,168,76,.08)', border:'1px solid var(--gold)', color:'var(--gold2)',
                borderRadius:8, cursor:'pointer' }}>
              👁 VOIR VERSET & AUDIO
            </button>

            <button onClick={() => onReveal(graded)}
              style={{ flex:1, minWidth:120, padding:'9px 18px', fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif",
                background: graded ? 'rgba(76,175,129,.18)' : 'rgba(224,90,90,.12)',
                border:'1px solid ' + (graded ? 'var(--green)' : 'var(--red)'),
                color: graded ? 'var(--green)' : 'var(--red)',
                borderRadius:8, cursor:'pointer' }}>
              SUIVANT →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
