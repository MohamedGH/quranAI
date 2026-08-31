import { useNavigate } from "react-router-dom";
import { masteryColor } from "../common/Mastery.jsx";
import { fetchSurahDefault, getAudioBase, fetchAyahMeta } from "../../utils/reciterAudio.js";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";
import { splitArabicWords, splitArabicClusters } from "../../utils/arabicUtils.js";
import { ArabicHighlighted } from "../common/ArabicHighlighted.jsx";
import { MasteryBar, MasteryBadge, MasteryDebug, computeMastery } from "../common/Mastery.jsx";

export function MemoriseMode({ surahs, learnData, setLData, initialSurahNum, initialRangeFrom, initialRangeTo }) {
  // ── Persistence helpers ──
  const MEM_KEY = 'quran_memorise_session';
  const loadSession = () => { try { return JSON.parse(localStorage.getItem(MEM_KEY)) || {}; } catch { return {}; } };
  const saveSession = (data) => { try { localStorage.setItem(MEM_KEY, JSON.stringify(data)); } catch {} };

  const saved = React.useMemo(() => {
    // URL params take priority over saved session
    if (initialSurahNum) return {};
    return loadSession();
  }, []);

  // ── ALL HOOKS FIRST (Rules of Hooks) ──
  const [selectedSn,  setSelectedSn]  = React.useState(initialSurahNum ?? saved.selectedSn  ?? null);
  const [rangeFrom,   setRangeFrom]   = React.useState(initialRangeFrom ?? saved.rangeFrom   ?? "1");
  const [rangeTo,     setRangeTo]     = React.useState(initialRangeTo ?? saved.rangeTo     ?? "");
  const [started,     setStarted]     = React.useState(initialSurahNum ? false : (saved.started ?? false));
  const [idx,         setIdx]         = React.useState(saved.idx         ?? 0);
  const [results,     setResults]     = React.useState(saved.results     ?? []);
  const [step,        setStep]        = React.useState(saved.step        ?? "sens");
  const [ayatTexts,   setAyatTexts]   = React.useState({});
  const [showVerset,  setShowVerset]  = React.useState(false);
  const [showMemo,    setShowMemo]    = React.useState(false);
  const [showInfos,   setShowInfos]   = React.useState(false);
    const [showScore, setShowScore] = React.useState(false);

  const [subMode,     setSubMode]     = React.useState("memorise"); // "memorise" | "multi"
  const [multiSns,    setMultiSns]    = React.useState([]); // selected surah numbers for multi mode
  const [multiList,   setMultiList]   = React.useState([]); // flat list of {sn, ayatNum} for multi session
  const [multiTexts,  setMultiTexts]  = React.useState({});
  const [pickerTextCache, setPickerTextCache] = React.useState({}); // sn → { an: text } — feeds mastery in "CHOISIR UNE SOURATE"
  const memNavigate = useNavigate();

  // Ayat text lookup used for mastery calc (falls back across the two caches this component maintains)
  const getAyatText = React.useCallback((sn, an) =>
    ayatTexts[`${sn}:${an}`] ?? pickerTextCache[sn]?.[an],
  [ayatTexts, pickerTextCache]);

  const availableSurahs = React.useMemo(() =>
    surahs.filter(s => s.numberOfAyahs > 0).sort((a,b) => a.number - b.number),
  [surahs]);

  const ayatList = React.useMemo(() => {
    if (!started || !selectedSn) return [];
    const si = surahs.find(s => s.number === selectedSn);
    const maxN = si?.numberOfAyahs ?? 1;
    const from = Math.max(1, parseInt(rangeFrom) || 1);
    const to   = Math.min(maxN, parseInt(rangeTo) || maxN);
    const arr = []; for (let i = from; i <= to; i++) arr.push(i);
    return arr;
  }, [started, selectedSn, surahs, rangeFrom, rangeTo]);

  React.useEffect(() => {
    saveSession({ selectedSn, rangeFrom, rangeTo, started, idx, results, step });
  }, [selectedSn, rangeFrom, rangeTo, started, idx, results, step]);

  React.useEffect(() => {
    if (!selectedSn) return;
    const k = String(selectedSn);
    if (ayatTexts[k]) return;
    fetchSurahDefault(selectedSn)
      .then(ayahs => {
        if (!ayahs?.length) return;
        const m = {};
        ayahs.forEach(a => {
          m[`${selectedSn}:${a.numberInSurah}`] = a.text;
          m[`num:${selectedSn}:${a.numberInSurah}`] = a.number;
        });
        setAyatTexts(p => ({ ...p, ...m, [k]: true }));
      }).catch(() => {});
  }, [selectedSn]);

  // Lazily fetch ayat text for every surah that has learnData, so the "CHOISIR UNE SOURATE"
  // picker (and any other unopened-surah mastery %) accounts for toRevise instead of showing 0.
  React.useEffect(() => {
    const sns = new Set();
    Object.keys(learnData).forEach(k => {
      const sn = parseInt(k.slice(0, k.indexOf(':')));
      if (!isNaN(sn)) sns.add(sn);
    });
    const toFetch = [...sns].filter(sn => !ayatTexts[String(sn)] && !pickerTextCache[sn]);
    if (toFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const sn of toFetch) {
        try {
          const ayahs = await fetchSurahDefault(sn);
          if (cancelled) return;
          const map = {};
          (ayahs || []).forEach(a => { map[a.numberInSurah] = a.text; });
          setPickerTextCache(c => c[sn] ? c : { ...c, [sn]: map });
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [learnData]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    setShowVerset(false); setShowMemo(false); setShowInfos(false); setShowScore(false);
  }, [idx]);

  // Load texts for all multi-mode surahs
  React.useEffect(() => {
    if (subMode !== "multi") return;
    multiSns.forEach(sn => {
      const k = String(sn);
      if (multiTexts[k]) return;
      fetchSurahDefault(sn).then(ayahs => {
        if (!ayahs?.length) return;
        const m = {};
        ayahs.forEach(a => { m[`${sn}:${a.numberInSurah}`] = a.text; });
        setMultiTexts(p => ({ ...p, ...m, [k]: true }));
      }).catch(() => {});
    });
  }, [subMode, multiSns]);

  // ── Derived values ──
  const surahInfo = surahs.find(s => s.number === selectedSn);
  const maxAyat   = surahInfo?.numberOfAyahs ?? 1;
  const current   = ayatList[idx] ?? null;
  const done      = started && idx >= ayatList.length && ayatList.length > 0;
  const ld        = learnData[`${selectedSn}:${current}`] || {};
  const ayatText      = ayatTexts[`${selectedSn}:${current}`] || "";
  const ayatGlobalNum = ayatTexts[`num:${selectedSn}:${current}`] || null;
  const bestScore = ld.memScores?.length > 0 ? Math.max(...ld.memScores) : null;

  // Surah-level mastery (all ayats in range)
  const surahMastery = React.useMemo(() => {
    if (!selectedSn || ayatList.length === 0) return null;
    const vals = ayatList.map(n => computeMastery(learnData[`${selectedSn}:${n}`] || {}, getAyatText(selectedSn, n)));
    return Math.round(vals.reduce((a,b) => a+b, 0) / vals.length);
  }, [selectedSn, ayatList, learnData, getAyatText]);

  const STEPS = [
    { id:"sens",   label:"Je me souviens du SENS",      sub:"Résumé / thème du verset" },
    { id:"mots",   label:"Je me souviens des MOTS",     sub:"Quelques mots clés" },
    { id:"partie", label:"Je me souviens d'une PARTIE", sub:"Un ou plusieurs segments" },
    { id:"entier", label:"Je récite l'AYAT ENTIER",    sub:"De mémoire, sans aide" },
  ];
  const stepIdx = STEPS.findIndex(s => s.id === step);

  const restart = () => { setIdx(0); setResults([]); setStep("sens"); };
  const back    = () => { setStarted(false); setIdx(0); setResults([]); setStep("sens"); saveSession({}); memNavigate(`/revision/memorise/${selectedSn}`); };
  const nextAyat = (score) => {
    // Persist memScore to learnData
    if (selectedSn && current !== null && setLData) {
      setLData(selectedSn, current, d => ({
        ...d, memScores: [...(d.memScores || []).slice(-9), score]
      }));
    }
    setResults(r => [...r, { ayatNum: current, score }]);
    setStep("sens"); setIdx(i => i + 1);
  };

  const toggleBtn = (active, label, onClick) => (
    <button onClick={onClick} style={{ fontSize:8, letterSpacing:1, padding:"4px 11px", borderRadius:20, cursor:"pointer",
      fontFamily:"'Cinzel',serif", border:"1px solid " + (active ? "var(--gold)" : "var(--border2)"),
      background: active ? "rgba(201,168,76,.1)" : "transparent",
      color: active ? "var(--gold2)" : "var(--text3)", transition:"all .15s" }}>
      {label}
    </button>
  );

  // ── Multi-surah mode ──────────────────────────────────────────────────────
  if (subMode === "multi" && !started) {
    const learnedSns = availableSurahs.filter(s =>
      Object.keys(learnData).some(k => k.startsWith(s.number + ":") && learnData[k].learned)
    );
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14, padding:"16px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <button onClick={() => { setSubMode("memorise"); setSelectedSn(null); }}
            style={{ fontSize:8, letterSpacing:1.5, padding:"4px 10px", borderRadius:6, cursor:"pointer",
              background:"none", border:"1px solid var(--border2)", color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>← RETOUR</button>
          <div style={{ fontSize:9, letterSpacing:3, color:"var(--gold)" }}>QUESTIONS MULTI-SOURATES</div>
        </div>
        <div style={{ fontSize:8, color:"var(--text3)", letterSpacing:.5 }}>
          Sélectionnez les sourates à inclure dans la session de questions
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:4 }}>
          <button onClick={() => setMultiSns(learnedSns.map(s => s.number))}
            style={{ fontSize:8, letterSpacing:1.5, padding:"4px 12px", borderRadius:6, cursor:"pointer",
              background:"rgba(201,168,76,.1)", border:"1px solid var(--gold)", color:"var(--gold2)", fontFamily:"'Cinzel',serif" }}>
            ✓ TOUTES LES APPRISES ({learnedSns.length})
          </button>
          <button onClick={() => setMultiSns([])}
            style={{ fontSize:8, letterSpacing:1.5, padding:"4px 12px", borderRadius:6, cursor:"pointer",
              background:"none", border:"1px solid var(--border2)", color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>
            DÉSÉLECTIONNER
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:6 }}>
          {learnedSns.map(s => {
            const sel = multiSns.includes(s.number);
            const learned = Object.keys(learnData).filter(k => k.startsWith(s.number+":") && learnData[k].learned).length;
            return (
              <button key={s.number} onClick={() => setMultiSns(p => sel ? p.filter(n => n !== s.number) : [...p, s.number])}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
                  background: sel ? "rgba(201,168,76,.1)" : "var(--surface2)",
                  border:`1px solid ${sel ? "var(--gold)" : "var(--border)"}`,
                  borderRadius:8, cursor:"pointer", textAlign:"left", fontFamily:"'Cinzel',serif" }}>
                <div style={{ width:16, height:16, borderRadius:4, flexShrink:0,
                  border:`2px solid ${sel ? "var(--gold)" : "var(--border2)"}`,
                  background: sel ? "var(--gold)" : "transparent",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>
                  {sel ? "✓" : ""}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:8, letterSpacing:1, color:"var(--text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {s.number}. {s.englishName}
                  </div>
                  <div style={{ fontSize:7, color:"var(--text3)", marginTop:2 }}>{learned} appris</div>
                </div>
              </button>
            );
          })}
        </div>
        {multiSns.length > 0 && (
          <button onClick={() => {
            // Build shuffled list of learned ayats from selected surahs
            const pool = [];
            for (const sn of multiSns) {
              const si = availableSurahs.find(s => s.number === sn);
              if (!si) continue;
              for (let i = 1; i <= si.numberOfAyahs; i++) {
                if (learnData[`${sn}:${i}`]?.learned) pool.push({ sn, ayatNum: i });
              }
            }
            // Shuffle
            for (let i = pool.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            setMultiList(pool);
            setIdx(0); setResults([]); setStep("sens");
            setStarted(true);
          }}
            style={{ padding:"11px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:"rgba(201,168,76,.12)", border:"1px solid var(--gold)", color:"var(--gold2)",
              borderRadius:8, cursor:"pointer" }}>
            ▶ DÉMARRER ({multiSns.reduce((t, sn) => t + Object.keys(learnData).filter(k => k.startsWith(sn+":") && learnData[k].learned).length, 0)} ayats)
          </button>
        )}
      </div>
    );
  }

  // Multi-mode session
  if (subMode === "multi" && started) {
    const item = multiList[idx] ?? null;
    const doneMulti = idx >= multiList.length && multiList.length > 0;
    if (doneMulti) return (
      <div style={{ padding:"24px 0", textAlign:"center", display:"flex", flexDirection:"column", gap:16, alignItems:"center" }}>
        <div style={{ fontSize:14, color:"var(--gold)" }}>✓ Session terminée</div>
        <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:1.5 }}>{multiList.length} AYATS · {results.filter(r=>r.score>=3).length} RÉUSSIS</div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => { setIdx(0); setResults([]); setStep("sens"); for (let i = multiList.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [multiList[i],multiList[j]]=[multiList[j],multiList[i]]; } }}
            style={{ padding:"9px 20px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:"rgba(201,168,76,.1)", border:"1px solid var(--gold)", color:"var(--gold2)", borderRadius:8, cursor:"pointer" }}>
            ↺ RECOMMENCER
          </button>
          <button onClick={() => { setStarted(false); setIdx(0); setResults([]); }}
            style={{ padding:"9px 20px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:"none", border:"1px solid var(--border2)", color:"var(--text3)", borderRadius:8, cursor:"pointer" }}>
            ← SÉLECTION
          </button>
        </div>
      </div>
    );
    if (!item) return null;
    const mLd = learnData[`${item.sn}:${item.ayatNum}`] || {};
    const mText = multiTexts[`${item.sn}:${item.ayatNum}`] || "";
    const mSurah = availableSurahs.find(s => s.number === item.sn);
    const STEPS = [
      { id:"sens",   label:"Je me souviens du SENS",      sub:"Résumé / thème du verset" },
      { id:"mots",   label:"Je me souviens des MOTS",     sub:"Quelques mots clés" },
      { id:"partie", label:"Je me souviens d'une PARTIE", sub:"Un ou plusieurs segments" },
      { id:"entier", label:"Je récite l'AYAT ENTIER",    sub:"De mémoire, sans aide" },
    ];
    const stepIdx = STEPS.findIndex(s => s.id === step);
    const nextAyatMulti = (score) => {
      if (item.sn && setLData) setLData(item.sn, item.ayatNum, d => ({ ...d, memScores: [...(d.memScores||[]).slice(-9), score] }));
      setResults(r => [...r, { sn: item.sn, ayatNum: item.ayatNum, score }]);
      setStep("sens"); setIdx(i => i + 1);
    };
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0 12px", flexWrap:"wrap" }}>
          <button onClick={() => { setStarted(false); setIdx(0); setResults([]); setStep("sens"); }}
            style={{ fontSize:8, letterSpacing:1, padding:"4px 10px", borderRadius:6, cursor:"pointer",
              background:"none", border:"1px solid var(--border2)", color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>← STOP</button>
          <div style={{ fontSize:8, letterSpacing:1.5, color:"var(--text3)" }}>
            {idx+1}/{multiList.length}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:"auto" }}>
            <span style={{ fontSize:9, color:"var(--gold)", fontFamily:"'Amiri Quran',serif" }}>{mSurah?.name}</span>
            <span style={{ fontSize:8, letterSpacing:1, color:"var(--text3)" }}>{mSurah?.englishName} · {item.ayatNum}</span>
          </div>
        </div>
        {/* Progress */}
        <div style={{ height:3, background:"var(--surface3)", borderRadius:2, marginBottom:12 }}>
          <div style={{ height:"100%", borderRadius:2, background:"var(--gold)", width: `${((idx)/multiList.length)*100}%`, transition:"width .3s" }} />
        </div>
        {/* Steps */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {STEPS.map((s, si) => {
            const active = si === stepIdx;
            const done   = si < stepIdx;
            return (
              <div key={s.id} style={{ padding:"12px 16px", borderRadius:8, border:`1px solid ${active?"var(--gold)":done?"var(--border)":"var(--border)"}`,
                background: active?"rgba(201,168,76,.06)":"transparent", opacity: si > stepIdx ? .4 : 1, transition:"all .2s" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:20, height:20, borderRadius:"50%", flexShrink:0,
                    border:`2px solid ${active?"var(--gold)":done?"var(--green)":"var(--border2)"}`,
                    background: done?"rgba(76,175,129,.15)":"transparent",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:done?"var(--green)":active?"var(--gold)":"var(--text3)" }}>
                    {done ? "✓" : si+1}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:9, letterSpacing:1, color: active?"var(--gold)":done?"var(--green)":"var(--text2)", fontFamily:"'Cinzel',serif" }}>{s.label}</div>
                    {active && <div style={{ fontSize:8, color:"var(--text3)", marginTop:2 }}>{s.sub}</div>}
                  </div>
                </div>
                {active && (
                  <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:8 }}>
                    {!showVerset && (
                      <button onClick={() => setShowVerset(true)} style={{ fontSize:8, letterSpacing:1.5, padding:"6px 14px", borderRadius:6, cursor:"pointer",
                        background:"rgba(62,184,160,.08)", border:"1px solid var(--teal)", color:"var(--teal2)", fontFamily:"'Cinzel',serif" }}>
                        👁 VOIR L'AYAT
                      </button>
                    )}
                    {showVerset && mText && (
                      <div style={{ direction:"rtl", fontFamily:"'Amiri Quran',serif", fontSize:20, lineHeight:2,
                        padding:"10px 14px", background:"rgba(201,168,76,.06)", borderRadius:8, border:"1px solid rgba(201,168,76,.2)" }}>
                        {mText}
                        <span style={{ fontSize:14, color:"var(--gold)", marginRight:6 }}>﴿{item.ayatNum}﴾</span>
                      </div>
                    )}
                    {mLd.highlight && (
                      <div style={{ direction:"rtl", fontFamily:"'Amiri Quran',serif", fontSize:16, color:"#ffd166",
                        padding:"6px 10px", background:"rgba(255,209,102,.07)", borderRadius:6, border:"1px solid rgba(255,209,102,.2)" }}>
                        {mLd.highlight}
                      </div>
                    )}
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
                      {si < STEPS.length - 1 ? (
                        <>
                          <button onClick={() => setStep(STEPS[si+1].id)} style={{ flex:1, padding:"10px", fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                            background:"rgba(62,184,160,.1)", border:"1px solid var(--teal)", color:"var(--teal2)", borderRadius:8, cursor:"pointer" }}>
                            ÉTAPE SUIVANTE →
                          </button>
                          <button onClick={() => nextAyatMulti(si+1)} style={{ padding:"10px 16px", fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                            background:"transparent", border:"1px solid var(--border2)", color:"var(--text3)", borderRadius:8, cursor:"pointer" }}>
                            TERMINER ICI
                          </button>
                        </>
                      ) : (
                        <button onClick={() => nextAyatMulti(4)} style={{ flex:1, padding:"10px", fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
                          background:"rgba(76,175,129,.12)", border:"1px solid var(--green)", color:"var(--green)", borderRadius:8, cursor:"pointer" }}>
                          ✓ AYAT SUIVANT
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Sourate picker ──
  if (!selectedSn) return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, padding:"20px 0" }}>
      <div style={{ display:"flex", gap:10, marginBottom:4, flexWrap:"wrap" }}>
        <div style={{ fontSize:9, letterSpacing:3, color:"var(--gold)" }}>CHOISIR UNE SOURATE</div>
        <button onClick={() => { setSubMode("multi"); setMultiSns([]); setStarted(false); }}
          style={{ fontSize:8, letterSpacing:1.5, padding:"4px 12px", borderRadius:6, cursor:"pointer",
            background:"rgba(62,184,160,.1)", border:"1px solid var(--teal)", color:"var(--teal2)", fontFamily:"'Cinzel',serif" }}>
          ☰ MULTI-SOURATES
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8 }}>
        {availableSurahs.map(s => {
          const ayatNums = Array.from({length: s.numberOfAyahs}, (_,i) => i+1);
          const vals = ayatNums.map(n => computeMastery(learnData[`${s.number}:${n}`] || {}, getAyatText(s.number, n)));
          const pct  = Math.round(vals.reduce((a,b) => a+b, 0) / (vals.length || 1));
          return (
            <button key={s.number}
              onClick={() => { setSelectedSn(s.number); setRangeFrom("1"); setRangeTo(""); setStarted(false); setIdx(0); setResults([]); setStep("sens"); setSubMode("memorise"); memNavigate(`/revision/memorise/${s.number}`); }}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
                background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8,
                cursor:"pointer", textAlign:"left", transition:"all .15s", fontFamily:"'Cinzel',serif" }}>
              <span style={{ fontSize:9, color:"var(--text3)", width:22 }}>{s.number}</span>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>
                <span style={{ fontSize:9, letterSpacing:1, color:"var(--text2)" }}>{s.englishName.toUpperCase()}</span>
                <MasteryBar pct={pct} />
              </div>
              <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:16, color:"var(--gold)" }}>{s.name}</span>
            </button>
          );
        })}
      </div>
      {availableSurahs.length === 0 && <div style={{ fontSize:10, color:"var(--text3)", letterSpacing:1 }}>Aucune sourate disponible.</div>}
    </div>
  );

  // ── Range picker ──
  if (!started) {
    const rfN = Math.max(1, parseInt(rangeFrom) || 1);
    const rtN = Math.min(maxAyat, parseInt(rangeTo) || maxAyat);
    const surahVals  = Array.from({length: maxAyat}, (_,i) => computeMastery(learnData[`${selectedSn}:${i+1}`] || {}, getAyatText(selectedSn, i+1)));
    const surahPct   = Math.round(surahVals.reduce((a,b) => a+b, 0) / (surahVals.length || 1));
    const rangeVals  = Array.from({length: Math.max(0, rtN - rfN + 1)}, (_,i) => computeMastery(learnData[`${selectedSn}:${rfN+i}`] || {}, getAyatText(selectedSn, rfN+i)));
    const rangePct   = rangeVals.length > 0 ? Math.round(rangeVals.reduce((a,b) => a+b, 0) / rangeVals.length) : 0;
    const learnedInRange = rangeVals.filter((_,i) => learnData[`${selectedSn}:${rfN+i}`]?.learned).length;
    return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, padding:"20px 0" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={() => { setSelectedSn(null); memNavigate("/revision/memorise"); }} style={{ fontSize:9, letterSpacing:1, padding:"4px 10px", fontFamily:"'Cinzel',serif", background:"transparent", border:"1px solid var(--border2)", color:"var(--text3)", borderRadius:6, cursor:"pointer" }}>←</button>
        <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:20, color:"var(--gold)", direction:"rtl" }}>{surahInfo?.name}</span>
        <span style={{ fontSize:9, color:"var(--text3)", letterSpacing:1 }}>{maxAyat} VERSETS</span>
      </div>
      {/* Mastery stats */}
      <div style={{ display:"flex", gap:10 }}>
        {/* Whole surah */}
        <div style={{ flex:1, background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontSize:8, letterSpacing:2, color:"var(--text3)" }}>SOURATE ENTIÈRE</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:28, fontWeight:700, color:masteryColor(surahPct), lineHeight:1 }}>{surahPct}%</span>
            <span style={{ fontSize:8, color:"var(--text3)", letterSpacing:1 }}>MAÎTRISE</span>
          </div>
          <MasteryBar pct={surahPct} size="lg" />
          <div style={{ display:"flex", gap:8, marginTop:2 }}>
            {[
              { label:"APPRIS", val: surahVals.filter((_,i) => learnData[`${selectedSn}:${i+1}`]?.learned).length, color:"var(--green)" },
              { label:"MÉM.", val: surahVals.filter((_,i) => (learnData[`${selectedSn}:${i+1}`]?.memScores?.length > 0)).length, color:"var(--gold)" },
              { label:"QUEST.", val: surahVals.filter((_,i) => (learnData[`${selectedSn}:${i+1}`]?.questionScores && Object.keys(learnData[`${selectedSn}:${i+1}`].questionScores).length > 0)).length, color:"var(--teal2)" },
            ].map(({label, val, color}) => (
              <div key={label} style={{ fontSize:8, letterSpacing:1, color:"var(--text3)" }}>
                <span style={{ color, fontFamily:"'Cinzel',serif", fontSize:11 }}>{val}</span> {label}
              </div>
            ))}
          </div>
        </div>
        {/* Selected range */}
        <div style={{ flex:1, background:"var(--surface2)", border:"1px solid "+masteryColor(rangePct), borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontSize:8, letterSpacing:2, color:"var(--text3)" }}>PLAGE {rfN}–{rtN}</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:28, fontWeight:700, color:masteryColor(rangePct), lineHeight:1 }}>{rangePct}%</span>
            <span style={{ fontSize:8, color:"var(--text3)", letterSpacing:1 }}>MAÎTRISE</span>
          </div>
          <MasteryBar pct={rangePct} size="lg" />
          <div style={{ display:"flex", gap:8, marginTop:2 }}>
            <div style={{ fontSize:8, letterSpacing:1, color:"var(--text3)" }}>
              <span style={{ color:"var(--green)", fontFamily:"'Cinzel',serif", fontSize:11 }}>{learnedInRange}</span>/{rangeVals.length} APPRIS
            </div>
            <div style={{ fontSize:8, letterSpacing:1, color:"var(--text3)" }}>
              <span style={{ color:"var(--gold)", fontFamily:"'Cinzel',serif", fontSize:11 }}>{rangeVals.filter((_,i) => (learnData[`${selectedSn}:${rfN+i}`]?.memScores?.length > 0)).length}</span> MÉM.
            </div>
          </div>
          {/* Per-ayat mini dots */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:2 }}>
            {rangeVals.map((m, i) => (
              <div key={i} title={`${rfN+i}: ${m}%`} style={{ width:14, height:14, borderRadius:3,
                background: m >= 80 ? "rgba(76,175,129,.3)" : m >= 50 ? "rgba(201,168,76,.25)" : m > 0 ? "rgba(62,184,160,.2)" : "var(--surface3)",
                border:"1px solid "+masteryColor(m),
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:7, color:masteryColor(m), fontFamily:"'Cinzel',serif" }}>
                {rfN+i}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, padding:"20px 24px", display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ fontSize:9, letterSpacing:2, color:"var(--text3)" }}>PLAGE DE VERSETS</div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"center" }}>
            <span style={{ fontSize:8, letterSpacing:1, color:"var(--text3)" }}>DE</span>
            <input type="number" min="1" max={maxAyat} value={rangeFrom} onChange={e => setRangeFrom(e.target.value)}
              style={{ width:64, background:"var(--surface3)", border:"1px solid var(--border2)", borderRadius:6, padding:"6px 8px", color:"var(--text)", fontSize:14, fontFamily:"'Cinzel',serif", textAlign:"center", outline:"none" }} />
          </div>
          <span style={{ color:"var(--text3)", marginTop:14 }}>→</span>
          <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"center" }}>
            <span style={{ fontSize:8, letterSpacing:1, color:"var(--text3)" }}>JUSQU'À</span>
            <input type="number" min="1" max={maxAyat} value={rangeTo} placeholder={String(maxAyat)} onChange={e => setRangeTo(e.target.value)}
              style={{ width:64, background:"var(--surface3)", border:"1px solid var(--border2)", borderRadius:6, padding:"6px 8px", color:"var(--text)", fontSize:14, fontFamily:"'Cinzel',serif", textAlign:"center", outline:"none" }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[5,10,20].map(n => (
            <button key={n} onClick={() => { setRangeFrom("1"); setRangeTo(String(Math.min(n, maxAyat))); }}
              style={{ fontSize:8, letterSpacing:1, padding:"4px 10px", borderRadius:20, cursor:"pointer", fontFamily:"'Cinzel',serif",
                border:"1px solid var(--border2)", background:"transparent", color:"var(--text3)" }}>
              1 → {Math.min(n, maxAyat)}
            </button>
          ))}
          <button onClick={() => { setRangeFrom("1"); setRangeTo(String(maxAyat)); }}
            style={{ fontSize:8, letterSpacing:1, padding:"4px 10px", borderRadius:20, cursor:"pointer", fontFamily:"'Cinzel',serif",
              border:"1px solid var(--gold)", background:"rgba(201,168,76,.08)", color:"var(--gold)" }}>TOUS</button>
        </div>
        {/* Sub-mode selection */}
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => { setSubMode("memorise"); setStarted(true); memNavigate(`/revision/memorise/${selectedSn}/${rangeFrom}/${rangeTo || maxAyat}`); }}
            style={{ flex:1, padding:"10px", fontSize:10, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:"rgba(62,184,160,.1)", border:"1px solid var(--teal)", color:"var(--teal2)", borderRadius:8, cursor:"pointer" }}>
            ▶ MÉMORISER
          </button>
        </div>
      </div>
    </div>
    );
  }

  // ── Session terminée ──
  if (done) {
    const good = results.filter(r => r.score >= 2).length;
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20, padding:"30px 20px" }}>
        <div style={{ fontFamily:"'Amiri Quran',serif", fontSize:28, color:"var(--gold)", direction:"rtl" }}>{surahInfo?.name}</div>
        <div style={{ fontSize:36, fontFamily:"'Cinzel',serif", color: good===results.length?"var(--green)":good>results.length/2?"var(--gold2)":"var(--red)", letterSpacing:-1 }}>{good}/{results.length}</div>
        <div style={{ fontSize:9, letterSpacing:2, color:"var(--text3)" }}>VERSETS MÉMORISÉS</div>
        {surahMastery !== null && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, width:'100%', maxWidth:220 }}>
            <div style={{ fontSize:8, color:'var(--text3)', letterSpacing:2 }}>MAÎTRISE DE LA PLAGE</div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:28, color:masteryColor(surahMastery) }}>{surahMastery}%</div>
            <MasteryBar pct={surahMastery} size="lg" />
          </div>
        )}
        <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap", justifyContent:"center" }}>
          <button onClick={restart} style={{ padding:"8px 20px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif", background:"transparent", border:"1px solid var(--gold)", color:"var(--gold)", borderRadius:6, cursor:"pointer" }}>↺ RECOMMENCER</button>
          <button onClick={back} style={{ padding:"8px 20px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif", background:"transparent", border:"1px solid var(--border2)", color:"var(--text3)", borderRadius:6, cursor:"pointer" }}>← PLAGE</button>
          <button onClick={() => { setSelectedSn(null); memNavigate("/revision/memorise"); }} style={{ padding:"8px 20px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif", background:"transparent", border:"1px solid var(--border2)", color:"var(--text3)", borderRadius:6, cursor:"pointer" }}>⌂ SOURATES</button>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8, justifyContent:"center" }}>
          {results.map(r => {
            const m = computeMastery(learnData[`${selectedSn}:${r.ayatNum}`] || {}, getAyatText(selectedSn, r.ayatNum));
            return (
              <div key={r.ayatNum} style={{ width:36, height:36, borderRadius:6,
                border:"1px solid " + (r.score>=4?"var(--green)":r.score>=2?"var(--gold)":"var(--red)"),
                display:"flex", flexDirection:'column', alignItems:"center", justifyContent:"center",
                fontSize:9, color:r.score>=4?"var(--green)":r.score>=2?"var(--gold)":"var(--red)",
                fontFamily:"'Cinzel',serif", position:'relative', overflow:'hidden' }}>
                {r.ayatNum}
                <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3,
                  background:masteryColor(m), opacity:.8 }} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Question card ──
  const progress = ayatList.length > 0 ? Math.round((idx / ayatList.length) * 100) : 0;
  const currentMastery = computeMastery(ld, ayatText);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, padding:"16px 0" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={back} style={{ fontSize:9, letterSpacing:1, padding:"4px 10px", fontFamily:"'Cinzel',serif", background:"transparent", border:"1px solid var(--border2)", color:"var(--text3)", borderRadius:6, cursor:"pointer" }}>← {surahInfo?.englishName?.toUpperCase()}</button>
        <div style={{ flex:1, height:4, background:"var(--surface3)", borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", width:progress+"%", background:"var(--gold)", borderRadius:2, transition:"width .3s" }} />
        </div>
        <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:1, flexShrink:0 }}>{idx+1}/{ayatList.length}</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"28px 20px", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:12 }}>
        <div style={{ fontSize:9, letterSpacing:3, color:"var(--text3)" }}>VERSET</div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:72, fontWeight:700, color:"var(--gold2)", lineHeight:1 }}>{current}</div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            <MasteryBadge pct={currentMastery} />
          </div>
        </div>
        <div style={{ fontSize:9, letterSpacing:1.5, color:"var(--text3)" }}>{surahInfo?.name ?? ""}</div>
        {/* Toggle buttons */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center", marginTop:4 }}>
          {toggleBtn(showVerset, "📖 VERSET",       () => setShowVerset(v => !v))}
          {toggleBtn(showMemo,   "🗒 AIDE MÉMOIRE",  () => setShowMemo(v => !v))}
          {toggleBtn(showInfos,  "ℹ INFOS",          () => setShowInfos(v => !v))}
          {toggleBtn(showScore,  "🏆 MEILLEUR",       () => setShowScore(v => !v))}
        </div>
        {showVerset && (
          <div style={{ width:"100%", padding:"12px 16px", background:"var(--surface3)", borderRadius:8, border:"1px solid var(--border2)", direction:"rtl", textAlign:"right" }}>
            {ayatText
              ? <span style={{ fontFamily:"'Amiri Quran',serif", fontSize:22, color:"var(--text)", lineHeight:2 }}>{ayatText}</span>
              : <span style={{ fontSize:9, color:"var(--text3)" }}>Chargement…</span>}
            {ayatGlobalNum && (
              <div style={{ direction:"ltr", marginTop:10, display:"flex", alignItems:"center", gap:8 }}>
                <audio
                  key={ayatGlobalNum}
                  src={`${getAudioBase()}/${ayatGlobalNum}.mp3`}
                  controls
                  style={{ flex:1, height:32, minWidth:0, accentColor:"var(--gold)", colorScheme:"dark" }}
                />
              </div>
            )}
          </div>
        )}
        {showMemo && (
          <div style={{ width:"100%", padding:"12px 16px", background:"var(--surface3)", borderRadius:8, border:"1px solid var(--border2)", display:"flex", flexDirection:"column", gap:8 }}>
            {ld.highlight && <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:1 }}>🔑 <span style={{ color:"var(--gold2)", fontFamily:"'Amiri Quran',serif", fontSize:16, direction:"rtl" }}>{ld.highlight}</span></div>}
            {ld.subject   && <div style={{ fontSize:9, color:"var(--text2)", letterSpacing:.5 }}>📌 {ld.subject}</div>}
            {ld.pagePosition && <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:1 }}>📄 <span style={{ color:"var(--teal2)" }}>{ld.pagePosition?.toUpperCase()}</span></div>}
            {!ld.highlight && !ld.subject && !ld.pagePosition && <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:1 }}>Aucune note.</div>}
          </div>
        )}
        {showInfos && <MemoriseInfoPanel surahNum={selectedSn} ayatNum={current} />}
        {showScore && (
          <div style={{ width:"100%", padding:"12px 16px", background:"var(--surface3)", borderRadius:8, border:"1px solid var(--border2)", display:"flex", flexDirection:"column", gap:8, alignItems:"center" }}>
            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              {bestScore !== null
                ? <>
                    <div style={{ fontFamily:"'Cinzel',serif", fontSize:22, color: bestScore>=4?"var(--green)":bestScore>=2?"var(--gold2)":"var(--red)" }}>{["—","SENS","MOTS","PARTIE","COMPLET"][bestScore] ?? bestScore}</div>
                    <div style={{ fontSize:8, color:"var(--text3)", letterSpacing:1 }}>MÉMORISATION</div>
                  </>
                : <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:1 }}>Pas encore révisé.</div>}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ fontFamily:"'Cinzel',serif", fontSize:22, color:masteryColor(currentMastery) }}>{currentMastery}%</div>
                <div style={{ fontSize:8, color:'var(--text3)', letterSpacing:1 }}>MAÎTRISE</div>
              </div>
            </div>
            <MasteryBar pct={currentMastery} size="lg" />
          </div>
        )}
        {/* Step dots */}
        <div style={{ display:"flex", gap:6, marginTop:4 }}>
          {STEPS.map((s,i) => (
            <div key={s.id} style={{ width:8, height:8, borderRadius:"50%",
              background: i < stepIdx ? "var(--green)" : i === stepIdx ? "var(--gold2)" : "var(--surface3)",
              border: "1px solid " + (i < stepIdx ? "var(--green)" : i === stepIdx ? "var(--gold)" : "var(--border2)"),
              transition:"all .2s" }} />
          ))}
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:10, letterSpacing:1.5, color:"var(--gold)", fontFamily:"'Cinzel',serif" }}>{STEPS[stepIdx]?.label}</div>
          <div style={{ fontSize:8, color:"var(--text3)", marginTop:4, letterSpacing:1 }}>{STEPS[stepIdx]?.sub}</div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
          <button onClick={() => { if (stepIdx < STEPS.length-1) setStep(STEPS[stepIdx+1].id); else nextAyat(4); }}
            style={{ padding:"9px 22px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:"rgba(76,175,129,.12)", border:"1px solid var(--green)", color:"var(--green)", borderRadius:8, cursor:"pointer" }}>
            ✓ OUI
          </button>
          <button onClick={() => nextAyat(stepIdx)}
            style={{ padding:"9px 22px", fontSize:9, letterSpacing:2, fontFamily:"'Cinzel',serif",
              background:"rgba(224,90,90,.08)", border:"1px solid var(--red)", color:"var(--red)", borderRadius:8, cursor:"pointer" }}>
            ✗ NON
          </button>
        </div>
        <button onClick={() => nextAyat(STEPS.length)}
          style={{ padding:"7px 22px", fontSize:9, letterSpacing:1.5, fontFamily:"'Cinzel',serif",
            background:"rgba(201,168,76,.1)", border:"1px solid var(--gold)", color:"var(--gold2)",
            borderRadius:20, cursor:"pointer", transition:"all .2s" }}>
          ⚡ JE ME SOUVIENS DE TOUT
        </button>
        {step !== "sens" && (
          <button onClick={() => setStep("sens")}
            style={{ fontSize:8, color:"var(--text3)", background:"transparent", border:"none", cursor:"pointer", letterSpacing:1, fontFamily:"'Cinzel',serif" }}>
            ↺ RECOMMENCER CET AYAT
          </button>
        )}
      </div>
    </div>
  );
}


