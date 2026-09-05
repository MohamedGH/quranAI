import { RecitationChecker } from "../modes/RecitationChecker.jsx";
import React, { useState, useMemo } from "react";
import { PartAudioPlayer } from "./PartAudioPlayer.jsx";
import { getPartTranslation } from "../../utils/translationUtils.js";

export function PartItem({ part, pi, allParts, words, timestamps, audioUrl, update, translationLang, ayatTranslation, wbwWords, onOpenDebug }) {
  const [learningStep, setLearningStep] = useState(0); // 0=idle 1=écoute(audio+texte) 2=mémo(audio sans texte) 3=récit
  const [isEditingTranslation, setIsEditingTranslation] = useState(false);
  const [editTransText, setEditTransText] = useState("");

  const fakeAyat = useMemo(() => ({ text: part.text, numberInSurah: part.id }), [part.text, part.id]);

  const STEPS = [
    { label: '① ÉCOUTER',   color: '#5bc8f5', bg: 'rgba(91,200,245,.12)' },
    { label: '② MÉMORISER', color: '#ffd166', bg: 'rgba(255,209,102,.12)' },
    { label: '③ RÉCITER',   color: '#c878ff', bg: 'rgba(200,120,255,.12)' },
    { label: '↺ RESET',     color: 'var(--text3)', bg: 'transparent' },
  ];
  const btnStep = learningStep < 3 ? STEPS[learningStep] : STEPS[3];
  const advance = () => setLearningStep(s => s >= 3 ? 0 : s + 1);

  // Traduction spécifique de cette partie dans la langue sélectionnée (fr, de, es, ru, en, etc.)
  const displayTranslation = useMemo(() => {
    return getPartTranslation({
      part,
      allParts,
      totalWords: words?.length || (part.text ? part.text.split(" ").filter(Boolean).length : 0),
      ayatTranslation,
      translationLang,
      wbwWords,
      words,
    });
  }, [part, allParts, words, ayatTranslation, translationLang, wbwWords]);

  const saveEditedTranslation = () => {
    const text = editTransText.trim();
    const langKey = translationLang || 'custom';
    update(d => ({
      ...d,
      parts: d.parts.map(p => {
        if (p.id !== part.id) return p;
        return {
          ...p,
          customTranslations: { ...(p.customTranslations || {}), [langKey]: text },
          manualTranslations: { ...(p.manualTranslations || {}), [langKey]: text },
          translations: { ...(p.translations || {}), [langKey]: text },
          translation: text,
        };
      })
    }));
    setIsEditingTranslation(false);
  };

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

      {/* Traduction spécifique de la partie quand activée */}
      {(translationLang || displayTranslation) && (
        <div className="part-translation" style={{
          margin: '0 12px 8px',
          padding: '6px 10px',
          borderRadius: 6,
          background: 'rgba(91,200,245,.06)',
          border: '1px solid rgba(91,200,245,.2)',
          fontSize: 10.5,
          color: 'rgba(91,200,245,.9)',
          fontStyle: 'italic',
          lineHeight: 1.55,
          direction: translationLang === 'ur' ? 'rtl' : 'ltr',
        }}>
          {isEditingTranslation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontStyle: 'normal' }}>
              <input
                type="text"
                value={editTransText}
                onChange={e => setEditTransText(e.target.value)}
                placeholder="Traduction de cette partie..."
                autoFocus
                style={{
                  width: '100%',
                  background: 'var(--surface2)',
                  border: '1px solid #5bc8f5',
                  borderRadius: 4,
                  padding: '4px 8px',
                  color: '#fff',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsEditingTranslation(false)}
                  style={{
                    fontSize: 8, padding: '2px 8px', borderRadius: 4,
                    background: 'transparent', border: '1px solid var(--border2)',
                    color: 'var(--text3)', cursor: 'pointer', fontFamily: "'Cinzel',serif"
                  }}>
                  ANNULER
                </button>
                <button
                  onClick={saveEditedTranslation}
                  style={{
                    fontSize: 8, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(91,200,245,.2)', border: '1px solid #5bc8f5',
                    color: '#5bc8f5', cursor: 'pointer', fontFamily: "'Cinzel',serif"
                  }}>
                  ENREGISTRER
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <div>
                <span style={{
                  fontSize: 8,
                  fontFamily: "'Cinzel',serif",
                  letterSpacing: 1,
                  color: '#5bc8f5',
                  display: 'inline-block',
                  marginRight: 6,
                  fontStyle: 'normal',
                  fontWeight: 700,
                }}>
                  🌐 PARTIE {pi + 1} {translationLang ? `(${translationLang.toUpperCase()})` : ''} :
                </span>
                {displayTranslation || <span style={{ opacity: 0.6 }}>(Traduction non disponible)</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                {onOpenDebug && (
                  <button
                    onClick={onOpenDebug}
                    title="Inspecter le calcul de découpage de la traduction (Debug UI)"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(91,200,245,.8)',
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: '1px 3px',
                      borderRadius: 3,
                    }}
                  >
                    🔬
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditTransText(displayTranslation || "");
                    setIsEditingTranslation(true);
                  }}
                  title="Modifier la traduction de cette partie"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(91,200,245,.7)',
                    cursor: 'pointer',
                    fontSize: 10,
                    padding: '1px 4px',
                    borderRadius: 3,
                  }}
                >
                  ✎
                </button>
              </div>
            </div>
          )}
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
