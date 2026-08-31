import { getAudioBase } from "../../utils/reciterAudio.js";
import React, { useState } from "react";

export function PageStructureQuestion({ q, onAnswer, ayatTexts, globalNums, timestamps, sn }) {
  const [input, setInput]   = React.useState('');
  const [checked, setChecked] = React.useState(false);
  const [correct, setCorrect] = React.useState(false);
  const audioRefs = React.useRef({});

  const check = () => {
    const ok = input.trim() === q.answer.trim();
    setCorrect(ok); setChecked(true);
  };

  // Determine which ayat numbers are relevant for this question
  const relevantAyatNums = React.useMemo(() => {
    if (!checked) return [];
    const { subtype, first, last, multi10, multi5 } = q;
    if (subtype === 'first')    return [first];
    if (subtype === 'last')     return [last];
    if (subtype === 'findpage') {
      const m = q.id?.match(/:findpage:(\d+)$/);
      return m ? [parseInt(m[1])] : [];
    }
    if (subtype === 'multi10')  return multi10 || [];
    if (subtype === 'multi5')   return (multi5 || []).filter(n => n % 10 !== 0);
    if (subtype === 'count')    return [first, last].filter(Boolean);
    return [];
  }, [checked, q]);

  const playAyat = (ayatNum) => {
    const globalNum = globalNums?.[`${sn}:${ayatNum}`];
    if (!globalNum) return;
    const url = `${getAudioBase()}/${globalNum}.mp3`;
    let audio = audioRefs.current[ayatNum];
    if (!audio) { audio = new Audio(url); audioRefs.current[ayatNum] = audio; }
    else audio.src = url;
    audio.currentTime = 0; audio.play().catch(() => {});
  };

  // Page summary card
  const Summary = () => (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginTop:4 }}>
      {[
        { label:'PAGE',    val: q.page,    color:'#c878ff' },
        { label:'PREMIER', val: q.first,   color:'var(--gold2)' },
        { label:'DERNIER', val: q.last,    color:'var(--gold2)' },
        { label:'NB AYATS',val: q.count,   color:'#5bc8f5' },
        q.hizb != null && { label:'HIZB',  val: q.hizb,    color:'#ffd166' },
        q.juz  != null && { label:'JUZ',   val: q.juz,     color:'#a8edea' },
        q.multi10?.length && { label:'× 10', val: q.multi10.join(', '), color:'#ff9f43' },
        q.multi5?.filter(n=>n%10!==0).length && { label:'× 5', val: q.multi5.filter(n=>n%10!==0).join(', '), color:'#ffeaa7' },
      ].filter(Boolean).map(({ label, val, color }) => (
        <div key={label} style={{ display:'flex', flexDirection:'column', alignItems:'center',
          background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)',
          borderRadius:7, padding:'5px 12px', minWidth:52 }}>
          <div style={{ fontSize:13, fontWeight:700, color, fontFamily:"'Cinzel',serif", lineHeight:1 }}>{val}</div>
          <div style={{ fontSize:7, letterSpacing:1.5, color:'var(--text3)', marginTop:3 }}>{label}</div>
        </div>
      ))}
    </div>
  );

  // Ayat card with text + audio
  const AyatCard = ({ ayatNum }) => {
    const text = ayatTexts?.[`${sn}:${ayatNum}`] || '';
    if (!text) return null;
    return (
      <div style={{ width:'100%', background:'var(--surface3)', border:'1px solid var(--border)',
        borderRadius:9, padding:'10px 14px', display:'flex', flexDirection:'column', gap:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:8, letterSpacing:1.5, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>
            VERSET {ayatNum}
          </div>
          <button onClick={() => playAyat(ayatNum)}
            style={{ width:30, height:30, borderRadius:'50%', border:'none',
              background:'rgba(62,184,160,.15)', color:'var(--teal2)',
              fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            ▶
          </button>
        </div>
        <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:20, direction:'rtl',
          textAlign:'right', color:'var(--text1)', lineHeight:2 }}>
          {text}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, alignItems:'center', width:'100%' }}>
      {!checked ? (
        <>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && input.trim() && check()}
            placeholder="Votre réponse…"
            style={{ width:'100%', maxWidth:220, textAlign:'center', padding:'9px 12px',
              background:'var(--surface3)', border:'1px solid var(--border2)',
              borderRadius:8, color:'var(--text1)', fontSize:15, outline:'none',
              fontFamily:"'Cinzel',serif" }} />
          <button onClick={check} disabled={!input.trim()}
            style={{ padding:'8px 28px', background: input.trim() ? 'var(--teal)' : 'var(--surface3)',
              border:'none', borderRadius:7, color: input.trim() ? '#fff' : 'var(--text3)',
              fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              cursor: input.trim() ? 'pointer' : 'default', transition:'all .2s' }}>
            VALIDER
          </button>
        </>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center', width:'100%' }}>
          <div style={{ fontSize:13, letterSpacing:1, fontFamily:"'Cinzel',serif",
            color: correct ? 'var(--green)' : 'var(--red)' }}>
            {correct ? '✓ EXACT !' : `✗ Réponse : ${q.answer}`}
          </div>
          <Summary />
          {/* Show relevant ayats */}
          {relevantAyatNums.length > 0 && (
            <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
              <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)', textAlign:'center' }}>VERSETS</div>
              {relevantAyatNums.map(n => <AyatCard key={n} ayatNum={n} />)}
            </div>
          )}
          <button onClick={() => onAnswer(correct)}
            style={{ padding:'7px 22px', background:'var(--surface3)',
              border:'1px solid var(--border2)', borderRadius:7, color:'var(--text3)',
              fontSize:9, letterSpacing:1, fontFamily:"'Cinzel',serif", cursor:'pointer', marginTop:4 }}>
            CONTINUER →
          </button>
        </div>
      )}
    </div>
  );
}
