import { configureStore, createSlice } from "@reduxjs/toolkit";
import { safeJsonParse, safeGetItem, safeSetItem } from "./utils/safeStorage.js";

// ─── Helpers localStorage ────────────────────────────────────────────────────
const load = (key, fallback) => safeGetItem(key, fallback);
const save = (key, value) => safeSetItem(key, value);

// ─── Slice : navigation / UI ─────────────────────────────────────────────────
const uiSlice = createSlice({
  name: "ui",
  initialState: {
    activePage:    "quran",   // "quran" | "prononciation" | "dashboard" | "concordance" | "collections" | "revision"
    sidebarOpen:   (typeof window !== "undefined" && window.innerWidth >= 769),
    showTsBar:     false,
    showLoopBar:   false,
    showVoiceHelp: false,
    showQalqala:   load("quran_showQalqala", false),
    showMadd:      load("quran_showMadd", false),
    showIzhar:     load("quran_showIzhar", false),
    showIdgham:    load("quran_showIdgham", false),
    showIkhfa:     load("quran_showIkhfa", false),
    showIqlab:     load("quran_showIqlab", false),
    showGhunnah:   load("quran_showGhunnah", false),
    showTajweedTone: load("quran_showTajweedTone", false),
    tajweedPalette:  load("quran_tajweedPalette", "classic"), // "classic" | "vibrant" | "pastel" | "gemstone" | "golden"
    tajweedCustomColors: load("quran_tajweedCustomColors", {}), // { [ruleId]: hexColor }
    announceNum:   load("quran_announceNum", false),
    showParts:     load("quran_showParts", true),
    spellCheck:    load("quran_spellCheck", true),
    enableTimestamps:    load("quran_enableTimestamps", true),
    enableLetterByLetter:load("quran_enableLetterByLetter", true),
    enableAnimations:    load("quran_enableAnimations", true),
    enableHeavyCompute:  load("quran_enableHeavyCompute", true),
    fullScreenSelectedAyat: load("quran_fullScreenSelectedAyat", false),
    ayatFontSize:        load("quran_ayatFontSize", 26),
    pageMode:            load("quran_page_mode", false) ?? false,
    hizbMode:            load("quran_hizb_mode", false) ?? false,
    juzMode:             load("quran_juz_mode", false) ?? false,
    activePageCoran:     null,
    activeHizbCoran:     null,
    activeJuzCoran:      null,
    masteryFilterRange:  load("quran_masteryFilterRange", [0, 100]),
    masteryFilterActive: load("quran_masteryFilterActive", false),
    masteryFilterPreset: load("quran_masteryFilterPreset", "all"),
    ayatFilterRange:     null, // null | [fromAyatNum, toAyatNum]
    ayatFilterActive:    false,
  },
  reducers: {
    setActivePage:    (s, a) => { s.activePage    = a.payload; },
    setSidebarOpen:   (s, a) => { s.sidebarOpen   = a.payload; },
    toggleSidebar:    (s)    => { s.sidebarOpen   = !s.sidebarOpen; },
    setShowTsBar:     (s, a) => { s.showTsBar     = a.payload; },
    setShowLoopBar:   (s, a) => { s.showLoopBar   = a.payload; },
    toggleShowLoopBar:(s)    => { s.showLoopBar   = !s.showLoopBar; },
    setShowVoiceHelp: (s, a) => { s.showVoiceHelp = a.payload; },
    toggleShowVoiceHelp:(s)  => { s.showVoiceHelp = !s.showVoiceHelp; },
    toggleQalqala:     (s)  => { s.showQalqala = !s.showQalqala; save("quran_showQalqala", s.showQalqala); },
    toggleMadd:        (s)  => { s.showMadd = !s.showMadd; save("quran_showMadd", s.showMadd); },
    toggleIzhar:       (s)  => { s.showIzhar = !s.showIzhar; save("quran_showIzhar", s.showIzhar); },
    toggleIdgham:       (s)  => { s.showIdgham= !s.showIdgham; save("quran_showIdgham", s.showIdgham); },
    toggleIkhfa:        (s)  => { s.showIkhfa = !s.showIkhfa; save("quran_showIkhfa", s.showIkhfa); },
    toggleIqlab:        (s)  => { s.showIqlab = !s.showIqlab; save("quran_showIqlab", s.showIqlab); },
    toggleGhunnah:      (s)  => { s.showGhunnah = !s.showGhunnah; save("quran_showGhunnah", s.showGhunnah); },
    toggleTajweedTone:  (s)  => { s.showTajweedTone = !s.showTajweedTone; save("quran_showTajweedTone", s.showTajweedTone); },
    setShowTajweedTone: (s, a) => { s.showTajweedTone = !!a.payload; save("quran_showTajweedTone", s.showTajweedTone); },
    setTajweedPalette:  (s, a) => { s.tajweedPalette = a.payload; save("quran_tajweedPalette", s.tajweedPalette); },
    setTajweedCustomColor: (s, a) => {
      // a.payload = { ruleId: string, color: string }
      s.tajweedCustomColors = { ...s.tajweedCustomColors, [a.payload.ruleId]: a.payload.color };
      save("quran_tajweedCustomColors", s.tajweedCustomColors);
    },
    resetTajweedColors: (s) => {
      s.tajweedCustomColors = {};
      s.tajweedPalette = "classic";
      save("quran_tajweedCustomColors", {});
      save("quran_tajweedPalette", "classic");
    },
    toggleAnnounceNum:  (s)  => { s.announceNum = !s.announceNum; save("quran_announceNum", s.announceNum); },
    toggleSpellCheck:   (s)  => { s.spellCheck = !s.spellCheck; save("quran_spellCheck", s.spellCheck); },
    toggleShowParts:    (s)  => { s.showParts = !s.showParts; save("quran_showParts", s.showParts); },
    toggleEnableTimestamps:     (s) => { s.enableTimestamps     = !s.enableTimestamps;     save("quran_enableTimestamps",     s.enableTimestamps); },
    toggleEnableLetterByLetter: (s) => { s.enableLetterByLetter = !s.enableLetterByLetter; save("quran_enableLetterByLetter", s.enableLetterByLetter); },
    toggleEnableAnimations:     (s) => { s.enableAnimations     = !s.enableAnimations;     save("quran_enableAnimations",     s.enableAnimations); },
    toggleEnableHeavyCompute:   (s) => { s.enableHeavyCompute   = !s.enableHeavyCompute;   save("quran_enableHeavyCompute",   s.enableHeavyCompute); },
    toggleFullScreenSelectedAyat: (s) => { s.fullScreenSelectedAyat = !s.fullScreenSelectedAyat; save("quran_fullScreenSelectedAyat", s.fullScreenSelectedAyat); },
    setFullScreenSelectedAyat:    (s, a) => { s.fullScreenSelectedAyat = !!a.payload; save("quran_fullScreenSelectedAyat", s.fullScreenSelectedAyat); },
    setAyatFontSize: (s, a) => {
      const v = Math.max(16, Math.min(48, Number(a.payload) || 26));
      s.ayatFontSize = v;
      save("quran_ayatFontSize", v);
    },
    increaseAyatFontSize: (s) => {
      const v = Math.min(48, (s.ayatFontSize || 26) + 2);
      s.ayatFontSize = v;
      save("quran_ayatFontSize", v);
    },
    decreaseAyatFontSize: (s) => {
      const v = Math.max(16, (s.ayatFontSize || 26) - 2);
      s.ayatFontSize = v;
      save("quran_ayatFontSize", v);
    },
    resetAyatFontSize: (s) => {
      s.ayatFontSize = 26;
      save("quran_ayatFontSize", 26);
    },
    setPageMode: (s, a) => {
      const next = !!a.payload;
      s.pageMode = next;
      save("quran_page_mode", next);
      if (next) {
        s.hizbMode = false;
        s.juzMode = false;
        s.activeHizbCoran = null;
        s.activeJuzCoran = null;
        save("quran_hizb_mode", false);
        save("quran_juz_mode", false);
      }
    },
    setHizbMode: (s, a) => {
      const next = !!a.payload;
      s.hizbMode = next;
      save("quran_hizb_mode", next);
      if (next) {
        s.pageMode = false;
        s.juzMode = false;
        s.activePageCoran = null;
        s.activeJuzCoran = null;
        save("quran_page_mode", false);
        save("quran_juz_mode", false);
      }
    },
    setJuzMode: (s, a) => {
      const next = !!a.payload;
      s.juzMode = next;
      save("quran_juz_mode", next);
      if (next) {
        s.pageMode = false;
        s.hizbMode = false;
        s.activePageCoran = null;
        s.activeHizbCoran = null;
        save("quran_page_mode", false);
        save("quran_hizb_mode", false);
      }
    },
    setActivePageCoran: (s, a) => { s.activePageCoran = a.payload ?? null; },
    setActiveHizbCoran: (s, a) => { s.activeHizbCoran = a.payload ?? null; },
    setActiveJuzCoran:  (s, a) => { s.activeJuzCoran  = a.payload ?? null; },
    setMasteryFilterRange: (s, a) => {
      const [rawMin, rawMax] = Array.isArray(a.payload) ? a.payload : [0, 100];
      const min = Math.max(0, Math.min(100, Number(rawMin) || 0));
      const max = Math.max(min, Math.min(100, Number(rawMax) || 100));
      s.masteryFilterRange = [min, max];
      s.masteryFilterActive = (min > 0 || max < 100);
      s.masteryFilterPreset = (min === 0 && max === 100) ? "all" : "custom";
      save("quran_masteryFilterRange", [min, max]);
      save("quran_masteryFilterActive", s.masteryFilterActive);
      save("quran_masteryFilterPreset", s.masteryFilterPreset);
    },
    setMasteryFilterActive: (s, a) => {
      s.masteryFilterActive = Boolean(a.payload);
      save("quran_masteryFilterActive", s.masteryFilterActive);
    },
    setMasteryFilterPreset: (s, a) => {
      const preset = a.payload;
      s.masteryFilterPreset = preset;
      save("quran_masteryFilterPreset", preset);
      let range = [0, 100];
      let active = true;
      if (preset === "all") {
        range = [0, 100];
        active = false;
      } else if (preset === "unstarted") {
        range = [0, 0];
      } else if (preset === "toLearn") {
        range = [0, 49];
      } else if (preset === "inProgress") {
        range = [50, 79];
      } else if (preset === "mastered") {
        range = [80, 100];
      } else if (preset === "perfect") {
        range = [100, 100];
      }
      s.masteryFilterRange = range;
      s.masteryFilterActive = active;
      save("quran_masteryFilterRange", range);
      save("quran_masteryFilterActive", active);
    },
    resetMasteryFilter: (s) => {
      s.masteryFilterRange = [0, 100];
      s.masteryFilterActive = false;
      s.masteryFilterPreset = "all";
      save("quran_masteryFilterRange", [0, 100]);
      save("quran_masteryFilterActive", false);
      save("quran_masteryFilterPreset", "all");
    },
    setAyatFilterRange: (s, a) => {
      if (!a.payload) {
        s.ayatFilterRange = null;
        s.ayatFilterActive = false;
        return;
      }
      const [from, to] = a.payload;
      const min = Math.max(1, Number(from) || 1);
      const max = Math.max(min, Number(to) || min);
      s.ayatFilterRange = [min, max];
      s.ayatFilterActive = true;
    },
    resetAyatFilter: (s) => {
      s.ayatFilterRange = null;
      s.ayatFilterActive = false;
    },
    resetAllFilters: (s) => {
      s.masteryFilterRange = [0, 100];
      s.masteryFilterActive = false;
      s.masteryFilterPreset = "all";
      s.ayatFilterRange = null;
      s.ayatFilterActive = false;
      save("quran_masteryFilterRange", [0, 100]);
      save("quran_masteryFilterActive", false);
      save("quran_masteryFilterPreset", "all");
    },
  },
  extraReducers: (builder) => {
    builder.addCase("quran/setSelectedSurah", (s) => {
      s.ayatFilterRange = null;
      s.ayatFilterActive = false;
    });
  },
});

