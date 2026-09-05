import { ToRevisePanel } from "../revision/ToRevisePanel.jsx";
import { AyatCollectionsTab } from "../collections/AyatCollectionsTab.jsx";
import { fixChars } from "../../utils/reciterAudio.js";
import React, { useState } from "react";
import { AnimatedSubmenu } from "../common/AnimatedWrappers.jsx";
import { DecouverteMode } from "./DecouverteMode.jsx";
import { LectureMode } from "./LectureMode.jsx";
import { ApprentissageMode } from "./ApprentissageMode.jsx";
import { InfoMode } from "./InfoMode.jsx";
import { AideMemoireMode } from "./AideMemoireMode.jsx";
import { RevisionEcritureMode } from "./RevisionEcritureMode.jsx";
import { TajweedExercice } from "./TajweedExercice.jsx";
import { ErrorBoundary } from "../common/ErrorBoundary.jsx";

export function Submenu({ ayat, surahNum, ld, setLData, submenuMode, setSubmenuMode, audioUrl, isMainPlaying, timestamps, onLoadTimestamps, onUpdateTimestamps, onLocalPlay, partSelectAyat, partSelectStep, onStartPartCreate, collections, ayatInCollections, onOpenCollModal, aideMemoireClickMode, setAideMemoireClickMode, spellCheck, onSetLoop, ayatLoopActive, translationLang, ayatTranslation, wbwWords }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="submenu" onClick={e => e.stopPropagation()}>

      <div className="submenu-header">
        <button className={`mode-btn${submenuMode === "lecture" ? " active" : ""}`} onClick={() => setSubmenuMode("lecture")}>LECTURE</button>
        <button className={`mode-btn${submenuMode === "decouverte" ? " active" : ""}`} onClick={() => setSubmenuMode("decouverte")}>👁 DÉCOUVERTE</button>
        <button className={`mode-btn${submenuMode === "apprentissage" ? " active" : ""}`} onClick={() => setSubmenuMode("apprentissage")}>APPRENTISSAGE</button>
        <button
          className={`mode-btn${submenuMode === "collections" ? " active" : ""}`}
          onClick={() => setSubmenuMode("collections")}
          style={submenuMode !== "collections" && ayatInCollections?.length > 0 ? { color: "#c878ff" } : {}}
        >
          🗂 COLLECTIONS{ayatInCollections?.length > 0 ? ` (${ayatInCollections.length})` : ""}
        </button>
        <button className={`mode-btn${submenuMode === "infos" ? " active" : ""}`} onClick={() => setSubmenuMode("infos")}>ℹ INFOS</button>
        <button className={`mode-btn${submenuMode === "memoire" ? " active" : ""}`} onClick={() => setSubmenuMode("memoire")}>📖 AIDE MÉMOIRE</button>
        <button className={`mode-btn${submenuMode === "tajweed" ? " active" : ""}`} onClick={() => setSubmenuMode("tajweed")}>☪ TAJWEED</button>
        <button
          onClick={() => setSubmenuMode(submenuMode === 'reviser' ? 'lecture' : 'reviser')}
          title={ld.toRevise ? "Modifier marquage à réviser" : "Marquer à réviser"}
          style={{
            flexShrink:0, padding:"6px 10px", fontSize:13, cursor:"pointer",
            background: ld.toRevise ? "rgba(201,168,76,.12)" : submenuMode === 'reviser' ? "rgba(255,255,255,.05)" : "transparent",
            border:"none", borderBottom: ld.toRevise ? "2px solid var(--gold)" : submenuMode === 'reviser' ? "2px solid var(--text3)" : "2px solid transparent",
            color: ld.toRevise ? "var(--gold2)" : submenuMode === 'reviser' ? "var(--text2)" : "var(--text3)",
            transition:"all .15s",
          }}>🔖</button>
        <button onClick={() => onSetLoop?.()} style={{
          flexShrink:0, padding:"6px 10px", fontSize:14, cursor:"pointer",
          background: ayatLoopActive ? "rgba(62,184,160,.12)" : "transparent",
          border: "none", borderBottom: ayatLoopActive ? "2px solid var(--teal)" : "2px solid transparent",
          color: ayatLoopActive ? "var(--teal2)" : "var(--text3)",
          transition:"all .15s",
        }} title="Lire en boucle">↺</button>
        <button
          onClick={() => {
            const textToCopy = `${ayat.text || ''}\n[Sourate ${surahNum}:${ayat.numberInSurah}]`;
            try { navigator.clipboard.writeText(textToCopy); } catch {}
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          title={copied ? "Copié !" : "Copier le texte et la référence"}
          style={{
            flexShrink:0, padding:"6px 10px", fontSize:12, cursor:"pointer",
            background: copied ? "rgba(62,184,160,.18)" : "transparent",
            border: "none", borderBottom: copied ? "2px solid var(--teal)" : "2px solid transparent",
            color: copied ? "var(--teal2)" : "var(--text3)",
            transition:"all .15s",
          }}
        >
          {copied ? "✓" : "📋"}
        </button>
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
