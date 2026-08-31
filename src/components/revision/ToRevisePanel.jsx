import React, { useState, useEffect } from "react";
import { useToRevise } from "../../utils/toRevise.js";
import { splitArabicWords, splitArabicChars } from "../../utils/arabicUtils.js";
import { computeMastery, MasteryBar } from "../common/Mastery.jsx";

export function ToRevisePanel({ ayat, surahNum, ld, setLData }) {
  const [expandedWord, setExpandedWord] = React.useState(null);

  const { revise, isActive, selWords, selParts, selChars, toggleAll, toggleWord: toggleWordBase, toggleChar, togglePart } =
    useToRevise(ld, surahNum, ayat.numberInSurah, setLData);

  const ayatWords = ayat.text ? ayat.text.split(' ').filter(Boolean) : [];
  const parts     = ld?.parts || [];

  const toggleWord = (i) => {
    const wasSelected = toggleWordBase(i);
    if (wasSelected && expandedWord === i) setExpandedWord(null);
  };

  const splitChars = splitArabicChars;

  const gold = 'var(--gold)'; const gold2 = 'var(--gold2)';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, padding:'14px 16px' }}>
      {/* Global toggle */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ fontSize:9, letterSpacing:2, color:'var(--text3)' }}>🔖 MARQUER À RÉVISER</div>
        <button onClick={toggleAll} style={{
          fontSize:8, letterSpacing:1.5, padding:'4px 12px', borderRadius:6, cursor:'pointer',
          fontFamily:"'Cinzel',serif", transition:'all .2s',
          background: isActive ? 'rgba(201,168,76,.15)' : 'transparent',
          border: `1px solid ${isActive ? gold : 'rgba(255,255,255,.15)'}`,
          color: isActive ? gold2 : 'var(--text3)',
        }}>{isActive ? '✓ MARQUÉ — RETIRER' : "MARQUER TOUT L'AYAT"}</button>
      </div>

      {/* Word selection + char drill-down */}
      {ayatWords.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:8, letterSpacing:1.5, color:'var(--text3)' }}>MOTS · LETTRES · HARAKAT</div>
          {/* Word buttons */}
          <div style={{ direction:'rtl', display:'flex', flexWrap:'wrap', gap:6 }}>
            {ayatWords.map((w, i) => {
              const sel     = selWords.includes(i);
              const expanded= expandedWord === i;
              const charSel = selChars[i] || [];
              return (
                <div key={i} style={{ display:'flex', alignItems:'stretch', borderRadius:6, overflow:'hidden',
                  border:`1px solid ${expanded ? '#5bc8f5' : sel ? gold : 'rgba(255,255,255,.1)'}`,
                  background: sel ? 'rgba(201,168,76,.15)' : 'rgba(255,255,255,.03)' }}>
                  <button onClick={() => toggleWord(i)} style={{
                    fontFamily:"'Amiri Quran',serif", fontSize:18, padding:'4px 10px',
                    background:'transparent', border:'none', cursor:'pointer',
                    color: sel ? gold2 : 'var(--text2)' }}>{w}</button>
                  <button onClick={() => setExpandedWord(expanded ? null : i)}
                    style={{ padding:'0 7px', cursor:'pointer', border:'none',
                      background: expanded ? 'rgba(91,200,245,.15)' : charSel.length > 0 ? 'rgba(91,200,245,.08)' : 'rgba(255,255,255,.04)',
                      borderLeft:'1px solid rgba(255,255,255,.08)',
                      color: expanded || charSel.length > 0 ? '#5bc8f5' : 'var(--text3)',
                      fontSize:8, display:'flex', alignItems:'center' }}>
                    {charSel.length > 0 ? charSel.length : ''}{expanded ? '▲' : '▾'}
                  </button>
                </div>
              );
            })}
          </div>
          {/* Inline char picker — shown below word row when a word is expanded */}
          {expandedWord !== null && (() => {
            const wi      = expandedWord;
            const w       = ayatWords[wi] || '';
            const clusters= splitChars(w);
            const charSel = selChars[wi] || [];
            return (
              <div style={{ direction:'rtl', display:'flex', flexWrap:'wrap', gap:4,
                padding:'8px 10px', background:'rgba(91,200,245,.06)',
                border:'1px solid rgba(91,200,245,.2)', borderRadius:8 }}>
                <div style={{ width:'100%', fontSize:7, letterSpacing:1.5, color:'#5bc8f5',
                  fontFamily:"'Cinzel',serif", marginBottom:4, textAlign:'right' }}>
                  LETTRES DE : {w}
                </div>
                {clusters.map((c, ci) => {
                  const cSel = charSel.includes(ci);
                  return (
                    <button key={ci} onClick={() => toggleChar(wi, ci)} style={{
                      fontFamily:"'Amiri Quran',serif", fontSize:22,
                      padding:'4px 8px', minWidth:34, borderRadius:6, cursor:'pointer',
                      background: cSel ? 'rgba(91,200,245,.2)' : 'rgba(255,255,255,.05)',
                      border:`1px solid ${cSel ? '#5bc8f5' : 'rgba(255,255,255,.12)'}`,
                      color: cSel ? '#5bc8f5' : 'var(--text1)',
                      boxShadow: cSel ? '0 0 6px rgba(91,200,245,.35)' : 'none',
                      transition:'all .12s' }}>{c}</button>
                  );
                })}
                <button onClick={() => setExpandedWord(null)}
                  style={{ marginRight:'auto', fontSize:7, padding:'4px 8px', borderRadius:5,
                    background:'transparent', border:'1px solid rgba(255,255,255,.1)',
                    color:'var(--text3)', cursor:'pointer', fontFamily:"'Cinzel',serif",
                    letterSpacing:1 }}>✕ FERMER</button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Parts selection */}
      {parts.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ fontSize:8, letterSpacing:1.5, color:'var(--text3)' }}>PARTIES SPÉCIFIQUES</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {parts.map((p, pi) => {
              const sel = selParts.includes(p.id);
              return (
                <button key={p.id} onClick={() => togglePart(p.id)} style={{
                  fontSize:8, letterSpacing:1, padding:'5px 12px', borderRadius:6,
                  cursor:'pointer', transition:'all .15s', fontFamily:"'Cinzel',serif",
                  background: sel ? 'rgba(200,120,255,.15)' : 'rgba(255,255,255,.03)',
                  border:`1px solid ${sel ? '#c878ff' : 'rgba(255,255,255,.1)'}`,
                  color: sel ? '#c878ff' : 'var(--text2)',
                }}>
                  PARTIE {pi+1}{sel && <span style={{ marginRight:4 }}> ✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      {isActive && (
        <div style={{ fontSize:8, color:'var(--text3)', letterSpacing:1, borderTop:'1px solid var(--border)', paddingTop:8 }}>
          {typeof revise === 'object'
            ? [
                selWords.length > 0 && `${selWords.length} mot${selWords.length>1?'s':''}`,
                Object.keys(selChars).length > 0 && `${Object.values(selChars).reduce((s,a)=>s+a.length,0)} lettre${Object.values(selChars).reduce((s,a)=>s+a.length,0)>1?'s':''}`,
                selParts.length > 0 && `${selParts.length} partie${selParts.length>1?'s':''}`,
              ].filter(Boolean).join(' · ') || 'Aucune sélection'
            : 'Ayat entier marqué'}
        </div>
      )}

      {/* Revise history */}
      {(ld?.reviseHistory || []).length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:6, borderTop:'1px solid var(--border)', paddingTop:10 }}>
          <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)' }}>HISTORIQUE</div>
          {[...(ld.reviseHistory)].reverse().map((entry, i) => {
            const start = entry.startDate ? new Date(entry.startDate) : null;
            const end   = entry.endDate   ? new Date(entry.endDate)   : null;
            const fmt   = (d) => d ? d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '…';
            const wLabel = entry.words === 'all' ? 'ayat entier' : Array.isArray(entry.words) && entry.words.length > 0 ? `${entry.words.length} mot${entry.words.length>1?'s':''}` : null;
            const pLabel = Array.isArray(entry.parts) && entry.parts.length > 0 ? `${entry.parts.length} partie${entry.parts.length>1?'s':''}` : null;
            const cCount = entry.chars ? Object.values(entry.chars).reduce((s,a)=>s+a.length,0) : 0;
            const cLabel = cCount > 0 ? `${cCount} lettre${cCount>1?'s':''}` : null;
            const tags = [wLabel, pLabel, cLabel].filter(Boolean);
            return (
              <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start',
                padding:'6px 8px', background:'var(--surface3)',
                borderRadius:6, border:'1px solid var(--border)',
                opacity: end ? .65 : 1 }}>
                <div style={{ fontSize:7, color: end ? 'var(--text3)' : '#ff9f43',
                  fontFamily:"'Cinzel',serif", letterSpacing:.5, flexShrink:0, lineHeight:1.6 }}>
                  {end ? '✓' : '🔖'}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:2, flex:1 }}>
                  <div style={{ fontSize:7, color:'var(--text3)', lineHeight:1.4 }}>
                    {fmt(start)} {end ? `→ ${fmt(end)}` : '→ en cours'}
                  </div>
                  {tags.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                      {tags.map(t => (
                        <span key={t} style={{ fontSize:6, letterSpacing:1, padding:'1px 5px',
                          borderRadius:4, background:'rgba(255,255,255,.05)',
                          border:'1px solid rgba(255,255,255,.1)', color:'var(--text2)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
