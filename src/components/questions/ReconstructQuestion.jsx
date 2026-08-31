import { splitArabicWords } from "../../utils/arabicUtils.js";
import React, { useState } from "react";
import { normalizeArabic } from "../../utils/recitationDiff.js";
import { ARABIC_WORD_CATS, Q_CAT_LABELS } from "../../utils/tajweedRules.js";

export function ReconstructQuestion({ q, ayatTexts, selectedSn, onAnswer }) {
  const pool = React.useMemo(() => {
    const real = [...q.words];
    const impostorCandidates = [];
    Object.entries(ayatTexts).forEach(([k, txt]) => {
      if (!k.startsWith(selectedSn + ':')) return;
      const num = parseInt(k.split(':')[1]);
      if (num === q.ayatNum) return;
      splitArabicWords(txt).forEach(w => {
        if (!real.includes(w)) impostorCandidates.push(w);
      });
    });
    const impostorCount = Math.min(8, Math.max(2, Math.round(real.length * 0.4)));
    const impostors = [...impostorCandidates].sort(() => Math.random() - 0.5).slice(0, impostorCount);
    return [...real, ...impostors].sort(() => Math.random() - 0.5);
  }, [q.ayatNum]);

  // Classify each pool word and group by category
  const poolByCategory = React.useMemo(() => {
    const realSet = new Set(q.words);
    const groups = {};
    pool.forEach((word, idx) => {
      const cat = ARABIC_WORD_CATS.classify(word);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ word, idx, isReal: realSet.has(word) });
    });
    const ORDER = ['allah', 'propre', 'verbe', 'nom', 'pronom', 'particule', 'autre'];
    return ORDER.filter(c => groups[c]).map(c => ({ cat: c, items: groups[c] }));
  }, [pool]);

  const [picked,     setPicked]     = React.useState([]);
  const [graded,     setGraded]     = React.useState(null);
  const [shake,      setShake]      = React.useState(false);
  const [poolSearch, setPoolSearch] = React.useState('');
  // Cursor = insertion position (0 = before first word, picked.length = after last)
  const [cursor, setCursor] = React.useState(0);

  // Per-position status after grading
  const wordStatuses = React.useMemo(() => {
    if (graded === null) return null;
    return picked.map((poolIdx, pos) => {
      if (pos >= q.words.length) return 'extra';
      return normalizeArabic(pool[poolIdx]) === normalizeArabic(q.words[pos]) ? 'correct' : 'wrong';
    });
  }, [graded, picked, pool]);

  // Per-pool-index status after grading
  const poolStatuses = React.useMemo(() => {
    if (graded === null) return {};
    const m = {};
    picked.forEach((poolIdx, pos) => {
      m[poolIdx] = pos < q.words.length && normalizeArabic(pool[poolIdx]) === normalizeArabic(q.words[pos]) ? 'correct' : 'wrong';
    });
    return m;
  }, [graded, picked]);

  // Insert word at cursor position
  const pickWord = (idx) => {
    if (graded !== null || picked.includes(idx)) return;
    setPicked(p => { const n = [...p]; n.splice(cursor, 0, idx); return n; });
    setCursor(c => c + 1);
  };
  // Remove word at pos, move cursor there
  const unpick = (pos) => {
    if (graded !== null) return;
    setPicked(p => p.filter((_, i) => i !== pos));
    setCursor(pos);
  };
  // Click placed word sets cursor after it (for insertion next to it)
  const moveCursor = (pos) => {
    if (graded !== null) return;
    setCursor(pos + 1);
  };
  const submit = () => {
    if (graded !== null) return;
    const composed = picked.map(i => pool[i]).join(' ').trim();
    const correct = normalizeArabic(composed) === normalizeArabic(q.answer.trim());
    setGraded(correct);
    if (!correct) { setShake(true); setTimeout(() => setShake(false), 600); }
  };
  const reset = () => { setPicked([]); setGraded(null); setShake(false); setCursor(0); };

  const isComplete = picked.length === q.words.length;
  const borderColor = graded === true ? 'var(--green)' : graded === false ? 'var(--red)' : 'var(--border)';

  return (
    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:12 }}>

      {/* Composition zone — coloured per-word after grading */}
      <div style={{ minHeight:60, padding:'10px 12px', background:'var(--surface3)',
        borderRadius:10, border:'1.5px solid ' + borderColor,
        direction:'rtl', display:'flex', flexWrap:'wrap', alignItems:'center', gap:6,
        transition:'border-color .3s', animation: shake ? 'shake .5s' : 'none' }}>
        {picked.length === 0 ? (
          <React.Fragment>
            {graded === null && (
              <span style={{ display:'inline-block', width:2, height:22, background:'var(--teal)',
                borderRadius:1, animation:'blink 1s step-end infinite', verticalAlign:'middle', marginLeft:2 }} />
            )}
            <span style={{ fontSize:9, color:'var(--text3)', letterSpacing:1, direction:'ltr', marginRight:6 }}>
              Tape les mots dans l&apos;ordre…
            </span>
          </React.Fragment>
        ) : (
          <React.Fragment>
            {/* Cursor at position 0 */}
            {graded === null && cursor === 0 && (
              <span style={{ display:'inline-block', width:2, height:22, background:'var(--teal)',
                borderRadius:1, animation:'blink 1s step-end infinite', verticalAlign:'middle' }} />
            )}
            {picked.map((poolIdx, pos) => {
              const status = wordStatuses?.[pos];
              const bg   = status === 'correct' ? 'rgba(76,175,129,.22)'
                         : status              ? 'rgba(224,90,90,.22)'
                         : 'rgba(62,184,160,.18)';
              const bord = status === 'correct' ? '1px solid var(--green)'
                         : status              ? '1px solid var(--red)'
                         : '1px solid var(--teal2)';
              const icon = status === 'correct' ? ' ✓' : status ? ' ✗' : '';
              return (
                <React.Fragment key={pos}>
                  <span
                    onClick={() => { if (graded === null) { cursor === pos + 1 ? unpick(pos) : moveCursor(pos); } }}
                    title={graded === null ? (cursor === pos + 1 ? 'Cliquer pour retirer' : 'Cliquer pour placer ici') : ''}
                    style={{ fontFamily:"'Amiri Quran',serif", fontSize:18, padding:'3px 10px',
                      borderRadius:7, border:bord, background:bg, color:'var(--text)',
                      cursor: graded === null ? 'pointer' : 'default', transition:'all .2s',
                      outline: graded === null && cursor === pos + 1 ? '2px solid var(--teal)' : 'none' }}>
                    {pool[poolIdx]}
                    {icon && <sup style={{ fontSize:10, marginRight:2,
                      color: status === 'correct' ? 'var(--green)' : 'var(--red)' }}>{icon}</sup>}
                  </span>
                  {/* Cursor after this word */}
                  {graded === null && cursor === pos + 1 && (
                    <span style={{ display:'inline-block', width:2, height:22, background:'var(--teal)',
                      borderRadius:1, animation:'blink 1s step-end infinite', verticalAlign:'middle' }} />
                  )}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        )}
      </div>

      {/* Word pool — categorized always; labels + status colors only after grading */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {/* Search bar (before grading only) */}
        {graded === null && (
          <div style={{ position:'relative' }}>
            <input
              value={poolSearch}
              onChange={e => setPoolSearch(e.target.value)}
              placeholder="بحث…"
              style={{ width:'100%', boxSizing:'border-box',
                padding:'7px 30px 7px 10px', fontSize:15,
                fontFamily:"'Amiri Quran',serif", direction:'rtl',
                background:'var(--surface3)', border:'1px solid var(--border2)',
                borderRadius:8, color:'var(--text)', outline:'none' }}
            />
            {poolSearch && (
              <button onClick={() => setPoolSearch('')}
                style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', color:'var(--text3)',
                  fontSize:12, cursor:'pointer', padding:0, lineHeight:1 }}>✕</button>
            )}
          </div>
        )}
        {poolByCategory.filter(({ cat }) => cat !== 'autre').map(({ cat, items }) => {
          const meta = Q_CAT_LABELS[cat] || Q_CAT_LABELS.autre;
          const visibleItems = items.filter(({ word }) =>
            !poolSearch || normalizeArabic(word).includes(normalizeArabic(poolSearch))
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={cat}>
              {/* Category label — always shown */}
              <div style={{ fontSize:7, letterSpacing:2,
                color: graded !== null ? meta.text : 'var(--text3)', opacity: graded !== null ? .85 : .5,
                fontFamily:"'Cinzel',serif", marginBottom:3, paddingRight:4,
                textAlign:'right', direction:'rtl', transition:'color .3s' }}>
                {meta.label}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, direction:'rtl' }}>
                {visibleItems.map(({ word, idx, isReal }) => {
                  const used      = picked.includes(idx);
                  const status    = graded !== null ? poolStatuses[idx] : null;
                  const isMissing = graded === false && !used && isReal;
                  // Before grading: uniform teal style. After: coloured by status.
                  const bg   = graded === null
                    ? (used ? 'var(--surface3)' : meta.color)
                    : status === 'correct' ? 'rgba(76,175,129,.18)'
                    : status === 'wrong'   ? 'rgba(224,90,90,.15)'
                    : isMissing            ? 'rgba(201,168,76,.15)'
                    : used                 ? 'var(--surface3)'
                    : meta.color;
                  const bord = graded === null
                    ? (used ? 'var(--border2)' : meta.border)
                    : status === 'correct' ? 'var(--green)'
                    : status === 'wrong'   ? 'var(--red)'
                    : isMissing            ? 'var(--gold)'
                    : used                 ? 'var(--border2)'
                    : meta.border;
                  return (
                    <button key={idx}
                      onClick={() => pickWord(idx)}
                      disabled={used || graded !== null}
                      style={{ fontFamily:"'Amiri Quran',serif", fontSize:17, padding:'5px 12px',
                        borderRadius:8, border:'1px solid ' + bord, background:bg,
                        color:'var(--text)',
                        opacity: used && graded === null ? 0.3 : used && !status ? 0.3 : 1,
                        cursor: used || graded !== null ? 'default' : 'pointer',
                        direction:'rtl', transition:'all .2s',
                        boxShadow: isMissing ? '0 0 0 2px rgba(201,168,76,.3)' : 'none' }}>
                      {word}
                      {isMissing && <sup style={{ fontSize:9, color:'var(--gold)', marginRight:2 }}> ✕</sup>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Impostors (autre) — shown ungrouped, no label, muted */}
        {(() => {
          const autreGroup = poolByCategory.find(({ cat }) => cat === 'autre');
          if (!autreGroup) return null;
          const visibleItems = autreGroup.items.filter(({ word }) =>
            !poolSearch || normalizeArabic(word).includes(normalizeArabic(poolSearch))
          );
          if (visibleItems.length === 0) return null;
          return (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, direction:'rtl', opacity:.7 }}>
              {visibleItems.map(({ word, idx }) => {
                const used   = picked.includes(idx);
                const status = graded !== null ? poolStatuses[idx] : null;
                const bg   = graded === null
                  ? (used ? 'var(--surface3)' : 'rgba(62,184,160,.10)')
                  : status === 'correct' ? 'rgba(76,175,129,.18)'
                  : status === 'wrong'   ? 'rgba(224,90,90,.15)'
                  : used ? 'var(--surface3)' : 'rgba(62,184,160,.10)';
                const bord = graded === null
                  ? (used ? 'var(--border2)' : 'var(--teal)')
                  : status === 'correct' ? 'var(--green)'
                  : status === 'wrong'   ? 'var(--red)'
                  : used ? 'var(--border2)' : 'var(--teal)';
                return (
                  <button key={idx} onClick={() => pickWord(idx)}
                    disabled={used || graded !== null}
                    style={{ fontFamily:"'Amiri Quran',serif", fontSize:17, padding:'5px 12px',
                      borderRadius:8, border:'1px solid ' + bord, background:bg,
                      color:'var(--text)', opacity: used ? 0.25 : 1,
                      cursor: used || graded !== null ? 'default' : 'pointer',
                      direction:'rtl', transition:'all .2s' }}>
                    {word}
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Correct order — shown only on wrong answer */}
      {graded === false && (
        <div style={{ padding:'8px 12px', background:'rgba(201,168,76,.07)',
          border:'1px solid var(--gold)', borderRadius:8, direction:'rtl' }}>
          <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)',
            direction:'ltr', marginBottom:6 }}>ORDRE CORRECT</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {q.words.map((w, i) => {
              const userWord = picked[i] !== undefined ? pool[picked[i]] : null;
              const ok = userWord != null && normalizeArabic(userWord) === normalizeArabic(w);
              return (
                <span key={i} style={{ fontFamily:"'Amiri Quran',serif", fontSize:17,
                  padding:'3px 10px', borderRadius:7,
                  background: ok ? 'rgba(76,175,129,.15)' : 'rgba(201,168,76,.18)',
                  border:'1px solid ' + (ok ? 'var(--green)' : 'var(--gold)'),
                  color:'var(--text)' }}>
                  {w}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      {graded === null ? (
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={reset} disabled={picked.length === 0}
            style={{ padding:'7px 14px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:'transparent', border:'1px solid var(--border2)', color:'var(--text3)',
              borderRadius:8, cursor:'pointer', opacity: picked.length===0 ? 0.4 : 1 }}>
            ↺
          </button>
          <button onClick={submit} disabled={!isComplete}
            style={{ flex:1, padding:'9px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background: isComplete ? 'rgba(201,168,76,.12)' : 'transparent',
              border:'1px solid ' + (isComplete ? 'var(--gold)' : 'var(--border2)'),
              color: isComplete ? 'var(--gold2)' : 'var(--text3)',
              borderRadius:8, cursor: isComplete ? 'pointer' : 'default', transition:'all .2s' }}>
            VALIDER ({picked.length}/{q.words.length})
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', gap:8 }}>
          {!graded && (
            <button onClick={reset}
              style={{ padding:'7px 14px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
                background:'transparent', border:'1px solid var(--teal)', color:'var(--teal)',
                borderRadius:8, cursor:'pointer' }}>
              ↺ RÉESSAYER
            </button>
          )}
          <button onClick={() => onAnswer(graded)}
            style={{ flex:1, padding:'9px', fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background: graded ? 'rgba(76,175,129,.12)' : 'rgba(224,90,90,.08)',
              border:'1px solid ' + (graded ? 'var(--green)' : 'var(--red)'),
              color: graded ? 'var(--green)' : 'var(--red)',
              borderRadius:8, cursor:'pointer' }}>
            SUIVANT →
          </button>
        </div>
      )}
    </div>
  );
}
// ─── QAyatPlayer ──────────────────────────────────────────────────────────────
// Interactive ayat display for QuestionsMode:
// - Letter-by-letter highlight driven by local RAF currentMs
// - Click word → play from that word's timestamp
// - Parts shown as colored chips → click to play that range
// - Full-ayat play/pause button
