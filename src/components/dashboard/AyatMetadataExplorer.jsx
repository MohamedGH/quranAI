import React, { useState, useMemo } from "react";
import { extractAyatHistoricalMetadata, computeRevisionQueue, computeQuranAggregations } from "../../utils/quranHistoryAnalytics.js";
import { masteryColor } from "../common/Mastery.jsx";
import { SURAH_INFO } from "../../utils/arabicUtils.js";
import { getReviseTimeColor, getWordReviseDate } from "../../utils/reviseColorGradient.js";

/**
 * AyatHistoryModal — Detailed lifecycle inspector for a specific Ayat.
 * Displays first/last reading, learning, cutting, words, revision history, audio recitation scores,
 * and a full interactive timeline.
 */
export function AyatHistoryModal({ surahNum, ayatNum, learnData, surahTextCache = {}, onClose, onNavigate }) {
  const key = `${surahNum}:${ayatNum}`;
  const ld = learnData[key] || {};
  const ayatText = surahTextCache[surahNum]?.[ayatNum] || "";
  const meta = useMemo(() => extractAyatHistoricalMetadata(key, ld, ayatText), [key, ld, ayatText]);

  const fmtDate = (d) => {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  const fmtDateShort = (d) => {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return d;
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.85)",
      backdropFilter: "blur(4px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        width: "100%",
        maxWidth: 720,
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontFamily: "'Cinzel',serif",
                fontSize: 13,
                letterSpacing: 2,
                color: "var(--gold2)",
                fontWeight: 700,
              }}>
                HISTORIQUE COMPLET · S.{meta.surahNum} : A.{meta.ayatNum}
              </span>
              <span style={{
                fontSize: 9,
                padding: "2px 8px",
                borderRadius: 10,
                background: meta.isLearned ? "rgba(76,175,129,.15)" : "rgba(201,168,76,.1)",
                color: meta.isLearned ? "var(--green)" : "var(--gold2)",
                border: `1px solid ${meta.isLearned ? "var(--green)" : "var(--gold)"}`,
              }}>
                {meta.isLearned ? "✓ APPRIS" : "EN COURS"}
              </span>
              <span style={{
                fontSize: 9,
                padding: "2px 8px",
                borderRadius: 10,
                background: "rgba(62,184,160,.1)",
                color: "var(--teal2)",
                border: "1px solid var(--teal)",
              }}>
                MAÎTRISE {meta.masteryPct}%
              </span>
            </div>
            <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1, marginTop: 4 }}>
              {meta.surahNameEn.toUpperCase()} ({meta.surahNameAr}) · HIZB {meta.hizb} · JUZ {meta.juz} · {meta.wordsCount} MOTS
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent",
            border: "1px solid var(--border2)",
            color: "var(--text3)",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 12,
            cursor: "pointer",
          }}>✕</button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Ayat Text */}
          {ayatText && (
            <div style={{
              background: "rgba(201,168,76,.04)",
              border: "1px solid rgba(201,168,76,.15)",
              borderRadius: 10,
              padding: "14px 16px",
              textAlign: "right",
              direction: "rtl",
              fontFamily: "'Amiri Quran',serif",
              fontSize: 22,
              lineHeight: 2,
              color: "var(--gold2)",
            }}>
              {ayatText}
            </div>
          )}

          {/* Comparatif Premier vs Dernier jalons */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "var(--gold2)", fontFamily: "'Cinzel',serif", marginBottom: 10 }}>
              ⚖ JALONS CHRONOLOGIQUES : PREMIÈRE FOIS vs DERNIÈRE FOIS
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 10,
            }}>
              {/* Lecture */}
              <div style={{ background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontFamily: "'Cinzel',serif", color: "var(--teal2)", fontWeight: 700 }}>📖 LECTURES ({meta.readCount})</span>
                  <span style={{ fontSize: 8, color: "var(--text3)" }}>{meta.readDates.length} datée(s)</span>
                </div>
                <div style={{ fontSize: 8.5, color: "var(--text2)", display: "flex", flexDirection: "column", gap: 3 }}>
                  <div><span style={{ color: "var(--text3)" }}>1ère lecture :</span> <strong style={{ color: "var(--teal2)" }}>{fmtDate(meta.firstReadAt)}</strong></div>
                  <div><span style={{ color: "var(--text3)" }}>Dernière lecture :</span> <strong style={{ color: "var(--teal)" }}>{fmtDate(meta.lastReadAt)}</strong></div>
                </div>
              </div>

              {/* Apprentissage */}
              <div style={{ background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontFamily: "'Cinzel',serif", color: "var(--green2)", fontWeight: 700 }}>✓ APPRENTISSAGE</span>
                  <span style={{ fontSize: 8, color: meta.isLearned ? "var(--green)" : "var(--text3)" }}>{meta.isLearned ? "Validé" : "Non validé"}</span>
                </div>
                <div style={{ fontSize: 8.5, color: "var(--text2)", display: "flex", flexDirection: "column", gap: 3 }}>
                  <div><span style={{ color: "var(--text3)" }}>1er apprentissage :</span> <strong style={{ color: "var(--green2)" }}>{fmtDate(meta.firstLearnedAt)}</strong></div>
                  <div><span style={{ color: "var(--text3)" }}>Dernier statut appris :</span> <strong style={{ color: "var(--green)" }}>{fmtDate(meta.lastLearnedAt)}</strong></div>
                </div>
              </div>

              {/* Découpage */}
              <div style={{ background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontFamily: "'Cinzel',serif", color: "var(--gold2)", fontWeight: 700 }}>✂ DÉCOUPAGE ({meta.partsCount} parties)</span>
                  <span style={{ fontSize: 8, color: "var(--gold)" }}>{meta.learnedPartsCount}/{meta.partsCount} apprises</span>
                </div>
                <div style={{ fontSize: 8.5, color: "var(--text2)", display: "flex", flexDirection: "column", gap: 3 }}>
                  <div><span style={{ color: "var(--text3)" }}>1er découpage :</span> <strong style={{ color: "var(--gold2)" }}>{fmtDate(meta.firstCutAt)}</strong></div>
                  <div><span style={{ color: "var(--text3)" }}>Dernière modif parties :</span> <strong style={{ color: "var(--gold)" }}>{fmtDate(meta.lastCutAt)}</strong></div>
                </div>
              </div>

              {/* Mots mémorisés */}
              <div style={{ background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontFamily: "'Cinzel',serif", color: "#a8edea", fontWeight: 700 }}>🔤 MOTS MÉMORISÉS</span>
                  <span style={{ fontSize: 8, color: "var(--text3)" }}>{meta.wordsLearnedCount}/{meta.wordsCount}</span>
                </div>
                <div style={{ fontSize: 8.5, color: "var(--text2)", display: "flex", flexDirection: "column", gap: 3 }}>
                  <div><span style={{ color: "var(--text3)" }}>1er mot retenu :</span> <strong style={{ color: "#a8edea" }}>{fmtDate(meta.firstWordLearnedAt)}</strong></div>
                  <div><span style={{ color: "var(--text3)" }}>Dernier mot retenu :</span> <strong style={{ color: "#a8edea" }}>{fmtDate(meta.lastWordLearnedAt)}</strong></div>
                </div>
              </div>

              {/* Révision */}
              <div style={{ background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontFamily: "'Cinzel',serif", color: "#ff9f43", fontWeight: 700 }}>🔖 RÉVISIONS</span>
                  <span style={{ fontSize: 8, color: meta.isCurrentlyToRevise ? "#ff9f43" : "var(--text3)" }}>
                    {meta.isCurrentlyToRevise ? "À réviser actuellement" : "À jour"}
                  </span>
                </div>
                <div style={{ fontSize: 8.5, color: "var(--text2)", display: "flex", flexDirection: "column", gap: 3 }}>
                  <div><span style={{ color: "var(--text3)" }}>1ère mise à réviser :</span> <strong style={{ color: "#ff9f43" }}>{fmtDate(meta.firstRevisedAt)}</strong></div>
                  <div><span style={{ color: "var(--text3)" }}>Dernière mise à réviser :</span> <strong style={{ color: "#ff9f43" }}>{fmtDate(meta.lastRevisedAt)}</strong></div>
                </div>
              </div>

              {/* Récitations & Écritures */}
              <div style={{ background: "var(--surface3)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontFamily: "'Cinzel',serif", color: "#5bc8f5", fontWeight: 700 }}>🎙 TESTS ORAUX & ÉCRITURE</span>
                  <span style={{ fontSize: 8, color: "var(--text3)" }}>{meta.recitAttempts.length} oral / {meta.writingAttempts.length} écrit</span>
                </div>
                <div style={{ fontSize: 8.5, color: "var(--text2)", display: "flex", flexDirection: "column", gap: 3 }}>
                  <div><span style={{ color: "var(--text3)" }}>Oral (1ère/dernière) :</span> <strong>{fmtDateShort(meta.firstRecitAt)} → {fmtDateShort(meta.lastRecitAt)}</strong> {meta.bestRecitScore !== null && `(Max: ${meta.bestRecitScore}%)`}</div>
                  <div><span style={{ color: "var(--text3)" }}>Écrit (1ère/dernière) :</span> <strong>{fmtDateShort(meta.firstWriteAt)} → {fmtDateShort(meta.lastWriteAt)}</strong> {meta.bestWriteScore !== null && `(Max: ${meta.bestWriteScore}%)`}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Focus Révision actuelle si active */}
          {meta.isCurrentlyToRevise && (
            <div style={{
              background: "rgba(255,159,67,.08)",
              border: "1px solid #ff9f43",
              borderRadius: 8,
              padding: "12px 14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}>🔖</span>
                <span style={{ fontSize: 9, letterSpacing: 1.5, color: "#ff9f43", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
                  DÉTAIL DES ÉLÉMENTS À RÉVISER POUR CET AYAT
                </span>
                <span style={{ marginLeft: "auto", fontSize: 8, color: "var(--text3)" }}>
                  Depuis le : {fmtDate(meta.lastRevisedAt)}
                </span>
              </div>
              <div style={{ fontSize: 9, color: "var(--text2)", lineHeight: 1.6 }}>
                {meta.reviseScope === "all" ? (
                  <div>L'ayat entier est actuellement marqué à réviser. Tous les mots et lettres sont concernés.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {meta.reviseWordList.length > 0 && (
                      <div>
                        <strong style={{ color: "var(--gold2)" }}>Mots à réviser ({meta.reviseWordList.length}) : </strong>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, direction: "rtl" }}>
                          {meta.reviseWordList.map((w, idx) => {
                            const origWi = meta.reviseWordIndices[idx];
                            const wDate = getWordReviseDate(ld, origWi) || meta.lastRevisedAt;
                            const timeColor = getReviseTimeColor(wDate);
                            return (
                              <span key={idx}
                                title={`Marqué depuis : ${timeColor.timeLabel} (${timeColor.days}j)`}
                                style={{
                                fontFamily: "'Amiri Quran',serif",
                                fontSize: 16,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: timeColor.rgbaBg,
                                border: `1px solid ${timeColor.rgbaBorder}`,
                                color: timeColor.hex,
                                boxShadow: timeColor.rgbaGlow,
                              }}>{w} <span style={{ fontSize: 9, opacity: 0.8, marginRight: 4, fontFamily: "'Cinzel',serif" }}>({timeColor.timeLabel})</span></span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {Object.keys(meta.reviseCharMap).length > 0 && (
                      <div style={{ fontSize: 8.5, color: "var(--text3)" }}>
                        🔍 Précision lettres : {Object.values(meta.reviseCharMap).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0)} lettre(s) isolée(s) marquée(s).
                      </div>
                    )}
                    {meta.revisePartIds.length > 0 && (
                      <div style={{ fontSize: 8.5, color: "var(--text3)" }}>
                        ✂ Parties ciblées : {meta.revisePartIds.length} partie(s) en alerte.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline chronologique des événements */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "var(--gold2)", fontFamily: "'Cinzel',serif", marginBottom: 10 }}>
              ⏱ FRISÉ CHRONOLOGIQUE DES ACTIONS ({meta.timelineEvents.length} ÉVÉNEMENTS)
            </div>
            {meta.timelineEvents.length === 0 ? (
              <div style={{ fontSize: 9, color: "var(--text3)", fontStyle: "italic", padding: "10px 0" }}>
                Aucun jalon horodaté enregistré pour cet ayat pour le moment.
              </div>
            ) : (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                borderLeft: "2px solid var(--border)",
                paddingLeft: 14,
                marginLeft: 6,
              }}>
                {meta.timelineEvents.map((ev, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10, position: "relative" }}>
                    <div style={{
                      position: "absolute",
                      left: -20,
                      top: 2,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: ev.color,
                      boxShadow: `0 0 6px ${ev.color}`,
                    }} />
                    <span style={{ fontSize: 11 }}>{ev.icon}</span>
                    <span style={{ fontSize: 9, fontFamily: "'Cinzel',serif", color: ev.color, fontWeight: 700, minWidth: 140 }}>
                      {ev.label}
                    </span>
                    <span style={{ fontSize: 8.5, color: "var(--text3)", marginLeft: "auto" }}>
                      {fmtDate(ev.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <button
            onClick={() => {
              onNavigate?.(meta.surahNum, meta.ayatNum);
              onClose();
            }}
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              padding: "6px 14px",
              borderRadius: 6,
              background: "rgba(201,168,76,.15)",
              border: "1px solid var(--gold)",
              color: "var(--gold2)",
              fontFamily: "'Cinzel',serif",
              cursor: "pointer",
            }}
          >
            📖 OUVRIR CE VERSET DANS LE CORAN
          </button>
          <button
            onClick={onClose}
            style={{
              fontSize: 9,
              letterSpacing: 1,
              padding: "6px 14px",
              borderRadius: 6,
              background: "var(--surface3)",
              border: "1px solid var(--border2)",
              color: "var(--text3)",
              fontFamily: "'Cinzel',serif",
              cursor: "pointer",
            }}
          >
            FERMER
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * AyatMetadataExplorer — Complete Dashboard Widget
 * Provides:
 * 1. Ayat Search & Inspector (first/last dates for any verse).
 * 2. Revision Queue (sorted chronologically with word/date details).
 * 3. Multi-level Aggregations (Sourate, Hizb, Juz).
 */
export function AyatMetadataExplorer({
  learnData = {},
  surahs = [],
  surahTextCache = {},
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState("revisions"); // "revisions" | "search" | "aggregations"
  const [aggLevel, setAggLevel] = useState("surahs"); // "surahs" | "hizbs" | "juzs"
  const [selectedAyatKey, setSelectedAyatKey] = useState(null); // "surahNum:ayatNum"
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("date_asc"); // "date_asc" | "date_desc" | "surah"

  // 1. Revision queue
  const rawRevQueue = useMemo(() => computeRevisionQueue(learnData, surahs, surahTextCache), [learnData, surahs, surahTextCache]);
  const revisionQueue = useMemo(() => {
    const list = [...rawRevQueue];
    if (sortOrder === "date_asc") {
      list.sort((a, b) => (a.reviseDate > b.reviseDate ? 1 : -1));
    } else if (sortOrder === "date_desc") {
      list.sort((a, b) => (a.reviseDate < b.reviseDate ? 1 : -1));
    } else if (sortOrder === "surah") {
      list.sort((a, b) => a.surahNum - b.surahNum || a.ayatNum - b.ayatNum);
    }
    return list;
  }, [rawRevQueue, sortOrder]);

  // 2. Aggregations (Sourate, Hizb, Juz)
  const aggregations = useMemo(() => computeQuranAggregations(learnData, surahs, surahTextCache), [learnData, surahs, surahTextCache]);

  // 3. Search filtered ayats
  const filteredAyatResults = useMemo(() => {
    if (!searchQuery.trim()) {
      // Default to recently active ayats
      return Object.entries(learnData)
        .filter(([, v]) => (v.readCount || 0) > 0 || v.learned || v.toRevise || (v.parts || []).length > 0)
        .slice(0, 15)
        .map(([k, ld]) => {
          const [sn, an] = k.split(":").map(Number);
          const txt = surahTextCache[sn]?.[an] || "";
          return extractAyatHistoricalMetadata(k, ld, txt, surahs.find(s => s.number === sn));
        });
    }

    const q = searchQuery.toLowerCase().trim();
    const results = [];

    // Check if query is like "2:255" or "112 1"
    const matchCoord = q.match(/^(\d{1,3})[:\s]+(\d{1,3})$/);
    if (matchCoord) {
      const sn = parseInt(matchCoord[1], 10);
      const an = parseInt(matchCoord[2], 10);
      if (sn >= 1 && sn <= 114) {
        const k = `${sn}:${an}`;
        const ld = learnData[k] || {};
        const txt = surahTextCache[sn]?.[an] || "";
        results.push(extractAyatHistoricalMetadata(k, ld, txt, surahs.find(s => s.number === sn)));
        return results;
      }
    }

    // Search by surah name or number
    for (const s of surahs) {
      if (s.englishName?.toLowerCase().includes(q) || s.name?.includes(q) || String(s.number) === q) {
        const count = s.numberOfAyahs || 7;
        for (let a = 1; a <= Math.min(count, 10); a++) {
          const k = `${s.number}:${a}`;
          const ld = learnData[k] || {};
          const txt = surahTextCache[s.number]?.[a] || "";
          if (ld.readCount || ld.learned || ld.toRevise || (ld.parts || []).length > 0 || txt.includes(q)) {
            results.push(extractAyatHistoricalMetadata(k, ld, txt, s));
          }
        }
      }
    }

    return results.slice(0, 20);
  }, [searchQuery, learnData, surahTextCache, surahs]);

  const fmtDateShort = (d) => {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return d;
    }
  };

  return (
    <div className="dash-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Widget Tabs Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border)",
        paddingBottom: 10,
        flexWrap: "wrap",
        gap: 10,
      }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveTab("revisions")}
            style={{
              fontSize: 8.5,
              letterSpacing: 1.5,
              padding: "5px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "'Cinzel',serif",
              transition: "all .15s",
              background: activeTab === "revisions" ? "rgba(255,159,67,.18)" : "var(--surface3)",
              border: `1px solid ${activeTab === "revisions" ? "#ff9f43" : "var(--border2)"}`,
              color: activeTab === "revisions" ? "#ff9f43" : "var(--text3)",
              fontWeight: activeTab === "revisions" ? 700 : 400,
            }}
          >
            🔖 À RÉVISER PAR DATE ({rawRevQueue.length})
          </button>
          <button
            onClick={() => setActiveTab("search")}
            style={{
              fontSize: 8.5,
              letterSpacing: 1.5,
              padding: "5px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "'Cinzel',serif",
              transition: "all .15s",
              background: activeTab === "search" ? "rgba(62,184,160,.18)" : "var(--surface3)",
              border: `1px solid ${activeTab === "search" ? "var(--teal)" : "var(--border2)"}`,
              color: activeTab === "search" ? "var(--teal2)" : "var(--text3)",
              fontWeight: activeTab === "search" ? 700 : 400,
            }}
          >
            🔍 MÉTADONNÉES HISTORIQUES D'UN AYAT
          </button>
          <button
            onClick={() => setActiveTab("aggregations")}
            style={{
              fontSize: 8.5,
              letterSpacing: 1.5,
              padding: "5px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "'Cinzel',serif",
              transition: "all .15s",
              background: activeTab === "aggregations" ? "rgba(201,168,76,.18)" : "var(--surface3)",
              border: `1px solid ${activeTab === "aggregations" ? "var(--gold)" : "var(--border2)"}`,
              color: activeTab === "aggregations" ? "var(--gold2)" : "var(--text3)",
              fontWeight: activeTab === "aggregations" ? 700 : 400,
            }}
          >
            📊 AGRÉGATION SOURATES · HIZBS · JUZ
          </button>
        </div>

        {/* Global Summary Mini pill */}
        <div style={{
          fontSize: 8,
          fontFamily: "'Cinzel',serif",
          color: "var(--text3)",
          letterSpacing: 1,
          display: "flex",
          gap: 8,
        }}>
          <span>Coran: <strong style={{ color: "var(--gold2)" }}>{aggregations.global.globalMasteryPct}%</strong></span>
          <span>· Appris: <strong style={{ color: "var(--green2)" }}>{aggregations.global.learnedAyahs}</strong></span>
          <span>· Lectures: <strong style={{ color: "var(--teal2)" }}>{aggregations.global.totalRead}</strong></span>
        </div>
      </div>

      {/* ──────────────── TAB 1: REVISIONS CHRONOLOGIQUES ──────────────── */}
      {activeTab === "revisions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}>
            <div style={{ fontSize: 9, letterSpacing: 1, color: "var(--text3)" }}>
              LISTE CHRONOLOGIQUE DES VERSETS À RÉVISER SELON LEUR DATE D'AJOUT ET DÉTAILS DES MOTS
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>TRI :</span>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                style={{
                  fontSize: 8.5,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "var(--surface3)",
                  border: "1px solid var(--border)",
                  color: "var(--text2)",
                  cursor: "pointer",
                }}
              >
                <option value="date_asc">Plus ancien d'abord (Prioritaires)</option>
                <option value="date_desc">Plus récent d'abord</option>
                <option value="surah">Ordre du Coran (Sourate / Ayat)</option>
              </select>
            </div>
          </div>

          {/* Color spectrum banner */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(0,0,0,0.25)",
            padding: "7px 12px",
            borderRadius: 6,
            fontSize: 8,
            color: "var(--text3)",
            letterSpacing: 0.8,
            fontFamily: "'Cinzel',serif",
            flexWrap: "wrap",
            gap: 8,
          }}>
            <span style={{ color: "var(--text2)", fontWeight: 700 }}>COULEUR DES MOTS SELON TEMPS ÉCOULÉ :</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffffff", border: "1px solid #ddd" }} />
                <span>Blanc (Récent &lt;1j)</span>
              </span>
              <span>→</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fef08a" }} />
                <span>Jaune (~3j)</span>
              </span>
              <span>→</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fb923c" }} />
                <span>Orange (~7j)</span>
              </span>
              <span>→</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ color: "#ef4444", fontWeight: 700 }}>Rouge (&gt;14j Urgent)</span>
              </span>
            </div>
          </div>

          {revisionQueue.length === 0 ? (
            <div style={{
              padding: "24px 16px",
              background: "rgba(201,168,76,.04)",
              border: "1px dashed var(--border)",
              borderRadius: 8,
              textAlign: "center",
              color: "var(--text3)",
              fontSize: 9,
              letterSpacing: 1.5,
            }}>
              ✨ AUCUN VERSET N'EST ACTUELLEMENT MARQUÉ À RÉVISER
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
              {revisionQueue.map((item, idx) => (
                <div
                  key={item.key}
                  style={{
                    background: "var(--surface3)",
                    border: "1px solid rgba(255,159,67,.25)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    transition: "border-color .15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "rgba(255,159,67,.15)",
                        border: "1px solid #ff9f43",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 8,
                        color: "#ff9f43",
                        fontFamily: "'Cinzel',serif",
                        fontWeight: 700,
                      }}>{idx + 1}</span>
                      <span style={{
                        fontFamily: "'Cinzel',serif",
                        fontSize: 10,
                        color: "var(--gold2)",
                        fontWeight: 700,
                        letterSpacing: 1,
                      }}>
                        {item.surahNameEn.toUpperCase()} ({item.surahNum}:{item.ayatNum})
                      </span>
                      <span style={{ fontSize: 8, color: "var(--text3)" }}>
                        Hizb {item.hizb} · Juz {item.juz}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 8,
                        color: "#ff9f43",
                        background: "rgba(255,159,67,.1)",
                        border: "1px solid rgba(255,159,67,.3)",
                        padding: "2px 8px",
                        borderRadius: 12,
                      }}>
                        À réviser depuis : {fmtDateShort(item.reviseDate)}
                      </span>
                      <button
                        onClick={() => setSelectedAyatKey(item.key)}
                        style={{
                          fontSize: 8,
                          letterSpacing: 1,
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "transparent",
                          border: "1px solid var(--border2)",
                          color: "var(--text2)",
                          cursor: "pointer",
                        }}
                      >
                        🔍 DÉTAILS HISTORIQUES
                      </button>
                      <button
                        onClick={() => onNavigate?.(item.surahNum, item.ayatNum)}
                        style={{
                          fontSize: 8,
                          letterSpacing: 1,
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "rgba(201,168,76,.15)",
                          border: "1px solid var(--gold)",
                          color: "var(--gold2)",
                          cursor: "pointer",
                        }}
                      >
                        📖 CORAN
                      </button>
                    </div>
                  </div>

                  {/* Ayat text snippet */}
                  {item.ayatText && (
                    <div style={{
                      direction: "rtl",
                      fontFamily: "'Amiri Quran',serif",
                      fontSize: 16,
                      color: "var(--text1)",
                      lineHeight: 1.7,
                      textAlign: "right",
                      opacity: 0.9,
                    }}>
                      {item.ayatText}
                    </div>
                  )}

                  {/* Details of Words to Revise */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>
                      {item.reviseScope === "all" ? "🎯 PORTÉE : AYAT ENTIER" : `🎯 PORTÉE : ${item.reviseWordList.length} MOT(S) CIBLÉ(S)`}
                    </span>
                    {item.reviseScope !== "all" && item.reviseWordList.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, direction: "rtl", marginRight: "auto" }}>
                        {item.reviseWordList.map((w, wi) => {
                          const origWi = item.reviseWordIndices[wi];
                          const wDate = getWordReviseDate(learnData[item.key], origWi) || item.reviseDate;
                          const timeColor = getReviseTimeColor(wDate);
                          return (
                            <span key={wi}
                              title={`Marqué depuis : ${timeColor.timeLabel} (${timeColor.days}j)`}
                              style={{
                              fontFamily: "'Amiri Quran',serif",
                              fontSize: 14,
                              padding: "2px 7px",
                              background: timeColor.rgbaBg,
                              border: `1px solid ${timeColor.rgbaBorder}`,
                              borderRadius: 4,
                              color: timeColor.hex,
                              boxShadow: timeColor.rgbaGlow,
                            }}>{w} <span style={{ fontSize: 8, opacity: 0.8, marginRight: 3, fontFamily: "'Cinzel',serif" }}>({timeColor.timeLabel})</span></span>
                          );
                        })}
                      </div>
                    )}
                    <span style={{ fontSize: 8, color: "var(--text3)", marginLeft: "auto" }}>
                      Lectures: <strong>{item.readCount}×</strong> · 1ère lect: {fmtDateShort(item.firstReadAt)} · 1er découpage: {fmtDateShort(item.firstCutAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──────────────── TAB 2: MÉTADONNÉES HISTORIQUES D'UN AYAT ──────────────── */}
      {activeTab === "search" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher par verset (ex: 2:255, 112 1), nom de sourate..."
              style={{
                flex: 1,
                fontSize: 9.5,
                letterSpacing: 1,
                padding: "8px 12px",
                borderRadius: 6,
                background: "var(--surface3)",
                border: "1px solid var(--border)",
                color: "var(--text1)",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  fontSize: 8.5,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px solid var(--border2)",
                  color: "var(--text3)",
                  cursor: "pointer",
                }}
              >
                EFFACER
              </button>
            )}
          </div>

          <div style={{ fontSize: 8.5, color: "var(--text3)", letterSpacing: 1 }}>
            {searchQuery ? `RÉSULTATS DE RECHERCHE (${filteredAyatResults.length})` : "AYATS RÉCENTS AYANT UN HISTORIQUE — CLIQUEZ POUR VOIR TOUTES LES DATES & MÉTADONNÉES :"}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
            {filteredAyatResults.map(item => (
              <div
                key={item.key}
                onClick={() => setSelectedAyatKey(item.key)}
                style={{
                  background: "var(--surface3)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  transition: "all .15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Cinzel',serif", fontSize: 9.5, color: "var(--gold2)", fontWeight: 700 }}>
                    S.{item.surahNum} : A.{item.ayatNum} ({item.surahNameEn})
                  </span>
                  <span style={{
                    fontSize: 8,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: item.isLearned ? "rgba(76,175,129,.15)" : "rgba(201,168,76,.1)",
                    color: item.isLearned ? "var(--green)" : "var(--gold2)",
                  }}>
                    {item.isLearned ? "✓ Appris" : "En cours"}
                  </span>
                </div>

                {item.ayatText && (
                  <div style={{
                    direction: "rtl",
                    fontFamily: "'Amiri Quran',serif",
                    fontSize: 15,
                    color: "var(--text2)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {item.ayatText}
                  </div>
                )}

                <div style={{ fontSize: 8, color: "var(--text3)", display: "flex", flexDirection: "column", gap: 2 }}>
                  <div>📖 1ère lect: <strong>{fmtDateShort(item.firstReadAt)}</strong> · Dernière: <strong>{fmtDateShort(item.lastReadAt)}</strong> ({item.readCount}×)</div>
                  <div>✓ 1er apprent.: <strong>{fmtDateShort(item.firstLearnedAt)}</strong> · Découpage: <strong>{fmtDateShort(item.firstCutAt)}</strong></div>
                  {item.isCurrentlyToRevise && (
                    <div style={{ color: "#ff9f43" }}>🔖 À réviser depuis le {fmtDateShort(item.lastRevisedAt)} ({item.reviseScope})</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──────────────── TAB 3: AGRÉGATION SOURATE, HIZB & JUZ ──────────────── */}
      {activeTab === "aggregations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Sub-level Selector */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { id: "surahs", label: "SOURATES (114)" },
                { id: "hizbs", label: "HIZBS (60)" },
                { id: "juzs", label: "JUZ (30)" },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setAggLevel(sub.id)}
                  style={{
                    fontSize: 8,
                    letterSpacing: 1.5,
                    padding: "4px 10px",
                    borderRadius: 5,
                    cursor: "pointer",
                    fontFamily: "'Cinzel',serif",
                    background: aggLevel === sub.id ? "rgba(201,168,76,.15)" : "transparent",
                    border: `1px solid ${aggLevel === sub.id ? "var(--gold)" : "var(--border)"}`,
                    color: aggLevel === sub.id ? "var(--gold2)" : "var(--text3)",
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>
              Calcul de maîtrise, versets appris, lectures, découpages et révisions
            </div>
          </div>

          {/* List display based on selected aggregation level */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
            {aggLevel === "surahs" && aggregations.surahs.map(s => (
              <div
                key={s.number}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "var(--surface3)",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "rgba(201,168,76,.1)",
                    border: "1px solid var(--gold)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8,
                    fontFamily: "'Cinzel',serif",
                    color: "var(--gold2)",
                  }}>{s.number}</div>
                  <div>
                    <div style={{ fontSize: 9.5, fontFamily: "'Cinzel',serif", color: "var(--text1)", fontWeight: 700 }}>
                      {s.nameEn} <span style={{ fontFamily: "'Amiri Quran',serif", fontSize: 13, color: "var(--gold2)" }}>{s.nameAr}</span>
                    </div>
                    <div style={{ fontSize: 7.5, color: "var(--text3)" }}>{s.totalAyahs} versets · {s.revelationType}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, maxWidth: 220 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7.5, color: "var(--text3)" }}>
                    <span>Maîtrise: {s.masteryPct}%</span>
                    <span>{s.learnedCount}/{s.totalAyahs} appris</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--surface2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${s.masteryPct}%`, background: masteryColor(s.masteryPct) }} />
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 8, color: "var(--text3)" }}>
                  <span>📖 <strong style={{ color: "var(--teal2)" }}>{s.readCountTotal}</strong> lect.</span>
                  <span>✂ <strong style={{ color: "var(--gold2)" }}>{s.partsCountTotal}</strong> part.</span>
                  {s.toReviseCount > 0 && (
                    <span style={{ color: "#ff9f43", fontWeight: 700 }}>🔖 {s.toReviseCount} à réviser</span>
                  )}
                  <span style={{ fontSize: 7.5 }}>1ère act: {fmtDateShort(s.firstActivityDate)}</span>
                </div>

                <button
                  onClick={() => onNavigate?.(s.number)}
                  style={{
                    fontSize: 8,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "rgba(201,168,76,.1)",
                    border: "1px solid var(--border)",
                    color: "var(--gold2)",
                    cursor: "pointer",
                  }}
                >
                  OUVRIR
                </button>
              </div>
            ))}

            {aggLevel === "hizbs" && aggregations.hizbs.map(h => (
              <div
                key={h.hizbNumber}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "var(--surface3)",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 170 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: "rgba(91,200,245,.1)",
                    border: "1px solid #5bc8f5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8.5,
                    fontFamily: "'Cinzel',serif",
                    color: "#5bc8f5",
                    fontWeight: 700,
                  }}>H{h.hizbNumber}</div>
                  <div>
                    <div style={{ fontSize: 9.5, fontFamily: "'Cinzel',serif", color: "var(--text1)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>HIZB {h.hizbNumber} (Juz {h.juzNumber})</span>
                      {(h.bounds?.pageShort || h.pages?.pageShort) && (
                        <span style={{ fontSize: 7.5, padding: "1px 5px", borderRadius: 4, background: "rgba(200,120,255,.12)", border: "1px solid rgba(200,120,255,.3)", color: "#c878ff", fontWeight: 600 }}>
                          📖 {h.bounds?.pageShort || h.pages?.pageShort}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 7.5, color: "var(--text3)" }}>
                      S.{h.bounds?.startSurah}:{h.bounds?.startAyah} → S.{h.bounds?.endSurah}:{h.bounds?.endAyah} ({h.totalAyahs} v.)
                      {(h.bounds?.pageLabel || h.pages?.pageLabel) && (
                        <span style={{ marginLeft: 6, color: "var(--teal2)" }}>· {h.bounds?.pageLabel || h.pages?.pageLabel}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, maxWidth: 220 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7.5, color: "var(--text3)" }}>
                    <span>Maîtrise: {h.masteryPct}%</span>
                    <span>{h.learnedCount}/{h.totalAyahs} appris</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--surface2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${h.masteryPct}%`, background: masteryColor(h.masteryPct) }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 8, color: "var(--text3)" }}>
                  <span>📖 <strong style={{ color: "var(--teal2)" }}>{h.readCountTotal}</strong> lect.</span>
                  <span>✂ <strong style={{ color: "var(--gold2)" }}>{h.partsCountTotal}</strong> part.</span>
                  {h.toReviseCount > 0 && (
                    <span style={{ color: "#ff9f43", fontWeight: 700 }}>🔖 {h.toReviseCount} à réviser</span>
                  )}
                  <span style={{ fontSize: 7.5 }}>1ère act: {fmtDateShort(h.firstActivityDate)}</span>
                </div>

                <button
                  onClick={() => onNavigate?.(h.bounds?.startSurah, h.bounds?.startAyah)}
                  style={{
                    fontSize: 8,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "rgba(91,200,245,.1)",
                    border: "1px solid var(--border)",
                    color: "#5bc8f5",
                    cursor: "pointer",
                  }}
                >
                  OUVRIR
                </button>
              </div>
            ))}

            {aggLevel === "juzs" && aggregations.juzs.map(j => (
              <div
                key={j.juzNumber}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "var(--surface3)",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 170 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: "rgba(200,120,255,.1)",
                    border: "1px solid #c878ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8.5,
                    fontFamily: "'Cinzel',serif",
                    color: "#c878ff",
                    fontWeight: 700,
                  }}>J{j.juzNumber}</div>
                  <div>
                    <div style={{ fontSize: 9.5, fontFamily: "'Cinzel',serif", color: "var(--text1)", fontWeight: 700 }}>
                      JUZ {j.juzNumber}
                    </div>
                    <div style={{ fontSize: 7.5, color: "var(--text3)" }}>
                      Hizbs {j.hizbNumbers.join(" & ")} ({j.totalAyahs} versets)
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, maxWidth: 220 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7.5, color: "var(--text3)" }}>
                    <span>Maîtrise: {j.masteryPct}%</span>
                    <span>{j.learnedCount}/{j.totalAyahs} appris</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--surface2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${j.masteryPct}%`, background: masteryColor(j.masteryPct) }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 8, color: "var(--text3)" }}>
                  <span>📖 <strong style={{ color: "var(--teal2)" }}>{j.readCountTotal}</strong> lect.</span>
                  <span>✂ <strong style={{ color: "var(--gold2)" }}>{j.partsCountTotal}</strong> part.</span>
                  {j.toReviseCount > 0 && (
                    <span style={{ color: "#ff9f43", fontWeight: 700 }}>🔖 {j.toReviseCount} à réviser</span>
                  )}
                  <span style={{ fontSize: 7.5 }}>1ère act: {fmtDateShort(j.firstActivityDate)}</span>
                </div>

                <button
                  onClick={() => onNavigate?.(j.hizbs[0]?.bounds?.startSurah || 1, j.hizbs[0]?.bounds?.startAyah || 1)}
                  style={{
                    fontSize: 8,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "rgba(200,120,255,.1)",
                    border: "1px solid var(--border)",
                    color: "#c878ff",
                    cursor: "pointer",
                  }}
                >
                  OUVRIR
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Detailed Inspector */}
      {selectedAyatKey && (
        <AyatHistoryModal
          surahNum={parseInt(selectedAyatKey.split(":")[0], 10)}
          ayatNum={parseInt(selectedAyatKey.split(":")[1], 10)}
          learnData={learnData}
          surahTextCache={surahTextCache}
          onClose={() => setSelectedAyatKey(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
