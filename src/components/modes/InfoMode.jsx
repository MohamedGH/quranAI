import { MasteryDebug } from "../common/Mastery.jsx";
import React, { useState } from "react";
import { stripDiacritics, wordTranslit, calcDifficulty, calcPhase } from "../../utils/arabicUtils.js";

export function InfoMode({ ayat, ld, setLData, surahNum }) {
  const words = ayat.text.trim().split(/\s+/).filter(Boolean);
  const diff  = calcDifficulty(ayat.text, ld);
  const phase = calcPhase(ld);
  const vocab = words.map(w => ({ ar: w, fr: wordTranslit(w) })).filter(v => v.fr);
  const PHASES = ['NON COMMENCÉ','EN LECTURE','EN DÉCOUPAGE','PARTIES MAÎTRISÉES','MAÎTRISÉ'];

  const USER_DIFFICULTIES = ['FACILE','MOYEN','DIFFICILE','TRÈS DIFFICILE'];
  const USER_DIFF_COLORS  = ['#4caf81','#ffd166','#ff9f43','#ff6b6b'];
  const USER_PHASES = ['À COMMENCER','EN COURS','À RÉVISER','MAÎTRISÉ','EN PAUSE'];
  const USER_PHASE_COLORS = ['var(--text3)','#5bc8f5','#ffd166','#4caf81','#ff9f43'];

  const userDiff  = ld?.userDifficulty ?? null;
  const userPhase = ld?.userPhase ?? null;

  const setUserDiff  = (v) => setLData(surahNum, ayat.numberInSurah, d => ({ ...d, userDifficulty: d.userDifficulty === v ? null : v }));
  const setUserPhase = (v) => setLData(surahNum, ayat.numberInSurah, d => ({ ...d, userPhase: d.userPhase === v ? null : v }));

  return (
    <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:16 }}>
      {/* Difficulté auto */}
      <div>
        <div style={{ fontSize:9, letterSpacing:2, color:'var(--text3)', marginBottom:8 }}>DIFFICULTÉ (AUTO)</div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, height:4, background:'var(--surface3)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ width:`${diff.bar}%`, height:'100%', background:diff.color, borderRadius:2, transition:'width .4s' }} />
          </div>
          <div style={{ fontSize:9, letterSpacing:1.5, color:diff.color, minWidth:90, textAlign:'right' }}>{diff.label}</div>
        </div>
        <div style={{ display:'flex', gap:12, marginTop:8 }}>
          {[
            { label:'MOTS', val: words.length },
            { label:'LETTRES UNIQUES', val: new Set([...stripDiacritics(ayat.text)].filter(c=>c>='\u0621'&&c<='\u064A')).size },
            { label:'LECTURES', val: ld?.readCount||0 },
          ].map(({label,val}) => (
            <div key={label} style={{ flex:1, background:'var(--surface2)', borderRadius:'var(--radius-sm)', padding:'6px 10px', textAlign:'center' }}>
              <div style={{ fontSize:16, color:'var(--gold)', fontFamily:"'Cinzel',serif" }}>{val}</div>
              <div style={{ fontSize:7, letterSpacing:1.5, color:'var(--text3)', marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
        {/* User difficulty */}
        <div style={{ fontSize:9, letterSpacing:2, color:'var(--text3)', marginTop:12, marginBottom:6 }}>MON NIVEAU DE DIFFICULTÉ</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {USER_DIFFICULTIES.map((d,i) => (
            <button key={d} onClick={() => setUserDiff(d)}
              style={{ fontSize:8, letterSpacing:1, padding:'5px 11px', borderRadius:20,
                border:`1px solid ${userDiff===d ? USER_DIFF_COLORS[i] : 'var(--border2)'}`,
                background: userDiff===d ? `${USER_DIFF_COLORS[i]}22` : 'transparent',
                color: userDiff===d ? USER_DIFF_COLORS[i] : 'var(--text3)',
                cursor:'pointer', transition:'all .2s', fontFamily:"'Cinzel',serif" }}>
              {d}
            </button>
          ))}
        </div>
        {userDiff && <div style={{ fontSize:8, color:'var(--text3)', marginTop:4 }}>Sélectionné : <span style={{ color: USER_DIFF_COLORS[USER_DIFFICULTIES.indexOf(userDiff)] }}>{userDiff}</span> · Cliquer à nouveau pour retirer</div>}
      </div>

      {/* Phase auto */}
      <div>
        <div style={{ fontSize:9, letterSpacing:2, color:'var(--text3)', marginBottom:8 }}>PHASE (AUTO)</div>
        <div style={{ display:'flex', gap:4 }}>
          {PHASES.map((p, i) => (
            <div key={i} title={p} style={{ flex:1, height:6, borderRadius:3,
              background: i <= phase.step ? phase.color : 'var(--surface3)',
              opacity: i <= phase.step ? 1 : 0.3, transition:'background .3s' }} />
          ))}
        </div>
        <div style={{ fontSize:9, letterSpacing:1.5, color:phase.color, marginTop:6 }}>{phase.label}</div>
        {(ld?.parts?.length||0) > 0 && (
          <div style={{ fontSize:8, color:'var(--text3)', marginTop:4 }}>
            {ld.parts.filter(p=>p.learned).length}/{ld.parts.length} PARTIES APPRISES
          </div>
        )}
        {/* User phase */}
        <div style={{ fontSize:9, letterSpacing:2, color:'var(--text3)', marginTop:12, marginBottom:6 }}>MA PHASE D'APPRENTISSAGE</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {USER_PHASES.map((p,i) => (
            <button key={p} onClick={() => setUserPhase(p)}
              style={{ fontSize:8, letterSpacing:1, padding:'5px 11px', borderRadius:20,
                border:`1px solid ${userPhase===p ? USER_PHASE_COLORS[i] : 'var(--border2)'}`,
                background: userPhase===p ? `${USER_PHASE_COLORS[i]}22` : 'transparent',
                color: userPhase===p ? USER_PHASE_COLORS[i] : 'var(--text3)',
                cursor:'pointer', transition:'all .2s', fontFamily:"'Cinzel',serif" }}>
              {p}
            </button>
          ))}
        </div>
        {userPhase && <div style={{ fontSize:8, color:'var(--text3)', marginTop:4 }}>Sélectionné : <span style={{ color: USER_PHASE_COLORS[USER_PHASES.indexOf(userPhase)] }}>{userPhase}</span> · Cliquer à nouveau pour retirer</div>}
      </div>

      {/* Vocabulaire */}
      {vocab.length > 0 && (
        <div>
          <div style={{ fontSize:9, letterSpacing:2, color:'var(--text3)', marginBottom:8 }}>VOCABULAIRE CLÉ</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {vocab.map(({ar,fr},i) => (
              <div key={i} style={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', padding:'5px 10px', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:16, color:'var(--gold)', direction:'rtl' }}>{ar}</div>
                <div style={{ fontSize:8, letterSpacing:1, color:'var(--text3)' }}>{fr}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mastery debug */}
      <MasteryDebug ld={ld} ayatText={ayat.text} />
    </div>
  );
}


// ─── AideMemoireMode ──────────────────────────────────────────────────────────
// Sajda ayats (surahNum:ayatNum)
const SAJDA_AYATS = new Set([
  "7:206","13:15","16:50","17:109","19:58","22:18","22:77",
  "25:60","27:26","32:15","38:24","41:38","53:62","84:21","96:19"
]);
const PAGE_POSITION_LABELS = [
  { key: null,    label: 'NON DÉFINI',   color: 'var(--text3)' },
  { key: 'start', label: 'DÉBUT',        color: '#4caf81' },
  { key: 'mid',   label: 'MILIEU',       color: '#5bc8f5' },
  { key: 'end',   label: 'FIN',          color: '#ffd166' },
];