// ─── Slice : sourates & ayats ─────────────────────────────────────────────────
const quranSlice = createSlice({
  name: "quran",
  initialState: {
    surahs:        [],
    selectedSurah: null,
    ayats:         [],
    loadingSurahs: true,
    loadingAyats:  false,
    search:        "",
    openAyatNum:   null,
    openCrossAyatKey: null,
    submenuMode:   "lecture",  // "lecture" | "apprentissage" | "collections"
    lastAyatBySurah: load("quran_lastAyatBySurah", {}), // surahNum → ayatIdx
    crossSurahAyatsBySurah: {}, // { [surahNum]: ayahs[] } for cross-surah Hizb rendering
    loadingCrossHizb: false,
  },
  reducers: {
    setSurahs:        (s, a) => { s.surahs        = a.payload; s.loadingSurahs = false; },
    setSelectedSurah: (s, a) => { s.selectedSurah = a.payload; s.openAyatNum  = null; s.openCrossAyatKey = null; s.submenuMode = "lecture"; },
    setAyats:         (s, a) => { s.ayats         = a.payload; },
    setLoadingAyats:  (s, a) => { s.loadingAyats  = a.payload; },
    setSearch:        (s, a) => { s.search        = a.payload; },
    setOpenAyatNum:   (s, a) => { s.openAyatNum   = a.payload; if (a.payload != null) s.openCrossAyatKey = null; },
    setOpenCrossAyatKey: (s, a) => { s.openCrossAyatKey = a.payload; if (a.payload != null) s.openAyatNum = null; },
    setSubmenuMode:   (s, a) => { s.submenuMode   = a.payload; },
    setLastAyatForSurah: (s, a) => {
      s.lastAyatBySurah = { ...s.lastAyatBySurah, [a.payload.surahNum]: a.payload.ayatNum };
      save("quran_lastAyatBySurah", s.lastAyatBySurah);
    },
    restoreLastAyatFromCloud: (s, a) => { s.lastAyatBySurah = a.payload; },
    setCrossSurahAyats: (s, a) => {
      const { surahNum, ayahs } = a.payload || {};
      if (surahNum && Array.isArray(ayahs)) {
        s.crossSurahAyatsBySurah = { ...s.crossSurahAyatsBySurah, [surahNum]: ayahs };
      }
    },
    setCrossSurahAyatsBatch: (s, a) => {
      if (a.payload && typeof a.payload === "object") {
        s.crossSurahAyatsBySurah = { ...s.crossSurahAyatsBySurah, ...a.payload };
      }
    },
    setLoadingCrossHizb: (s, a) => { s.loadingCrossHizb = !!a.payload; },
  },
});

