import React, { useState, useRef, useEffect } from "react";

export function RappelWidget({ onClose }) {
  const [rappelOn,    setRappelOn]    = useState(false);
  const [rappelX,     setRappelX]     = useState(30);
  const [rappelY,     setRappelY]     = useState('');
  const [rappelLang,  setRappelLang]  = useState('ar-SA');
  const [rappelCount, setRappelCount] = useState(0);
  const timerRef  = useRef(null);
  const activeRef = useRef(false);

  const stopRappel = () => {
    activeRef.current = false;
    clearTimeout(timerRef.current);
    clearInterval(keepAliveRef?.current);
    timerRef.current = null;
    window.speechSynthesis?.cancel();
    setRappelOn(false);
  };
  useEffect(() => () => { if (!activeRef.current) stopRappel(); }, []); // eslint-disable-line

  const intervalSecRef = useRef(30);
  const langRef        = useRef('ar-SA');
  const textRef        = useRef('');
  const keepAliveRef   = useRef(null);

  const startRappel = () => {
    if (!rappelY.trim()) return;
    activeRef.current = true;
    intervalSecRef.current = rappelX;
    langRef.current  = rappelLang;
    textRef.current  = rappelY.trim();
    setRappelOn(true);
    setRappelCount(0);

    const ss = window.speechSynthesis;
    if (!ss) return;

    // Keep-alive: Android Chrome pauses TTS after ~15s without a resume()
    keepAliveRef.current = setInterval(() => { if (ss.paused) ss.resume(); }, 5000);

    const scheduleNext = () => {
      if (!activeRef.current) return;
      timerRef.current = setTimeout(() => {
        if (!activeRef.current) return;
        doSpeak();
      }, intervalSecRef.current * 1000);
    };

    const doSpeak = () => {
      if (!activeRef.current) return;
      ss.cancel();
      const utt = new SpeechSynthesisUtterance(textRef.current);
      utt.lang   = langRef.current;
      utt.rate   = 0.85;
      utt.volume = 1;
      utt.onend  = () => { if (activeRef.current) scheduleNext(); };
      utt.onerror = () => { if (activeRef.current) scheduleNext(); };
      ss.speak(utt);
      setRappelCount(c => c + 1);
    };

    doSpeak(); // first speak immediately (called from button click = user gesture ✓)
  };

  // Keep refs in sync with state for use inside closures
  React.useEffect(() => { intervalSecRef.current = rappelX; }, [rappelX]);
  React.useEffect(() => { langRef.current = rappelLang; }, [rappelLang]);
  React.useEffect(() => { textRef.current = rappelY.trim(); }, [rappelY]);

  return (
    <div style={{
      position:'fixed', bottom: 80, right: 16, zIndex: 300,
      background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--radius)',
      padding:'16px', width: 300, boxShadow:'0 8px 32px rgba(0,0,0,.5)',
      display:'flex', flexDirection:'column', gap:12,
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:10, letterSpacing:2, color:rappelOn?'#ffd166':'var(--text3)', fontFamily:"'Cinzel',serif" }}>
          🔔 RAPPEL VOCAL{rappelOn ? ` · ${rappelCount}×` : ''}
        </div>
        <button onClick={onClose} style={{ fontSize:12, background:'transparent', border:'none', color:'var(--text3)', cursor:'pointer' }}>✕</button>
      </div>

      {/* Texte */}
      <textarea value={rappelY} onChange={e=>setRappelY(e.target.value)} disabled={rappelOn}
        placeholder="Texte à lire périodiquement…" rows={3} dir="rtl"
        style={{ background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)',
          padding:'8px 10px', color:'var(--text)', fontSize:16, fontFamily:"'Amiri Quran',serif",
          resize:'vertical', outline:'none', textAlign:'right', opacity:rappelOn?0.6:1, width:'100%' }} />

      {/* Intervalle */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
        {[10,30,60,120,300].map(v => (
          <button key={v} onClick={()=>setRappelX(v)} disabled={rappelOn}
            style={{ fontSize:9, padding:'4px 10px', borderRadius:20, cursor:'pointer', fontFamily:"'Cinzel',serif",
              border:`1px solid ${rappelX===v?'var(--gold)':'var(--border2)'}`,
              background:rappelX===v?'rgba(201,168,76,.12)':'transparent',
              color:rappelX===v?'var(--gold)':'var(--text3)', opacity:rappelOn?0.5:1 }}>
            {v<60?`${v}s`:`${v/60}min`}
          </button>
        ))}
        <input type="number" min="1" value={rappelX} onChange={e=>setRappelX(Math.max(1,parseInt(e.target.value)||1))}
          disabled={rappelOn}
          style={{ width:52, background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)',
            padding:'4px 6px', color:'var(--text)', fontSize:10, outline:'none', textAlign:'center', opacity:rappelOn?0.5:1 }} />
      </div>

      {/* Langue */}
      <div style={{ display:'flex', gap:5 }}>
        {[['ar-SA','AR'],['fr-FR','FR'],['en-US','EN']].map(([lang,label]) => (
          <button key={lang} onClick={()=>setRappelLang(lang)} disabled={rappelOn}
            style={{ fontSize:9, padding:'3px 10px', borderRadius:20, cursor:'pointer', fontFamily:"'Cinzel',serif",
              border:`1px solid ${rappelLang===lang?'#5bc8f5':'var(--border2)'}`,
              background:rappelLang===lang?'rgba(91,200,245,.1)':'transparent',
              color:rappelLang===lang?'#5bc8f5':'var(--text3)', opacity:rappelOn?0.5:1 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Toggle */}
      <button onClick={rappelOn ? stopRappel : startRappel} disabled={!rappelY.trim() && !rappelOn}
        style={{ padding:'8px', fontSize:10, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
          background: rappelOn?'rgba(255,107,107,.12)':'rgba(201,168,76,.08)',
          border:`1px solid ${rappelOn?'#ff6b6b':'var(--gold)'}`,
          color: rappelOn?'#ff6b6b':'var(--gold)',
          borderRadius:'var(--radius-sm)', cursor:'pointer',
          opacity:(!rappelY.trim()&&!rappelOn)?0.4:1 }}>
        {rappelOn ? `⏹ ARRÊTER` : '▶ DÉMARRER'}
      </button>
    </div>
  );
}
