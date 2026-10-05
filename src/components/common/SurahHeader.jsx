import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { sel, uiActions } from "../../store.js";
import { masteryColor } from "./Mastery.jsx";
import { getActiveTajweedColors } from "../../utils/tajweedRules.js";
import { TajweedColorPickerModal } from "./TajweedColorPickerModal.jsx";

export function SurahHeader({
  selectedSurah,
  surahs,
  setSelectedSurah,
  setSidebarOpen,
  ayats,
  getLData,
  setLData,
  surahStats,
  pageMode,
  setPageMode,
  activePageCoran,
  setactivePageCoran,
  hizbMode = false,
  setHizbMode = () => {},
  activeHizbCoran = null,
  setActiveHizbCoran = () => {},
  mainAyatIdx,
  learnData,
  lkey,
  pageMeta,
  surahMeta,
  jumpToAyatNumber,
  // Tajweed
  showQalqala,
  toggleQalqala,
  showMadd,
  toggleMadd,
  showIzhar,
  toggleIzhar,
  showIdgham,
  toggleIdgham,
  showTajweedTone,
  toggleTajweedTone,
  // Options
  fullScreenSelectedAyat,
  toggleFullScreen,
  announceNum,
  toggleAnnounceNum,
  spellCheck,
  toggleSpellCheck,
  showParts,
  toggleShowParts,
  autoPageFollow,
  setAutoPageFollow,
  // Translation
  translationLang,
  setTranslationLang,
  TRANS_LABELS,
  // Timestamps
  showTsBar,
  setShowTsBar,
  loadedCount,
  recitatorId,
  RECITATORS,
  handleTimestampsFiles,
  timestampsMap,
  setTimestampsMap,
  navigate,
}) {
  const [showSurahInfo, setShowSurahInfo] = useState(false);
  const [showAyatJump, setShowAyatJump] = useState(false);
  const [ayatSearchInput, setAyatSearchInput] = useState("");
  const [showTajweedDrawer, setShowTajweedDrawer] = useState(false);
  const [showOptionsDrawer, setShowOptionsDrawer] = useState(false);
  const [showLangDrawer, setShowLangDrawer] = useState(false);
  const [showColorPickerModal, setShowColorPickerModal] = useState(false);

  const dispatch = useDispatch();
  const ayatFontSize = useSelector(sel.ayatFontSize) || 26;
  const tajweedPalette = useSelector(sel.tajweedPalette) || "classic";
  const tajweedCustomColors = useSelector(sel.tajweedCustomColors) || {};
  const activeTjColors = getActiveTajweedColors(tajweedPalette, tajweedCustomColors);

  if (!selectedSurah) return null;

  const isSurahFullyLearned = ayats.length > 0 && ayats.every(a => getLData(selectedSurah.number, a.numberInSurah)?.learned);
  const markAllLearned = () => ayats.forEach(a => setLData(selectedSurah.number, a.numberInSurah, d => ({ ...d, learned: true })));
  const unmarkAllLearned = () => ayats.forEach(a => setLData(selectedSurah.number, a.numberInSurah, d => ({ ...d, learned: false })));

  const st = surahStats[selectedSurah.number];
  const totalAyahs = selectedSurah.numberOfAyahs || 0;
  const totalMasteryPct = totalAyahs > 0 ? Math.round((st?.mastery || 0) / totalAyahs) : 0;

  const sn = selectedSurah.number;
  const getAyatHizb = (a) => a?.hizb != null ? a.hizb : (a?.hizbQuarter != null ? Math.ceil(a.hizbQuarter / 4) : null);
  const activeAyat = ayats[mainAyatIdx] || ayats[0];
  const curPage = pageMode ? (activePageCoran ?? activeAyat?.page ?? null) : null;
  const curHizb = hizbMode ? (activeHizbCoran ?? getAyatHizb(activeAyat)) : null;
  const displayPage = curPage ?? activeAyat?.page ?? surahMeta?.page ?? null;
  const displayHizb = curHizb ?? getAyatHizb(activeAyat) ?? pageMeta?.hizb ?? surahMeta?.hizb ?? null;
  const pageAyats = curPage
    ? ayats.filter(a => a.page === curPage)
    : curHizb
    ? ayats.filter(a => getAyatHizb(a) === curHizb)
    : ayats;
  const totalParts = pageAyats.reduce((s, a) => s + (learnData[lkey(sn, a.numberInSurah)]?.parts?.length || 0), 0);
  const totalUnk = pageAyats.reduce((s, a) => s + (learnData[lkey(sn, a.numberInSurah)]?.unknownWords?.length || 0), 0);
  const meta = pageMode && pageMeta ? pageMeta : surahMeta;

  const anyTj = showQalqala || showMadd || showIzhar || showIdgham || showTajweedTone;
  const activeTjCount = [showQalqala, showMadd, showIzhar, showIdgham, showTajweedTone].filter(Boolean).length;
  const anyOpt = announceNum || spellCheck || showParts || pageMode || hizbMode || fullScreenSelectedAyat;
  const activeOptCount = [announceNum, spellCheck, showParts, pageMode, hizbMode, fullScreenSelectedAyat].filter(Boolean).length;
  const langLabel = translationLang ? (TRANS_LABELS[translationLang] || translationLang.toUpperCase()) : "OFF";

  // Prev / Next Surah
  const prevSurah = surahs?.find(s => s.number === selectedSurah.number - 1);
  const nextSurah = surahs?.find(s => s.number === selectedSurah.number + 1);

  const handleJumpSubmit = (val) => {
    const n = parseInt(val || ayatSearchInput, 10);
    if (!isNaN(n) && n >= 1 && n <= totalAyahs) {
      jumpToAyatNumber(n);
      setAyatSearchInput("");
      setShowAyatJump(false);
    }
  };

  const handleStepJump = (delta) => {
    const current = parseInt(ayatSearchInput || (mainAyatIdx >= 0 ? ayats[mainAyatIdx]?.numberInSurah : 1), 10);
    const nextVal = Math.min(Math.max(1, current + delta), totalAyahs);
    setAyatSearchInput(String(nextVal));
  };

  const isMeccan = selectedSurah.revelationType === "Meccan";

  return (
    <div className="m-surah-header-container" id="surah-header-mobile">
      {/* Backdrop for mobile bottom sheets */}
      {(showTajweedDrawer || showOptionsDrawer || showLangDrawer) && (
        <div
          className="m-surah-drawer-backdrop"
          onClick={() => {
            setShowTajweedDrawer(false);
            setShowOptionsDrawer(false);
            setShowLangDrawer(false);
          }}
        />
      )}

      {/* ── Ultra-Compact Surah Header (Height / 2) ── */}
      <div className="m-surah-card-compact">
        {/* Row 1: Navigation + Surah Identity + Quick Status */}
        <div className="m-surah-compact-row">
          {/* Prev Surah */}
          <button
            className={`m-compact-nav-btn ${!prevSurah ? 'disabled' : ''}`}
            disabled={!prevSurah}
            onClick={() => prevSurah && setSelectedSurah(prevSurah)}
            title={prevSurah ? `Sourate précédente : ${prevSurah.englishName}` : "Première sourate"}
          >
            ‹
          </button>

          {/* Center clickable surah title */}
          <div
            className="m-surah-compact-title"
            onClick={() => setSidebarOpen(true)}
            title="Changer de sourate (ouvrir la liste)"
          >
            <span className="m-compact-num">№ {selectedSurah.number}</span>
            <span className="m-compact-ar">{selectedSurah.name}</span>
            <span className="m-compact-en">{selectedSurah.englishName}</span>
            <span className="m-compact-meta">
              {selectedSurah.numberOfAyahs}v · {isMeccan ? 'Mecq' : 'Méd'}
              {displayPage ? ` · P.${displayPage}` : ''}
              {displayHizb ? ` · H.${displayHizb}` : ''}
            </span>
            <span className="m-compact-chevron">▾</span>
          </div>

          {/* Quick status & Next Surah */}
          <div className="m-surah-compact-actions">
            {/* Mastery Pill */}
            <span
              className="m-compact-mastery"
              style={{
                borderColor: masteryColor(totalMasteryPct),
                color: masteryColor(totalMasteryPct),
              }}
              title={`Maîtrise : ${totalMasteryPct}%`}
            >
              {totalMasteryPct}%
            </span>

            {/* Mark Learned Toggle */}
            {ayats.length > 0 && (
              <button
                onClick={isSurahFullyLearned ? unmarkAllLearned : markAllLearned}
                className={`m-compact-icon-btn learned ${isSurahFullyLearned ? 'active' : ''}`}
                title={isSurahFullyLearned ? "Sourate apprise (cliquer pour démarquer)" : "Marquer toute la sourate comme apprise"}
              >
                ✓
              </button>
            )}

            {/* Expand Stats Toggle */}
            <button
              onClick={() => setShowSurahInfo(v => !v)}
              className={`m-compact-icon-btn info ${showSurahInfo ? 'active' : ''}`}
              title="Statistiques et détails de la sourate"
            >
              ℹ
            </button>

            {/* Next Surah */}
            <button
              className={`m-compact-nav-btn ${!nextSurah ? 'disabled' : ''}`}
              disabled={!nextSurah}
              onClick={() => nextSurah && setSelectedSurah(nextSurah)}
              title={nextSurah ? `Sourate suivante : ${nextSurah.englishName}` : "Dernière sourate"}
            >
              ›
            </button>
          </div>
        </div>

        {/* Row 2: Slim Bismillah line (except Surah 9 At-Tawbah) */}
        {selectedSurah.number !== 9 && (
          <div className="m-compact-bismillah-bar">
            <span className="m-bism-ornament">❖</span>
            <span className="m-compact-bism-text">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>
            <span className="m-bism-ornament">❖</span>
          </div>
        )}

        {/* Expandable Detailed Stats Grid */}
        {showSurahInfo && (
          <div className="m-surah-info-grid">
            <div className="m-info-stat-card page">
              <div className="m-stat-num" style={{ color: '#c878ff' }}>{displayPage ?? '—'}</div>
              <div className="m-stat-tag">PAGE DU MUSHAF</div>
            </div>
            <div className="m-info-stat-card hizb">
              <div className="m-stat-num" style={{ color: '#ffd166' }}>{displayHizb ?? '—'}</div>
              <div className="m-stat-tag">HIZB</div>
            </div>
            <div className="m-info-stat-card">
              <div className="m-stat-num" style={{ color: '#a8edea' }}>{meta?.juz ?? '—'}</div>
              <div className="m-stat-tag">JUZ</div>
            </div>
            <div className="m-info-stat-card">
              <div className="m-stat-num" style={{ color: 'var(--gold2)' }}>{selectedSurah.numberOfAyahs}</div>
              <div className="m-stat-tag">VERSETS</div>
            </div>
            <div className="m-info-stat-card">
              <div className="m-stat-num" style={{ color: '#5bc8f5' }}>{meta?.wordCount ?? '—'}</div>
              <div className="m-stat-tag">MOTS</div>
            </div>
            <div className="m-info-stat-card">
              <div className="m-stat-num" style={{ color: '#c878ff' }}>{totalParts}</div>
              <div className="m-stat-tag">PARTIES DÉCOUPÉES</div>
            </div>
            <div className="m-info-stat-card">
              <div className="m-stat-num" style={{ color: totalUnk > 0 ? '#ff9f43' : 'var(--text3)' }}>{totalUnk}</div>
              <div className="m-stat-tag">MOTS À REVOIR</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modern Unified Action Bar (Slim) ── */}
      <div className="m-surah-actions-bar">
        {/* Jump Button */}
        <button
          onClick={() => setShowAyatJump(v => !v)}
          className={`m-action-btn jump ${showAyatJump ? 'active' : ''}`}
        >
          <span className="m-act-icon">🔎</span>
          <span className="m-act-label">VERSET</span>
          <span className="m-act-chevron">{showAyatJump ? '▲' : '▼'}</span>
        </button>

        {/* Tajweed Button */}
        <button
          onClick={() => {
            setShowTajweedDrawer(v => !v);
            setShowOptionsDrawer(false);
            setShowLangDrawer(false);
          }}
          className={`m-action-btn tajweed ${activeTjCount > 0 ? 'active' : ''}`}
        >
          <span className="m-act-icon">🎨</span>
          <span className="m-act-label">تجويد</span>
          {activeTjCount > 0 && <span className="m-act-badge">{activeTjCount}</span>}
        </button>

        {/* Translation Language Button */}
        <button
          onClick={() => {
            setShowLangDrawer(v => !v);
            setShowTajweedDrawer(false);
            setShowOptionsDrawer(false);
          }}
          className={`m-action-btn lang ${translationLang ? 'active' : ''}`}
        >
          <span className="m-act-icon">🌐</span>
          <span className="m-act-label">{langLabel}</span>
        </button>

        {/* Reading Options Button */}
        <button
          onClick={() => {
            setShowOptionsDrawer(v => !v);
            setShowTajweedDrawer(false);
            setShowLangDrawer(false);
          }}
          className={`m-action-btn options ${activeOptCount > 0 ? 'active' : ''}`}
        >
          <span className="m-act-icon">⚙</span>
          <span className="m-act-label">OPTIONS</span>
          {activeOptCount > 0 && <span className="m-act-badge">{activeOptCount}</span>}
        </button>

        {/* Text Size Quick Controls (A- / A+) */}
        <div className="m-fontsize-bar-ctrl" role="group" aria-label="Taille du texte des versets">
          <button
            type="button"
            id="header-fontsize-dec"
            onClick={() => dispatch(uiActions.decreaseAyatFontSize())}
            disabled={ayatFontSize <= 16}
            className="m-fontsize-btn"
            title="Réduire la taille du texte des versets (A−)"
            aria-label="Réduire la taille du texte"
          >
            A−
          </button>
          <span
            id="header-fontsize-val"
            className="m-fontsize-badge"
            onClick={() => dispatch(uiActions.resetAyatFontSize())}
            title={`Taille actuelle : ${ayatFontSize}px (cliquer pour réinitialiser à 26px)`}
          >
            {ayatFontSize}
          </span>
          <button
            type="button"
            id="header-fontsize-inc"
            onClick={() => dispatch(uiActions.increaseAyatFontSize())}
            disabled={ayatFontSize >= 48}
            className="m-fontsize-btn"
            title="Augmenter la taille du texte des versets (A+)"
            aria-label="Augmenter la taille du texte"
          >
            A+
          </button>
        </div>

        {/* Timestamps Sync Button */}
        <button
          onClick={() => setShowTsBar(v => !v)}
          className={`m-action-btn ts ${showTsBar ? 'active' : ''}`}
        >
          <span className="m-act-icon">⚡</span>
          <span className="m-act-label">TS</span>
          <span className="m-act-counter">{loadedCount}/{ayats.length}</span>
        </button>
      </div>

      {/* ── Jump to Verse Inline Stepper ── */}
      {showAyatJump && (
        <div className="m-jump-panel">
          <div className="m-jump-header">
            <span>ALLER AU VERSET (1 à {totalAyahs})</span>
            <button className="m-close-inline-btn" onClick={() => setShowAyatJump(false)}>✕</button>
          </div>
          <div className="m-jump-controls-row">
            <button className="m-jump-step-btn" onClick={() => handleStepJump(-1)}>−</button>
            <input
              type="number"
              min={1}
              max={totalAyahs}
              autoFocus
              value={ayatSearchInput}
              onChange={e => setAyatSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleJumpSubmit();
              }}
              placeholder={mainAyatIdx >= 0 && ayats[mainAyatIdx] ? String(ayats[mainAyatIdx].numberInSurah) : "N°"}
              className="m-jump-input"
            />
            <button className="m-jump-step-btn" onClick={() => handleStepJump(1)}>+</button>
            <button className="m-jump-confirm-btn" onClick={() => handleJumpSubmit()}>
              ALLER ➔
            </button>
          </div>
          <div className="m-jump-shortcuts">
            <button onClick={() => handleJumpSubmit(1)}>1er (Début)</button>
            <button onClick={() => handleJumpSubmit(Math.ceil(totalAyahs / 2))}>Milieu ({Math.ceil(totalAyahs / 2)})</button>
            <button onClick={() => handleJumpSubmit(totalAyahs)}>Dernier ({totalAyahs})</button>
          </div>
        </div>
      )}

      {/* ── Timestamps Sync Sub-Bar ── */}
      {showTsBar && (
        <div className="m-ts-sub-bar">
          <div className="m-ts-reciter-info">
            <span>{RECITATORS.find(r => r.id === recitatorId)?.flag}</span>
            <span className="m-ts-reciter-name">
              {RECITATORS.find(r => r.id === recitatorId)?.label?.toUpperCase()}
            </span>
          </div>

          <div className="m-ts-progress-container">
            <div
              className="m-ts-progress-fill"
              style={{ width: `${ayats.length ? (loadedCount / ayats.length) * 100 : 0}%` }}
            />
          </div>

          <div className="m-ts-actions">
            <label className="m-ts-upload-btn">
              <input type="file" accept=".json" multiple onChange={e => handleTimestampsFiles([...e.target.files])} />
              <span>📂 CHARGER JSON</span>
            </label>

            {loadedCount > 0 && (
              <button
                className="m-ts-clear-btn"
                title={`Effacer les timestamps de ${RECITATORS.find(r => r.id === recitatorId)?.label || recitatorId}`}
                onClick={() => {
                  const kept = {};
                  for (const [k, v] of Object.entries(timestampsMap)) {
                    if (!k.startsWith(`${recitatorId}:`)) kept[k] = v;
                  }
                  setTimestampsMap(kept);
                }}
              >
                ✕ EFFACER
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Tajweed Bottom Drawer / Popover ── */}
      {showTajweedDrawer && (
        <div className="m-bottom-drawer tajweed">
          <div className="m-drawer-handle" />
          <div className="m-drawer-header">
            <div className="m-drawer-title-group">
              <span className="m-drawer-icon">🎨</span>
              <span className="m-drawer-title">RÈGLES DE TAJWEED</span>
              <span className="m-drawer-count">{activeTjCount}/5 ACTIVES</span>
            </div>
            <button className="m-drawer-close" onClick={() => setShowTajweedDrawer(false)}>✕</button>
          </div>

          <div className="m-tajweed-rules-list">
            {[
              { toggle: toggleTajweedTone, on: showTajweedTone, label: "تفخيم / ترقيق", sub: "Graves & Aiguës (Tafkhīm / Tarqīq)", color: activeTjColors.tafkhim || "#06b6d4", bg: `${activeTjColors.tafkhim || "#06b6d4"}2e` },
              { toggle: toggleQalqala, on: showQalqala, label: "قلقلة", sub: "Qalqala (Rebond)", color: activeTjColors.qalqala || "#38bdf8", bg: `${activeTjColors.qalqala || "#38bdf8"}2e` },
              { toggle: toggleMadd,    on: showMadd,    label: "مَدّ",   sub: "Madd (Prolongation)", color: activeTjColors.madd_munfasil || "#fb923c", bg: `${activeTjColors.madd_munfasil || "#fb923c"}2e` },
              { toggle: toggleIzhar,   on: showIzhar,   label: "إظهار", sub: "Idh-har (Clarté)",   color: activeTjColors.izhar || "#34d399", bg: `${activeTjColors.izhar || "#34d399"}2e` },
              { toggle: toggleIdgham,  on: showIdgham,  label: "إدغام", sub: "Idgham (Assimilation)", color: activeTjColors.idgham || "#fbbf24", bg: `${activeTjColors.idgham || "#fbbf24"}2e` },
            ].map(({ toggle, on, label, sub, color, bg }) => (
              <button
                key={label}
                onClick={toggle}
                className={`m-tajweed-rule-row ${on ? 'active' : ''}`}
                style={{
                  background: on ? bg : 'rgba(255,255,255,.03)',
                  borderColor: on ? color : 'rgba(255,255,255,.1)',
                }}
              >
                <div className="m-tajweed-rule-left">
                  <span className="m-tajweed-rule-dot" style={{ background: on ? color : 'var(--text3)', boxShadow: on ? `0 0 8px ${color}88` : 'none' }} />
                  <span className="m-tajweed-rule-arabic" style={{ color: on ? color : undefined }}>{label}</span>
                  <span className="m-tajweed-rule-sub">({sub})</span>
                </div>
                <div className={`m-toggle-switch ${on ? 'on' : ''}`} style={{ borderColor: on ? color : undefined }}>
                  <div className="m-toggle-knob" style={{ background: on ? color : undefined }} />
                </div>
              </button>
            ))}
          </div>

          <div className="m-drawer-footer-actions" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              className="m-btn-choose-colors"
              onClick={() => {
                setShowTajweedDrawer(false);
                setShowColorPickerModal(true);
              }}
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "rgba(212, 175, 55, 0.15)",
                border: "1px solid rgba(212, 175, 55, 0.4)",
                borderRadius: 8,
                color: "#ffd700",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <span>🎨</span>
              <span>PERSONNALISER LES COULEURS DE TAJWEED</span>
            </button>

            <button
              className="m-btn-toggle-all"
              onClick={() => {
                if (anyTj) {
                  if (showTajweedTone) toggleTajweedTone?.();
                  if (showQalqala) toggleQalqala?.();
                  if (showMadd) toggleMadd?.();
                  if (showIzhar) toggleIzhar?.();
                  if (showIdgham) toggleIdgham?.();
                } else {
                  if (!showTajweedTone) toggleTajweedTone?.();
                  if (!showQalqala) toggleQalqala?.();
                  if (!showMadd) toggleMadd?.();
                  if (!showIzhar) toggleIzhar?.();
                  if (!showIdgham) toggleIdgham?.();
                }
              }}
            >
              {anyTj ? '✕ DÉSACTIVER TOUT' : '✓ TOUT ACTIVER'}
            </button>
          </div>
        </div>
      )}

      {/* ── Reading Options Bottom Drawer / Popover ── */}
      {showOptionsDrawer && (
        <div className="m-bottom-drawer options">
          <div className="m-drawer-handle" />
          <div className="m-drawer-header">
            <div className="m-drawer-title-group">
              <span className="m-drawer-icon">⚙</span>
              <span className="m-drawer-title">OPTIONS DE LECTURE & AFFICHAGE</span>
            </div>
            <button className="m-drawer-close" onClick={() => setShowOptionsDrawer(false)}>✕</button>
          </div>

          {/* ── Verse Text Size Adjuster ── */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(201, 168, 76, 0.06)",
              border: "1px solid rgba(201, 168, 76, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, color: "var(--gold2)", fontFamily: "'Cinzel', serif" }}>
                🔤 TAILLE DU TEXTE DES VERSETS
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text)", fontFamily: "'Cinzel', serif" }}>
                  {ayatFontSize} px
                </span>
                {ayatFontSize !== 26 && (
                  <button
                    type="button"
                    onClick={() => dispatch(uiActions.resetAyatFontSize())}
                    style={{
                      fontSize: 7.5,
                      padding: "2px 6px",
                      borderRadius: 5,
                      border: "1px solid rgba(201, 168, 76, 0.4)",
                      background: "rgba(201, 168, 76, 0.12)",
                      color: "var(--gold2)",
                      fontFamily: "'Cinzel', serif",
                      cursor: "pointer",
                    }}
                  >
                    RÉINITIALISER
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => dispatch(uiActions.decreaseAyatFontSize())}
                disabled={ayatFontSize <= 16}
                aria-label="Réduire la taille du texte"
                style={{
                  width: 34,
                  height: 30,
                  borderRadius: 6,
                  border: "1px solid rgba(201, 168, 76, 0.35)",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: ayatFontSize <= 16 ? "var(--text3)" : "var(--gold2)",
                  fontFamily: "'Cinzel', serif",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: ayatFontSize <= 16 ? "not-allowed" : "pointer",
                }}
              >
                A−
              </button>
              <input
                type="range"
                min={16}
                max={48}
                step={2}
                value={ayatFontSize}
                onChange={e => dispatch(uiActions.setAyatFontSize(Number(e.target.value)))}
                aria-label="Curseur de taille du texte des versets"
                style={{ flex: 1, accentColor: "var(--gold)", cursor: "pointer" }}
              />
              <button
                type="button"
                onClick={() => dispatch(uiActions.increaseAyatFontSize())}
                disabled={ayatFontSize >= 48}
                aria-label="Augmenter la taille du texte"
                style={{
                  width: 34,
                  height: 30,
                  borderRadius: 6,
                  border: "1px solid rgba(201, 168, 76, 0.35)",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: ayatFontSize >= 48 ? "var(--text3)" : "var(--gold2)",
                  fontFamily: "'Cinzel', serif",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: ayatFontSize >= 48 ? "not-allowed" : "pointer",
                }}
              >
                A+
              </button>
            </div>
          </div>

          <div className="m-options-grid">
            <button
              onClick={() => toggleFullScreen()}
              className={`m-option-card ${fullScreenSelectedAyat ? 'active' : ''}`}
            >
              <span className="m-opt-card-icon">⛶</span>
              <div className="m-opt-card-text">
                <span className="m-opt-card-title">PLEIN ÉCRAN</span>
                <span className="m-opt-card-desc">Vue de concentration par verset</span>
              </div>
              <span className="m-opt-indicator">{fullScreenSelectedAyat ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={toggleAnnounceNum}
              className={`m-option-card ${announceNum ? 'active' : ''}`}
            >
              <span className="m-opt-card-icon">🔢</span>
              <div className="m-opt-card-text">
                <span className="m-opt-card-title">ANNONCE DU N°</span>
                <span className="m-opt-card-desc">Vocale avant chaque verset</span>
              </div>
              <span className="m-opt-indicator">{announceNum ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={toggleSpellCheck}
              className={`m-option-card ${spellCheck ? 'active' : ''}`}
            >
              <span className="m-opt-card-icon">✔</span>
              <div className="m-opt-card-text">
                <span className="m-opt-card-title">ORTHOGRAPHE</span>
                <span className="m-opt-card-desc">Aide à la mémorisation</span>
              </div>
              <span className="m-opt-indicator">{spellCheck ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={toggleShowParts}
              className={`m-option-card ${showParts ? 'active' : ''}`}
            >
              <span className="m-opt-card-icon">✂</span>
              <div className="m-opt-card-text">
                <span className="m-opt-card-title">DÉCOUPAGE PARTIES</span>
                <span className="m-opt-card-desc">Découper les longs versets</span>
              </div>
              <span className="m-opt-indicator">{showParts ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => {
                const next = !pageMode;
                setPageMode(next);
                setactivePageCoran(null);
                if (next && hizbMode) { setHizbMode(false); setActiveHizbCoran(null); }
              }}
              className={`m-option-card ${pageMode ? 'active' : ''}`}
            >
              <span className="m-opt-card-icon">📖</span>
              <div className="m-opt-card-text">
                <span className="m-opt-card-title">MODE PAGE MUSHAF</span>
                <span className="m-opt-card-desc">Disposition du Mushaf par page</span>
              </div>
              <span className="m-opt-indicator">{pageMode ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => {
                const next = !hizbMode;
                setHizbMode(next);
                setActiveHizbCoran(null);
                if (next && pageMode) { setPageMode(false); setactivePageCoran(null); }
              }}
              className={`m-option-card ${hizbMode ? 'active' : ''}`}
            >
              <span className="m-opt-card-icon">۞</span>
              <div className="m-opt-card-text">
                <span className="m-opt-card-title">MODE HIZB</span>
                <span className="m-opt-card-desc">Afficher et naviguer par Hizb</span>
              </div>
              <span className="m-opt-indicator">{hizbMode ? 'ON' : 'OFF'}</span>
            </button>

            {(pageMode || hizbMode) && (
              <button
                onClick={() => setAutoPageFollow(v => !v)}
                className={`m-option-card ${autoPageFollow ? 'active' : ''}`}
              >
                <span className="m-opt-card-icon">⇄</span>
                <div className="m-opt-card-text">
                  <span className="m-opt-card-title">{hizbMode ? 'SUIVI AUTO DE HIZB' : 'SUIVI AUTO DE PAGE'}</span>
                  <span className="m-opt-card-desc">{hizbMode ? 'Changer de Hizb automatiquement' : 'Tourner la page automatiquement'}</span>
                </div>
                <span className="m-opt-indicator">{autoPageFollow ? 'ON' : 'OFF'}</span>
              </button>
            )}
          </div>

          <div className="m-drawer-extra-views">
            <span className="m-extra-label">AUTRES MODES DE LECTURE :</span>
            <div className="m-extra-btns-row">
              <button
                onClick={() => { setShowOptionsDrawer(false); navigate('/quran/book'); }}
                className="m-extra-view-btn"
              >
                📖 LIVRE CSS
              </button>
              <button
                onClick={() => { setShowOptionsDrawer(false); navigate('/quran/book3d'); }}
                className="m-extra-view-btn gold"
              >
                ✨ LIVRE 3D
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Translation Language Bottom Drawer / Popover ── */}
      {showLangDrawer && (
        <div className="m-bottom-drawer languages">
          <div className="m-drawer-handle" />
          <div className="m-drawer-header">
            <div className="m-drawer-title-group">
              <span className="m-drawer-icon">🌐</span>
              <span className="m-drawer-title">TRADUCTION DU CORAN</span>
            </div>
            <button className="m-drawer-close" onClick={() => setShowLangDrawer(false)}>✕</button>
          </div>

          <div className="m-languages-grid">
            {Object.entries(TRANS_LABELS).map(([lang, label]) => {
              const isActive = translationLang === lang;
              return (
                <button
                  key={lang}
                  onClick={() => {
                    setTranslationLang(isActive ? null : lang);
                    setShowLangDrawer(false);
                  }}
                  className={`m-lang-btn ${isActive ? 'active' : ''}`}
                >
                  <span className="m-lang-label">{label}</span>
                  {isActive && <span className="m-lang-check">✓</span>}
                </button>
              );
            })}
          </div>

          {translationLang && (
            <div className="m-drawer-footer-actions">
              <button
                className="m-btn-disable-trans"
                onClick={() => {
                  setTranslationLang(null);
                  setShowLangDrawer(false);
                }}
              >
                ✕ DÉSACTIVER LA TRADUCTION
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tajweed Color Customizer Modal ── */}
      <TajweedColorPickerModal
        isOpen={showColorPickerModal}
        onClose={() => setShowColorPickerModal(false)}
      />
    </div>
  );
}
