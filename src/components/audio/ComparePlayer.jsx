import { MiniAudioPlayer } from "./MiniAudioPlayer.jsx";
import React, { useState, useRef, useEffect } from "react";

export function ComparePlayer({ userSrc, refSrc }) {
  const userRef = useRef(null);
  const refRef  = useRef(null);
  const [playing, setPlaying]   = useState(false);
  const [userT,   setUserT]     = useState(0);
  const [refT,    setRefT]      = useState(0);
  const [userDur, setUserDur]   = useState(0);
  const [refDur,  setRefDur]    = useState(0);
  const rafRef  = useRef(null);

  const tick = () => {
    if (userRef.current) setUserT(userRef.current.currentTime);
    if (refRef.current)  setRefT(refRef.current.currentTime);
    rafRef.current = requestAnimationFrame(tick);
  };

  const playBoth = () => {
    if (!userRef.current || !refRef.current) return;
    userRef.current.currentTime = 0;
    refRef.current.currentTime  = 0;
    userRef.current.play().catch(()=>{});
    refRef.current.play().catch(()=>{});
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  };

  const pauseBoth = () => {
    userRef.current?.pause();
    refRef.current?.pause();
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
  };

  const stopBoth = () => {
    pauseBoth();
    if (userRef.current) userRef.current.currentTime = 0;
    if (refRef.current)  refRef.current.currentTime  = 0;
    setUserT(0); setRefT(0);
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const handleEnded = () => {
    if (userRef.current?.ended && refRef.current?.ended) {
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
    }
  };

  const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  const progBar = (t, dur, color) => (
    <div style={{height:3,background:"var(--surface3)",borderRadius:2,overflow:"hidden",flex:1}}>
      <div style={{height:"100%",width:`${dur>0?Math.min(1,t/dur)*100:0}%`,background:color,borderRadius:2,transition:"width .1s linear"}}/>
    </div>
  );

  return (
    <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:10,background:"var(--surface2)",borderRadius:8,border:"1px solid var(--border)"}}>
      {/* Hidden audio elements */}
      <audio ref={userRef} src={userSrc} onLoadedMetadata={()=>setUserDur(userRef.current?.duration||0)} onEnded={handleEnded} />
      <audio ref={refRef}  src={refSrc}  onLoadedMetadata={()=>setRefDur(refRef.current?.duration||0)}   onEnded={handleEnded} />

      {/* Sync play controls */}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button onClick={playing ? pauseBoth : playBoth} style={{
          width:36,height:36,borderRadius:"50%",border:"none",cursor:"pointer",
          background:playing?"rgba(255,126,179,.15)":"rgba(62,184,160,.15)",
          color:playing?"#ff7eb3":"var(--teal2)",fontSize:14,
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
        }}>{playing ? "⏸" : "▶"}</button>
        <button onClick={stopBoth} style={{
          width:28,height:28,borderRadius:"50%",border:"1px solid var(--border2)",cursor:"pointer",
          background:"transparent",color:"var(--text3)",fontSize:11,
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
        }}>⏹</button>
        <span style={{fontSize:8,letterSpacing:1.5,color:"var(--gold2)",fontFamily:"'Cinzel',serif"}}>ÉCOUTE SIMULTANÉE</span>
      </div>

      {/* User track */}
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:8,letterSpacing:1,color:"var(--teal2)",flexShrink:0}}>🎙 MOI</span>
          {progBar(userT, userDur, "var(--teal)")}
          <span style={{fontSize:7,color:"var(--text3)",flexShrink:0}}>{fmt(userT)}/{fmt(userDur)}</span>
        </div>
      </div>

      {/* Ref track */}
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:8,letterSpacing:1,color:"var(--gold2)",flexShrink:0}}>📖 REF</span>
          {progBar(refT, refDur, "var(--gold)")}
          <span style={{fontSize:7,color:"var(--text3)",flexShrink:0}}>{fmt(refT)}/{fmt(refDur)}</span>
        </div>
      </div>

      {/* Individual controls */}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        <MiniAudioPlayer src={userSrc} color="var(--teal2)" label="🎙 MOI" />
        <MiniAudioPlayer src={refSrc}  color="var(--gold2)" label="📖 REF" />
      </div>
    </div>
  );
}

// ─── VoiceRecorder sub-component ─────────────────────────────────────────────
