import React, { useState, useRef, useEffect } from "react";
import { useArabicKeyboard } from "./ArabicKeyboard.jsx";
import { normalizeArabic } from "../../utils/recitationDiff.js";

export function TextAnswerInput({ q, onReveal }) {
  const { activeInput } = useArabicKeyboard();
  const [value,    setValue]    = React.useState('');
  const [graded,   setGraded]   = React.useState(null); // null | true | false
  const [diffWords, setDiffWords] = React.useState(null); // [{word, correct}]
  const inputRef = React.useRef(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = () => {
    if (!value.trim()) { onReveal(null); return; }
    const userNorm = normalizeArabic(value.trim());
    const corrNorm = normalizeArabic(q.answer.trim());
    const correct  = userNorm === corrNorm;
    // Build word-level diff for wrong answers
    if (!correct) {
      const userWords = value.trim().split(/\s+/);
      const corrWords = q.answer.trim().split(/\s+/);
      const diff = corrWords.map((w, i) => ({
        word: w,
        correct: i < userWords.length && normalizeArabic(userWords[i]) === normalizeArabic(w),
      }));
      setDiffWords(diff);
    }
    setGraded(correct);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (graded === null) submit(); }
  };

  const borderColor = graded === true  ? 'var(--green)'
                    : graded === false ? 'var(--red)'
                    : 'var(--border)';

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
      {/* Input field */}
      <div style={{ position:'relative' }}>
        <textarea
          ref={inputRef}
          value={value}
          onChange={e => { if (graded === null) setValue(e.target.value); }}
          onKeyDown={handleKey}
          disabled={graded !== null}
          placeholder="كتب إجابتك…"
          rows={2}
          onFocus={e => { if (activeInput) activeInput.current = e.target; }}
          style={{
            width:'100%', boxSizing:'border-box',
            padding:'10px 12px', fontSize:18,
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
        {graded !== null && (
          <div style={{ position:'absolute', top:8, left:10, fontSize:16,
            color: graded ? 'var(--green)' : 'var(--red)' }}>
            {graded ? '✓' : '✗'}
          </div>
        )}
      </div>

      {/* Word-level diff on wrong answer */}
      {graded === false && diffWords && (
        <div style={{ padding:'8px 12px', background:'rgba(224,90,90,.06)',
          border:'1px solid var(--red)', borderRadius:8, direction:'rtl' }}>
          <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)',
            direction:'ltr', marginBottom:6 }}>MOT PAR MOT</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {diffWords.map((d, i) => (
              <span key={i} style={{
                fontFamily:"'Amiri Quran',serif", fontSize:16,
                padding:'2px 8px', borderRadius:6,
                background: d.correct ? 'rgba(76,175,129,.18)' : 'rgba(224,90,90,.18)',
                border:'1px solid ' + (d.correct ? 'var(--green)' : 'var(--red)'),
                color:'var(--text)',
              }}>{d.word}</span>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {graded === null ? (
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => onReveal(null)}
            style={{ padding:'7px 14px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:'transparent', border:'1px solid var(--border2)', color:'var(--text3)',
              borderRadius:8, cursor:'pointer' }}>
            👁 VOIR
          </button>
          <button onClick={submit} disabled={!value.trim()}
            style={{ flex:1, padding:'9px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background: value.trim() ? 'rgba(201,168,76,.12)' : 'transparent',
              border:'1px solid ' + (value.trim() ? 'var(--gold)' : 'var(--border2)'),
              color: value.trim() ? 'var(--gold2)' : 'var(--text3)',
              borderRadius:8, cursor: value.trim() ? 'pointer' : 'default', transition:'all .2s' }}>
            VALIDER
          </button>
        </div>
      ) : (
        <button onClick={() => onReveal(graded)}
          style={{ padding:'9px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
            background: graded ? 'rgba(76,175,129,.12)' : 'rgba(224,90,90,.08)',
            border:'1px solid ' + (graded ? 'var(--green)' : 'var(--red)'),
            color: graded ? 'var(--green)' : 'var(--red)',
            borderRadius:8, cursor:'pointer', width:'100%' }}>
          {graded ? '✓ CORRECT — VOIR LE VERSET' : '✗ INCORRECT — VOIR LE VERSET'}
        </button>
      )}
    </div>
  );
}
