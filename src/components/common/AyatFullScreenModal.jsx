import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArabicHighlighted, PlayingArabicHighlighted } from "./ArabicHighlighted.jsx";
import { Submenu } from "../modes/Submenu.jsx";
import { isQalqala, getMaddType, isIzhar, isIdgham } from "../../utils/tajweedRules.js";
import { arabicRoot } from "../../utils/arabicUtils.js";
import { segmentAyatTranslation } from "../../utils/translationUtils.js";

// Helper for Arabic Eastern digits: e.g. 108 -> ۱۰۸
function toArabicDigits(num) {
  if (num == null) return "";
  const arDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/\d/g, d => arDigits[d]);
}

const normalizeAr = (s) => (s ? s.replace(/[ً-ٰٟ]/g, "").replace(/آ|أ|إ|ٱ/g, "ا").replace(/ى/g, "ي").trim() : "");

const PART_COLORS  = ["rgba(201,168,76,.22)","rgba(62,184,160,.18)","rgba(111,207,154,.18)","rgba(224,90,90,.15)","rgba(200,120,255,.15)"];
const PART_BORDERS = ["var(--gold)","var(--teal)","var(--green)","var(--red)","#c878ff"];

export function AyatFullScreenModal({
  isOpen,
  onClose,
  ayat,
  selectedSurah,
  ayats = [],
  translationLang,
  translationText,
  timestamps,
  enableTimestamps = true,
  enableLetterByLetter = true,
  showQalqala = false,
  showMadd = false,
  showIzhar = false,
  showIdgham = false,
  isPlaying = false,
  onTogglePlay,
  onSelectAyat,
  ld = {},
  setLData,
  fullScreenOption = false,
  onToggleFullScreenOption,
  masteryPercent = 0,
  loopActive = false,
  onToggleLoop,
  reciterName = "",
  recitators = [],
  recitatorId = "",
  onSelectReciter,
  showParts = true,
  playingPart = null,
  onPlayPartInline,
  partSelectAyat = null,
  partSelectStep = null,
  partSelectStart = null,
  setPartSelectStart,
  setPartSelectStep,
  setPartSelectAyat,
  onStartPartCreate,
  translations = {},
  wbwTranslations = {},
  // Submenu specific props:
  submenuMode,
  setSubmenuMode,
  audioUrl = "",
  onLoadTimestamps,
  onUpdateTimestamps,
  onLocalPlay,
  collections,
  ayatInCollections,
  onOpenCollModal,
  aideMemoireClickMode,
  setAideMemoireClickMode,
  spellCheck,
  wbwWords,
}) {
  // Detect mobile screen width
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 640 : false));

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Font scale (stored in localStorage)
  const [fontSize, setFontSize] = useState(() => {
    try {
      const saved = localStorage.getItem("quran_fs_fontsize");
      if (saved) return Math.max(18, Math.min(54, parseInt(saved, 10)));
      return typeof window !== "undefined" && window.innerWidth <= 640 ? 27 : 34;
    } catch {
      return 32;
    }
  });

  const [showTranslation, setShowTranslation] = useState(true);
  const [showSubmenu, setShowSubmenu] = useState(true);
  const [isNativeFs, setIsNativeFs] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [showReciterModal, setShowReciterModal] = useState(false);
  const [reciterSearch, setReciterSearch] = useState("");
  const scrollContainerRef = useRef(null);

  // Touch swipe handling for mobile
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Horizontal swipe must dominate vertical scroll
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < -60 && ayat && ayat.numberInSurah < (selectedSurah?.numberOfAyahs || ayats.length)) {
        // Swipe left -> Next verse
        onSelectAyat?.(ayat.numberInSurah + 1);
      } else if (dx > 60 && ayat && ayat.numberInSurah > 1) {
        // Swipe right -> Previous verse
        onSelectAyat?.(ayat.numberInSurah - 1);
      }
    }
  };

  // Sync native fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      setIsNativeFs(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Update font size helper
  const updateFontSize = (delta) => {
    setFontSize((prev) => {
      const next = Math.max(18, Math.min(54, prev + delta));
      try { localStorage.setItem("quran_fs_fontsize", String(next)); } catch {}
      return next;
    });
  };

  // Toggle browser fullscreen
  const toggleNativeFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    } catch {}
  }, []);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (showQuickSettings) {
          setShowQuickSettings(false);
        } else if (showReciterModal) {
          setShowReciterModal(false);
        } else {
          onClose();
        }
      } else if (e.key === "ArrowRight") {
        if (ayat && ayat.numberInSurah < ayats.length) {
          e.preventDefault();
          onSelectAyat?.(ayat.numberInSurah + 1);
        }
      } else if (e.key === "ArrowLeft") {
        if (ayat && ayat.numberInSurah > 1) {
          e.preventDefault();
          onSelectAyat?.(ayat.numberInSurah - 1);
        }
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        onTogglePlay?.();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleNativeFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, ayat, ayats.length, onClose, onSelectAyat, onTogglePlay, toggleNativeFullscreen, showReciterModal, showQuickSettings]);

  // Scroll to top when ayat changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [ayat?.numberInSurah]);

  if (!isOpen || !ayat || !selectedSurah) return null;

  const currentAyatNum = ayat.numberInSurah;
  const totalAyats = selectedSurah.numberOfAyahs || ayats.length;
  const hasPrev = currentAyatNum > 1;
  const hasNext = currentAyatNum < totalAyats;

  const isLearned = !!ld?.learned;
  const isToRevise = !!ld?.toRevise;

  const toggleLearned = () => {
    if (setLData) {
      setLData(selectedSurah.number, currentAyatNum, (d) => ({
        ...d,
        learned: !d.learned,
      }));
    }
  };

  const toggleToRevise = () => {
    if (setLData) {
      setLData(selectedSurah.number, currentAyatNum, (d) => ({
        ...d,
        toRevise: !d.toRevise,
      }));
    }
  };

  // Reciters lookup
  const activeReciterObj = (recitators || []).find(r => r.id === (recitatorId || 'ar.alafasy')) || {
    id: recitatorId,
    label: reciterName || recitatorId || "Récitateur",
    flag: '🎙️'
  };
  const visibleReciters = (recitators || []).filter(r =>
    (r.label || '').toLowerCase().includes(reciterSearch.trim().toLowerCase())
  );

  // Words & parts setup
  const ayatWords = ayat.text ? ayat.text.split(" ").filter(Boolean) : [];
  const wordPartMap = {};
  (ld?.parts || []).forEach((p, pi) => p.wordIndices?.forEach(wi => { wordPartMap[wi] = pi; }));
  const wordsInParts = new Set(Object.keys(wordPartMap).map(Number));
  const nextAvail = wordsInParts.size > 0 ? Math.max(...wordsInParts) + 1 : 0;
  const isSelecting = partSelectAyat === currentAyatNum;

  // Word click handler for selection or aide-mémoire
  const handleInlineWordClick = (e, wi) => {
    e.stopPropagation();
    if (aideMemoireClickMode === 'highlight') {
      const normW = normalizeAr(ayatWords[wi] || '');
      const currentHl = (ld?.highlight || '').trim();
      const hlWords = currentHl ? currentHl.split(/\s+/) : [];
      const isRemoving = hlWords.some(hw => normalizeAr(hw) === normW);
      const nextHl = isRemoving
        ? hlWords.filter(hw => normalizeAr(hw) !== normW).join(' ')
        : [...hlWords, ayatWords[wi]].join(' ');
      setLData?.(selectedSurah.number, currentAyatNum, d => ({ ...d, highlight: nextHl }));
      return;
    }
    if (aideMemoireClickMode === 'unknown') {
      const rootClicked = arabicRoot(ayatWords[wi] || '');
      const prev = ld?.unknownWords || [];
      const isRemoving = prev.includes(wi);
      const sameForm = ayatWords.reduce((acc, w, i) => { if (arabicRoot(w) === rootClicked) acc.push(i); return acc; }, []);
      const next = isRemoving
        ? prev.filter(x => !sameForm.includes(x))
        : [...new Set([...prev, ...sameForm])];
      setLData?.(selectedSurah.number, currentAyatNum, d => ({ ...d, unknownWords: next }));
      return;
    }
    if (!isSelecting) return;
    if (partSelectStep === 'start') {
      if (wi < nextAvail) return;
      setPartSelectStart?.(wi);
      setPartSelectStep?.('end');
    } else if (partSelectStep === 'end') {
      if (partSelectStart === null) return;
      const from = Math.min(partSelectStart, wi);
      const to = Math.max(partSelectStart, wi);
      const clampedFrom = Math.max(from, nextAvail);
      const indices = [];
      for (let i = clampedFrom; i <= to; i++) indices.push(i);
      if (indices.length === 0) return;

      const ayatTransText = translationLang && translations[`${translationLang}:${selectedSurah.number}`]
        ? (translations[`${translationLang}:${selectedSurah.number}`].find(t => t.numberInSurah === currentAyatNum)?.text || "")
        : (translationText || "");
      const curWbw = wbwWords || wbwTranslations[`${translationLang}:${selectedSurah.number}`]?.[currentAyatNum];
      const newPartObj = {
        id: Date.now(),
        wordIndices: indices,
        text: indices.map(i => ayatWords[i]).join(" "),
        learned: !!ld?.learned,
      };
      const allPartsSimulated = [...(ld?.parts || []), newPartObj];
      const autoTrans = ayatTransText
        ? segmentAyatTranslation(ayatTransText, indices, ayatWords.length, allPartsSimulated, curWbw, ayatWords, translationLang || 'fr')
        : (curWbw ? indices.map(i => curWbw[i]).filter(Boolean).join(" ") : "");

      setLData?.(selectedSurah.number, currentAyatNum, d => ({
        ...d,
        parts: [...(d.parts || []), {
          ...newPartObj,
          translations: translationLang && autoTrans ? { [translationLang]: autoTrans } : {},
        }]
      }));
      const newNext = to + 1;
      if (newNext < ayatWords.length) {
        setPartSelectStart?.(null);
        setPartSelectStep?.('start');
      } else {
        setPartSelectAyat?.(null);
        setPartSelectStep?.(null);
        setPartSelectStart?.(null);
      }
    }
  };

  // Tajweed character rendering helper
  const renderTajweedChar = (ch, ci, arr2) => {
    const q  = showQalqala && isQalqala(arr2, ci);
    const mt = showMadd ? getMaddType(arr2, ci) : null;
    const iz = showIzhar && isIzhar(arr2, ci);
    const id = showIdgham && isIdgham(arr2, ci);
    return q               ? <span key={ci} style={{ color: "#5bc8f5", textShadow: "0 0 6px rgba(91,200,245,.5)" }}>{ch}</span>
         : mt === "muttasil" ? <span key={ci} style={{ color: "#ff7eb3", textShadow: "0 0 8px rgba(255,126,179,.6)", fontWeight: 600 }}>{ch}</span>
         : mt === "normal"   ? <span key={ci} style={{ color: "#f09de0", textShadow: "0 0 6px rgba(240,157,224,.5)" }}>{ch}</span>
         : iz              ? <span key={ci} style={{ color: "#4caf81", textShadow: "0 0 6px rgba(76,175,129,.5)" }}>{ch}</span>
         : id              ? <span key={ci} style={{ color: "#ffd166", textShadow: "0 0 6px rgba(255,209,102,.5)" }}>{ch}</span>
         : <span key={ci}>{ch}</span>;
  };

  // Full Arabic Text Renderer with all display modes
  const renderFullAyatText = () => {
    if (isPlaying && timestamps && enableLetterByLetter) {
      return (
        <PlayingArabicHighlighted
          text={ayat.text}
          timestamps={timestamps}
          mode="main"
          showQalqala={showQalqala}
          showMadd={showMadd}
          showIzhar={showIzhar}
          showIdgham={showIdgham}
        />
      );
    }

    if (playingPart?.ayatNum === currentAyatNum && timestamps && enableLetterByLetter) {
      return (
        <PlayingArabicHighlighted
          text={ayat.text}
          timestamps={timestamps}
          mode="part"
          playingPart={playingPart}
          ld={ld}
          showQalqala={showQalqala}
          showMadd={showMadd}
          showIzhar={showIzhar}
          showIdgham={showIdgham}
        />
      );
    }

    const _reviseData = ld?.toRevise;
    const revWordSet  = _reviseData && typeof _reviseData === 'object' ? new Set(_reviseData.words || []) : (_reviseData === true ? 'all' : null);
    const revChars    = _reviseData && typeof _reviseData === 'object' ? (_reviseData.chars || {}) : {};

    const showWordButtons = isSelecting || aideMemoireClickMode !== null;
    const showPartColors  = !isSelecting && showParts && Object.keys(wordPartMap).length > 0;

    if (showWordButtons) {
      return (
        <div style={{ cursor: aideMemoireClickMode ? "pointer" : "default", display: "inline" }}>
          {ayatWords.map((w, wi) => {
            if (aideMemoireClickMode === 'highlight') {
              const normW = normalizeAr(w);
              const isHl = ld?.highlight?.trim()?.split(/\s+/).some(hw => normalizeAr(hw) === normW);
              return (
                <span
                  key={wi}
                  onClick={(e) => handleInlineWordClick(e, wi)}
                  style={{
                    display: 'inline-block',
                    cursor: 'pointer',
                    padding: '1px 6px',
                    margin: '2px',
                    borderRadius: 6,
                    transition: 'all .15s',
                    userSelect: 'none',
                    background: isHl ? 'rgba(255,209,102,.25)' : 'transparent',
                    border: `1px solid ${isHl ? 'var(--gold)' : 'rgba(255,255,255,0.1)'}`,
                    color: isHl ? '#ffd166' : undefined,
                    textShadow: isHl ? '0 0 10px rgba(255,209,102,.6)' : 'none',
                  }}
                >
                  {w}
                  {wi < ayatWords.length - 1 ? ' ' : ''}
                </span>
              );
            }

            if (aideMemoireClickMode === 'unknown') {
              const isUnk = (ld?.unknownWords || []).includes(wi);
              return (
                <span
                  key={wi}
                  onClick={(e) => handleInlineWordClick(e, wi)}
                  style={{
                    display: 'inline-block',
                    cursor: 'pointer',
                    padding: '1px 6px',
                    margin: '2px',
                    borderRadius: 6,
                    transition: 'all .15s',
                    userSelect: 'none',
                    background: isUnk ? 'rgba(255,126,179,.22)' : 'transparent',
                    border: `1px solid ${isUnk ? '#ff7eb3' : 'rgba(255,255,255,0.1)'}`,
                    color: isUnk ? '#ff7eb3' : undefined,
                    textDecoration: isUnk ? 'underline dotted #ff7eb3' : 'none',
                  }}
                >
                  {w}
                  {wi < ayatWords.length - 1 ? ' ' : ''}
                </span>
              );
            }

            const inExistingPart = wordsInParts.has(wi);
            const pi             = wordPartMap[wi];
            const isLearnedPart  = pi !== undefined && (ld?.parts || [])[pi]?.learned;
            const isPast         = wi < nextAvail;
            const isStart        = partSelectStep === 'end' && wi === partSelectStart;
            let bg = "transparent", border = "rgba(255,255,255,0.15)", color = "var(--text)", cursor = "pointer";

            if (isPast || inExistingPart) {
              bg = isLearnedPart ? "rgba(76,175,129,.18)" : PART_COLORS[pi % PART_COLORS.length] ?? "rgba(62,184,160,.12)";
              border = isLearnedPart ? "var(--green)" : PART_BORDERS[pi % PART_BORDERS.length] ?? "var(--teal)";
              color = "var(--text2)";
              cursor = "default";
            } else if (isStart) {
              bg = "rgba(201,168,76,.35)";
              border = "var(--gold2)";
              color = "var(--gold2)";
            } else if (partSelectStep === 'start') {
              bg = "rgba(201,168,76,.08)";
              border = "rgba(201,168,76,.5)";
              color = "var(--gold)";
            } else if (partSelectStep === 'end') {
              bg = "rgba(62,184,160,.08)";
              border = "rgba(62,184,160,.5)";
              color = "var(--teal2)";
            }

            return (
              <span
                key={wi}
                onClick={(e) => handleInlineWordClick(e, wi)}
                style={{
                  display: "inline-block",
                  margin: "3px 4px",
                  padding: "2px 8px",
                  borderRadius: 6,
                  border: `1px solid ${border}`,
                  background: bg,
                  color,
                  cursor,
                  transition: "all .12s",
                  fontFamily: "'Amiri Quran',serif",
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      );
    }

    if (showPartColors) {
      const _hlSet = (() => {
        const s = new Set();
        if (!ld?.highlight?.trim()) return s;
        ld.highlight.trim().split(/\s+/).forEach(hw => {
          const n = normalizeAr(hw);
          ayatWords.forEach((aw, i) => { if (normalizeAr(aw) === n) s.add(i); });
        });
        return s;
      })();
      const _unkSet = new Set(ld?.unknownWords || []);

      const segments = [];
      let currentSeg = null;
      ayatWords.forEach((w, wi) => {
        const pi = wordPartMap[wi];
        if (currentSeg && currentSeg.pi === pi) {
          currentSeg.words.push({ w, wi });
        } else {
          currentSeg = { pi, words: [{ w, wi }] };
          segments.push(currentSeg);
        }
      });

      return (
        <div style={{ display: "inline" }}>
          {segments.map((seg, si) => {
            const pi            = seg.pi;
            const hasPart       = pi !== undefined;
            const part          = hasPart ? (ld?.parts || [])[pi] : null;
            const isLearnedPart = part?.learned;
            const isPartPlaying = hasPart && playingPart?.ayatNum === currentAyatNum && playingPart?.partId === part?.id;
            const canPlay       = hasPart && (!!timestamps?.words || !!onPlayPartInline);
            const segBg         = hasPart
              ? (isPartPlaying ? "rgba(62,184,160,.3)" : isLearnedPart ? "rgba(76,175,129,.18)" : PART_COLORS[pi % PART_COLORS.length])
              : "transparent";
            const segBorder     = hasPart
              ? `1px solid ${isPartPlaying ? "var(--teal2)" : isLearnedPart ? "var(--green)" : PART_BORDERS[pi % PART_BORDERS.length]}`
              : "none";

            return (
              <span
                key={si}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canPlay && part) onPlayPartInline?.(part, false);
                }}
                title={canPlay ? (isPartPlaying ? "Arrêter" : "Écouter cette partie") : undefined}
                style={{
                  display: "inline-block",
                  background: segBg,
                  border: segBorder,
                  borderRadius: 8,
                  padding: "2px 8px",
                  margin: "3px 4px",
                  cursor: canPlay ? "pointer" : "default",
                  transition: "all .15s",
                  boxShadow: isPartPlaying ? "0 0 14px rgba(62,184,160,0.4)" : "none",
                }}
              >
                {seg.words.map(({ w, wi }, wii) => {
                  const isUnk     = _unkSet.has(wi);
                  const isHl      = _hlSet.has(wi);
                  const isRevW    = revWordSet === 'all' || (revWordSet && revWordSet.has(wi));
                  const wRevChars = isRevW ? revChars[wi] : null;
                  const wColor    = isUnk ? "#ff7eb3" : isHl ? "#ffd166" : isRevW ? "var(--gold2)" : undefined;
                  const wShadow   = isUnk ? "0 0 8px rgba(255,126,179,.5)" : isHl ? "0 0 8px rgba(255,209,102,.6)" : isRevW ? "0 0 6px rgba(201,168,76,.4)" : "none";
                  const wDecor    = isUnk ? "underline dotted #ff7eb3" : isRevW && !wRevChars?.length ? "underline wavy var(--gold)" : "none";
                  const wBg       = isUnk ? "rgba(255,126,179,.15)" : isHl ? "rgba(255,209,102,.15)" : isRevW && !wRevChars?.length ? "rgba(201,168,76,.2)" : "transparent";

                  return (
                    <span
                      key={wii}
                      style={{
                        color: wColor,
                        textShadow: wShadow,
                        textDecoration: wDecor,
                        background: wBg,
                        borderRadius: (isUnk || isHl || isRevW) ? 4 : 0,
                        padding: (isUnk || isHl || isRevW) ? "0 2px" : 0,
                        borderBottom: isRevW && !wRevChars?.length ? "2px solid rgba(201,168,76,.6)" : "none",
                      }}
                    >
                      {(showQalqala || showMadd || showIzhar || showIdgham)
                        ? (() => { const arr2 = [...w]; return arr2.map((ch, ci) => renderTajweedChar(ch, ci, arr2)); })()
                        : w}
                      {wii < seg.words.length - 1 ? " " : ""}
                    </span>
                  );
                })}
              </span>
            );
          })}
        </div>
      );
    }

    const hlIndices = (() => {
      const set = new Set();
      if (!ld?.highlight?.trim()) return set;
      ld.highlight.trim().split(/\s+/).forEach(hw => {
        const norm = normalizeAr(hw);
        ayatWords.forEach((aw, i) => { if (normalizeAr(aw) === norm) set.add(i); });
      });
      return set;
    })();
    const unkIndices = new Set(ld?.unknownWords || []);
    const hasRevise = !!_reviseData;
    const hasAnnotations = (ld?.highlight?.trim() && hlIndices.size > 0) || unkIndices.size > 0 || hasRevise;

    if (hasAnnotations) {
      return (
        <div style={{ display: "inline" }}>
          {ayatWords.map((w, wi) => {
            const hit = hlIndices.has(wi);
            const unk = unkIndices.has(wi);
            const isRevWord = revWordSet === 'all' || (revWordSet && revWordSet.has(wi));
            const wordChars = isRevWord ? revChars[wi] : null;

            const baseStyle = {
              color: unk ? '#ff7eb3' : hit ? '#ffd166' : isRevWord ? 'var(--gold2)' : undefined,
              textShadow: unk ? '0 0 8px rgba(255,126,179,.5)' : hit ? '0 0 8px rgba(255,209,102,.6)' : 'none',
              background: unk ? 'rgba(255,126,179,.14)' : hit ? 'rgba(255,209,102,.15)' : isRevWord && !wordChars?.length ? 'rgba(201,168,76,.15)' : 'transparent',
              textDecoration: unk ? 'underline dotted #ff7eb3' : isRevWord && !wordChars?.length ? 'underline wavy var(--gold)' : 'none',
              borderRadius: (hit || unk || isRevWord) ? 4 : 0,
              padding: (hit || unk || isRevWord) ? '0 3px' : 0,
              border: isRevWord && !wordChars?.length ? '1px solid rgba(201,168,76,.4)' : 'none',
              display: 'inline',
            };

            if (isRevWord && wordChars?.length) {
              return (
                <span
                  key={wi}
                  style={{
                    display: 'inline',
                    padding: '0 3px',
                    background: 'rgba(91,200,245,.15)',
                    borderBottom: '2px solid #5bc8f5',
                    borderRadius: 4,
                    color: '#5bc8f5',
                    textShadow: '0 0 6px rgba(91,200,245,.5)',
                    position: 'relative',
                  }}
                >
                  {w}
                  <sup style={{ fontSize: '0.45em', color: '#5bc8f5', marginRight: 2, verticalAlign: 'super', fontWeight: 700 }}>
                    {wordChars.length}
                  </sup>
                  {wi < ayatWords.length - 1 ? ' ' : ''}
                </span>
              );
            }

            return (
              <span key={wi} style={baseStyle}>
                {(showQalqala || showMadd || showIzhar || showIdgham) && !hit && !unk
                  ? (() => { const arr2 = [...w]; return arr2.map((ch, ci) => renderTajweedChar(ch, ci, arr2)); })()
                  : w}
                {wi < ayatWords.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </div>
      );
    }

    if (timestamps && enableTimestamps) {
      return (
        <ArabicHighlighted
          text={ayat.text}
          timestamps={timestamps}
          currentMs={-1}
          showQalqala={showQalqala}
          showMadd={showMadd}
          showIzhar={showIzhar}
          showIdgham={showIdgham}
        />
      );
    }

    if (showQalqala || showMadd || showIzhar || showIdgham) {
      const arr = [...ayat.text];
      return <span>{arr.map((ch, i) => renderTajweedChar(ch, i, arr))}</span>;
    }

    return <span>{ayat.text}</span>;
  };

  // Adjust display font size: on small screens, clamp slightly for extreme long verses
  const effectiveFontSize = isMobile ? Math.min(fontSize, 36) : fontSize;

  return (
    <div
      id="ayat-fullscreen-modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2500,
        background: "radial-gradient(ellipse at center, #131724 0%, #0a0d14 70%, #06080e 100%)",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "fadeIn .2s ease-out",
        userSelect: "text",
      }}
    >
      {/* ── Top Header Bar ────────────────────────────────────────────── */}
      <header
        className="fs-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "max(env(safe-area-inset-top, 0px), 8px) 10px 8px" : "10px 16px",
          borderBottom: "1px solid rgba(201,168,76,0.18)",
          background: "rgba(12,15,22,0.92)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          zIndex: 20,
          flexShrink: 0,
          gap: isMobile ? 6 : 10,
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        {/* Top Row: Surah Info + Ayat Stepper + Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: isMobile ? "1 1 100%" : "auto", justifyContent: "space-between" }}>
          {/* Left: Surah Title Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(201,168,76,0.1)",
              border: "1px solid rgba(201,168,76,0.3)",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              maxWidth: isMobile ? "150px" : "240px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--gold)" }}>⛶</span>
            <span
              style={{
                fontFamily: "'Cinzel',serif",
                fontWeight: 700,
                fontSize: isMobile ? 10 : 11,
                letterSpacing: 1,
                color: "var(--gold2)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedSurah.number}. {selectedSurah.englishName}
            </span>
          </div>

          {/* Center: Ayat Stepper with Direct Select */}
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button
              id="btn-fs-prev-ayat"
              disabled={!hasPrev}
              onClick={() => onSelectAyat?.(currentAyatNum - 1)}
              title="Verset précédent (Flèche gauche)"
              style={{
                background: hasPrev ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${hasPrev ? "rgba(201,168,76,0.35)" : "rgba(255,255,255,0.06)"}`,
                color: hasPrev ? "var(--gold2)" : "rgba(255,255,255,0.2)",
                borderRadius: 4,
                padding: isMobile ? "5px 9px" : "4px 8px",
                cursor: hasPrev ? "pointer" : "default",
                fontSize: 11,
                transition: "all .15s",
                minWidth: 30,
                minHeight: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ◀
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(201,168,76,0.12)",
                border: "1px solid rgba(201,168,76,0.35)",
                borderRadius: "var(--radius-sm)",
                padding: "2px 6px",
              }}
            >
              <select
                id="select-fs-ayat-num"
                value={currentAyatNum}
                onChange={(e) => onSelectAyat?.(Number(e.target.value))}
                style={{
                  background: "#0d1017",
                  border: "1px solid rgba(201,168,76,0.5)",
                  color: "#ffd166",
                  borderRadius: 4,
                  padding: "2px 4px",
                  fontSize: 11,
                  fontFamily: "'Cinzel',serif",
                  fontWeight: 700,
                  cursor: "pointer",
                  outline: "none",
                  maxWidth: isMobile ? 84 : 110,
                }}
                title="Sélectionner directement le numéro de verset"
              >
                {Array.from({ length: totalAyats }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num} style={{ background: "#10141e", color: "#f8f5ed" }}>
                    V.{num} ﴾{toArabicDigits(num)}﴿
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 9, fontFamily: "'Cinzel',serif", color: "var(--text3)" }}>/ {totalAyats}</span>
            </div>

            <button
              id="btn-fs-next-ayat"
              disabled={!hasNext}
              onClick={() => onSelectAyat?.(currentAyatNum + 1)}
              title="Verset suivant (Flèche droite)"
              style={{
                background: hasNext ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${hasNext ? "rgba(201,168,76,0.35)" : "rgba(255,255,255,0.06)"}`,
                color: hasNext ? "var(--gold2)" : "rgba(255,255,255,0.2)",
                borderRadius: 4,
                padding: isMobile ? "5px 9px" : "4px 8px",
                cursor: hasNext ? "pointer" : "default",
                fontSize: 11,
                transition: "all .15s",
                minWidth: 30,
                minHeight: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ▶
            </button>
          </div>

          {/* Right on Mobile: Quick Settings Gear + Close Button */}
          {isMobile ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                id="btn-fs-mobile-settings"
                onClick={() => setShowQuickSettings((v) => !v)}
                title="Options d'affichage"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 6,
                  border: `1px solid ${showQuickSettings ? "var(--gold)" : "rgba(255,255,255,0.15)"}`,
                  background: showQuickSettings ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)",
                  color: showQuickSettings ? "var(--gold2)" : "var(--text2)",
                  fontSize: 14,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ⚙
              </button>

              <button
                id="btn-fs-mobile-close"
                onClick={onClose}
                title="Fermer (Échap)"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 6,
                  border: "1px solid rgba(224,90,90,0.4)",
                  background: "rgba(224,90,90,0.15)",
                  color: "#ff8282",
                  fontSize: 15,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ) : null}
        </div>

        {/* Second Row on Mobile / Right Controls on Desktop */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            justifyContent: isMobile ? "space-between" : "flex-end",
            width: isMobile ? "100%" : "auto",
          }}
        >
          {/* Reciter Selector Button */}
          <button
            id="btn-fs-reciter"
            onClick={() => {
              setReciterSearch("");
              setShowReciterModal(true);
            }}
            title="Changer de récitateur"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: "var(--radius-sm)",
              padding: "4px 8px",
              color: "var(--gold2)",
              fontSize: 10,
              fontFamily: "'Cinzel',serif",
              letterSpacing: 0.5,
              cursor: "pointer",
              transition: "all .15s",
              maxWidth: isMobile ? 180 : 160,
            }}
          >
            <span>{activeReciterObj?.flag || "🎙️"}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeReciterObj?.label || reciterName || recitatorId || "Récitateur"}
            </span>
            <span style={{ fontSize: 8, opacity: 0.7 }}>▼</span>
          </button>

          {/* Desktop-only Quick Controls (On mobile they live in ⚙ Settings) */}
          <div className="hide-mobile" style={{ alignItems: "center", gap: 6 }}>
            {/* Font Size Adjusters */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "2px",
              }}
            >
              <button
                id="btn-fs-font-minus"
                onClick={() => updateFontSize(-3)}
                title="Diminuer la police"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text2)",
                  width: 26,
                  height: 24,
                  cursor: "pointer",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                A-
              </button>
              <span style={{ fontSize: 10, color: "var(--text3)", padding: "0 4px", fontFamily: "monospace" }}>
                {fontSize}
              </span>
              <button
                id="btn-fs-font-plus"
                onClick={() => updateFontSize(3)}
                title="Agrandir la police"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text2)",
                  width: 26,
                  height: 24,
                  cursor: "pointer",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                A+
              </button>
            </div>

            {/* Toggle Translation Button */}
            {translationText && (
              <button
                id="btn-fs-toggle-trans"
                onClick={() => setShowTranslation((v) => !v)}
                title={showTranslation ? "Masquer la traduction" : "Afficher la traduction"}
                style={{
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${showTranslation ? "rgba(91,200,245,0.4)" : "rgba(255,255,255,0.1)"}`,
                  background: showTranslation ? "rgba(91,200,245,0.12)" : "rgba(255,255,255,0.03)",
                  color: showTranslation ? "var(--teal2)" : "var(--text3)",
                  fontSize: 10,
                  fontFamily: "'Cinzel',serif",
                  cursor: "pointer",
                  letterSpacing: 0.5,
                }}
              >
                TRAD {showTranslation ? "ON" : "OFF"}
              </button>
            )}

            {/* Quick Tajweed badge */}
            {(showQalqala || showMadd || showIzhar || showIdgham) && (
              <div
                title="Tajweed actif"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(201,168,76,0.1)",
                  border: "1px solid rgba(201,168,76,0.3)",
                  fontSize: 10,
                  fontFamily: "'Cinzel',serif",
                  color: "var(--gold2)",
                }}
              >
                <span>☪</span>
                <span>TAJWEED</span>
              </div>
            )}

            {/* Auto Open Fullscreen Preference */}
            {onToggleFullScreenOption && (
              <button
                id="btn-fs-toggle-auto-open"
                onClick={onToggleFullScreenOption}
                title="Ouvrir automatiquement en grand au clic sur un verset"
                style={{
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${fullScreenOption ? "var(--gold)" : "rgba(255,255,255,0.1)"}`,
                  background: fullScreenOption ? "rgba(201,168,76,0.15)" : "transparent",
                  color: fullScreenOption ? "var(--gold2)" : "var(--text3)",
                  fontSize: 10,
                  fontFamily: "'Cinzel',serif",
                  cursor: "pointer",
                }}
              >
                AUTO {fullScreenOption ? "✓" : "○"}
              </button>
            )}

            {/* Browser Fullscreen Trigger */}
            <button
              id="btn-fs-native"
              onClick={toggleNativeFullscreen}
              title={isNativeFs ? "Quitter le plein écran (F)" : "Plein écran navigateur (F)"}
              style={{
                width: 30,
                height: 30,
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.03)",
                color: "var(--text2)",
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isNativeFs ? "⤓" : "⛶"}
            </button>

            {/* Desktop Close Button */}
            <button
              id="btn-fs-close"
              onClick={onClose}
              title="Fermer la vue agrandie (Échap)"
              style={{
                width: 30,
                height: 30,
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(224,90,90,0.35)",
                background: "rgba(224,90,90,0.1)",
                color: "#ff7b7b",
                fontSize: 15,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Quick Settings Popover Modal ──────────────────────── */}
      {showQuickSettings && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3400,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 10,
          }}
          onClick={() => setShowQuickSettings(false)}
        >
          <div
            style={{
              background: "#10141f",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: "16px 16px 12px 12px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: "0 -10px 30px rgba(0,0,0,0.8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: "var(--gold2)" }}>
                ⚙ OPTIONS D'AFFICHAGE
              </span>
              <button
                onClick={() => setShowQuickSettings(false)}
                style={{ background: "transparent", border: "none", color: "var(--text2)", fontSize: 18, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Font Size Row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 12, color: "var(--text)" }}>Taille du texte arabe</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => updateFontSize(-3)}
                  style={{ width: 34, height: 32, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(255,255,255,0.05)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}
                >
                  A-
                </button>
                <span style={{ fontFamily: "monospace", fontSize: 12, minWidth: 26, textAlign: "center", color: "var(--gold2)" }}>
                  {fontSize}px
                </span>
                <button
                  onClick={() => updateFontSize(3)}
                  style={{ width: 34, height: 32, borderRadius: 6, border: "1px solid var(--border)", background: "rgba(255,255,255,0.05)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}
                >
                  A+
                </button>
              </div>
            </div>

            {/* Toggle Translation */}
            {translationText && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 12, color: "var(--text)" }}>Afficher la traduction</span>
                <button
                  onClick={() => setShowTranslation((v) => !v)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 16,
                    border: `1px solid ${showTranslation ? "var(--teal)" : "rgba(255,255,255,0.15)"}`,
                    background: showTranslation ? "rgba(62,184,160,0.2)" : "rgba(255,255,255,0.04)",
                    color: showTranslation ? "var(--teal2)" : "var(--text3)",
                    fontSize: 11,
                    fontFamily: "'Cinzel',serif",
                    cursor: "pointer",
                  }}
                >
                  {showTranslation ? "ACTIVÉ ✓" : "DÉSACTIVÉ"}
                </button>
              </div>
            )}

            {/* Auto Open Fullscreen */}
            {onToggleFullScreenOption && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 12, color: "var(--text)" }}>Ouvrir en grand au clic</span>
                <button
                  onClick={onToggleFullScreenOption}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 16,
                    border: `1px solid ${fullScreenOption ? "var(--gold)" : "rgba(255,255,255,0.15)"}`,
                    background: fullScreenOption ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.04)",
                    color: fullScreenOption ? "var(--gold2)" : "var(--text3)",
                    fontSize: 11,
                    fontFamily: "'Cinzel',serif",
                    cursor: "pointer",
                  }}
                >
                  {fullScreenOption ? "ACTIVÉ ✓" : "DÉSACTIVÉ"}
                </button>
              </div>
            )}

            {/* Native Fullscreen */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
              <span style={{ fontSize: 12, color: "var(--text)" }}>Plein écran navigateur</span>
              <button
                onClick={toggleNativeFullscreen}
                style={{
                  padding: "6px 14px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--text)",
                  fontSize: 11,
                  fontFamily: "'Cinzel',serif",
                  cursor: "pointer",
                }}
              >
                {isNativeFs ? "QUITTER ⤓" : "ACTIVER ⛶"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reciter Selector Modal Dialog / Bottom Sheet on Mobile ─────── */}
      {showReciterModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3500,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: isMobile ? "flex-end" : "center",
            justifyContent: "center",
            padding: isMobile ? "0" : 16,
          }}
          onClick={() => setShowReciterModal(false)}
        >
          <div
            className="fs-reciter-dialog"
            style={{
              background: "#10141e",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: isMobile ? "18px 18px 0 0" : 12,
              width: "100%",
              maxWidth: 480,
              maxHeight: isMobile ? "80vh" : "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 14px 44px rgba(0,0,0,0.85)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Sheet Handle */}
            {isMobile && (
              <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 2px" }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.25)" }} />
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: "var(--gold2)" }}>
                  CHOISIR UN RÉCITATEUR
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                  Actuel · {activeReciterObj?.label || reciterName || recitatorId}
                </div>
              </div>
              <button
                onClick={() => setShowReciterModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--text2)", fontSize: 20, cursor: "pointer", padding: "4px 8px" }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <input
                autoFocus
                type="search"
                value={reciterSearch}
                onChange={(e) => setReciterSearch(e.target.value)}
                placeholder="Rechercher un récitateur (ex: Alafasy, Ghamadi...)"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: "#fff",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4, WebkitOverflowScrolling: "touch" }}>
              {visibleReciters.map((r) => {
                const isSelected = r.id === (recitatorId || activeReciterObj?.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      onSelectReciter?.(r.id);
                      setShowReciterModal(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: 8,
                      background: isSelected ? "rgba(201,168,76,0.18)" : "transparent",
                      border: `1px solid ${isSelected ? "var(--gold)" : "transparent"}`,
                      color: isSelected ? "var(--gold2)" : "var(--text)",
                      cursor: "pointer",
                      textAlign: "left",
                      minHeight: 44,
                      transition: "all .12s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{r.flag || "🎙️"}</span>
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400 }}>{r.label}</span>
                    </div>
                    {isSelected && <span style={{ color: "var(--gold2)", fontWeight: 700 }}>✓</span>}
                  </button>
                );
              })}
              {visibleReciters.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                  Aucun récitateur correspondant trouvé.
                </div>
              )}
            </div>
            <div style={{ padding: "10px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "var(--text3)", display: "flex", justifyContent: "space-between" }}>
              <span>{visibleReciters.length} récitateur(s)</span>
              <span>Appuyer pour appliquer</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Scrollable Body with Touch Gestures ──────────────────── */}
      <div
        ref={scrollContainerRef}
        className="fs-body"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: isMobile ? "14px 10px calc(86px + env(safe-area-inset-bottom, 0px))" : "20px 20px calc(110px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Floating Side Arrow Buttons — STRICTLY FOR DESKTOP ONLY */}
        <button
          id="btn-fs-float-prev"
          className="fs-float-nav hide-mobile"
          disabled={!hasPrev}
          onClick={() => hasPrev && onSelectAyat?.(currentAyatNum - 1)}
          title="Verset précédent (Flèche gauche)"
          style={{
            position: "fixed",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: hasPrev ? "rgba(18,22,34,0.85)" : "rgba(18,22,34,0.3)",
            border: `1px solid ${hasPrev ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.05)"}`,
            color: hasPrev ? "var(--gold2)" : "rgba(255,255,255,0.15)",
            fontSize: 16,
            cursor: hasPrev ? "pointer" : "default",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 15,
            backdropFilter: "blur(8px)",
            transition: "all .15s",
          }}
        >
          ◀
        </button>

        <button
          id="btn-fs-float-next"
          className="fs-float-nav hide-mobile"
          disabled={!hasNext}
          onClick={() => hasNext && onSelectAyat?.(currentAyatNum + 1)}
          title="Verset suivant (Flèche droite)"
          style={{
            position: "fixed",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: hasNext ? "rgba(18,22,34,0.85)" : "rgba(18,22,34,0.3)",
            border: `1px solid ${hasNext ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.05)"}`,
            color: hasNext ? "var(--gold2)" : "rgba(255,255,255,0.15)",
            fontSize: 16,
            cursor: hasNext ? "pointer" : "default",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 15,
            backdropFilter: "blur(8px)",
            transition: "all .15s",
          }}
        >
          ▶
        </button>

        {/* Inner Content Box */}
        <div
          style={{
            maxWidth: 1000,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            margin: "0 auto",
            gap: isMobile ? 14 : 20,
          }}
        >
          {/* Prominent Center Stage Verse Badge */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: isMobile ? 8 : 12,
                padding: isMobile ? "4px 14px" : "6px 20px",
                borderRadius: 24,
                background: "radial-gradient(ellipse at center, rgba(201,168,76,0.18) 0%, rgba(201,168,76,0.04) 100%)",
                border: "1px solid rgba(201,168,76,0.4)",
                boxShadow: "0 0 20px rgba(201,168,76,0.12)",
                maxWidth: "96%",
              }}
            >
              <span
                style={{
                  fontFamily: "'Amiri Quran', serif",
                  fontSize: isMobile ? 18 : 22,
                  color: "var(--gold2)",
                  textShadow: "0 0 10px rgba(201,168,76,0.5)",
                }}
              >
                ﴿ {toArabicDigits(currentAyatNum)} ﴾
              </span>
              <span
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: isMobile ? 11 : 13,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: "var(--gold2)",
                }}
              >
                VERSET {currentAyatNum} <span style={{ color: "var(--text3)", fontWeight: 400 }}>/ {totalAyats}</span>
              </span>
              {(ayat.page || ayat.juz) && (
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: "'Cinzel', serif",
                    letterSpacing: 0.8,
                    color: "var(--teal2)",
                    borderLeft: "1px solid rgba(255,255,255,0.15)",
                    paddingLeft: 8,
                  }}
                >
                  {ayat.page ? `P.${ayat.page}` : ""} {ayat.juz ? `· J.${ayat.juz}` : ""}
                </span>
              )}
            </div>

            {/* Mobile swipe hint */}
            {isMobile && (
              <span style={{ fontSize: 9, color: "var(--text3)", opacity: 0.6, letterSpacing: 0.5 }}>
                Glisser vers la gauche ou droite pour changer de verset
              </span>
            )}
          </div>

          {/* Active Selection / Aide-Mémoire Mode Banner */}
          {isSelecting && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                maxWidth: 750,
                padding: "8px 12px",
                borderRadius: 8,
                background: partSelectStep === 'start' ? "rgba(201,168,76,0.15)" : "rgba(62,184,160,0.15)",
                border: `1px solid ${partSelectStep === 'start' ? "var(--gold)" : "var(--teal)"}`,
                color: partSelectStep === 'start' ? "var(--gold2)" : "var(--teal2)",
                fontSize: 10,
                fontFamily: "'Cinzel',serif",
                letterSpacing: 0.5,
                fontWeight: 700,
                gap: 6,
              }}
            >
              <span>
                {partSelectStep === 'start'
                  ? "① CLIQUEZ SUR LE PREMIER MOT DE LA PARTIE"
                  : `② CLIQUEZ SUR LE DERNIER MOT — DÉBUT : "${ayatWords[partSelectStart]}"`}
              </span>
              <button
                onClick={() => {
                  setPartSelectAyat?.(null);
                  setPartSelectStep?.(null);
                  setPartSelectStart?.(null);
                }}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  borderRadius: 4,
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 9,
                  fontFamily: "'Cinzel',serif",
                  flexShrink: 0,
                }}
              >
                ANNULER
              </button>
            </div>
          )}

          {aideMemoireClickMode && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                maxWidth: 750,
                padding: "8px 12px",
                borderRadius: 8,
                background: aideMemoireClickMode === 'highlight' ? "rgba(255,209,102,0.15)" : "rgba(255,126,179,0.15)",
                border: `1px solid ${aideMemoireClickMode === 'highlight' ? "var(--gold)" : "#ff7eb3"}`,
                color: aideMemoireClickMode === 'highlight' ? "#ffd166" : "#ff7eb3",
                fontSize: 10,
                fontFamily: "'Cinzel',serif",
                letterSpacing: 0.5,
                fontWeight: 700,
                gap: 6,
              }}
            >
              <span>
                {aideMemoireClickMode === 'highlight'
                  ? "CLIQUEZ SUR UN MOT POUR MODIFIER LE SURLIGNAGE"
                  : "CLIQUEZ SUR UN MOT POUR MARQUER LE RADICAL"}
              </span>
              <button
                onClick={() => setAideMemoireClickMode?.(null)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  borderRadius: 4,
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 9,
                  fontFamily: "'Cinzel',serif",
                  flexShrink: 0,
                }}
              >
                FERMER
              </button>
            </div>
          )}

          {/* Arabic Text Display with Complete Rendering */}
          <div
            id="fs-arabic-text"
            className="fs-arabic-text"
            style={{
              fontFamily: "'Amiri Quran', serif",
              fontSize: `${effectiveFontSize}px`,
              lineHeight: isMobile ? 2.1 : 2.3,
              direction: "rtl",
              color: "#f8f5ed",
              padding: isMobile ? "0 4px" : "0 20px",
              textAlign: "center",
              textShadow: "0 2px 18px rgba(0,0,0,0.65)",
              transition: "font-size .2s ease",
              width: "100%",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {renderFullAyatText()}

            {/* End of Ayah Quranic Ornament Medallion with Eastern Arabic verse number */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: isMobile ? "8px" : "14px",
                marginLeft: isMobile ? "4px" : "8px",
                color: "var(--gold2)",
                fontSize: `${Math.round(effectiveFontSize * 0.85)}px`,
                verticalAlign: "middle",
                fontFamily: "'Amiri Quran', serif",
                userSelect: "none",
              }}
            >
              <span style={{ fontSize: `${Math.round(effectiveFontSize * 1.05)}px`, position: "relative" }}>
                ۝
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: `${Math.round(effectiveFontSize * 0.42)}px`,
                    fontFamily: "'Amiri', serif",
                    color: "var(--gold3)",
                    top: "-2px",
                  }}
                >
                  {toArabicDigits(currentAyatNum)}
                </span>
              </span>
            </span>
          </div>

          {/* Translation Display */}
          {showTranslation && translationText && (
            <div
              id="fs-translation-text"
              style={{
                maxWidth: 840,
                width: isMobile ? "96%" : "92%",
                padding: isMobile ? "12px 14px" : "16px 24px",
                background: "rgba(91,200,245,0.04)",
                border: "1px solid rgba(91,200,245,0.18)",
                borderRadius: 12,
                fontSize: isMobile ? 14 : 16,
                lineHeight: isMobile ? 1.65 : 1.8,
                color: "var(--text)",
                textAlign: "center",
                fontStyle: "italic",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: -9,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 8,
                  letterSpacing: 1.5,
                  color: "var(--teal2)",
                  background: "#10141e",
                  padding: "0 8px",
                  fontFamily: "'Cinzel',serif",
                  fontWeight: 600,
                  borderRadius: 4,
                  border: "1px solid rgba(91,200,245,0.25)",
                }}
              >
                TRADUCTION ({(translationLang || "FR").toUpperCase()})
              </span>
              "{translationText}"
            </div>
          )}

          {/* Study & Quick Actions Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: isMobile ? 6 : 8,
              flexWrap: "wrap",
              padding: "4px 0",
              width: "100%",
            }}
          >
            {/* Mark Learned Button */}
            <button
              id="btn-fs-toggle-learned"
              onClick={toggleLearned}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: isMobile ? "6px 11px" : "6px 14px",
                borderRadius: 20,
                border: `1px solid ${isLearned ? "var(--green)" : "rgba(255,255,255,0.1)"}`,
                background: isLearned ? "rgba(76,175,129,0.18)" : "rgba(255,255,255,0.03)",
                color: isLearned ? "var(--green2)" : "var(--text3)",
                fontSize: isMobile ? 9 : 10,
                fontFamily: "'Cinzel',serif",
                fontWeight: 600,
                letterSpacing: 0.5,
                cursor: "pointer",
                transition: "all .15s",
                minHeight: 34,
              }}
            >
              <span>{isLearned ? "✓ APPRIS" : "○ MARQUER APPRIS"}</span>
            </button>

            {/* To Revise Button (Opens Reviser panel in Submenu) */}
            <button
              id="btn-fs-toggle-revise"
              onClick={() => {
                if (!isToRevise) toggleToRevise();
                if (setSubmenuMode) {
                  setSubmenuMode("reviser");
                  setShowSubmenu(true);
                  setTimeout(() => {
                    document.getElementById("fs-submenu-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 50);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: isMobile ? "6px 11px" : "6px 14px",
                borderRadius: 20,
                border: `1px solid ${isToRevise ? "var(--gold)" : "rgba(255,255,255,0.1)"}`,
                background: isToRevise ? "rgba(201,168,76,0.18)" : "rgba(255,255,255,0.03)",
                color: isToRevise ? "var(--gold2)" : "var(--text3)",
                fontSize: isMobile ? 9 : 10,
                fontFamily: "'Cinzel',serif",
                fontWeight: 600,
                letterSpacing: 0.5,
                cursor: "pointer",
                transition: "all .15s",
                minHeight: 34,
              }}
              title="Ouvrir le panneau À Réviser pour cibler mots ou lettres"
            >
              <span>🔖 {isToRevise ? "À RÉVISER (ACTIF)" : "MARQUER À RÉVISER"}</span>
            </button>

            {isToRevise && (
              <button
                id="btn-fs-untoggle-revise"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleToRevise();
                }}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 16,
                  color: "var(--text3)",
                  fontSize: 9,
                  fontFamily: "'Cinzel',serif",
                  padding: "4px 8px",
                  cursor: "pointer",
                  minHeight: 34,
                }}
                title="Retirer complètement des révisions"
              >
                ✕ RETIRER
              </button>
            )}

            {/* Create Part Button */}
            {onStartPartCreate && (
              <button
                id="btn-fs-create-part"
                onClick={onStartPartCreate}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: isMobile ? "6px 11px" : "6px 14px",
                  borderRadius: 20,
                  border: "1px solid rgba(62,184,160,0.35)",
                  background: "rgba(62,184,160,0.1)",
                  color: "var(--teal2)",
                  fontSize: isMobile ? 9 : 10,
                  fontFamily: "'Cinzel',serif",
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  cursor: "pointer",
                  transition: "all .15s",
                  minHeight: 34,
                }}
                title="Découper ce verset en parties"
              >
                <span>✂ DÉCOUPER</span>
              </button>
            )}

            {masteryPercent > 0 && (
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: 0.8,
                  padding: "5px 10px",
                  borderRadius: 20,
                  border: "1px solid rgba(201,168,76,0.4)",
                  color: "var(--gold2)",
                  fontFamily: "'Cinzel',serif",
                  background: "rgba(201,168,76,0.08)",
                  display: "flex",
                  alignItems: "center",
                  minHeight: 34,
                }}
              >
                MAÎTRISE: {masteryPercent}%
              </div>
            )}

            {/* Jump to Submenu Button */}
            {setSubmenuMode && (
              <button
                id="btn-fs-jump-submenu"
                onClick={() => {
                  setShowSubmenu(true);
                  setTimeout(() => {
                    document.getElementById("fs-submenu-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 50);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: isMobile ? "6px 11px" : "6px 14px",
                  borderRadius: 20,
                  border: "1px solid rgba(201,168,76,0.35)",
                  background: "rgba(201,168,76,0.1)",
                  color: "var(--gold2)",
                  fontSize: isMobile ? 9 : 10,
                  fontFamily: "'Cinzel',serif",
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  cursor: "pointer",
                  transition: "all .15s",
                  minHeight: 34,
                }}
              >
                <span>📋 SOUS-MENU · {(submenuMode || "LECTURE").toUpperCase()}</span>
              </button>
            )}
          </div>

          {/* ── Submenu Section in Full Screen (Big View) ── */}
          {setSubmenuMode && (
            <section
              id="fs-submenu-section"
              style={{
                width: "100%",
                maxWidth: 960,
                background: "rgba(18, 22, 34, 0.92)",
                border: "1px solid rgba(201,168,76,0.25)",
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: "0 10px 36px rgba(0,0,0,0.55)",
                textAlign: "left",
                marginTop: 6,
                marginBottom: 20,
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                transition: "all .2s ease",
              }}
            >
              {/* Submenu Top Header Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(10, 13, 20, 0.8)",
                  borderBottom: "1px solid rgba(201,168,76,0.18)",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ color: "var(--gold)", fontSize: 12 }}>📋</span>
                  <span
                    style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: isMobile ? 10 : 11,
                      fontWeight: 700,
                      letterSpacing: 1.2,
                      color: "var(--gold2)",
                    }}
                  >
                    SOUS-MENU V.{currentAyatNum}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "'Cinzel', serif",
                      letterSpacing: 0.5,
                      color: "var(--teal2)",
                      background: "rgba(62,184,160,0.12)",
                      padding: "2px 6px",
                      borderRadius: 10,
                      border: "1px solid rgba(62,184,160,0.25)",
                    }}
                  >
                    {(submenuMode || "LECTURE").toUpperCase()}
                  </span>
                </div>

                <button
                  id="btn-fs-toggle-submenu-collapse"
                  onClick={() => setShowSubmenu((v) => !v)}
                  title={showSubmenu ? "Masquer le contenu" : "Déplier le sous-menu"}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--text2)",
                    fontSize: 9,
                    fontFamily: "'Cinzel', serif",
                    letterSpacing: 0.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    borderRadius: 6,
                  }}
                >
                  <span>{showSubmenu ? "▲ MASQUER" : "▼ DÉPLIER"}</span>
                </button>
              </div>

              {/* Submenu Tabs and Active Mode Content */}
              {showSubmenu && (
                <div style={{ width: "100%", overflowX: "hidden" }}>
                  <Submenu
                    key={currentAyatNum}
                    ayat={ayat}
                    surahNum={selectedSurah.number}
                    ld={ld}
                    setLData={setLData}
                    submenuMode={submenuMode}
                    setSubmenuMode={setSubmenuMode}
                    audioUrl={audioUrl}
                    isMainPlaying={isPlaying}
                    timestamps={timestamps}
                    onLoadTimestamps={onLoadTimestamps}
                    onUpdateTimestamps={onUpdateTimestamps}
                    onLocalPlay={onLocalPlay}
                    partSelectAyat={partSelectAyat}
                    partSelectStep={partSelectStep}
                    onStartPartCreate={onStartPartCreate}
                    collections={collections}
                    ayatInCollections={ayatInCollections}
                    onOpenCollModal={onOpenCollModal}
                    aideMemoireClickMode={aideMemoireClickMode}
                    setAideMemoireClickMode={setAideMemoireClickMode}
                    spellCheck={spellCheck}
                    onSetLoop={onToggleLoop}
                    ayatLoopActive={loopActive}
                    translationLang={translationLang}
                    ayatTranslation={translationText}
                    wbwWords={wbwWords}
                  />
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* ── Bottom Floating Player & Navigation Bar ───────────────────── */}
      <footer
        className="fs-footer"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(180deg, rgba(16,20,30,0.92) 0%, rgba(10,13,20,0.98) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(201,168,76,0.2)",
          padding: isMobile ? "8px 12px calc(8px + env(safe-area-inset-bottom, 0px))" : "12px 24px calc(12px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 25,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
          gap: 6,
        }}
      >
        {/* Left: Previous Ayat button */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            id="btn-fs-footer-prev"
            disabled={!hasPrev}
            onClick={() => hasPrev && onSelectAyat?.(currentAyatNum - 1)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: isMobile ? "8px 12px" : "7px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(255,255,255,0.1)",
              background: hasPrev ? "rgba(255,255,255,0.06)" : "transparent",
              color: hasPrev ? "var(--text)" : "rgba(255,255,255,0.15)",
              fontSize: isMobile ? 13 : 10,
              fontFamily: "'Cinzel',serif",
              letterSpacing: 0.5,
              cursor: hasPrev ? "pointer" : "default",
              minHeight: isMobile ? 40 : 34,
              minWidth: isMobile ? 42 : "auto",
            }}
          >
            <span>⏮</span>
            <span className="hide-mobile">PRÉCÉDENT</span>
          </button>
        </div>

        {/* Center: Loop + Main Play/Pause Button */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14 }}>
          {/* Loop Button */}
          {onToggleLoop && (
            <button
              id="btn-fs-toggle-loop"
              onClick={onToggleLoop}
              title={loopActive ? "Désactiver la boucle sur ce verset" : "Répéter ce verset en boucle"}
              style={{
                width: isMobile ? 38 : 36,
                height: isMobile ? 38 : 36,
                borderRadius: "50%",
                border: `1px solid ${loopActive ? "var(--teal)" : "rgba(255,255,255,0.15)"}`,
                background: loopActive ? "rgba(62,184,160,0.22)" : "rgba(255,255,255,0.04)",
                color: loopActive ? "var(--teal2)" : "var(--text3)",
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all .15s",
              }}
            >
              ↺
            </button>
          )}

          {/* Main Play / Pause Trigger */}
          <button
            id="btn-fs-play-pause"
            onClick={onTogglePlay}
            title={isPlaying ? "Mettre en pause (Espace)" : "Écouter la récitation (Espace)"}
            style={{
              width: isMobile ? 48 : 52,
              height: isMobile ? 48 : 52,
              borderRadius: "50%",
              border: `2px solid ${isPlaying ? "var(--teal)" : "var(--gold)"}`,
              background: isPlaying ? "var(--teal)" : "linear-gradient(135deg, var(--gold) 0%, #b8933b 100%)",
              color: "#fff",
              fontSize: isMobile ? 16 : 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isPlaying ? "0 0 24px rgba(62,184,160,0.5)" : "0 0 20px rgba(201,168,76,0.35)",
              transition: "all .2s",
              paddingLeft: isPlaying ? 0 : 2,
            }}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
        </div>

        {/* Right: Next Ayat button + Exit */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
          <button
            id="btn-fs-footer-next"
            disabled={!hasNext}
            onClick={() => hasNext && onSelectAyat?.(currentAyatNum + 1)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: isMobile ? "8px 12px" : "7px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(255,255,255,0.1)",
              background: hasNext ? "rgba(255,255,255,0.06)" : "transparent",
              color: hasNext ? "var(--text)" : "rgba(255,255,255,0.15)",
              fontSize: isMobile ? 13 : 10,
              fontFamily: "'Cinzel',serif",
              letterSpacing: 0.5,
              cursor: hasNext ? "pointer" : "default",
              minHeight: isMobile ? 40 : 34,
              minWidth: isMobile ? 42 : "auto",
            }}
          >
            <span className="hide-mobile">SUIVANT</span>
            <span>⏭</span>
          </button>

          <button
            id="btn-fs-footer-exit"
            onClick={onClose}
            style={{
              padding: isMobile ? "8px 10px" : "7px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(201,168,76,0.4)",
              background: "rgba(201,168,76,0.1)",
              color: "var(--gold2)",
              fontSize: isMobile ? 9 : 10,
              fontFamily: "'Cinzel',serif",
              letterSpacing: 0.5,
              cursor: "pointer",
              fontWeight: 600,
              transition: "all .15s",
              minHeight: isMobile ? 40 : 34,
            }}
          >
            {isMobile ? "✕" : "QUITTER"}
          </button>
        </div>
      </footer>
    </div>
  );
}
