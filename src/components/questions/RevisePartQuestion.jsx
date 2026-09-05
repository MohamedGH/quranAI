import React, { useState, useRef } from "react";
import { getAudioBase } from "../../utils/reciterAudio.js";

export function RevisePartQuestion({ q, onAnswer, globalNums, sn }) {
  const [revealed, setRevealed] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const audioRef = React.useRef(null);

  const qSn = q.sn ?? sn;
  const globalNum = globalNums?.[`${qSn}:${q.ayatNum}`];

  const togglePlay = () => {
    if (!globalNum) return;
    if (!audioRef.current) {
      const url = `${getAudioBase()}/${globalNum}.mp3`;
      const audio = new Audio(url);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      audioRef.current = audio;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [q.id]);

  const partWords = q.partText ? q.partText.split(' ').filter(Boolean) : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, alignItems:'center', width:'100%' }}>
      {/* Context: full ayat text with part highlighted */}
      {q.questionData && (
        <div style={{ direction:'rtl', fontFamily:"'Amiri Quran',serif", fontSize:17,
          textAlign:'center', lineHeight:1.9, color:'var(--text3)',
          background:'var(--surface3)', borderRadius:8, padding:'10px 14px', width:'100%' }}>
          {q.questionData.split(' ').filter(Boolean).map((w, i) => {
            const partWs = q.partText?.split(' ').filter(Boolean) || [];
            const startIdx = q.questionData.split(' ').filter(Boolean).findIndex((_, si) =>
              q.questionData.split(' ').filter(Boolean).slice(si, si + partWs.length).join(' ') === q.partText
            );
            const inPart = startIdx >= 0 && i >= startIdx && i < startIdx + partWs.length;
            return (
              <span key={i} style={{ color: inPart ? '#c878ff' : 'var(--text3)',
                background: inPart ? 'rgba(200,120,255,.08)' : 'transparent',
                borderRadius:3, padding:'0 2px', marginLeft:4 }}>{w}</span>
            );
          })}
        </div>
      )}

      {globalNum && (
        <button onClick={togglePlay}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px',
            background:'rgba(62,184,160,.1)', border:'1px solid var(--teal)',
            borderRadius:20, color:'var(--teal2)', fontSize:8, letterSpacing:1.5,
            fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
          <span>{isPlaying ? '⏸' : '▶'}</span>
          <span>{isPlaying ? 'PAUSE' : 'ÉCOUTER LA RÉCITATION'}</span>
        </button>
      )}

      {!revealed ? (
        <>
          <div style={{ fontSize:9, letterSpacing:1.5, color:'#c878ff', fontFamily:"'Cinzel',serif" }}>
            PARTIE {q.partIdx + 1} · {partWords.length} MOTS
          </div>
          <div style={{ fontSize:9, color:'var(--text3)', textAlign:'center', lineHeight:1.6 }}>
            Réciter cette partie de mémoire, puis révéler pour vérifier
          </div>
          <button onClick={() => setRevealed(true)}
            style={{ padding:'9px 32px', background:'rgba(200,120,255,.15)',
              border:'1px solid #c878ff', borderRadius:8, color:'#c878ff',
              fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
            RÉVÉLER
          </button>
        </>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12, alignItems:'center', width:'100%' }}>
          <div style={{ direction:'rtl', fontFamily:"'Amiri Quran',serif", fontSize:22,
            textAlign:'center', lineHeight:2, color:'var(--text1)',
            background:'rgba(200,120,255,.06)', borderRadius:8, padding:'12px 16px', width:'100%',
            border:'1px solid rgba(200,120,255,.25)' }}>
            {q.partText}
          </div>
          <div style={{ display:'flex', gap:10, width:'100%', maxWidth:320 }}>
            <button onClick={() => onAnswer(false)}
              style={{ flex:1, padding:'9px 16px', background:'rgba(229,115,115,.12)',
                border:'1px solid var(--red)', borderRadius:8, color:'var(--red)',
                fontSize:10, letterSpacing:1.5, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
              ✗ À REVOIR
            </button>
            <button onClick={() => onAnswer(true)}
              style={{ flex:1, padding:'9px 16px', background:'rgba(76,175,129,.15)',
                border:'1px solid var(--green)', borderRadius:8, color:'var(--green)',
                fontSize:10, letterSpacing:1.5, fontFamily:"'Cinzel',serif", cursor:'pointer' }}>
              ✓ SU / MAÎTRISÉ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PageStructureQuestion ────────────────────────────────────────────────────