// ─── Slice : lecteur audio principal ─────────────────────────────────────────
const playerSlice = createSlice({
  name: "player",
  initialState: {
    isMainPlaying:  false,
    mainAyatIdx:    0,
    playingAyatNum: null,
    mainCurrentMs:  0,
    timestampsMap:  {},
    // Loop
    loopActive:     false,
    loopStart:      0,
    loopEnd:        0,
    loopMax:        0,
    loopCount:      0,
    loopStartInput: "1",
    loopEndInput:   "1",
    loopBySurah:    load("quran_loopBySurah", {}),
    // Part audio
    playingPart:    null,   // { ayatNum, partId } | null
    partCurrentMs:  0,
    localPlaying:   null,
    // Audio silence / masking for revision (requires word timestamps)
    silenceWordsToRevise: load("quran_silenceWordsToRevise", false),
    silenceMode:          load("quran_silenceMode", "mute"), // "mute" | "skip"
    customSilencedWordsMap: {}, // { [surahNum:ayatNum]: [wordIndex, ...] }
    // Tajweed Audio Coach (pause & voice announcement before tajweed rules)
    tajweedCoachEnabled: load("quran_tajweedCoachEnabled", false),
    tajweedCoachLang: load("quran_tajweedCoachLang", "fr"), // "fr" | "ar" | "both"
    tajweedCoachAutoResume: load("quran_tajweedCoachAutoResume", true),
    tajweedCoachDelay: load("quran_tajweedCoachDelay", 1.5),
    tajweedCoachSound: load("quran_tajweedCoachSound", true),
    tajweedCoachRulesEnabled: load("quran_tajweedCoachRulesEnabled", {
      qalqala: true,
      iqlab: true,
      ikhfa: true,
      izhar: true,
      idgham: true,
      ghunnah: true,
      madd: true
    }),
  },
  reducers: {
    setIsMainPlaying:  (s, a) => { s.isMainPlaying  = a.payload; },
    setMainAyatIdx:    (s, a) => { s.mainAyatIdx    = a.payload; },
    setPlayingAyatNum: (s, a) => { s.playingAyatNum = a.payload; },
    setMainCurrentMs:  (s, a) => { s.mainCurrentMs  = a.payload; },
    setTimestampsMap:  (s, a) => { s.timestampsMap  = a.payload; },
    updateTimestamp:   (s, a) => { s.timestampsMap  = { ...s.timestampsMap, ...a.payload }; },
    // Loop
    setLoopActive:     (s, a) => { s.loopActive     = a.payload; },
    setLoopStart:      (s, a) => { s.loopStart      = a.payload; },
    setLoopEnd:        (s, a) => { s.loopEnd        = a.payload; },
    setLoopMax:        (s, a) => { s.loopMax        = a.payload; },
    setLoopCount:      (s, a) => { s.loopCount      = a.payload; },
    setLoopStartInput: (s, a) => { s.loopStartInput = a.payload; },
    setLoopEndInput:   (s, a) => { s.loopEndInput   = a.payload; },
    resetLoop:         (s)    => { s.loopActive = false; s.loopCount = 0; },
    saveLoopForSurah:  (s, a) => {
      const { surahNum, ...data } = a.payload;
      s.loopBySurah = { ...s.loopBySurah, [surahNum]: data };
      save("quran_loopBySurah", s.loopBySurah);
    },
    // Part audio
    setPlayingPart:    (s, a) => { s.playingPart    = a.payload; },
    setPartCurrentMs:  (s, a) => { s.partCurrentMs  = a.payload; },
    setLocalPlaying:   (s, a) => { s.localPlaying   = a.payload; },
    restoreLoopBySurahFromCloud: (s, a) => { s.loopBySurah = a.payload; },
    // Silence / Revision audio reducers
    setSilenceWordsToRevise: (s, a) => {
      s.silenceWordsToRevise = Boolean(a.payload);
      save("quran_silenceWordsToRevise", s.silenceWordsToRevise);
    },
    setSilenceMode: (s, a) => {
      const mode = a.payload === "skip" ? "skip" : "mute";
      s.silenceMode = mode;
      save("quran_silenceMode", mode);
    },
    toggleCustomSilencedWord: (s, a) => {
      const { key, wordIndex } = a.payload || {};
      if (!key || typeof wordIndex !== "number") return;
      const current = s.customSilencedWordsMap[key] || [];
      const next = current.includes(wordIndex)
        ? current.filter(i => i !== wordIndex)
        : [...current, wordIndex].sort((x, y) => x - y);
      s.customSilencedWordsMap = { ...s.customSilencedWordsMap, [key]: next };
    },
    setCustomSilencedWords: (s, a) => {
      const { key, wordIndices } = a.payload || {};
      if (!key) return;
      s.customSilencedWordsMap = {
        ...s.customSilencedWordsMap,
        [key]: Array.isArray(wordIndices) ? [...wordIndices].sort((x, y) => x - y) : []
      };
    },
    clearCustomSilencedWords: (s, a) => {
      const key = a.payload;
      if (!key) {
        s.customSilencedWordsMap = {};
      } else {
        const copy = { ...s.customSilencedWordsMap };
        delete copy[key];
        s.customSilencedWordsMap = copy;
      }
    },
    setTajweedCoachEnabled: (s, a) => {
      s.tajweedCoachEnabled = Boolean(a.payload);
      save("quran_tajweedCoachEnabled", s.tajweedCoachEnabled);
    },
    setTajweedCoachLang: (s, a) => {
      s.tajweedCoachLang = a.payload;
      save("quran_tajweedCoachLang", s.tajweedCoachLang);
    },
    setTajweedCoachAutoResume: (s, a) => {
      s.tajweedCoachAutoResume = Boolean(a.payload);
      save("quran_tajweedCoachAutoResume", s.tajweedCoachAutoResume);
    },
    setTajweedCoachDelay: (s, a) => {
      s.tajweedCoachDelay = Number(a.payload);
      save("quran_tajweedCoachDelay", s.tajweedCoachDelay);
    },
    setTajweedCoachSound: (s, a) => {
      s.tajweedCoachSound = Boolean(a.payload);
      save("quran_tajweedCoachSound", s.tajweedCoachSound);
    },
    toggleTajweedCoachRule: (s, a) => {
      const ruleKey = a.payload;
      if (!ruleKey) return;
      const current = s.tajweedCoachRulesEnabled?.[ruleKey] ?? true;
      s.tajweedCoachRulesEnabled = {
        ...(s.tajweedCoachRulesEnabled || {}),
        [ruleKey]: !current
      };
      save("quran_tajweedCoachRulesEnabled", s.tajweedCoachRulesEnabled);
    },
  },
});

