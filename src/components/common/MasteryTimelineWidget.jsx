import React, { useState, useMemo } from "react";
import { computeMastery, masteryColor } from "./Mastery.jsx";

export function MasteryTimelineWidget({
  learnData = {},
  surahs = [],
  surahTextCache = {},
  onNavigate,
}) {
  const [selectedSn, setSelectedSn] = useState(null); // null = Tout le Coran
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // List of surahs that have learning activity or progress
  const studiedSurahNumbers = useMemo(() => {
    const sns = new Set();
    Object.keys(learnData).forEach((k) => {
      const sn = parseInt(k.split(":")[0]);
      if (!isNaN(sn) && sn >= 1 && sn <= 114) {
        sns.add(sn);
      }
    });
    return Array.from(sns).sort((a, b) => a - b);
  }, [learnData]);

  // Precompute stats per studied surah
  const surahStatsMap = useMemo(() => {
    const map = {};
    surahs.forEach((s) => {
      const sn = s.number;
      let learnedCount = 0;
      let masterySum = 0;
      const total = s.numberOfAyahs || 1;

      for (let an = 1; an <= total; an++) {
        const key = `${sn}:${an}`;
        const ld = learnData[key];
        if (ld) {
          if (ld.learned) learnedCount++;
          const text = surahTextCache[sn]?.[an];
          masterySum += computeMastery(ld, text);
        }
      }
      const pct = Math.min(100, Math.round(masterySum / total));
      map[sn] = { learnedCount, total, pct };
    });
    return map;
  }, [surahs, learnData, surahTextCache]);

  // Selected surah metadata
  const currentSurahMeta = useMemo(() => {
    if (!selectedSn) return null;
    return surahs.find((s) => s.number === selectedSn) || null;
  }, [selectedSn, surahs]);

  const currentSurahStats = useMemo(() => {
    if (!selectedSn) return null;
    return surahStatsMap[selectedSn] || { learnedCount: 0, total: currentSurahMeta?.numberOfAyahs || 0, pct: 0 };
  }, [selectedSn, surahStatsMap, currentSurahMeta]);

  // Global Quran stats
  const globalStats = useMemo(() => {
    let totalLearned = 0;
    let totalMasterySum = 0;
    Object.entries(learnData).forEach(([key, v]) => {
      const [sn, an] = key.split(":").map(Number);
      if (v?.learned) totalLearned++;
      const text = surahTextCache[sn]?.[an];
      totalMasterySum += computeMastery(v, text);
    });
    const pct = Math.min(100, Math.round((totalMasterySum / 6236) * 100) / 100);
    return { totalLearned, totalMasterySum: Math.round(totalMasterySum), pct };
  }, [learnData, surahTextCache]);

  // Compute 30-day timeline points
  const days = 30;
  const timelinePoints = useMemo(() => {
    const points = [];
    const totalAyatsCount = currentSurahMeta ? (currentSurahMeta.numberOfAyahs || 1) : 6236;
    const entries = Object.entries(learnData);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      let masterySum = 0;
      let countLearned = 0;

      for (const [key, v] of entries) {
        const [sn, an] = key.split(":").map(Number);
        if (selectedSn && sn !== selectedSn) continue;

        // If marked learned or updated on or before this date
        const itemDate = (v.learnedAt || v.updatedAt || "1970-01-01").slice(0, 10);
        if (itemDate <= dateStr) {
          const hist = v.reviseHistory || [];
          const openOnDate = hist.some((e) => {
            const start = e.startDate?.slice(0, 10);
            const end = e.endDate?.slice(0, 10);
            return start && start <= dateStr && (!end || end > dateStr);
          });
          if (!openOnDate) {
            const text = surahTextCache[sn]?.[an];
            const m = computeMastery(v, text);
            masterySum += m;
            if (v.learned) countLearned++;
          }
        }
      }

      const pct = totalAyatsCount > 0 ? Math.min(100, Math.round(masterySum / totalAyatsCount)) : 0;
      points.push({
        date: dateStr,
        label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        learned: Math.round(masterySum),
        countLearned,
        total: totalAyatsCount,
        pct,
      });
    }
    return points;
  }, [days, currentSurahMeta, learnData, selectedSn, surahTextCache]);

  const latestPoint = timelinePoints[timelinePoints.length - 1] || { pct: 0, learned: 0 };
  const firstPoint = timelinePoints[0] || { pct: 0, learned: 0 };
  const delta30d = latestPoint.pct - firstPoint.pct;

  // Filtered recent learned ayats (specific to selected surah if any)
  const recentlyLearnedList = useMemo(() => {
    return Object.entries(learnData)
      .filter(([key, v]) => {
        if (!v.learned) return false;
        if (selectedSn) {
          const sn = parseInt(key.split(":")[0]);
          if (sn !== selectedSn) return false;
        }
        return true;
      })
      .sort(([, a], [, b]) => {
        const da = a.learnedAt || a.updatedAt || "";
        const db = b.learnedAt || b.updatedAt || "";
        return db.localeCompare(da);
      })
      .slice(0, 4);
  }, [learnData, selectedSn]);

  // Previous & Next Surah helpers
  const handlePrevSurah = () => {
    if (!selectedSn) {
      if (studiedSurahNumbers.length > 0) setSelectedSn(studiedSurahNumbers[studiedSurahNumbers.length - 1]);
      return;
    }
    const idx = studiedSurahNumbers.indexOf(selectedSn);
    if (idx > 0) {
      setSelectedSn(studiedSurahNumbers[idx - 1]);
    } else if (selectedSn > 1) {
      setSelectedSn(selectedSn - 1);
    } else {
      setSelectedSn(null);
    }
  };

  const handleNextSurah = () => {
    if (!selectedSn) {
      if (studiedSurahNumbers.length > 0) setSelectedSn(studiedSurahNumbers[0]);
      return;
    }
    const idx = studiedSurahNumbers.indexOf(selectedSn);
    if (idx >= 0 && idx < studiedSurahNumbers.length - 1) {
      setSelectedSn(studiedSurahNumbers[idx + 1]);
    } else if (selectedSn < 114) {
      setSelectedSn(selectedSn + 1);
    } else {
      setSelectedSn(null);
    }
  };

  // SVG Chart Geometry
  const W = 620;
  const H = 160;
  const padL = 48; // Space for readable Y ticks (e.g. "100%")
  const padR = 24;
  const padT = 20;
  const padB = 36; // Space for readable dates (e.g. "15 sept")
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Y domain driven by actual data range with buffer
  const pcts = timelinePoints.map((p) => p.pct);
  const minDataPct = Math.min(...pcts);
  const maxDataPct = Math.max(...pcts);

  // Determine pleasing Y bounds
  const yMin = Math.max(0, minDataPct > 15 ? Math.floor((minDataPct - 8) / 5) * 5 : 0);
  const yMax = Math.min(100, Math.max(minDataPct + 5, Math.ceil((maxDataPct + 5) / 5) * 5));
  const yRange = yMax - yMin || 1;

  const toX = (i) => padL + (i / (timelinePoints.length - 1)) * plotW;
  const toY = (pct) => padT + plotH - ((pct - yMin) / yRange) * plotH;

  const yTicks = [yMin, Math.round(yMin + yRange * 0.33), Math.round(yMin + yRange * 0.66), yMax];

  const linePointsD = timelinePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.pct).toFixed(1)}`).join(" ");
  const fillPointsD = linePointsD
    ? `${linePointsD} L ${(padL + plotW).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${padL.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
    : "";

  const currentColor = masteryColor(latestPoint.pct);

  // Filtered surahs for search input if used
  const filteredSurahs = useMemo(() => {
    if (!searchQuery.trim()) return surahs;
    const q = searchQuery.toLowerCase().trim();
    return surahs.filter(
      (s) =>
        s.number.toString() === q ||
        s.englishName.toLowerCase().includes(q) ||
        s.englishNameTranslation?.toLowerCase().includes(q) ||
        s.name.includes(q)
    );
  }, [surahs, searchQuery]);

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
        boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
      }}
    >
      {/* ── 1. HEADER & SURAH SELECTOR ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>📈</span>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 2, color: "var(--gold2)", fontWeight: 700 }}>
              MAÎTRISE DANS LE TEMPS (30 JOURS)
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: 0.5, marginTop: 4 }}>
            Courbe de progression quotidienne de la rétention et des versets mémorisés
          </div>
        </div>

        {/* CONTROLS: PREV / SELECT / NEXT */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Previous Surah button */}
          <button
            onClick={handlePrevSurah}
            title="Sourate précédente"
            style={{
              padding: "7px 10px",
              background: "var(--surface3)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text2)",
              cursor: "pointer",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
          >
            ◀
          </button>

          {/* Clean styled Dropdown Selector */}
          <div style={{ position: "relative" }}>
            <select
              value={selectedSn === null ? "" : selectedSn}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSn(val === "" ? null : Number(val));
              }}
              style={{
                padding: "8px 32px 8px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                background: selectedSn ? "rgba(201,168,76,0.12)" : "var(--surface3)",
                border: `1.5px solid ${selectedSn ? "var(--gold)" : "var(--border2)"}`,
                borderRadius: 8,
                color: selectedSn ? "var(--gold2)" : "var(--text)",
                cursor: "pointer",
                outline: "none",
                minWidth: 200,
                maxWidth: 280,
                appearance: "none",
                WebkitAppearance: "none",
              }}
            >
              <option value="" style={{ background: "var(--surface2)", color: "var(--gold2)", fontWeight: 700 }}>
                🌐 TOUT LE CORAN (6236 versets)
              </option>

              {studiedSurahNumbers.length > 0 && (
                <optgroup label="── SOURATES ÉTUDIÉES ──" style={{ background: "var(--surface2)", color: "var(--green2)" }}>
                  {studiedSurahNumbers.map((sn) => {
                    const s = surahs.find((x) => x.number === sn);
                    const st = surahStatsMap[sn];
                    return (
                      <option key={`st-${sn}`} value={sn} style={{ background: "var(--surface3)", color: "var(--text)" }}>
                        S.{sn} {s?.englishName || `Sourate ${sn}`} ({s?.name}) — {st?.pct || 0}% ({st?.learnedCount || 0}/{s?.numberOfAyahs}v)
                      </option>
                    );
                  })}
                </optgroup>
              )}

              <optgroup label="── TOUTES LES 114 SOURATES ──" style={{ background: "var(--surface2)", color: "var(--gold)" }}>
                {surahs.map((s) => (
                  <option key={`all-${s.number}`} value={s.number} style={{ background: "var(--surface3)", color: "var(--text)" }}>
                    S.{s.number} {s.englishName} · {s.name} ({s.numberOfAyahs} versets)
                  </option>
                ))}
              </optgroup>
            </select>
            {/* Custom chevron */}
            <span
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                fontSize: 10,
                color: "var(--gold2)",
              }}
            >
              ▼
            </span>
          </div>

          {/* Next Surah button */}
          <button
            onClick={handleNextSurah}
            title="Sourate suivante"
            style={{
              padding: "7px 10px",
              background: "var(--surface3)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text2)",
              cursor: "pointer",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
          >
            ▶
          </button>

          {/* Reset / All button if filtered */}
          {selectedSn !== null && (
            <button
              onClick={() => setSelectedSn(null)}
              title="Voir tout le Coran"
              style={{
                padding: "7px 12px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text3)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* QUICK FILTER PILLS */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        <button
          onClick={() => setSelectedSn(null)}
          style={{
            fontSize: 11,
            fontWeight: selectedSn === null ? 700 : 500,
            padding: "5px 12px",
            borderRadius: 20,
            border: `1.5px solid ${selectedSn === null ? "var(--gold)" : "var(--border2)"}`,
            background: selectedSn === null ? "rgba(201,168,76,0.18)" : "transparent",
            color: selectedSn === null ? "var(--gold2)" : "var(--text2)",
            cursor: "pointer",
            fontFamily: "'Cinzel',serif",
            whiteSpace: "nowrap",
            transition: "all 0.15s",
          }}
        >
          🌐 TOUT LE CORAN
        </button>

        {studiedSurahNumbers.slice(0, 8).map((sn) => {
          const s = surahs.find((x) => x.number === sn);
          const st = surahStatsMap[sn];
          const isSel = selectedSn === sn;
          return (
            <button
              key={sn}
              onClick={() => setSelectedSn(isSel ? null : sn)}
              style={{
                fontSize: 11,
                fontWeight: isSel ? 700 : 500,
                padding: "5px 12px",
                borderRadius: 20,
                border: `1.5px solid ${isSel ? "var(--gold)" : "var(--border2)"}`,
                background: isSel ? "rgba(201,168,76,0.2)" : "transparent",
                color: isSel ? "var(--gold2)" : "var(--text2)",
                cursor: "pointer",
                fontFamily: "'Cinzel',serif",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <span>{s?.englishName || `S.${sn}`}</span>
              {st && st.pct > 0 && (
                <span style={{ fontSize: 9.5, color: masteryColor(st.pct), opacity: 0.9 }}>
                  {st.pct}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 2. PROMINENT "SHOW SELECTED SOURATE" BANNER ── */}
      {selectedSn && currentSurahMeta ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            padding: "12px 16px",
            background: "linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(62,184,160,0.06) 100%)",
            border: "1.5px solid rgba(201,168,76,0.35)",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Surah Number Circle Badge */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(201,168,76,0.2)",
                border: "2px solid var(--gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Cinzel',serif",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--gold2)",
                flexShrink: 0,
                boxShadow: "0 2px 10px rgba(201,168,76,0.25)",
              }}
            >
              {currentSurahMeta.number}
            </div>

            {/* Titles & Details */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                  Sourate {currentSurahMeta.number} · {currentSurahMeta.englishName}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--text3)" }}>
                  ({currentSurahMeta.englishNameTranslation})
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--gold2)", fontWeight: 600 }}>
                  {currentSurahMeta.numberOfAyahs} versets
                </span>
                <span style={{ fontSize: 10, color: "var(--text3)" }}>•</span>
                <span style={{ fontSize: 11, color: "var(--text2)" }}>
                  {currentSurahMeta.revelationType === "Meccan" ? "Révélation Mecquoise" : "Révélation Médinoise"}
                </span>
                <span style={{ fontSize: 10, color: "var(--text3)" }}>•</span>
                <span style={{ fontSize: 11, color: "var(--green2)", fontWeight: 600 }}>
                  {currentSurahStats?.learnedCount || 0} / {currentSurahMeta.numberOfAyahs} versets maîtrisés
                </span>
              </div>
            </div>
          </div>

          {/* Right Calligraphic Name & Direct Navigate Button */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                fontFamily: "'Amiri Quran',serif",
                fontSize: 26,
                color: "var(--gold)",
                direction: "rtl",
                lineHeight: 1,
              }}
            >
              {currentSurahMeta.name}
            </div>

            {onNavigate && (
              <button
                onClick={() => onNavigate(currentSurahMeta.number)}
                style={{
                  padding: "6px 12px",
                  background: "var(--gold)",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: 11,
                  fontFamily: "'Cinzel',serif",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  boxShadow: "0 2px 8px rgba(201,168,76,0.3)",
                  whiteSpace: "nowrap",
                }}
              >
                Ouvrir dans le Coran ➜
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Global Overview Banner */
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            padding: "10px 16px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📖</span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", letterSpacing: 0.5 }}>
                VUE D'ENSEMBLE · TOUT LE CORAN
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                114 sourates · 6236 versets au total · {globalStats.totalLearned} versets mémorisés
              </div>
            </div>
          </div>
          <div
            style={{
              fontFamily: "'Amiri Quran',serif",
              fontSize: 22,
              color: "var(--gold2)",
              direction: "rtl",
              opacity: 0.85,
            }}
          >
            القرآن الكريم
          </div>
        </div>
      )}

      {/* ── 3. METRIC HIGHLIGHTS & DELTA (PROMINENT READABLE TEXT) ── */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 36, fontFamily: "'Cinzel',serif", fontWeight: 700, color: currentColor }}>
            {latestPoint.pct}%
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 14,
              background: delta30d >= 0 ? "rgba(76,175,129,0.15)" : "rgba(224,98,82,0.15)",
              color: delta30d >= 0 ? "var(--green)" : "var(--red)",
              border: `1px solid ${delta30d >= 0 ? "var(--green)" : "var(--red)"}`,
              letterSpacing: 0.5,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {delta30d >= 0 ? "▲ +" : "▼ "}
            {Math.abs(delta30d)}% sur 30 jours
          </span>
        </div>

        <div style={{ fontSize: 12, color: "var(--text2)", textAlign: "right" }}>
          <span style={{ color: "var(--gold2)", fontWeight: 700 }}>
            {selectedSn ? `${latestPoint.countLearned} / ${currentSurahMeta?.numberOfAyahs || 0} versets` : `${globalStats.totalLearned} / 6236 versets`}
          </span>
          <span style={{ color: "var(--text3)", marginLeft: 6 }}>maîtrisés à ce jour</span>
        </div>
      </div>

      {/* ── 4. MAIN INTERACTIVE SVG TIMELINE CHART ── */}
      <div style={{ position: "relative", width: "100%", height: H, background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 4 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "100%", overflow: "visible" }}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="masteryFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={currentColor} stopOpacity="0.38" />
              <stop offset="100%" stopColor={currentColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* HORIZONTAL GRID LINES & READABLE Y-AXIS LABELS (fontSize: 11) */}
          {yTicks.map((v, i) => {
            const y = toY(v);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" strokeWidth="1" />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--text2)"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="'Cinzel',serif"
                >
                  {Math.round(v)}%
                </text>
              </g>
            );
          })}

          {/* POLYGON GRADIENT AREA */}
          {fillPointsD && <path d={fillPointsD} fill="url(#masteryFillGrad)" />}

          {/* TIMELINE POLYLINE */}
          {linePointsD && (
            <path
              d={linePointsD}
              fill="none"
              stroke={currentColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* INTERACTIVE DATA POINTS & HOVER CAPTURE */}
          {timelinePoints.map((p, i) => {
            const x = toX(i);
            const y = toY(p.pct);
            const isHovered = hoveredPoint?.index === i;
            const isMilestone = i % 6 === 0 || i === timelinePoints.length - 1;

            return (
              <g key={i}>
                {/* Transparent column to easily capture cursor */}
                <rect
                  x={x - plotW / timelinePoints.length / 2}
                  y={padT}
                  width={plotW / timelinePoints.length}
                  height={plotH}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredPoint({ ...p, index: i, x, y })}
                />

                {isMilestone && (
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 5.5 : 3.5}
                    fill={isHovered ? "var(--gold)" : currentColor}
                    stroke="var(--surface)"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            );
          })}

          {/* HOVER VERTICAL GUIDELINE */}
          {hoveredPoint && (
            <g pointerEvents="none">
              <line
                x1={hoveredPoint.x}
                y1={padT}
                x2={hoveredPoint.x}
                y2={padT + plotH}
                stroke="var(--gold)"
                strokeWidth="1.5"
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

          {/* READABLE X-AXIS LABELS (fontSize: 11, NOT 6!) */}
          {timelinePoints
            .filter((_, i) => i % 5 === 0 || i === timelinePoints.length - 1)
            .map((p, idx, arr) => {
              const i = timelinePoints.indexOf(p);
              const x = toX(i);
              return (
                <text
                  key={idx}
                  x={x}
                  y={padT + plotH + 20}
                  textAnchor={i === 0 ? "start" : i === timelinePoints.length - 1 ? "end" : "middle"}
                  fill="var(--text2)"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="'Cinzel',serif"
                >
                  {p.label}
                </text>
              );
            })}
        </svg>

        {/* FLOATING HOVER TOOLTIP */}
        {hoveredPoint && (
          <div
            style={{
              position: "absolute",
              left: `${Math.min(Math.max(12, (hoveredPoint.x / W) * 100), 78)}%`,
              top: 10,
              transform: "translateX(-50%)",
              background: "var(--surface)",
              border: "1.5px solid var(--gold)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
              borderRadius: 8,
              padding: "8px 14px",
              pointerEvents: "none",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <div style={{ fontSize: 11, color: "var(--gold2)", fontFamily: "'Cinzel',serif", fontWeight: 700 }}>
              📅 {hoveredPoint.date} ({hoveredPoint.label})
            </div>
            <div style={{ fontSize: 13, color: currentColor, fontWeight: 700 }}>
              {hoveredPoint.pct}% de maîtrise
            </div>
            <div style={{ fontSize: 11, color: "var(--text2)" }}>
              {hoveredPoint.countLearned || hoveredPoint.learned} versets maîtrisés
            </div>
          </div>
        )}
      </div>

      {/* ── 5. DERNIERS AYATS APPRIS (READABLE SIZES) ── */}
      {recentlyLearnedList.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.5, color: "var(--gold2)", fontWeight: 700, fontFamily: "'Cinzel',serif" }}>
            DERNIERS AYATS APPRIS {selectedSn ? `(SOURATE ${selectedSn})` : ""}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {recentlyLearnedList.map(([key, v]) => {
              const [sn, an] = key.split(":").map(Number);
              const sname = surahs.find((s) => s.number === sn)?.englishName || `Sourate ${sn}`;
              const d2 = v.learnedAt ? new Date(v.learnedAt) : null;
              return (
                <div
                  key={key}
                  onClick={() => onNavigate?.(sn, an)}
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
                      fontSize: 13,
                      color: "var(--green)",
                      fontFamily: "'Cinzel',serif",
                      fontWeight: 700,
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "rgba(76,175,129,0.12)",
                      border: "1px solid var(--green)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {an}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {sname} · v.{an}
                    </div>
                    {d2 && (
                      <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>
                        {d2.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--green)" }}>✓</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
