import React, { useState, useRef, useEffect } from "react";

export function MiniAudioPlayer({ src, color = "var(--gold2)", label = null }) {
  const ref  = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur,     setCur]     = useState(0);
  const [dur,     setDur]     = useState(0);
  const rafRef = useRef(null);

  const tick = () => {
    if (ref.current) setCur(ref.current.currentTime);
    rafRef.current = requestAnimationFrame(tick);
  };

  const toggle = () => {
    if (!ref.current) return;
    if (ref.current.paused) { ref.current.play(); setPlaying(true); rafRef.current = requestAnimationFrame(tick); }
    else { ref.current.pause(); setPlaying(false); cancelAnimationFrame(rafRef.current); }
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  const pct = dur > 0 ? Math.min(1, cur / dur) : 0;

  const seek = (e) => {
    if (!ref.current || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    ref.current.currentTime = Math.max(0, Math.min(dur, ((e.clientX - rect.left) / rect.width) * dur));
  };

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
      background:"var(--surface3)", borderRadius:8, border:"1px solid var(--border2)" }}>
      <audio ref={ref} src={src}
        onLoadedMetadata={() => setDur(ref.current?.duration || 0)}
        onEnded={() => { setPlaying(false); cancelAnimationFrame(rafRef.current); setCur(0); }}
        style={{ display:"none" }} />
      <button onClick={toggle} style={{
        width:30, height:30, borderRadius:"50%", border:`1px solid ${color}`,
        background: playing ? `${color}22` : "transparent",
        color, fontSize:11, cursor:"pointer", display:"flex",
        alignItems:"center", justifyContent:"center", flexShrink:0,
      }}>{playing ? "⏸" : "▶"}</button>
      {label && <span style={{ fontSize:8, letterSpacing:1, color:"var(--text3)", flexShrink:0 }}>{label}</span>}
      <div onClick={seek} style={{ flex:1, height:4, background:"var(--surface2)",
        borderRadius:2, cursor:"pointer", overflow:"hidden", position:"relative" }}>
        <div style={{ position:"absolute", left:0, top:0, bottom:0,
          width:`${pct*100}%`, background:color, borderRadius:2, transition:"width .1s linear" }}/>
      </div>
      <span style={{ fontSize:8, color:"var(--text3)", flexShrink:0, fontFamily:"'Cinzel',serif" }}>
        {fmt(cur)}<span style={{color:"var(--border2)"}}>/</span>{fmt(dur)}
      </span>
    </div>
  );
}

// ─── ComparePlayer ────────────────────────────────────────────────────────────