// ─── Slice : apprentissage (learnData) ───────────────────────────────────────
const learnSlice = createSlice({
  name: "learn",
  initialState: {
    data: load("quran_learnData", {}),
    // Part selection UI
    partSelectAyat:  null,
    partSelectStep:  null,
    partSelectStart: null,
  },
  reducers: {
    setLearnEntry: (s, a) => {
      // a.payload = { key: "surahNum:ayatNum", value: {...} }
      const prev = s.data[a.payload.key] || {};
      const nextVal = a.payload.value || {};
      const now  = new Date().toISOString();

      // Track read dates history & milestones
      const prevReadDates = Array.isArray(prev.readDates) ? prev.readDates : [];
      const readCountIncreased = (nextVal.readCount || 0) > (prev.readCount || 0);
      const readDates = readCountIncreased ? [...prevReadDates.slice(-49), now] : (nextVal.readDates || prevReadDates);
      const firstReadAt = prev.firstReadAt || (readCountIncreased || (nextVal.readCount || 0) > 0 ? (prev.createdAt || now) : undefined);
      const lastReadAt = readCountIncreased ? now : (nextVal.lastReadAt || prev.lastReadAt || (firstReadAt ? now : undefined));

      // Track learning milestones (first vs last)
      const justLearned = nextVal.learned && !prev.learned;
      const firstLearnedAt = prev.firstLearnedAt || (justLearned ? now : (nextVal.learned ? (prev.learnedAt || now) : undefined));
      const lastLearnedAt = justLearned ? now : (nextVal.lastLearnedAt || prev.lastLearnedAt || (nextVal.learned ? (prev.learnedAt || now) : undefined));
      const learnedAt = justLearned ? now : (prev.learnedAt || (nextVal.learned ? now : undefined));

      // Track part cut milestones
      const prevPartsCount = (prev.parts || []).length;
      const nextPartsCount = (nextVal.parts || []).length;
      const partsIncreased = nextPartsCount > prevPartsCount;
      const firstCutAt = prev.firstCutAt || (nextPartsCount > 0 ? (prev.firstCutAt || now) : undefined);
      const lastCutAt = partsIncreased ? now : (nextVal.lastCutAt || prev.lastCutAt || (nextPartsCount > 0 ? now : undefined));

      // Track words learned milestones
      const prevWCount = Object.keys(prev.wordsLearned || {}).filter(k => prev.wordsLearned[k]).length;
      const nextWCount = Object.keys(nextVal.wordsLearned || {}).filter(k => nextVal.wordsLearned[k]).length;
      const wordsIncreased = nextWCount > prevWCount;
      const firstWordLearnedAt = prev.firstWordLearnedAt || (nextWCount > 0 ? (prev.firstWordLearnedAt || now) : undefined);
      const lastWordLearnedAt = wordsIncreased ? now : (nextVal.lastWordLearnedAt || prev.lastWordLearnedAt || (nextWCount > 0 ? now : undefined));

      // Track toRevise milestones
      const justToRevise = !prev.toRevise && !!nextVal.toRevise;
      const firstRevisedAt = prev.firstRevisedAt || (justToRevise ? now : (nextVal.toRevise ? now : undefined));
      const lastRevisedAt = justToRevise ? now : (nextVal.lastRevisedAt || prev.lastRevisedAt || (nextVal.toRevise ? now : undefined));

      const value = {
        ...nextVal,
        updatedAt: now,
        createdAt: prev.createdAt || now,
        learnedAt,
        firstLearnedAt,
        lastLearnedAt,
        readDates,
        firstReadAt,
        lastReadAt,
        firstCutAt,
        lastCutAt,
        firstWordLearnedAt,
        lastWordLearnedAt,
        firstRevisedAt,
        lastRevisedAt,
      };
      s.data = { ...s.data, [a.payload.key]: value };
      save("quran_learnData", s.data);
    },
    setPartSelectAyat:  (s, a) => { s.partSelectAyat  = a.payload; },
    setPartSelectStep:  (s, a) => { s.partSelectStep  = a.payload; },
    setPartSelectStart: (s, a) => { s.partSelectStart = a.payload; },
    clearPartSelect:    (s)    => { s.partSelectAyat = null; s.partSelectStep = null; s.partSelectStart = null; },
    restoreFromCloud:   (s, a) => { s.data = a.payload; },
  },
});

