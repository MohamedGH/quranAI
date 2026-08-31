import React, { useState, useRef, useEffect, useMemo } from "react";
import { CreatePartFromAudio } from "../audio/CreatePartFromAudio.jsx";
import { PartItem } from "../audio/PartItem.jsx";
import { RecitationChecker } from "./RecitationChecker.jsx";
import { arabicRoot } from "../../utils/arabicUtils.js";

export function ApprentissageMode({ ayat, surahNum, ld, setLData, timestamps, audioUrl, isSelectingThisAyat, partSelectStep, onStartPartCreate, clickMode, setClickMode }) {
  const words  = ayat.text ? ayat.text.split(" ").filter(Boolean) : [];
  const update = fn => setLData(surahNum, ayat.numberInSurah, fn);
  const allWordsLearned = words.length > 0 && words.every((_, i) => ld.wordsLearned?.[i]);
  const allPartsLearned = ld.parts?.length > 0 && ld.parts.every(p => p.learned);
  useEffect(() => { if ((allWordsLearned || allPartsLearned) && !ld.learned) update(d => ({ ...d, learned: true })); }, [allWordsLearned, allPartsLearned]);

  const [showCreateAudio, setShowCreateAudio] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);

  const wordsInParts = useMemo(() => {
    const s = new Set();
    (ld.parts || []).forEach(p => p.wordIndices?.forEach(i => s.add(i)));
    return s;
  }, [ld.parts]);

  const nextAvailStart = wordsInParts.size > 0 ? Math.max(...[...wordsInParts]) + 1 : 0;
  const allWordsAssigned = nextAvailStart >= words.length;

  // startMs du prochain découpage = endMs du dernier mot de la dernière partie
  const lastPartEndMs = useMemo(() => {
    if (!timestamps?.words || wordsInParts.size === 0) return null;
    const maxIdx = Math.max(...[...wordsInParts]);
    const w = timestamps.words[maxIdx];
    if (!w) return null;
    return w.chars?.[w.chars.length - 1]?.end ?? null;
  }, [timestamps, wordsInParts]);

  const handleCreateFromAudio = ({ wordIndices, text }) => {
    update(d => ({ ...d, parts: [...(d.parts || []), { id: Date.now(), wordIndices, text, learned: !!d.learned }] }));
  };

  return (
    <div className="learn-section">
      <div className="learn-status-row">
        <div className={`learn-stat${ld.learned ? " learned-stat" : ""}`}>STATUT <span className="val">{ld.learned ? "✓ APPRIS" : "EN COURS"}</span></div>
        <div className="learn-stat">LECTURES <span className="val">{ld.readCount || 0}</span></div>
        <button className={`btn-primary${ld.learned ? " active" : ""}`} onClick={() => update(d => {
          const newLearned = !d.learned;
          return {
            ...d,
            learned: newLearned,
            parts: newLearned ? (d.parts || []).map(p => ({ ...p, learned: true })) : d.parts,
          };
        })}>{ld.learned ? "✓ APPRIS" : "MARQUER COMME APPRIS"}</button>
        {ld.parts?.length > 0 &&
          <button className="btn-small" onClick={() => update(d => ({ ...d, parts: [], wordsLearned: {} }))}>RÉINITIALISER</button>}
      </div>

      <div style={{ border:"1px solid var(--border)", borderRadius:8, overflow:"hidden" }}>
        {/* Collapsible header */}
        <button onClick={() => setPartsOpen(v => !v)} style={{
          width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"8px 12px", background:"var(--surface2)", border:"none", cursor:"pointer",
          fontFamily:"'Cinzel',serif"
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:9, letterSpacing:2, color:"var(--text3)" }}>PARTIES</span>
            {ld.parts?.length > 0 && (
              <span style={{ fontSize:8, padding:"2px 8px", borderRadius:10,
                background: allPartsLearned ? "rgba(76,175,129,.15)" : "rgba(201,168,76,.1)",
                color: allPartsLearned ? "var(--green)" : "var(--gold2)",
                border:"1px solid " + (allPartsLearned ? "var(--green)" : "var(--gold)") }}>
                {ld.parts.filter(p=>p.learned).length}/{ld.parts.length}
              </span>
            )}
          </div>
          <span style={{ fontSize:10, color:"var(--text3)", transition:"transform .2s",
            display:"inline-block", transform: partsOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </button>

        {partsOpen && (
          <div style={{ padding:"12px", display:"flex", flexDirection:"column", gap:8 }}>
            {/* Buttons row */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {!isSelectingThisAyat && !allWordsAssigned && (
                <button className="btn-small" onClick={onStartPartCreate}>
                  ✂ DÉCOUPER PAR MOTS
                </button>
              )}
              {audioUrl && (
                <button className="btn-small"
                  style={showCreateAudio ? { borderColor:"var(--gold)", color:"var(--gold2)" } : {}}
                  onClick={() => setShowCreateAudio(v => !v)}>
                  🎵 CRÉER VIA AUDIO
                </button>
              )}
            </div>

            {isSelectingThisAyat && (
              <div style={{ fontSize: 9, letterSpacing: 1.5, color: partSelectStep === 'start' ? "var(--gold2)" : "var(--teal2)", fontFamily: "'Cinzel',serif", padding: "4px 0" }}>
                {partSelectStep === 'start' ? "① Cliquez le premier mot sur l'ayat ↑" : "② Cliquez le dernier mot sur l'ayat ↑"}
              </div>
            )}
            {allWordsAssigned && ld.parts?.length > 0 && (
              <div style={{ fontSize: 9, color: "var(--green)", letterSpacing: 1 }}>✓ Tous les mots sont découpés</div>
            )}

            {showCreateAudio && (
              <CreatePartFromAudio
                ayat={ayat}
                timestamps={timestamps}
                audioUrl={audioUrl}
                existingWordIndices={wordsInParts}
                initialSeekMs={lastPartEndMs}
                onCreatePart={handleCreateFromAudio}
              />
            )}

            {(ld.parts || []).map((part, pi) => (
              <PartItem key={part.id} part={part} pi={pi} words={words} timestamps={timestamps} audioUrl={audioUrl} update={update} />
            ))}
            {ld.parts?.length === 0 && !isSelectingThisAyat && !showCreateAudio && (
              <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1 }}>
                Aucune partie — utilisez ✂ DÉCOUPER PAR MOTS ou 🎵 CRÉER VIA AUDIO
              </div>
            )}
          </div>
        )}
      </div>
      <RecitationChecker ayat={ayat} attempts={ld.recitAttempts||[]} saveScore={s => update(d => ({ ...d, recitAttempts: [...(d.recitAttempts||[]).slice(-49), s], ...(s.score === 100 ? { learned: true } : {}) }))} />

      {/* MOTS À SURLIGNER */}
      <div style={{display:'flex',flexDirection:'column',gap:8,padding:'12px 14px',borderTop:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:9,letterSpacing:2,color:'var(--text3)'}}>MOTS À SURLIGNER</div>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>setClickMode?.(clickMode==='highlight'?null:'highlight')} style={{
              fontSize:8,letterSpacing:1,padding:'3px 10px',fontFamily:"'Cinzel',serif",cursor:'pointer',borderRadius:6,
              background:clickMode==='highlight'?'rgba(255,209,102,.15)':'transparent',
              border:`1px solid ${clickMode==='highlight'?'var(--gold)':'var(--border2)'}`,
              color:clickMode==='highlight'?'var(--gold2)':'var(--text3)',
            }}>{clickMode==='highlight' ? '✕ DÉSACTIVER' : "✏ CLIQUER SUR L'AYAT"}</button>
            {ld?.highlight?.trim() && (
              <button onClick={()=>setLData(surahNum,ayat.numberInSurah,d=>({...d,highlight:''}))} style={{
                fontSize:8,letterSpacing:1,padding:'3px 8px',fontFamily:"'Cinzel',serif",cursor:'pointer',borderRadius:6,
                background:'transparent',border:'1px solid var(--border2)',color:'var(--text3)',
              }}>✕</button>
            )}
          </div>
        </div>
        {clickMode==='highlight' && (
          <div style={{fontSize:8,color:'var(--teal2)',letterSpacing:1,padding:'4px 8px',background:'rgba(62,184,160,.08)',borderRadius:6,border:'1px solid var(--teal)'}}>
            ↑ Cliquez sur les mots dans l'ayat ci-dessus
          </div>
        )}
        {ld?.highlight?.trim() ? (
          <div style={{direction:'rtl',fontFamily:"'Amiri Quran',serif",fontSize:18,color:'#ffd166',letterSpacing:.5,padding:'6px 10px',background:'rgba(255,209,102,.07)',borderRadius:6,border:'1px solid rgba(255,209,102,.2)'}}>
            {ld.highlight}
          </div>
        ) : (
          <div style={{fontSize:9,color:'var(--text3)',fontStyle:'italic'}}>Aucun mot sélectionné</div>
        )}
      </div>

      {/* MOTS INCONNUS */}
      <div style={{display:'flex',flexDirection:'column',gap:8,padding:'12px 14px',borderTop:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:9,letterSpacing:2,color:'var(--text3)'}}>MOTS INCONNUS</div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <button onClick={()=>setClickMode?.(clickMode==='unknown'?null:'unknown')} style={{
              fontSize:8,letterSpacing:1,padding:'3px 10px',fontFamily:"'Cinzel',serif",cursor:'pointer',borderRadius:6,
              background:clickMode==='unknown'?'rgba(255,126,179,.15)':'transparent',
              border:`1px solid ${clickMode==='unknown'?'#ff7eb3':'var(--border2)'}`,
              color:clickMode==='unknown'?'#ff7eb3':'var(--text3)',
            }}>{clickMode==='unknown' ? '✕ DÉSACTIVER' : "✏ CLIQUER SUR L'AYAT"}</button>
            {(ld?.unknownWords||[]).length > 0 && (
              <button onClick={()=>setLData(surahNum,ayat.numberInSurah,d=>({...d,unknownWords:[]}))} style={{
                fontSize:8,letterSpacing:1,padding:'3px 8px',fontFamily:"'Cinzel',serif",cursor:'pointer',borderRadius:6,
                background:'transparent',border:'1px solid var(--border2)',color:'var(--text3)',
              }}>✕</button>
            )}
          </div>
        </div>
        {clickMode==='unknown' && (
          <div style={{fontSize:8,color:'#ff7eb3',letterSpacing:1,padding:'4px 8px',background:'rgba(255,126,179,.08)',borderRadius:6,border:'1px solid rgba(255,126,179,.3)'}}>
            ↑ Cliquez sur les mots inconnus dans l'ayat ci-dessus
          </div>
        )}
        {(() => {
          const ayatWords2 = ayat.text ? ayat.text.split(' ').filter(Boolean) : [];
          const unkSet = new Set(ld?.unknownWords || []);
          if (unkSet.size === 0) return <div style={{fontSize:9,color:'var(--text3)',fontStyle:'italic'}}>Aucun mot inconnu marqué</div>;
          // Build roots of selected unknown words
          const unkNorms = new Set([...unkSet].map(i => arabicRoot(ayatWords2[i] || '')).filter(Boolean));
          // Detect all indices with the same root
          const autoSet = new Set();
          ayatWords2.forEach((w, i) => { if (!unkSet.has(i) && unkNorms.has(arabicRoot(w))) autoSet.add(i); });
          const allUnk = new Set([...unkSet, ...autoSet]);
          return (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <div style={{direction:'rtl',fontFamily:"'Amiri Quran',serif",fontSize:18,lineHeight:1.8}}>
                {ayatWords2.map((w, i) => {
                  const manual = unkSet.has(i);
                  const auto   = !manual && autoSet.has(i);
                  if (!manual && !auto) return null;
                  return (
                    <span key={i} style={{display:'inline-block',margin:'2px 4px',padding:'2px 6px',borderRadius:5,
                      background: auto ? 'rgba(255,126,179,.07)' : 'rgba(255,126,179,.15)',
                      border: `1px solid ${auto ? 'rgba(255,126,179,.25)' : 'rgba(255,126,179,.4)'}`,
                      color:'#ff7eb3', opacity: auto ? 0.7 : 1,
                      textDecoration:'underline dotted #ff7eb3',
                      position:'relative',
                    }}>
                      {w}
                      {auto && <span style={{position:'absolute',top:-6,right:2,fontSize:6,letterSpacing:.5,color:'rgba(255,126,179,.6)',fontFamily:"'Cinzel',serif"}}>AUTO</span>}
                    </span>
                  );
                })}
              </div>
              {autoSet.size > 0 && (
                <div style={{fontSize:8,color:'rgba(255,126,179,.6)',letterSpacing:1,fontFamily:"'Cinzel',serif"}}>
                  +{autoSet.size} AUTRE{autoSet.size>1?'S':''} OCCURRENCE{autoSet.size>1?'S':''} DÉTECTÉE{autoSet.size>1?'S':''}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