function MemoriseInfoPanel({ surahNum, ayatNum }) {
  const [meta, setMeta] = React.useState(null);
  React.useEffect(() => {
    let c = false;
    fetchAyahMeta(surahNum, ayatNum).then(d => { if (!c && d) setMeta(d); }).catch(() => {});
    return () => { c = true; };
  }, [surahNum, ayatNum]);
  if (!meta) return <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:1, width:"100%", textAlign:"center" }}>Chargement…</div>;
  const rows = [
    ["JUZ",   meta.juz],
    ["PAGE",  meta.page],
    ["HIZB",  Math.ceil(meta.hizbQuarter / 4)],
    ["MANZIL",meta.manzil],
  ];
  return (
    <div style={{ width:"100%", display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
      {rows.map(([l,v]) => (
        <div key={l} style={{ padding:"8px 14px", background:"var(--surface3)", borderRadius:8, border:"1px solid var(--border2)", textAlign:"center", minWidth:60 }}>
          <div style={{ fontSize:8, color:"var(--text3)", letterSpacing:1 }}>{l}</div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:14, color:"var(--gold2)", marginTop:2 }}>{v}</div>
        </div>
      ))}
      {meta.sajda && <div style={{ padding:"8px 14px", background:"rgba(201,168,76,.08)", borderRadius:8, border:"1px solid var(--gold)", textAlign:"center", minWidth:60 }}><div style={{ fontSize:8, color:"var(--gold)", letterSpacing:1 }}>SAJDA</div><div style={{ fontSize:14, color:"var(--gold2)", marginTop:2 }}>✓</div></div>}
    </div>
  );
}

// ─── RappelWidget — rappel vocal global flottant ─────────────────────────────
// Accessible depuis n'importe quelle page via le bouton dans le header.
