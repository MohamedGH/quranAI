import { RecitationChecker } from "../modes/RecitationChecker.jsx";
import React, { useState, useMemo } from "react";
import { PartAudioPlayer } from "./PartAudioPlayer.jsx";

export function PartItem({ part, pi, words, timestamps, audioUrl, update }) {
  const [learningStep, setLearningStep] = useState(0); // 0=idle 1=écoute(audio+texte) 2=mémo(audio sans texte) 3=récit
  const fakeAyat = useMemo(() => ({ text: part.text, numberInSurah: part.id }), [part.text, part.id]);

  const STEPS = [
    { label: '① ÉCOUTER',   color: '#5bc8f5', bg: 'rgba(91,200,245,.12)' },
    { label: '② MÉMORISER', color: '#ffd166', bg: 'rgba(255,209,102,.12)' },
    { label: '③ RÉCITER',   color: '#c878ff', bg: 'rgba(200,120,255,.12)' },
    { label: '↺ RESET',     color: 'var(--text3)', bg: 'transparent' },
  ];
  const btnStep = learningStep < 3 ? STEPS[learningStep] : STEPS[3];
  const advance = () => setLearningStep(s => s >= 3 ? 0 : s + 1);

  return (
    <div className={`part-item${part.learned ? " part-learned" : ""}`}>
      <div className="part-header">
        <div className="part-label">PARTIE {pi + 1} · {part.wordIndices?.length} MOTS</div>
        <button onClick={advance} style={{
          fontSize:8, letterSpacing:1, padding:'3px 10px', borderRadius:6, cursor:'pointer',
          fontFamily:"'Cinzel',serif", transition:'all .2s',
          background: btnStep.bg, border:`1px solid ${btnStep.color}`, color: btnStep.color,
        }}>{btnStep.label}</button>
        <button className={`btn-small${part.learned ? " done" : ""}`}
          onClick={() => update(d => ({ ...d, parts: d.parts.map(p => p.id === part.id ? { ...p, learned: !p.learned } : p) }))}>
          {part.learned ? "✓" : "APPRIS"}
        </button>
        <button className="btn-small" style={{ color:"var(--red)", borderColor:"var(--red)" }}
          onClick={() => update(d => ({ ...d, parts: d.parts.filter(p => p.id !== part.id) }))}>✕</button>
      </div>

      {/* Progress bar steps 1-3 */}
      {learningStep > 0 && (
        <div style={{ display:'flex', gap:4, padding:'4px 12px 0' }}>
          {STEPS.slice(0,3).map((s,i) => (
            <div key={i} style={{ flex:1, height:3, borderRadius:2, transition:'background .3s',
              background: i < learningStep ? s.color : 'rgba(255,255,255,.08)' }} />
          ))}
        </div>
      )}

      {/* Audio player — always shown except step 3 */}
      {learningStep < 3 && (
        <div style={{ padding: learningStep === 0 ? "0 12px 10px" : "6px 12px 6px" }}>
          <PartAudioPlayer
            key={`step-${learningStep}`}
            part={part} words={words} timestamps={timestamps} audioUrl={audioUrl}
            autoPlay={learningStep > 0}
            hideText={learningStep === 2}
          />
        </div>
      )}

      {/* Step 2: masked hint */}
      {learningStep === 2 && (
        <div style={{ margin:'0 12px 8px', padding:'8px', borderRadius:6,
          background:'rgba(255,209,102,.04)', border:'1px dashed rgba(255,209,102,.2)',
          textAlign:'center', fontSize:8, letterSpacing:2, color:'rgba(255,209,102,.35)',
          fontFamily:"'Cinzel',serif" }}>
          TEXTE MASQUÉ — RÉCITEZ DE MÉMOIRE
        </div>
      )}

      {/* Step 3: recitation checker */}
      {learningStep === 3 && (
        <div style={{ padding:"4px 12px 12px" }}>
          <RecitationChecker ayat={fakeAyat} attempts={part.recitAttempts||[]} saveScore={s => update(d => ({
            ...d, parts: d.parts.map(p => {
              if (p.id !== part.id) return p;
              const prev    = p.recitAttempts || [];
              const merged  = [...prev, s];
              const bestIdx = merged.reduce((bi, a, i) => a.score > merged[bi].score ? i : bi, 0);
              const kept    = [...new Set([0, bestIdx, merged.length-1])].sort((a,b)=>a-b).map(i => merged[i]);
              return { ...p, recitAttempts: kept, ...(s.score === 100 ? { learned: true } : {}) };
            })
          }))} />
        </div>
      )}
    </div>
  );
}
