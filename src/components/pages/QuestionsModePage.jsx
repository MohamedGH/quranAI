import { useNavigate } from "react-router-dom";
import { fetchSurahDefault } from "../../utils/reciterAudio.js";
import React, { useState, useEffect } from "react";
import { QuestionsMode } from "../questions/QuestionsMode.jsx";

export function QuestionsModePage({ surahs, learnData, setLData, initialSurahNum, initialRangeFrom, initialRangeTo, initialQIdx }) {
  const Q_PAGE_KEY = 'quran_questions_page_session';
  const loadSession = () => { try { return JSON.parse(localStorage.getItem(Q_PAGE_KEY)) || {}; } catch { return {}; } };
  const saveSession = (d) => { try { localStorage.setItem(Q_PAGE_KEY, JSON.stringify(d)); } catch {} };
  const clearPageSession = () => { try { localStorage.removeItem(Q_PAGE_KEY); } catch {} };

  const ALL_Q_TYPES = ["first_word","last_word","missing_word","next_verse","previous_verse","verse_number","find_ayat","reconstruct","compare_verse","find_surah","unknown_word","unknown_pick","page_structure","revise_word","revise_part"];

  const saved = React.useMemo(() => initialSurahNum ? {} : loadSession(), []);

  const [selectedSn,     setSelectedSn]     = React.useState(initialSurahNum ?? saved.selectedSn ?? null);
  const [rangeFrom,      setRangeFrom]      = React.useState(initialRangeFrom ?? saved.rangeFrom ?? "1");
  const [rangeTo,        setRangeTo]        = React.useState(initialRangeTo ?? saved.rangeTo ?? "");
  const [selectedQTypes, setSelectedQTypes] = React.useState(() => {
    if (saved.selectedQTypes) return new Set(saved.selectedQTypes);
    return new Set(ALL_Q_TYPES);
  });
  const [randomize,      setRandomize]      = React.useState(saved.randomize ?? false);
  const [skipCorrect,    setSkipCorrect]    = React.useState(saved.skipCorrect ?? true);
  const [onlyRevise,     setOnlyRevise]     = React.useState(saved.onlyRevise ?? false);
  const [clickPhase,     setClickPhase]     = React.useState("from"); // "from" | "to"
  const [multiSns,       setMultiSns]       = React.useState(saved.multiSns ?? []);
  const [multiRanges,    setMultiRanges]    = React.useState(saved.multiRanges ?? {}); // { sn: { from, to } }
  const [multiTexts,     setMultiTexts]     = React.useState({});
  const [ayatTexts,      setAyatTexts]      = React.useState({});
  const [qPageData,      setQPageData]      = React.useState({}); // sn -> [{numberInSurah, page}]
  const [showAvancement, setShowAvancement] = React.useState(true);
  const [showPlage,       setShowPlage]      = React.useState(true);

  const ensureQPageData = React.useCallback((sn) => {
    if (!sn || qPageData[sn]) return;
    fetchSurahDefault(sn).then(ayahs => {
      setQPageData(p => ({ ...p, [sn]: ayahs.map(a => ({ numberInSurah: a.numberInSurah, page: a.page })) }));
    }).catch(() => {});
  }, [qPageData]);

  // stage: "surah" | "multi" | "range" | "types" | "session" | "resume"
  const [stage, setStage] = React.useState(() => {
    if (initialSurahNum && initialRangeFrom) return "session";
    if (initialSurahNum) return "range";
    // If we have a saved session config, go to resume screen
    if (saved.selectedSn || (saved.multiSns && saved.multiSns.length > 0)) return "resume";
    return "surah";
  });
  const [started, setStarted] = React.useState(!!(initialSurahNum && initialRangeFrom));
  const qNavigate = useNavigate();

  const availableSurahs = React.useMemo(() =>
    surahs.filter(s => Object.keys(learnData).some(k => k.startsWith(s.number + ":") && learnData[k].learned))
      .sort((a,b) => a.number - b.number),
  [surahs, learnData]);

  const surahInfo = surahs.find(s => s.number === selectedSn);
  const maxAyat   = surahInfo?.numberOfAyahs ?? 1;

  const ayatList = React.useMemo(() => {
    if (!selectedSn) return [];
    const from = Math.max(1, parseInt(rangeFrom) || 1);
    const to   = Math.min(maxAyat, parseInt(rangeTo) || maxAyat);
    const arr = []; for (let i = from; i <= to; i++) arr.push(i);
    return arr;
  }, [selectedSn, surahs, rangeFrom, rangeTo]);

  const multiItems = React.useMemo(() => {
    if (multiSns.length === 0) return null;
    const items = [];
    multiSns.forEach(sn => {
      const si = surahs.find(s => s.number === sn);
      const max = si?.numberOfAyahs ?? 1;
      const r = multiRanges[sn];
      const from = r ? Math.max(1, parseInt(r.from) || 1) : 1;
      const to   = r ? Math.min(max, parseInt(r.to) || max) : max;
      const learned = Object.keys(learnData).filter(k => k.startsWith(sn + ':') && learnData[k].learned);
      learned.forEach(k => {
        const num = parseInt(k.split(':')[1]);
        if (num >= from && num <= to) items.push({ sn, ayatNum: num });
      });
    });
    return items;
  }, [multiSns, multiRanges, surahs, learnData]);

  React.useEffect(() => {
    if (!selectedSn) return;
    const k = String(selectedSn);
    if (ayatTexts[k]) return;
    fetchSurahDefault(selectedSn).then(ayahs => {
      if (!ayahs?.length) return;
      const m = {};
      ayahs.forEach(a => {
        m[`${selectedSn}:${a.numberInSurah}`] = a.text;
        m[`num:${selectedSn}:${a.numberInSurah}`] = a.number;
      });
      setAyatTexts(p => ({ ...p, ...m, [k]: true }));
    }).catch(() => {});
  }, [selectedSn]);

  React.useEffect(() => {
    multiSns.forEach(sn => {
      const k = String(sn);
      if (multiTexts[k]) return;
      fetchSurahDefault(sn).then(ayahs => {
        if (!ayahs?.length) return;
        const m = {};
        ayahs.forEach(a => {
          m[`${sn}:${a.numberInSurah}`] = a.text;
          m[`num:${sn}:${a.numberInSurah}`] = a.number;
        });
        setMultiTexts(p => ({ ...p, ...m, [k]: true }));
      }).catch(() => {});
    });
  }, [multiSns]);

  React.useEffect(() => {
    saveSession({ selectedSn, rangeFrom, rangeTo, multiSns, multiRanges, selectedQTypes: [...selectedQTypes], randomize, skipCorrect, onlyRevise });
  }, [selectedSn, rangeFrom, rangeTo, multiSns, selectedQTypes, randomize, skipCorrect, onlyRevise]);

  // ── Resume screen ──
  if (stage === "resume") {
    const isMulti = multiSns.length > 0;
    const surahInfo2 = surahs.find(s => s.number === selectedSn);
    const resumeLabel = isMulti
      ? `${multiSns.length} sourate${multiSns.length > 1 ? "s" : ""}`
      : surahInfo2
        ? `${surahInfo2.englishName.toUpperCase()} — ${rangeFrom}→${rangeTo || surahInfo2.numberOfAyahs}`
        : null;
    const TYPE_LABELS_SHORT = {
      first_word:"1er mot", last_word:"Dernier mot", missing_word:"Mot manquant",
      next_verse:"Verset suiv.", previous_verse:"Verset préc.",
      verse_number:"N° verset", find_ayat:"Trouver verset", reconstruct:"Reconstituer",
      compare_verse:"Comparer", find_surah:"Trouver sourate",
      unknown_word:"Mot inconnu", unknown_pick:"Mots inconnus", page_structure:"Structure page",
      revise_word:"🔖 Mot(s) à réviser", revise_part:"🔖 Partie à réviser",
    };
    const allTypesSelected = [...selectedQTypes].length === ALL_Q_TYPES.length;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16, padding:"28px 0" }}>
        <div style={{ textAlign:"center", display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ fontSize:8, letterSpacing:3, color:"var(--text3)" }}>SESSION PRÉCÉDENTE</div>
          {resumeLabel && (
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:"var(--gold2)", letterSpacing:1 }}>{resumeLabel}</div>
          )}
          {isMulti && (
            <div style={{ display:"flex", gap:4, flexWrap:"wrap", justifyContent:"center", marginTop:2 }}>
              {multiSns.map(sn => {
                const si = surahs.find(s => s.number === sn);
                return si ? (
                  <span key={sn} style={{ fontFamily:"'Amiri Quran',serif", fontSize:14, color:"var(--gold)", padding:"2px 6px",
                    background:"rgba(201,168,76,.08)", borderRadius:6, border:"1px solid rgba(201,168,76,.2)" }}>{si.name}</span>
                ) : null;
              })}
            </div>
          )}
          {/* Question types */}
          <div style={{ marginTop:4, display:"flex", flexDirection:"column", gap:4, alignItems:"center" }}>
            <div style={{ fontSize:8, letterSpacing:2, color:"var(--text3)" }}>TYPES DE QUESTIONS</div>
            {allTypesSelected ? (
              <div style={{ fontSize:8, color:"var(--teal)", letterSpacing:1, fontFamily:"'Cinzel',serif" }}>TOUS ({ALL_Q_TYPES.length})</div>
            ) : (
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", justifyContent:"center" }}>
                {[...selectedQTypes].map(t => (
                  <span key={t} style={{ fontSize:7, letterSpacing:1, padding:"2px 7px",
                    background:"rgba(62,184,160,.08)", border:"1px solid var(--teal)",
                    color:"var(--teal2)", borderRadius:10, fontFamily:"'Cinzel',serif" }}>
                    {TYPE_LABELS_SHORT[t] ?? t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize:8, color:"var(--text3)", letterSpacing:1, marginTop:2 }}>
            {randomize ? "ORDRE ALÉATOIRE" : "ORDRE SÉQUENTIEL"} · {skipCorrect ? "IGNORER CORRECTES" : "TOUTES LES QUESTIONS"}{onlyRevise ? " · 🔖 RÉVISION" : ""}
          </div>
        </div>
        <button onClick={() => {
          // In mono mode, strip types that only work in multi-surah sessions
          if (!isMulti) {
            const multiOnlyT = new Set(['find_surah','compare_verse']);
            const cleaned = new Set([...selectedQTypes].filter(t => !multiOnlyT.has(t)));
            if (cleaned.size === 0) cleaned.add('first_word'); // always keep at least one
            if (cleaned.size !== selectedQTypes.size) setSelectedQTypes(cleaned);
          }
          setStarted(true); setStage("session");
          if (!isMulti) qNavigate(`/revision/questions/${selectedSn}/${rangeFrom}/${rangeTo || (surahInfo2?.numberOfAyahs ?? 1)}/0`);
          else qNavigate("/revision/questions");
        }} style={{ padding:"13px", fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif",
          background:"rgba(201,168,76,.12)", border:"1px solid var(--gold)", color:"var(--gold2)",
          borderRadius:9, cursor:"pointer" }}>
          ▶ RELANCER LA SESSION
        </button>
        <button onClick={() => {
          clearPageSession();
          setSelectedSn(null); setRangeFrom("1"); setRangeTo(""); setMultiSns([]);
          setSelectedQTypes(new Set(ALL_Q_TYPES)); setRandomize(false);
          setStage("surah");
        }} style={{ padding:"10px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
          background:"transparent", border:"1px solid var(--border2)", color:"var(--text3)",
          borderRadius:9, cursor:"pointer" }}>
          ＋ NOUVELLE SESSION
        </button>
      </div>
    );
  }

  // ── Surah picker ──
  if (stage === "surah") {
    const toReviseSns = [...new Set(
      Object.entries(learnData)
        .filter(([, v]) => v?.toRevise)
        .map(([k]) => parseInt(k.split(':')[0]))
        .filter(sn => !isNaN(sn))
    )];
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12, padding:"20px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:9, letterSpacing:3, color:"var(--text3)" }}>CHOISIR UNE SOURATE</div>
          <button onClick={() => { setMultiSns([]); setStage("multi"); }}
            style={{ fontSize:8, letterSpacing:1, padding:"4px 12px", fontFamily:"'Cinzel',serif",
              background:"rgba(62,184,160,.08)", border:"1px solid var(--teal)", color:"var(--teal)", borderRadius:20, cursor:"pointer" }}>
            ＋ MULTI SOURATES
          </button>
        </div>
        {toReviseSns.length > 0 && (
          <button onClick={() => {
            setMultiSns(toReviseSns);
            // set multiRanges to only the toRevise ayats per surah
            const ranges = {};
            toReviseSns.forEach(sn => {
              const ans = Object.entries(learnData)
                .filter(([k, v]) => k.startsWith(sn+':') && v?.toRevise)
                .map(([k]) => parseInt(k.split(':')[1])).filter(n => !isNaN(n)).sort((a,b)=>a-b);
              if (ans.length) ranges[sn] = { from: String(ans[0]), to: String(ans[ans.length-1]) };
            });
            setMultiRanges(ranges);
            setStage("range");
          }}
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"12px 16px", borderRadius:10, cursor:"pointer",
              background:"rgba(201,168,76,.08)", border:"1px solid var(--gold)", color:"var(--gold2)" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:2, textAlign:"left" }}>
              <span style={{ fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif" }}>🔖 RÉVISER LES MARQUÉS</span>
              <span style={{ fontSize:7, letterSpacing:1, color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>
                {Object.values(learnData).filter(v=>v?.toRevise).length} AYAT{Object.values(learnData).filter(v=>v?.toRevise).length>1?'S':''} · {toReviseSns.length} SOURATE{toReviseSns.length>1?'S':''}
              </span>
            </div>
            <span style={{ fontSize:18 }}>→</span>
          </button>
        )}
        {availableSurahs.length === 0 && (
          <div style={{ fontSize:10, color:"var(--text3)", letterSpacing:1 }}>Aucune sourate apprise.</div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {availableSurahs.map(s => {
            const learned = Object.keys(learnData).filter(k => k.startsWith(s.number + ":") && learnData[k].learned).length;
            return (
              <button key={s.number} onClick={() => { setSelectedSn(s.number); setRangeFrom("1"); setRangeTo(""); setStage("range"); }}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"10px 14px", background:"var(--surface2)", border:"1px solid var(--border)",
                  borderRadius:8, cursor:"pointer", textAlign:"left" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  <span style={{ fontSize:9, letterSpacing:1, color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>{s.englishName.toUpperCase()}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:8, color:"var(--teal)", fontFamily:"'Cinzel',serif" }}>{learned} appris</span>
                  <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:18, color:"var(--gold)" }}>{s.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Multi-surah picker ──
  if (stage === "multi") {
    const learnedSns = availableSurahs.filter(s =>
      Object.keys(learnData).some(k => k.startsWith(s.number + ":") && learnData[k].learned)
    );
    const totalItems = multiItems?.length ?? 0;

    const getAyatQScoreForSn = (sn, an) => {
      const ld = learnData[`${sn}:${an}`] || {};
      const qs = ld.questionScores || {};
      const activeTypes = selectedQTypes instanceof Set ? selectedQTypes : new Set(ALL_Q_TYPES);
      const relevantKeys = Object.keys(qs).filter(k => {
        const parts = k.split(':'); if (parts.length < 3) return false;
        return activeTypes.has(parts.slice(2).join(':'));
      });
      if (relevantKeys.length === 0) return null;
      const lastScores = relevantKeys.map(k => { const arr = qs[k]; return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : 0; });
      if (lastScores.every(s => s === 1)) return 1;
      if (lastScores.some(s => s === 1)) return 0.5;
      return 0;
    };

    const setRange = (sn, field, val) =>
      setMultiRanges(prev => ({ ...prev, [sn]: { ...(prev[sn] || {}), [field]: val } }));

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12, padding:"20px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={() => setStage("surah")} style={{ fontSize:9, letterSpacing:1, padding:"4px 10px",
            fontFamily:"'Cinzel',serif", background:"transparent", border:"1px solid var(--border2)",
            color:"var(--text3)", borderRadius:6, cursor:"pointer" }}>←</button>
          <div style={{ fontSize:9, letterSpacing:3, color:"var(--text3)" }}>MULTI SOURATES</div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={() => setMultiSns(learnedSns.map(s => s.number))}
            style={{ fontSize:8, letterSpacing:1, padding:"3px 10px", borderRadius:20, cursor:"pointer",
              fontFamily:"'Cinzel',serif", border:"1px solid var(--teal)", background:"rgba(62,184,160,.08)", color:"var(--teal)" }}>TOUT</button>
          <button onClick={() => setMultiSns([])}
            style={{ fontSize:8, letterSpacing:1, padding:"3px 10px", borderRadius:20, cursor:"pointer",
              fontFamily:"'Cinzel',serif", border:"1px solid var(--border2)", background:"transparent", color:"var(--text3)" }}>AUCUN</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:"60vh", overflowY:"auto" }}>
          {learnedSns.map(s => {
            const on = multiSns.includes(s.number);
            const maxA = s.numberOfAyahs;
            const r = multiRanges[s.number] || {};
            const rfN = Math.max(1, parseInt(r.from) || 1);
            const rtN = Math.min(maxA, parseInt(r.to) || maxA);
            const learned = Object.keys(learnData).filter(k => k.startsWith(s.number + ":") && learnData[k].learned).length;
            return (
              <div key={s.number} style={{ borderRadius:10, border:"1px solid " + (on ? "var(--teal)" : "var(--border)"),
                background: on ? "rgba(62,184,160,.04)" : "var(--surface2)", overflow:"hidden" }}>
                {/* Header row */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"10px 14px", cursor:"pointer" }}
                  onClick={() => { setMultiSns(prev => on ? prev.filter(n => n !== s.number) : [...prev, s.number]); ensureQPageData(s.number); }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:16, height:16, borderRadius:4, flexShrink:0,
                      background: on ? "var(--teal)" : "transparent",
                      border:"1px solid " + (on ? "var(--teal)" : "var(--border2)"),
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:10, color:"var(--surface)" }}>{on ? "✓" : ""}</div>
                    <span style={{ fontSize:9, letterSpacing:1, color: on ? "var(--teal2)" : "var(--text3)", fontFamily:"'Cinzel',serif" }}>{s.englishName.toUpperCase()}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:8, color:"var(--teal)", fontFamily:"'Cinzel',serif" }}>{learned} appris</span>
                    <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:16, color:"var(--gold)" }}>{s.name}</span>
                  </div>
                </div>
                {/* Per-surah range + grid (only when selected) */}
                {on && (() => {
                  const pd = qPageData[s.number];
                  // Build by-page map
                  const byPage = {};
                  if (pd?.length) {
                    pd.forEach(({ numberInSurah: an, page }) => {
                      if (!byPage[page]) byPage[page] = [];
                      byPage[page].push(an);
                    });
                  } else {
                    byPage['…'] = Array.from({ length: maxA }, (_, i) => i + 1);
                  }
                  return (
                    <div style={{ borderTop:"1px solid var(--border)", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
                      {/* Compact inline grid with page badges */}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:2, alignItems:"center" }}>
                        {(() => {
                          const items = [];
                          if (pd?.length) {
                            let lastPage = null;
                            pd.forEach(({ numberInSurah: an, page }) => {
                              if (page !== lastPage) { items.push({ type:'badge', page }); lastPage = page; }
                              items.push({ type:'cell', an });
                            });
                          } else { Array.from({ length: maxA }, (_, i) => i+1).forEach(an => items.push({ type:'cell', an })); }
                          return items.map((item, i) => {
                            if (item.type === 'badge') return (
                              <span key={`p${item.page}-${i}`} style={{ fontSize:6, letterSpacing:1, color:'#c878ff',
                                fontFamily:"'Cinzel',serif", padding:'0 3px',
                                borderLeft: i > 0 ? '1px solid rgba(200,120,255,.2)' : 'none',
                                marginLeft: i > 0 ? 3 : 0, lineHeight:'18px' }}>P{item.page}</span>
                            );
                            const an = item.an;
                            const score = getAyatQScoreForSn(s.number, an);
                            const inRange = an >= rfN && an <= rtN;
                            const bg = score === null ? "var(--surface3)" : score >= 1 ? "rgba(76,175,129,.35)" : score >= 0.5 ? "rgba(201,168,76,.3)" : "rgba(229,115,115,.2)";
                            const borderCol = score === null ? "var(--border)" : score >= 1 ? "var(--green)" : score >= 0.5 ? "var(--gold)" : "var(--red)";
                            return (
                              <div key={an}
                                onClick={() => { const cur = multiRanges[s.number]||{}; const curFrom = parseInt(cur.from)||1; if(!cur.from||cur.to){setRange(s.number,'from',String(an));setRange(s.number,'to','');}else if(an<curFrom){setRange(s.number,'from',String(an));}else{setRange(s.number,'to',String(an));} }}
                                title={`${an}${score!==null?(score>=1?" ✓":score>0?" ~":" ✗"):""}`}
                                style={{ width:18, height:18, borderRadius:3, cursor:"pointer", fontSize:6,
                                  fontFamily:"'Cinzel',serif", display:"flex", alignItems:"center", justifyContent:"center",
                                  background: inRange ? bg.replace("var(--surface3)","rgba(201,168,76,.05)") : bg,
                                  border:`1px solid ${inRange?"rgba(201,168,76,.5)":borderCol}`,
                                  boxShadow: inRange ? "0 0 0 1px rgba(201,168,76,.2)" : "none",
                                  color: inRange ? "var(--gold2)" : score===null ? "var(--text3)" : score>=1 ? "var(--green)" : score>=0.5 ? "var(--gold)" : "var(--red)",
                                  transition:"all .1s" }}>
                                {an}
                              </div>
                            );
                          });
                        })()}
                      </div>
                      {/* Range inputs */}
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:7, color:"var(--text3)", letterSpacing:1 }}>DE</span>
                        <input type="number" min="1" max={maxA} value={r.from || ""} placeholder="1"
                          onChange={e => setRange(s.number, 'from', e.target.value)}
                          style={{ width:44, background:"var(--surface3)", border:"1px solid var(--border2)", borderRadius:5, padding:"4px 5px", color:"var(--text)", fontSize:11, fontFamily:"'Cinzel',serif", textAlign:"center", outline:"none" }} />
                        <span style={{ fontSize:7, color:"var(--text3)" }}>→</span>
                        <input type="number" min="1" max={maxA} value={r.to || ""} placeholder={String(maxA)}
                          onChange={e => setRange(s.number, 'to', e.target.value)}
                          style={{ width:44, background:"var(--surface3)", border:"1px solid var(--border2)", borderRadius:5, padding:"4px 5px", color:"var(--text)", fontSize:11, fontFamily:"'Cinzel',serif", textAlign:"center", outline:"none" }} />
                        <button onClick={() => setMultiRanges(prev => { const n={...prev}; delete n[s.number]; return n; })}
                          style={{ fontSize:7, letterSpacing:1, padding:"3px 7px", borderRadius:10, cursor:"pointer",
                            fontFamily:"'Cinzel',serif", border:"1px solid var(--border2)", background:"transparent", color:"var(--text3)" }}>RESET</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
        {multiSns.length > 0 && (
          <button onClick={() => setStage("range")}
            style={{ padding:"12px", fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:"rgba(201,168,76,.12)", border:"1px solid var(--gold)", color:"var(--gold2)",
              borderRadius:9, cursor:"pointer" }}>
            SUIVANT → ({totalItems} ayats)
          </button>
        )}
      </div>
    );
  }

  // ── Range + Type picker (combined) ──
  if (stage === "range") {
    const isMulti = multiSns.length > 0;

    // ── Multi mode: global plage + per-surah grid + types on one screen ──
    if (isMulti) {
      const TYPE_LABELS = {
        first_word:"Premier mot", last_word:"Dernier mot", missing_word:"Mot manquant",
        next_verse:"Verset suivant", previous_verse:"Verset précédent",
        verse_number:"Numéro du verset", find_ayat:"Trouver le verset",
        reconstruct:"Reconstituer", compare_verse:"Comparer sourates",
        find_surah:"Trouver la sourate", page_structure:"Structure de la page",
        revise_word:"🔖 Mot(s) à réviser", revise_part:"🔖 Partie à réviser",
        unknown_word:"Mot inconnu manquant", unknown_pick:"Identifier les mots inconnus",
      };
      const toggle = (t) => setSelectedQTypes(prev => {
        const next = new Set(prev);
        if (next.has(t)) { if (next.size > 1) next.delete(t); } else next.add(t);
        return next;
      });

      // Global plage: compute max ayat across all selected surahs
      const maxAyatGlobal = Math.max(...multiSns.map(sn => surahs.find(s => s.number === sn)?.numberOfAyahs ?? 1));
      const globalFrom = Math.max(1, parseInt(rangeFrom) || 1);
      const globalTo   = Math.min(maxAyatGlobal, parseInt(rangeTo) || maxAyatGlobal);

      // Sync multiRanges to global plage
      const applyGlobal = (f, t) => {
        const ranges = {};
        multiSns.forEach(sn => {
          const max = surahs.find(s => s.number === sn)?.numberOfAyahs ?? 1;
          ranges[sn] = { from: String(Math.max(1, f)), to: String(Math.min(max, t)) };
        });
        setMultiRanges(ranges);
      };

      const getAyatQScoreMulti = (sn, an) => {
        const ld = learnData[`${sn}:${an}`] || {};
        const qs = ld.questionScores || {};
        const activeTypes = selectedQTypes instanceof Set ? selectedQTypes : new Set(ALL_Q_TYPES);
        const keys = Object.keys(qs).filter(k => {
          const p = k.split(':'); if (p.length < 3) return false;
          return activeTypes.has(p.slice(2).join(':'));
        });
        if (!keys.length) return null;
        const last = keys.map(k => { const a = qs[k]; return Array.isArray(a) && a.length ? a[a.length-1] : 0; });
        if (last.every(s => s === 1)) return 1;
        if (last.some(s => s === 1))  return 0.5;
        return 0;
      };

      const totalItems = multiSns.reduce((acc, sn) => {
        const si = surahs.find(s => s.number === sn);
        const max = si?.numberOfAyahs ?? 1;
        const from = Math.max(1, parseInt(multiRanges[sn]?.from) || 1);
        const to   = Math.min(max, parseInt(multiRanges[sn]?.to) || max);
        return acc + (to - from + 1);
      }, 0);

      return (
        <div style={{ display:"flex", flexDirection:"column", gap:12, padding:"16px 0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => setStage("multi")} style={{ fontSize:9, letterSpacing:1, padding:"4px 10px",
              fontFamily:"'Cinzel',serif", background:"transparent", border:"1px solid var(--border2)",
              color:"var(--text3)", borderRadius:6, cursor:"pointer" }}>←</button>
            <div style={{ fontSize:9, letterSpacing:2, color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>
              {multiSns.length} SOURATE{multiSns.length > 1 ? "S" : ""}
            </div>
          </div>

          {/* Global plage */}
          <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:8, letterSpacing:2, color:"var(--text3)" }}>PLAGE (TOUTES LES SOURATES)</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:7, color:"var(--text3)", letterSpacing:1 }}>DE</span>
              <input type="number" min="1" max={maxAyatGlobal} value={rangeFrom} placeholder="1"
                onChange={e => { setRangeFrom(e.target.value); applyGlobal(parseInt(e.target.value)||1, globalTo); }}
                style={{ width:52, background:"var(--surface3)", border:"1px solid var(--border2)", borderRadius:5,
                  padding:"5px 6px", color:"var(--text)", fontSize:13, fontFamily:"'Cinzel',serif", textAlign:"center", outline:"none" }} />
              <span style={{ fontSize:7, color:"var(--text3)" }}>→</span>
              <input type="number" min="1" max={maxAyatGlobal} value={rangeTo} placeholder={String(maxAyatGlobal)}
                onChange={e => { setRangeTo(e.target.value); applyGlobal(globalFrom, parseInt(e.target.value)||maxAyatGlobal); }}
                style={{ width:52, background:"var(--surface3)", border:"1px solid var(--border2)", borderRadius:5,
                  padding:"5px 6px", color:"var(--text)", fontSize:13, fontFamily:"'Cinzel',serif", textAlign:"center", outline:"none" }} />
              <button onClick={() => { setRangeFrom("1"); setRangeTo(""); applyGlobal(1, maxAyatGlobal); }}
                style={{ fontSize:7, padding:"3px 8px", borderRadius:10, cursor:"pointer",
                  border:"1px solid var(--gold)", background:"rgba(201,168,76,.08)", color:"var(--gold)",
                  fontFamily:"'Cinzel',serif", letterSpacing:1 }}>TOUT</button>
            </div>

            {/* Per-surah ayat grids — grouped by page */}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {multiSns.map(sn => {
                const si = surahs.find(s => s.number === sn);
                const max = si?.numberOfAyahs ?? 1;
                const from = Math.max(1, parseInt(multiRanges[sn]?.from) || 1);
                const to   = Math.min(max, parseInt(multiRanges[sn]?.to) || max);
                const pd   = qPageData[sn];
                // group by page
                const byPage = {};
                if (pd?.length) {
                  pd.forEach(({ numberInSurah: an, page }) => { if (!byPage[page]) byPage[page] = []; byPage[page].push(an); });
                } else {
                  byPage['…'] = Array.from({ length: max }, (_, i) => i + 1);
                  ensureQPageData(sn);
                }
                return (
                  <div key={sn}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:7, color:"var(--text3)", letterSpacing:1, fontFamily:"'Cinzel',serif" }}>{si?.englishName.toUpperCase()}</span>
                      <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:13, color:"var(--gold)", direction:"rtl" }}>{si?.name}</span>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:2, alignItems:"center" }}>
                      {(() => {
                        const items = [];
                        if (pd?.length) {
                          let lastPage = null;
                          pd.forEach(({ numberInSurah: an, page }) => {
                            if (page !== lastPage) { items.push({ type:'badge', page }); lastPage = page; }
                            items.push({ type:'cell', an });
                          });
                        } else { Array.from({ length: max }, (_, i) => i+1).forEach(an => items.push({ type:'cell', an })); }
                        return items.map((item, i) => {
                          if (item.type === 'badge') return (
                            <span key={`p${item.page}-${i}`} style={{ fontSize:6, letterSpacing:1, color:'#c878ff',
                              fontFamily:"'Cinzel',serif", padding:'0 3px',
                              borderLeft: i > 0 ? '1px solid rgba(200,120,255,.2)' : 'none',
                              marginLeft: i > 0 ? 3 : 0, lineHeight:'16px' }}>P{item.page}</span>
                          );
                          const an = item.an;
                          const inRange  = an >= from && an <= to;
                          const ldEntry  = learnData[`${sn}:${an}`] || {};
                          const isRevise = !!ldEntry.toRevise;
                          return (
                            <div key={an} style={{ width:16, height:16, borderRadius:3, fontSize:6, cursor:"default",
                              display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif",
                              background: isRevise ? "rgba(201,168,76,.18)" : "var(--surface3)",
                              border:`1px solid ${isRevise ? "var(--gold)" : inRange ? "rgba(255,255,255,.15)" : "var(--border)"}`,
                              color: isRevise ? "var(--gold)" : inRange ? "var(--text2)" : "var(--text3)",
                              fontWeight: isRevise ? 700 : 400,
                              boxShadow: isRevise ? "0 0 5px rgba(201,168,76,.3)" : "none" }}>
                              {an}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Types */}
          <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, padding:"12px 14px", display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2 }}>
              <div style={{ fontSize:8, letterSpacing:2, color:"var(--text3)" }}>TYPES DE QUESTIONS</div>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={() => setSelectedQTypes(new Set(ALL_Q_TYPES))}
                  style={{ fontSize:7, letterSpacing:1, padding:"2px 7px", borderRadius:20, cursor:"pointer",
                    fontFamily:"'Cinzel',serif", border:"1px solid var(--teal)", background:"rgba(62,184,160,.08)", color:"var(--teal)" }}>TOUT</button>
                <button onClick={() => setSelectedQTypes(new Set(["compare_verse"]))}
                  style={{ fontSize:7, letterSpacing:1, padding:"2px 7px", borderRadius:20, cursor:"pointer",
                    fontFamily:"'Cinzel',serif", border:"1px solid var(--border2)", background:"transparent", color:"var(--text3)" }}>AUCUN</button>
              </div>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
              {ALL_Q_TYPES.map(t => {
                const on = selectedQTypes.has(t);
                return (
                  <button key={t} onClick={() => toggle(t)}
                    style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 8px",
                      background: on ? "rgba(62,184,160,.10)" : "var(--surface3)",
                      border:"1px solid " + (on ? "var(--teal)" : "var(--border2)"),
                      borderRadius:6, cursor:"pointer", transition:"all .15s" }}>
                    <div style={{ width:12, height:12, borderRadius:3, flexShrink:0,
                      background: on ? "var(--teal)" : "transparent",
                      border:"1px solid " + (on ? "var(--teal)" : "var(--border2)"),
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:8, color:"var(--surface)" }}>{on ? "✓" : ""}</div>
                    <span style={{ fontSize:7, letterSpacing:.5, fontFamily:"'Cinzel',serif",
                      color: on ? "var(--teal2)" : "var(--text3)" }}>{TYPE_LABELS[t]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options + Launch */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
              fontSize:9, letterSpacing:1, color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>
              <input type="checkbox" checked={randomize} onChange={e => setRandomize(e.target.checked)}
                style={{ accentColor:"var(--teal)", width:14, height:14 }} />
              ORDRE ALÉATOIRE
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
              fontSize:9, letterSpacing:1, color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>
              <input type="checkbox" checked={skipCorrect} onChange={e => setSkipCorrect(e.target.checked)}
                style={{ accentColor:"var(--gold)", width:14, height:14 }} />
              IGNORER LES DÉJÀ CORRECTES
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
              fontSize:9, letterSpacing:1, color: onlyRevise ? "var(--gold2)" : "var(--text3)", fontFamily:"'Cinzel',serif" }}>
              <input type="checkbox" checked={onlyRevise} onChange={e => setOnlyRevise(e.target.checked)}
                style={{ accentColor:"var(--gold)", width:14, height:14 }} />
              🔖 UNIQUEMENT À RÉVISER{onlyRevise ? ` (${(multiItems||[]).filter(({sn,ayatNum})=>learnData[`${sn}:${ayatNum}`]?.toRevise).length})` : ""}
            </label>
            <button onClick={() => { setStarted(true); setStage("session"); qNavigate("/revision/questions"); }}
              disabled={(multiItems?.length ?? 0) === 0}
              style={{ padding:"12px", fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif",
                background: (multiItems?.length ?? 0) > 0 ? "rgba(201,168,76,.12)" : "var(--surface3)",
                border:`1px solid ${(multiItems?.length ?? 0) > 0 ? "var(--gold)" : "var(--border2)"}`,
                color: (multiItems?.length ?? 0) > 0 ? "var(--gold2)" : "var(--text3)",
                borderRadius:9, cursor: (multiItems?.length ?? 0) > 0 ? "pointer" : "default", marginTop:4 }}>
              ❓ LANCER {(multiItems?.length ?? 0) > 0 ? `(${new Set(multiItems.map(i=>`${i.sn}:${i.ayatNum}`)).size} AYAT${multiItems.length > 1 ? 'S' : ''})` : "(AUCUN AYAT APPRIS DANS LA PLAGE)"}
            </button>
          </div>
        </div>
      );
    }

    const rfN = Math.max(1, parseInt(rangeFrom) || 1);
    const rtN = Math.min(maxAyat, parseInt(rangeTo) || maxAyat);

    const getAyatQScore = (an) => {
      const ld = learnData[`${selectedSn}:${an}`] || {};
      const qs = ld.questionScores || {};
      const activeTypes = selectedQTypes instanceof Set ? selectedQTypes : new Set(ALL_Q_TYPES);
      const relevantKeys = Object.keys(qs).filter(k => {
        const parts = k.split(':');
        if (parts.length < 3) return false;
        const type = parts.slice(2).join(':');
        return activeTypes.has(type);
      });
      if (relevantKeys.length === 0) return null;
      const lastScores = relevantKeys.map(k => { const arr = qs[k]; return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : 0; });
      if (lastScores.every(s => s === 1)) return 1;
      if (lastScores.some(s => s === 1)) return 0.5;
      if (lastScores.every(s => s === 0)) return 0;
      return 0.5;
    };

    const handleDotClick = (an) => {
      if (clickPhase === "from") {
        setRangeFrom(String(an)); setRangeTo(""); setClickPhase("to");
      } else {
        if (an < rfN) { setRangeFrom(String(an)); setClickPhase("to"); }
        else { setRangeTo(String(an)); setClickPhase("from"); }
      }
    };

    const TYPE_LABELS = {
      first_word:"Premier mot", last_word:"Dernier mot", missing_word:"Mot manquant",
      next_verse:"Verset suivant", previous_verse:"Verset précédent",
      verse_number:"Numéro du verset", find_ayat:"Trouver le verset",
      reconstruct:"Reconstituer", compare_verse:"Comparer sourates",
      find_surah:"Trouver la sourate",
        unknown_word:"Mot inconnu manquant", unknown_pick:"Identifier les mots inconnus",
    };
    const toggle = (t) => setSelectedQTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) { if (next.size > 1) next.delete(t); } else next.add(t);
      return next;
    });

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14, padding:"20px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={() => setStage(multiSns.length > 0 ? "multi" : "surah")} style={{ fontSize:9, letterSpacing:1, padding:"4px 10px",
            fontFamily:"'Cinzel',serif", background:"transparent", border:"1px solid var(--border2)",
            color:"var(--text3)", borderRadius:6, cursor:"pointer" }}>←</button>
          <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:20, color:"var(--gold)", direction:"rtl" }}>{multiSns.length > 0 ? `${multiSns.length} sourates` : surahInfo?.name}</span>
          <span style={{ fontSize:9, color:"var(--text3)", letterSpacing:1 }}>{multiSns.length > 0 ? `${multiItems?.length ?? 0} ayats` : `${maxAyat} VERSETS`}</span>
        </div>

        {/* Ayat progress grid — grouped by page */}
        <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
          <div onClick={() => setShowAvancement(v => !v)}
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", cursor:"pointer" }}>
            <div style={{ fontSize:8, letterSpacing:2, color:"var(--text3)" }}>AVANCEMENT</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {showAvancement && <div style={{ fontSize:8, color:"var(--text3)", letterSpacing:1 }}>
                {clickPhase === "from" ? "CLIQUER : DÉBUT" : `DÉBUT ${rfN} — CLIQUER : FIN`}
              </div>}
              <span style={{ fontSize:9, color:"var(--text3)" }}>{showAvancement ? '▲' : '▼'}</span>
            </div>
          </div>
          {showAvancement && (
            <div style={{ padding:"0 14px 14px" }}>
              {(() => {
                const pd = qPageData[selectedSn];
                if (!pd) { ensureQPageData(selectedSn); }
                const items = [];
                if (pd?.length) {
                  let lastPage = null;
                  pd.forEach(({ numberInSurah: an, page }) => {
                    if (page !== lastPage) { items.push({ type:'badge', page }); lastPage = page; }
                    items.push({ type:'cell', an });
                  });
                } else { Array.from({ length: maxAyat }, (_, i) => i+1).forEach(an => items.push({ type:'cell', an })); }
                return (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3, alignItems:'center' }}>
                    {items.map((item, i) => {
                      if (item.type === 'badge') return (
                        <span key={`p${item.page}-${i}`} style={{ fontSize:6, letterSpacing:1, color:'#c878ff',
                          fontFamily:"'Cinzel',serif", padding:'0 3px',
                          borderLeft: i > 0 ? '1px solid rgba(200,120,255,.2)' : 'none',
                          marginLeft: i > 0 ? 3 : 0, lineHeight:'20px' }}>P{item.page}</span>
                      );
                      const an = item.an;
                      const score = getAyatQScore(an); const inRange = an>=rfN&&an<=rtN; const isFrom=an===rfN; const isTo=an===rtN;
                      const ldEntry  = learnData[`${selectedSn}:${an}`] || {};
                      const isRevise = !!ldEntry.toRevise;
                      return (
                        <div key={an} onClick={e=>{e.stopPropagation();handleDotClick(an);}}
                          title={`${an}${isRevise?' 🔖':''}${score===null?'':`  ${score>=1?"✓":score>0?"~":"✗"}`}`}
                          style={{ width:20,height:20,borderRadius:4,cursor:"pointer",
                            background: isRevise ? "rgba(201,168,76,.18)" : "var(--surface3)",
                            border:`1px solid ${isFrom||isTo ? "var(--gold2)" : isRevise ? "var(--gold)" : inRange ? "rgba(255,255,255,.15)" : "var(--border)"}`,
                            boxShadow: isRevise ? "0 0 6px rgba(201,168,76,.35)" : isFrom||isTo ? "0 0 0 2px var(--gold)" : "none",
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:7, color: isRevise ? "var(--gold)" : inRange ? "var(--text2)" : "var(--text3)",
                            fontWeight: isRevise ? 700 : 400,
                            fontFamily:"'Cinzel',serif",transition:"all .1s" }}>
                          {an}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{ display:"flex", gap:10, marginTop:8, flexWrap:"wrap" }}>
                {[
                  { color:"var(--gold)",    bg:"rgba(201,168,76,.18)", label:"🔖 À réviser" },
                  { color:"rgba(201,168,76,.5)", bg:"var(--surface3)", label:"Dans la plage" },
                  { color:"var(--border)",  bg:"var(--surface3)",      label:"Non sélectionné" },
                ].map(({ color, bg, label }) => (
                  <div key={label} style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:bg, border:`1px solid ${color}` }} />
                    <span style={{ fontSize:7, color:"var(--text3)", letterSpacing:.5 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Range + Types side by side */}
        <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>

          {/* Plage */}
          <div style={{ flex:"0 0 auto", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden" }}>
            <div onClick={() => setShowPlage(v => !v)}
              style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", cursor:"pointer" }}>
              <div style={{ fontSize:8, letterSpacing:2, color:"var(--text3)" }}>PLAGE</div>
              <span style={{ fontSize:9, color:"var(--text3)" }}>{showPlage ? '▲' : '▼'}</span>
            </div>
            {showPlage && (
            <div style={{ padding:"0 16px 16px", display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"center" }}>
                <span style={{ fontSize:7, letterSpacing:1, color:"var(--text3)" }}>DE</span>
                <input type="number" min="1" max={maxAyat} value={rangeFrom} onChange={e => { setRangeFrom(e.target.value); setClickPhase("to"); }}
                  style={{ width:52, background:"var(--surface3)", border:"1px solid var(--border2)", borderRadius:6, padding:"5px 6px", color:"var(--text)", fontSize:13, fontFamily:"'Cinzel',serif", textAlign:"center", outline:"none" }} />
              </div>
              <span style={{ color:"var(--text3)", marginTop:12 }}>→</span>
              <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"center" }}>
                <span style={{ fontSize:7, letterSpacing:1, color:"var(--text3)" }}>JUSQU'À</span>
                <input type="number" min="1" max={maxAyat} value={rangeTo} placeholder={String(maxAyat)} onChange={e => { setRangeTo(e.target.value); setClickPhase("from"); }}
                  style={{ width:52, background:"var(--surface3)", border:"1px solid var(--border2)", borderRadius:6, padding:"5px 6px", color:"var(--text)", fontSize:13, fontFamily:"'Cinzel',serif", textAlign:"center", outline:"none" }} />
              </div>
            </div>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {[5,10,20].map(n => (
                <button key={n} onClick={() => { setRangeFrom("1"); setRangeTo(String(Math.min(n, maxAyat))); setClickPhase("from"); }}
                  style={{ fontSize:7, letterSpacing:1, padding:"3px 7px", borderRadius:20, cursor:"pointer", fontFamily:"'Cinzel',serif",
                    border:"1px solid var(--border2)", background:"transparent", color:"var(--text3)" }}>
                  1→{Math.min(n, maxAyat)}
                </button>
              ))}
              <button onClick={() => { setRangeFrom("1"); setRangeTo(String(maxAyat)); setClickPhase("from"); }}
                style={{ fontSize:7, letterSpacing:1, padding:"3px 7px", borderRadius:20, cursor:"pointer", fontFamily:"'Cinzel',serif",
                  border:"1px solid var(--gold)", background:"rgba(201,168,76,.08)", color:"var(--gold)" }}>TOUS</button>
            </div>
            </div>
            )}
          </div>

          {/* Types */}
          <div style={{ flex:1, background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, padding:"16px", display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:8, letterSpacing:2, color:"var(--text3)" }}>TYPES</div>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={() => setSelectedQTypes(new Set(ALL_Q_TYPES))}
                  style={{ fontSize:7, letterSpacing:1, padding:"2px 7px", borderRadius:20, cursor:"pointer",
                    fontFamily:"'Cinzel',serif", border:"1px solid var(--teal)", background:"rgba(62,184,160,.08)", color:"var(--teal)" }}>TOUT</button>
                <button onClick={() => setSelectedQTypes(new Set(["reconstruct"]))}
                  style={{ fontSize:7, letterSpacing:1, padding:"2px 7px", borderRadius:20, cursor:"pointer",
                    fontFamily:"'Cinzel',serif", border:"1px solid var(--border2)", background:"transparent", color:"var(--text3)" }}>AUCUN</button>
              </div>
            </div>
            {ALL_Q_TYPES.map(t => {
              const on = selectedQTypes.has(t);
              // find_surah and compare_verse only work in multi-surah mode
              const multiOnly = t === 'find_surah' || t === 'compare_verse';
              const needsUnknown = t === 'unknown_word' || t === 'unknown_pick';
              // disable unknown types if no ayat in range has unknownWords
              const hasAnyUnknown = (ayatList||[]).some(an => (learnData[`${selectedSn}:${an}`]?.unknownWords||[]).length > 0);
              const disabled  = multiOnly || (needsUnknown && !hasAnyUnknown); // disabled in mono mode
              return (
                <button key={t} onClick={() => !disabled && toggle(t)}
                  title={disabled ? 'Disponible en mode multi-sourates uniquement' : undefined}
                  style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 10px",
                    background: disabled ? "var(--surface2)" : on ? "rgba(62,184,160,.10)" : "var(--surface3)",
                    border:"1px solid " + (disabled ? "var(--border)" : on ? "var(--teal)" : "var(--border2)"),
                    borderRadius:7, cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? .38 : 1,
                    transition:"all .15s", textAlign:"left" }}>
                  <div style={{ width:14, height:14, borderRadius:4, flexShrink:0,
                    background: on && !disabled ? "var(--teal)" : "transparent",
                    border:"1px solid " + (on && !disabled ? "var(--teal)" : "var(--border2)"),
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:9, color:"var(--surface)" }}>
                    {on && !disabled ? "✓" : ""}
                  </div>
                  <span style={{ fontSize:8, letterSpacing:.5, fontFamily:"'Cinzel',serif",
                    color: on && !disabled ? "var(--teal2)" : "var(--text3)" }}>{TYPE_LABELS[t]}
                    {disabled && <span style={{fontSize:6,color:'var(--text3)',marginLeft:4}}>MULTI</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Options + Launch */}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
            fontSize:9, letterSpacing:1, color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>
            <input type="checkbox" checked={randomize} onChange={e => setRandomize(e.target.checked)}
              style={{ accentColor:"var(--teal)", width:14, height:14 }} />
            ORDRE ALÉATOIRE
          </label>
          <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
            fontSize:9, letterSpacing:1, color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>
            <input type="checkbox" checked={skipCorrect} onChange={e => setSkipCorrect(e.target.checked)}
              style={{ accentColor:"var(--gold)", width:14, height:14 }} />
            IGNORER LES DÉJÀ CORRECTES
          </label>
          <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
            fontSize:9, letterSpacing:1, color: onlyRevise ? "var(--gold2)" : "var(--text3)", fontFamily:"'Cinzel',serif" }}>
            <input type="checkbox" checked={onlyRevise} onChange={e => setOnlyRevise(e.target.checked)}
              style={{ accentColor:"var(--gold)", width:14, height:14 }} />
            🔖 UNIQUEMENT À RÉVISER{onlyRevise ? ` (${ayatList.filter(an => learnData[`${selectedSn}:${an}`]?.toRevise).length})` : ""}
          </label>
          <button onClick={() => {
            setStarted(true); setStage("session");
            if (multiSns.length > 0) qNavigate("/revision/questions");
            else qNavigate(`/revision/questions/${selectedSn}/${rangeFrom}/${rangeTo || maxAyat}/0`);
          }}
            style={{ padding:"12px", fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:"rgba(201,168,76,.12)", border:"1px solid var(--gold)", color:"var(--gold2)",
              borderRadius:9, cursor:"pointer", marginTop:4 }}>
            {(() => {
              const learnedInRange = ayatList.filter(an => learnData[`${selectedSn}:${an}`]?.learned);
              const toReviseInRange = learnedInRange.filter(an => learnData[`${selectedSn}:${an}`]?.toRevise);
              const uniqueAyats = onlyRevise ? toReviseInRange : learnedInRange;
              const count = uniqueAyats.length;
              return `❓ LANCER (${count} AYAT${count > 1 ? 'S' : ''})`;
            })()}
          </button>
        </div>
      </div>
    );
  }

  // ── Type picker (kept as no-op redirect for back-compat) ──
  if (stage === "types") { setStage("range"); return null; }


  // ── Active session ──
  if (stage === "session" || started) {
    const isMulti = multiSns.length > 0;
    const mergedTexts = isMulti ? { ...ayatTexts, ...multiTexts } : ayatTexts;
    const filteredAyatList  = onlyRevise ? ayatList.filter(an => learnData[`${selectedSn}:${an}`]?.toRevise) : ayatList;
    const filteredMultiItems = onlyRevise ? (multiItems||[]).filter(({sn,ayatNum}) => learnData[`${sn}:${ayatNum}`]?.toRevise) : multiItems;
    return (
      <QuestionsMode
        selectedSn={isMulti ? null : selectedSn}
        ayatList={isMulti ? [] : (filteredAyatList.length ? filteredAyatList : ayatList)}
        multiItems={isMulti ? (filteredMultiItems?.length ? filteredMultiItems : multiItems) : undefined}
        surahs={surahs}
        learnData={learnData}
        setLData={setLData}
        ayatTexts={mergedTexts}
        randomize={randomize}
        selectedQTypes={selectedQTypes}
        initialQIdx={initialQIdx || 0}
        onQIdxChange={isMulti ? undefined : (qi) => qNavigate(`/revision/questions/${selectedSn}/${rangeFrom}/${rangeTo || maxAyat}/${qi}`, { replace: true })}
        onDone={() => { setStarted(false); setStage("resume"); qNavigate("/revision/questions"); }}
        skipCorrect={skipCorrect}
      />
    );
  }
}
