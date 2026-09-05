import React, { useState } from "react";

export function FindSurahQuestion({ q, surahs, onAnswer }) {
  const [chosen, setChosen] = React.useState(null);
  const correct = String(q.answer);

  const pick = (sn) => {
    if (chosen !== null) return;
    setChosen(String(sn));
  };

  const isCorrect = chosen === correct;
  const correctSurah = surahs.find(x => String(x.number) === correct);
  const chosenSurah = surahs.find(x => String(x.number) === chosen);

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:14, alignItems:'center' }}>
      <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:24, direction:'rtl', textAlign:'center',
        color:'var(--text1)', padding:'14px 18px', background:'var(--surface3)',
        borderRadius:10, border:'1px solid var(--border)', lineHeight:2.2, width:'100%' }}>
        {q.questionData}
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', width:'100%' }}>
        {(q.options || []).map(sn => {
          const s = surahs.find(x => x.number === sn);
          const isThisCorrect = String(sn) === correct;
          const isThisChosen  = String(sn) === chosen;
          let bg = 'transparent', border = 'var(--border2)', color = 'var(--text2)';
          if (chosen !== null) {
            if (isThisCorrect)     { bg='rgba(76,175,129,.18)'; border='var(--green)'; color='var(--green)'; }
            else if (isThisChosen) { bg='rgba(224,90,90,.16)';  border='var(--red)';   color='var(--red)'; }
          }
          return (
            <button key={sn} onClick={() => pick(sn)}
              style={{ padding:'10px 18px', fontSize:10, letterSpacing:1, fontFamily:"'Cinzel',serif",
                background:bg, border:`1px solid ${border}`, color, borderRadius:8,
                cursor: chosen===null ? 'pointer' : 'default', transition:'all .2s', minWidth:130,
                display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
              <span><span style={{ opacity:.6, marginRight:4 }}>{sn}.</span>{s ? s.englishName : `S.${sn}`}</span>
              {s?.name && <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:14, opacity:.85 }}>{s.name}</span>}
            </button>
          );
        })}
      </div>

      {chosen !== null && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, width:'100%', marginTop:4 }}>
          <div style={{
            fontSize:11, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
            padding:'8px 16px', borderRadius:8, width:'100%', textAlign:'center',
            color: isCorrect ? 'var(--green)' : 'var(--red)',
            background: isCorrect ? 'rgba(76,175,129,.1)' : 'rgba(224,90,90,.1)',
            border:'1px solid ' + (isCorrect ? 'var(--green)' : 'var(--red)')
          }}>
            {isCorrect ? '✓ EXACT ! C\'EST BIEN CETTE SOURATE' : `✗ RÉPONSE ATTENDUE : ${correctSurah?.englishName.toUpperCase() ?? correct}`}
          </div>

          <div style={{ display:'flex', gap:8 }}>
            {!isCorrect && (
              <button onClick={() => setChosen(null)}
                style={{ padding:'8px 16px', fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                  background:'transparent', border:'1px solid var(--teal)', color:'var(--teal2)',
                  borderRadius:8, cursor:'pointer' }}>
                ↺ RÉESSAYER
              </button>
            )}
            <button onClick={() => onAnswer(isCorrect)}
              style={{ padding:'9px 24px', fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif",
                background: isCorrect ? 'rgba(76,175,129,.2)' : 'rgba(224,90,90,.15)',
                border:'1px solid ' + (isCorrect ? 'var(--green)' : 'var(--red)'),
                color: isCorrect ? 'var(--green)' : 'var(--red)',
                borderRadius:8, cursor:'pointer' }}>
              CONTINUER →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QuranBookPage ────────────────────────────────────────────────────────────
// Inspired by Codrops / billionbd CodePen: hardcover_front + pages + spine
// Structure: <ul class="qbook"> with li.qbook-hc-front, li.qbook-pages,
//            li.qbook-page (flipping leaf), li.qbook-hc-back
const MUSHAF_TOTAL = 604;
