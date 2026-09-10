import React, { useState } from "react";
import { masteryColor } from "./Mastery.jsx";

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

  if (!selectedSurah) return null;

  const isSurahFullyLearned = ayats.length > 0 && ayats.every(a => getLData(selectedSurah.number, a.numberInSurah)?.learned);
  const markAllLearned = () => ayats.forEach(a => setLData(selectedSurah.number, a.numberInSurah, d => ({ ...d, learned: true })));
  const unmarkAllLearned = () => ayats.forEach(a => setLData(selectedSurah.number, a.numberInSurah, d => ({ ...d, learned: false })));

  const st = surahStats[selectedSurah.number];
  const totalAyahs = selectedSurah.numberOfAyahs || 0;
  const totalMasteryPct = totalAyahs > 0 ? Math.round((st?.mastery || 0) / totalAyahs) : 0;

  const sn = selectedSurah.number;
  const curPage = pageMode ? (activePageCoran ?? ayats[mainAyatIdx]?.page ?? null) : null;
  const pageAyats = curPage ? ayats.filter(a => a.page === curPage) : ayats;
  const totalParts = pageAyats.reduce((s, a) => s + (learnData[lkey(sn, a.numberInSurah)]?.parts?.length || 0), 0);
  const totalUnk = pageAyats.reduce((s, a) => s + (learnData[lkey(sn, a.numberInSurah)]?.unknownWords?.length || 0), 0);
  const meta = pageMode && pageMeta ? pageMeta : surahMeta;

  const anyTj = showQalqala || showMadd || showIzhar || showIdgham;
  const activeTjCount = [showQalqala, showMadd, showIzhar, showIdgham].filter(Boolean).length;
  const anyOpt = announceNum || spellCheck || showParts || pageMode || fullScreenSelectedAyat;
  const activeOptCount = [announceNum, spellCheck, showParts, pageMode, fullScreenSelectedAyat].filter(Boolean).length;
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
            {curPage && (
              <div className="m-info-stat-card page">
                <div className="m-stat-num" style={{ color: '#c878ff' }}>{curPage}</div>
                <div className="m-stat-tag">PAGE DU MUSHAF</div>
              </div>
            )}
            <div className="m-info-stat-card">
              <div className="m-stat-num" style={{ color: '#ffd166' }}>{meta?.hizb ?? '—'}</div>
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
              <span className="m-drawer-count">{activeTjCount}/4 ACTIVES</span>
            </div>
            <button className="m-drawer-close" onClick={() => setShowTajweedDrawer(false)}>✕</button>
          </div>

          <div className="m-tajweed-rules-list">
            {[
              { toggle: toggleQalqala, on: showQalqala, label: "قلقلة", sub: "Qalqala (Rebond)", color: "#38bdf8", bg: "rgba(56,189,248,.18)" },
              { toggle: toggleMadd,    on: showMadd,    label: "مَدّ",   sub: "Madd (Prolongation)", color: "#fb923c", bg: "rgba(251,146,60,.18)" },
              { toggle: toggleIzhar,   on: showIzhar,   label: "إظهار", sub: "Idh-har (Clarté)",   color: "#34d399", bg: "rgba(52,211,153,.18)" },
              { toggle: toggleIdgham,  on: showIdgham,  label: "إدغام", sub: "Idgham (Assimilation)", color: "#fbbf24", bg: "rgba(251,191,36,.18)" },
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
                  <span className="m-tajweed-rule-dot" style={{ background: on ? color : 'var(--text3)' }} />
                  <span className="m-tajweed-rule-arabic">{label}</span>
                  <span className="m-tajweed-rule-sub">({sub})</span>
                </div>
                <div className={`m-toggle-switch ${on ? 'on' : ''}`} style={{ borderColor: on ? color : undefined }}>
                  <div className="m-toggle-knob" style={{ background: on ? color : undefined }} />
                </div>
              </button>
            ))}
          </div>

          <div className="m-drawer-footer-actions">
            <button
              className="m-btn-toggle-all"
              onClick={() => {
                if (anyTj) {
                  if (showQalqala) toggleQalqala();
                  if (showMadd) toggleMadd();
                  if (showIzhar) toggleIzhar();
                  if (showIdgham) toggleIdgham();
                } else {
                  if (!showQalqala) toggleQalqala();
                  if (!showMadd) toggleMadd();
                  if (!showIzhar) toggleIzhar();
                  if (!showIdgham) toggleIdgham();
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
              onClick={() => { setPageMode(v => !v); setactivePageCoran(null); }}
              className={`m-option-card ${pageMode ? 'active' : ''}`}
            >
              <span className="m-opt-card-icon">📖</span>
              <div className="m-opt-card-text">
                <span className="m-opt-card-title">MODE PAGE MUSHAF</span>
                <span className="m-opt-card-desc">Disposition du Mushaf standard</span>
              </div>
              <span className="m-opt-indicator">{pageMode ? 'ON' : 'OFF'}</span>
            </button>

            {pageMode && (
              <button
                onClick={() => setAutoPageFollow(v => !v)}
                className={`m-option-card ${autoPageFollow ? 'active' : ''}`}
              >
                <span className="m-opt-card-icon">⇄</span>
                <div className="m-opt-card-text">
                  <span className="m-opt-card-title">SUIVI AUTO DE PAGE</span>
                  <span className="m-opt-card-desc">Tourner la page automatiquement</span>
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
    </div>
  );
}