// ─── Slice : collections d'ayats ─────────────────────────────────────────────
const collectionsSlice = createSlice({
  name: "collections",
  initialState: {
    list:      load("quran_collections", []),
    collModal: null,  // { surahNum, surahEn, ayatNum, text, number } | null
  },
  reducers: {
    createCollection: (s, a) => {
      // a.payload = name string
      if (!a.payload?.trim()) return;
      s.list = [...s.list, { id: Date.now(), name: a.payload.trim(), ayats: [], createdAt: new Date().toISOString() }];
      save("quran_collections", s.list);
    },
    deleteCollection: (s, a) => {
      // a.payload = id
      s.list = s.list.filter(c => c.id !== a.payload);
      save("quran_collections", s.list);
    },
    toggleAyatInCollection: (s, a) => {
      // a.payload = { collId, ayatEntry }
      const { collId, ayatEntry } = a.payload;
      const key = `${ayatEntry.surahNum}:${ayatEntry.ayatNum}`;
      s.list = s.list.map(c => {
        if (c.id !== collId) return c;
        const exists = c.ayats.some(a => `${a.surahNum}:${a.ayatNum}` === key);
        return { ...c, ayats: exists ? c.ayats.filter(a => `${a.surahNum}:${a.ayatNum}` !== key) : [...c.ayats, ayatEntry] };
      });
      save("quran_collections", s.list);
    },
    createCollectionWithAyat: (s, a) => {
      // a.payload = { name, ayatEntry }
      const { name, ayatEntry } = a.payload;
      if (!name?.trim()) return;
      s.list = [...s.list, { id: Date.now(), name: name.trim(), ayats: [ayatEntry], createdAt: new Date().toISOString() }];
      save("quran_collections", s.list);
    },
    setCollModal: (s, a) => { s.collModal = a.payload; },
    restoreFromCloud: (s, a) => { s.list = a.payload; },
  },
});

