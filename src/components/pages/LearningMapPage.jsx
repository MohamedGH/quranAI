import { fetchSurahDefault } from "../../utils/reciterAudio.js";
import React, { useState, useMemo } from "react";

export function LearningMapPage({ surahs, learnData, onNavigate }) {
  const [selectedSns, setSelectedSns] = React.useState(new Set()); // selected surahs
  const [view, setView] = React.useState("surahs"); // "surahs" | "detail"
  const [hoveredSn, setHoveredSn] = React.useState(null);
  const [pageData, setPageData] = React.useState({}); // sn -> [{numberInSurah, page}]

  // Compute per-surah stats
  const surahStats = React.useMemo(() => {
    return surahs.map(s => {
      const total = s.numberOfAyahs;
      const learned = Object.keys(learnData).filter(k => {
        const [sn] = k.split(':').map(Number);
        return sn === s.number && learnData[k]?.learned;
      }).length;
      const perfect = Object.keys(learnData).filter(k => {
        const [sn] = k.split(':').map(Number);
        if (sn !== s.number || !learnData[k]?.learned) return false;
        const attempts = learnData[k]?.writingAttempts || [];
        return attempts.some(a => a.score === 100);
      }).length;
      const questioned = Object.keys(learnData).filter(k => {
        const [sn] = k.split(':').map(Number);
        return sn === s.number && learnData[k]?.questionScores && Object.keys(learnData[k].questionScores).length > 0;
      }).length;
      return { sn: s.number, name: s.name, ename: s.englishName, total, learned, perfect, questioned };
    });
  }, [surahs, learnData]);

  const toggleSn = (sn) => setSelectedSns(prev => {
    const next = new Set(prev);
    if (next.has(sn)) next.delete(sn); else next.add(sn);
    return next;
  });

  // Fetch page mapping when a surah is expanded
  const ensurePageData = React.useCallback((sn) => {
    if (pageData[sn]) return;
    fetchSurahDefault(sn).then(ayahs => {
      setPageData(p => ({ ...p, [sn]: ayahs.map(a => ({ numberInSurah: a.numberInSurah, page: a.page })) }));
    }).catch(() => {});
  }, [pageData]);

  const selectAll = () => setSelectedSns(new Set(surahs.map(s => s.number)));
  const clearAll  = () => setSelectedSns(new Set());

  const totalLearned   = surahStats.reduce((a, s) => a + s.learned, 0);
  const totalAyat      = surahStats.reduce((a, s) => a + s.total, 0);
  const totalPerfect   = surahStats.reduce((a, s) => a + s.perfect, 0);
  const totalQuestion  = surahStats.reduce((a, s) => a + s.questioned, 0);

  const selStats = selectedSns.size > 0
    ? surahStats.filter(s => selectedSns.has(s.sn))
    : null;

  const getAyatColor = (sn, an) => {
    const ld = learnData[`${sn}:${an}`];
    if (!ld?.learned) return { bg: 'var(--surface3)', border: 'var(--border)' };
    const attempts = ld.writingAttempts || [];
    const best = attempts.length ? Math.max(...attempts.map(a => a.score)) : 0;
    const qs = ld.questionScores || {};
    const qKeys = Object.keys(qs);
    const allQCorrect = qKeys.length > 0 && qKeys.every(k => { const arr = qs[k]; return arr[arr.length-1] === 1; });
    if (best === 100 && allQCorrect) return { bg: 'rgba(201,168,76,.4)',  border: 'var(--gold)' };
    if (best === 100)                return { bg: 'rgba(76,175,129,.35)', border: 'var(--green)' };
    if (best >= 70)                  return { bg: 'rgba(62,184,160,.25)', border: 'var(--teal)' };
    if (best > 0)                    return { bg: 'rgba(229,115,115,.2)', border: 'var(--red)' };
    return { bg: 'rgba(255,255,255,.05)', border: 'var(--border2)' };
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, padding:'12px 0' }}>
      {/* Global stats */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {[
          { label:'TOTAL CORAN', val:totalAyat, color:'var(--text3)' },
          { label:'APPRIS',      val:totalLearned,  color:'var(--teal2)' },
          { label:'PARFAITS',    val:totalPerfect,  color:'var(--green)' },
          { label:'QUESTIONS',   val:totalQuestion, color:'var(--gold)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ flex:1, minWidth:70, padding:'8px 10px', borderRadius:8,
            background:'var(--surface2)', border:'1px solid var(--border)', textAlign:'center' }}>
            <div style={{ fontSize:14, fontFamily:"'Cinzel',serif", color, fontWeight:600 }}>{val}</div>
            <div style={{ fontSize:7, letterSpacing:1.5, color:'var(--text3)', marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar overall */}
      <div style={{ height:6, borderRadius:3, background:'var(--surface3)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${totalAyat ? (totalLearned/totalAyat*100) : 0}%`,
          background:'linear-gradient(90deg,var(--teal),var(--green))', borderRadius:3, transition:'width .5s' }} />
      </div>

      {/* Selection controls */}
      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>
          {selectedSns.size > 0 ? `${selectedSns.size} SOURATE${selectedSns.size>1?'S':''} SÉLECTIONNÉE${selectedSns.size>1?'S':''}` : 'CLIQUER POUR SÉLECTIONNER'}
        </div>
        <button onClick={selectAll} style={{ fontSize:7, letterSpacing:1, padding:'2px 8px', borderRadius:10,
          border:'1px solid var(--teal)', background:'rgba(62,184,160,.08)', color:'var(--teal)',
          fontFamily:"'Cinzel',serif", cursor:'pointer' }}>TOUT</button>
        {selectedSns.size > 0 && <button onClick={clearAll} style={{ fontSize:7, letterSpacing:1, padding:'2px 8px', borderRadius:10,
          border:'1px solid var(--border2)', background:'transparent', color:'var(--text3)',
          fontFamily:"'Cinzel',serif", cursor:'pointer' }}>EFFACER</button>}
      </div>

      {/* Surah grid */}
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {surahStats.map(({ sn, name, ename, total, learned, perfect }) => {
          const pct = total ? learned / total : 0;
          const pctP = total ? perfect / total : 0;
          const selected = selectedSns.has(sn);
          const hovered  = hoveredSn === sn;
          const si = surahs.find(s => s.number === sn);
          const ayahs = si ? Array.from({ length: si.numberOfAyahs }, (_, i) => i + 1) : [];

          return (
            <div key={sn}
              style={{ borderRadius:9, border:`1px solid ${selected ? 'var(--teal)' : 'var(--border)'}`,
                background: selected ? 'rgba(62,184,160,.04)' : 'var(--surface2)', overflow:'hidden',
                transition:'border-color .15s' }}>
              {/* Surah header row */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', cursor:'pointer' }}
                onClick={() => { toggleSn(sn); ensurePageData(sn); }}
                onMouseEnter={() => { setHoveredSn(sn); ensurePageData(sn); }}
                onMouseLeave={() => setHoveredSn(null)}>
                <div style={{ width:16, height:16, borderRadius:4, flexShrink:0, transition:'all .15s',
                  background: selected ? 'var(--teal)' : 'transparent',
                  border:`1px solid ${selected ? 'var(--teal)' : 'var(--border2)'}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10, color:'var(--surface)' }}>{selected ? '✓' : ''}</div>
                <div style={{ fontSize:8, color:'var(--text3)', fontFamily:"'Cinzel',serif", letterSpacing:1, width:18, flexShrink:0 }}>{sn}</div>
                <div style={{ flex:1 }}>
                  {/* Mini progress bar */}
                  <div style={{ height:4, borderRadius:2, background:'var(--surface3)', overflow:'hidden', marginBottom:2 }}>
                    <div style={{ height:'100%', width:`${pct*100}%`, borderRadius:2,
                      background: pct === 1 ? 'var(--gold)' : 'var(--teal)', transition:'width .3s' }} />
                  </div>
                  {pctP > 0 && <div style={{ height:2, borderRadius:1, background:'var(--surface3)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pctP*100}%`, borderRadius:1, background:'var(--green)' }} />
                  </div>}
                </div>
                <div style={{ fontSize:8, color: learned > 0 ? 'var(--teal2)' : 'var(--text3)',
                  fontFamily:"'Cinzel',serif", letterSpacing:.5, minWidth:40, textAlign:'right' }}>
                  {learned}/{total}
                </div>
                <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:16, color:'var(--gold)', direction:'rtl' }}>{name}</div>
              </div>

              {/* Ayat heatmap — compact inline with page badges */}
              {(selected || hovered) && (() => {
                const pd = pageData[sn];
                // Build sorted flat list with page boundary markers
                const items = []; // {type:'badge'|'cell', page?, an?}
                if (pd && pd.length > 0) {
                  let lastPage = null;
                  pd.forEach(({ numberInSurah: an, page }) => {
                    if (page !== lastPage) { items.push({ type:'badge', page }); lastPage = page; }
                    items.push({ type:'cell', an });
                  });
                } else {
                  ayahs.forEach(an => items.push({ type:'cell', an }));
                }
                return (
                  <div style={{ borderTop:'1px solid var(--border)', padding:'8px 12px',
                    display:'flex', flexWrap:'wrap', gap:2, alignItems:'center' }}>
                    {items.map((item, i) => item.type === 'badge'
                      ? <span key={`p${item.page}-${i}`} style={{
                          fontSize:6, letterSpacing:1, color:'#c878ff',
                          fontFamily:"'Cinzel',serif", padding:'0 3px',
                          borderLeft: i > 0 ? '1px solid rgba(200,120,255,.2)' : 'none',
                          marginLeft: i > 0 ? 3 : 0, lineHeight:'18px',
                        }}>P{item.page}</span>
                      : (() => {
                          const { bg, border } = getAyatColor(sn, item.an);
                          return (
                            <div key={item.an}
                              title={`${ename} ${item.an}`}
                              onClick={e => { e.stopPropagation(); onNavigate?.('quran', sn, item.an); }}
                              style={{ width:18, height:18, borderRadius:3, cursor:'pointer',
                                background:bg, border:`1px solid ${border}`,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:6, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>
                              {item.an}
                            </div>
                          );
                        })()
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', padding:'4px 0' }}>
        {[
          { bg:'rgba(201,168,76,.4)',  border:'var(--gold)',    label:'Maîtrisé (écrit + questions)' },
          { bg:'rgba(76,175,129,.35)',border:'var(--green)',   label:'Parfait (écriture)' },
          { bg:'rgba(62,184,160,.25)',border:'var(--teal)',    label:'Bon (≥70%)' },
          { bg:'rgba(229,115,115,.2)',border:'var(--red)',     label:'À revoir' },
          { bg:'rgba(255,255,255,.05)',border:'var(--border2)',label:'Non révisé' },
          { bg:'var(--surface3)',     border:'var(--border)',  label:'Non appris' },
        ].map(({ bg, border, label }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:bg, border:`1px solid ${border}`, flexShrink:0 }} />
            <span style={{ fontSize:7, color:'var(--text3)', letterSpacing:.5 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Selected surahs actions */}
      {selectedSns.size > 0 && selStats && (
        <div style={{ padding:'14px', background:'var(--surface2)', border:'1px solid var(--teal)',
          borderRadius:10, display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:8, letterSpacing:2, color:'var(--teal2)', fontFamily:"'Cinzel',serif" }}>
            SÉLECTION — {selStats.reduce((a,s)=>a+s.learned,0)} ayats appris
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <div style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'var(--green)', fontFamily:"'Cinzel',serif" }}>{selStats.reduce((a,s)=>a+s.perfect,0)}</div>
              <div style={{ fontSize:7, color:'var(--text3)', letterSpacing:1 }}>PARFAITS</div>
            </div>
            <div style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'var(--gold)', fontFamily:"'Cinzel',serif" }}>{selStats.reduce((a,s)=>a+s.questioned,0)}</div>
              <div style={{ fontSize:7, color:'var(--text3)', letterSpacing:1 }}>QUESTIONS</div>
            </div>
            <div style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'var(--teal2)', fontFamily:"'Cinzel',serif" }}>
                {selStats.reduce((a,s)=>a+s.learned,0)}/{selStats.reduce((a,s)=>a+s.total,0)}
              </div>
              <div style={{ fontSize:7, color:'var(--text3)', letterSpacing:1 }}>APPRIS/TOTAL</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RevisionPage ─────────────────────────────────────────────────────────────
// Page dédiée à la révision de tous les ayats marqués comme appris.
// Pour chaque ayat, on propose l'exercice d'écriture (RevisionEcritureMode)
// directement sur cette page, sans ouvrir le submenu.
