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
      const now  = new Date().toISOString();
      const value = {
        ...a.payload.value,
        updatedAt: now,
        createdAt: prev.createdAt || now,
        learnedAt: a.payload.value.learned && !prev.learned ? now : (prev.learnedAt || (a.payload.value.learned ? now : undefined)),
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