// ─── Slice : voix ─────────────────────────────────────────────────────────────
const voiceSlice = createSlice({
  name: "voice",
  initialState: {
    listening:      false,
    voiceToast:     null,   // { text, type } | null
    showVoiceInput: false,
    voiceInputText: "",
  },
  reducers: {
    setListening:      (s, a) => { s.listening      = a.payload; },
    setVoiceToast:     (s, a) => { s.voiceToast     = a.payload; },
    clearVoiceToast:   (s)    => { s.voiceToast     = null; },
    setShowVoiceInput: (s, a) => { s.showVoiceInput = a.payload; },
    setVoiceInputText: (s, a) => { s.voiceInputText = a.payload; },
  },
});

// ─── Slice : objectifs & activité quotidienne ────────────────────────────────
const goalsSlice = createSlice({
  name: "goals",
  initialState: {
    // Objectifs configurables
    dailyAyats:   load("quran_goal_dailyAyats",   3),   // nb ayats à lire/jour
    dailyParts:   load("quran_goal_dailyParts",   1),   // nb parties à apprendre/jour
    weeklyAyats:  load("quran_goal_weeklyAyats",  20),  // nb ayats/semaine
    targetSurah:  load("quran_goal_targetSurah",  null),// sourate cible
    targetDate:   load("quran_goal_targetDate",   null),// date limite ISO string
    // Activité journalière — clé = "YYYY-MM-DD", valeur = { ayatsRead, partsLearned, ayatsLearned }
    activity:     load("quran_activity",          {}),
  },
  reducers: {
    setGoal: (s, a) => {
      // a.payload = { key, value }  key ∈ dailyAyats | dailyParts | weeklyAyats | targetSurah | targetDate
      s[a.payload.key] = a.payload.value;
      save(`quran_goal_${a.payload.key}`, a.payload.value);
    },
    recordActivity: (s, a) => {
      // a.payload = { date:"YYYY-MM-DD", ayatsRead?, partsLearned?, ayatsLearned? }
      const { date, ...delta } = a.payload;
      const prev = s.activity[date] || { ayatsRead: 0, partsLearned: 0, ayatsLearned: 0 };
      s.activity[date] = {
        ayatsRead:     (prev.ayatsRead    || 0) + (delta.ayatsRead    || 0),
        partsLearned:  (prev.partsLearned || 0) + (delta.partsLearned || 0),
        ayatsLearned:  (prev.ayatsLearned || 0) + (delta.ayatsLearned || 0),
        updatedAt:     new Date().toISOString(),
        createdAt:     prev.createdAt || new Date().toISOString(),
      };
      save("quran_activity", s.activity);
    },
    setActivityDay: (s, a) => {
      // override a full day (used for corrections)
      s.activity[a.payload.date] = a.payload.data;
      save("quran_activity", s.activity);
    },
    restoreActivityFromCloud: (s, a) => { s.activity = a.payload; },
  },
});

// ─── Slice : Révision & Maîtrise des Questions ──────────────────────────────────
const revisionSlice = createSlice({
  name: "revision",
  initialState: {
    mastery: load("quran_revision_mastery", {}) // structure: { "surahNum:ayatNum": { correct: 0, total: 0 } }
  },
  reducers: {
    submitQuestionAnswer: (state, action) => {
      const { surahNum, ayatNum, isCorrect } = action.payload;
      const key = `${surahNum}:${ayatNum}`;
      if (!state.mastery[key]) {
        state.mastery[key] = { correct: 0, total: 0 };
      }
      state.mastery[key].total += 1;
      if (isCorrect) {
        state.mastery[key].correct += 1;
      }
      save("quran_revision_mastery", state.mastery);
    },
    resetSurahMastery: (state, action) => {
      const surahNum = action.payload;
      Object.keys(state.mastery).forEach(key => {
        if (key.startsWith(`${surahNum}:`)) {
          delete state.mastery[key];
        }
      });
      save("quran_revision_mastery", state.mastery);
    },
    restoreFromCloud: (state, a) => { state.mastery = a.payload; },
  }
});
export const revisionActions = revisionSlice.actions;

