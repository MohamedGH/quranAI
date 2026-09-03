import React, { useState, useMemo } from "react";
import { getAyatRevisionInfo, REVISION_LEVEL_LEGEND } from "../../utils/ayatRevisionLevel.js";
import { masteryColor } from "./Mastery.jsx";

export function SurahAyatsMasteryRibbon({
  surah,
  learnData,
  surahTextCache = {},
  pageDataForSurah = null,
  activeAyatNum = null,
  onSelectAyat = null,
  onNavigate = null,
  setLData = null,
  compact = false,
  showFilter = true,
  className = "",
}) {
  const [filterMode, setFilterMode] = useState("all"); // "all" | "toRevise" | "learned" | "unlearned"
  const [selectedAyatDetail, setSelectedAyatDetail] = useState(null); // { an, info, text }

  const totalAyahs = surah?.numberOfAyahs || 0;
  const sn = surah?.number;

  // Build ayats array with revision info
  const ayatsData = useMemo(() => {
    if (!sn || !totalAyahs) return [];
    const list = [];
    for (let an = 1; an <= totalAyahs; an++) {
      const k = `${sn}:${an}`;
      const ld = learnData?.[k];
      const text =
        surahTextCache?.[sn]?.[an] ||
        pageDataForSurah?.find((x) => x.numberInSurah === an)?.text ||
        "";
      const info = getAyatRevisionInfo(ld, text);
      list.push({ an, ld, text, info });
    }
    return list;
  }, [sn, totalAyahs, learnData, surahTextCache, pageDataForSurah]);

  // Breakdown counts
  const stats = useMemo(() => {
    let toReviseCount = 0;
    let perfectCount = 0;
    let goodCount = 0;
    let reviewCount = 0;
    let learnedCount = 0;
    let unlearnedCount = 0;
    let sumMastery = 0;

    ayatsData.forEach(({ info }) => {
      sumMastery += info.masteryPct || 0;
      if (info.levelId === "toRevise") toReviseCount++;
      else if (info.levelId === "perfect") perfectCount++;
      else if (info.levelId === "good") goodCount++;
      else if (info.levelId === "review") reviewCount++;
      else if (info.levelId === "learned") learnedCount++;
      else unlearnedCount++;
    });

    const learnedTotal = totalAyahs - unlearnedCount;
    const masteryPct = totalAyahs > 0 ? Math.round(sumMastery / totalAyahs) : 0;

    return {
      masteryPct,
      learnedTotal,
      toReviseCount,
      perfectCount,
      goodCount,
      reviewCount,
      learnedCount,
      unlearnedCount,
    };
  }, [ayatsData, totalAyahs]);

  // Filtered ayats for display
  const displayedAyats = useMemo(() => {
    if (filterMode === "toRevise") {
      return ayatsData.filter((a) => a.info.isToRevise);
    }
    if (filterMode === "learned") {
      return ayatsData.filter((a) => a.info.isLearned);
    }
    if (filterMode === "unlearned") {
      return ayatsData.filter((a) => !a.info.isLearned);
    }
    return ayatsData;
  }, [ayatsData, filterMode]);

  const handleAyatClick = (ayatItem, e) => {
    e.stopPropagation();
    if (onSelectAyat) {
      onSelectAyat(sn, ayatItem.an, ayatItem);
    } else {
      setSelectedAyatDetail(
        selectedAyatDetail?.an === ayatItem.an ? null : ayatItem
      );
    }
  };

  const toggleToRevise = (an, currentFlag, e) => {
    e.stopPropagation();
    if (!setLData) return;
    const nextVal = !currentFlag;
    const now = new Date().toISOString();
    setLData(sn, an, (d) => {
      const hist = [...(d.reviseHistory || [])];
      if (nextVal) {
        hist.push({ startDate: now, endDate: null, words: "all", parts: [], chars: {} });
      } else {
        const lastOpen = [...hist].reverse().findIndex((x) => !x.endDate);
        if (lastOpen >= 0) {
          const idx = hist.length - 1 - lastOpen;
          hist[idx] = { ...hist[idx], endDate: now };
        }
      }
      return { ...d, toRevise: nextVal, reviseHistory: hist };
    });
  };

  // Compact Preview Ribbon (used e.g. when surah header is collapsed)
  if (compact) {
    return (
      <div
        className={`surah-ribbon-compact ${className}`}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          alignItems: "center",
          padding: "4px 0",
        }}
        title={`Sourate ${sn}: ${stats.masteryPct}% maîtrisé, ${stats.toReviseCount} à réviser sur ${totalAyahs} versets`}
      >
        {ayatsData.map(({ an, info }) => (
          <span
            key={an}
            style={{
              display: "inline-block",
              width: totalAyahs > 100 ? 5 : 7,
              height: 12,
              borderRadius: 1.5,
              background: info.bg,
              border: `1px solid ${info.border}`,
              boxShadow: info.glow !== "none" ? info.glow : undefined,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`surah-ayats-mastery-ribbon ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: "100%",
      }}
    >
      {/* Surah Mastery Sub-Header with breakdown */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          padding: "8px 12px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 8,
          border: "1px solid var(--border)",
        }}
      >
        {/* Mastery Metric & Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "center" }}>
            <span
              style={{
                fontFamily: "'Cinzel',serif",
                fontSize: 14,
                fontWeight: 700,
                color: masteryColor(stats.masteryPct),
              }}
            >
              {stats.masteryPct}%
            </span>
            <div style={{ fontSize: 7, color: "var(--text3)", letterSpacing: 1 }}>
              MAÎTRISE
            </div>
          </div>
          <div style={{ width: 90 }}>
            <div
              style={{
                height: 5,
                background: "var(--surface3)",
                borderRadius: 2.5,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${stats.masteryPct}%`,
                  background: masteryColor(stats.masteryPct),
                  borderRadius: 2.5,
                  transition: "width .4s",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 7.5,
                color: "var(--text3)",
                marginTop: 3,
                textAlign: "center",
              }}
            >
              {stats.learnedTotal}/{totalAyahs} appris
            </div>
          </div>
        </div>

        {/* Level breakdown pills */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          {stats.toReviseCount > 0 && (
            <span
              style={{
                fontSize: 8,
                padding: "2px 7px",
                borderRadius: 6,
                background: "rgba(255, 126, 179, 0.2)",
                border: "1px solid #ff7eb3",
                color: "#ff7eb3",
                fontFamily: "'Cinzel',serif",
                fontWeight: 600,
                boxShadow: "0 0 6px rgba(255, 126, 179, 0.35)",
              }}
            >
              🔖 {stats.toReviseCount} À RÉVISER
            </span>
          )}
          {stats.perfectCount > 0 && (
            <span
              style={{
                fontSize: 8,
                padding: "2px 6px",
                borderRadius: 6,
                background: "rgba(76, 175, 129, 0.2)",
                border: "1px solid var(--green)",
                color: "var(--green2)",
                fontFamily: "'Cinzel',serif",
              }}
            >
              ✓ {stats.perfectCount} PARFAIT
            </span>
          )}
          {stats.goodCount > 0 && (
            <span
              style={{
                fontSize: 8,
                padding: "2px 6px",
                borderRadius: 6,
                background: "rgba(62, 184, 160, 0.2)",
                border: "1px solid var(--teal)",
                color: "var(--teal2)",
                fontFamily: "'Cinzel',serif",
              }}
            >
              ⭐ {stats.goodCount} BON
            </span>
          )}
          {stats.reviewCount > 0 && (
            <span
              style={{
                fontSize: 8,
                padding: "2px 6px",
                borderRadius: 6,
                background: "rgba(224, 98, 82, 0.2)",
                border: "1px solid var(--red)",
                color: "var(--red2)",
                fontFamily: "'Cinzel',serif",
              }}
            >
              ✗ {stats.reviewCount} À REVOIR
            </span>
          )}
          {stats.learnedCount > 0 && (
            <span
              style={{
                fontSize: 8,
                padding: "2px 6px",
                borderRadius: 6,
                background: "rgba(124, 140, 248, 0.15)",
                border: "1px solid #7c8cf8",
                color: "#a5b4fc",
                fontFamily: "'Cinzel',serif",
              }}
            >
              ● {stats.learnedCount} APPRIS
            </span>
          )}
        </div>

        {/* Filter controls inside surah */}
        {showFilter && (
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            {[
              { id: "all", label: `TOUS (${totalAyahs})` },
              ...(stats.toReviseCount > 0
                ? [{ id: "toRevise", label: `🔖 (${stats.toReviseCount})`, color: "#ff7eb3" }]
                : []),
              { id: "learned", label: `APPRIS (${stats.learnedTotal})` },
              ...(stats.unlearnedCount > 0
                ? [{ id: "unlearned", label: `RESTANTS (${stats.unlearnedCount})` }]
                : []),
            ].map((f) => (
              <button
                key={f.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterMode(f.id);
                }}
                style={{
                  fontSize: 7.5,
                  letterSpacing: 0.5,
                  padding: "2px 7px",
                  borderRadius: 5,
                  border: `1px solid ${
                    filterMode === f.id ? f.color || "var(--teal)" : "var(--border2)"
                  }`,
                  background:
                    filterMode === f.id
                      ? f.color
                        ? "rgba(255,126,179,0.18)"
                        : "rgba(62,184,160,0.15)"
                      : "transparent",
                  color:
                    filterMode === f.id ? f.color || "var(--teal2)" : "var(--text3)",
                  fontFamily: "'Cinzel',serif",
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* The Ayats Grid - Displaying all ayat numbers with level-dependent color */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          padding: "4px 0",
        }}
      >
        {displayedAyats.map((item) => {
          const { an, info } = item;
          const isActive = activeAyatNum === an || selectedAyatDetail?.an === an;

          return (
            <button
              key={an}
              onClick={(e) => handleAyatClick(item, e)}
              title={`Verset ${an} · ${info.label} (Maîtrise: ${info.masteryPct}%)`}
              style={{
                minWidth: 34,
                height: 34,
                padding: "2px 4px",
                borderRadius: 6,
                cursor: "pointer",
                background: isActive ? "rgba(201, 168, 76, 0.25)" : info.bg,
                border: `1.5px solid ${isActive ? "var(--gold)" : info.border}`,
                boxShadow:
                  isActive
                    ? "0 0 10px rgba(201,168,76,0.6)"
                    : info.glow !== "none"
                    ? info.glow
                    : "none",
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                transition: "all .15s ease",
                transform: isActive ? "scale(1.08)" : "none",
                position: "relative",
              }}
            >
              {/* Ayat Number */}
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "'Cinzel',serif",
                  fontWeight: 700,
                  color: info.color,
                  lineHeight: 1,
                }}
              >
                {an}
              </span>

              {/* Revision Level Indicator / Sub-label */}
              <span
                style={{
                  fontSize: 6.5,
                  letterSpacing: -0.2,
                  marginTop: 2,
                  lineHeight: 1,
                  fontWeight: 600,
                  color: info.isToRevise ? "#ff7eb3" : "var(--text3)",
                  whiteSpace: "nowrap",
                }}
              >
                {info.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Ayat Detail Quick Action Panel (when not in external selection mode) */}
      {selectedAyatDetail && !onSelectAyat && (
        <div
          style={{
            padding: "10px 14px",
            background: "var(--surface2)",
            border: `1px solid ${selectedAyatDetail.info.border}`,
            borderRadius: 8,
            marginTop: 4,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontFamily: "'Cinzel',serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--gold2)",
                }}
              >
                Verset {selectedAyatDetail.an}
              </span>
              <span
                style={{
                  fontSize: 8,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: selectedAyatDetail.info.bg,
                  border: `1px solid ${selectedAyatDetail.info.border}`,
                  color: selectedAyatDetail.info.color,
                  fontFamily: "'Cinzel',serif",
                }}
              >
                {selectedAyatDetail.info.label}
              </span>
            </div>

            <button
              onClick={() => setSelectedAyatDetail(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text3)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {/* Arabic preview if cached */}
          {selectedAyatDetail.text && (
            <div
              style={{
                fontFamily: "'Amiri Quran',serif",
                fontSize: 18,
                direction: "rtl",
                textAlign: "right",
                color: "var(--text)",
                lineHeight: 1.8,
                padding: "6px 10px",
                background: "var(--surface)",
                borderRadius: 6,
                maxHeight: 90,
                overflowY: "auto",
              }}
            >
              {selectedAyatDetail.text}
            </div>
          )}

          {/* Ayat Revision stats details */}
          <div
            style={{
              display: "flex",
              gap: 12,
              fontSize: 8.5,
              color: "var(--text2)",
              flexWrap: "wrap",
            }}
          >
            <span>
              Maîtrise des lettres :{" "}
              <b style={{ color: masteryColor(selectedAyatDetail.info.masteryPct) }}>
                {selectedAyatDetail.info.masteryPct}%
              </b>{" "}
              ({selectedAyatDetail.info.stats.learnedLetters}/
              {selectedAyatDetail.info.stats.totalLetters})
            </span>
            {selectedAyatDetail.info.bestScore !== null && (
              <span>
                Meilleur score d'écriture :{" "}
                <b style={{ color: "var(--gold)" }}>
                  {selectedAyatDetail.info.bestScore}%
                </b>
              </span>
            )}
            <span>
              Tentatives : <b>{selectedAyatDetail.info.attemptsCount}</b>
            </span>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
            {setLData && (
              <button
                onClick={(e) =>
                  toggleToRevise(
                    selectedAyatDetail.an,
                    selectedAyatDetail.info.isToRevise,
                    e
                  )
                }
                style={{
                  fontSize: 8.5,
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontFamily: "'Cinzel',serif",
                  cursor: "pointer",
                  border: `1px solid ${
                    selectedAyatDetail.info.isToRevise ? "var(--border2)" : "#ff7eb3"
                  }`,
                  background: selectedAyatDetail.info.isToRevise
                    ? "transparent"
                    : "rgba(255, 126, 179, 0.15)",
                  color: selectedAyatDetail.info.isToRevise
                    ? "var(--text3)"
                    : "#ff7eb3",
                }}
              >
                {selectedAyatDetail.info.isToRevise
                  ? "✕ Retirer d'à réviser"
                  : "🔖 Marquer à réviser"}
              </button>
            )}

            {onNavigate && (
              <button
                onClick={() => onNavigate(sn, selectedAyatDetail.an)}
                style={{
                  fontSize: 8.5,
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontFamily: "'Cinzel',serif",
                  cursor: "pointer",
                  border: "1px solid var(--teal)",
                  background: "rgba(62,184,160,0.12)",
                  color: "var(--teal2)",
                }}
              >
                📖 Ouvrir dans le Coran ↗
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
