import { LearningMapPage } from "./LearningMapPage.jsx";
import { QuestionsModePage } from "./QuestionsModePage.jsx";
import { useParams } from "react-router-dom";
import { fetchSurahDefault } from "../../utils/reciterAudio.js";
import React, { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";
import { RevisionEcritureMode } from "../modes/RevisionEcritureMode.jsx";
import { TajweedExercice } from "../modes/TajweedExercice.jsx";
import { ErrorBoundary } from "../common/ErrorBoundary.jsx";
import { splitArabicWords, splitArabicChars } from "../../utils/arabicUtils.js";
import { computeMastery, MasteryBar, MasteryBadge, masteryColor } from "../common/Mastery.jsx";
import { LearningEvolutionChart } from "../common/LearningEvolutionChart.jsx";
import { SurahAyatsMasteryRibbon } from "../common/SurahAyatsMasteryRibbon.jsx";
import { getAyatRevisionInfo, REVISION_LEVEL_LEGEND } from "../../utils/ayatRevisionLevel.js";

export function RevisionPage({ learnData, surahs, setLData, activity = {}, goals = {}, surahTextCache = {}, onNavigate, initialFilter }) {
  const { surahNum: urlSn, rangeFrom: urlRf, rangeTo: urlRt, qIdx: urlQIdx } = useParams();
  const [filter, setFilter]         = useState(initialFilter || "carte"); // "carte" | "exercices" | "toRevise" | "evolution" | "questions"
  const [openSurahs, setOpenSurahs] = useState({});    // surahNum → bool
  const [openAyat,   setOpenAyat]   = useState(null);  // "surahNum:ayatNum" | null
  const [ayatTab,    setAyatTab]    = useState({});    // key -> "ecriture" | "tajweed"

  // ── Data repair: close orphaned reviseHistory entries ──────────────────────
  // Ayats where toRevise=false but reviseHistory still has an item with endDate
  // null (left open by a code path that cleared toRevise without closing it).
  useEffect(() => {
    const now = new Date().toISOString();
    Object.entries(learnData).forEach(([key, val]) => {
      if (val?.toRevise) return; // still active, nothing to fix
      const hist = val?.reviseHistory;
      if (!hist || hist.length === 0) return;
      const openIdx = hist.findIndex(e => !e.endDate);
      if (openIdx === -1) return;
      const [sn, an] = key.split(":").map(Number);
      setLData(sn, an, d => {
        const h = [...(d.reviseHistory || [])];
        const idx = h.findIndex(e => !e.endDate);
        if (idx === -1 || d.toRevise) return { ...d }; // already fixed / re-activated meanwhile — never return the frozen object as-is
        h[idx] = { ...h[idx], endDate: now };
        return { ...d, reviseHistory: h };
      });
    });
  }, []);

  // Construire la liste des ayats appris groupés par sourate
  const learnedBySurah = useMemo(() => {
    const map = {};
    Object.entries(learnData).forEach(([key, val]) => {
      if (!val?.learned) return;
      const [sn, an] = key.split(":").map(Number);
      if (!map[sn]) map[sn] = [];
      map[sn].push({ surahNum: sn, ayatNum: an, ld: val });
    });
    // Sort by surah then ayat
    Object.values(map).forEach(arr => arr.sort((a, b) => a.ayatNum - b.ayatNum));
    return map;
  }, [learnData]);

  const surahNums = Object.keys(learnedBySurah).map(Number).sort((a, b) => a - b);

  // Stats globales
  const totalLearned = useMemo(() => Object.values(learnedBySurah).reduce((s, a) => s + a.length, 0), [learnedBySurah]);
  const totalPerfect = useMemo(() =>
    Object.values(learnedBySurah).flat().filter(({ ld }) => {
      const attempts = ld.writingAttempts || [];
      return attempts.some(a => a.score === 100);
    }).length,
  [learnedBySurah]);
  const totalNone = useMemo(() =>
    Object.values(learnedBySurah).flat().filter(({ ld }) => !(ld.writingAttempts?.length > 0)).length,
  [learnedBySurah]);
  const totalToRevise = useMemo(() =>
    Object.values(learnData).filter(ld => ld?.toRevise).length,
  [learnData]);

  // Filtrage par statut de révision
  const getRevStatus = (ld) => {
    const attempts = ld.writingAttempts || [];
    if (attempts.length === 0) return "none";
    const best = Math.max(...attempts.map(a => a.score));
    if (best === 100) return "perfect";
    if (best >= 70)  return "good";
    return "bad";
  };

  const filteredBySurah = useMemo(() => {
    if (filter === "all" || filter === "exercices") return learnedBySurah;
    if (filter === "toRevise") {
      // Include ALL ayats (learned or not) that have toRevise flag
      const out = {};
      Object.entries(learnData).forEach(([key, val]) => {
        if (!val?.toRevise) return;
        const [sn, an] = key.split(":").map(Number);
        if (!out[sn]) out[sn] = [];
        out[sn].push({ surahNum: sn, ayatNum: an, ld: val });
      });
      Object.values(out).forEach(arr => arr.sort((a, b) => a.ayatNum - b.ayatNum));
      return out;
    }
    const out = {};
    surahNums.forEach(sn => {
      const arr = (learnedBySurah[sn] || []).filter(({ ld }) => {
        const st = getRevStatus(ld);
        if (filter === "perfect") return st === "perfect";
        if (filter === "todo")    return st === "bad" || st === "good";
        if (filter === "none")    return st === "none";
        return true;
      });
      if (arr.length > 0) out[sn] = arr;
    });
    return out;
  }, [filter, learnedBySurah, surahNums, learnData]);

  const filteredSurahNums = Object.keys(filteredBySurah).map(Number).sort((a, b) => a - b);

  const toggleSurah = (sn) => setOpenSurahs(p => ({ ...p, [sn]: !p[sn] }));
  const toggleAyat  = (key) => setOpenAyat(p => p === key ? null : key);

  // Récupérer le texte de l'ayat depuis l'API (cache local)
  const [ayatTexts, setAyatTexts] = useState({}); // "sn:an" → text
  useEffect(() => {
    const missing = [];
    filteredSurahNums.forEach(sn => {
      (filteredBySurah[sn] || []).forEach(({ ayatNum }) => {
        const k = `${sn}:${ayatNum}`;
        if (!ayatTexts[k]) missing.push({ sn, an: ayatNum, k });
      });
    });
    if (missing.length === 0) return;
    // Group by surah to batch
    const bySurah = {};
    missing.forEach(({ sn, an, k }) => { if (!bySurah[sn]) bySurah[sn] = []; bySurah[sn].push({ an, k }); });
    Object.entries(bySurah).forEach(([sn, items]) => {
      fetchSurahDefault(Number(sn))
        .then(ayahs => {
          if (!ayahs?.length) return;
          const newTexts = {};
          ayahs.forEach(a => {
            const k = `${sn}:${a.numberInSurah}`;
            newTexts[k] = a.text;
          });
          setAyatTexts(p => ({ ...p, ...newTexts }));
        })
        .catch(() => {});
    });
  }, [filteredSurahNums.join(",")]);

  // Faux objet ayat pour RevisionEcritureMode
  const makeAyat = (sn, an) => ({ numberInSurah: an, text: ayatTexts[`${sn}:${an}`] || "" });

  const statusColor = {
    perfect: "var(--green)",
    good:    "var(--gold)",
    bad:     "var(--red)",
    none:    "var(--border2)",
  };
  const statusLabel = {
    perfect: "✓ PARFAIT",
    good:    "~ BON",
    bad:     "✗ À REVOIR",
    none:    "— NON RÉVISÉ",
  };

  return (
    <div className="rev-page">
      {/* Header */}
      <div className="rev-header-block">
        <div>
          <div className="rev-title">✏ RÉVISION</div>
          <div className="rev-subtitle">EXERCICES D'ÉCRITURE · AYATS APPRIS</div>
        </div>
        <div className="rev-stats-row">
          <div className="rev-stat-pill">
            <div className="rev-stat-num" style={{ color:"var(--gold2)" }}>{totalLearned}</div>
            <div className="rev-stat-label">APPRIS</div>
          </div>
          <div className="rev-stat-pill">
            <div className="rev-stat-num" style={{ color:"var(--green)" }}>{totalPerfect}</div>
            <div className="rev-stat-label">PARFAITS</div>
          </div>
          <div className="rev-stat-pill">
            <div className="rev-stat-num" style={{ color:"var(--text3)" }}>{totalNone}</div>
            <div className="rev-stat-label">À DÉBUTER</div>
          </div>
          {totalToRevise > 0 && (
          <div className="rev-stat-pill" style={{ cursor:'pointer' }} onClick={() => setFilter("toRevise")}>
            <div className="rev-stat-num" style={{ color:"var(--gold2)" }}>{totalToRevise}</div>
            <div className="rev-stat-label">🔖 RÉVISER</div>
          </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rev-filter-row">
        {[
          { id:"carte",     label:"📊 CARTE & MAÎTRISE" },
          { id:"exercices", label:`✏ EXERCICES (${totalLearned})` },
          ...(totalToRevise > 0 ? [{ id:"toRevise", label:`🔖 À RÉVISER (${totalToRevise})`, color:"#ff7eb3" }] : []),
          { id:"evolution", label:"📈 ÉVOLUTION (30J)" },
          { id:"questions", label:"❓ QUESTIONS" },
        ].map(f => (
          <button key={f.id}
            className={`rev-filter-btn${filter===f.id || (filter==="all" && f.id==="exercices")?" active":""}`}
            style={f.color && (filter===f.id) ? { borderColor: f.color, color: f.color, background: 'rgba(255,126,179,0.12)' } : undefined}
            onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {filter === "carte" && (
        <LearningMapPage
          surahs={surahs}
          learnData={learnData}
          surahTextCache={surahTextCache}
          onNavigate={onNavigate}
          setLData={setLData}
        />
      )}

      {filter === "evolution" && (
        <div style={{ padding: "8px 0" }}>
          <LearningEvolutionChart
            learnData={learnData}
            activity={activity}
            surahs={surahs}
            surahTextCache={surahTextCache}
            goals={goals}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {filter === "questions" && (
        <QuestionsModePage surahs={surahs} learnData={learnData} setLData={setLData}
          initialSurahNum={urlSn ? Number(urlSn) : undefined}
          initialRangeFrom={urlRf || undefined}
          initialRangeTo={urlRt || undefined}
          initialQIdx={urlQIdx ? Number(urlQIdx) : 0}
        />
      )}

      {filter !== "questions" && filter !== "carte" && filter !== "evolution" && totalLearned === 0 && (
        <div className="rev-empty">
          Aucun ayat appris.<br />
          Marquez des ayats comme appris dans l'onglet CORAN ou consultez la CARTE DE MAÎTRISE pour explorer tous les versets.
        </div>
      )}

      {filter !== "questions" && filter !== "carte" && filter !== "evolution" && totalLearned > 0 && filteredSurahNums.length === 0 && (
        <div className="rev-empty">Aucun ayat dans ce filtre.</div>
      )}

      {/* Surah blocks */}
      {(filter !== "questions" && filter !== "carte" && filter !== "evolution") && filteredSurahNums.map(sn => {
        const surahInfo  = surahs.find(s => s.number === sn);
        let ayatItems    = filteredBySurah[sn] || [];
        const isOpen     = !!openSurahs[sn];

        // Ensure clicked ayat from ribbon is displayed in ayatItems
        if (openAyat && openAyat.startsWith(`${sn}:`)) {
          const selAn = Number(openAyat.split(":")[1]);
          if (!ayatItems.some(x => x.ayatNum === selAn)) {
            ayatItems = [...ayatItems, { surahNum: sn, ayatNum: selAn, ld: learnData[openAyat] || {} }];
            ayatItems.sort((a, b) => a.ayatNum - b.ayatNum);
          }
        }

        const perfectCnt = ayatItems.filter(({ ld }) => getRevStatus(ld) === "perfect").length;
        const pct        = ayatItems.length > 0 ? Math.round((perfectCnt / ayatItems.length) * 100) : 0;
        const toReviseCount = ayatItems.filter(({ ld }) => ld?.toRevise).length;

        return (
          <div key={sn} className="rev-surah-block" style={{ marginBottom: 12 }}>
            {/* Surah header */}
            <div className="rev-surah-header" onClick={() => toggleSurah(sn)}>
              <div className="rev-surah-num">{sn}</div>
              <div className="rev-surah-name">
                <div className="rev-surah-name-ar">{surahInfo?.name ?? `Sourate ${sn}`}</div>
                <div className="rev-surah-name-en">{surahInfo?.englishName?.toUpperCase() ?? ""}</div>
                <div className="rev-progress-bar" style={{ width: 130, marginTop: 6 }}>
                  <div className="rev-progress-fill" style={{ width:`${pct}%`, background: pct===100?"var(--green)":pct>0?"var(--gold)":"var(--border2)" }} />
                </div>
              </div>

              {toReviseCount > 0 && (
                <div style={{
                  fontSize: 8,
                  color: '#ff7eb3',
                  background: 'rgba(255, 126, 179, 0.15)',
                  border: '1px solid rgba(255, 126, 179, 0.4)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontFamily: "'Cinzel',serif",
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  marginRight: 6
                }}>
                  🔖 {toReviseCount} À RÉVISER
                </div>
              )}

              <div className="rev-surah-badge" style={{ borderColor: pct===100?"var(--green)":"var(--border2)", color: pct===100?"var(--green)":"var(--text3)" }}>
                {perfectCnt}/{ayatItems.length} PARFAIT{perfectCnt!==1?"S":""}
              </div>
              <span style={{ fontSize:12, color:"var(--text3)", marginLeft:4 }}>{isOpen ? "▲" : "▼"}</span>
            </div>

            {/* Surah Ayats Mastery Ribbon - Displaying all ayats numbers with color depending on level of reviser */}
            <div style={{ padding: isOpen ? '4px 16px 14px' : '0 16px 10px' }}>
              <SurahAyatsMasteryRibbon
                surah={surahInfo}
                learnData={learnData}
                surahTextCache={surahTextCache}
                activeAyatNum={openAyat && openAyat.startsWith(`${sn}:`) ? Number(openAyat.split(':')[1]) : null}
                compact={!isOpen}
                onSelectAyat={(sNum, an) => {
                  setOpenSurahs(p => ({ ...p, [sNum]: true }));
                  setOpenAyat(`${sNum}:${an}`);
                  setTimeout(() => {
                    const el = document.getElementById(`rev-card-${sNum}-${an}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 80);
                }}
                onNavigate={onNavigate}
                setLData={setLData}
              />
            </div>

            {/* Ayat list */}
            {isOpen && (
              <div className="rev-ayat-grid">
                {ayatItems.map(({ surahNum: sNum, ayatNum: an, ld }) => {
                  const key        = `${sNum}:${an}`;
                  const attempts   = ld.writingAttempts || [];
                  const best       = attempts.length > 0 ? Math.max(...attempts.map(a => a.score)) : null;
                  const isExpanded = openAyat === key;
                  const text       = ayatTexts[key];
                  const ayat       = makeAyat(sNum, an);
                  const revInfo    = getAyatRevisionInfo(ld, text);

                  return (
                    <div
                      key={key}
                      id={`rev-card-${sNum}-${an}`}
                      className={`rev-ayat-card${isExpanded?" rev-ayat-active":""}`}
                      style={{
                        borderColor: isExpanded
                          ? "var(--gold)"
                          : revInfo.isToRevise
                          ? "rgba(255, 126, 179, 0.6)"
                          : revInfo.border,
                        boxShadow: isExpanded
                          ? "0 0 12px rgba(201,168,76,0.3)"
                          : revInfo.glow !== "none"
                          ? revInfo.glow
                          : "none",
                        transition: "all .2s ease",
                      }}
                    >
                      {/* Card header */}
                      <div className="rev-ayat-card-header" onClick={() => toggleAyat(key)}>
                        <div
                          className="rev-ayat-num"
                          style={{
                            borderColor: revInfo.border,
                            color: revInfo.color,
                            fontWeight: 700,
                            background: revInfo.bg,
                          }}
                        >
                          {an}
                        </div>
                        <div className="rev-ayat-text-preview">{text || "…"}</div>

                        {/* Revision Level Badge */}
                        <div
                          className="rev-ayat-score-badge"
                          style={{
                            background: revInfo.bg,
                            border: `1px solid ${revInfo.border}`,
                            color: revInfo.color,
                            fontFamily: "'Cinzel',serif",
                            fontSize: 8.5,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {best !== null ? `${best}% · ${revInfo.label}` : revInfo.label}
                        </div>

                        <button
                          onClick={e => { e.stopPropagation(); onNavigate(sNum, an); }}
                          className="btn-small"
                          style={{ fontSize:8, padding:"2px 7px", marginLeft:4, flexShrink:0 }}
                          title="Aller à cet ayat dans le Coran"
                        >↗</button>
                        <span style={{ fontSize:11, color:"var(--text3)", marginLeft:4 }}>{isExpanded?"▲":"▼"}</span>
                      </div>

                      {/* Expanded: tab switcher + exercise */}
                      {isExpanded && (
                        <div className="rev-ayat-body">
                          {/* Tab buttons */}
                          <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                            {[["ecriture","✏ RÉVISION"],["tajweed","☪ TAJWEED"]].map(([t,l]) => (
                              <button key={t}
                                onClick={e => { e.stopPropagation(); setAyatTab(p => ({ ...p, [key]: t })); }}
                                style={{ padding:"4px 12px", fontSize:8, letterSpacing:1, fontFamily:"'Cinzel',serif",
                                  cursor:"pointer", borderRadius:6, border:"none",
                                  borderBottom:"2px solid " + ((ayatTab[key]||"ecriture")===t ? "var(--teal)" : "transparent"),
                                  background:(ayatTab[key]||"ecriture")===t ? "rgba(62,184,160,.1)" : "transparent",
                                  color:(ayatTab[key]||"ecriture")===t ? "var(--teal2)" : "var(--text3)",
                                  transition:"all .15s" }}>
                                {l}
                              </button>
                            ))}
                          </div>
                          {text
                            ? <div className="rev-ayat-arabic">{text}</div>
                            : <div style={{ fontSize:9, color:"var(--text3)", letterSpacing:1 }}>Chargement…</div>
                          }
                          {text && (ayatTab[key]||"ecriture") === "ecriture" && (
                            <RevisionEcritureMode
                              ayat={ayat}
                              surahNum={sNum}
                              ld={ld}
                              setLData={setLData}
                            />
                          )}
                          {text && (ayatTab[key]||"ecriture") === "tajweed" && (
                            <ErrorBoundary>
                              <TajweedExercice ayat={ayat} />
                            </ErrorBoundary>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MemoriseMode ─────────────────────────────────────────────────────────────
// Mastery helpers (exported so surah list can use them)
// Non-letter Quranic marks that must never count as a "letter" for mastery:
// waqf/pause signs, sajda place marker, rub-el-hizb marker, end-of-ayah marker,
// small Quranic annotation ligatures (U+06D6–U+06ED), Arabic-Indic digits
// (juz/hizb/ayah numerals) and ornate ayah-number parentheses.
const QURAN_NON_LETTER_RE = /[\u06D6-\u06ED\u0660-\u0669\u06F0-\u06F9\uFD3E\uFD3F]/;

// Split Arabic text into grapheme clusters (letter + harakat), skipping
// non-letter Quranic annotation marks (juz/hizb/sajda/pause/etc.) entirely —
// they neither form their own cluster nor attach to a neighbouring letter.
function splitArabicClusters(text) {
  if (!text) return [];
  const clusters = [];
  const base = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const diac = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/;
  let cur = '';
  for (const ch of text) {
    if (QURAN_NON_LETTER_RE.test(ch)) { continue; } // ignore entirely — not a letter or harakat
    if (ch === ' ') { if (cur) { clusters.push(cur); cur = ''; } }
    else if (base.test(ch)) { if (cur) clusters.push(cur); cur = ch; }
    else if (diac.test(ch) && cur) { cur += ch; }
    else { if (cur) clusters.push(cur); cur = ch; }
  }
  if (cur) clusters.push(cur);
  return clusters;
}