// ─── Slice : Error Manager ───────────────────────────────────────────────────
const errorsSlice = createSlice({
  name: "errors",
  initialState: {
    lastError: null,
    history: [],
  },
  reducers: {
    reportError: (state, action) => {
      const err = action.payload;
      if (!err) return;
      state.lastError = err;
      state.history = [err, ...state.history].slice(0, 25);
    },
    clearError: (state) => {
      state.lastError = null;
    },
    clearErrorHistory: (state) => {
      state.lastError = null;
      state.history = [];
    },
  },
});
export const errorActions = errorsSlice.actions;

export const store = configureStore({
  reducer: {
    revision:    revisionSlice.reducer,
    ui:          uiSlice.reducer,
    quran:       quranSlice.reducer,
    player:      playerSlice.reducer,
    learn:       learnSlice.reducer,
    collections: collectionsSlice.reducer,
    voice:       voiceSlice.reducer,
    goals:       goalsSlice.reducer,
    errors:      errorsSlice.reducer,
  },
  // Les timestamps et learnData peuvent être grands — désactiver le check de sérialisation sur ces champs
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredPaths: ["player.timestampsMap", "learn.data", "quran.crossSurahAyatsBySurah"],
        ignoredActionPaths: ["payload.value", "payload"],
      },
    }),
});

// ─── Exports des actions ──────────────────────────────────────────────────────
export const uiActions          = uiSlice.actions;
export const quranActions       = quranSlice.actions;
export const playerActions      = playerSlice.actions;
export const learnActions       = learnSlice.actions;
export const collectionsActions = collectionsSlice.actions;
export const voiceActions       = voiceSlice.actions;
export const goalsActions       = goalsSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────
export const sel = {
  // ui
  options:         (s) => s.ui,
  activePage:      (s) => s.ui.activePage,
  sidebarOpen:     (s) => s.ui.sidebarOpen,
  showTsBar:       (s) => s.ui.showTsBar,
  enableTimestamps:    (s) => s.ui.enableTimestamps,
  enableLetterByLetter:(s) => s.ui.enableLetterByLetter,
  enableAnimations:    (s) => s.ui.enableAnimations,
  enableHeavyCompute:  (s) => s.ui.enableHeavyCompute,
  showLoopBar:     (s) => s.ui.showLoopBar,
  showVoiceHelp:   (s) => s.ui.showVoiceHelp,
  showQalqala:     (s) => s.ui.showQalqala,
  showMadd:        (s) => s.ui.showMadd,
  showIzhar:       (s) => s.ui.showIzhar,
  showIdgham:      (s) => s.ui.showIdgham,
  showIkhfa:       (s) => s.ui.showIkhfa,
  showIqlab:       (s) => s.ui.showIqlab,
  showGhunnah:     (s) => s.ui.showGhunnah,
  showTajweedTone: (s) => s.ui.showTajweedTone,
  tajweedPalette:  (s) => s.ui.tajweedPalette || 'classic',
  tajweedCustomColors: (s) => s.ui.tajweedCustomColors || {},
  announceNum:     (s) => s.ui.announceNum,
  spellCheck:      (s) => s.ui.spellCheck,
  showParts:       (s) => s.ui.showParts,
  fullScreenSelectedAyat: (s) => s.ui.fullScreenSelectedAyat,
  ayatFontSize:    (s) => s.ui.ayatFontSize || 26,
  pageMode:        (s) => !!s.ui.pageMode,
  hizbMode:        (s) => !!s.ui.hizbMode,
  juzMode:         (s) => !!s.ui.juzMode,
  activePageCoran: (s) => s.ui.activePageCoran,
  activeHizbCoran: (s) => s.ui.activeHizbCoran,
  activeJuzCoran:  (s) => s.ui.activeJuzCoran,
  masteryFilterRange:  (s) => s.ui.masteryFilterRange || [0, 100],
  masteryFilterActive: (s) => !!s.ui.masteryFilterActive,
  masteryFilterPreset: (s) => s.ui.masteryFilterPreset || "all",
  ayatFilterRange:     (s) => s.ui.ayatFilterRange || null,
  ayatFilterActive:    (s) => !!s.ui.ayatFilterActive,
  isAnyFilterActive:   (s) => !!s.ui.masteryFilterActive || !!s.ui.ayatFilterActive,
  // quran
  surahs:          (s) => s.quran.surahs,
  selectedSurah:   (s) => s.quran.selectedSurah,
  ayats:           (s) => s.quran.ayats,
  loadingSurahs:   (s) => s.quran.loadingSurahs,
  loadingAyats:    (s) => s.quran.loadingAyats,
  search:          (s) => s.quran.search,
  openAyatNum:     (s) => s.quran.openAyatNum,
  openCrossAyatKey:(s) => s.quran.openCrossAyatKey,
  submenuMode:     (s) => s.quran.submenuMode,
  lastAyatBySurah: (s) => s.quran.lastAyatBySurah,
  crossSurahAyatsBySurah: (s) => s.quran.crossSurahAyatsBySurah || {},
  loadingCrossHizb:(s) => !!s.quran.loadingCrossHizb,
  // errors
  lastError:       (s) => s.errors?.lastError || null,
  errorHistory:    (s) => s.errors?.history || [],
  // player
  isMainPlaying:   (s) => s.player.isMainPlaying,
  mainAyatIdx:     (s) => s.player.mainAyatIdx,
  playingAyatNum:  (s) => s.player.playingAyatNum,
  mainCurrentMs:   (s) => s.player.mainCurrentMs,
  timestampsMap:   (s) => s.player.timestampsMap,
  loopActive:      (s) => s.player.loopActive,
  loopStart:       (s) => s.player.loopStart,
  loopEnd:         (s) => s.player.loopEnd,
  loopMax:         (s) => s.player.loopMax,
  loopCount:       (s) => s.player.loopCount,
  loopStartInput:  (s) => s.player.loopStartInput,
  loopEndInput:    (s) => s.player.loopEndInput,
  loopBySurah:     (s) => s.player.loopBySurah,
  playingPart:     (s) => s.player.playingPart,
  partCurrentMs:   (s) => s.player.partCurrentMs,
  localPlaying:    (s) => s.player.localPlaying,
  silenceWordsToRevise: (s) => !!s.player.silenceWordsToRevise,
  silenceMode:          (s) => s.player.silenceMode || "mute",
  customSilencedWordsMap: (s) => s.player.customSilencedWordsMap || {},
  tajweedCoachEnabled: (s) => !!s.player.tajweedCoachEnabled,
  tajweedCoachLang: (s) => s.player.tajweedCoachLang || "fr",
  tajweedCoachAutoResume: (s) => s.player.tajweedCoachAutoResume ?? true,
  tajweedCoachDelay: (s) => s.player.tajweedCoachDelay ?? 1.5,
  tajweedCoachSound: (s) => s.player.tajweedCoachSound ?? true,
  tajweedCoachRulesEnabled: (s) => s.player.tajweedCoachRulesEnabled || {
    qalqala: true,
    iqlab: true,
    ikhfa: true,
    izhar: true,
    idgham: true,
    ghunnah: true,
    madd: true
  },
  // learn
  learnData:       (s) => s.learn.data,
  partSelectAyat:  (s) => s.learn.partSelectAyat,
  partSelectStep:  (s) => s.learn.partSelectStep,
  partSelectStart: (s) => s.learn.partSelectStart,
  // collections
  collections:     (s) => s.collections.list,
  collModal:       (s) => s.collections.collModal,
  // voice
  listening:       (s) => s.voice.listening,
  voiceToast:      (s) => s.voice.voiceToast,
  showVoiceInput:  (s) => s.voice.showVoiceInput,
  voiceInputText:  (s) => s.voice.voiceInputText,
  // goals
  goals:           (s) => s.goals,
  activity:        (s) => s.goals.activity,
  revision:        (s) => s.revision?.mastery || {},
  // ─── Sélecteur de Maîtrise de la Sourate ───
  revisionMastery: (state, surahNum, totalVerses) => {
    if (!state.revision?.mastery) return 0;
    let masteredCount = 0;
    for (let i = 1; i <= totalVerses; i++) {
      const stats = state.revision.mastery[`${surahNum}:${i}`];
      // Un verset est considéré maîtrisé si le taux de réussite est >= 75% sur au moins 1 essai
      if (stats && stats.total > 0 && (stats.correct / stats.total) >= 0.75) {
        masteredCount++;
      }
    }
    return totalVerses > 0 ? Math.round((masteredCount / totalVerses) * 100) : 0;
  },
};

