import { fetchSurahDefault } from "../../utils/reciterAudio.js";
import React, { useState, useMemo } from "react";
import { computeMastery, computeSurahMastery, getAyatLetterStats, masteryColor } from "../common/Mastery.jsx";

export function LearningMapPage({ surahs, learnData, surahTextCache = {}, onNavigate }) {
  const [selectedSns, setSelectedSns] = React.useState(new Set()); // selected surahs
  const [hoveredSn, setHoveredSn] = React.useState(null);
  const [pageData, setPageData] = React.useState({}); // sn -> [{numberInSurah, page, text}]
  const [filterMode, setFilterMode] = React.useState("all"); // "all" | "toRevise" | "learned"
  const [tooltipAyat, setTooltipAyat] = React.useState(null); // { sn, an, x, y, stats }

  // Compute per-surah stats with mastery and toRevise breakdown
  const surahStats = React.useMemo(() => {
    return surahs.map(s => {
      const total = s.numberOfAyahs || 0;
      let learned = 0;
      let toReviseCount = 0;
      let perfect = 0;
      let questioned = 0;
      let sumAyatMastery = 0;

      for (let a = 1; a <= total; a++) {
        const k = `${s.number}:${a}`;
        const ld = learnData[k];
        const text = surahTextCache[s.number]?.[a] || (pageData[s.number]?.find(x => x.numberInSurah === a)?.text);
        if (ld) {
          if (ld.learned) learned++;
          if (ld.toRevise) toReviseCount++;
          const attempts = ld.writingAttempts || [];
          if (ld.learned && attempts.some(att => att.score === 100)) perfect++;
          if (ld.questionScores && Object.keys(ld.questionScores).length > 0) questioned++;
        }
        sumAyatMastery += computeMastery(ld, text);
      }

      const masteryPct = total > 0 ? Math.min(100, Math.round(sumAyatMastery / total)) : 0;

      return {
        sn: s.number,
        name: s.name,
        ename: s.englishName,
        total,
        learned,
        toReviseCount,
        perfect,
        questioned,
        masteryPct
      };
    });
  }, [surahs, learnData, surahTextCache, pageData]);

  const toggleSn = (sn) => setSelectedSns(prev => {
    const next = new Set(prev);
    if (next.has(sn)) next.delete(sn); else next.add(sn);
    return next;
  });

  // Fetch page mapping and text when a surah is expanded
  const ensurePageData = React.useCallback((sn) => {
    if (pageData[sn]) return;
    fetchSurahDefault(sn).then(ayahs => {
      setPageData(p => ({
        ...p,
        [sn]: ayahs.map(a => ({ numberInSurah: a.numberInSurah, page: a.page, text: a.text }))
      }));
    }).catch(() => {});
  }, [pageData]);

  const selectAll = () => setSelectedSns(new Set(surahs.map(s => s.number)));
  const clearAll  = () => setSelectedSns(new Set());

  const totalLearned   = surahStats.reduce((a, s) => a + s.learned, 0);
  const totalAyat      = surahStats.reduce((a, s) => a + s.total, 0);
  const totalToRevise  = surahStats.reduce((a, s) => a + s.toReviseCount, 0);
  const totalPerfect   = surahStats.reduce((a, s) => a + s.perfect, 0);
  const totalQuestion  = surahStats.reduce((a, s) => a + s.questioned, 0);
  const globalMastery  = totalAyat > 0
    ? Math.round(surahStats.reduce((a, s) => a + (s.masteryPct * s.total), 0) / totalAyat)
    : 0;

  const selStats = selectedSns.size > 0
    ? surahStats.filter(s => selectedSns.has(s.sn))
    : null;

  // Filter surahs list based on filterMode
  const displayedSurahs = useMemo(() => {
    if (filterMode === "toRevise") {
      return surahStats.filter(s => s.toReviseCount > 0);
    }
    if (filterMode === "learned") {
      return surahStats.filter(s => s.learned > 0);
    }
    return surahStats;
  }, [surahStats, filterMode]);

  const getAyatStatsAndStyle = (sn, an) => {
    const k = `${sn}:${an}`;
    const ld = learnData[k];
    const text = surahTextCache[sn]?.[an] || (pageData[sn]?.find(x => x.numberInSurah === an)?.text) || "";
    const stats = getAyatLetterStats(ld, text);
    const hasToRevise = Boolean(ld?.toRevise);

    if (hasToRevise) {
      return {
        stats,
        hasToRevise: true,
        bg: 'rgba(255, 126, 179, 0.25)',
        border: '#ff7eb3',
        textCol: '#ff7eb3',
        glow: '0 0 6px rgba(255,126,179,0.4)',
      };
    }

    if (!ld?.learned && stats.masteryPct === 0) {
      return {
        stats,
        hasToRevise: false,
        bg: 'var(--surface3)',
        border: 'var(--border)',
        textCol: 'var(--text3)',
      };
    }

    const attempts = ld?.writingAttempts || [];
    const best = attempts.length ? Math.max(...attempts.map(a => a.score)) : 0;
    const qs = ld?.questionScores || {};
    const qKeys = Object.keys(qs);
    const allQCorrect = qKeys.length > 0 && qKeys.every(k => { const arr = qs[k]; return arr[arr.length-1] === 1; });

    if (best === 100 && allQCorrect) {
      return { stats, hasToRevise: false, bg: 'rgba(201,168,76,.35)', border: 'var(--gold)', textCol: 'var(--gold)' };
    }
    if (best === 100) {
      return { stats, hasToRevise: false, bg: 'rgba(76,175,129,.35)', border: 'var(--green)', textCol: 'var(--green2)' };
    }
    if (best >= 70 || stats.masteryPct >= 70) {
      return { stats, hasToRevise: false, bg: 'rgba(62,184,160,.25)', border: 'var(--teal)', textCol: 'var(--teal2)' };
    }
    if (best > 0) {
      return { stats, hasToRevise: false, bg: 'rgba(229,115,115,.2)', border: 'var(--red)', textCol: 'var(--red2)' };
    }
    return { stats, hasToRevise: false, bg: 'rgba(255,255,255,.05)', border: 'var(--border2)', textCol: 'var(--text2)' };
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, padding:'12px 0' }}>
      {/* Global stats */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {[
          { label:'MAÎTRISE CORAN', val:`${globalMastery}%`, color:masteryColor(globalMastery) },
          { label:'APPRIS',         val:totalLearned,        color:'var(--teal2)' },
          { label:'À RÉVISER',      val:totalToRevise,       color: totalToRevise > 0 ? '#ff7eb3' : 'var(--text3)' },
          { label:'PARFAITS',       val:totalPerfect,        color:'var(--green)' },
          { label:'QUESTIONS',      val:totalQuestion,       color:'var(--gold)' },
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
        <div style={{ height:'100%', width:`${globalMastery}%`,
          background: `linear-gradient(90deg, var(--teal), ${masteryColor(globalMastery)})`, borderRadius:3, transition:'width .5s' }} />
      </div>

      {/* Filter Mode Buttons & Selection controls */}
      <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {[
            { id: "all", label: "TOUTES LES SOURATES" },
            { id: "toRevise", label: `À RÉVISER (${totalToRevise})`, color: '#ff7eb3' },
            { id: "learned", label: "EN COURS / APPRISES" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id)}
              style={{
                fontSize: 8,
                letterSpacing: 1,
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${filterMode === tab.id ? (tab.color || 'var(--teal)') : 'var(--border2)'}`,
                background: filterMode === tab.id ? (tab.color ? 'rgba(255,126,179,0.15)' : 'rgba(62,184,160,.12)') : 'transparent',
                color: filterMode === tab.id ? (tab.color || 'var(--teal2)') : 'var(--text3)',
                fontFamily: "'Cinzel',serif",
                cursor: 'pointer',
                transition: 'all .15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <div style={{ fontSize:8, letterSpacing:2, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>
            {selectedSns.size > 0 ? `${selectedSns.size} SÉLECTIONNÉE${selectedSns.size>1?'S':''}` : 'DÉTAIL CARTE'}
          </div>
          <button onClick={selectAll} style={{ fontSize:7, letterSpacing:1, padding:'2px 8px', borderRadius:10,
            border:'1px solid var(--teal)', background:'rgba(62,184,160,.08)', color:'var(--teal)',
            fontFamily:"'Cinzel',serif", cursor:'pointer' }}>TOUT</button>
          {selectedSns.size > 0 && <button onClick={clearAll} style={{ fontSize:7, letterSpacing:1, padding:'2px 8px', borderRadius:10,
            border:'1px solid var(--border2)', background:'transparent', color:'var(--text3)',
            fontFamily:"'Cinzel',serif", cursor:'pointer' }}>EFFACER</button>}
        </div>
      </div>

      {/* Surah grid */}
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {displayedSurahs.map(({ sn, name, ename, total, learned, toReviseCount, perfect, masteryPct }) => {
          const selected = selectedSns.has(sn);
          const hovered  = hoveredSn === sn;
          const si = surahs.find(s => s.number === sn);
          const ayahs = si ? Array.from({ length: si.numberOfAyahs }, (_, i) => i + 1) : [];

          return (
            <div key={sn}
              style={{ borderRadius:9, border:`1px solid ${selected ? 'var(--teal)' : toReviseCount > 0 ? 'rgba(255,126,179,0.3)' : 'var(--border)'}`,
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
                
                {/* Name and English Title */}
                <div style={{ minWidth: 100, flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: 'var(--text)', fontFamily: "'Cinzel',serif", fontWeight: 600 }}>{ename}</div>
                  <div style={{ fontSize: 7, color: 'var(--text3)', letterSpacing: 0.5 }}>{total} AYATS</div>
                </div>

                <div style={{ flex:1 }}>
                  {/* Surah Mastery Bar */}
                  <div style={{ height:5, borderRadius:2.5, background:'var(--surface3)', overflow:'hidden', marginBottom:2 }}>
                    <div style={{ height:'100%', width:`${masteryPct}%`, borderRadius:2.5,
                      background: masteryColor(masteryPct), transition:'width .3s' }} />
                  </div>
                </div>

                {/* To Revise Badge if any */}
                {toReviseCount > 0 && (
                  <div style={{
                    fontSize: 7.5,
                    color: '#ff7eb3',
                    background: 'rgba(255, 126, 179, 0.12)',
                    border: '1px solid rgba(255, 126, 179, 0.4)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontFamily: "'Cinzel',serif",
                    letterSpacing: 0.5
                  }}>
                    🔖 {toReviseCount} À RÉVISER
                  </div>
                )}

                {/* Mastery & Learned Counts */}
                <div style={{ textAlign:'right', minWidth:60 }}>
                  <div style={{ fontSize:9, color: masteryColor(masteryPct), fontFamily:"'Cinzel',serif", fontWeight:700 }}>
                    {masteryPct}%
                  </div>
                  <div style={{ fontSize:7, color: learned > 0 ? 'var(--teal2)' : 'var(--text3)', letterSpacing:.5 }}>
                    {learned}/{total}
                  </div>
                </div>

                <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:16, color:'var(--gold)', direction:'rtl', minWidth:70, textAlign:'left' }}>{name}</div>
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
                    display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
                    {items.map((item, i) => item.type === 'badge'
                      ? <span key={`p${item.page}-${i}`} style={{
                          fontSize:6, letterSpacing:1, color:'#c878ff',
                          fontFamily:"'Cinzel',serif", padding:'0 3px',
                          borderLeft: i > 0 ? '1px solid rgba(200,120,255,.2)' : 'none',
                          marginLeft: i > 0 ? 3 : 0, lineHeight:'20px',
                        }}>P{item.page}</span>
                      : (() => {
                          const { stats, hasToRevise, bg, border, textCol, glow } = getAyatStatsAndStyle(sn, item.an);
                          const ld = learnData[`${sn}:${item.an}`];
                          const ratioStr = `${stats.learnedLetters}/${stats.totalLetters}`;

                          return (
                            <div key={item.an}
                              title={`${ename} ${item.an} — Maîtrise: ${stats.masteryPct}% (${ratioStr} lettres)${hasToRevise ? ' [À RÉVISER]' : ''}`}
                              onClick={e => { e.stopPropagation(); onNavigate?.(sn, item.an); }}
                              style={{
                                minWidth: 26,
                                height: 24,
                                padding: '0 4px',
                                borderRadius: 4,
                                cursor: 'pointer',
                                background: bg,
                                border: `1px solid ${border}`,
                                boxShadow: glow || 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all .15s'
                              }}>
                              <div style={{ fontSize: 7.5, color: textCol, fontFamily: "'Cinzel',serif", fontWeight: 700, lineHeight: 1 }}>
                                {item.an}
                              </div>
                              <div style={{ fontSize: 5.5, color: hasToRevise ? '#ff7eb3' : 'var(--text3)', letterSpacing: -0.2, marginTop: 1, lineHeight: 1 }}>
                                {hasToRevise ? '🔖 REV' : `${stats.masteryPct}%`}
                              </div>
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
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', padding:'6px 0', borderTop:'1px solid var(--border)' }}>
        {[
          { bg:'rgba(255, 126, 179, 0.25)', border:'#ff7eb3', label:'À réviser (marqué 🔖)' },
          { bg:'rgba(201,168,76,.35)',  border:'var(--gold)',    label:'Maîtrisé (écriture + questions)' },
          { bg:'rgba(76,175,129,.35)', border:'var(--green)',   label:'Parfait (100%)' },
          { bg:'rgba(62,184,160,.25)', border:'var(--teal)',    label:'Bon (≥70% lettres)' },
          { bg:'rgba(229,115,115,.2)', border:'var(--red)',     label:'Partiel / À revoir' },
          { bg:'rgba(255,255,255,.05)', border:'var(--border2)', label:'Non révisé' },
          { bg:'var(--surface3)',      border:'var(--border)',  label:'Non appris' },
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
            SÉLECTION — {selStats.reduce((a,s)=>a+s.learned,0)} ayats appris sur {selStats.reduce((a,s)=>a+s.total,0)}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <div style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:12, color: masteryColor(Math.round(selStats.reduce((a,s)=>a+s.masteryPct*s.total,0)/selStats.reduce((a,s)=>a+s.total,1))), fontFamily:"'Cinzel',serif", fontWeight:700 }}>
                {Math.round(selStats.reduce((a,s)=>a+s.masteryPct*s.total,0)/selStats.reduce((a,s)=>a+s.total,1))}%
              </div>
              <div style={{ fontSize:7, color:'var(--text3)', letterSpacing:1 }}>MAÎTRISE SÉLECTION</div>
            </div>
            <div style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'#ff7eb3', fontFamily:"'Cinzel',serif" }}>{selStats.reduce((a,s)=>a+s.toReviseCount,0)}</div>
              <div style={{ fontSize:7, color:'var(--text3)', letterSpacing:1 }}>À RÉVISER</div>
            </div>
            <div style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'var(--green)', fontFamily:"'Cinzel',serif" }}>{selStats.reduce((a,s)=>a+s.perfect,0)}</div>
              <div style={{ fontSize:7, color:'var(--text3)', letterSpacing:1 }}>PARFAITS</div>
            </div>
            <div style={{ flex:1, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'var(--gold)', fontFamily:"'Cinzel',serif" }}>{selStats.reduce((a,s)=>a+s.questioned,0)}</div>
              <div style={{ fontSize:7, color:'var(--text3)', letterSpacing:1 }}>QUESTIONS</div>
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
