import React, { useState, useMemo } from "react";
import { masteryColor, computeMastery } from "./Mastery.jsx";

export function LearningEvolutionChart({
  learnData = {},
  activity = {},
  surahs = [],
  surahTextCache = {},
  goals = {},
  onNavigate,
}) {
  const [timeRange, setTimeRange] = useState("30d"); // "7d" | "14d" | "30d" | "90d" | "6m" | "1y" | "all"
  const [activeTab, setActiveTab] = useState("cumulative"); // "cumulative" | "velocity" | "stages" | "surahs"
  const [selectedSn, setSelectedSn] = useState(null); // null = global
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [customDailyPace, setCustomDailyPace] = useState(null);

  // List of active surahs that have data in learnData
  const activeSurahNumbers = useMemo(() => {
    const sns = new Set();
    Object.keys(learnData).forEach((k) => {
      const sn = parseInt(k.split(":")[0]);
      if (!isNaN(sn)) sns.add(sn);
    });
    return Array.from(sns).sort((a, b) => a - b);
  }, [learnData]);

  // Number of days in selected timeframe
  const rangeDaysCount = useMemo(() => {
    switch (timeRange) {
      case "7d": return 7;
      case "14d": return 14;
      case "30d": return 30;
      case "90d": return 90;
      case "6m": return 180;
      case "1y": return 365;
      case "all": {
        // Find oldest date
        let oldest = new Date();
        Object.keys(activity).forEach((dStr) => {
          const d = new Date(dStr);
          if (!isNaN(d.getTime()) && d < oldest) oldest = d;
        });
        Object.values(learnData).forEach((v) => {
          if (v?.learnedAt) {
            const d = new Date(v.learnedAt);
            if (!isNaN(d.getTime()) && d < oldest) oldest = d;
          }
        });
        const diffDays = Math.max(30, Math.ceil((new Date() - oldest) / (1000 * 60 * 60 * 24)) + 1);
        return Math.min(diffDays, 730);
      }
      default: return 30;
    }
  }, [timeRange, activity, learnData]);

  // Build daily timeline data for the chosen range
  const timelineData = useMemo(() => {
    const count = rangeDaysCount;
    const now = new Date();
    const list = [];

    // Filter and precompute relevant items once outside the day loop
    const relevantItems = [];
    for (const [key, v] of Object.entries(learnData)) {
      const colon = key.indexOf(":");
      if (colon === -1) continue;
      const sn = parseInt(key.slice(0, colon));
      if (selectedSn && sn !== selectedSn) continue;
      const an = parseInt(key.slice(colon + 1));
      const lDate = v.learnedAt ? v.learnedAt.slice(0, 10) : null;
      const uDate = v.updatedAt ? v.updatedAt.slice(0, 10) : null;
      const text = surahTextCache[sn]?.[an];
      const m = computeMastery(v, text);
      const wCount = v.wordsLearned ? Object.keys(v.wordsLearned).length : 0;
      const hist = v.reviseHistory;
      relevantItems.push({
        lDate,
        uDate,
        learned: !!v.learned,
        wCount,
        m,
        hist: hist && hist.length > 0 ? hist : null,
      });
    }

    const targetSurahMeta = selectedSn ? surahs.find((s) => s.number === selectedSn) : null;
    const targetTotalAyats = targetSurahMeta ? (targetSurahMeta.numberOfAyahs || 1) : 6236;

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const act = activity[dateStr] || {};

      // Calculate cumulative learned up to this date
      let cumulativeLearned = 0;
      let cumulativeWords = 0;
      let cumulativeMasterySum = 0;
      let newLearnedOnDate = 0;
      let updatedOnDate = 0;

      for (let j = 0; j < relevantItems.length; j++) {
        const item = relevantItems[j];
        if (item.lDate === dateStr) {
          newLearnedOnDate++;
        }
        if (item.uDate === dateStr && item.lDate !== dateStr) {
          updatedOnDate++;
        }
        if (item.learned && item.lDate && item.lDate <= dateStr) {
          cumulativeLearned++;
          cumulativeWords += item.wCount;
        }

        // Mastery calculation on dateStr
        if ((item.lDate && item.lDate <= dateStr) || (item.uDate && item.uDate <= dateStr)) {
          if (item.hist) {
            const openOnDate = item.hist.some((e) => {
              const start = e.startDate?.slice(0, 10);
              const end = e.endDate?.slice(0, 10);
              return start && start <= dateStr && (!end || end > dateStr);
            });
            if (openOnDate) continue;
          }
          cumulativeMasterySum += item.m;
        }
      }

      // If activity has recorded ayatsLearned and cumulative is 0 (e.g. no timestamped entries), use activity fallback
      const actLearned = act.ayatsLearned || 0;
      const actRead = act.ayatsRead || 0;

      const masteryPct = targetTotalAyats > 0
        ? Math.min(100, Math.round(cumulativeMasterySum / targetTotalAyats))
        : 0;

      list.push({
        date: dateStr,
        dateObj: d,
        label: d.toLocaleDateString("fr-FR", count <= 14 ? { day: "2-digit", month: "short", weekday: "narrow" } : { day: "2-digit", month: "short" }),
        cumulativeLearned,
        newLearned: newLearnedOnDate || (actLearned > 0 ? actLearned : 0),
        readCount: actRead,
        updatedCount: updatedOnDate,
        masteryPct,
        cumulativeWords,
      });
    }

    // Moving average (7d) for learning pace
    for (let i = 0; i < list.length; i++) {
      const windowStart = Math.max(0, i - 6);
      const windowItems = list.slice(windowStart, i + 1);
      const sumNew = windowItems.reduce((acc, curr) => acc + curr.newLearned, 0);
      list[i].movingAvg = Number((sumNew / windowItems.length).toFixed(1));
    }

    return list;
  }, [rangeDaysCount, learnData, activity, selectedSn, surahs, surahTextCache]);

  // Overall stats & milestones
  const stats = useMemo(() => {
    const entries = Object.entries(learnData);
    const filteredEntries = selectedSn
      ? entries.filter(([k]) => parseInt(k.split(":")[0]) === selectedSn)
      : entries;

    const totalLearned = filteredEntries.filter(([, v]) => v.learned).length;
    const totalWithData = filteredEntries.length;
    const targetSurahMeta = selectedSn ? surahs.find((s) => s.number === selectedSn) : null;
    const totalAyatsGoal = targetSurahMeta ? (targetSurahMeta.numberOfAyahs || 1) : 6236;

    // Total verses in stages
    let stage5 = 0; // Mastered (100% writing or score 5)
    let stage4 = 0; // Solid (score >= 80% or 4)
    let stage3 = 0; // In consolidation (score >= 60% or 3)
    let stage2 = 0; // Started (parts/words validated or in progress)
    let stage1 = 0; // Initial reading only
    let toReviseCount = 0;

    filteredEntries.forEach(([k, v]) => {
      const [sn, an] = k.split(":").map(Number);
      if (v.toRevise) toReviseCount++;

      const memScores = v.memScores || [];
      const writingAttempts = v.writingAttempts || [];
      const bestWrite = writingAttempts.length > 0 ? Math.max(...writingAttempts.map((a) => a.score)) : 0;
      const bestMem = memScores.length > 0 ? Math.max(...memScores) : 0;

      if (v.learned) {
        if (bestWrite === 100 || bestMem === 5) {
          stage5++;
        } else if (bestWrite >= 80 || bestMem >= 4) {
          stage4++;
        } else if (bestWrite >= 60 || bestMem >= 3) {
          stage3++;
        } else {
          stage3++;
        }
      } else {
        const hasParts = (v.parts || []).some((p) => p.learned);
        const hasWords = Object.keys(v.wordsLearned || {}).length > 0;
        if (hasParts || hasWords || (v.readCount || 0) >= 3) {
          stage2++;
        } else if ((v.readCount || 0) > 0) {
          stage1++;
        }
      }
    });

    const notStarted = Math.max(0, totalAyatsGoal - (stage5 + stage4 + stage3 + stage2 + stage1));

    // Calculate pace over last 14 days
    const last14 = timelineData.slice(-14);
    const sum14New = last14.reduce((s, d) => s + d.newLearned, 0);
    const dailyPace = sum14New > 0 ? (sum14New / last14.length) : (totalLearned > 0 ? 0.5 : 0);

    const effectivePace = customDailyPace !== null ? customDailyPace : (dailyPace > 0 ? dailyPace : 1);
    const remainingAyats = Math.max(0, totalAyatsGoal - totalLearned);
    const daysToComplete = effectivePace > 0 ? Math.ceil(remainingAyats / effectivePace) : 0;

    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + daysToComplete);

    // Retention rate
    const retentionRate = totalLearned > 0
      ? Math.round(((totalLearned - toReviseCount) / totalLearned) * 100)
      : 100;

    return {
      totalLearned,
      totalAyatsGoal,
      remainingAyats,
      dailyPace: Number(dailyPace.toFixed(1)),
      effectivePace: Number(effectivePace.toFixed(1)),
      daysToComplete,
      projectedDate,
      retentionRate,
      toReviseCount,
      stages: {
        stage5,
        stage4,
        stage3,
        stage2,
        stage1,
        notStarted,
      },
    };
  }, [learnData, selectedSn, surahs, timelineData, customDailyPace]);

  // Progression per Surah Matrix
  const surahProgressionList = useMemo(() => {
    const map = {};
    for (const [key, ld] of Object.entries(learnData)) {
      const colon = key.indexOf(":");
      if (colon === -1) continue;
      const sn = parseInt(key.slice(0, colon));
      const an = parseInt(key.slice(colon + 1));
      if (!map[sn]) map[sn] = { learnedCount: 0, readCount: 0, toRevise: 0, masteryTotal: 0 };
      if (ld.learned) map[sn].learnedCount++;
      if (ld.toRevise) map[sn].toRevise++;
      map[sn].readCount += ld.readCount || 0;
      const text = surahTextCache[sn]?.[an];
      map[sn].masteryTotal += computeMastery(ld, text);
    }

    return surahs.map((s) => {
      const sn = s.number;
      const st = map[sn] || { learnedCount: 0, readCount: 0, toRevise: 0, masteryTotal: 0 };
      const numAyahs = s.numberOfAyahs || 1;
      const pct = Math.round((st.learnedCount / numAyahs) * 100);
      const masteryPct = Math.round(st.masteryTotal / numAyahs);

      return {
        ...s,
        learnedCount: st.learnedCount,
        readCount: st.readCount,
        toRevise: st.toRevise,
        pct,
        masteryPct,
        active: st.learnedCount > 0 || st.readCount > 0,
      };
    });
  }, [surahs, learnData, surahTextCache]);

  // Chart Dimensions & Geometry for SVG
  const W = 600;
  const H = 220;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 35;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Max value for Cumulative chart
  const maxCumulative = useMemo(() => {
    const vals = timelineData.map((d) => d.cumulativeLearned);
    const maxVal = Math.max(...vals, 1);
    // Round to a visually pleasing tick top
    return Math.max(maxVal + 2, Math.ceil(maxVal * 1.15));
  }, [timelineData]);

  // Max value for Velocity / Daily chart
  const maxVelocity = useMemo(() => {
    const vals = timelineData.map((d) => Math.max(d.newLearned, d.movingAvg || 0));
    const maxVal = Math.max(...vals, 5);
    return Math.ceil(maxVal * 1.25);
  }, [timelineData]);

  const toX = (idx) => {
    if (timelineData.length <= 1) return padL + plotW / 2;
    return padL + (idx / (timelineData.length - 1)) * plotW;
  };

  const toYCum = (val) => {
    return padT + plotH - (val / maxCumulative) * plotH;
  };

  const toYVel = (val) => {
    return padT + plotH - (val / maxVelocity) * plotH;
  };

  // Cumulative Path Points
  const cumPathD = useMemo(() => {
    if (!timelineData.length) return "";
    return timelineData.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toYCum(d.cumulativeLearned).toFixed(1)}`).join(" ");
  }, [timelineData, maxCumulative]);

  const cumAreaD = useMemo(() => {
    if (!timelineData.length) return "";
    const firstX = toX(0).toFixed(1);
    const lastX = toX(timelineData.length - 1).toFixed(1);
    const bottomY = (padT + plotH).toFixed(1);
    return `${cumPathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [cumPathD, timelineData]);

  // Velocity Moving Avg Path Points
  const velMovingAvgD = useMemo(() => {
    if (!timelineData.length) return "";
    return timelineData.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toYVel(d.movingAvg || 0).toFixed(1)}`).join(" ");
  }, [timelineData, maxVelocity]);

  // Y-Axis Ticks
  const cumYTicks = [0, Math.round(maxCumulative * 0.25), Math.round(maxCumulative * 0.5), Math.round(maxCumulative * 0.75), maxCumulative];
  const velYTicks = [0, Math.round(maxVelocity * 0.33), Math.round(maxVelocity * 0.66), maxVelocity];

  const currentSurah = selectedSn ? surahs.find((s) => s.number === selectedSn) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "18px 20px",
        background: "var(--surface2)",
        borderRadius: 14,
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
      }}
    >
      {/* ── HEADER & TITLE ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>📈</span>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 2, color: "var(--gold2)", fontWeight: 700 }}>
              ÉVOLUTION DE L'APPRENTISSAGE
            </div>
          </div>
          <div style={{ fontSize: 8.5, color: "var(--text3)", letterSpacing: 1, marginTop: 3 }}>
            {selectedSn
              ? `Progression spécifique : ${currentSurah?.englishName || `Sourate ${selectedSn}`} (${currentSurah?.name || ""})`
              : "Suivi chronologique, vitesse de mémorisation & trajectoire globale du Coran"}
          </div>
        </div>

        {/* TIME RANGE SELECTOR */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface3)", padding: "3px 4px", borderRadius: 8, border: "1px solid var(--border2)" }}>
          {[
            { id: "7d", label: "7J" },
            { id: "14d", label: "14J" },
            { id: "30d", label: "30J" },
            { id: "90d", label: "3 MOIS" },
            { id: "6m", label: "6 MOIS" },
            { id: "1y", label: "1 AN" },
            { id: "all", label: "TOUT" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTimeRange(t.id)}
              style={{
                padding: "3px 8px",
                fontSize: 8,
                fontFamily: "'Cinzel',serif",
                letterSpacing: 1,
                border: "none",
                borderRadius: 5,
                background: timeRange === t.id ? "rgba(201,168,76,0.2)" : "transparent",
                color: timeRange === t.id ? "var(--gold2)" : "var(--text3)",
                fontWeight: timeRange === t.id ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI HIGHLIGHT CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))", gap: 10 }}>
        <div style={{ background: "var(--surface3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 7.5, color: "var(--text3)", letterSpacing: 1 }}>VERSETS APPRIS</div>
          <div style={{ fontSize: 20, fontFamily: "'Cinzel',serif", color: "var(--green)", fontWeight: 700, marginTop: 2 }}>
            {stats.totalLearned}
            <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400 }}> / {stats.totalAyatsGoal}</span>
          </div>
          <div style={{ fontSize: 7.5, color: "var(--green2)", marginTop: 2 }}>
            {((stats.totalLearned / stats.totalAyatsGoal) * 100).toFixed(1)}% complété
          </div>
        </div>

        <div style={{ background: "var(--surface3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 7.5, color: "var(--text3)", letterSpacing: 1 }}>RYTHME MOYEN</div>
          <div style={{ fontSize: 20, fontFamily: "'Cinzel',serif", color: "var(--gold2)", fontWeight: 700, marginTop: 2 }}>
            +{stats.dailyPace}
            <span style={{ fontSize: 9, color: "var(--text3)", fontWeight: 400 }}> / jour</span>
          </div>
          <div style={{ fontSize: 7.5, color: "var(--text3)", marginTop: 2 }}>
            ~{(stats.dailyPace * 7).toFixed(0)} versets / sem.
          </div>
        </div>

        <div style={{ background: "var(--surface3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 7.5, color: "var(--text3)", letterSpacing: 1 }}>TAUX DE RÉTENTION</div>
          <div style={{ fontSize: 20, fontFamily: "'Cinzel',serif", color: stats.retentionRate >= 85 ? "var(--teal2)" : "var(--gold)", fontWeight: 700, marginTop: 2 }}>
            {stats.retentionRate}%
          </div>
          <div style={{ fontSize: 7.5, color: "var(--text3)", marginTop: 2 }}>
            {stats.toReviseCount} à réviser
          </div>
        </div>

        <div style={{ background: "var(--surface3)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 7.5, color: "var(--text3)", letterSpacing: 1 }}>PROJECTION ACHÈVEMENT</div>
          <div style={{ fontSize: 14, fontFamily: "'Cinzel',serif", color: "var(--gold)", fontWeight: 700, marginTop: 4 }}>
            {stats.remainingAyats === 0
              ? "Terminé ! 🎉"
              : stats.projectedDate.toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
          </div>
          <div style={{ fontSize: 7.5, color: "var(--text3)", marginTop: 2 }}>
            {stats.remainingAyats === 0 ? "100% mémorisé" : `dans ~${stats.daysToComplete} jours`}
          </div>
        </div>
      </div>

      {/* ── SUB-TABS & SURAH FILTER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
        {/* VIEW TABS */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { id: "cumulative", label: "📈 COURBE CUMULÉE", desc: "Progression totale" },
            { id: "velocity", label: "📊 RYTHME QUOTIDIEN", desc: "Nouveaux & répétitions" },
            { id: "stages", label: "🎯 STADES D'ANCRAGE", desc: "Niveaux de mémoire" },
            { id: "surahs", label: "🕋 PAR SOURATE", desc: "Matrice de progression" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "6px 12px",
                fontSize: 8.5,
                fontFamily: "'Cinzel',serif",
                letterSpacing: 1.5,
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: activeTab === tab.id ? 700 : 500,
                background: activeTab === tab.id ? "rgba(201,168,76,0.15)" : "transparent",
                border: `1px solid ${activeTab === tab.id ? "var(--gold)" : "transparent"}`,
                color: activeTab === tab.id ? "var(--gold2)" : "var(--text3)",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* SURAH FILTER PILLS */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, overflowX: "auto", maxWidth: "100%", padding: "2px 0" }}>
          <button
            onClick={() => setSelectedSn(null)}
            style={{
              fontSize: 7.5,
              padding: "3px 8px",
              borderRadius: 12,
              border: `1px solid ${selectedSn === null ? "var(--gold)" : "var(--border2)"}`,
              background: selectedSn === null ? "rgba(201,168,76,0.15)" : "transparent",
              color: selectedSn === null ? "var(--gold2)" : "var(--text3)",
              cursor: "pointer",
              fontFamily: "'Cinzel',serif",
              whiteSpace: "nowrap",
            }}
          >
            TOUT LE CORAN
          </button>
          {activeSurahNumbers.slice(0, 8).map((sn) => {
            const s = surahs.find((x) => x.number === sn);
            return (
              <button
                key={sn}
                onClick={() => setSelectedSn(selectedSn === sn ? null : sn)}
                style={{
                  fontSize: 7.5,
                  padding: "3px 8px",
                  borderRadius: 12,
                  border: `1px solid ${selectedSn === sn ? "var(--gold)" : "var(--border2)"}`,
                  background: selectedSn === sn ? "rgba(201,168,76,0.15)" : "transparent",
                  color: selectedSn === sn ? "var(--gold2)" : "var(--text3)",
                  cursor: "pointer",
                  fontFamily: "'Cinzel',serif",
                  whiteSpace: "nowrap",
                }}
              >
                {s?.englishName || `S.${sn}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB 1: CUMULATIVE LEARNING EVOLUTION ── */}
      {activeTab === "cumulative" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative", width: "100%", height: H, background: "rgba(0,0,0,0.15)", borderRadius: 10, padding: 4 }}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: "100%", height: "100%", overflow: "visible" }}
              preserveAspectRatio="none"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="cumGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--green)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--green)" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--teal2)" />
                  <stop offset="50%" stopColor="var(--green)" />
                  <stop offset="100%" stopColor="var(--gold2)" />
                </linearGradient>
              </defs>

              {/* GRID LINES & Y-TICKS */}
              {cumYTicks.map((tick, i) => {
                const y = toYCum(tick);
                return (
                  <g key={i}>
                    <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <text x={padL - 6} y={y + 3} textAnchor="end" fill="var(--text3)" fontSize="8" fontFamily="'Cinzel',serif">
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* AREA FILL */}
              {cumAreaD && <path d={cumAreaD} fill="url(#cumGradient)" />}

              {/* MAIN CUMULATIVE LINE */}
              {cumPathD && (
                <path
                  d={cumPathD}
                  fill="none"
                  stroke="url(#lineGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* DATA POINTS & INTERACTIVE HOVER */}
              {timelineData.map((d, i) => {
                const x = toX(i);
                const y = toYCum(d.cumulativeLearned);
                const isHovered = hoveredPoint?.index === i;
                const isMilestone = d.newLearned > 0 || i === timelineData.length - 1 || i % Math.ceil(timelineData.length / 8) === 0;

                return (
                  <g key={i}>
                    {/* Invisible hover capture column */}
                    <rect
                      x={x - (plotW / timelineData.length) / 2}
                      y={padT}
                      width={plotW / timelineData.length}
                      height={plotH}
                      fill="transparent"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoveredPoint({ ...d, index: i, x, y })}
                    />

                    {isMilestone && (
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 5 : d.newLearned > 0 ? 3.5 : 2}
                        fill={d.newLearned > 0 ? "var(--gold)" : "var(--green)"}
                        stroke="var(--surface)"
                        strokeWidth="1.5"
                      />
                    )}
                  </g>
                );
              })}

              {/* HOVER VERTICAL LINE & HIGHLIGHT */}
              {hoveredPoint && (
                <g>
                  <line
                    x1={hoveredPoint.x}
                    y1={padT}
                    x2={hoveredPoint.x}
                    y2={padT + plotH}
                    stroke="var(--gold)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.y}
                    r="6"
                    fill="var(--gold)"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* X-AXIS LABELS */}
              {timelineData
                .filter((_, i) => i % Math.ceil(timelineData.length / 6) === 0 || i === timelineData.length - 1)
                .map((d, i, arr) => {
                  const idx = timelineData.indexOf(d);
                  const x = toX(idx);
                  return (
                    <text
                      key={i}
                      x={x}
                      y={padT + plotH + 18}
                      textAnchor={idx === 0 ? "start" : idx === timelineData.length - 1 ? "end" : "middle"}
                      fill="var(--text3)"
                      fontSize="8"
                      fontFamily="'Cinzel',serif"
                    >
                      {d.label}
                    </text>
                  );
                })}
            </svg>

            {/* FLOATING HOVER TOOLTIP */}
            {hoveredPoint && (
              <div
                style={{
                  position: "absolute",
                  left: Math.min(Math.max(10, (hoveredPoint.x / W) * 100), 75) + "%",
                  top: 10,
                  transform: "translateX(-50%)",
                  background: "var(--surface)",
                  border: "1px solid var(--gold)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  pointerEvents: "none",
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <div style={{ fontSize: 8.5, color: "var(--gold2)", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
                  {hoveredPoint.date} ({hoveredPoint.label})
                </div>
                <div style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>
                  {hoveredPoint.cumulativeLearned} versets cumulés
                </div>
                {hoveredPoint.newLearned > 0 && (
                  <div style={{ fontSize: 8.5, color: "var(--gold)" }}>
                    ✨ +{hoveredPoint.newLearned} nouveau(x) verset(s) appris
                  </div>
                )}
                {hoveredPoint.readCount > 0 && (
                  <div style={{ fontSize: 8, color: "var(--text3)" }}>
                    📖 {hoveredPoint.readCount} récitations / lectures
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: LEARNING VELOCITY & DAILY PACE ── */}
      {activeTab === "velocity" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative", width: "100%", height: H, background: "rgba(0,0,0,0.15)", borderRadius: 10, padding: 4 }}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: "100%", height: "100%", overflow: "visible" }}
              preserveAspectRatio="none"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {/* GRID LINES & Y-TICKS */}
              {velYTicks.map((tick, i) => {
                const y = toYVel(tick);
                return (
                  <g key={i}>
                    <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <text x={padL - 6} y={y + 3} textAnchor="end" fill="var(--text3)" fontSize="8" fontFamily="'Cinzel',serif">
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* BARS FOR NEW LEARNED & REVISIONS */}
              {timelineData.map((d, i) => {
                const x = toX(i);
                const barWidth = Math.max(3, (plotW / timelineData.length) * 0.65);
                const barX = x - barWidth / 2;

                const newH = (d.newLearned / maxVelocity) * plotH;
                const newY = padT + plotH - newH;

                const readH = Math.min((d.readCount / maxVelocity) * plotH, plotH - newH);
                const readY = newY - readH;

                return (
                  <g key={i}>
                    {/* Read count bar (Teal) */}
                    {readH > 0 && (
                      <rect
                        x={barX}
                        y={readY}
                        width={barWidth}
                        height={readH}
                        fill="rgba(62,184,160,0.3)"
                        rx="1"
                      />
                    )}
                    {/* New learned bar (Green) */}
                    {newH > 0 && (
                      <rect
                        x={barX}
                        y={newY}
                        width={barWidth}
                        height={newH}
                        fill="var(--green)"
                        rx="1.5"
                      />
                    )}

                    {/* Invisible Hover Rect */}
                    <rect
                      x={x - (plotW / timelineData.length) / 2}
                      y={padT}
                      width={plotW / timelineData.length}
                      height={plotH}
                      fill="transparent"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoveredPoint({ ...d, index: i, x, y: newY })}
                    />
                  </g>
                );
              })}

              {/* MOVING AVERAGE LINE (GOLD) */}
              {velMovingAvgD && (
                <path
                  d={velMovingAvgD}
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}

              {/* X-AXIS LABELS */}
              {timelineData
                .filter((_, i) => i % Math.ceil(timelineData.length / 6) === 0 || i === timelineData.length - 1)
                .map((d, i) => {
                  const idx = timelineData.indexOf(d);
                  const x = toX(idx);
                  return (
                    <text
                      key={i}
                      x={x}
                      y={padT + plotH + 18}
                      textAnchor={idx === 0 ? "start" : idx === timelineData.length - 1 ? "end" : "middle"}
                      fill="var(--text3)"
                      fontSize="8"
                      fontFamily="'Cinzel',serif"
                    >
                      {d.label}
                    </text>
                  );
                })}
            </svg>

            {/* VELOCITY HOVER TOOLTIP */}
            {hoveredPoint && (
              <div
                style={{
                  position: "absolute",
                  left: Math.min(Math.max(10, (hoveredPoint.x / W) * 100), 75) + "%",
                  top: 10,
                  transform: "translateX(-50%)",
                  background: "var(--surface)",
                  border: "1px solid var(--gold)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  pointerEvents: "none",
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <div style={{ fontSize: 8.5, color: "var(--gold2)", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
                  {hoveredPoint.date} ({hoveredPoint.label})
                </div>
                <div style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}>
                  +{hoveredPoint.newLearned} verset(s) appris
                </div>
                <div style={{ fontSize: 8.5, color: "var(--teal2)" }}>
                  📖 {hoveredPoint.readCount} lecture(s) / révision(s)
                </div>
                <div style={{ fontSize: 8, color: "var(--gold)" }}>
                  Moyenne 7j : {hoveredPoint.movingAvg} versets/j
                </div>
              </div>
            )}
          </div>

          {/* VELOCITY LEGEND */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, fontSize: 8, color: "var(--text3)", letterSpacing: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--green)" }} />
              <span>Nouveaux versets appris</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(62,184,160,0.4)" }} />
              <span>Répétitions & Lectures</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 14, height: 2, background: "var(--gold)" }} />
              <span>Moyenne mobile (7 jours)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: STAGES OF MEMORIZATION & RETENTION BREAKDOWN ── */}
      {activeTab === "stages" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* STAGES BAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "var(--text3)", letterSpacing: 1 }}>
              <span>RÉPARTITION PAR NIVEAU DE MAÎTRISE</span>
              <span style={{ color: "var(--gold2)", fontWeight: 700 }}>
                {stats.totalLearned} / {stats.totalAyatsGoal} versets engagés
              </span>
            </div>

            <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "var(--surface3)" }}>
              <div
                title={`Niveau 5 (Ancré / Sans faute) : ${stats.stages.stage5}`}
                style={{
                  width: `${(stats.stages.stage5 / stats.totalAyatsGoal) * 100}%`,
                  background: "var(--gold)",
                  transition: "width 0.4s",
                }}
              />
              <div
                title={`Niveau 4 (Solide) : ${stats.stages.stage4}`}
                style={{
                  width: `${(stats.stages.stage4 / stats.totalAyatsGoal) * 100}%`,
                  background: "var(--green)",
                  transition: "width 0.4s",
                }}
              />
              <div
                title={`Niveau 3 (En consolidation) : ${stats.stages.stage3}`}
                style={{
                  width: `${(stats.stages.stage3 / stats.totalAyatsGoal) * 100}%`,
                  background: "var(--teal)",
                  transition: "width 0.4s",
                }}
              />
              <div
                title={`Niveau 2 (En cours) : ${stats.stages.stage2}`}
                style={{
                  width: `${(stats.stages.stage2 / stats.totalAyatsGoal) * 100}%`,
                  background: "rgba(201,168,76,0.3)",
                  transition: "width 0.4s",
                }}
              />
              <div
                title={`Niveau 1 (Découverte) : ${stats.stages.stage1}`}
                style={{
                  width: `${(stats.stages.stage1 / stats.totalAyatsGoal) * 100}%`,
                  background: "rgba(255,255,255,0.1)",
                  transition: "width 0.4s",
                }}
              />
            </div>
          </div>

          {/* STAGES CARDS GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {[
              {
                tier: "NIVEAU 5",
                name: "Ancré & Sans Faute",
                desc: "100% de réussite aux tests",
                count: stats.stages.stage5,
                color: "var(--gold)",
                bg: "rgba(201,168,76,0.1)",
              },
              {
                tier: "NIVEAU 4",
                name: "Solide & Mémorisé",
                desc: "Score >= 80% régulier",
                count: stats.stages.stage4,
                color: "var(--green)",
                bg: "rgba(76,175,129,0.1)",
              },
              {
                tier: "NIVEAU 3",
                name: "En Consolidation",
                desc: "Appris avec petites hésitations",
                count: stats.stages.stage3,
                color: "var(--teal2)",
                bg: "rgba(62,184,160,0.1)",
              },
              {
                tier: "NIVEAU 2",
                name: "Mots & Segments",
                desc: "Parties validées en apprentissage",
                count: stats.stages.stage2,
                color: "var(--text2)",
                bg: "var(--surface3)",
              },
              {
                tier: "NIVEAU 1",
                name: "Découverte & Lecture",
                desc: "Récité et écouté plusieurs fois",
                count: stats.stages.stage1,
                color: "var(--text3)",
                bg: "var(--surface3)",
              },
              {
                tier: "RESTE",
                name: "Non Commencé",
                desc: "Versets à découvrir",
                count: stats.stages.notStarted,
                color: "var(--text3)",
                bg: "var(--surface3)",
              },
            ].map((st, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  background: st.bg,
                  borderRadius: 8,
                  border: `1px solid ${st.color}33`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 7.5, letterSpacing: 1.5, color: st.color, fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
                    {st.tier}
                  </span>
                  <span style={{ fontSize: 13, fontFamily: "'Cinzel',serif", color: st.color, fontWeight: 700 }}>
                    {st.count}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: "var(--text)", fontWeight: 600 }}>{st.name}</div>
                <div style={{ fontSize: 7.5, color: "var(--text3)" }}>{st.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: SURAH & JUZ PROGRESSION MATRIX ── */}
      {activeTab === "surahs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 8.5, color: "var(--text3)", letterSpacing: 1 }}>
            SOURATES LES PLUS AVANCÉES DANS L'APPRENTISSAGE
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto", paddingRight: 4 }}>
            {surahProgressionList
              .filter((s) => s.active || s.pct > 0)
              .sort((a, b) => b.pct - a.pct || b.readCount - a.readCount)
              .map((s) => (
                <div
                  key={s.number}
                  onClick={() => onNavigate?.(s.number)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    background: "var(--surface3)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    cursor: onNavigate ? "pointer" : "default",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "rgba(201,168,76,0.1)",
                      border: "1px solid var(--gold)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 8.5,
                      fontFamily: "'Cinzel',serif",
                      color: "var(--gold2)",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {s.number}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 9.5, color: "var(--text)", fontWeight: 600, letterSpacing: 0.5 }}>
                        {s.englishName}
                        <span style={{ fontSize: 8, color: "var(--text3)", marginLeft: 6 }}>
                          ({s.learnedCount}/{s.numberOfAyahs} versets)
                        </span>
                      </div>
                      <div style={{ fontFamily: "'Amiri Quran',serif", fontSize: 13, color: "var(--gold)", direction: "rtl" }}>
                        {s.name}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${s.pct}%`,
                            height: "100%",
                            background: s.pct === 100 ? "var(--gold)" : s.pct >= 50 ? "var(--green)" : "var(--teal2)",
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 8.5, fontFamily: "'Cinzel',serif", color: masteryColor(s.pct), fontWeight: 700, width: 32, textAlign: "right" }}>
                        {s.pct}%
                      </span>
                    </div>
                  </div>

                  {s.pct === 100 && (
                    <div style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: "rgba(201,168,76,0.15)", color: "var(--gold2)", border: "1px solid var(--gold)" }}>
                      ★ 100%
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── INTERACTIVE PACE SIMULATOR / GOAL PROJECTION ── */}
      <div style={{ marginTop: 4, padding: "10px 14px", background: "rgba(201,168,76,0.06)", borderRadius: 8, border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>🎯</span>
          <div>
            <div style={{ fontSize: 8.5, fontFamily: "'Cinzel',serif", color: "var(--gold2)", fontWeight: 700 }}>
              SIMULATEUR DE RYTHME D'APPRENTISSAGE
            </div>
            <div style={{ fontSize: 7.5, color: "var(--text3)" }}>
              Ajustez votre cadence pour projeter votre date d'achèvement
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 5, 10].map((num) => (
              <button
                key={num}
                onClick={() => setCustomDailyPace(num)}
                style={{
                  padding: "3px 7px",
                  fontSize: 8,
                  fontFamily: "'Cinzel',serif",
                  borderRadius: 4,
                  border: `1px solid ${stats.effectivePace === num ? "var(--gold)" : "var(--border2)"}`,
                  background: stats.effectivePace === num ? "var(--gold)" : "transparent",
                  color: stats.effectivePace === num ? "#000" : "var(--text2)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {num}/j
              </button>
            ))}
          </div>

          <div style={{ fontSize: 8.5, color: "var(--gold2)", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
            ➜ Fin projetée : {stats.projectedDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>
    </div>
  );
}