export const selectors = sel;

// ─── Thunk : setLData (met à jour un ayat dans learnData) ────────────────────
// Usage : dispatch(setLDataThunk(surahNum, ayatNum, fn))
export const setLDataThunk = (surahNum, ayatNum, fn) => (dispatch, getState) => {
  const key   = `${surahNum}:${ayatNum}`;
  const prev  = getState().learn.data[key] || { learned: false, readCount: 0, parts: [], wordsLearned: {} };
  const value = fn(prev);
  // Stamp new parts with createdAt
  if (value.parts) {
    const prevIds = new Set((prev.parts || []).map(p => p.id));
    value.parts = value.parts.map(p => prevIds.has(p.id) ? p : { ...p, createdAt: p.createdAt || new Date().toISOString() });
  }
  dispatch(learnActions.setLearnEntry({ key, value }));
  // Auto-record activity
  const today = new Date().toISOString().slice(0, 10);
  if (!prev.learned && value.learned) {
    dispatch(goalsActions.recordActivity({ date: today, ayatsLearned: 1 }));
  }
  const prevLP = (prev.parts || []).filter(p => p.learned).length;
  const newLP  = (value.parts || []).filter(p => p.learned).length;
  if (newLP > prevLP) {
    dispatch(goalsActions.recordActivity({ date: today, partsLearned: newLP - prevLP }));
  }
};

export const act = {
  ...uiActions,
  ...quranActions,
  ...playerActions,
  ...learnActions,
  ...collectionsActions,
  ...voiceActions,
  ...goalsActions,
  ...revisionActions,
  ...errorActions,
  setLDataThunk,
};
