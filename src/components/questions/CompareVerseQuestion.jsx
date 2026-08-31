import { getAudioBase } from "../../utils/reciterAudio.js";
import React, { useState } from "react";
import { normalizeArabic } from "../../utils/recitationDiff.js";

export function CompareVerseQuestion({ q, onAnswer, globalNums }) {
  const { entries } = q;
  const [playingIdx, setPlayingIdx] = React.useState(null);
  const [progress, setProgress]     = React.useState({});  // idx → 0..1
  const audioRef = React.useRef(null);

  const playEntry = (i, sn, an) => {
    const gn = globalNums?.[`${sn}:${an}`];
    if (!gn) return;
    const url = `${getAudioBase()}/${gn}.mp3`;
    if (playingIdx === i) {
      audioRef.current?.pause();
      setPlayingIdx(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
    }
    setPlayingIdx(i);
  };

  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnd  = () => { setPlayingIdx(null); };
    const onTime = () => {
      if (el.duration) setProgress(p => ({ ...p, [playingIdx]: el.currentTime / el.duration }));
    };
    el.addEventListener('ended', onEnd);
    el.addEventListener('timeupdate', onTime);
    return () => { el.removeEventListener('ended', onEnd); el.removeEventListener('timeupdate', onTime); };
  }, [playingIdx]);

  // Shuffle display order
  const shuffled = React.useMemo(() => {
    const arr = [...entries];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [q.id]);

  // Shuffled surah names (to match)
  const shuffledNames = React.useMemo(() => {
    const arr = [...entries.map(e => ({ sn: e.sn, name: e.name }))];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [q.id]);

  const [assignments, setAssignments] = React.useState({}); // textIndex → snAssigned
  const [selected, setSelected] = React.useState(null); // { side: 'text'|'name', index }
  const [checked, setChecked] = React.useState(false);

  const assign = (side, index) => {
    if (checked) return;
    if (!selected) { setSelected({ side, index }); return; }
    if (selected.side === side) { setSelected({ side, index }); return; }
    // Cross-assign
    if (side === 'name' && selected.side === 'text') {
      setAssignments(prev => ({ ...prev, [selected.index]: shuffledNames[index].sn }));
    } else if (side === 'text' && selected.side === 'name') {
      setAssignments(prev => ({ ...prev, [index]: shuffledNames[selected.index].sn }));
    }
    setSelected(null);
  };

  const allAssigned = shuffled.every((_, i) => assignments[i] !== undefined);

  const check = () => {
    setChecked(true);
    const correct = shuffled.every((e, i) => assignments[i] === e.sn);
    onAnswer(correct);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, width:'100%' }}>
      <audio ref={audioRef} style={{ display:'none' }} />
      <div style={{ fontSize:8, color:'var(--text3)', letterSpacing:2, textAlign:'center' }}>
        ASSOCIE CHAQUE TEXTE À SA SOURATE
      </div>
      <div style={{ display:'flex', gap:8 }}>
        {/* Texts column */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
          {shuffled.map((e, i) => {
            const isSelected = selected?.side === 'text' && selected.index === i;
            const assignedSn = assignments[i];
            const assignedName = assignedSn ? shuffledNames.find(n => n.sn === assignedSn)?.name : null;
            const correct = checked && assignedSn === e.sn;
            const wrong   = checked && assignedSn !== undefined && assignedSn !== e.sn;
            const isPlaying = playingIdx === i;
            const hasAudio  = !!(globalNums?.[`${e.sn}:${q.ayatNum}`]);
            return (
              <div key={i}
                style={{ borderRadius:8, cursor:'pointer',
                  border:`1px solid ${isSelected ? 'var(--gold)' : correct ? 'var(--green)' : wrong ? 'var(--red)' : 'var(--border2)'}`,
                  background: isSelected ? 'rgba(201,168,76,.08)' : correct ? 'rgba(76,175,129,.08)' : wrong ? 'rgba(229,115,115,.08)' : 'var(--surface2)',
                  overflow:'hidden' }}>
                {/* Audio bar */}
                {hasAudio && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                    borderBottom:`1px solid var(--border)`, background:'rgba(0,0,0,.15)', cursor:'pointer' }}
                    onClick={ev => { ev.stopPropagation(); playEntry(i, e.sn, q.ayatNum); }}>
                    <span style={{ fontSize:16, color: isPlaying ? 'var(--teal2)' : 'var(--text3)', flexShrink:0 }}>
                      {isPlaying ? '⏸' : '▶'}
                    </span>
                    <div style={{ flex:1, height:3, borderRadius:2, background:'var(--surface3)', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:2, background:'var(--teal)',
                        width:`${(progress[i] ?? 0) * 100}%`,
                        transition: isPlaying ? 'width .1s linear' : 'width .2s' }} />
                    </div>
                  </div>
                )}
                <div style={{ padding:'8px 10px' }} onClick={() => assign('text', i)}>
                  <div style={{ direction:'rtl', fontFamily:"'Amiri Quran',serif", fontSize:15, lineHeight:1.7, color:'var(--text)' }}>
                    {e.text}
                  </div>
                  {assignedName && (
                    <div style={{ fontSize:7, color: correct ? 'var(--green)' : wrong ? 'var(--red)' : 'var(--gold)',
                      fontFamily:"'Cinzel',serif", letterSpacing:1, direction:'ltr', marginTop:4 }}>
                      {assignedName}{checked && !correct && ` → ${e.name}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Names column */}
        <div style={{ flex:'0 0 auto', display:'flex', flexDirection:'column', gap:6, minWidth:90 }}>
          {shuffledNames.map((nm, i) => {
            const isSelected = selected?.side === 'name' && selected.index === i;
            const used = Object.values(assignments).includes(nm.sn);
            return (
              <div key={i} onClick={() => assign('name', i)}
                style={{ padding:'8px 10px', borderRadius:8, cursor:'pointer', textAlign:'center',
                  border:`1px solid ${isSelected ? 'var(--gold)' : used ? 'var(--teal)' : 'var(--border2)'}`,
                  background: isSelected ? 'rgba(201,168,76,.1)' : used ? 'rgba(62,184,160,.08)' : 'var(--surface2)',
                  fontSize:8, letterSpacing:1, fontFamily:"'Cinzel',serif",
                  color: isSelected ? 'var(--gold2)' : used ? 'var(--teal2)' : 'var(--text3)',
                  opacity: used && !isSelected ? 0.6 : 1 }}>
                {nm.name.toUpperCase()}
              </div>
            );
          })}
        </div>
      </div>
      {!checked && allAssigned && (
        <button onClick={check}
          style={{ padding:'10px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
            background:'rgba(201,168,76,.12)', border:'1px solid var(--gold)', color:'var(--gold2)',
            borderRadius:8, cursor:'pointer' }}>
          ✓ VÉRIFIER
        </button>
      )}
      {checked && (
        <div style={{ textAlign:'center', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
          color: shuffled.every((_,i) => assignments[i] === shuffled[i].sn) ? 'var(--green)' : 'var(--red)',
          padding:'8px', borderRadius:8,
          background: shuffled.every((_,i) => assignments[i] === shuffled[i].sn) ? 'rgba(76,175,129,.08)' : 'rgba(229,115,115,.08)' }}>
          {shuffled.every((_,i) => assignments[i] === shuffled[i].sn) ? '✓ CORRECT' : '✗ INCORRECT'}
        </div>
      )}
    </div>
  );
}


// ─── FindSurahQuestion ────────────────────────────────────────────────────────
