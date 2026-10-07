import { ToRevisePanel } from "../revision/ToRevisePanel.jsx";
import { AyatCollectionsTab } from "../collections/AyatCollectionsTab.jsx";
import { fixChars } from "../../utils/reciterAudio.js";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { AnimatedSubmenu } from "../common/AnimatedWrappers.jsx";
import { DecouverteMode } from "./DecouverteMode.jsx";
import { LectureMode } from "./LectureMode.jsx";
import { ApprentissageMode } from "./ApprentissageMode.jsx";
import { InfoMode } from "./InfoMode.jsx";
import { AideMemoireMode } from "./AideMemoireMode.jsx";
import { RevisionEcritureMode } from "./RevisionEcritureMode.jsx";
import { TajweedExercice } from "./TajweedExercice.jsx";
import { AyatMemorisationWorkflow } from "../memorisation/AyatMemorisationWorkflow.jsx";
import { ErrorBoundary } from "../common/ErrorBoundary.jsx";

export function Submenu({ ayat, surahNum, ld, setLData, submenuMode, setSubmenuMode, audioUrl, isMainPlaying, timestamps, onLoadTimestamps, onUpdateTimestamps, onLocalPlay, partSelectAyat, partSelectStep, onStartPartCreate, collections, ayatInCollections, onOpenCollModal, aideMemoireClickMode, setAideMemoireClickMode, spellCheck, onSetLoop, ayatLoopActive, translationLang, ayatTranslation, wbwWords, onFullScreen }) {
  const [copied, setCopied] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const scrollRef = useRef(null);
  const moreMenuRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const PRIMARY_MODES = [
    { id: "lecture",       label: "LECTURE" },
    { id: "decouverte",    label: "👁 DÉCOUVERTE" },
    { id: "progression",   label: "🎯 MÉMORISATION", highlight: !!ld?.memorisationState?.stepProgress },
    { id: "apprentissage", label: "✂ APPRENTISSAGE" },
    { id: "tajweed",       label: "☪ TAJWEED" },
  ];

  const SECONDARY_MODES = [
    { id: "memoire",     label: "📖 Aide Mémoire", desc: "Indices visuels & mots clés" },
    { id: "reviser",     label: `🔖 À Réviser${ld?.toRevise ? " •" : ""}`, desc: "Cibler des mots ou lettres", highlight: !!ld?.toRevise },
    { id: "collections", label: `🗂 Collections${ayatInCollections?.length > 0 ? ` (${ayatInCollections.length})` : ""}`, desc: "Classer ce verset par thème", highlight: ayatInCollections?.length > 0 },
    { id: "infos",       label: "ℹ Infos & Notes", desc: "Détails et notes personnelles" },
  ];

  const activeSecondaryMode = SECONDARY_MODES.find(m => m.id === submenuMode);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    const activeBtn = el.querySelector(".mode-btn.active");
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [submenuMode, checkScroll]);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [showMoreMenu]);

  const slideModes = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -160 : 160, behavior: "smooth" });
  };

  const handleWheel = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += e.deltaY;
    }
  };

  const hasSecondaryBadge = !!ld?.toRevise || (ayatInCollections?.length > 0) || ayatLoopActive;

  return (
    <div
      className="submenu"
      data-no-swipe="true"
      onClick={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div className="submenu-header-wrapper">
        {canScrollLeft && (
          <button
            type="button"
            className="submenu-scroll-arrow left"
            onClick={() => slideModes("left")}
            aria-label="Faire défiler vers la gauche"
          >
            ‹
          </button>
        )}

        <div
          ref={scrollRef}
          className={`submenu-header${canScrollLeft ? " fade-left" : ""}${canScrollRight ? " fade-right" : ""}`}
          data-no-swipe="true"
          onWheel={handleWheel}
          onTouchStart={e => e.stopPropagation()}
          onTouchEnd={e => { e.stopPropagation(); checkScroll(); }}
          style={{ touchAction: "pan-x", WebkitOverflowScrolling: "touch" }}
        >
          {PRIMARY_MODES.map(m => (
            <button
              key={m.id}
              type="button"
              className={`mode-btn${submenuMode === m.id ? " active" : ""}`}
              onClick={() => { setSubmenuMode(m.id); setShowMoreMenu(false); }}
              style={submenuMode !== m.id && m.highlight ? { color: "var(--gold2)" } : undefined}
            >
              {m.label}
            </button>
          ))}

          {activeSecondaryMode && (
            <button
              type="button"
              className="mode-btn active"
              onClick={() => setShowMoreMenu(v => !v)}
            >
              {activeSecondaryMode.label.toUpperCase()}
            </button>
          )}
        </div>

        {canScrollRight && (
          <button
            type="button"
            className="submenu-scroll-arrow right"
            onClick={() => slideModes("right")}
            aria-label="Faire défiler vers la droite"
          >
            ›
          </button>
        )}

        {/* Compact "Plus d'outils & modes" trigger */}
        <div className="submenu-more-wrap" ref={moreMenuRef}>
          <button
            type="button"
            className={`submenu-more-btn${showMoreMenu || activeSecondaryMode ? " active" : ""}`}
            onClick={() => setShowMoreMenu(v => !v)}
            title="Plus de modes et d'actions pour ce verset"
            aria-expanded={showMoreMenu}
          >
            <span>⋯ PLUS</span>
            {hasSecondaryBadge && <span className="submenu-more-dot" />}
          </button>

          {showMoreMenu && (
            <div className="submenu-more-popover">
              <div className="submenu-more-section-label">AUTRES MODES D'ÉTUDE</div>
              {SECONDARY_MODES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={`submenu-more-item${submenuMode === m.id ? " active" : ""}`}
                  onClick={() => {
                    setSubmenuMode(m.id);
                    setShowMoreMenu(false);
                  }}
                >
                  <span className="submenu-more-item-title">{m.label}</span>
                  <span className="submenu-more-item-desc">{m.desc}</span>
                </button>
              ))}

              <div className="submenu-more-divider" />
              <div className="submenu-more-section-label">ACTIONS DU VERSET</div>
              <div className="submenu-more-actions-row">
                <button
                  type="button"
                  className={`submenu-quick-action${ayatLoopActive ? " active" : ""}`}
                  onClick={() => { onSetLoop?.(); setShowMoreMenu(false); }}
                >
                  <span>↺</span>
                  <span>{ayatLoopActive ? "Boucle active" : "Boucler"}</span>
                </button>

                <button
                  type="button"
                  className={`submenu-quick-action${copied ? " active" : ""}`}
                  onClick={() => {
                    const textToCopy = `${ayat.text || ''}\n[Sourate ${surahNum}:${ayat.numberInSurah}]`;
                    try { navigator.clipboard.writeText(textToCopy); } catch {}
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  }}
                >
                  <span>{copied ? "✓" : "📋"}</span>
                  <span>{copied ? "Copié" : "Copier"}</span>
                </button>

                {onFullScreen && (
                  <button
                    type="button"
                    className="submenu-quick-action"
                    onClick={() => { onFullScreen(); setShowMoreMenu(false); }}
                  >
                    <span>⛶</span>
                    <span>Focus</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="submenu-content">
        <ErrorBoundary>
          {submenuMode === "lecture"
            ? <LectureMode ayat={ayat} surahNum={surahNum} audioUrl={audioUrl} isMainPlaying={isMainPlaying} timestamps={timestamps} onLoadTimestamps={onLoadTimestamps} onUpdateTimestamps={onUpdateTimestamps} onLocalPlay={onLocalPlay} />
            : submenuMode === "decouverte"
            ? <DecouverteMode ayat={ayat} surahNum={surahNum} ld={ld} setLData={setLData} audioUrl={audioUrl} timestamps={timestamps} />
            : submenuMode === "apprentissage"
            ? <ApprentissageMode ayat={ayat} surahNum={surahNum} ld={ld} setLData={setLData} timestamps={timestamps} audioUrl={audioUrl}
                isSelectingThisAyat={partSelectAyat === ayat.numberInSurah}
                partSelectStep={partSelectStep}
                onStartPartCreate={onStartPartCreate}
                clickMode={aideMemoireClickMode} setClickMode={setAideMemoireClickMode}
                translationLang={translationLang}
                ayatTranslation={ayatTranslation}
                wbwWords={wbwWords} />
            : submenuMode === "infos"
            ? <InfoMode ayat={ayat} ld={ld} setLData={setLData} surahNum={surahNum} />
            : submenuMode === "memoire"
            ? <AideMemoireMode ayat={ayat} surahNum={surahNum} ld={ld} setLData={setLData} clickMode={aideMemoireClickMode} setClickMode={setAideMemoireClickMode} spellCheck={spellCheck} />
            : submenuMode === "progression"
            ? <AyatMemorisationWorkflow
                ayat={ayat}
                surahNum={surahNum}
                ld={ld}
                setLData={setLData}
                audioUrl={audioUrl}
                ayatTranslation={ayatTranslation}
                wbwWords={wbwWords}
              />
            : submenuMode === "revision"
            ? <RevisionEcritureMode ayat={ayat} surahNum={surahNum} ld={ld} setLData={setLData} spellCheck={spellCheck} />
            : submenuMode === "tajweed"
            ? <TajweedExercice ayat={ayat} />
            : submenuMode === "reviser"
            ? <ToRevisePanel ayat={ayat} surahNum={surahNum} ld={ld} setLData={setLData} />
            : <AyatCollectionsTab
                surahNum={surahNum} ayatNum={ayat.numberInSurah}
                collections={collections}
                ayatInCollections={ayatInCollections}
                onOpenModal={onOpenCollModal}
              />
          }
        </ErrorBoundary>
      </div>

    </div>
  );
}

export function EditorWords({ editTs, currentMs, setCharField, captureStart, captureEnd, onSave, onReset, isDiacritic, audioRef }) {
  const [openWords, setOpenWords] = useState({});
  const [playingChar, setPlayingChar] = useState(null); // {wi,ci}
  const toggle = wi => setOpenWords(p => ({ ...p, [wi]: !p[wi] }));

  const playChar = (wi, ci, c) => {
    const audio = audioRef?.current;
    if (!audio) return;
    // Stop if already playing this char
    if (playingChar?.wi === wi && playingChar?.ci === ci) {
      audio.pause(); setPlayingChar(null); return;
    }
    const startSec = c.start / 1000;
    const endSec   = c.end   / 1000;
    if (startSec === endSec) return; // degenerate
    audio.currentTime = startSec;
    audio.play().catch(() => {});
    setPlayingChar({ wi, ci });
    const check = () => {
      if (audio.currentTime >= endSec) {
        audio.pause(); setPlayingChar(null);
        audio.removeEventListener('timeupdate', check);
      }
    };
    audio.addEventListener('timeupdate', check);
    audio.addEventListener('ended', () => { setPlayingChar(null); audio.removeEventListener('timeupdate', check); }, { once: true });
  };
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: "var(--text3)", marginBottom: 8, fontFamily: "'Cinzel',serif" }}>
        CLIQUEZ ▶ POUR ÉCOUTER LA LETTRE · ⊙ POUR CAPTURER LA POSITION AUDIO
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
        {editTs.words.map((word, wi) => {
          const isOpen   = !!openWords[wi];
          const wordText = word.chars?.map(c => c.char).join("") ?? "";
          const hasActive = word.chars?.some(c => currentMs >= c.start && currentMs <= c.end);
          return (
            <div key={wi} style={{ border: `1px solid ${hasActive ? "var(--gold)" : "var(--border)"}`, borderRadius: 6, transition: "border-color .15s" }}>
              {/* Toggle header — sticky */}
              <button onClick={() => toggle(wi)} style={{ width: "100%", background: hasActive ? "rgba(201,168,76,.08)" : "var(--surface3)", border: "none", padding: "6px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", position: "sticky", top: 0, zIndex: 2, borderBottom: isOpen ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontFamily: "'Amiri Quran',serif", fontSize: 20, direction: "rtl", flex: 1, lineHeight: 1.6 }}>
                  {fixChars(word.chars || []).map((c, ci) => {
                    const active = currentMs >= c.start && currentMs <= c.end;
                    const done   = currentMs > c.end && currentMs > 0 && c.end > 0;
                    const isCharPlaying2 = playingChar?.wi === wi && playingChar?.ci === ci;
                    return (
                      <span key={ci} className={`char-span${isCharPlaying2 ? " char-active" : active ? " char-active" : done ? " char-done" : ""}`}>{c.char}</span>
                    );
                  })}
                </span>
                <span style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, fontFamily: "'Cinzel',serif" }}>MOT {wi + 1} · {word.chars?.length ?? 0} LETTRES</span>
                <span style={{ fontSize: 10, color: "var(--text3)" }}>{isOpen ? "▲" : "▼"}</span>
              </button>
              {/* Chars rows */}
              {isOpen && (
                <div style={{ padding: "6px 10px 8px", display: "flex", flexDirection: "column", gap: 5 }}>
                  {(word.chars || []).map((c, ci) => {
                    const active       = currentMs >= c.start && currentMs <= c.end;
                    const isDiac       = isDiacritic(c.char);
                    const isDegenerate = !isDiac && c.start === c.end;
                    const isDisabled   = isDiac || isDegenerate;
                    const isCharPlaying = playingChar?.wi === wi && playingChar?.ci === ci;
                    return (
                      <div key={ci} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", borderRadius: 4, background: active ? "rgba(201,168,76,.07)" : isCharPlaying ? "rgba(62,184,160,.07)" : "transparent", opacity: isDisabled ? 0.4 : 1 }}>
                        {/* Play/pause button */}
                        <button onClick={() => playChar(wi, ci, c)} disabled={isDegenerate || isDiac}
                          style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${isCharPlaying ? "var(--red)" : "var(--teal)"}`, background: "transparent", color: isCharPlaying ? "var(--red)" : "var(--teal)", cursor: isDegenerate || isDiac ? "default" : "pointer", fontSize: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isCharPlaying ? "⏸" : "▶"}
                        </button>
                        <span style={{ fontFamily: "'Amiri Quran',serif", fontSize: 20, minWidth: 24, textAlign: "center", color: active ? "var(--gold2)" : isCharPlaying ? "var(--teal2)" : isDisabled ? "var(--text3)" : "var(--text2)" }}>{c.char}</span>
                        <span style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, width: 30 }}>START</span>
                        <button onClick={() => captureStart(wi, ci)} disabled={isDiac} style={{ fontSize: 9, padding: "2px 5px", border: "1px solid var(--teal)", background: "transparent", color: isDiac ? "var(--text3)" : "var(--teal)", borderRadius: 3, cursor: isDiac ? "default" : "pointer" }}>⊙</button>
                        <input type="number" value={c.start} onChange={e => setCharField(wi, ci, 'start', e.target.value)} disabled={isDiac}
                          style={{ width: 62, fontSize: 10, padding: "2px 4px", background: "var(--surface3)", border: `1px solid ${isDegenerate ? "var(--red)" : "var(--border2)"}`, borderRadius: 3, color: "var(--text2)", fontFamily: "monospace", opacity: isDiac ? 0.5 : 1 }} />
                        <span style={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, width: 24 }}>END</span>
                        <button onClick={() => captureEnd(wi, ci)} disabled={isDiac} style={{ fontSize: 9, padding: "2px 5px", border: "1px solid var(--gold)", background: "transparent", color: isDiac ? "var(--text3)" : "var(--gold)", borderRadius: 3, cursor: isDiac ? "default" : "pointer" }}>⊙</button>
                        <input type="number" value={c.end} onChange={e => setCharField(wi, ci, 'end', e.target.value)} disabled={isDiac}
                          style={{ width: 62, fontSize: 10, padding: "2px 4px", background: "var(--surface3)", border: `1px solid ${isDegenerate ? "var(--red)" : "var(--border2)"}`, borderRadius: 3, color: "var(--text2)", fontFamily: "monospace", opacity: isDiac ? 0.5 : 1 }} />
                        {active && !isCharPlaying && <span style={{ fontSize: 8, color: "var(--gold2)" }}>●</span>}
                        {isDiac && <span style={{ fontSize: 7, color: "var(--text3)" }}>~</span>}
                        {isDegenerate && <span style={{ fontSize: 7, color: "var(--red)" }}>!</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn-primary" onClick={onSave}>💾 SAUVEGARDER + EXPORTER JSON</button>
        <button className="btn-small" onClick={onReset}>↺ RÉINITIALISER</button>
      </div>
    </div>
  );
}
