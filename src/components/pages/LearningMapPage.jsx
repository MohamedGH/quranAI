import { fetchSurahDefault } from "../../utils/reciterAudio.js";
import React, { useState, useMemo, useCallback } from "react";
import { computeMastery, computeSurahMastery, getAyatLetterStats, masteryColor } from "../common/Mastery.jsx";
import { SurahAyatsMasteryRibbon } from "../common/SurahAyatsMasteryRibbon.jsx";
import { REVISION_LEVEL_LEGEND } from "../../utils/ayatRevisionLevel.js";

export function LearningMapPage({ surahs, learnData, surahTextCache = {}, onNavigate, setLData = null }) {
  const [selectedSns, setSelectedSns] = useState(new Set()); // selected / expanded surahs
  const [hoveredSn, setHoveredSn] = useState(null);
  const [pageData, setPageData] = useState({}); // sn -> [{numberInSurah, page, text}]
  const [filterMode, setFilterMode] = useState("all"); // "all" | "toRevise" | "learned"
  const [searchQuery, setSearchQuery] = useState("");
  const [expandAll, setExpandAll] = useState(false);

  // Compute per-surah stats with mastery and toRevise breakdown
  const surahStats = useMemo(() => {
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
  const ensurePageData = useCallback((sn) => {
    if (pageData[sn]) return;
    fetchSurahDefault(sn).then(ayahs => {
      setPageData(p => ({
        ...p,
        [sn]: ayahs.map(a => ({ numberInSurah: a.numberInSurah, page: a.page, text: a.text }))
      }));
    }).catch(() => {});
  }, [pageData]);

  const handleSelectAll = () => {
    setExpandAll(true);
    setSelectedSns(new Set(surahs.map(s => s.number)));
    surahs.forEach(s => ensurePageData(s.number));
  };

  const handleClearAll = () => {
    setExpandAll(false);
    setSelectedSns(new Set());
  };

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

  // Filter surahs list based on filterMode & search query
  const displayedSurahs = useMemo(() => {
    let list = surahStats;
    if (filterMode === "toRevise") {
      list = list.filter(s => s.toReviseCount > 0);
    } else if (filterMode === "learned") {
      list = list.filter(s => s.learned > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s =>
        s.sn.toString() === q ||
        s.ename.toLowerCase().includes(q) ||
        s.name.includes(q)
      );
    }

    return list;
  }, [surahStats, filterMode, searchQuery]);

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
          <div key={label} style={{ flex:1, minWidth:75, padding:'8px 10px', borderRadius:8,
            background:'var(--surface2)', border:'1px solid var(--border)', textAlign:'center' }}>
            <div style={{ fontSize:15, fontFamily:"'Cinzel',serif", color, fontWeight:600 }}>{val}</div>
            <div style={{ fontSize:7, letterSpacing:1.5, color:'var(--text3)', marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar overall */}
      <div style={{ height:6, borderRadius:3, background:'var(--surface3)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${globalMastery}%`,
          background: `linear-gradient(90deg, var(--teal), ${masteryColor(globalMastery)})`, borderRadius:3, transition:'width .5s' }} />
      </div>

      {/* Filter Mode Buttons, Search & Selection controls */}
      <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' }}>
        {/* Filter Pills */}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {[
            { id: "all", label: `TOUTES (${surahs.length})` },
            { id: "toRevise", label: `🔖 À RÉVISER (${totalToRevise})`, color: '#ff7eb3' },
            { id: "learned", label: `EN COURS (${surahStats.filter(s => s.learned > 0).length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id)}
              style={{
                fontSize: 8.5,
                letterSpacing: 1,
                padding: '5px 11px',
                borderRadius: 6,
                border: `1px solid ${filterMode === tab.id ? (tab.color || 'var(--teal)') : 'var(--border2)'}`,
                background: filterMode === tab.id ? (tab.color ? 'rgba(255,126,179,0.18)' : 'rgba(62,184,160,.14)') : 'transparent',
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

        {/* Search & Actions */}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Chercher sourate (nom, n°)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              padding: '4px 9px',
              fontSize: 8.5,
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 6,
              color: 'var(--text)',
              width: 170,
              fontFamily: "'Cinzel',serif",
            }}
          />

          <button
            onClick={() => {
              if (selectedSns.size > 0) {
                handleClearAll();
              } else {
                handleSelectAll();
              }
            }}
            style={{
              fontSize: 7.5,
              letterSpacing: 1,
              padding: '4px 9px',
              borderRadius: 6,
              border: '1px solid var(--teal)',
              background: 'rgba(62,184,160,.08)',
              color: 'var(--teal2)',
              fontFamily: "'Cinzel',serif",
              cursor: 'pointer'
            }}
          >
            {selectedSns.size > 0 ? "TOUT RÉDUIRE" : "DÉPLIER TOUS LES VERSETS"}
          </button>
        </div>
      </div>

      {/* Legend showing all revision levels */}
      <div style={{
        display:'flex',
        gap: 12,
        flexWrap:'wrap',
        padding:'8px 12px',
        background:'rgba(255,255,255,0.015)',
        borderRadius: 8,
        border:'1px solid var(--border)',
        alignItems:'center'
      }}>
        <span style={{ fontSize:7.5, letterSpacing:1, color:'var(--gold2)', fontFamily:"'Cinzel',serif", fontWeight:600 }}>
          NIVEAU DU RÉVISEUR :
        </span>
        {REVISION_LEVEL_LEGEND.map(({ id, label, bg, border, color, glow }) => (
          <div key={id} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: bg,
              border: `1.5px solid ${border}`,
              boxShadow: glow || 'none',
              flexShrink: 0
            }} />
            <span style={{ fontSize: 7.5, color: color || 'var(--text2)', letterSpacing: 0.5, fontFamily: "'Cinzel',serif" }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Surah list */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {displayedSurahs.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text3)', fontSize:11, letterSpacing:1 }}>
            Aucune sourate trouvée dans ce filtre.
          </div>
        )}

        {displayedSurahs.map(({ sn, name, ename, total, learned, toReviseCount, perfect, masteryPct }) => {
          const isSelected = selectedSns.has(sn);
          const si = surahs.find(s => s.number === sn);

          return (
            <div key={sn}
              style={{
                borderRadius: 10,
                border: `1px solid ${isSelected ? 'var(--teal)' : toReviseCount > 0 ? 'rgba(255,126,179,0.35)' : 'var(--border)'}`,
                background: isSelected ? 'rgba(62,184,160,.03)' : 'var(--surface2)',
                overflow: 'hidden',
                transition: 'border-color .15s, background .15s',
              }}
            >
              {/* Surah header row */}
              <div
                style={{
                  display:'flex',
                  alignItems:'center',
                  gap: 10,
                  padding:'10px 14px',
                  cursor:'pointer',
                  userSelect:'none'
                }}
                onClick={() => { toggleSn(sn); ensurePageData(sn); }}
                onMouseEnter={() => { setHoveredSn(sn); ensurePageData(sn); }}
                onMouseLeave={() => setHoveredSn(null)}
              >
                {/* Checkbox / Chevron */}
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  flexShrink: 0,
                  background: isSelected ? 'var(--teal)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isSelected ? 'var(--teal)' : 'var(--border2)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: isSelected ? 'var(--surface)' : 'var(--text3)',
                  fontWeight: 700
                }}>
                  {isSelected ? '▲' : '▼'}
                </div>

                {/* Surah Number */}
                <div style={{
                  fontSize: 10,
                  color: 'var(--text3)',
                  fontFamily: "'Cinzel',serif",
                  fontWeight: 600,
                  width: 24,
                  flexShrink: 0
                }}>
                  #{sn}
                </div>
                
                {/* Name and English Title */}
                <div style={{ minWidth: 120, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text)', fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
                    {ename}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--text3)', letterSpacing: 0.5, marginTop: 1 }}>
                    {total} AYATS · {learned} APPRIS
                  </div>
                </div>

                {/* Surah Mastery Bar */}
                <div style={{ flex: 1, minWidth: 80, maxWidth: 220 }}>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--surface3)', overflow: 'hidden', marginBottom: 2 }}>
                    <div style={{
                      height: '100%',
                      width: `${masteryPct}%`,
                      borderRadius: 3,
                      background: masteryColor(masteryPct),
                      transition: 'width .3s'
                    }} />
                  </div>
                </div>

                {/* To Revise Badge if any */}
                {toReviseCount > 0 && (
                  <div style={{
                    fontSize: 8,
                    color: '#ff7eb3',
                    background: 'rgba(255, 126, 179, 0.15)',
                    border: '1px solid rgba(255, 126, 179, 0.5)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontFamily: "'Cinzel',serif",
                    fontWeight: 600,
                    letterSpacing: 0.5,
                    boxShadow: '0 0 6px rgba(255,126,179,0.3)',
                    flexShrink: 0
                  }}>
                    🔖 {toReviseCount} À RÉVISER
                  </div>
                )}

                {/* Mastery Percentage */}
                <div style={{ textAlign:'right', minWidth: 50, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: masteryColor(masteryPct), fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
                    {masteryPct}%
                  </div>
                  <div style={{ fontSize: 7.5, color: 'var(--text3)', letterSpacing: 0.5 }}>
                    MAÎTRISE
                  </div>
                </div>

                {/* Arabic Calligraphy Name */}
                <div style={{
                  fontFamily: "'Amiri Quran',serif",
                  fontSize: 18,
                  color: 'var(--gold)',
                  direction: 'rtl',
                  minWidth: 80,
                  textAlign: 'left',
                  flexShrink: 0
                }}>
                  {name}
                </div>
              </div>

              {/* Compact Preview Ribbon when collapsed: allows viewing all ayats colors at a glance */}
              {!isSelected && (
                <div style={{ padding: '0 14px 8px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                  <SurahAyatsMasteryRibbon
                    surah={si}
                    learnData={learnData}
                    surahTextCache={surahTextCache}
                    pageDataForSurah={pageData[sn]}
                    compact={true}
                  />
                </div>
              )}

              {/* Expanded Detailed Ayat Mastery Ribbon: all ayats number with level-dependent color */}
              {isSelected && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  padding: '12px 14px 14px',
                  background: 'rgba(0,0,0,0.15)'
                }}>
                  <SurahAyatsMasteryRibbon
                    surah={si}
                    learnData={learnData}
                    surahTextCache={surahTextCache}
                    pageDataForSurah={pageData[sn]}
                    compact={false}
                    onNavigate={onNavigate}
                    setLData={setLData}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



// ─── RevisionPage ─────────────────────────────────────────────────────────────
// Page dédiée à la révision de tous les ayats marqués comme appris.
// Pour chaque ayat, on propose l'exercice d'écriture (RevisionEcritureMode)
// directement sur cette page, sans ouvrir le submenu.
