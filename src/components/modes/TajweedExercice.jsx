import { isQalqala, getMaddType, isIzhar, isIdgham, TAJWEED_RULES } from "../../utils/tajweedRules.js";
import React, { useState, useMemo } from "react";

export function TajweedExercice({ ayat }) {
  const [mode,       setMode]       = React.useState('detect');  // 'detect' | 'match'
  const [selected,   setSelected]   = React.useState(null);      // { type:'rule'|'char', id }
  const [answered,   setAnswered]   = React.useState({});        // { 'charIdx:ruleId': true|false }
  const [score,      setScore]      = React.useState(null);

  // ── Scan the ayat text and collect all tajweed occurrences ─────────────────
  const findings = React.useMemo(() => {
    const text = ayat.text || '';
    const arr  = [...text];
    const results = []; // { idx, char, ruleId, wordIdx }
    let wordIdx = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === ' ') { wordIdx++; continue; }
      if (isQalqala(arr, i))          results.push({ idx:i, char:arr[i], ruleId:'qalqala', wordIdx });
      if (getMaddType(arr, i))         results.push({ idx:i, char:arr[i], ruleId:'madd',    wordIdx });
      if (isIzhar(arr, i))             results.push({ idx:i, char:arr[i], ruleId:'izhar',   wordIdx });
      if (isIdgham(arr, i))            results.push({ idx:i, char:arr[i], ruleId:'idgham',  wordIdx });
    }
    return results;
  }, [ayat.text]);

  const foundRules = React.useMemo(() =>
    [...new Set(findings.map(f => f.ruleId))].map(id => TAJWEED_RULES.find(r => r.id === id)),
  [findings]);

  // ── Build shuffled exercise pairs ─────────────────────────────────────────
  const exercisePairs = React.useMemo(() => {
    if (findings.length === 0) return [];
    // Dedupe: one entry per (char, ruleId)
    const seen = new Set();
    const pairs = [];
    for (const f of findings) {
      const key = `${f.char}:${f.ruleId}`;
      if (!seen.has(key)) { seen.add(key); pairs.push(f); }
    }
    return pairs;
  }, [findings]);

  const shuffledChars = React.useMemo(() => [...exercisePairs].sort(() => Math.random() - .5), [exercisePairs]);
  const shuffledRules = React.useMemo(() => [...foundRules].sort(() => Math.random() - .5), [foundRules]);

  const handleSelect = (type, id) => {
    if (mode !== 'match') return;
    if (!selected) { setSelected({ type, id }); return; }
    if (selected.type === type) { setSelected({ type, id }); return; }
    // Check match
    const ruleId = type === 'rule' ? id : selected.id;
    const charId = type === 'char' ? id : selected.id;
    const correct = exercisePairs.some(p => `${p.char}:${p.idx}` === charId && p.ruleId === ruleId);
    setAnswered(prev => ({ ...prev, [`${charId}::${ruleId}`]: correct }));
    setSelected(null);
  };

  const totalPairs   = exercisePairs.length;
  const answeredCount = Object.keys(answered).length;
  const correctCount  = Object.values(answered).filter(Boolean).length;

  const isCharAnswered = (charId) => Object.keys(answered).some(k => k.startsWith(charId + '::'));
  const isRuleAnswered = (ruleId) => exercisePairs.filter(p => p.ruleId === ruleId)
    .every(p => Object.keys(answered).some(k => k.startsWith(`${p.char}:${p.idx}::${ruleId}`)));

  const ruleColor = (id) => TAJWEED_RULES.find(r => r.id === id)?.color || '#fff';

  // ── Detect mode: show annotated text ──────────────────────────────────────
  const renderAnnotated = () => {
    const text = ayat.text || '';
    const arr  = [...text];
    const words = text.split(' ');
    return (
      <div style={{ direction:'rtl', lineHeight:2.2, fontSize:22, fontFamily:'Scheherazade New, serif',
        padding:'12px 0', letterSpacing:1 }}>
        {words.map((word, wi) => {
          const wArr = [...word];
          return (
            <span key={wi} style={{ display:'inline', marginLeft:8 }}>
              {wArr.map((ch, ci) => {
                const absIdx = [...text.slice(0, text.split(' ').slice(0, wi).join(' ').length + (wi > 0 ? 1 : 0))].length + ci;
                const rule = findings.find(f => f.idx === absIdx);
                const color = rule ? ruleColor(rule.ruleId) : undefined;
                return <span key={ci} style={{
                  color, textShadow: color ? `0 0 8px ${color}66` : undefined,
                  borderBottom: color ? `2px solid ${color}` : undefined,
                }}>{ch}</span>;
              })}
            </span>
          );
        })}
      </div>
    );
  };

  if (findings.length === 0) return (
    <div style={{ padding:16, textAlign:'center', color:'var(--text3)', fontSize:9, letterSpacing:1.5 }}>
      Aucune règle tajweed détectée dans cet ayat.
    </div>
  );

  return (
    <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:14 }}>
      {/* Mode tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)' }}>
        {[['detect','🔍 DÉTECTER'],['match','🎯 EXERCICE']].map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setSelected(null); setAnswered({}); setScore(null); }}
            style={{ padding:'8px 16px', fontSize:8, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:'none', border:'none', cursor:'pointer',
              borderBottom: mode===m ? '2px solid var(--gold)' : '2px solid transparent',
              color: mode===m ? 'var(--gold)' : 'var(--text3)',
            }}>{label}</button>
        ))}
      </div>

      {mode === 'detect' ? (
        <>
          {renderAnnotated()}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {foundRules.map(rule => {
              const chars = [...new Set(findings.filter(f => f.ruleId === rule.id).map(f => f.char))];
              return (
                <div key={rule.id} style={{ display:'flex', alignItems:'flex-start', gap:10,
                  padding:'8px 12px', borderRadius:8, border:`1px solid ${rule.color}33`,
                  background:`${rule.color}11` }}>
                  <div style={{ minWidth:6, marginTop:4, width:6, height:6, borderRadius:'50%',
                    background:rule.color, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:2 }}>
                      <span style={{ fontSize:9, letterSpacing:1.5, color:rule.color, fontFamily:"'Cinzel',serif" }}>{rule.label}</span>
                      <span style={{ fontSize:14, color:rule.color, fontFamily:'Scheherazade New, serif' }}>{rule.labelAr}</span>
                    </div>
                    <div style={{ fontSize:8, color:'var(--text3)', marginBottom:4 }}>{rule.desc}</div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {chars.map(ch => (
                        <span key={ch} style={{ fontSize:18, color:rule.color, fontFamily:'Scheherazade New, serif',
                          padding:'2px 8px', borderRadius:6, border:`1px solid ${rule.color}55`,
                          background:`${rule.color}18` }}>{ch}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize:8, color:'var(--text3)', letterSpacing:.5 }}>
            Associez chaque lettre à sa règle tajweed · {correctCount}/{totalPairs} correct{correctCount > 1 ? 's' : ''}
          </div>

          {/* Letters */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)' }}>LETTRES</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, direction:'rtl' }}>
              {shuffledChars.map(p => {
                const charId = `${p.char}:${p.idx}`;
                const isSelected = selected?.type === 'char' && selected.id === charId;
                const ans = Object.entries(answered).find(([k]) => k.startsWith(charId + '::'));
                const color = ans ? (ans[1] ? '#4caf81' : '#e05a5a') : ruleColor(p.ruleId);
                return (
                  <button key={charId} onClick={() => handleSelect('char', charId)}
                    style={{ fontSize:22, fontFamily:'Scheherazade New, serif',
                      padding:'6px 14px', borderRadius:8, cursor: ans ? 'default' : 'pointer',
                      border:`2px solid ${isSelected ? 'var(--gold)' : ans ? color : 'var(--border2)'}`,
                      background: isSelected ? 'rgba(201,168,76,.12)' : ans ? `${color}22` : 'var(--surface2)',
                      color: ans ? color : 'var(--text)',
                      transition:'all .15s',
                    }}>{p.char}</button>
                );
              })}
            </div>
          </div>

          {/* Rules */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)' }}>RÈGLES</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {shuffledRules.map(rule => {
                const isSelected = selected?.type === 'rule' && selected.id === rule.id;
                const done = isRuleAnswered(rule.id);
                return (
                  <button key={rule.id} onClick={() => handleSelect('rule', rule.id)}
                    style={{ fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                      padding:'8px 16px', borderRadius:8, cursor: done ? 'default' : 'pointer',
                      border:`2px solid ${isSelected ? 'var(--gold)' : done ? rule.color : 'var(--border2)'}`,
                      background: isSelected ? 'rgba(201,168,76,.12)' : done ? `${rule.color}22` : 'var(--surface2)',
                      color: done ? rule.color : isSelected ? 'var(--gold)' : 'var(--text2)',
                      transition:'all .15s', display:'flex', alignItems:'center', gap:6,
                    }}>
                    <span style={{ fontSize:14, fontFamily:'Scheherazade New, serif' }}>{rule.labelAr}</span>
                    {rule.label}
                  </button>
                );
              })}
            </div>
          </div>

          {answeredCount === totalPairs && (
            <div style={{ padding:'10px 14px', borderRadius:8, textAlign:'center',
              background: correctCount === totalPairs ? 'rgba(76,175,129,.1)' : 'rgba(224,90,90,.08)',
              border:`1px solid ${correctCount === totalPairs ? 'var(--green)' : 'var(--red)'}` }}>
              <div style={{ fontSize:12, color: correctCount === totalPairs ? 'var(--green)' : 'var(--red)' }}>
                {correctCount === totalPairs ? '✓ Parfait !' : `${correctCount}/${totalPairs}`}
              </div>
              <button onClick={() => { setAnswered({}); setSelected(null); }}
                style={{ marginTop:6, fontSize:8, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                  padding:'5px 14px', borderRadius:6, background:'none', cursor:'pointer',
                  border:'1px solid var(--border2)', color:'var(--text3)' }}>↺ RECOMMENCER</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
