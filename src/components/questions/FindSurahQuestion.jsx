import React, { useState } from "react";

export function FindSurahQuestion({ q, surahs, onAnswer }) {
  const [chosen, setChosen] = React.useState(null);
  const correct = q.answer;
  const pick = (sn) => {
    if (chosen !== null) return;
    setChosen(String(sn));
    onAnswer(String(sn) === correct);
  };
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
          const isCorrect = String(sn) === correct;
          const isChosen  = String(sn) === chosen;
          let bg = 'transparent', border = 'var(--border2)', color = 'var(--text2)';
          if (chosen !== null) {
            if (isCorrect)     { bg='rgba(76,175,129,.15)'; border='var(--green)'; color='var(--green)'; }
            else if (isChosen) { bg='rgba(224,90,90,.12)';  border='var(--red)';   color='var(--red)'; }
          }
          return (
            <button key={sn} onClick={() => pick(sn)}
              style={{ padding:'9px 16px', fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif",
                background:bg, border:`1px solid ${border}`, color, borderRadius:8,
                cursor: chosen===null ? 'pointer' : 'default', transition:'all .2s', minWidth:120 }}>
              <span style={{ opacity:.6, marginRight:4 }}>{sn}.</span>{s ? s.englishName : `S.${sn}`}
            </button>
          );
        })}
      </div>
      {chosen !== null && (
        <div style={{ fontSize:9, letterSpacing:1, color: chosen===correct ? 'var(--green)' : 'var(--red)' }}>
          {chosen===correct ? '✓ Correct' : `✗ — ${surahs.find(x=>String(x.number)===correct)?.englishName ?? correct}`}
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
