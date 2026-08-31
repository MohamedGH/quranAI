import { EditorWords } from "./Submenu.jsx";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { sel } from "../../store.js";
import { PlayingArabicHighlighted } from "../common/ArabicHighlighted.jsx";
import { VoiceRecorder } from "../audio/VoiceRecorder.jsx";

export function LectureMode({ ayat, surahNum, audioUrl, isMainPlaying, timestamps, onLoadTimestamps, onUpdateTimestamps, onLocalPlay }) {
  const audioRef  = useRef(null);
  const rafRef    = useRef(null);
  const [lectureTab, setLectureTab]         = useState("listen"); // "listen" | "record"
  const [currentMs, setCurrentMs]   = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [editTs, setEditTs] = useState(null);
  useEffect(() => { if (timestamps) setEditTs(JSON.parse(JSON.stringify(timestamps))); }, [timestamps]);

  const stop    = () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } onLocalPlay?.(null); };
  useEffect(() => { if (isMainPlaying && audioRef.current) { audioRef.current.pause(); stop(); } }, [isMainPlaying]);
  const onPlay  = () => {
    const tick = () => {
      if (audioRef.current) {
        const ms = audioRef.current.currentTime * 1000;
        setCurrentMs(ms);
        onLocalPlay?.(ms);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  const onPause = () => stop();
  const onEnded = () => { stop(); setCurrentMs(0); };

  const handleFile = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { try { onLoadTimestamps(JSON.parse(ev.target.result)); } catch { alert("JSON invalide"); } };
    r.readAsText(f);
  };

  const isDiacritic = ch => /[\u064B-\u065F\u0670]/.test(ch);

  const setCharField = (wi, ci, field, val) => {
    setEditTs(prev => {
      const next  = JSON.parse(JSON.stringify(prev));
      const chars = next.words[wi].chars;
      chars[ci][field] = Number(val);
      if (field === 'end') {
        let j = ci + 1;
        while (j < chars.length && isDiacritic(chars[j].char)) { chars[j].start = Number(val); chars[j].end = Number(val); j++; }
        if (j < chars.length && !isDiacritic(chars[j].char)) chars[j].start = Number(val);
      }
      if (field === 'start') {
        if (isDiacritic(chars[ci].char)) {
          let j = ci - 1;
          while (j >= 0 && isDiacritic(chars[j].char)) j--;
          if (j >= 0) { chars[j].start = Number(val); }
        } else {
          let j = ci - 1;
          while (j >= 0 && isDiacritic(chars[j].char)) j--;
          if (j >= 0) chars[j].end = Number(val);
        }
      }
      return next;
    });
  };

  const captureStart = (wi, ci) => {
    const ms = Math.round((audioRef.current?.currentTime ?? 0) * 1000);
    setCharField(wi, ci, 'start', ms);
  };
  const captureEnd = (wi, ci) => {
    const ms = Math.round((audioRef.current?.currentTime ?? 0) * 1000);
    setCharField(wi, ci, 'end', ms);
  };

  const saveAndExport = () => {
    onUpdateTimestamps(editTs);
    const blob = new Blob([JSON.stringify(editTs, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `timestamps_ayat_${ayat.numberInSurah}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const ts = showEditor ? editTs : timestamps;

  const [localPlaying, setLocalPlaying] = useState(false);
  const [localCurrentMs, setLocalCurrentMs] = useState(0);
  const [localDuration, setLocalDuration] = useState(0);

  const handlePlay2 = () => { setLocalPlaying(true); onPlay(); };
  const handlePause2 = () => { setLocalPlaying(false); onPause(); };
  const handleEnded2 = () => { setLocalPlaying(false); onEnded(); setLocalCurrentMs(0); };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) audioRef.current.play();
    else audioRef.current.pause();
  };

  const seek = (e) => {
    if (!audioRef.current || !localDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * (localDuration / 1000);
  };

  const fmt = ms => {
    if (!ms) return "0:00";
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  };

  const pct = localDuration > 0 ? Math.min(1, localCurrentMs / localDuration) : 0;

  // Keep localCurrentMs in sync with onPlay tick
  const origOnPlay = onPlay;
  const onPlay2 = () => {
    const tick = () => {
      if (audioRef.current) {
        const ms = audioRef.current.currentTime * 1000;
        setLocalCurrentMs(ms);
        onLocalPlay?.(ms);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {/* Tab bar */}
      <div style={{ display:"flex", gap:6 }}>
        {[["listen","📖 ÉCOUTER"],["record","🎙 ENREGISTRER"]].map(([id,label])=>(
          <button key={id} onClick={() => setLectureTab(id)} style={{
            fontSize:8, letterSpacing:2, padding:"5px 14px", fontFamily:"'Cinzel',serif",
            background: lectureTab===id ? "rgba(201,168,76,.12)" : "transparent",
            border: `1px solid ${lectureTab===id ? "var(--gold)" : "var(--border2)"}`,
            color: lectureTab===id ? "var(--gold2)" : "var(--text3)",
            borderRadius:6, cursor:"pointer", transition:"all .15s",
          }}>{label}</button>
        ))}
      </div>

      {lectureTab === "listen" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize:8, letterSpacing:2, color:"var(--text3)", fontFamily:"'Cinzel',serif" }}>
              AYAT {ayat.numberInSurah}
            </div>
            {timestamps && (
              <button onClick={() => setShowEditor(s => !s)} style={{
                fontSize:7, letterSpacing:1, padding:"3px 10px", fontFamily:"'Cinzel',serif",
                background: showEditor ? "rgba(201,168,76,.1)" : "transparent",
                border:`1px solid ${showEditor?"var(--gold)":"var(--border2)"}`,
                color: showEditor ? "var(--gold2)" : "var(--text3)",
                borderRadius:4, cursor:"pointer",
              }}>{showEditor ? "✕ FERMER ÉDITEUR" : "✏ TIMESTAMPS"}</button>
            )}
          </div>

          {/* Custom player */}
          <div style={{
            background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10,
            padding:"12px 14px", display:"flex", flexDirection:"column", gap:10,
          }}>
            {/* Hidden native audio */}
            <audio ref={audioRef} src={audioUrl}
              onPlay={onPlay2} onPause={handlePause2} onEnded={handleEnded2}
              onLoadedMetadata={() => setLocalDuration((audioRef.current?.duration||0)*1000)}
              onTimeUpdate={() => setLocalCurrentMs((audioRef.current?.currentTime||0)*1000)}
              style={{ display:"none" }} />

            {/* Progress bar */}
            <div onClick={seek} style={{
              height:4, background:"var(--surface3)", borderRadius:2, cursor:"pointer",
              position:"relative", overflow:"hidden",
            }}>
              <div style={{
                position:"absolute", left:0, top:0, bottom:0,
                width:`${pct*100}%`, background:"var(--gold)",
                borderRadius:2, transition:"width .1s linear",
              }}/>
            </div>

            {/* Controls row */}
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {/* Play/pause */}
              <button onClick={togglePlay} style={{
                width:36, height:36, borderRadius:"50%",
                background: localPlaying ? "rgba(201,168,76,.15)" : "rgba(62,184,160,.12)",
                border:`1px solid ${localPlaying ? "var(--gold)" : "var(--teal)"}`,
                color: localPlaying ? "var(--gold2)" : "var(--teal2)",
                fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                flexShrink:0, transition:"all .15s",
              }}>{localPlaying ? "⏸" : "▶"}</button>

              {/* Time */}
              <div style={{ fontSize:8, letterSpacing:1, color:"var(--text3)", fontFamily:"'Cinzel',serif", flexShrink:0 }}>
                {fmt(localCurrentMs)} / {fmt(localDuration)}
              </div>

              {/* Spacer */}
              <div style={{ flex:1 }}/>

              {/* TS load if none */}
              {!timestamps && (
                <label style={{ cursor:"pointer" }}>
                  <input type="file" accept=".json" onChange={handleFile} style={{ display:"none" }} />
                  <span style={{ fontSize:7, letterSpacing:1, padding:"3px 10px",
                    border:"1px solid var(--border2)", borderRadius:4, color:"var(--text3)",
                    fontFamily:"'Cinzel',serif", whiteSpace:"nowrap" }}>📂 TS</span>
                </label>
              )}
              {timestamps && <div style={{ fontSize:7, color:"var(--teal2)", letterSpacing:1 }}>⚡ TS</div>}
            </div>
          </div>

          {/* TS editor */}
          {showEditor && editTs?.words && (
            <EditorWords editTs={editTs} currentMs={localCurrentMs} setCharField={setCharField}
              captureStart={captureStart} captureEnd={captureEnd}
              onSave={saveAndExport} onReset={() => setEditTs(JSON.parse(JSON.stringify(timestamps)))}
              isDiacritic={isDiacritic} audioRef={audioRef} />
          )}
        </div>
      )}

      {lectureTab === "record" && (
        <VoiceRecorder
          ayat={ayat}
          surahNum={surahNum}
          originalAudioUrl={audioUrl}
          localAudioRef={audioRef}
        />
      )}
    </div>
  );
}

// ─── Normalise Arabic text for comparison ────────────────────────────────────
// Step 1 : unify all alef/hamza variants BEFORE stripping diacritics
//   ٱ (wasl \u0671) → special marker W so we can detect it as silent later
//   أ إ آ ء ؤ ئ → ا  (all treated as plain alef for phonetic matching)
// Step 2 : strip tashkeel, tatweel, extra spaces
function normalizeArabic(str) {
  if (!str) return "";
  return str
    // ── Letter unification ───────────────────────────────────────────────────
    // Unify ALL alef/hamza variants → plain alef ا
    .replace(/[\u0671\u0623\u0625\u0622\u0624\u0626]/g, "\u0627")
    // Farsi Yeh ی (\u06CC) → Arabic Yeh ي (\u064A)
    .replace(/\u06CC/g, "\u064A")
    // Heh Goal ہ (\u06C1) / Heh Doachashmee ھ (\u06BE) → Heh ه (\u0647)
    .replace(/[\u06C1\u06BE]/g, "\u0647")
    // Teh Marbuta Goal ۃ (\u06C3) → Teh Marbuta ة (\u0629)
    .replace(/\u06C3/g, "\u0629")
    // ── Dagger alif expansion ───────────────────────────────────────────────
    // ىٰ (alef maqsura + dagger alif) → ا  BEFORE dagger alif expansion
    .replace(/\u0649\u0670/g, "\u0627")
    // Dagger alif ٰ (\u0670): remove diacritics between base letter and ٰ, then expand
    .replace(/([\u0600-\u06FF])[\u064B-\u065F]+([\u0670])/g, "$1$2")
    .replace(/([^\u0627\u0020])(\u0670)/g, "$1\u0627")
    .replace(/\u0670/g, "")
    // ── Alef maqsura ى rules (BEFORE diacritic stripping) ──────────────────
    .replace(/\u0649(?=[\u0600-\u06FF])/g, "\u064A")
    // ىا → ا
    .replace(/\u0649\u0627/g, "\u0627")
    // final ى after fatha or tanwin fath → ا (e.g. هُدًى، عَلَى)
    .replace(/[\u064E\u064B]\u0649(\s|$)/g, "\u0627$1")
    .replace(/[\u064E\u064B]\u0649$/g, "\u0627")
    // final ى after kasra/damma → ي (e.g. فِى = في)
    .replace(/[\u0650\u064F]\u0649(\s|$)/g, "\u064A$1")
    .replace(/[\u0650\u064F]\u0649$/g, "\u064A")
    // all other final ى (bare, no vowel) → ا
    .replace(/\u0649(\s|$)/g, "\u0627$1")
    .replace(/\u0649$/g, "\u0627")
    // ── Strip all diacritics and Quranic annotation marks ───────────────────
    // Standard tashkeel (\u064B-\u065F) + kashida (\u0640)
    .replace(/[\u0640\u064B-\u065F]/g, "")
    // Quranic marks block 1: \u0610-\u061A
    .replace(/[\u0610-\u061A]/g, "")
    // Quranic marks block 2: \u06D6-\u06ED
    .replace(/[\u06D6-\u06ED]/g, "")
    // Quranic Extended Supplement \u0870-\u08FF (incl. \u08F0-\u08F4 open tanwin/vowels)
    .replace(/[\u0870-\u08FF]/g, "")
    // Arabic Presentation Forms that slip through: \uFB50-\uFDFF, \uFE70-\uFEFF
    .replace(/[\uFB50-\uFDFF\uFE70-\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Silent letter detection ──────────────────────────────────────────────────
// Rules applied on the NORMALISED word (after normalizeArabic).
// Returns a Set of char indices that are silent (shown in gold, not penalised).

// Map of words with well-known silent letters (key = normalised form)
const SILENT_WORD_MAP = {
  // ال + noun : leading ا is hamza wasl → silent when preceded by another word
  // (handled generically below via \u0671 detection on raw word)
  "ذلك":    new Set([1]),   // silent ل : pronounced "zaalik"
  "داود":   new Set([2]),   // silent و : pronounced "daawud"
  "طاوس":   new Set([2]),   // silent و
  "اسم":    new Set([0]),   // hamza wasl in بِسْمِ
};

// ─── Hamza wasl vowel at sentence start ──────────────────────────────────────
// Returns the vowel to expect when hamza wasl is pronounced (first word of sentence):
//   'fatha'  (اَ) → word starts with ال (definite article)
//   'damma'  (اُ) → 3rd letter of raw word carries a damma  ُ  (ُ)
//   'kasra'  (اِ) → default (most verb forms, masdar, etc.)
function getWaslVowel(rawWord) {
  // Remove initial ا/ٱ to inspect the rest
  const body = rawWord.replace(/^[اٱ]/, '');
  // Rule 1 : starts with لا or لْ → definite article → fatha
  if (/^ل[اَُِْ]/.test(body) || /^لل/.test(body)) return 'fatha';
  // Rule 2 : 3rd letter of the original word (index 2) carries damma ُ (ُ)
  // The 3rd letter = rawWord[2] but diacritics may sit between letters.
  // Walk char by char skipping diacritics to find the 3rd base letter.
  const DIACRITICS = /[ً-ٟؐ-ؚۖ-ۜ۟-۪ۤۧۨ-ۭ]/;
  let letterCount = 0;
  for (let i = 0; i < rawWord.length; i++) {
    if (!DIACRITICS.test(rawWord[i])) letterCount++;
    if (letterCount === 3) {
      // Check if any diacritic immediately after this base letter is damma
      let j = i + 1;
      while (j < rawWord.length && DIACRITICS.test(rawWord[j])) {
        if (rawWord[j] === 'ُ') return 'damma'; // ُ
        j++;
      }
      break;
    }
  }
  // Rule 3 : default → kasra
  return 'kasra';
}

// wordIndex : 0 = first word of sentence (after pause/start) → wasl is PRONOUNCED
function getSilentIndices(normWord, rawWord, wordIndex = 0) {
  const silent = new Set();
  const isFirstWord = (wordIndex === 0);

  // Rule 1 : explicit word map
  if (SILENT_WORD_MAP[normWord]) return SILENT_WORD_MAP[normWord];

  // Rule 2 : Hamza wasl (ٱ \u0671) at position 0
  // SILENT in connected speech (wordIndex > 0).
  // At sentence start (wordIndex === 0) it is PRONOUNCED — not marked silent.
  if (rawWord && rawWord[0] === '\u0671' && !isFirstWord) {
    silent.add(0);
  }

  // Rule 3 : ال definite article – leading ا/ٱ is wasl
  // SILENT in connected speech, PRONOUNCED if first word of sentence.
  if (/^\u0627\u0644/.test(normWord) && !isFirstWord) {
    const firstRaw = rawWord ? rawWord[0] : '';
    if (firstRaw === '\u0671' || firstRaw === '\u0627') {
      silent.add(0);
    }
  }

  // Rule 4 : ألف الفارقة — trailing ا after plural واو — ALWAYS silent
  if (/\u0648\u0627$/.test(normWord) && normWord.length > 2) {
    silent.add(normWord.length - 1);
  }

  return silent;
}

// ─── Character-level diff within a word ──────────────────────────────────────
// Returns array of {char, status: 'ok'|'err'|'miss'|'silent'}
// ─── Character-level Levenshtein alignment ───────────────────────────────────
// Returns aligned pairs [{refChar, gotChar, op}]
// op: 'match' | 'sub' | 'ins' | 'del'
// ─── Arabic phonetic proximity ────────────────────────────────────────────────
// Cost 0   = identical
// Cost 0.3 = very close  (same articulation point, only emphasis/voicing differs)
// Cost 0.6 = close       (same broad category: stops, fricatives, gutturals…)
// Cost 1   = unrelated   (default)
//
// Groups based on makhraj (articulation point) and sifa (manner):
//   Emphatic pairs     س↔ص  ز↔ظ  د↔ض  ت↔ط   → 0.3
//   Voiced pairs      ب↔پ  ك↔ق  ف↔ب         → 0.4 (partial)
//   Gutturals         ع↔غ  ح↔خ  ه↔ح  ء↔ع   → 0.3
//   Sibilants         س↔ش  ز↔س  ص↔ض         → 0.4
//   Laterals/nasals   ل↔ن  م↔ن              → 0.5
//   Alef variants     ا↔ء  ا↔ع              → 0.4
const PHONO_PAIRS = new Map();
function addPair(a, b, cost) {
  PHONO_PAIRS.set(a + b, cost);
  PHONO_PAIRS.set(b + a, cost);
}
// Emphatic ↔ non-emphatic (same makhraj, only tafkhim differs) — very close
addPair('س','ص', 0.3);  addPair('ز','ظ', 0.3);  addPair('ز','ض', 0.35);
addPair('د','ض', 0.3);  addPair('ت','ط', 0.3);   addPair('ذ','ظ', 0.3);
// Gutturals / pharyngeals
addPair('ع','غ', 0.3);  addPair('ح','خ', 0.3);   addPair('ه','ح', 0.35);
addPair('ة','ه', 0.1);
addPair('ا','ع', 0.4);
// Sibilants
addPair('س','ش', 0.4);  addPair('ز','س', 0.4);   addPair('ص','ض', 0.4);
// Stops
addPair('ك','ق', 0.4);  addPair('ب','ف', 0.45);  addPair('ت','د', 0.4);
addPair('ك','خ', 0.45);
// Nasals / liquids
addPair('م','ن', 0.5);  addPair('ل','ن', 0.5);   addPair('ل','ر', 0.45);
// Semivowels
addPair('و','ب', 0.5);  addPair('ي','ء', 0.45);
// Lam shamsiyya: ل assimilates into solar letters — treat as near
['ت','ث','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ن'].forEach(c => addPair('ل', c, 0.3));

// Solar letters (lam assimilates into them in ال)
const SOLAR_LETTERS = new Set(['ت','ث','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ل','ن']);

function phonoCost(a, b) {
  if (a === b) return 0;
  return PHONO_PAIRS.get(a + b) ?? 1;
}

// Phonetic closeness threshold: cost ≤ this → status 'near' instead of 'err'
const NEAR_THRESHOLD = 0.5;

function levenshteinChars(refChars, gotChars) {
  const R = refChars.length, G = gotChars.length;
  const dp = Array.from({ length: R + 1 }, (_, r) =>
    Array.from({ length: G + 1 }, (_, g) => (r === 0 ? g : g === 0 ? r : 0))
  );
  for (let r = 1; r <= R; r++) {
    for (let g = 1; g <= G; g++) {
      const cost = phonoCost(refChars[r-1], gotChars[g-1]);
      dp[r][g] = Math.min(
        dp[r-1][g]   + 1,
        dp[r][g-1]   + 1,
        dp[r-1][g-1] + cost
      );
    }
  }
  const aligned = [];
  let r = R, g = G;
  while (r > 0 || g > 0) {
    if (r > 0 && g > 0) {
      const cost = phonoCost(refChars[r-1], gotChars[g-1]);
      const diag = dp[r-1][g-1] + cost;
      const del  = dp[r-1][g]   + 1;
      const ins  = dp[r][g-1]   + 1;
      if (dp[r][g] >= diag - 1e-9 && diag <= del && diag <= ins) {
        const op = cost === 0 ? 'match' : cost <= NEAR_THRESHOLD ? 'near' : 'sub';
        aligned.push({ refChar: refChars[r-1], gotChar: gotChars[g-1], op, cost });
        r--; g--; continue;
      }
    }
    if (r > 0 && (g === 0 || dp[r-1][g] <= dp[r][g-1])) {
      aligned.push({ refChar: refChars[r-1], gotChar: null, op: 'del', cost: 1 });
      r--; continue;
    }
    g--;
  }
  return aligned.reverse();
}

// Remove assimilated lam from a word string (لا → لا kept; لت → ت for solar)
// Used to pre-process user input for comparison when ref has lam shamsiyya
function removeSolarLam(word) {
  // Match ال or ل at start followed by solar letter
  return word.replace(/^(ا?ل)([تثدذرزسشصضطظلن])/u, '$2');
}

// Check if a word starts with al- + solar letter
function hasSolarLam(word) {
  return /^ا?ل[تثدذرزسشصضطظلن]/u.test(word);
}

function diffWord(refRaw, gotRaw, wordIndex = 0) {
  if (!refRaw) return [];
  if (!gotRaw) gotRaw = '';

  // Solar/lunar lam rule: if ref has ال+solar, allow user to omit/assimilate the lam
  const refHasSolar = hasSolarLam(normalizeArabic(refRaw));
  if (refHasSolar) {
    const gotN = normalizeArabic(gotRaw);
    const refStripped = removeSolarLam(normalizeArabic(refRaw));
    const gotStripped = removeSolarLam(gotN);
    // If user said the word without lam (assimilated), treat lam as silent/ok
    if (refStripped === gotStripped || normalizeArabic(refRaw) === gotStripped) {
      // Build result: mark the lam char as 'near' (accepted), rest as ok
      const refCharsDisplay = [...normalizeArabic(refRaw)];
      return refCharsDisplay.map((ch, i) => {
        const isSolarLamPos = i === 1 && ch === 'ل' && SOLAR_LETTERS.has(refCharsDisplay[i+1]);
        const isAlefPos = i === 0 && ch === 'ا';
        if (isSolarLamPos) return { char: ch, status: 'near', cost: 0 };
        return { char: ch, status: 'ok', cost: 0 };
      });
    }
  }

  const refN = normalizeArabic(refRaw);
  const gotN = normalizeArabic(gotRaw);
  if (!refN) return [];

  const silent   = getSilentIndices(refN, refRaw, wordIndex);
  const waslVowel = (wordIndex === 0 &&
    (refRaw[0] === '\u0671' || /^\u0627\u0644/.test(refN))) ? getWaslVowel(refRaw) : null;

  // Build rawSegments: one entry per base letter with its trailing diacritics
  const DIAC = /[\u0640\u0670\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]/;
  const rawSegments = [];
  let seg = '';
  for (const ch of refRaw) {
    if (DIAC.test(ch)) { seg += ch; }
    else { if (seg) rawSegments.push(seg); seg = ch; }
  }
  if (seg) rawSegments.push(seg);
  const STRIP_DISPLAY = /[\u06E0\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0610-\u061A]/g;
  const useRaw = rawSegments.length === refN.length;
  const getDisplay = (i) => useRaw ? (rawSegments[i] || refN[i]).replace(STRIP_DISPLAY,'') : refN[i];

  // Separate phonetic (non-silent) ref chars and build index mapping
  // phoneticIndices[i] = original refN index of the i-th phonetic char
  const phoneticIndices = [];
  const phoneticRefChars = [];
  for (let i = 0; i < refN.length; i++) {
    if (!silent.has(i)) {
      phoneticIndices.push(i);
      phoneticRefChars.push(refN[i]);
    }
  }

  // Strip silent trailing chars from gotN too (alef al-fariqa واو جماعة)
  let gotNPhonetic = gotN;
  if (silent.has(refN.length - 1) && gotNPhonetic.endsWith(refN[refN.length - 1])) {
    gotNPhonetic = gotNPhonetic.slice(0, -1);
  }

  // Levenshtein alignment on phonetic chars vs got chars
  const gotChars = [...gotNPhonetic];
  const alignment = levenshteinChars(phoneticRefChars, gotChars);

  // Build a map: refN index → status (only for non-silent chars)
  // alignment entries with op='del' map to a ref char with no got match
  const statusMap = new Map(); // refN index → 'ok'|'err'|'miss'
  let phoneticPtr = 0;
  for (const a of alignment) {
    if (a.op === 'ins') continue; // no ref char to map to
    const refIdx = phoneticIndices[phoneticPtr++];
    if (refIdx === undefined) break;
    statusMap.set(refIdx, {
      status: a.op === 'match' ? 'ok'   :
              a.op === 'near'  ? 'near' :
              a.op === 'del'   ? 'miss' : 'err',
      cost: a.cost ?? 1
    });
  }

  // Rebuild result array using rawSegments for display (keeps diacritics)
  const result = [];
  for (let i = 0; i < refN.length; i++) {
    const displayChar = getDisplay(i);
    if (silent.has(i)) {
      result.push({ char: displayChar, status: 'silent' });
    } else {
      const sm    = statusMap.get(i) || { status: 'miss', cost: 1 };
      const entry = { char: displayChar, status: sm.status, cost: sm.cost };
      if (i === 0 && waslVowel) entry.waslVowel = waslVowel;
      result.push(entry);
    }
  }
  return result;
}

// ─── Levenshtein word-level alignment ────────────────────────────────────────
// Words are considered "equal" if their edit distance ≤ 1 char (handles ٰ alef drift)
function wordEditDist(a, b) {
  const na = normalizeArabic(a), nb = normalizeArabic(b);
  if (na === nb) return 0;
  const R = na.length, G = nb.length;
  if (Math.abs(R - G) > 2) return 99;
  const dp = Array.from({ length: R + 1 }, (_, r) =>
    Array.from({ length: G + 1 }, (_, g) => (r === 0 ? g : g === 0 ? r : 0))
  );
  for (let r = 1; r <= R; r++)
    for (let g = 1; g <= G; g++) {
      dp[r][g] = Math.min(
        dp[r-1][g] + 1, dp[r][g-1] + 1,
        dp[r-1][g-1] + phonoCost(na[r-1], nb[g-1])
      );
    }
  return dp[R][G];
}

function levenshteinAlign(refWords, userWords) {
  const R = refWords.length, U = userWords.length;
  const dp = Array.from({ length: R + 1 }, (_, r) =>
    Array.from({ length: U + 1 }, (_, u) => (r === 0 ? u : u === 0 ? r : 0))
  );
  for (let r = 1; r <= R; r++) {
    for (let u = 1; u <= U; u++) {
      const dist = wordEditDist(refWords[r-1], userWords[u-1]);
      const eq   = dist <= 1; // allow 1-char difference (ٰ drift, hamza variants)
      dp[r][u] = Math.min(
        dp[r-1][u]   + 1,
        dp[r][u-1]   + 1,
        dp[r-1][u-1] + (eq ? 0 : 1)
      );
    }
  }
  const aligned = [];
  let r = R, u = U;
  while (r > 0 || u > 0) {
    if (r > 0 && u > 0) {
      const dist = wordEditDist(refWords[r-1], userWords[u-1]);
      const eq   = dist <= 1;
      const diagCost = eq ? 0 : 1;
      const delCost  = 1;
      const insCost  = 1;
      // Prefer del/ins over sub when all options have equal cost
      // This ensures a single user word aligns with the FIRST ref word, not the last
      if (dp[r][u] === dp[r-1][u-1] + diagCost &&
          dp[r][u] <  dp[r-1][u]    + delCost  &&
          dp[r][u] <  dp[r][u-1]    + insCost) {
        aligned.push({ ref: refWords[r-1], user: userWords[u-1], op: eq ? 'match' : 'sub' });
        r--; u--; continue;
      }
    }
    if (r > 0 && dp[r][u] === dp[r-1][u] + 1) {
      aligned.push({ ref: refWords[r-1], user: '', op: 'del' });
      r--; continue;
    }
    if (u > 0 && dp[r][u] === dp[r][u-1] + 1) {
      aligned.push({ ref: '', user: userWords[u-1], op: 'ins' });
      u--; continue;
    }
    // Fallback: take diagonal (sub/match)
    if (r > 0 && u > 0) {
      const dist = wordEditDist(refWords[r-1], userWords[u-1]);
      const eq   = dist <= 1;
      aligned.push({ ref: refWords[r-1], user: userWords[u-1], op: eq ? 'match' : 'sub' });
      r--; u--;
    } else if (r > 0) {
      aligned.push({ ref: refWords[r-1], user: '', op: 'del' }); r--;
    } else {
      aligned.push({ ref: '', user: userWords[u-1], op: 'ins' }); u--;
    }
  }
  return aligned.reverse();
}

function compareRecitation(refText, userText) {
  if (!refText || !userText) return { wordResults: [], score: 0 };
  const QURANIC_MARKS = /[\u06D6-\u06ED\u0610-\u061A\u0600-\u0605\u0615]/g;
  const clean = s => s.replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ');
  const refWords  = clean(refText).split(' ').map(w => w.replace(QURANIC_MARKS, '')).filter(Boolean);
  const userWords = clean(userText).split(' ').filter(Boolean);

  // Levenshtein alignment
  const aligned = levenshteinAlign(refWords, userWords);

  // Penalty weights (in "virtual wrong chars" added to the denominator/numerator)
  // sub  : slight mismatch — char-level diff already handles most of it, small extra
  // del  : user skipped the word entirely — moderate penalty on top of all-miss chars
  // ins  : user added a word not in ref — strongest penalty
  const PENALTY = { sub: 0.5, del: 1.5, ins: 3 };

  let totalPoints = 0, earnedPoints = 0;
  let refIdx = 0;

  // Count insertions separately — repetitions (word already in ref) are excluded
  const refWordsNorm = refWords.map(normalizeArabic);
  const insertions = aligned.filter(a => {
    if (a.op !== 'ins') return false;
    const n = normalizeArabic(a.user);
    return !refWordsNorm.includes(n); // repetition → not penalised
  });

  const wordResults = aligned
    .filter(a => a.op !== 'ins')
    .map(a => {
      const wi = refIdx++;
      let chars;
      try {
        chars = diffWord(a.ref, a.user, wi);
      } catch(e) {
        console.error('diffWord error', wi, a.ref, a.user, e);
        chars = [...normalizeArabic(a.ref)].map(c => ({ char: c, status: 'err' }));
      }

      // Char-level points — 'near' (similar letters) gets full credit, same as 'ok'
      const scored  = chars.filter(c => c.status !== 'silent');
      const okCount = scored.reduce((acc, c) => {
        if (c.status === 'ok' || c.status === 'near') return acc + 1; // no penalty for similar letters
        return acc;
      }, 0);
      totalPoints  += scored.length;
      earnedPoints += okCount;

      // Word-level penalty only for deletions (skipped words); sub uses char diff only
      if (a.op === 'del') {
        totalPoints  += PENALTY.del;
      }

      const wordOk = a.op === 'match';
      return { ref: a.ref, user: a.user, op: a.op, chars, wordOk };
    });

  // Insertion penalty: each extra word costs PENALTY.ins virtual points
  totalPoints  += insertions.length * PENALTY.ins;
  // (no earned points for insertions)

  const score = totalPoints > 0 ? Math.max(0, Math.round((earnedPoints / totalPoints) * 100)) : 0;
  return { wordResults, score, insertions };
}
