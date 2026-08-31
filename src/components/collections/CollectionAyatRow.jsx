import { Submenu } from "../modes/Submenu.jsx";
import { SURAH_INFO } from "../../utils/arabicUtils.js";
import React, { useState, useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";
import { isQalqala, getMaddType, isIzhar, isIdgham } from "../../utils/tajweedRules.js";
import { getAudioBase } from "../../utils/reciterAudio.js";

export function CollectionAyatRow({ entry, collId, learnData, setLData, onToggleAyat, onOpenCollModal, ayatInCollectionsFn, collections, showQalqala, showMadd, showIzhar, showIdgham }) {
  const [isOpen, setIsOpen]           = useState(false);
  const showParts = useSelector(sel.showParts);
  const [submenuMode, setSubmenuMode] = useState("lecture");
  const [partSelectStep, setPartSelectStep]   = useState(null);
  const [partSelectStart, setPartSelectStart] = useState(null);
  const [isSelecting, setIsSelecting]         = useState(false);
  const [localPlaying, setLocalPlaying]       = useState(null);
  const [playingPart, setPlayingPart]         = useState(null);
  const [partCurrentMs, setPartCurrentMs]     = useState(0);
  const audioRef    = useRef(null);
  const partAudioRef= useRef(null);
  const partRafRef  = useRef(null);

  const audioUrl = `${getAudioBase()}/${entry.number}.mp3`;
  const ld = learnData[`${entry.surahNum}:${entry.ayatNum}`] || { learned: false, readCount: 0, parts: [], wordsLearned: {} };

  const stopPartRaf = () => { if (partRafRef.current) { cancelAnimationFrame(partRafRef.current); partRafRef.current = null; } };
  const startPartRaf = () => {
    stopPartRaf();
    const tick = () => {
      if (partAudioRef.current) setPartCurrentMs(partAudioRef.current.currentTime * 1000);
      partRafRef.current = requestAnimationFrame(tick);
    };
    partRafRef.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => stopPartRaf(), []);

  const PART_COLORS  = ["rgba(201,168,76,.22)","rgba(62,184,160,.18)","rgba(111,207,154,.18)","rgba(224,90,90,.15)","rgba(200,120,255,.15)"];
  const PART_BORDERS = ["var(--gold)","var(--teal)","var(--green)","var(--red)","#c878ff"];
  const wordPartMap  = {};
  (ld.parts || []).forEach((p, pi) => p.wordIndices?.forEach(wi => { wordPartMap[wi] = pi; }));
  const wordsInParts = new Set(Object.keys(wordPartMap).map(Number));
  const nextAvail    = wordsInParts.size > 0 ? Math.max(...wordsInParts) + 1 : 0;
  const ayatWords    = entry.text ? entry.text.split(" ").filter(Boolean) : [];

  const playPartInline = (part) => {
    const url = audioUrl;
    if (!url || !part.wordIndices?.length) return;
    const audio = partAudioRef.current;
    if (!audio) return;
    if (playingPart?.partId === part.id) {
      audio.pause(); setPlayingPart(null); setPartCurrentMs(0); stopPartRaf(); return;
    }
    audio.src = url;
    const startMs = 0; const endMs = 999999; // no timestamps in collection view
    audio.currentTime = 0;
    audio.play().catch(() => {});
    setPlayingPart({ partId: part.id });
    startPartRaf();
  };

  const handleInlineWordClick = (e, wi) => {
    e.stopPropagation();
    if (!isSelecting) return;
    if (partSelectStep === 'start') {
      if (wi < nextAvail) return;
      setPartSelectStart(wi);
      setPartSelectStep('end');
    } else if (partSelectStep === 'end') {
      if (partSelectStart === null) return;
      const from = Math.min(partSelectStart, wi);
      const to   = Math.max(partSelectStart, wi);
      const clampedFrom = Math.max(from, nextAvail);
      const indices = []; for (let i = clampedFrom; i <= to; i++) indices.push(i);
      if (indices.length === 0) return;
      setLData(entry.surahNum, entry.ayatNum, d => ({
        ...d, parts: [...(d.parts || []), { id: Date.now(), wordIndices: indices, text: indices.map(i => ayatWords[i]).join(" "), learned: !!d.learned }]
      }));
      const newNext = to + 1;
      if (newNext < ayatWords.length) { setPartSelectStart(null); setPartSelectStep('start'); }
      else { setIsSelecting(false); setPartSelectStep(null); setPartSelectStart(null); }
    }
  };

  const renderAyatText = () => {
    const showWordButtons = isSelecting;
    const showPartColors  = !isSelecting && showParts && Object.keys(wordPartMap).length > 0;

    if (showWordButtons) {
      return (
        <div className="ayat-arabic" style={{ cursor: "default" }}>
          {ayatWords.map((w, wi) => {
            const inExistingPart = wordsInParts.has(wi);
            const pi = wordPartMap[wi];
            const isLearned = pi !== undefined && (ld.parts || [])[pi]?.learned;
            const isPast    = wi < nextAvail;
            const isStart   = partSelectStep === 'end' && wi === partSelectStart;
            let bg = "transparent", border = "var(--border)", color = "var(--text2)", cursor = "pointer";
            if (isPast || inExistingPart) {
              bg = isLearned ? "rgba(76,175,129,.15)" : PART_COLORS[pi % PART_COLORS.length] ?? "rgba(62,184,160,.1)";
              border = isLearned ? "var(--green)" : PART_BORDERS[pi % PART_BORDERS.length] ?? "var(--teal)";
              color = "var(--text2)"; cursor = "default";
            } else if (isStart) {
              bg = "rgba(201,168,76,.25)"; border = "var(--gold2)"; color = "var(--gold2)";
            } else if (partSelectStep === 'start') {
              bg = "rgba(201,168,76,.04)"; border = "rgba(201,168,76,.5)"; color = "var(--gold)";
            } else {
              bg = "rgba(62,184,160,.05)"; border = "rgba(62,184,160,.5)"; color = "var(--teal2)";
            }
            return (
              <span key={wi} onClick={e => handleInlineWordClick(e, wi)} style={{
                display:"inline-block",margin:"2px 3px",padding:"2px 5px",borderRadius:5,
                border:`1px solid ${border}`,background:bg,color,cursor,transition:"all .12s",
                fontFamily:"'Amiri Quran',serif",
              }}>{w}</span>
            );
          })}
        </div>
      );
    }
    if (showPartColors) {
      const segments = [];
      let cur = null;
      ayatWords.forEach((w, wi) => {
        const pi = wordPartMap[wi];
        if (cur && cur.pi === pi) { cur.words.push(w); cur.indices.push(wi); }
        else { cur = { pi, words: [w], indices: [wi] }; segments.push(cur); }
      });
      return (
        <div className="ayat-arabic">
          {segments.map((seg, si) => {
            if (seg.pi === undefined) return <span key={si}>{seg.words.join(" ")} </span>;
            const part = (ld.parts || [])[seg.pi];
            const isLearned = part?.learned;
            const isThisPartPlaying = playingPart?.partId === part?.id;
            return (
              <span key={si}
                onClick={e => { e.stopPropagation(); if (part) playPartInline(part); }}
                style={{
                  display:"inline-block",background:isThisPartPlaying?"rgba(62,184,160,.28)":isLearned?"rgba(76,175,129,.18)":PART_COLORS[seg.pi % PART_COLORS.length],
                  borderRadius:5,padding:"1px 6px",margin:"2px 2px",
                  outline:`1px solid ${isThisPartPlaying?"var(--teal2)":isLearned?"var(--green)":PART_BORDERS[seg.pi % PART_BORDERS.length]}`,
                  cursor:"pointer",transition:"all .15s",
                }}>{seg.words.join(" ")}</span>
            );
          })}
        </div>
      );
    }
    return (
      <div className="ayat-arabic">
        {(showQalqala || showMadd)
          ? (() => { const arr = [...entry.text]; return arr.map((ch, i) => {
              const q = showQalqala && isQalqala(arr, i);
              const mt = showMadd ? getMaddType(arr, i) : null;
              const iz = showIzhar && isIzhar(arr, i);
              const id = showIdgham && isIdgham(arr, i);
              return q ? <span key={i} style={{color:'#5bc8f5',textShadow:'0 0 6px rgba(91,200,245,.5)'}}>{ch}</span>
                   : mt==='muttasil' ? <span key={i} style={{color:'#ff7eb3',textShadow:'0 0 8px rgba(255,126,179,.6)',fontWeight:600}}>{ch}</span>
                   : mt==='normal'   ? <span key={i} style={{color:'#f09de0',textShadow:'0 0 6px rgba(240,157,224,.5)'}}>{ch}</span>
                   : iz              ? <span key={i} style={{color:'#4caf81',textShadow:'0 0 6px rgba(76,175,129,.5)'}}>{ch}</span>
                   : id              ? <span key={i} style={{color:'#ffd166',textShadow:'0 0 6px rgba(255,209,102,.5)'}}>{ch}</span>
                   : <span key={i}>{ch}</span>;
            }); })()
          : entry.text}
      </div>
    );
  };

  const inCollIds = ayatInCollectionsFn ? ayatInCollectionsFn(entry.surahNum, entry.ayatNum) : [];
  const surahInfo = SURAH_INFO.find(s => s.n === entry.surahNum);

  return (
    <div
      className={`ayat-row${ld.learned ? " learned" : ""}${isSelecting ? " selecting" : ""}`}
      style={isSelecting ? { borderLeft: "2px solid var(--gold)", background: "rgba(201,168,76,0.04)" } : {}}
    >
      <audio ref={partAudioRef} style={{ display: "none" }}
        onEnded={() => { setTimeout(() => { setPlayingPart(null); setPartCurrentMs(0); stopPartRaf(); }, 250); }} />

      {/* Selection hint */}
      {isSelecting && (
        <div style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 22px 2px",background:"rgba(201,168,76,.05)" }}>
          <span style={{ fontSize:9,letterSpacing:1.5,color:partSelectStep==='start'?"var(--gold2)":"var(--teal2)",fontFamily:"'Cinzel',serif" }}>
            {partSelectStep==='start' ? "① CLIQUEZ LE PREMIER MOT" : `② CLIQUEZ LE DERNIER MOT — début : `}
            {partSelectStep==='end' && partSelectStart !== null && (
              <span style={{ fontFamily:"'Amiri Quran',serif",fontSize:15,color:"var(--gold2)",marginRight:4 }}>{ayatWords[partSelectStart]}</span>
            )}
          </span>
          <button onClick={e => { e.stopPropagation(); setIsSelecting(false); setPartSelectStep(null); setPartSelectStart(null); }}
            style={{ marginLeft:"auto",fontSize:9,letterSpacing:1,padding:"3px 8px",border:"1px solid var(--border2)",background:"transparent",color:"var(--text3)",cursor:"pointer",borderRadius:4,fontFamily:"'Cinzel',serif" }}>
            ANNULER
          </button>
        </div>
      )}

      <div className={`ayat-main${ld.learned ? "" : ""}`}
        onClick={() => { if (isSelecting) return; setIsOpen(o => !o); if (!isOpen) setSubmenuMode("lecture"); }}>
        {/* Left: surah badge + ayat number */}
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0 }}>
          <div style={{ fontSize:7,letterSpacing:.5,color:"var(--text3)",textAlign:"center",maxWidth:36,lineHeight:1.2 }}>
            {surahInfo?.en?.slice(0,6) || `S${entry.surahNum}`}
          </div>
          <div className="ayat-number-badge">{entry.ayatNum}</div>
        </div>
        {renderAyatText()}
        <div style={{ display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end",flexShrink:0 }}>
          {ld.learned && <div className="ayat-learned-badge">✓ APPRIS</div>}
        </div>
      </div>

      {isOpen && (
        <Submenu
          ayat={{ numberInSurah: entry.ayatNum, text: entry.text, number: entry.number }}
          surahNum={entry.surahNum}
          ld={ld}
          setLData={setLData}
          submenuMode={submenuMode}
          setSubmenuMode={setSubmenuMode}
          audioUrl={audioUrl}
          isMainPlaying={false}
          timestamps={null}
          onLoadTimestamps={() => {}}
          onUpdateTimestamps={() => {}}
          onLocalPlay={(ms) => setLocalPlaying(ms != null ? { currentMs: ms } : null)}
          partSelectAyat={isSelecting ? entry.ayatNum : null}
          partSelectStep={partSelectStep}
          onStartPartCreate={() => { setIsSelecting(true); setPartSelectStep('start'); setPartSelectStart(null); }}
          collections={collections}
          ayatInCollections={inCollIds}
          onOpenCollModal={() => onOpenCollModal({ surahNum: entry.surahNum, surahEn: surahInfo?.en || `Sourate ${entry.surahNum}`, ayatNum: entry.ayatNum, text: entry.text, number: entry.number })}
        />
      )}
    </div>
  );
}
