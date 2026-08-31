import { isQalqala, getMaddType, isIzhar, isIdgham } from "./utils/tajweedRules.js";
import { createPortal } from "react-dom";
const normalizeAr = (s) => (s ? s.replace(/[ً-ٰٟ]/g, "").replace(/آ|أ|إ|ٱ/g, "ا").replace(/ى/g, "ي").trim() : "");
import { masteryColor } from "./components/common/Mastery.jsx";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Provider, useSelector, useDispatch, shallowEqual } from "react-redux";
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { store, sel, act, uiActions, quranActions, playerActions, learnActions, collectionsActions, voiceActions, goalsActions, revisionActions, setLDataThunk } from "./store.js";
import { firebaseAuth } from "./firebase.js";
import { StyleTag } from "./components/common/StyleTag.jsx";
import { ArabicKeyboard, ArabicKeyboardContext, useArabicKeyboard } from "./components/common/ArabicKeyboard.jsx";
import { AnimatedPage, AnimatedSubmenu } from "./components/common/AnimatedWrappers.jsx";
import { ArabicHighlighted, PlayingArabicHighlighted } from "./components/common/ArabicHighlighted.jsx";
import { MasteryBar, MasteryBadge, MasteryDebug, computeMastery } from "./components/common/Mastery.jsx";
import { RappelWidget } from "./components/common/RappelWidget.jsx";
import { OfflineLoader } from "./components/common/OfflineLoader.jsx";

import { LoginScreen } from "./components/sync/LoginScreen.jsx";
import { SyncConsole } from "./components/sync/SyncConsole.jsx";
import { OptionsModal } from "./components/sync/OptionsModal.jsx";
import { CloudSyncManager } from "./components/sync/CloudSyncManager.jsx";
import { ExportImport } from "./components/sync/ExportImport.jsx";

import { CollectionModal } from "./components/collections/CollectionModal.jsx";
import { CollectionsPage } from "./components/pages/CollectionsPage.jsx";
import { DashboardPage } from "./components/pages/DashboardPage.jsx";
import { RevisionPage } from "./components/pages/RevisionPage.jsx";
import { LearningMapPage } from "./components/pages/LearningMapPage.jsx";
import { QuestionsModePage } from "./components/pages/QuestionsModePage.jsx";
import { ConcordancePage } from "./components/pages/ConcordancePage.jsx";
import { QuranBookPage } from "./components/pages/QuranBookPage.jsx";
import { QuranBook3DPage } from "./components/pages/QuranBook3DPage.jsx";
import { PrononciationPage } from "./components/pages/PrononciationPage.jsx";

import { Submenu } from "./components/modes/Submenu.jsx";
import { DecouverteMode } from "./components/modes/DecouverteMode.jsx";
import { LectureMode } from "./components/modes/LectureMode.jsx";
import { ApprentissageMode } from "./components/modes/ApprentissageMode.jsx";
import { MemoriseMode } from "./components/modes/MemoriseMode.jsx";
import { RevisionEcritureMode } from "./components/modes/RevisionEcritureMode.jsx";
import { TajweedExercice } from "./components/modes/TajweedExercice.jsx";
import { RecitationChecker } from "./components/modes/RecitationChecker.jsx";
import { InfoMode } from "./components/modes/InfoMode.jsx";
import { AideMemoireMode } from "./components/modes/AideMemoireMode.jsx";

import { parseVoiceCommand, SURAH_NAMES } from "./utils/voiceCommand.js";
import { normalizeArabic, diffRecitation } from "./utils/recitationDiff.js";
import { splitArabicWords, splitArabicChars, splitArabicClusters, stripDiacritics, wordTranslit, calcDifficulty, calcPhase, arabicRoot, ARABIC_ROOTS } from "./utils/arabicUtils.js";
import {
  API, AUDIO_CDN_ROOT, RECITATORS, TRANS_EDITIONS, TRANS_LABELS,
  fetchSurahs, fetchSurahTranslation, fetchAyats, fetchSurahSimple, fetchSurahDefault,
  fetchSurahMeta, fetchAyahMeta, fetchQuranPage, fetchPageMeta,
  loadTimestampsForSurah, fixChars, getAudioBase, getReciterBitrate, getGlobalRecitator, setGlobalRecitator,
  fetchOfficialBitrates, markBitrateBad, setReciterBitrate, bitrateOrderFor, quranMemCache, parseTimestampsFile
} from "./utils/reciterAudio.js";
import { DATA_KEYS, getDeviceId, mergeLearnData, mergeActivity, mergeCollections } from "./utils/syncUtils.js";
import { useToRevise } from "./utils/toRevise.js";

function AppInner({ currentUser, onSignOut }) {
  const dispatch = useDispatch();

  // ── Selectors ──────────────────────────────────────────────────────
  const surahs          = useSelector(sel.surahs);
  const selectedSurah   = useSelector(sel.selectedSurah);
  const ayats           = useSelector(sel.ayats);
  const loadingSurahs   = useSelector(sel.loadingSurahs);
  const loadingAyats    = useSelector(sel.loadingAyats);
  const search          = useSelector(sel.search);
  const openAyatNum     = useSelector(sel.openAyatNum);
  const submenuMode     = useSelector(sel.submenuMode);
  const lastAyatBySurah = useSelector(sel.lastAyatBySurah, shallowEqual);
  const partSelectAyat  = useSelector(sel.partSelectAyat);
  const partSelectStep  = useSelector(sel.partSelectStep);
  const partSelectStart = useSelector(sel.partSelectStart);
  const learnData       = useSelector(sel.learnData, shallowEqual);
  const collections     = useSelector(sel.collections, shallowEqual);
  const collModal       = useSelector(sel.collModal);
  // ── High-frequency play state → refs + version counter (avoids full re-render) ──
  const playingAyatNumRef = useRef(null);
  const isMainPlayingRef  = useRef(false);
  const mainAyatIdxRef    = useRef(0);
  const localPlayingRef   = useRef(null);
  const [playStateVer, setPlayStateVer] = useState(0);
  useEffect(() => {
    const unsub = store.subscribe(() => {
      const s = store.getState();
      mainCurrentMsRef.current = sel.mainCurrentMs(s);
      const pan = sel.playingAyatNum(s);
      const imp = sel.isMainPlaying(s);
      const mai = sel.mainAyatIdx(s);
      const lp  = sel.localPlaying(s);
      if (pan !== playingAyatNumRef.current || imp !== isMainPlayingRef.current ||
          mai !== mainAyatIdxRef.current || lp?.ayatNum !== localPlayingRef.current?.ayatNum) {
        playingAyatNumRef.current = pan;
        isMainPlayingRef.current  = imp;
        mainAyatIdxRef.current    = mai;
        localPlayingRef.current   = lp;
        setPlayStateVer(v => v + 1);
      }
    });
    return unsub;
  }, []);
  const playingAyatNum = playingAyatNumRef.current;
  const isMainPlaying  = isMainPlayingRef.current;
  const mainAyatIdx    = mainAyatIdxRef.current;
  const localPlaying   = localPlayingRef.current;
  const timestampsMapRef = useRef({});
  const tsVersionRef = useRef(0);
  const [tsVersion, setTsVersion] = useState(0);
  const timestampsMap = timestampsMapRef.current;
  const mainCurrentMsRef = useRef(0);

  const sidebarOpen     = useSelector(sel.sidebarOpen);
  const location        = useLocation();
  const navigate        = useNavigate();
  const [selMenu, setSelMenu] = useState(null); // {x,y,text} — custom context menu on ayat text selection
  const [pendingSearchQuery, setPendingSearchQuery] = useState(null);
  const handleAyatContextMenu = (e) => {
    const winSel = window.getSelection ? window.getSelection() : null;
    const text = winSel ? winSel.toString().trim() : "";
    if (!text) { setSelMenu(null); return; } // no selection → let native menu show
    e.preventDefault();
    setSelMenu({ x: e.clientX, y: e.clientY, text });
  };
  const searchSelectionInCollections = () => {
    if (!selMenu?.text) return;
    setPendingSearchQuery(selMenu.text);
    setSelMenu(null);
    navigate("/collections");
  };
  const urlSegs         = location.pathname.replace(/^\//, '').split('/');
  const activePage      = urlSegs[0] || 'quran';
  const urlSurahNum     = parseInt(urlSegs[1]);
  const urlAyatNum      = parseInt(urlSegs[2]);

  // ── Sync URL → Redux (selectedSurah, openAyatNum) ──
  useEffect(() => {
    if (isNaN(urlSurahNum) || surahs.length === 0) return;
    const s = surahs.find(x => x.number === urlSurahNum);
    if (s && s.number !== selectedSurah?.number) {
      setSelectedSurah(s);
    } else if (s && s.number === selectedSurah?.number) {
      // Same surah — back navigation: restore openAyatNum from URL or lastAyatBySurah
      const targetAyat = !isNaN(urlAyatNum) ? urlAyatNum : (lastAyatBySurah[urlSurahNum] ?? null);
      if (targetAyat != null) {
        setOpenAyatNum(targetAyat);
        const tryScroll = (attempts = 0) => {
          const el = ayatRefs.current[targetAyat];
          if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
          else if (attempts < 20) requestAnimationFrame(() => tryScroll(attempts + 1));
        };
        requestAnimationFrame(() => tryScroll());
      } else {
        setOpenAyatNum(null);
      }
    }
    if (!isNaN(urlAyatNum) && s?.number !== selectedSurah?.number) setTimeout(() => {
      setOpenAyatNum(urlAyatNum);
      const el = ayatRefs.current[urlAyatNum];
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    }, 400);
  }, [urlSurahNum, urlAyatNum, surahs.length, activePage]);

  // ── Sync Redux → URL (selectedSurah) ──
  useEffect(() => {
    if (!selectedSurah) return;
    const target = `/quran/${selectedSurah.number}`;
    if (!location.pathname.startsWith(target)) navigate(target, { replace: true });
  }, [selectedSurah?.number]);

  // ── Sync Redux → URL (openAyatNum) ──
  useEffect(() => {
    if (!selectedSurah || openAyatNum == null) return;
    const target = `/quran/${selectedSurah.number}/${openAyatNum}`;
    if (location.pathname !== target) navigate(target, { replace: true });
  }, [openAyatNum, selectedSurah?.number]);
  const showTsBar           = useSelector(sel.showTsBar);
  const enableTimestamps     = useSelector(sel.enableTimestamps);
  const enableLetterByLetter = useSelector(sel.enableLetterByLetter);
  const enableAnimations     = useSelector(sel.enableAnimations);
  const enableHeavyCompute   = useSelector(sel.enableHeavyCompute);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showUserMenu, setShowUserMenu]         = useState(false);
  const userMenuRef                             = useRef(null);

  // Close user menu on outside click or page change
  useEffect(() => {
    const handleOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("touchstart", handleOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [showUserMenu]);

  useEffect(() => {
    setShowUserMenu(false);
  }, [activePage]);

  const loopActiveRef   = useRef(false);
  const loopStartRef    = useRef(0);
  const loopEndRef      = useRef(0);
  const [loopStateVer, setLoopStateVer] = useState(0);
  useEffect(() => {
    const unsub = store.subscribe(() => {
      const s = store.getState();
      const la = sel.loopActive(s), ls = sel.loopStart(s), le = sel.loopEnd(s);
      if (la !== loopActiveRef.current || ls !== loopStartRef.current || le !== loopEndRef.current) {
        loopActiveRef.current = la; loopStartRef.current = ls; loopEndRef.current = le;
        setLoopStateVer(v => v + 1);
      }
    });
    return unsub;
  }, []);
  const loopActive = loopActiveRef.current;
  const loopStart  = loopStartRef.current;
  const loopEnd    = loopEndRef.current;
  const loopMax         = useSelector(sel.loopMax);
  const loopCount       = useSelector(sel.loopCount);
  const showLoopBar     = useSelector(sel.showLoopBar);
  const loopStartInput  = useSelector(sel.loopStartInput);
  const loopEndInput    = useSelector(sel.loopEndInput);
  const loopBySurah     = useSelector(sel.loopBySurah);
  const playingPartRef  = useRef(null);
  useEffect(() => {
    const unsub = store.subscribe(() => {
      const pp = sel.playingPart(store.getState());
      if (pp?.ayatNum !== playingPartRef.current?.ayatNum || pp?.partId !== playingPartRef.current?.partId) {
        playingPartRef.current = pp;
        setPlayStateVer(v => v + 1);
      }
    });
    return unsub;
  }, []);
  const playingPart = playingPartRef.current;
  const listening       = useSelector(sel.listening);
  const voiceToast      = useSelector(sel.voiceToast);
  const showVoiceHelp   = useSelector(sel.showVoiceHelp);
  const showQalqala     = useSelector(sel.showQalqala);
  const showMadd        = useSelector(sel.showMadd);
  const showIzhar       = useSelector(sel.showIzhar);
  const showIdgham      = useSelector(sel.showIdgham);
  const announceNum     = useSelector(sel.announceNum);
  const spellCheck      = useSelector(sel.spellCheck);
  const showParts       = useSelector(sel.showParts);
  const showVoiceInput  = useSelector(sel.showVoiceInput);
  const voiceInputText  = useSelector(sel.voiceInputText);
  const goals           = useSelector(sel.goals, shallowEqual);
  const activity        = useSelector(sel.activity, shallowEqual);

  // ── Dispatch shims (drop-in replacements for old setState calls) ───
  const setSurahs          = (v) => dispatch(quranActions.setSurahs(v));
  const setSelectedSurah   = (v) => dispatch(quranActions.setSelectedSurah(v));
  const setAyats           = (v) => dispatch(quranActions.setAyats(v));
  const setLoadingAyats    = (v) => dispatch(quranActions.setLoadingAyats(v));
  const setSearch          = (v) => dispatch(quranActions.setSearch(v));
  const setOpenAyatNum     = (v) => {
    dispatch(quranActions.setOpenAyatNum(v));
    if (v == null) setAideMemoireClickModes({});
  };
  const setSubmenuMode     = (v) => dispatch(quranActions.setSubmenuMode(v));
  const setLastAyatForSurah = (surahNum, ayatNum) => dispatch(quranActions.setLastAyatForSurah({ surahNum, ayatNum }));
  const setPartSelectAyat  = (v) => dispatch(learnActions.setPartSelectAyat(v));
  const setPartSelectStep  = (v) => dispatch(learnActions.setPartSelectStep(v));
  const setPartSelectStart = (v) => dispatch(learnActions.setPartSelectStart(v));
  const setPlayingPart     = (v) => dispatch(playerActions.setPlayingPart(v));
  const setPartCurrentMs   = (v) => dispatch(playerActions.setPartCurrentMs(v));
  const setLocalPlaying    = (v) => dispatch(playerActions.setLocalPlaying(v));
  const setCollModal       = (v) => dispatch(collectionsActions.setCollModal(v));
  const setPlayingAyatNum  = (v) => dispatch(playerActions.setPlayingAyatNum(v));
  const setIsMainPlaying   = (v) => dispatch(playerActions.setIsMainPlaying(v));
  const setMainAyatIdx     = (v) => dispatch(playerActions.setMainAyatIdx(v));
  const setTimestampsMap   = (v) => { timestampsMapRef.current = v; tsVersionRef.current++; setTsVersion(n => n + 1); };
  const updateTimestamps   = (v) => {
    Object.assign(timestampsMapRef.current, v);
    tsVersionRef.current++;
    // Use startTransition so timestamp render doesn't block user interactions
    if (typeof React.startTransition === 'function') {
      React.startTransition(() => setTsVersion(n => n + 1));
    } else {
      setTsVersion(n => n + 1);
    }
  };
  const setMainCurrentMs   = (v) => dispatch(playerActions.setMainCurrentMs(v));
  const setSidebarOpen     = (v) => dispatch(uiActions.setSidebarOpen(v));
  const setActivePage      = (v) => navigate("/" + v);
  const setShowTsBar       = (v) => dispatch(uiActions.setShowTsBar(v));
  const setLoopActive      = (v) => dispatch(playerActions.setLoopActive(v));
  const setLoopStart       = (v) => dispatch(playerActions.setLoopStart(v));
  const setLoopEnd         = (v) => dispatch(playerActions.setLoopEnd(v));
  const setLoopMax         = (v) => dispatch(playerActions.setLoopMax(v));
  const saveLoopForSurah   = (surahNum, data) => dispatch(playerActions.saveLoopForSurah({ surahNum, ...data }));
  const setLoopCount       = (v) => dispatch(playerActions.setLoopCount(v));
  const setShowLoopBar     = (v) => dispatch(uiActions.setShowLoopBar(v));
  const setLoopStartInput  = (v) => dispatch(playerActions.setLoopStartInput(v));
  const setLoopEndInput    = (v) => dispatch(playerActions.setLoopEndInput(v));
  const setListening       = (v) => dispatch(voiceActions.setListening(v));
  const setVoiceToast      = (v) => dispatch(voiceActions.setVoiceToast(v));
  const setShowVoiceHelp   = (v) => dispatch(uiActions.setShowVoiceHelp(v));
  const [showTajweedPanel, setShowTajweedPanel] = React.useState(false);
  const [showArabicKeyboard, setShowArabicKeyboard] = React.useState(() => { try { return localStorage.getItem('quran_arabic_keyboard') === '1'; } catch { return false; } });
  const activeArabicInput = React.useRef(null);
  const [showOptionsPanel, setShowOptionsPanel] = React.useState(false);
  const [showLangPanel,    setShowLangPanel]    = React.useState(false);
  const [recitatorId,      setRecitatorId]      = useState(() => { try { return localStorage.getItem('quran_recitator') || 'ar.alafasy'; } catch { return 'ar.alafasy'; } });
  const [showRecitPanel,   setShowRecitPanel]   = useState(false);
  const [recitatorSearch,  setRecitatorSearch]  = useState("");
  // Bumped whenever a reciter's bitrate self-heals (markBitrateBad) so components
  // re-render and pick up the newly-known-good bitrate for that reciter.
  const [bitrateVersion,   setBitrateVersion]   = useState(0);

  // Keep global in sync with state
  useEffect(() => { setGlobalRecitator(recitatorId); }, [recitatorId]);

  // Fetch the official bitrate list (from the API's own audio/audioSecondary fields) for the
  // currently selected reciter as soon as it's chosen — this is the "real" data, so it takes
  // over from the generic guess order the moment it arrives.
  useEffect(() => {
    let cancelled = false;
    fetchOfficialBitrates(recitatorId).then(() => { if (!cancelled) setBitrateVersion(v => v + 1); });
    return () => { cancelled = true; };
  }, [recitatorId]);

  // Warm the same cache for every other reciter in the background (staggered, one at a time)
  // so the picker panel can show everyone's real bitrate without waiting for each to be selected.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const r of RECITATORS) {
        if (cancelled) return;
        await fetchOfficialBitrates(r.id);
        if (cancelled) return;
        setBitrateVersion(v => v + 1);
        await new Promise(res => setTimeout(res, 250));
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bitrate   = getReciterBitrate(recitatorId); // eslint-disable-line react-hooks/exhaustive-deps
  const audioBase = `${AUDIO_CDN_ROOT}/${bitrate}/${recitatorId}`;
  const activeRecitator = RECITATORS.find(r => r.id === recitatorId);
  const visibleRecitators = RECITATORS.filter(r =>
    r.label.toLowerCase().includes(recitatorSearch.trim().toLowerCase())
  );
  const toggleQalqala      = () => dispatch(uiActions.toggleQalqala());
  const toggleMadd         = () => dispatch(uiActions.toggleMadd());
  const toggleIzhar        = () => dispatch(uiActions.toggleIzhar());
  const toggleIdgham       = () => dispatch(uiActions.toggleIdgham());
  const toggleAnnounceNum  = () => dispatch(uiActions.toggleAnnounceNum());
  const toggleSpellCheck   = () => dispatch(uiActions.toggleSpellCheck());
  const toggleShowParts    = () => dispatch(uiActions.toggleShowParts());
  const toggleEnableTimestamps     = () => dispatch(uiActions.toggleEnableTimestamps());
  const toggleEnableLetterByLetter = () => dispatch(uiActions.toggleEnableLetterByLetter());
  const toggleEnableAnimations     = () => dispatch(uiActions.toggleEnableAnimations());
  const toggleEnableHeavyCompute   = () => dispatch(uiActions.toggleEnableHeavyCompute());
  const setShowVoiceInput  = (v) => dispatch(voiceActions.setShowVoiceInput(v));
  const setVoiceInputText  = (v) => dispatch(voiceActions.setVoiceInputText(v));

  // Part audio refs (not in Redux — updated 60fps, no need to re-render)
  const partAudioRef  = useRef(null);
  const partRafRef    = useRef(null);

  const stopPartRaf = () => { if (partRafRef.current) { cancelAnimationFrame(partRafRef.current); partRafRef.current = null; } };
  const startPartRaf = () => {
    stopPartRaf();
    const tick = () => {
      if (partAudioRef.current) setPartCurrentMs(partAudioRef.current.currentTime * 1000);
      partRafRef.current = requestAnimationFrame(tick);
    };
    partRafRef.current = requestAnimationFrame(tick);
  };

  // ── setLData shim ──────────────────────────────────────────────────
  const setLData = useCallback((surahNum, ayatNum, fn) => {
    dispatch(setLDataThunk(surahNum, ayatNum, fn));
  }, [dispatch]);

  // ── Collections helpers ────────────────────────────────────────────
  const saveCollections    = null; // no longer needed — Redux handles persistence
  const createCollection   = (name)            => dispatch(collectionsActions.createCollection(name));
  const deleteCollection   = (id)              => dispatch(collectionsActions.deleteCollection(id));
  const toggleAyatInCollection = (collId, ayatEntry) => dispatch(collectionsActions.toggleAyatInCollection({ collId, ayatEntry }));
  // Memoized per-surah collection lookup — O(1) instead of O(collections×ayats) per row
  const collectionsByAyat = useMemo(() => {
    const map = {};
    for (const c of collections) {
      for (const a of (c.ayats || [])) {
        const k = `${a.surahNum}:${a.ayatNum}`;
        if (!map[k]) map[k] = [];
        map[k].push(c.id);
      }
    }
    return map;
  }, [collections]);
  const ayatInCollections = (surahNum, ayatNum) => collectionsByAyat[`${surahNum}:${ayatNum}`] || [];

  const recognitionRef = useRef(null);
  const toastTimerRef  = useRef(null);

  const ayatRefs     = useRef({});
  const mainAudioRef = useRef(null);
  const tsLoadGenRef = useRef(0); // incremented on each surah change to cancel stale ts loads

  // Re-run timestamp auto-load when the reciter changes (without redoing the whole
  // surah-load effect below, which also restores scroll position, loop, etc.)
  useEffect(() => {
    if (!selectedSurah || !sel.enableTimestamps(store.getState())) return;
    const gen = ++tsLoadGenRef.current;
    loadTimestampsForSurah(selectedSurah.number, recitatorId).then(parsed => {
      if (gen !== tsLoadGenRef.current) return;
      if (parsed && Object.keys(parsed).length > 0) updateTimestamps(parsed);
    });
  }, [recitatorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [renderLimit, setRenderLimit] = useState(30);
  const [pageMode,    setPageMode]    = useState(() => { try { return JSON.parse(localStorage.getItem('quran_page_mode')) ?? false; } catch { return false; } });
  const [surahMeta,   setSurahMeta]   = useState(null); // { hizb, juz, page, wordCount }
  const [pageMeta,    setPageMeta]    = useState(null); // { hizb, juz, ayatCount, wordCount } for current page
  const [showSurahInfo, setShowSurahInfo] = useState(false);
  const [showAyatJump, setShowAyatJump] = useState(false);
  const [surahTextCache, setSurahTextCache] = useState({}); // surahNum → { numberInSurah: text } — feeds mastery calc
  const [ayatSearchInput, setAyatSearchInput] = useState("");
  const [autoPageFollow, setAutoPageFollow] = useState(true);
  const [translationLang, setTranslationLang] = useState(null); // null | 'fr'|'en'|'tr'…
  const [translations, setTranslations] = useState({}); // { 'fr:2': [{numberInSurah, text}] }
  const [activePageCoran,  setactivePageCoran]  = useState(null);
  React.useEffect(() => { try { localStorage.setItem('quran_page_mode', JSON.stringify(pageMode)); } catch {} }, [pageMode]);
  const rafRef       = useRef(null);
  const wakeLockRef  = useRef(null);

  const [showRappel, setShowRappel] = useState(false);
  const [aideMemoireClickModes, setAideMemoireClickModes] = useState({});

  const surahs_ref    = useRef(surahs);
  const ayats_ref     = useRef(ayats);
  const selSurah_ref  = useRef(selectedSurah);
  useEffect(() => {
    if (!selectedSurah) { setSurahMeta(null); return; }
    fetchSurahMeta(selectedSurah.number).then(setSurahMeta).catch(() => setSurahMeta(null));
  }, [selectedSurah?.number]);
  useEffect(() => {
    if (!pageMode || !ayats || ayats.length === 0) { setPageMeta(null); return; }
    const curPage = activePageCoran ?? ayats[mainAyatIdx]?.page ?? null;
    if (!curPage) { setPageMeta(null); return; }
    fetchPageMeta(curPage).then(setPageMeta).catch(() => setPageMeta(null));
  }, [pageMode, activePageCoran, mainAyatIdx, ayats]);
  useEffect(() => {
    if (!translationLang || !selectedSurah) return;
    const key = `${translationLang}:${selectedSurah.number}`;
    if (translations[key]) return;
    fetchSurahTranslation(selectedSurah.number, translationLang).then(data => {
      setTranslations(p => ({ ...p, [key]: data }));
    }).catch(() => {});
  }, [translationLang, selectedSurah?.number]);

  // pageMode: auto-change page when mainAyatIdx moves to a different page, then scroll to ayat
  useEffect(() => {
    if (!pageMode || !autoPageFollow || !ayats || ayats.length === 0) return;
    const curAyat = ayats[mainAyatIdx];
    if (!curAyat?.page) return;
    const curPage = activePageCoran ?? ayats[0]?.page;
    if (curAyat.page !== curPage) {
      setactivePageCoran(curAyat.page);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ayatRefs.current[curAyat.numberInSurah]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    }
  }, [mainAyatIdx, pageMode, autoPageFollow]);

  // pageMode: when page changes manually, scroll to first ayat of that page
  useEffect(() => {
    if (!pageMode || !activePageCoran || !ayats || ayats.length === 0) return;
    const firstOfPage = ayats.find(a => a.page === activePageCoran);
    if (!firstOfPage) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ayatRefs.current[firstOfPage.numberInSurah]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, [activePageCoran, pageMode]);
  useEffect(() => { ayats_ref.current = ayats; }, [ayats]);
  useEffect(() => { selSurah_ref.current = selectedSurah; }, [selectedSurah]);

  // ── AUDIO PERSISTANCE APK / VEILLE MOBILE ────────────────────────
  // Stratégie multi-couches pour WebView Android :
  // 1. Media Session API  → contrôles écran verrouillé + signal "média actif"
  // 2. Pre-fetch audio    → l'ayat suivant est chargé à l'avance
  // 3. visibilitychange   → reprend si le WebView a suspendu l'audio
  // 4. Wake Lock API      → fallback si disponible (Chromium récent)
  // 5. Silent audio loop  → maintient le contexte audio actif en arrière-plan

  const silentAudioRef  = useRef(null);   // <audio> silencieux en boucle
  const prefetchRef     = useRef(null);   // <audio> de pré-chargement
  const isPlayingRef    = useRef(false);  // ref miroir pour closures

  // Maintenir ref miroir de isMainPlaying (utilisable dans les callbacks)
  useEffect(() => { isPlayingRef.current = isMainPlaying; }, [isMainPlaying]);

  // Robust "resume playback" helper — tries immediately, and again as soon as the
  // audio element signals it's actually ready (more reliable in background than a
  // blind setTimeout, which Android can throttle/delay well past the media's own timing).
  const playWhenReady = useCallback(() => {
    const a = mainAudioRef.current;
    if (!a) return;
    const tryNow = () => a.play().catch(() => {});
    tryNow();
    if (a.readyState < 2) {
      const onReady = () => { tryNow(); a.removeEventListener('canplay', onReady); };
      a.addEventListener('canplay', onReady, { once: true });
    }
  }, []);

  // ── 1. Media Session API ──────────────────────────────────────────
  const updateMediaSession = useCallback((ayat, surah) => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Ayat ${ayat?.numberInSurah || ''}`,
        artist: surah?.englishName || 'Quran',
        album: 'القرآن الكريم',
        artwork: [{ src: 'https://cdn.islamic.network/quran/images/chapter_icon.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.playbackState = 'playing';
    } catch {}
  }, []);

  // Enregistrer les action handlers Media Session une seule fois
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const handlers = {
      play:         () => { setIsMainPlaying(true); mainAudioRef.current?.play().catch(()=>{}); },
      pause:        () => { setIsMainPlaying(false); mainAudioRef.current?.pause(); },
      stop:         () => { setIsMainPlaying(false); mainAudioRef.current?.pause(); },
      nexttrack:    () => {
        const a = ayats_ref.current;
        const idx = Math.min((a.findIndex(x => x.numberInSurah === (mainAudioRef.current?._ayatNum)) || 0) + 1, a.length - 1);
        playMainAyat(idx);
        playWhenReady();
      },
      previoustrack: () => {
        const a = ayats_ref.current;
        const idx = Math.max((a.findIndex(x => x.numberInSurah === (mainAudioRef.current?._ayatNum)) || 0) - 1, 0);
        playMainAyat(idx);
        playWhenReady();
      },
    };
    Object.entries(handlers).forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    });
    return () => {
      Object.keys(handlers).forEach(action => {
        try { navigator.mediaSession.setActionHandler(action, null); } catch {}
      });
    };
  }, []); // eslint-disable-line

  // Mettre à jour Media Session quand l'ayat change
  useEffect(() => {
    if (isMainPlaying && currentMainAyat) {
      updateMediaSession(currentMainAyat, selectedSurah);
    }
  }, [mainAyatIdx, isMainPlaying, updateMediaSession]); // eslint-disable-line

  // ── 2. Audio silencieux en boucle (maintient contexte audio actif) ─
  // Un fichier audio silencieux ultra-court en base64 (WAV 0.1s silence)
  const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  useEffect(() => {
    if (!silentAudioRef.current) return;
    const s = silentAudioRef.current;
    s.loop = true;
    s.volume = 0.001; // quasi-silencieux mais non-nul pour éviter optimisations
    if (isMainPlaying) {
      s.play().catch(() => {});
    } else {
      s.pause();
    }
  }, [isMainPlaying]);

  // ── 3. visibilitychange — reprend si suspendu par le WebView ──────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const audio = mainAudioRef.current;
      if (!audio || !isPlayingRef.current) return;
      // Petit délai pour laisser le WebView se réveiller complètement
      setTimeout(() => {
        if (audio.paused && isPlayingRef.current) {
          audio.play().catch(() => {});
        }
        silentAudioRef.current?.play().catch(() => {});
        // Re-signaler à Android que le média est actif
        if ('mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'playing'; } catch {}
        }
      }, 300);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    // Aussi sur 'resume' pour les WebView qui émettent cet événement
    document.addEventListener('resume', handleVisibility);

    // Capacitor natif : plus fiable que 'visibilitychange' dans certaines WebView Android
    let removeCapListener = null;
    (async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const sub = await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) handleVisibility();
        });
        removeCapListener = () => sub.remove();
      } catch {} // plugin absent ou non-natif : les listeners web ci-dessus suffisent
    })();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('resume', handleVisibility);
      removeCapListener?.();
    };
  }, []);

  // ── 4. Wake Lock API (Chromium WebView récent) ────────────────────
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock = null;
    if (isMainPlaying) {
      navigator.wakeLock.request('screen').then(l => { lock = l; wakeLockRef.current = l; }).catch(() => {});
    } else {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    }
    const reacquire = () => {
      if (isPlayingRef.current && !lock) {
        navigator.wakeLock.request('screen').then(l => { lock = l; wakeLockRef.current = l; }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', reacquire);
    return () => {
      lock?.release().catch(() => {});
      document.removeEventListener('visibilitychange', reacquire);
    };
  }, [isMainPlaying]);

  // ── 6. Watchdog — auto-relance si l'OS a mis l'audio en pause en arrière-plan ──
  // Contrairement à un setTimeout ponctuel (peut être différé indéfiniment quand le
  // WebView est en arrière-plan), un setInterval continue de se déclencher (throttled
  // mais jamais totalement gelé) : c'est le filet de sécurité qui répare toute lecture
  // interrompue par le système, sans dépendre du retour au premier plan de l'utilisateur.
  useEffect(() => {
    if (!isMainPlaying) return;
    const iv = setInterval(() => {
      const a = mainAudioRef.current;
      if (a && isPlayingRef.current && a.paused && !a.ended) {
        a.play().catch(() => {});
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [isMainPlaying]);

  // ── 5. Pré-chargement de l'ayat suivant ──────────────────────────
  useEffect(() => {
    if (!isMainPlaying || !ayats.length) return;
    const nextIdx = mainAyatIdx + 1;
    if (nextIdx >= ayats.length) return;
    const nextUrl = `${getAudioBase()}/${ayats[nextIdx].number}.mp3`;
    if (!prefetchRef.current) {
      prefetchRef.current = new Audio();
      prefetchRef.current.preload = 'auto';
    }
    prefetchRef.current.src = nextUrl;
    prefetchRef.current.load();
  }, [mainAyatIdx, isMainPlaying, ayats]);

  useEffect(() => {
    fetchSurahs().then(d => { setSurahs(d); }); // setSurahs already sets loadingSurahs:false in reducer
    // SW registered only in prod/Android (not localhost) so dev streams CDN directly
    if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
      navigator.serviceWorker.register('/audio-sw.js', { scope: '/' }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!selectedSurah) return;
    setOpenAyatNum(null); setPlayingAyatNum(null);
    setactivePageCoran(null);
    setIsMainPlaying(false); setMainCurrentMs(0);
    setLoopActive(false); setLoopCount(0);
    // Only show spinner if data isn't already in memory cache
    if (quranMemCache[`alafasy:${selectedSurah.number}`] == null) setLoadingAyats(true);
    fetchAyats(selectedSurah.number).then(d => {
      const ayahList = (d.ayahs || []).map(a => {
        if (a.numberInSurah === 1 && a.text) {
          // Strip leading basmala from first ayat (except Al-Fatiha surah 1 and At-Tawba surah 9)
          const sn = selectedSurah.number;
          if (sn !== 1 && sn !== 9) {
            // Basmala = exactly 4 words: بسم / الله / الرحمن / الرحيم
            // Check first word starts with بسم (bare, no diacritics)
            const words = a.text.trim().split(' ');
            const stripD = s => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '');
            if (words.length > 4 && stripD(words[0]) === 'بسم') {
              return { ...a, text: words.slice(4).join(' ') };
            }
            return a;
          }
        }
        return a;
      });
      const savedAyatNum = lastAyatBySurah[selectedSurah.number] ?? null;
      const restoredIdx = savedAyatNum != null
        ? Math.max(0, ayahList.findIndex(a => a.numberInSurah === savedAyatNum))
        : 0;
      // Start render window around the active ayat so it's visible immediately
      const initialLimit = Math.max(30, restoredIdx + 15);
      setRenderLimit(initialLimit);
      setAyats(ayahList); setLoadingAyats(false);
      setMainAyatIdx(restoredIdx);
      setactivePageCoran(null); // reset; will be derived from mainAyatIdx
      if (savedAyatNum != null) setOpenAyatNum(savedAyatNum);
      // Expand remaining ayats progressively after first paint
      const total = ayahList.length;
      const expandChunk = (from) => {
        if (from >= total) return;
        const next = Math.min(from + 50, total);
        requestAnimationFrame(() => { setRenderLimit(next); expandChunk(next); });
      };
      requestAnimationFrame(() => expandChunk(initialLimit));
      // Restore loop
      const savedLoop = loopBySurah[selectedSurah.number];
      if (savedLoop) {
        setLoopActive(savedLoop.active ?? false);
        setLoopStart(Math.min(savedLoop.start ?? 0, ayahList.length - 1));
        setLoopEnd(Math.min(savedLoop.end ?? Math.min(2, ayahList.length - 1), ayahList.length - 1));
        setLoopMax(savedLoop.max ?? 0);
        setLoopStartInput(parseInt(savedLoop.startInput) || 1);
        setLoopEndInput(parseInt(savedLoop.endInput) || Math.min(3, ayahList.length));
      } else {
        setLoopStart(0); setLoopEnd(Math.min(2, ayahList.length - 1));
        setLoopStartInput(1); setLoopEndInput(Math.min(3, ayahList.length));
      }
      // Scroll to active ayat — retry until ref is mounted (handles progressive render)
      if (savedAyatNum != null) {
        let attempts = 0;
        const tryScroll = () => {
          const el = ayatRefs.current[savedAyatNum];
          if (el) {
            el.scrollIntoView({ behavior: "instant", block: "center" });
          } else if (attempts++ < 20) {
            requestAnimationFrame(tryScroll);
          }
        };
        requestAnimationFrame(tryScroll);
      }
      // Auto-load timestamps deferred — don't block first ayat render
      // Use a ref-based generation counter to discard results from previous surahs
      if (sel.enableTimestamps(store.getState())) {
        const gen = ++tsLoadGenRef.current;
        setTimeout(() => {
          if (gen !== tsLoadGenRef.current) return; // surah changed before we ran
          loadTimestampsForSurah(selectedSurah.number, recitatorId).then(parsed => {
            if (gen !== tsLoadGenRef.current) return; // surah changed while loading
            if (parsed && Object.keys(parsed).length > 0) {
              updateTimestamps(parsed);
            }
          });
        }, 0);
      }
    });
  }, [selectedSurah]);

  useEffect(() => {
    if (selectedSurah && ayats.length > 0) {
      saveLoopForSurah(selectedSurah.number, {
        active: loopActive, start: loopStart, end: loopEnd, max: loopMax,
        startInput: loopStartInput, endInput: loopEndInput,
      });
    }
  }, [loopActive, loopStart, loopEnd, loopMax, loopStartInput, loopEndInput, selectedSurah?.number]);

  useEffect(() => {
    if (selectedSurah && ayats.length > 0) {
      const ayatNum = ayats[mainAyatIdx]?.numberInSurah;
      if (ayatNum != null) setLastAyatForSurah(selectedSurah.number, ayatNum);
    }
  }, [mainAyatIdx, selectedSurah?.number]);

  useEffect(() => {
    if (selectedSurah && openAyatNum != null) {
      setLastAyatForSurah(selectedSurah.number, openAyatNum);
    }
  }, [openAyatNum, selectedSurah?.number]);

  // RAF
  const startRaf = useCallback(() => {
    const tick = () => {
      if (mainAudioRef.current) setMainCurrentMs(mainAudioRef.current.currentTime * 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);
  const stopRaf = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);
  useEffect(() => {
    if (isMainPlaying) startRaf(); else stopRaf(); // keep mainCurrentMs as-is on pause so playback can resume from the same spot
    return stopRaf;
  }, [isMainPlaying, startRaf, stopRaf]);

  const lkey     = (s, a) => `${s}:${a}`;
  const getLData = (s, a) => learnData[lkey(s, a)] || { learned: false, readCount: 0, parts: [], wordsLearned: {} };
  // Forced-alignment timestamps are tied to one specific reciter's audio timing,
  // so they're stored/looked-up per reciter (unlike learnData, which stays global).
  const tskey    = (s, a) => `${recitatorId}:${s}:${a}`;

  const announceNumRef = useRef(false);
  useEffect(() => { announceNumRef.current = announceNum; }, [announceNum]);

  const speakAyatNum = useCallback((ayatNum) => {
    if (!announceNumRef.current) return Promise.resolve();
    return new Promise(resolve => {
      const ss = window.speechSynthesis;
      if (!ss) { resolve(); return; }
      ss.cancel();
      const utter = new SpeechSynthesisUtterance(String(ayatNum));
      utter.lang = 'ar-SA';
      utter.rate = 0.85;
      utter.volume = 1;
      utter.onend = resolve;
      utter.onerror = () => resolve();
      // Android Chrome fix: resume if paused
      const resumeTimer = setInterval(() => { if (ss.paused) ss.resume(); }, 250);
      utter.onend = () => { clearInterval(resumeTimer); resolve(); };
      utter.onerror = () => { clearInterval(resumeTimer); resolve(); };
      ss.speak(utter);
    });
  }, []);

  const playMainAyat = useCallback((idx) => {
    if (!ayats.length) return;
    const i = Math.max(0, Math.min(idx, ayats.length - 1));
    const changed = i !== mainAyatIdx;
    setMainAyatIdx(i); setPlayingAyatNum(ayats[i]?.numberInSurah);
    if (changed) setMainCurrentMs(0); // only reset elapsed time on an actual ayat change, not on resume
    const targetAyat = ayats[i];
    // Page mode: if the target ayat lives on a different page than the one currently
    // displayed, switch page first (its DOM node doesn't exist until we do) then scroll to it.
    if (pageMode && targetAyat?.page != null) {
      const curPage = activePageCoran ?? ayats[0]?.page;
      if (targetAyat.page !== curPage) {
        setactivePageCoran(targetAyat.page);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            ayatRefs.current[targetAyat.numberInSurah]?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        });
        return;
      }
    }
    if (changed) ayatRefs.current[ayats[i]?.numberInSurah]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [ayats, mainAyatIdx, pageMode, activePageCoran]);

  const handleMainEnded = useCallback(() => {
    const next = mainAyatIdx + 1;
    if (loopActive) {
      const end = Math.min(loopEnd, ayats.length - 1);
      if (mainAyatIdx < end) {
        playMainAyat(next); playWhenReady();
      } else {
        const nc = loopCount + 1;
        if (loopMax === 0 || nc < loopMax) {
          setLoopCount(nc); playMainAyat(loopStart); playWhenReady();
        } else {
          setLoopActive(false); setLoopCount(0);
          setIsMainPlaying(false); setPlayingAyatNum(null); setMainCurrentMs(0);
        }
      }
      return;
    }
    if (next < ayats.length) { playMainAyat(next); playWhenReady(); }
    else { setIsMainPlaying(false); setPlayingAyatNum(null); setMainCurrentMs(0); }
  }, [mainAyatIdx, ayats, playMainAyat, loopActive, loopStart, loopEnd, loopCount, loopMax, playWhenReady]);

  const loadedAyatIdxRef = useRef(null);
  useEffect(() => {
    if (!mainAudioRef.current) return;
    const audioEl = mainAudioRef.current;
    const ayatChanged = loadedAyatIdxRef.current !== mainAyatIdx;
    if (isMainPlaying) {
      const num = ayats[mainAyatIdx]?.numberInSurah;
      if (ayatChanged) {
        loadedAyatIdxRef.current = mainAyatIdx;
        audioEl.load(); // new ayat → (re)load its audio source from the start
        if (announceNumRef.current && num) {
          audioEl.pause();
          speakAyatNum(num).then(() => { mainAudioRef.current?.play().catch(() => {}); });
        } else {
          audioEl.play().catch(() => {});
        }
      } else {
        audioEl.play().catch(() => {}); // resume: same ayat, same audio element → keeps its currentTime
      }
    } else {
      audioEl.pause(); // pausing never touches currentTime, so resuming continues from here
    }
  }, [mainAyatIdx, isMainPlaying]);

  useEffect(() => {
    if (openAyatNum && submenuMode === "lecture" && selectedSurah) {
      setLData(selectedSurah.number, openAyatNum, d => ({ ...d, readCount: (d.readCount || 0) + 1 }));
      // Record daily activity
      const today = new Date().toISOString().slice(0, 10);
      dispatch(goalsActions.recordActivity({ date: today, ayatsRead: 1 }));
    }
    // Stop part audio when leaving apprentissage tab
    if (submenuMode !== "apprentissage") {
      if (partAudioRef.current && !partAudioRef.current.paused) {
        partAudioRef.current.pause();
      }
      setPlayingPart(null);
      setPartCurrentMs(0);
      stopPartRaf();
    }
  }, [openAyatNum, submenuMode]);

  // ── Toast helper ──
  const showToast = useCallback((text, type = 'info') => {
    setVoiceToast({ text, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setVoiceToast(null), 3000);
  }, []);

  // ── Aller à un ayat par son numéro (sourate courante) ──
  const jumpToAyatNumber = (raw) => {
    const n = parseInt(raw, 10);
    if (!n || !selectedSurah) return;
    const target = ayats.find(a => a.numberInSurah === n);
    if (!target) { showToast(`Ayat ${n} introuvable`, 'error'); return; }
    navigate(`/quran/${selectedSurah.number}/${n}`);
    setOpenAyatNum(n);
    if (pageMode && target.page != null) setactivePageCoran(target.page);
    setTimeout(() => { ayatRefs.current[n]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, pageMode ? 250 : 50);
  };

  // ── Voice command execution ──
  const executeCommand = useCallback((cmd) => {
    if (!cmd) return false;
    const s = surahs_ref.current;
    const a = ayats_ref.current;

    if (cmd.action === 'play') {
      const startIdx = loopActive ? loopStart : mainAyatIdx;
      playMainAyat(startIdx); setIsMainPlaying(true);
      showToast('▶ Lecture', 'success'); return true;
    }
    if (cmd.action === 'pause') {
      setIsMainPlaying(false); mainAudioRef.current?.pause();
      showToast('⏸ Pause', 'success'); return true;
    }
    if (cmd.action === 'stop') {
      setIsMainPlaying(false); setPlayingAyatNum(null);
      setLoopActive(false); setLoopCount(0);
      mainAudioRef.current?.pause();
      showToast('⏹ Stop', 'success'); return true;
    }
    if (cmd.action === 'next') {
      const i = Math.min(a.length - 1, mainAyatIdx + 1);
      playMainAyat(i); if (isMainPlaying) setTimeout(() => mainAudioRef.current?.play(), 100);
      showToast(`→ Ayat ${a[i]?.numberInSurah}`, 'success'); return true;
    }
    if (cmd.action === 'prev') {
      const i = Math.max(0, mainAyatIdx - 1);
      playMainAyat(i); if (isMainPlaying) setTimeout(() => mainAudioRef.current?.play(), 100);
      showToast(`← Ayat ${a[i]?.numberInSurah}`, 'success'); return true;
    }
    if (cmd.action === 'surah') {
      const surah = s.find(x => x.number === cmd.number);
      if (surah) { setSelectedSurah(surah); showToast(`📖 ${surah.englishName}`, 'success'); return true; }
    }
    if (cmd.action === 'ayat') {
      const idx = a.findIndex(x => x.numberInSurah === cmd.number);
      if (idx >= 0) {
        playMainAyat(idx);
        if (!isMainPlaying) { setIsMainPlaying(true); }
        else setTimeout(() => mainAudioRef.current?.play(), 100);
        showToast(`→ Ayat ${cmd.number}`, 'success'); return true;
      }
      showToast(`Ayat ${cmd.number} introuvable`, 'error'); return true;
    }
    if (cmd.action === 'loop') {
      const fromIdx = a.findIndex(x => x.numberInSurah === cmd.from);
      const toIdx   = a.findIndex(x => x.numberInSurah === cmd.to);
      if (fromIdx >= 0 && toIdx >= 0) {
        const s = Math.min(fromIdx, toIdx);
        const e = Math.max(fromIdx, toIdx);
        setLoopStart(s); setLoopEnd(e);
        setLoopStartInput(a[s]?.numberInSurah ?? 1);
        setLoopEndInput(a[e]?.numberInSurah ?? 1);
        setLoopActive(true); setLoopCount(0); setShowLoopBar(true);
        playMainAyat(s); setIsMainPlaying(true);
        showToast(`↺ Boucle ${a[s]?.numberInSurah}–${a[e]?.numberInSurah}`, 'success'); return true;
      }
      showToast(`Range introuvable`, 'error'); return true;
    }
    if (cmd.action === 'loop_off') {
      setLoopActive(false); setLoopCount(0);
      showToast('↺ Boucle désactivée', 'success'); return true;
    }
    if (cmd.action === 'repeat') {
      setLoopMax(cmd.times); setLoopActive(true); setLoopCount(0); setShowLoopBar(true);
      showToast(`↺ × ${cmd.times}`, 'success'); return true;
    }
    return false;
  }, [mainAyatIdx, isMainPlaying, loopActive, loopStart, playMainAyat, showToast]);

  // ── Voice recognition — enregistrement continu robuste mobile ──────
  //
  // Problème Android WebView / Chrome mobile :
  //   • continuous:true → erreur "aborted" en boucle sur certains appareils
  //   • continuous:false → session courte, gap au redémarrage, overlap si deux
  //     instances se chevauchent → erreurs "aborted" en cascade
  //
  // Solution : session unique continuous:true avec watchdog.
  //   Si continuous:true échoue 2× de suite → basculer en mode session courte
  //   avec verrou isStarting pour empêcher tout overlap.
  //
  // Couche 1 : Android native bridge  → window.Android.startSpeechRecognition()
  // Couche 2 : Web Speech API continue (continuous:true + watchdog)
  // Couche 3 : Web Speech API sessions courtes (fallback si continuous crash)
  // Couche 4 : Saisie manuelle (dernier recours)

  const shouldListenRef  = useRef(false);
  const voicePausedMain  = useRef(false);   // main audio was paused for voice
  const voicePausedPart  = useRef(false);   // part audio was paused for voice
  const isStartingRef    = useRef(false); // verrou anti-overlap
  const recInstanceRef   = useRef(null);  // instance active
  const voiceLayer       = useRef('unknown');
  const continuousFails  = useRef(0);     // nb d'échecs consecutive de continuous:true
  const restartTimerRef  = useRef(null);
  // showVoiceInput and voiceInputText are now in Redux (voiceSlice)

  const clearRestartTimer = () => {
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
  };

  // Callback partagé : traite un transcript quelle que soit la couche
  const handleTranscript = useCallback((transcript) => {
    if (!transcript?.trim()) return;
    showToast(transcript, 'info');
    const cmd = parseVoiceCommand(transcript, surahs_ref.current, ayats_ref.current, selSurah_ref.current);
    if (cmd) { executeCommand(cmd); }
    else { showToast(`"${transcript}" — commande inconnue`, 'error'); }
  }, [executeCommand, showToast]);

  // Exposer le callback pour le bridge Android natif
  useEffect(() => {
    window.QuranApp = window.QuranApp || {};
    window.QuranApp.onSpeechResult = (transcript) => {
      handleTranscript(transcript);
      if (shouldListenRef.current) {
        try { window.Android?.startSpeechRecognition('fr-FR'); } catch {}
      } else { setListening(false); }
    };
    window.QuranApp.onSpeechError = () => {
      if (shouldListenRef.current) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          try { window.Android?.startSpeechRecognition('fr-FR'); } catch {}
        }, 700);
      } else { setListening(false); }
    };
    return () => {
      clearTimeout(restartTimerRef.current);
      if (window.QuranApp) { window.QuranApp.onSpeechResult = null; window.QuranApp.onSpeechError = null; }
    };
  }, [handleTranscript]);

  // ── Couche Web Speech : crée une instance et la démarre ──
  const spawnRecognition = useCallback((useContinuous) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !shouldListenRef.current || isStartingRef.current) return;

    // Détruire l'instance précédente proprement
    if (recInstanceRef.current) {
      try {
        recInstanceRef.current.onend   = null;
        recInstanceRef.current.onerror = null;
        recInstanceRef.current.onresult= null;
        recInstanceRef.current.abort();
      } catch {}
      recInstanceRef.current = null;
    }

    isStartingRef.current = true;
    const rec = new SR();
    rec.lang            = 'fr-FR';
    rec.continuous      = useContinuous;
    rec.interimResults  = false;
    rec.maxAlternatives = 1;
    recInstanceRef.current  = rec;
    recognitionRef.current  = rec;

    rec.onstart = () => {
      isStartingRef.current = false;
      continuousFails.current = useContinuous ? 0 : continuousFails.current;
      setListening(true);
    };

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) handleTranscript(e.results[i][0].transcript.trim());
      }
    };

    rec.onerror = (e) => {
      isStartingRef.current = false;
      clearRestartTimer();

      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        shouldListenRef.current = false;
        setListening(false);
        voiceLayer.current = 'manual';
        setShowVoiceInput(true);
        showToast('Micro refusé — saisie manuelle', 'error');
        return;
      }

      if (e.error === 'aborted') {
        // aborted = on a appelé abort() nous-mêmes → ignorer si on arrête
        if (!shouldListenRef.current) { setListening(false); return; }
        // sinon : overlap ou bug WebView — courte pause puis respawn
        restartTimerRef.current = setTimeout(() => spawnRecognition(useContinuous), 400);
        return;
      }

      if (e.error === 'audio-capture') {
        restartTimerRef.current = setTimeout(() => spawnRecognition(useContinuous), 1200);
        return;
      }

      if (e.error === 'network') {
        restartTimerRef.current = setTimeout(() => spawnRecognition(useContinuous), 2500);
        return;
      }

      // no-speech et autres : redémarrer rapidement
      if (shouldListenRef.current) {
        restartTimerRef.current = setTimeout(() => spawnRecognition(useContinuous), 350);
      }
    };

    rec.onend = () => {
      isStartingRef.current = false;
      if (!shouldListenRef.current) { setListening(false); return; }

      if (useContinuous) {
        // continuous:true s'est terminé seul → probablement pas supporté
        continuousFails.current += 1;
        clearRestartTimer();
        if (continuousFails.current >= 2) {
          // Basculer définitivement en sessions courtes
          restartTimerRef.current = setTimeout(() => spawnRecognition(false), 300);
        } else {
          restartTimerRef.current = setTimeout(() => spawnRecognition(true), 300);
        }
      } else {
        // Session courte terminée normalement → redémarrer
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => spawnRecognition(false), 200);
      }
    };

    try {
      rec.start();
    } catch {
      isStartingRef.current = false;
      restartTimerRef.current = setTimeout(() => spawnRecognition(useContinuous), 600);
    }
  }, [handleTranscript, showToast]);

  const toggleVoice = useCallback(() => {
    if (shouldListenRef.current) {
      // ── ARRÊT ──
      shouldListenRef.current = false;
      clearRestartTimer();
      isStartingRef.current = false;
      if (recInstanceRef.current) {
        try {
          recInstanceRef.current.onend   = null;
          recInstanceRef.current.onerror = null;
          recInstanceRef.current.abort();
        } catch {}
        recInstanceRef.current = null;
      }
      try { window.Android?.stopSpeechRecognition(); } catch {}
      setListening(false);
      setShowVoiceInput(false);
      // ── Reprendre les audios mis en pause pour la voix ──
      if (voicePausedMain.current) {
        voicePausedMain.current = false;
        mainAudioRef.current?.play().catch(() => {});
        setIsMainPlaying(true);
      }
      if (voicePausedPart.current) {
        voicePausedPart.current = false;
        partAudioRef.current?.play().catch(() => {});
      }
    } else {
      // ── DÉMARRAGE : couper tous les audios en cours ──
      voicePausedMain.current = false;
      voicePausedPart.current = false;
      if (isPlayingRef.current) {
        mainAudioRef.current?.pause();
        setIsMainPlaying(false);
        voicePausedMain.current = true;
      }
      if (partAudioRef.current && !partAudioRef.current.paused) {
        partAudioRef.current.pause();
        voicePausedPart.current = true;
      }
      shouldListenRef.current = true;
      continuousFails.current = 0;

      if (window.Android && typeof window.Android.startSpeechRecognition === 'function') {
        voiceLayer.current = 'bridge';
        setListening(true);
        try { window.Android.startSpeechRecognition('fr-FR'); } catch {
          voiceLayer.current = 'webspeech';
          spawnRecognition(true);
        }
      } else if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        voiceLayer.current = 'webspeech';
        spawnRecognition(true);
      } else {
        voiceLayer.current = 'manual';
        setListening(true);
        setShowVoiceInput(true);
      }
    }
  }, [spawnRecognition]);

  // Timestamps
  const handleTimestampsFiles = useCallback(async (files) => {
    const newEntries = {};
    for (const file of files) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        Object.assign(newEntries, parseTimestampsFile(data, selectedSurah?.number, recitatorId));
      } catch (e) { console.error(e); }
    }
    setTimestampsMap({ ...timestampsMap, ...newEntries });
  }, [selectedSurah, timestampsMap, recitatorId]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const files = [...e.dataTransfer.files].filter(f => f.name.endsWith('.json'));
    if (files.length) handleTimestampsFiles(files);
  }, [handleTimestampsFiles]);

  // Loop inputs apply
  const applyLoopInputs = () => {
    const s = (typeof loopStartInput === "number" ? loopStartInput : parseInt(loopStartInput)) || 1;
    const e = (typeof loopEndInput   === "number" ? loopEndInput   : parseInt(loopEndInput))   || 1;
    const si = ayats.findIndex(a => a.numberInSurah === s);
    const ei = ayats.findIndex(a => a.numberInSurah === e);
    if (si >= 0) setLoopStart(si);
    if (ei >= 0) setLoopEnd(ei);
  };

  // Memoized per-surah learn stats — only recomputes when learnData or the text cache changes
  const surahStats = useMemo(() => {
    if (!enableHeavyCompute) return {};
    const stats = {};
    for (const [key, val] of Object.entries(learnData)) {
      const colon = key.indexOf(':');
      if (colon === -1) continue;
      const sn = parseInt(key.slice(0, colon));
      const an = parseInt(key.slice(colon + 1));
      if (!stats[sn]) stats[sn] = { learned: 0, mastery: 0, count: 0 };
      if (val.learned) stats[sn].learned++;
      const ayatText = surahTextCache[sn]?.[an];
      stats[sn].mastery += computeMastery(val, ayatText);
      stats[sn].count++;
    }
    return stats;
  }, [learnData, surahTextCache]);

  // Seed the text cache from the surah currently loaded (no extra fetch needed)
  useEffect(() => {
    if (!selectedSurah || !ayats || ayats.length === 0) return;
    const map = {};
    ayats.forEach(a => { map[a.numberInSurah] = a.text; });
    setSurahTextCache(c => ({ ...c, [selectedSurah.number]: map }));
  }, [ayats, selectedSurah]);

  // Lazily fetch text for any other surah that has learnData but isn't cached yet
  // (needed so the sidebar mastery % is accurate for surahs not currently open)
  useEffect(() => {
    const sns = new Set();
    Object.keys(learnData).forEach(k => {
      const sn = parseInt(k.slice(0, k.indexOf(':')));
      if (!isNaN(sn)) sns.add(sn);
    });
    const toFetch = [...sns].filter(sn => !surahTextCache[sn]);
    if (toFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const sn of toFetch) {
        try {
          const arr = await fetchSurahSimple(sn); // [{num, text}]
          if (cancelled) return;
          const map = {};
          arr.forEach(a => { map[a.num] = a.text; });
          setSurahTextCache(c => c[sn] ? c : { ...c, [sn]: map });
        } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [learnData]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSurahs = useMemo(() => surahs.filter(s =>
    s.englishName.toLowerCase().includes(search.toLowerCase()) ||
    s.name.includes(search) || String(s.number).includes(search)
  ), [surahs, search]);

  const currentMainAyat = ayats[mainAyatIdx];
  const audioUrl = a => a ? `${getAudioBase()}/${a.number}.mp3` : "";
  // Memoized mastery per ayat key
  const masteryMap = useMemo(() => {
    if (!enableHeavyCompute) return {};
    const m = {};
    // Build ayat text lookup from loaded ayats
    const textLookup = {};
    if (selectedSurah && ayats) {
      ayats.forEach(a => { textLookup[`${selectedSurah.number}:${a.numberInSurah}`] = a.text; });
    }
    for (const [k, v] of Object.entries(learnData)) m[k] = computeMastery(v, textLookup[k]);
    return m;
  }, [learnData, enableHeavyCompute, ayats, selectedSurah]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadedCount = useMemo(() => selectedSurah
    ? ayats.filter(a => timestampsMapRef.current[tskey(selectedSurah.number, a.numberInSurah)]).length : 0,
  [tsVersion, ayats, selectedSurah, recitatorId]);

  const loopStartNum = ayats[loopStart]?.numberInSurah || 1;
  const loopEndNum   = ayats[Math.min(loopEnd, ayats.length - 1)]?.numberInSurah || 1;

  return (
    <ArabicKeyboardContext.Provider value={{ show: showArabicKeyboard, setShow: setShowArabicKeyboard, activeInput: activeArabicInput }}>
    <>
      <StyleTag />
      <div className="app" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
        <header className="header">
          {/* Left Branding / Hamburger group */}
          <div className="header-left">
            <button
              className="header-menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Menu sourates"
              style={{
                background: sidebarOpen ? "rgba(201,168,76,.18)" : undefined,
                borderColor: sidebarOpen ? "rgba(201,168,76,.55)" : undefined,
                color: sidebarOpen ? "var(--gold2)" : undefined,
              }}
            >
              ☰
            </button>

            <div className="header-logo" onClick={() => setActivePage('quran')} title="Accueil Coran">
              <span>QUR<span className="logo-highlight">ÂN</span></span>
              <span className="header-subtitle">STUDY</span>
            </div>
          </div>

          {/* Page nav tabs — Segmented pill control */}
          <nav className="header-nav" aria-label="Navigation principale">
            {[
              { id: "quran",         icon: "📖", label: "CORAN" },
              { id: "prononciation", icon: "🔤", label: "PRONON." },
              { id: "dashboard",     icon: "📊", label: "DASH" },
              { id: "collections",   icon: "🗂", label: "COLL." },
              { id: "revision",      icon: "✏",  label: "RÉVISION" },
            ].map(({ id, icon, label }) => (
              <button
                key={id}
                className={`header-nav-btn${activePage === id ? ` active-${id}` : ""}`}
                onClick={() => setActivePage(id)}
                title={label}
              >
                <span className="nav-icon">{icon}</span>
                <span className="nav-label">{label}</span>
              </button>
            ))}
          </nav>

          {/* Right Action buttons & User Menu */}
          <div className="header-actions" ref={userMenuRef}>
            {/* Arabic keyboard toggle (desktop only) */}
            <button
              className="voice-btn desktop-only-action"
              onClick={() => setShowArabicKeyboard(v => {
                const next = !v;
                try { localStorage.setItem('quran_arabic_keyboard', next ? '1' : '0'); } catch {}
                return next;
              })}
              title={showArabicKeyboard ? "Masquer clavier arabe" : "Afficher clavier arabe"}
              style={{
                background: showArabicKeyboard ? 'rgba(62,184,160,.18)' : undefined,
                borderColor: showArabicKeyboard ? 'var(--teal)' : undefined,
                color: showArabicKeyboard ? 'var(--teal2)' : undefined,
              }}
            >
              ⌨️
            </button>

            {/* Voice Command Mic */}
            <button
              className={`voice-btn${listening ? ' listening' : ''}`}
              onClick={toggleVoice}
              title={listening ? "Arrêter écoute vocale" : "Commande vocale"}
            >
              🎤
            </button>

            {/* Rappel vocal (desktop only) */}
            <button
              className="voice-btn desktop-only-action"
              onClick={() => setShowRappel(v => !v)}
              title="Rappel vocal"
              style={{
                background: showRappel ? 'rgba(201,168,76,.18)' : undefined,
                borderColor: showRappel ? 'rgba(201,168,76,.5)' : undefined,
                color: showRappel ? 'var(--gold2)' : undefined,
              }}
            >
              🔔
            </button>

            {/* User Avatar & Dropdown */}
            {currentUser && (
              <div style={{ position: 'relative' }}>
                <button
                  className={`header-user-btn${showUserMenu ? ' active' : ''}`}
                  onClick={() => setShowUserMenu(v => !v)}
                  title={currentUser.displayName || currentUser.email || "Mon compte"}
                  aria-expanded={showUserMenu}
                >
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="avatar" className="header-avatar" />
                  ) : (
                    <div className="header-avatar-placeholder">
                      {(currentUser.displayName || currentUser.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                </button>

                {/* Mobile / Desktop Dropdown Menu */}
                {showUserMenu && (
                  <div className="header-user-menu">
                    <div className="user-menu-header">
                      <div className="user-menu-name">
                        {currentUser.displayName || "Utilisateur"}
                      </div>
                      <div className="user-menu-email">
                        {currentUser.email || ""}
                      </div>
                    </div>

                    <button
                      className="user-menu-item"
                      onClick={() => {
                        setShowArabicKeyboard(v => {
                          const next = !v;
                          try { localStorage.setItem('quran_arabic_keyboard', next ? '1' : '0'); } catch {}
                          return next;
                        });
                        setShowUserMenu(false);
                      }}
                    >
                      <div className="menu-left">
                        <span>⌨️</span>
                        <span>Clavier Arabe</span>
                      </div>
                      <span className={`user-menu-badge ${showArabicKeyboard ? 'on' : 'off'}`}>
                        {showArabicKeyboard ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      className="user-menu-item"
                      onClick={() => {
                        setShowRappel(v => !v);
                        setShowUserMenu(false);
                      }}
                    >
                      <div className="menu-left">
                        <span>🔔</span>
                        <span>Rappel Vocal</span>
                      </div>
                      <span className={`user-menu-badge ${showRappel ? 'on' : 'off'}`}>
                        {showRappel ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      className="user-menu-item"
                      onClick={() => {
                        setShowOptionsModal(true);
                        setShowUserMenu(false);
                      }}
                    >
                      <div className="menu-left">
                        <span>⚙</span>
                        <span>Paramètres & Sync</span>
                      </div>
                    </button>

                    <button
                      className="user-menu-item logout"
                      onClick={() => {
                        setShowUserMenu(false);
                        onSignOut();
                      }}
                    >
                      <div className="menu-left">
                        <span>⏏</span>
                        <span>Se déconnecter</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Voice toast */}
        {voiceToast && (
          <div className={`voice-toast${voiceToast.type === 'success' ? ' success' : voiceToast.type === 'error' ? ' error' : ''}`}>
            {listening && <div className="voice-dot" />}
            <span className="transcript">{voiceToast.text}</span>
          </div>
        )}

        {/* Manual voice input — fallback quand SpeechRecognition indisponible (Android WebView) */}
        {showVoiceInput && listening && (
          <div style={{
            position:"fixed",top:66,left:0,right:0,zIndex:490,
            background:"var(--surface2)",borderBottom:"2px solid var(--gold)",
            padding:"10px 14px",display:"flex",gap:10,alignItems:"center",
            boxShadow:"0 4px 20px rgba(0,0,0,.4)"
          }}>
            <div className="voice-dot" />
            <input
              autoFocus
              type="text"
              placeholder="Tapez une commande... (ex: sourate 2, verset 5, play)"
              value={voiceInputText}
              onChange={e => setVoiceInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && voiceInputText.trim()) {
                  handleTranscript(voiceInputText.trim());
                  setVoiceInputText('');
                }
              }}
              style={{
                flex:1,background:"var(--surface3)",border:"1px solid var(--gold)",
                borderRadius:6,padding:"8px 12px",color:"var(--text)",
                fontFamily:"'Cinzel',serif",fontSize:11,letterSpacing:1,outline:"none"
              }}
            />
            <button
              onClick={() => { if (voiceInputText.trim()) { handleTranscript(voiceInputText.trim()); setVoiceInputText(''); } }}
              style={{ padding:"8px 14px",background:"rgba(201,168,76,.15)",border:"1px solid var(--gold)",borderRadius:6,color:"var(--gold)",cursor:"pointer",fontSize:11,fontFamily:"'Cinzel',serif",letterSpacing:1,flexShrink:0 }}>
              ↵ OK
            </button>
            <button onClick={toggleVoice}
              style={{ padding:"8px 12px",background:"transparent",border:"1px solid var(--border2)",borderRadius:6,color:"var(--text3)",cursor:"pointer",fontSize:11,flexShrink:0 }}>
              ✕
            </button>
          </div>
        )}

        {/* Voice help panel */}
        {showVoiceHelp && (
          <div className="voice-help">
            <div className="voice-help-title">COMMANDES VOCALES</div>
            {[
              ["▶ Lecture",    "play / joue / lire"],
              ["⏸ Pause",     "pause"],
              ["⏹ Stop",      "stop / arrête"],
              ["→ Suivant",   "suivant"],
              ["← Précédent", "précédent"],
              ["📖 Sourate",  "sourate fatiha / sourate 2"],
              ["→ Verset",    "verset 5 / ayat 12"],
              ["↺ Boucle",    "boucle versets 2 à 7"],
              ["↺ Off",       "arrêter la boucle"],
              ["× Répéter",   "3 fois"],
            ].map(([label, ex]) => (
              <div className="voice-help-cmd" key={label}>
                <span>{label}</span>
                <span className="voice-help-ex">"{ex}"</span>
              </div>
            ))}
          </div>
        )}

        <div className="body">
          {/* Mobile overlay */}
          <div className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

          {/* Sidebar — always rendered, accessible via ☰ from any page */}
          <aside className={`sidebar${sidebarOpen ? ' open' : ''}${activePage !== 'quran' ? ' sidebar-floating' : ''}`}>
            <div className="sidebar-search">
              <input placeholder="RECHERCHER..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="sidebar-list">
              {loadingSurahs
                ? <div className="loading"><div className="loading-ring" /><span>CHARGEMENT</span></div>
                : filteredSurahs.map(s => (
                  <div key={s.number}
                    className={`surah-item${selectedSurah?.number === s.number ? " active surah-active" : ""}${(surahStats[s.number]?.learned >= s.numberOfAyahs && s.numberOfAyahs > 0) ? " fully-learned" : ""}`}
                    onClick={() => { setSelectedSurah(s); setSidebarOpen(false); if (activePage !== 'quran') setActivePage('quran'); }}>
                    <div className="surah-num">{s.number}</div>
                    <div className="surah-info">
                      <div className="surah-name-en">{s.englishName}</div>
                      <div className="surah-meta">{s.revelationType} · {s.numberOfAyahs} AYATS{surahStats[s.number]?.learned > 0 ? ` · ${surahStats[s.number].learned}✓` : ''}</div>
                      {(() => { const st = surahStats[s.number]; const total = s.numberOfAyahs || 0; const pct = total > 0 ? Math.round((st?.mastery || 0) / total) : 0; return (
                        <div style={{marginTop:3,display:'flex',alignItems:'center',gap:6}}>
                          <div style={{flex:1,height:2,background:'var(--surface3)',borderRadius:2,overflow:'hidden'}}>
                            <div style={{height:'100%',width:pct+'%',background:masteryColor(pct),borderRadius:2}} />
                          </div>
                          <span style={{fontSize:7,fontFamily:"'Cinzel',serif",color:masteryColor(pct),flexShrink:0}}>{pct}%</span>
                        </div>
                      ); })()}
                    </div>
                    <div className="surah-name-ar">{s.name}</div>
                  </div>
                ))}
            </div>
          </aside>

          <Routes>
            <Route path="/" element={<Navigate to="/quran" replace />} />
            <Route path="/prononciation" element={<AnimatedPage pageKey="prononciation"><PrononciationPage /></AnimatedPage>} />
            <Route path="/dashboard" element={
              <AnimatedPage pageKey="dashboard"><DashboardPage
                learnData={learnData}
                surahs={surahs}
                goals={goals}
                activity={activity}
                onSetGoal={(key, value) => dispatch(goalsActions.setGoal({ key, value }))}
                onRecordActivity={(date, delta) => dispatch(goalsActions.recordActivity({ date, ...delta }))}
                onNavigate={(surahNum) => { navigate(`/quran/${surahNum}`); const s = surahs.find(x=>x.number===surahNum); if(s){setSelectedSurah(s);} }}
              /></AnimatedPage>
            } />
            <Route path="/collections" element={
              <AnimatedPage pageKey="collections"><CollectionsPage
                collections={collections}
                learnData={learnData}
                showQalqala={showQalqala}
                showMadd={showMadd}
                showIzhar={showIzhar}
                showIdgham={showIdgham}
                setLData={setLData}
                onCreateCollection={createCollection}
                onDeleteCollection={deleteCollection}
                onToggleAyat={toggleAyatInCollection}
                onOpenCollModal={(entry) => setCollModal(entry)}
                ayatInCollectionsFn={ayatInCollections}
                surahs={surahs}
                initialSearchQuery={pendingSearchQuery}
                onConsumeSearchQuery={() => setPendingSearchQuery(null)}
                onNavigate={(surahNum, ayatNum) => {
                  navigate(`/quran/${surahNum}/${ayatNum}`);
                  const s = surahs.find(x => x.number === surahNum);
                  if (s) {
                    setSelectedSurah(s);
                    setTimeout(() => {
                      const el = ayatRefs.current[ayatNum];
                      if (el) { el.scrollIntoView({ behavior:"smooth", block:"center" }); setOpenAyatNum(ayatNum); }
                    }, 1200);
                  }
                }}
              /></AnimatedPage>
            } />
            <Route path="/revision" element={
              <AnimatedPage pageKey="revision"><RevisionPage
                learnData={learnData}
                surahs={surahs}
                setLData={setLData}
                onNavigate={(surahNum, ayatNum) => {
                  navigate(`/quran/${surahNum}/${ayatNum}`);
                  const s = surahs.find(x => x.number === surahNum);
                  if (s) {
                    setSelectedSurah(s);
                    setTimeout(() => {
                      const el = ayatRefs.current[ayatNum];
                      if (el) { el.scrollIntoView({ behavior:"smooth", block:"center" }); setOpenAyatNum(ayatNum); }
                    }, 1200);
                  }
                }}
              /></AnimatedPage>
            } />
            <Route path="/revision/memorise/:surahNum?/:rangeFrom?/:rangeTo?" element={
              <AnimatedPage pageKey="revision"><RevisionPage
                learnData={learnData}
                surahs={surahs}
                setLData={setLData}
                initialFilter="carte"
                onNavigate={(surahNum, ayatNum) => {
                  navigate(`/quran/${surahNum}/${ayatNum}`);
                  const s = surahs.find(x => x.number === surahNum);
                  if (s) {
                    setSelectedSurah(s);
                    setTimeout(() => {
                      const el = ayatRefs.current[ayatNum];
                      if (el) { el.scrollIntoView({ behavior:"smooth", block:"center" }); setOpenAyatNum(ayatNum); }
                    }, 1200);
                  }
                }}
              /></AnimatedPage>
            } />
            <Route path="/revision/questions/:surahNum?/:rangeFrom?/:rangeTo?/:qIdx?" element={
              <AnimatedPage pageKey="revision"><RevisionPage
                learnData={learnData}
                surahs={surahs}
                setLData={setLData}
                initialFilter="questions"
                onNavigate={(surahNum, ayatNum) => {
                  navigate(`/quran/${surahNum}/${ayatNum}`);
                  const s = surahs.find(x => x.number === surahNum);
                  if (s) {
                    setSelectedSurah(s);
                    setTimeout(() => {
                      const el = ayatRefs.current[ayatNum];
                      if (el) { el.scrollIntoView({ behavior:"smooth", block:"center" }); setOpenAyatNum(ayatNum); }
                    }, 1200);
                  }
                }}
              /></AnimatedPage>
            } />
            <Route path="/quran/book" element={
              <AnimatedPage pageKey="quran-book">
                <QuranBookPage surahs={surahs} />
              </AnimatedPage>
            } />
            <Route path="/quran/book3d" element={
              <AnimatedPage pageKey="quran-book3d">
                <QuranBook3DPage surahs={surahs} />
              </AnimatedPage>
            } />
            <Route path="/quran/:surahNum?/:ayatNum?" element={(
            <AnimatedPage pageKey="quran"><main className="main">
              {!selectedSurah ? (
              <div className="empty-state">
                <div className="empty-arabic">القرآن الكريم</div>
                <span>SÉLECTIONNEZ UNE SOURATE</span>
                <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap',justifyContent:'center'}}>
                  <button onClick={() => navigate('/quran/book')}
                    style={{ fontSize:9, letterSpacing:1.5, padding:'7px 16px',
                      fontFamily:"'Cinzel',serif", background:'rgba(201,168,76,.08)',
                      border:'1px solid rgba(201,168,76,.3)', color:'var(--gold2)',
                      borderRadius:8, cursor:'pointer' }}>📖 LIVRE CSS</button>
                  <button onClick={() => navigate('/quran/book3d')}
                    style={{ fontSize:9, letterSpacing:1.5, padding:'7px 16px',
                      fontFamily:"'Cinzel',serif", background:'rgba(201,168,76,.14)',
                      border:'1px solid rgba(201,168,76,.5)', color:'var(--gold)',
                      borderRadius:8, cursor:'pointer' }}>✨ LIVRE 3D WEBGL</button>
                </div>
              </div>
            ) : (
              <>
                {(() => {
                  const isSurahFullyLearned = ayats.length > 0 && ayats.every(a => getLData(selectedSurah.number, a.numberInSurah).learned);
                  const markAllLearned   = () => ayats.forEach(a => setLData(selectedSurah.number, a.numberInSurah, d => ({ ...d, learned: true })));
                  const unmarkAllLearned = () => ayats.forEach(a => setLData(selectedSurah.number, a.numberInSurah, d => ({ ...d, learned: false })));
                  return (
                <div className="surah-header">
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,flexWrap:'wrap'}}>
                    <div className="surah-header-ornament">{selectedSurah.name}</div>
                    {selectedSurah.number !== 9 && (
                      <div className="surah-header-bismillah" style={{fontFamily:"'Amiri Quran',serif",fontSize:18,color:'var(--gold)',direction:'rtl',opacity:.8,lineHeight:1.3}}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                    )}
                  </div>
                  <div className="surah-header-title">{selectedSurah.englishName.toUpperCase()} · <span style={{opacity:.6}}>{selectedSurah.englishNameTranslation?.toUpperCase()}</span> · {selectedSurah.numberOfAyahs} AYATS</div>

                  {/* Compact single-line toolbar: mastery · info toggle · learned toggle · go-to-ayat toggle */}
                  {(() => {
                    const st = surahStats[selectedSurah.number];
                    const total = selectedSurah.numberOfAyahs || 0;
                    const totalMasteryPct = total > 0 ? Math.round((st?.mastery || 0) / total) : 0;

                    const sn = selectedSurah.number;
                    const curPage = pageMode ? (activePageCoran ?? ayats[mainAyatIdx]?.page ?? null) : null;
                    const pageAyats = curPage ? ayats.filter(a => a.page === curPage) : ayats;
                    const totalParts = pageAyats.reduce((s, a) => s + (learnData[lkey(sn, a.numberInSurah)]?.parts?.length || 0), 0);
                    const totalUnk   = pageAyats.reduce((s, a) => s + (learnData[lkey(sn, a.numberInSurah)]?.unknownWords?.length || 0), 0);
                    const meta = pageMode && pageMeta ? pageMeta : surahMeta;
                    const pills = pageMode && curPage ? [
                      { label: 'PAGE',    val: curPage,              color: '#c878ff' },
                      { label: 'HIZB',    val: meta?.hizb    ?? '…', color: '#ffd166' },
                      { label: 'JUZ',     val: meta?.juz     ?? '…', color: '#a8edea' },
                      { label: 'AYATS',   val: meta?.ayatCount ?? pageAyats.length, color: 'var(--gold2)' },
                      { label: 'MOTS',    val: meta?.wordCount ?? '…', color: '#5bc8f5' },
                      { label: 'PARTIES', val: totalParts,            color: '#c878ff' },
                      { label: 'INCONNUS',val: totalUnk, color: totalUnk > 0 ? '#ff9f43' : 'var(--text3)' },
                    ] : [
                      { label: 'HIZB',    val: surahMeta?.hizb ?? '…', color: '#ffd166' },
                      { label: 'AYATS',   val: selectedSurah.numberOfAyahs, color: 'var(--gold2)' },
                      { label: 'MOTS',    val: surahMeta?.wordCount ?? '…', color: '#5bc8f5' },
                      { label: 'PARTIES', val: totalParts, color: '#c878ff' },
                      { label: 'INCONNUS',val: totalUnk,  color: totalUnk > 0 ? '#ff9f43' : 'var(--text3)' },
                    ];
                    const infoLabel = pageMode && curPage ? `PAGE ${curPage}` : `SOURATE`;

                    const pillBtnStyle = (active, activeColor='rgba(255,255,255,.2)') => ({
                      display:'flex', alignItems:'center', gap:4,
                      fontSize:8, letterSpacing:1, padding:'4px 10px', borderRadius:20,
                      fontFamily:"'Cinzel',serif", cursor:'pointer', whiteSpace:'nowrap',
                      background: active ? 'rgba(255,255,255,.06)' : 'transparent',
                      border:'1px solid ' + (active ? activeColor : 'rgba(255,255,255,.1)'),
                      color: active ? 'var(--text2)' : 'var(--text3)', transition:'all .2s',
                    });

                    return (
                      <>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:8,flexWrap:'wrap'}}>
                          {/* Mastery */}
                          <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 11px',borderRadius:20,
                            border:`1px solid ${masteryColor(totalMasteryPct)}`,background:'rgba(255,255,255,.03)'}}>
                            <span style={{fontSize:9}}>🎯</span>
                            <span style={{fontSize:11,fontWeight:700,fontFamily:"'Cinzel',serif",color:masteryColor(totalMasteryPct)}}>{totalMasteryPct}%</span>
                          </div>

                          {/* Info toggle (page/hizb/juz/mots/parties/inconnus pills) */}
                          <button onClick={() => setShowSurahInfo(v => !v)}
                            style={pillBtnStyle(showSurahInfo, 'rgba(255,255,255,.25)')}>
                            ℹ {infoLabel} {showSurahInfo ? '▲' : '▼'}
                          </button>

                          {/* Learned toggle */}
                          {ayats.length > 0 && (
                            <button onClick={isSurahFullyLearned ? unmarkAllLearned : markAllLearned}
                              title={isSurahFullyLearned ? "Sourate apprise — cliquer pour désactiver" : "Marquer toute la sourate comme apprise"}
                              style={pillBtnStyle(isSurahFullyLearned, 'var(--green)')}>
                              {isSurahFullyLearned
                                ? <span style={{color:'var(--green)'}}>✓ APPRISE</span>
                                : 'MARQUER APPRISE'}
                            </button>
                          )}

                          {/* Go-to-ayat toggle */}
                          {ayats.length > 0 && (
                            <button onClick={() => setShowAyatJump(v => !v)}
                              style={pillBtnStyle(showAyatJump, '#c878ff')}>
                              🔎 ALLER {showAyatJump ? '▲' : '▼'}
                            </button>
                          )}
                        </div>

                        {showSurahInfo && (
                          <div style={{display:'flex',flexWrap:'wrap',gap:6,justifyContent:'center',marginTop:8}}>
                            {pills.map(({ label: l, val, color }) => (
                              <div key={l} style={{
                                display:'flex',flexDirection:'column',alignItems:'center',
                                background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',
                                borderRadius:7,padding:'5px 12px',minWidth:52,
                              }}>
                                <div style={{fontSize:14,fontWeight:700,color,fontFamily:"'Cinzel',serif",lineHeight:1}}>{val}</div>
                                <div style={{fontSize:7,letterSpacing:1.5,color:'var(--text3)',marginTop:3}}>{l}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {showAyatJump && (
                          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:8}}>
                            <input type="number" min={1} max={selectedSurah.numberOfAyahs}
                              autoFocus
                              value={ayatSearchInput}
                              onChange={e => setAyatSearchInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { jumpToAyatNumber(ayatSearchInput); setAyatSearchInput(''); setShowAyatJump(false); } }}
                              placeholder="N°"
                              style={{width:56,textAlign:'center',background:'var(--surface3)',
                                border:'1px solid var(--border2)',borderRadius:6,padding:'4px 6px',
                                color:'var(--text)',fontSize:12,fontFamily:"'Cinzel',serif",outline:'none'}} />
                            <button onClick={() => { jumpToAyatNumber(ayatSearchInput); setAyatSearchInput(''); setShowAyatJump(false); }}
                              style={{fontSize:8,letterSpacing:1,padding:'5px 10px',fontFamily:"'Cinzel',serif",
                                background:'rgba(200,120,255,.08)',border:'1px solid #c878ff',color:'#c878ff',
                                borderRadius:6,cursor:'pointer'}}>
                              🔎 ALLER
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                  );
                })()}

                {(() => {
                  const anyTj = showQalqala||showMadd||showIzhar||showIdgham;
                  const anyOpt = announceNum||spellCheck||showParts||pageMode;
                  return (
                <div className="ts-global-bar">
                  <button onClick={() => setShowTsBar(!showTsBar)}
                    style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:"1px solid var(--border2)", borderRadius:"var(--radius-sm)", padding:"3px 10px", cursor:"pointer", flexShrink:0 }}>
                    <span className="ts-global-label">⚡ TS</span>
                    <span className="ts-global-count">{loadedCount}/{ayats.length}</span>
                    <span style={{ fontSize:8, color:"var(--text3)", marginLeft:2 }}>{showTsBar ? "▲" : "▼"}</span>
                  </button>
                  <div className="panel-row">
                  <button onClick={() => setShowTajweedPanel(v => !v)}
                    style={{ display:"flex", alignItems:"center", gap:5,
                      background: showTajweedPanel ? "rgba(255,255,255,.06)" : anyTj ? "rgba(91,200,245,.08)" : "transparent",
                      border: "1px solid " + (anyTj ? "#5bc8f5" : showTajweedPanel ? "rgba(255,255,255,.15)" : "var(--border2)"),
                      borderRadius:"var(--radius-sm)", padding:"3px 10px", cursor:"pointer", flexShrink:0,
                      color: anyTj ? "#5bc8f5" : "var(--text3)",
                      fontSize:9, letterSpacing:"1px", fontFamily:"Cinzel,serif", transition:"all .2s" }}>
                    تجويد <span style={{fontSize:7,marginLeft:2}}>{showTajweedPanel ? "▲" : "▼"}</span>
                  </button>
                  {showTajweedPanel && (
                    <div className="panel-expand" style={{ left:0, right:0, minWidth:0 }}>
                    <div className="tajweed-panel" style={{ flexWrap:'wrap', gap:6, padding:'8px 12px' }}>
                      {[
                        { toggle: toggleQalqala, on: showQalqala, label: "قلقلة", color: "#5bc8f5", bg: "rgba(91,200,245,.1)" },
                        { toggle: toggleMadd,    on: showMadd,    label: "مَدّ",   color: "#f09de0", bg: "rgba(240,157,224,.1)" },
                        { toggle: toggleIzhar,   on: showIzhar,   label: "إظهار", color: "#4caf81", bg: "rgba(76,175,129,.1)" },
                        { toggle: toggleIdgham,  on: showIdgham,  label: "إدغام", color: "#ffd166", bg: "rgba(255,209,102,.1)" },
                      ].map(({toggle,on,label,color,bg}) => (
                        <button key={label} onClick={toggle}
                          style={{ display:"flex", alignItems:"center", background: on ? bg : "transparent",
                            border: "1px solid " + (on ? color : "rgba(255,255,255,.1)"),
                            borderRadius:"var(--radius-sm)", padding:"3px 9px", cursor:"pointer", flexShrink:0,
                            color: on ? color : "var(--text3)", fontSize:10, fontFamily:"Cinzel,serif", transition:"all .2s" }}>
                          {label}
                        </button>
                      ))}
                    </div></div>
                  )}
                  </div>
                  <div className="panel-row">
                  <button onClick={() => setShowOptionsPanel(v => !v)}
                    style={{ display:"flex", alignItems:"center", gap:5,
                      background: showOptionsPanel ? "rgba(255,255,255,.06)" : anyOpt ? "rgba(201,168,76,.08)" : "transparent",
                      border: "1px solid " + (anyOpt ? "var(--gold)" : showOptionsPanel ? "rgba(255,255,255,.15)" : "var(--border2)"),
                      borderRadius:"var(--radius-sm)", padding:"3px 10px", cursor:"pointer", flexShrink:0,
                      color: anyOpt ? "var(--gold2)" : "var(--text3)",
                      fontSize:9, letterSpacing:"1px", fontFamily:"Cinzel,serif", transition:"all .2s" }}>
                    OPTIONS <span style={{fontSize:7,marginLeft:2}}>{showOptionsPanel ? "▲" : "▼"}</span>
                  </button>
                  {showOptionsPanel && (
                    <div className="panel-expand" style={{ left:0, right:0, minWidth:0 }}>
                    <div className="tajweed-panel" style={{ flexWrap:'wrap', gap:6, padding:'8px 12px' }}>
                      {[
                        { toggle: toggleAnnounceNum, on: announceNum, label: "🔢 N°",      color: "var(--teal2)",  bg: "rgba(62,184,160,.12)" },
                        { toggle: toggleSpellCheck,  on: spellCheck,  label: "✔ ORTHO",   color: "var(--gold2)",  bg: "rgba(201,168,76,.1)" },
                        { toggle: toggleShowParts,   on: showParts,   label: "✂ PARTIES", color: "var(--gold2)",  bg: "rgba(201,168,76,.1)" },
                        { toggle: () => { setPageMode(v=>!v); setactivePageCoran(null); }, on: pageMode, label: "📖 PAGE", color: "#c878ff", bg: "rgba(200,120,255,.12)" },
                        ...(pageMode ? [{ toggle: () => setAutoPageFollow(v=>!v), on: autoPageFollow, label: "⇄ SUIVI", color: "#c878ff", bg: "rgba(200,120,255,.12)" }] : []),
                      ].map(({toggle,on,label,color,bg}) => (
                        <button key={label} onClick={toggle}
                          style={{ display:"flex", alignItems:"center", background: on ? bg : "transparent",
                            border: "1px solid " + (on ? color : "rgba(255,255,255,.1)"),
                            borderRadius:"var(--radius-sm)", padding:"3px 9px", cursor:"pointer", flexShrink:0,
                            color: on ? color : "var(--text3)", fontSize:9, fontFamily:"Cinzel,serif", transition:"all .2s" }}>
                          {label}
                        </button>
                      ))}
                      <button onClick={()=>navigate('/quran/book')}
                        style={{display:"flex",alignItems:"center",background:"rgba(201,168,76,.07)",
                          border:"1px solid rgba(201,168,76,.28)",borderRadius:"var(--radius-sm)",
                          padding:"3px 9px",cursor:"pointer",flexShrink:0,
                          color:"var(--gold2)",fontSize:9,fontFamily:"Cinzel,serif"}}>📖 CSS</button>
                      <button onClick={()=>navigate('/quran/book3d')}
                        style={{display:"flex",alignItems:"center",background:"rgba(201,168,76,.13)",
                          border:"1px solid rgba(201,168,76,.45)",borderRadius:"var(--radius-sm)",
                          padding:"3px 9px",cursor:"pointer",flexShrink:0,
                          color:"var(--gold)",fontSize:9,fontFamily:"Cinzel,serif"}}>✨ 3D</button>
                    </div>
                    </div>
                  )}
                  </div>
                  {/* LANGUES button */}
                  <div style={{ position:"relative", flexShrink:0 }}>
                  <button onClick={() => setShowLangPanel(v => !v)}
                    style={{ display:"flex", alignItems:"center", gap:5,
                      background: showLangPanel ? "rgba(255,255,255,.06)" : translationLang ? "rgba(91,200,245,.08)" : "transparent",
                      border: "1px solid " + (translationLang ? "#5bc8f5" : showLangPanel ? "rgba(255,255,255,.15)" : "var(--border2)"),
                      borderRadius:"var(--radius-sm)", padding:"3px 10px", cursor:"pointer", flexShrink:0,
                      color: translationLang ? "#5bc8f5" : "var(--text3)",
                      fontSize:9, letterSpacing:"1px", fontFamily:"Cinzel,serif", transition:"all .2s" }}>
                    🌐 LANGUE <span style={{fontSize:7,marginLeft:2}}>{showLangPanel ? "▲" : "▼"}</span>
                  </button>
                  {showLangPanel && (
                    <div className="panel-expand" style={{ left:0, right:0, minWidth:0 }}>
                    <div className="tajweed-panel" style={{ flexWrap:'wrap', gap:6, padding:'8px 12px' }}>
                      {Object.entries(TRANS_LABELS).map(([lang, label]) => (
                        <button key={lang} onClick={() => setTranslationLang(t => t === lang ? null : lang)}
                          style={{ display:"flex", alignItems:"center", flexShrink:0,
                            background: translationLang === lang ? 'rgba(91,200,245,.12)' : 'transparent',
                            border:`1px solid ${translationLang === lang ? '#5bc8f5' : 'rgba(255,255,255,.08)'}`,
                            borderRadius:5, padding:'5px 12px', cursor:'pointer',
                            color: translationLang === lang ? '#5bc8f5' : 'var(--text3)',
                            fontSize:10, fontFamily:"Cinzel,serif", transition:'all .15s',
                            boxShadow: translationLang === lang ? '0 0 6px rgba(91,200,245,.2)' : 'none' }}>
                          {label}
                        </button>
                      ))}
                      {translationLang && (
                        <button onClick={() => setTranslationLang(null)}
                          style={{ fontSize:9, padding:'5px 10px', borderRadius:5, cursor:'pointer',
                            background:'rgba(229,115,115,.1)', border:'1px solid rgba(229,115,115,.3)',
                            color:'var(--red)', fontFamily:"Cinzel,serif" }}>✕ OFF</button>
                      )}
                    </div>
                    </div>
                  )}
                  </div>
                  {showTsBar && (
                    <>
                      <span style={{ fontSize:8, letterSpacing:1, color:'var(--text3)', fontFamily:"'Cinzel',serif", marginRight:4 }}>
                        {RECITATORS.find(r => r.id === recitatorId)?.flag} {RECITATORS.find(r => r.id === recitatorId)?.label?.toUpperCase()}
                      </span>
                      <div className="ts-progress-bar">
                        <div className="ts-progress-fill" style={{ width: `${ayats.length ? (loadedCount / ayats.length) * 100 : 0}%` }} />
                      </div>
                      <label className="ts-drop-zone">
                        <input type="file" accept=".json" multiple onChange={e => handleTimestampsFiles([...e.target.files])} />
                        <span className="ts-drop-label">📂 CHARGER JSON(S)</span>
                      </label>
                      {loadedCount > 0 && (
                        <button className="btn-small" style={{ color: "var(--red)", borderColor: "var(--red)" }}
                          title={`Effacer les timestamps de ${RECITATORS.find(r => r.id === recitatorId)?.label || recitatorId}`}
                          onClick={() => {
                            // Only clear this reciter's entries — other reciters keep theirs
                            const kept = {};
                            for (const [k, v] of Object.entries(timestampsMap)) {
                              if (!k.startsWith(`${recitatorId}:`)) kept[k] = v;
                            }
                            setTimestampsMap(kept);
                          }}>✕</button>
                      )}
                    </>
                  )}
                </div>); })()} 

                {/* ── Page mode navigator bar ── */}
                {pageMode && ayats && ayats.length > 0 && (() => {
                  const pages = [...new Set(ayats.map(a => a.page).filter(Boolean))].sort((a,b)=>a-b);
                  const curPage = activePageCoran ?? ayats[mainAyatIdx]?.page ?? pages[0];
                  const idx = pages.indexOf(curPage);
                  return (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'6px 14px', background:'var(--surface2)', borderBottom:'1px solid var(--border)',
                      position:'sticky', top:0, zIndex:10, gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <button onClick={() => setactivePageCoran(pages[0])} disabled={idx<=0}
                          title="Première page de la sourate"
                          style={{ fontSize:11, padding:'3px 7px', fontFamily:"'Cinzel',serif",
                            background:'transparent', border:'1px solid var(--border2)',
                            color: idx>0 ? 'var(--text2)' : 'var(--text3)', borderRadius:6,
                            cursor: idx>0 ? 'pointer' : 'default', lineHeight:1 }}>⏮</button>
                        <button onClick={() => setactivePageCoran(pages[idx-1])} disabled={idx<=0}
                          style={{ fontSize:8, letterSpacing:1, padding:'3px 10px', fontFamily:"'Cinzel',serif",
                            background:'transparent', border:'1px solid var(--border2)',
                            color: idx>0 ? 'var(--text2)' : 'var(--text3)', borderRadius:6,
                            cursor: idx>0 ? 'pointer' : 'default' }}>← {idx>0 ? pages[idx-1] : ''}</button>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:7, letterSpacing:2, color:'var(--text3)', fontFamily:"'Cinzel',serif" }}>PAGE</span>
                        <input type="number" value={curPage}
                          onChange={e => { const v=parseInt(e.target.value); if(pages.includes(v)) setactivePageCoran(v); }}
                          style={{ width:48, textAlign:'center', background:'var(--surface3)',
                            border:'1px solid #c878ff', borderRadius:6, padding:'3px 6px',
                            color:'#c878ff', fontSize:13, fontFamily:"'Cinzel',serif", outline:'none' }} />
                        <span style={{ fontSize:7, color:'var(--text3)' }}>/ {pages[pages.length-1]}</span>
                        {/* Page loop button */}
                        {(() => {
                          const pageAyats = ayats.filter(a => a.page === curPage);
                          const firstIdx  = pageAyats.length ? ayats.indexOf(pageAyats[0]) : -1;
                          const lastIdx   = pageAyats.length ? ayats.indexOf(pageAyats[pageAyats.length-1]) : -1;
                          const isPageLoop = loopActive && loopStart === firstIdx && loopEnd === lastIdx;
                          const togglePageLoop = () => {
                            if (isPageLoop) {
                              setLoopActive(false);
                            } else {
                              if (firstIdx < 0) return;
                              setLoopStart(firstIdx); setLoopEnd(lastIdx);
                              setLoopStartInput(pageAyats[0].numberInSurah);
                              setLoopEndInput(pageAyats[pageAyats.length-1].numberInSurah);
                              setLoopActive(true); setLoopCount(0);
                              playMainAyat(firstIdx);
                              setTimeout(() => mainAudioRef.current?.play(), 80);
                            }
                          };
                          return (
                            <button onClick={togglePageLoop} title={isPageLoop ? 'Arrêter boucle page' : 'Lire page en boucle'}
                              style={{ fontSize:12, padding:'2px 7px', borderRadius:6, cursor:'pointer', lineHeight:1,
                                background: isPageLoop ? 'rgba(200,120,255,.2)' : 'transparent',
                                border: `1px solid ${isPageLoop ? '#c878ff' : 'rgba(255,255,255,.15)'}`,
                                color: isPageLoop ? '#c878ff' : 'var(--text3)', transition:'all .2s' }}>
                              {isPageLoop ? '⏹' : '🔁'}
                            </button>
                          );
                        })()}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <button onClick={() => setactivePageCoran(pages[idx+1])} disabled={idx>=pages.length-1}
                          style={{ fontSize:8, letterSpacing:1, padding:'3px 10px', fontFamily:"'Cinzel',serif",
                            background:'transparent', border:'1px solid var(--border2)',
                            color: idx<pages.length-1 ? 'var(--text2)' : 'var(--text3)', borderRadius:6,
                            cursor: idx<pages.length-1 ? 'pointer' : 'default' }}>
                          {idx<pages.length-1 ? pages[idx+1] : ''} →</button>
                        <button onClick={() => setactivePageCoran(pages[pages.length-1])} disabled={idx>=pages.length-1}
                          title="Dernière page de la sourate"
                          style={{ fontSize:11, padding:'3px 7px', fontFamily:"'Cinzel',serif",
                            background:'transparent', border:'1px solid var(--border2)',
                            color: idx<pages.length-1 ? 'var(--text2)' : 'var(--text3)', borderRadius:6,
                            cursor: idx<pages.length-1 ? 'pointer' : 'default', lineHeight:1 }}>⏭</button>
                      </div>
                    </div>
                  );
                })()}

                <div className="ayat-scroll" onContextMenu={handleAyatContextMenu}>
                  <audio ref={partAudioRef} style={{ display: "none" }} onEnded={() => { setTimeout(() => { setPlayingPart(null); setPartCurrentMs(0); stopPartRaf(); }, 250); }} />
                  {loadingAyats
                    ? <div className="loading"><div className="loading-ring" /><span>CHARGEMENT</span></div>
                    : <>{tsVersion > -1 && (playStateVer >= 0) && (loopStateVer >= 0) && (() => {
                      const curPage = pageMode ? (activePageCoran ?? ayats[mainAyatIdx]?.page) : null;
                      const visible = curPage ? ayats.filter(a => a.page === curPage) : ayats.slice(0, renderLimit);
                      return visible.map(ayat => {
                      const ld        = getLData(selectedSurah.number, ayat.numberInSurah);
                      const isOpen    = openAyatNum === ayat.numberInSurah;
                      const isPlaying = playingAyatNum === ayat.numberInSurah && isMainPlaying;
                      const isCurrent = ayats[mainAyatIdx]?.numberInSurah === ayat.numberInSurah && !isPlaying;
                      const ts        = timestampsMap[tskey(selectedSurah.number, ayat.numberInSurah)];
                      const inLoop    = loopActive && ayat.numberInSurah >= loopStartNum && ayat.numberInSurah <= loopEndNum;
                      const isSelecting = partSelectAyat === ayat.numberInSurah;
                      const globalIdx = ayats.indexOf(ayat);
                      const prevAyat  = globalIdx > 0 ? ayats[globalIdx - 1] : null;
                      const nextAyat  = globalIdx >= 0 && globalIdx < ayats.length - 1 ? ayats[globalIdx + 1] : null;
                      const isPageStart = ayat.page != null && (!prevAyat || prevAyat.page !== ayat.page);
                      const isPageEnd   = ayat.page != null && (!nextAyat || nextAyat.page !== ayat.page);

                      const playPartInline = (part, loop = false) => {
                        if (!ts?.words || !part.wordIndices?.length) return;
                        const url = audioUrl(ayat);
                        if (!url) return;
                        const firstTs = ts.words[part.wordIndices[0]];
                        const lastTs  = ts.words[part.wordIndices[part.wordIndices.length - 1]];
                        if (!firstTs || !lastTs) return;
                        const startMs = firstTs.chars?.[0]?.start;
                        const endMs   = lastTs.chars?.[lastTs.chars.length - 1]?.end;
                        if (startMs == null || endMs == null) return;
                        const audio = partAudioRef.current;
                        if (!audio) return;
                        // Toggle stop if same part playing
                        if (playingPart?.ayatNum === ayat.numberInSurah && playingPart?.partId === part.id) {
                          audio.pause(); setPlayingPart(null); setPartCurrentMs(0); stopPartRaf(); return;
                        }
                        audio.src = url;
                        audio.currentTime = startMs / 1000;
                        audio.play().catch(() => {});
                        setPlayingPart({ ayatNum: ayat.numberInSurah, partId: part.id, loop });
                        startPartRaf();
                        const endSec = endMs / 1000;
                        const startSec = startMs / 1000;
                        const check = () => {
                          if (audio.currentTime >= endSec) {
                            if (loop && playingPart?.loop !== false) {
                              audio.currentTime = startSec;
                              audio.play().catch(() => {});
                            } else {
                              audio.pause();
                              setTimeout(() => { stopPartRaf(); setPlayingPart(null); setPartCurrentMs(0); audio.removeEventListener('timeupdate', check); }, 250);
                              audio.removeEventListener('timeupdate', check);
                            }
                          }
                        };
                        audio.addEventListener('timeupdate', check);
                      };

                      // Word→partIndex map for coloring
                      const PART_COLORS  = ["rgba(201,168,76,.22)","rgba(62,184,160,.18)","rgba(111,207,154,.18)","rgba(224,90,90,.15)","rgba(200,120,255,.15)"];
                      const PART_BORDERS = ["var(--gold)","var(--teal)","var(--green)","var(--red)","#c878ff"];
                      const wordPartMap  = {};
                      (ld.parts || []).forEach((p, pi) => p.wordIndices?.forEach(wi => { wordPartMap[wi] = pi; }));
                      const wordsInParts = new Set(Object.keys(wordPartMap).map(Number));
                      const nextAvail    = wordsInParts.size > 0 ? Math.max(...wordsInParts) + 1 : 0;
                      const ayatWords    = ayat.text ? ayat.text.split(" ").filter(Boolean) : [];

                      // Handle word click during inline selection
                      const handleInlineWordClick = (e, wi) => {
                        e.stopPropagation();
                        // Aide mémoire click modes
                        const aideMemoireClickMode = aideMemoireClickModes[ayat.numberInSurah]||null;
                        if (aideMemoireClickMode === 'highlight') {
                          e.stopPropagation();
                          const word = ayatWords[wi];
                          const prev = ld?.highlight?.trim() ? ld.highlight.trim().split(/\s+/) : [];
                          const normWord = normalizeAr(word);
                          const exists = prev.some(w => normalizeAr(w) === normWord);
                          const next = exists ? prev.filter(w => normalizeAr(w) !== normWord) : [...prev, word];
                          setLData(selectedSurah.number, ayat.numberInSurah, d => ({ ...d, highlight: next.join(' ') }));
                          return;
                        }
                        if (aideMemoireClickMode === 'unknown') {
                          e.stopPropagation();
                          const ayatWordsList = ayat.text ? ayat.text.split(' ').filter(Boolean) : [];
                          const rootClicked   = arabicRoot(ayatWordsList[wi] || '');
                          const prev = ld?.unknownWords || [];
                          const isRemoving = prev.includes(wi);
                          // add/remove ALL indices with the same root
                          const sameForm = ayatWordsList.reduce((acc, w, i) => { if (arabicRoot(w) === rootClicked) acc.push(i); return acc; }, []);
                          const next = isRemoving
                            ? prev.filter(x => !sameForm.includes(x))
                            : [...new Set([...prev, ...sameForm])];
                          setLData(selectedSurah.number, ayat.numberInSurah, d => ({ ...d, unknownWords: next }));
                          return;
                        }
                        if (!isSelecting) return;
                        if (partSelectStep === 'start') {
                          if (wi < nextAvail) return;
                          setPartSelectStart(wi);
                          setPartSelectStep('end');
                        } else if (partSelectStep === 'end') {
                          if (partSelectStart === null) return;
                          const from = Math.min(partSelectStart, wi);
                          const to   = Math.max(partSelectStart, wi);
                          const clampedFrom = Math.max(from, nextAvail);
                          const indices = []; for (let i = clampedFrom; i <= to; i++) indices.push(i);
                          if (indices.length === 0) return;
                          setLData(selectedSurah.number, ayat.numberInSurah, d => ({
                            ...d, parts: [...(d.parts || []), { id: Date.now(), wordIndices: indices, text: indices.map(i => ayatWords[i]).join(" "), learned: !!d.learned }]
                          }));
                          const newNext = to + 1;
                          if (newNext < ayatWords.length) {
                            setPartSelectStart(null);
                            setPartSelectStep('start');
                          } else {
                            setPartSelectAyat(null); setPartSelectStep(null); setPartSelectStart(null);
                          }
                        }
                      };

                      // Render the Arabic text — either TS-highlighted, inline-selectable, or plain
                      // _tsForAyat: basmala already stripped at parse time — pass ts directly
                      const renderAyatText = () => {
                        if (isPlaying && ts && enableLetterByLetter) return <PlayingArabicHighlighted text={ayat.text} timestamps={ts} mode="main" showQalqala={showQalqala} showMadd={showMadd} showIzhar={showIzhar} showIdgham={showIdgham} />;
                        if (playingPart?.ayatNum === ayat.numberInSurah && ts && enableLetterByLetter)
                          return <PlayingArabicHighlighted text={ayat.text} timestamps={ts} mode="part" playingPart={playingPart} ld={ld} showQalqala={showQalqala} showMadd={showMadd} showIzhar={showIzhar} showIdgham={showIdgham} />;
                        if (localPlaying?.ayatNum === ayat.numberInSurah && ts && enableLetterByLetter)
                          return <PlayingArabicHighlighted text={ayat.text} timestamps={ts} mode="local" showQalqala={showQalqala} showMadd={showMadd} showIzhar={showIzhar} showIdgham={showIdgham} />;

                        // Revise highlighting — declared early to avoid TDZ with showPartColors
                        const _reviseData = ld?.toRevise;
                        const revWordSet  = _reviseData && typeof _reviseData === 'object' ? new Set(_reviseData.words || []) : (_reviseData === true ? 'all' : null);
                        const revChars    = _reviseData && typeof _reviseData === 'object' ? (_reviseData.chars || {}) : {};

                        const aideMemoireClickMode = aideMemoireClickModes[ayat.numberInSurah]||null;
                        const showWordButtons = isSelecting || aideMemoireClickMode !== null;
                        const showPartColors  = !isSelecting && showParts && Object.keys(wordPartMap).length > 0;

                        // When timestamps loaded and not in word-select/aide-memoire mode: use ArabicHighlighted for tajweed coloring
                        if (ts && enableTimestamps && !showWordButtons && !showPartColors) {
                          return <ArabicHighlighted text={ayat.text} timestamps={ts} currentMs={-1} showQalqala={showQalqala} showMadd={showMadd} showIzhar={showIzhar} showIdgham={showIdgham} />;
                        }

                        if (showWordButtons) {
                          return (
                            <div className="ayat-arabic" style={{ cursor: aideMemoireClickMode ? "pointer" : "default" }}>
                              {ayatWords.map((w, wi) => {
                                // Aide mémoire display
                                const aideMemoireClickMode = aideMemoireClickModes[ayat.numberInSurah]||null;
                        if (aideMemoireClickMode === 'highlight') {
                                  const normW = normalizeAr(w);
                                  const isHl = ld?.highlight?.trim()?.split(/\s+/).some(hw => normalizeAr(hw) === normW);
                                  return (
                                    <span key={wi} onClick={e => handleInlineWordClick(e, wi)} style={{
                                      display:'inline-block', cursor:'pointer', padding:'1px 4px', margin:'1px',
                                      borderRadius:5, transition:'all .15s', userSelect:'none',
                                      background: isHl ? 'rgba(255,209,102,.2)' : 'transparent',
                                      border: `1px solid ${isHl ? 'var(--gold)' : 'transparent'}`,
                                      color: isHl ? '#ffd166' : undefined,
                                      textShadow: isHl ? '0 0 8px rgba(255,209,102,.5)' : 'none',
                                    }}>{w}{wi < ayatWords.length-1 ? ' ' : ''}</span>
                                  );
                                }
                                if (aideMemoireClickMode === 'unknown') {
                                  const isUnk = (ld?.unknownWords||[]).includes(wi);
                                  return (
                                    <span key={wi} onClick={e => handleInlineWordClick(e, wi)} style={{
                                      display:'inline-block', cursor:'pointer', padding:'1px 4px', margin:'1px',
                                      borderRadius:5, transition:'all .15s', userSelect:'none',
                                      background: isUnk ? 'rgba(255,126,179,.18)' : 'transparent',
                                      border: `1px solid ${isUnk ? '#ff7eb3' : 'transparent'}`,
                                      color: isUnk ? '#ff7eb3' : undefined,
                                      textDecoration: isUnk ? 'underline dotted #ff7eb3' : 'none',
                                    }}>{w}{wi < ayatWords.length-1 ? ' ' : ''}</span>
                                  );
                                }
                                const inExistingPart = wordsInParts.has(wi);
                                const pi             = wordPartMap[wi];
                                const isLearned      = pi !== undefined && (ld.parts || [])[pi]?.learned;
                                const isPast         = wi < nextAvail;
                                const isStart        = partSelectStep === 'end' && wi === partSelectStart;
                                const isInPreview    = partSelectStep === 'end' && partSelectStart !== null && wi >= Math.min(partSelectStart, wi) && wi >= nextAvail && wi <= Math.max(partSelectStart, wi);
                                // preview: between startIdx and current (we can't hover in React without extra state,
                                // so we just highlight the chosen start word)
                                let bg = "transparent", border = "var(--border)", color = "var(--text2)", cursor = "pointer";
                                if (isPast || inExistingPart) {
                                  bg = isLearned ? "rgba(76,175,129,.15)" : PART_COLORS[pi % PART_COLORS.length] ?? "rgba(62,184,160,.1)";
                                  border = isLearned ? "var(--green)" : PART_BORDERS[pi % PART_BORDERS.length] ?? "var(--teal)";
                                  color  = "var(--text2)"; cursor = "default";
                                } else if (isStart) {
                                  bg = "rgba(201,168,76,.25)"; border = "var(--gold2)"; color = "var(--gold2)";
                                } else if (partSelectStep === 'start') {
                                  bg = "rgba(201,168,76,.04)"; border = "rgba(201,168,76,.5)"; color = "var(--gold)";
                                } else if (partSelectStep === 'end') {
                                  bg = "rgba(62,184,160,.05)"; border = "rgba(62,184,160,.5)"; color = "var(--teal2)";
                                }
                                return (
                                  <span key={wi} onClick={e => handleInlineWordClick(e, wi)} style={{
                                    display: "inline-block", margin: "2px 3px", padding: "2px 5px",
                                    borderRadius: 5, border: `1px solid ${border}`,
                                    background: bg, color, cursor,
                                    transition: "all .12s",
                                    fontFamily: "'Amiri Quran',serif",
                                  }}>{w}</span>
                                );
                              })}
                            </div>
                          );
                        }

                        if (showPartColors) {
                          // pre-compute annotation indices
                          const _hlSet  = (() => { const s=new Set(); if (!ld.highlight?.trim()) return s; ld.highlight.trim().split(/\s+/).forEach(hw => { const n=normalizeAr(hw); ayatWords.forEach((aw,i)=>{ if(normalizeAr(aw)===n) s.add(i); }); }); return s; })();
                          const _unkSet = new Set(ld?.unknownWords||[]);
                          // Group consecutive words by part (segment) — one unified bubble per part
                          const segments2 = [];
                          let seg2 = null;
                          ayatWords.forEach((w, wi) => {
                            const pi = wordPartMap[wi];
                            if (seg2 && seg2.pi === pi) { seg2.words.push({ w, wi }); }
                            else { seg2 = { pi, words: [{ w, wi }] }; segments2.push(seg2); }
                          });
                          return (
                            <div className="ayat-arabic">
                              {segments2.map((seg, si) => {
                                const pi        = seg.pi;
                                const hasPart   = pi !== undefined;
                                const part      = hasPart ? (ld.parts||[])[pi] : null;
                                const isLearned = part?.learned;
                                const isPlaying = hasPart && playingPart?.ayatNum===ayat.numberInSurah && playingPart?.partId===part?.id;
                                const canPlay   = hasPart && !!ts?.words;
                                const segBg     = hasPart ? (isPlaying ? "rgba(62,184,160,.28)" : isLearned ? "rgba(76,175,129,.18)" : PART_COLORS[pi%PART_COLORS.length]) : "transparent";
                                const segBorder = hasPart ? `1px solid ${isPlaying ? "var(--teal2)" : isLearned ? "var(--green)" : PART_BORDERS[pi%PART_BORDERS.length]}` : "none";
                                return (
                                  <span key={si}
                                    onClick={e=>{ e.stopPropagation(); if(canPlay) playPartInline(part,false); }}
                                    title={canPlay ? (isPlaying?"Stopper":"Lire cette partie") : undefined}
                                    style={{
                                      display:"inline-block",
                                      background:segBg, border:segBorder,
                                      borderRadius:6, padding:"1px 7px", margin:"2px 2px",
                                      cursor:canPlay?"pointer":"default",
                                      transition:"all .15s",
                                    }}>
                                    {seg.words.map(({w,wi},wii) => {
                                      const isUnk = _unkSet.has(wi);
                                      const isHl  = _hlSet.has(wi);
                                      const isRevW = revWordSet === 'all' || (revWordSet && revWordSet.has(wi));
                                      const wRevChars = isRevW ? revChars[wi] : null;
                                      const wColor  = isUnk?"#ff7eb3":isHl?"#ffd166":isRevW?"var(--gold2)":undefined;
                                      const wShadow = isUnk?"0 0 8px rgba(255,126,179,.5)":isHl?"0 0 8px rgba(255,209,102,.6)":isRevW?"0 0 6px rgba(201,168,76,.4)":"none";
                                      const wDecor  = isUnk?"underline dotted #ff7eb3":isRevW&&!wRevChars?.length?"underline wavy var(--gold)":"none";
                                      const wBg     = isUnk?"rgba(255,126,179,.15)":isHl?"rgba(255,209,102,.12)":isRevW&&!wRevChars?.length?"rgba(201,168,76,.2)":"transparent";
                                      const renderCh = (ch,ci,arr2) => {
                                        if(isUnk||isHl) return <span key={ci}>{ch}</span>;
                                        const q  = showQalqala && isQalqala(arr2,ci);
                                        const mt = showMadd ? getMaddType(arr2,ci) : null;
                                        const iz = showIzhar && isIzhar(arr2,ci);
                                        const id = showIdgham && isIdgham(arr2,ci);
                                        return q               ? <span key={ci} style={{color:"#5bc8f5",textShadow:"0 0 6px rgba(91,200,245,.5)"}}>{ch}</span>
                                             : mt==="muttasil" ? <span key={ci} style={{color:"#ff7eb3",textShadow:"0 0 8px rgba(255,126,179,.6)",fontWeight:600}}>{ch}</span>
                                             : mt==="normal"   ? <span key={ci} style={{color:"#f09de0",textShadow:"0 0 6px rgba(240,157,224,.5)"}}>{ch}</span>
                                             : iz              ? <span key={ci} style={{color:"#4caf81",textShadow:"0 0 6px rgba(76,175,129,.5)"}}>{ch}</span>
                                             : id              ? <span key={ci} style={{color:"#ffd166",textShadow:"0 0 6px rgba(255,209,102,.5)"}}>{ch}</span>
                                             : <span key={ci}>{ch}</span>;
                                      };
                                      return (
                                        <span key={wii} style={{
                                          color:wColor, textShadow:wShadow,
                                          textDecoration:wDecor,
                                          background: wBg,
                                          borderRadius: (isUnk||isHl||isRevW)?3:0,
                                          padding: (isUnk||isHl||isRevW)?"0 1px":0,
                                          borderBottom: isRevW&&!wRevChars?.length ? '2px solid rgba(201,168,76,.5)' : 'none',
                                        }}>
                                          {(showQalqala||showMadd||showIzhar||showIdgham)
                                            ? (() => { const arr2=[...w]; return arr2.map((ch,ci)=>renderCh(ch,ci,arr2)); })()
                                            : w}
                                          {wii < seg.words.length-1 ? " " : ""}
                                        </span>
                                      );
                                    })}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        }

                        // Build highlight index set from ld.highlight
                        const hlIndices  = (() => {
                          const set = new Set();
                          if (!ld.highlight?.trim()) return set;
                          ld.highlight.trim().split(/\s+/).forEach(hw => {
                            const norm = normalizeAr(hw);
                            ayatWords.forEach((aw, i) => { if (normalizeAr(aw) === norm) set.add(i); });
                          });
                          return set;
                        })();
                        const unkIndices = new Set(ld?.unknownWords || []);
                        const hasRevise  = !!_reviseData;
                        const hasAnnotations = (ld.highlight?.trim() && hlIndices.size > 0) || unkIndices.size > 0 || hasRevise;

                        if (hasAnnotations) {
                          return (
                            <div className="ayat-arabic">
                              {ayatWords.map((w, wi) => {
                                const hit = hlIndices.has(wi);
                                const unk = unkIndices.has(wi);
                                const isRevWord = revWordSet === 'all' || (revWordSet && revWordSet.has(wi));
                                const wordChars = isRevWord ? revChars[wi] : null; // selected char indices
                                const clusters  = isRevWord ? splitArabicClusters(w) : null;

                                const baseStyle = {
                                  color: unk ? '#ff7eb3' : hit ? '#ffd166' : isRevWord ? 'var(--text1)' : undefined,
                                  textShadow: unk ? '0 0 8px rgba(255,126,179,.5)' : hit ? '0 0 8px rgba(255,209,102,.6)' : 'none',
                                  background: unk ? 'rgba(255,126,179,.12)' : hit ? 'rgba(255,209,102,.13)' : isRevWord && !wordChars?.length ? 'rgba(201,168,76,.12)' : 'transparent',
                                  textDecoration: unk ? 'underline dotted #ff7eb3' : isRevWord && !wordChars?.length ? 'underline wavy var(--gold)' : 'none',
                                  borderRadius: (hit||unk||isRevWord) ? 4 : 0,
                                  padding: (hit||unk||isRevWord) ? '0 2px' : 0,
                                  border: isRevWord && !wordChars?.length ? '1px solid rgba(201,168,76,.35)' : 'none',
                                  display: 'inline',
                                };

                                if (isRevWord && wordChars?.length && clusters) {
                                  // Highlight whole word (Arabic shaping can't split mid-ligature)
                                  // show char selection as badge count
                                  return (
                                    <span key={wi} style={{
                                      display:'inline', padding:'0 2px',
                                      background:'rgba(91,200,245,.15)',
                                      borderBottom:'2px solid #5bc8f5',
                                      borderRadius:3,
                                      color:'#5bc8f5',
                                      textShadow:'0 0 6px rgba(91,200,245,.5)',
                                      position:'relative',
                                    }}>
                                      {w}
                                      <sup style={{ fontSize:'0.4em', color:'#5bc8f5', marginRight:1, verticalAlign:'super' }}>{wordChars.length}</sup>
                                      {wi < ayatWords.length - 1 ? ' ' : ''}
                                    </span>
                                  );
                                }

                                return (
                                  <span key={wi} style={baseStyle}>
                                    {w}{wi < ayatWords.length - 1 ? ' ' : ''}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        }

                        return (
                          <div className="ayat-arabic">
                            {(showQalqala || showMadd)
                              ? (() => { const arr = [...ayat.text]; return arr.map((ch, i) => {
                                  const q = showQalqala && isQalqala(arr, i);
                                  const mt = showMadd ? getMaddType(arr, i) : null;
                                  const iz = showIzhar && isIzhar(arr, i);
                                  const id = showIdgham && isIdgham(arr, i);
                                  return q ? <span key={i} style={{color:'#5bc8f5',textShadow:'0 0 6px rgba(91,200,245,.5)'}}>{ch}</span>
                                       : mt==='muttasil' ? <span key={i} style={{color:'#ff7eb3',textShadow:'0 0 8px rgba(255,126,179,.6)',fontWeight:600}}>{ch}</span>
                                       : mt==='normal'   ? <span key={i} style={{color:'#f09de0',textShadow:'0 0 6px rgba(240,157,224,.5)'}}>{ch}</span>
                                       : iz              ? <span key={i} style={{color:'#4caf81',textShadow:'0 0 6px rgba(76,175,129,.5)'}}>{ch}</span>
                                       : id              ? <span key={i} style={{color:'#ffd166',textShadow:'0 0 6px rgba(255,209,102,.5)'}}>{ch}</span>
                                       : <span key={i}>{ch}</span>;
                                }); })()
                              : ayat.text}
                          </div>
                        );
                      };

                      return (
                        <div key={ayat.number}
                          className={`ayat-row${isPlaying ? " playing" : ""}${isCurrent ? " current" : ""}${ld.learned ? " learned" : ""}${isSelecting ? " selecting" : ""}${isPageStart ? " page-start" : ""}${isPageEnd ? " page-end" : ""}`}
                          style={inLoop && !isPlaying && !isSelecting ? { borderLeft: "2px solid var(--teal)", background: "rgba(62,184,160,0.04)" } : isSelecting ? { borderLeft: "2px solid var(--gold)", background: "rgba(201,168,76,0.04)" } : {}}
                          ref={el => ayatRefs.current[ayat.numberInSurah] = el}>

                          {isPageStart && <div className="page-edge-pill start">◆ PAGE {ayat.page}</div>}

                          {/* Selection hint bar shown above the ayat when selecting */}
                          {isSelecting && (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 22px 2px", background: "rgba(201,168,76,.05)" }}>
                              <span style={{ fontSize: 9, letterSpacing: 1.5, color: partSelectStep === 'start' ? "var(--gold2)" : "var(--teal2)", fontFamily: "'Cinzel',serif" }}>
                                {partSelectStep === 'start' ? "① CLIQUEZ LE PREMIER MOT" : `② CLIQUEZ LE DERNIER MOT — début : `}
                                {partSelectStep === 'end' && partSelectStart !== null && (
                                  <span style={{ fontFamily: "'Amiri Quran',serif", fontSize: 15, color: "var(--gold2)", marginRight: 4 }}>{ayatWords[partSelectStart]}</span>
                                )}
                              </span>
                              <button onClick={e => { e.stopPropagation(); setPartSelectAyat(null); setPartSelectStep(null); setPartSelectStart(null); }}
                                style={{ marginLeft: "auto", fontSize: 9, letterSpacing: 1, padding: "3px 8px", border: "1px solid var(--border2)", background: "transparent", color: "var(--text3)", cursor: "pointer", borderRadius: 4, fontFamily: "'Cinzel',serif" }}>
                                ANNULER
                              </button>
                            </div>
                          )}

                          <div className={`ayat-main${isPlaying ? " ayat-playing" : ""}`}
                            onClick={() => {
                              if (isSelecting) return; // don't open/close while selecting
                              setOpenAyatNum(isOpen ? null : ayat.numberInSurah);
                              if (isOpen) setAideMemoireClickModes(prev => { const n={...prev}; delete n[ayat.numberInSurah]; return n; });
                              if (!isOpen) setSubmenuMode("lecture");
                            }}>
                            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, flexShrink:0 }}>
                              <div className="ayat-number-badge"
                                title="Ouvrir le verset"
                                style={{cursor:'pointer'}}
                              >{ayat.numberInSurah}</div>
                              <button
                                title="Lire depuis ce verset"
                                onClick={e => {
                                  e.stopPropagation();
                                  const idx = ayats.findIndex(a => a.numberInSurah === ayat.numberInSurah);
                                  if (idx >= 0) { playMainAyat(idx); setIsMainPlaying(true); }
                                }}
                                style={{
                                  width:22, height:22, borderRadius:"50%", border:"none",
                                  background: isPlaying ? "var(--teal)" : "rgba(62,184,160,.15)",
                                  color: isPlaying ? "#fff" : "var(--teal2)",
                                  fontSize:9, cursor:"pointer", display:"flex", alignItems:"center",
                                  justifyContent:"center", flexShrink:0, transition:"all .15s",
                                  outline: isPlaying ? "2px solid var(--teal)" : "none",
                                  outlineOffset:2,
                                }}>▶</button>
                            </div>
                            {renderAyatText()}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                              {ld.learned && <div className="ayat-learned-badge">✓ APPRIS</div>}
                              {ld.toRevise && <div style={{ fontSize:7, letterSpacing:1, padding:'2px 6px', borderRadius:8, border:'1px solid var(--gold)', color:'var(--gold2)', fontFamily:"'Cinzel',serif" }}>🔖 RÉVISER</div>}
                              {(() => { const m = masteryMap[lkey(selectedSurah.number, ayat.numberInSurah)] ?? 0; return m > 0 ? <div style={{ fontSize:8, letterSpacing:1, padding:'2px 7px', borderRadius:10, border:'1px solid '+masteryColor(m), color:masteryColor(m), fontFamily:"'Cinzel',serif" }}>{m}%</div> : null; })()}
                              {ts && <div className="ts-status loaded">⚡ TS</div>}
                            </div>
                          </div>

                          {/* Translation — full-width block below Arabic */}
                          {translationLang && (() => {
                            const key = `${translationLang}:${selectedSurah.number}`;
                            const tList = translations[key];
                            const tText = tList?.find(t => t.numberInSurah === ayat.numberInSurah)?.text;
                            return tText ? (
                              <div style={{
                                padding: '4px 14px 8px 54px',
                                borderTop: '1px solid rgba(91,200,245,.08)',
                                background: 'rgba(91,200,245,.03)',
                                direction: translationLang === 'ur' ? 'rtl' : 'ltr',
                              }}>
                                <div style={{
                                  fontSize: 11,
                                  color: 'rgba(91,200,245,.6)',
                                  fontStyle: 'italic',
                                  lineHeight: 1.65,
                                  letterSpacing: .2,
                                }}>
                                  {tText}
                                </div>
                              </div>
                            ) : null;
                          })()}

                          <AnimatedSubmenu isOpen={isOpen}>
                            <Submenu
                              ayat={ayat} surahNum={selectedSurah.number}
                              ld={ld} setLData={setLData}
                              submenuMode={submenuMode} setSubmenuMode={setSubmenuMode}
                              audioUrl={audioUrl(ayat)}
                              isMainPlaying={isMainPlaying}
                              timestamps={ts}
                              partSelectAyat={partSelectAyat} partSelectStep={partSelectStep}
                              onStartPartCreate={() => {
                                setPartSelectAyat(ayat.numberInSurah);
                                setPartSelectStep('start');
                                setPartSelectStart(null);
                              }}
                              collections={collections}
                              ayatInCollections={ayatInCollections(selectedSurah.number, ayat.numberInSurah)}
                              onOpenCollModal={() => setCollModal({ surahNum: selectedSurah.number, surahEn: selectedSurah.englishName, ayatNum: ayat.numberInSurah, text: ayat.text, number: ayat.number })}
                              onLoadTimestamps={data => {
                                const parsed = parseTimestampsFile(data, selectedSurah.number, recitatorId);
                                if (Object.keys(parsed).length === 0 && data.words)
                                  setTimestampsMap({ ...timestampsMap, [tskey(selectedSurah.number, ayat.numberInSurah)]: { words: data.words } });
                                else setTimestampsMap({ ...timestampsMap, ...parsed });
                              }}
                              onUpdateTimestamps={data => {
                                setTimestampsMap({ ...timestampsMap, [tskey(selectedSurah.number, ayat.numberInSurah)]: data });
                              }}
                              onLocalPlay={(ms) => setLocalPlaying(ms != null ? { ayatNum: ayat.numberInSurah, currentMs: ms } : null)}
                              aideMemoireClickMode={aideMemoireClickModes[ayat.numberInSurah]||null}
                              setAideMemoireClickMode={(m)=>setAideMemoireClickModes(prev=>({...prev,[ayat.numberInSurah]:m}))}
                              spellCheck={spellCheck}
                              ayatLoopActive={loopActive && loopStartNum === ayat.numberInSurah && loopEndNum === ayat.numberInSurah}
                              onSetLoop={() => {
                                const idx = ayats.findIndex(a => a.numberInSurah === ayat.numberInSurah);
                                if (idx === -1) return;
                                setLoopStart(idx); setLoopEnd(idx);
                                setLoopStartInput(ayat.numberInSurah); setLoopEndInput(ayat.numberInSurah);
                                setLoopActive(true);
                              }}
                            />
                          </AnimatedSubmenu>
                          {isPageEnd && <div className="page-edge-pill end">FIN · PAGE {ayat.page} ◆</div>}
                        </div>
                      );
                    }); })()}</>}
                </div>
              </>
            )}
          </main></AnimatedPage>
            )} />
            <Route path="*" element={<Navigate to="/quran" replace />} />
          </Routes>
        </div>

        {/* CONTEXT MENU — apparaît sur clic droit / appui long avec une sélection de texte dans un ayat */}
        {selMenu && (
          <>
            <div onClick={() => setSelMenu(null)} onContextMenu={e => { e.preventDefault(); setSelMenu(null); }}
              style={{ position:"fixed", inset:0, zIndex:998 }} />
            <div style={{
              position:"fixed", top:selMenu.y, left:selMenu.x, zIndex:999,
              background:"var(--surface2)", border:"1px solid #c878ff", borderRadius:8,
              boxShadow:"0 6px 20px rgba(0,0,0,.4)", overflow:"hidden", minWidth:200,
              transform:"translate(4px,4px)",
            }}>
              <button onClick={searchSelectionInCollections} style={{
                display:"flex", alignItems:"center", gap:8, width:"100%", padding:"10px 14px",
                background:"transparent", border:"none", color:"var(--text)", fontSize:11,
                letterSpacing:.5, cursor:"pointer", textAlign:"left",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(200,120,255,.12)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                🔍 Rechercher la sélection
              </button>
              <div style={{ padding:"0 14px 8px", fontSize:9, color:"var(--text3)",
                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:260, direction:"rtl" }}>
                {selMenu.text}
              </div>
            </div>
          </>
        )}

        {/* COLLECTION MODAL */}
        {showOptionsModal && <OptionsModal onClose={() => setShowOptionsModal(false)} />}
        {collModal && (
          <CollectionModal
            ayat={collModal}
            collections={collections}
            onToggle={toggleAyatInCollection}
            onCreateAndAdd={(name) => {
              dispatch(collectionsActions.createCollectionWithAyat({ name, ayatEntry: collModal }));
            }}
            onClose={() => setCollModal(null)}
          />
        )}

        {/* RAPPEL WIDGET GLOBAL */}
        <div style={{ display: showRappel ? 'block' : 'none' }}>
          <RappelWidget onClose={() => setShowRappel(false)} />
        </div>

        {/* AUDIO PERSISTANTS — toujours montés pour ne jamais interrompre la lecture en changeant de page */}
        <audio ref={silentAudioRef} src={SILENT_WAV} loop style={{ display:"none" }} />
        <audio
          ref={el => {
            mainAudioRef.current = el;
            if (el) el._ayatNum = currentMainAyat?.numberInSurah;
          }}
          src={audioUrl(currentMainAyat)}
          onEnded={handleMainEnded}
          onError={() => {
            // Current bitrate 404s for this reciter → fall back to the next candidate
            // automatically (and remember it), then retry without interrupting playback.
            const next = markBitrateBad(recitatorId);
            if (next != null) {
              setBitrateVersion(v => v + 1);
              loadedAyatIdxRef.current = null;
              // wait one frame so React commits the new `src` (now built from the updated
              // bitrate) before forcing the element to actually load it
              requestAnimationFrame(() => {
                const a = mainAudioRef.current;
                if (!a) return;
                a.load();
                loadedAyatIdxRef.current = mainAyatIdx;
                if (isMainPlaying) playWhenReady();
              });
            }
          }}
          style={{ display: "none" }}
        />

        {/* MAIN PLAYER */}
        {selectedSurah && ayats.length > 0 && (
          <div className="main-player">

            <div className="player-row">
              <div className="player-info">
                <div className="player-surah">{selectedSurah.englishName.toUpperCase()}</div>
                <div className="player-ayah">
                  AYAT {currentMainAyat?.numberInSurah || 1} / {ayats.length}
                  {loopActive && <span style={{ color: "var(--teal)", marginLeft: 8 }}>
                    ↺ {loopStartNum}–{loopEndNum}
                    {loopMax > 0 && <span style={{ color: "var(--text3)" }}> · {loopCount + 1}/{loopMax}</span>}
                  </span>}
                </div>
              </div>

              <div className="player-controls">
                <button className="ctrl-btn" title="Premier verset" onClick={() => {
                  playMainAyat(loopActive ? loopStart : 0); if (isMainPlaying) setTimeout(() => mainAudioRef.current?.play(), 100);
                }} style={{ fontSize: 11 }}>⏮</button>
                <button className="ctrl-btn" onClick={() => {
                  const i = Math.max(loopActive ? loopStart : 0, mainAyatIdx - 1);
                  playMainAyat(i); if (isMainPlaying) setTimeout(() => mainAudioRef.current?.play(), 100);
                }}>◀</button>
                <button className="ctrl-btn play-btn" onClick={() => {
                  if (!isMainPlaying) { playMainAyat(loopActive ? loopStart : mainAyatIdx); setIsMainPlaying(true); }
                  else { setIsMainPlaying(false); setPlayingAyatNum(null); mainAudioRef.current?.pause(); }
                }}>{isMainPlaying ? "⏸" : "▶"}</button>
                <button className="ctrl-btn" onClick={() => {
                  const i = Math.min(loopActive ? loopEnd : ayats.length - 1, mainAyatIdx + 1);
                  playMainAyat(i); if (isMainPlaying) setTimeout(() => mainAudioRef.current?.play(), 100);
                }}>▶</button>
                <button
                  className={`ctrl-btn${loopActive ? " loop-on" : ""}`}
                  title="Activer/désactiver la boucle"
                  onClick={() => { setLoopActive(!loopActive); if (!loopActive) setLoopCount(0); }}
                  style={{ fontSize: 12 }}>↺</button>
                <button
                  className={`ctrl-btn${showLoopBar ? " loop-on" : ""}`}
                  title="Configurer le range de boucle"
                  onClick={() => setShowLoopBar(!showLoopBar)}
                  style={{ fontSize: 11 }}>⚙</button>
                {/* Voice mic shortcut */}
                <button
                  className={`ctrl-btn${listening ? " loop-on" : ""}`}
                  title="Commande vocale"
                  onClick={toggleVoice}
                  style={{ fontSize: 14 }}>🎤</button>
                {/* Reciter picker */}
                <button
                  className={`ctrl-btn reciter-trigger${showRecitPanel ? " loop-on" : ""}`}
                  aria-haspopup="dialog"
                  aria-expanded={showRecitPanel}
                  aria-label={`Choisir le récitateur. Actuel : ${activeRecitator?.label || recitatorId}`}
                  title={`Récitateur : ${activeRecitator?.label || recitatorId}`}
                  onClick={() => { setRecitatorSearch(""); setShowRecitPanel(v => !v); }}>
                  <span>{activeRecitator?.flag || '🎙️'}</span>
                  <span className="reciter-trigger-label">{activeRecitator?.label || 'Récitateur'}</span>
                </button>
              </div>

              {showRecitPanel && createPortal(
                <>
                  <div className="reciter-sheet-backdrop" onClick={() => setShowRecitPanel(false)} aria-hidden="true" />
                  <section className="reciter-sheet" role="dialog" aria-modal="true" aria-labelledby="reciter-sheet-title">
                    <div className="reciter-sheet-header">
                      <div style={{ minWidth:0 }}>
                        <div id="reciter-sheet-title" className="reciter-sheet-title">CHOISIR UN RÉCITATEUR</div>
                        <div className="reciter-sheet-current">Actuel · {activeRecitator?.label || recitatorId}</div>
                      </div>
                      <button className="reciter-sheet-close" onClick={() => setShowRecitPanel(false)} aria-label="Fermer le choix du récitateur">×</button>
                    </div>
                    <input className="reciter-search" type="search" autoFocus value={recitatorSearch}
                      onChange={e => setRecitatorSearch(e.target.value)} placeholder="Rechercher un récitateur" aria-label="Rechercher un récitateur" />
                    <div className="reciter-list">
                      {visibleRecitators.map(r => (
                        <button key={r.id} className={`reciter-option${r.id === recitatorId ? ' selected' : ''}`} onClick={() => {
                          const changed = r.id !== recitatorId;
                          setRecitatorId(r.id);
                          setShowRecitPanel(false);
                          if (changed && mainAudioRef.current) {
                            loadedAyatIdxRef.current = null;
                            if (isMainPlaying) {
                              mainAudioRef.current.load();
                              mainAudioRef.current.play().catch(() => {});
                              loadedAyatIdxRef.current = mainAyatIdx;
                            }
                          }
                        }}>
                          <span className="reciter-option-flag">{r.flag}</span>
                          <span className="reciter-option-name">{r.label}</span>
                          {r.id === recitatorId && <span className="reciter-option-check" aria-label="Sélectionné">✓</span>}
                        </button>
                      ))}
                      {visibleRecitators.length === 0 && <div className="reciter-empty">Aucun récitateur ne correspond à cette recherche.</div>}
                    </div>
                    <div className="reciter-sheet-footer">
                      <span>Débit audio · {bitrate} kbps</span>
                      <button className="reciter-reset" onClick={() => {
                        setReciterBitrate(recitatorId, bitrateOrderFor(recitatorId)[0]);
                        setBitrateVersion(v => v + 1);
                        loadedAyatIdxRef.current = null;
                        if (mainAudioRef.current) {
                          mainAudioRef.current.load();
                          loadedAyatIdxRef.current = mainAyatIdx;
                          if (isMainPlaying) playWhenReady();
                        }
                      }}>Réinitialiser le débit</button>
                    </div>
                  </section>
                </>,
                document.body
              )}

              {(() => {
                const sn = selectedSurah.number;
                const ayatDurations = ayats.map(a => {
                  const ts = timestampsMap[tskey(sn, a.numberInSurah)];
                  if (!ts?.words?.length) return 0;
                  const allChars = ts.words.flatMap(w => w.chars || []);
                  const first = allChars[0], last = allChars[allChars.length - 1];
                  if (!first || !last) return 0;
                  return Math.max(0, (last.end || 0) - (first.start || 0));
                });
                const totalMs = ayatDurations.reduce((s, d) => s + d, 0);
                const fmt = ms => { const s = Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

                if (totalMs <= 0) return (
                  <div className="player-progress">
                    <div className="progress-bar-wrap">
                      {loopActive && ayats.length > 1 && (
                        <div className="progress-range" style={{ left:`${(loopStart/ayats.length)*100}%`, width:`${((Math.min(loopEnd,ayats.length-1)-loopStart+1)/ayats.length)*100}%` }} />
                      )}
                      <div className="progress-bar-fill" style={{ width:`${((mainAyatIdx+1)/ayats.length)*100}%` }} />
                    </div>
                    <span className="progress-text">{mainAyatIdx+1}/{ayats.length}</span>
                  </div>
                );

                const prevMs = ayatDurations.slice(0, mainAyatIdx).reduce((s, d) => s + d, 0);
                const ts = timestampsMap[tskey(sn, currentMainAyat?.numberInSurah)];
                const ayatStartMs = ts?.words?.[0]?.chars?.[0]?.start ?? 0;
                const curMs = Math.max(0, prevMs + (mainCurrentMsRef.current - ayatStartMs));
                const pct = Math.min(100, (curMs / totalMs) * 100);

                // Loop range overlay
                const loopStartMs = ayatDurations.slice(0, loopStart).reduce((s,d)=>s+d,0);
                const loopEndMs   = ayatDurations.slice(0, Math.min(loopEnd,ayats.length-1)+1).reduce((s,d)=>s+d,0);

                return (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'2px 0', width:'100%' }}>
                    <span style={{ fontSize:9, color:'var(--text3)', fontFamily:"'Cinzel',serif", letterSpacing:1, flexShrink:0 }}>{fmt(curMs)}</span>
                    <div style={{ flex:1, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden', cursor:'pointer', position:'relative' }}
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const targetMs = (e.clientX - rect.left) / rect.width * totalMs;
                        let acc = 0;
                        for (let i = 0; i < ayats.length; i++) {
                          if (acc + ayatDurations[i] >= targetMs || i === ayats.length - 1) {
                            playMainAyat(i);
                            const tsA = timestampsMap[tskey(sn, ayats[i].numberInSurah)];
                            const aStart = tsA?.words?.[0]?.chars?.[0]?.start ?? 0;
                            setTimeout(() => {
                              if (mainAudioRef.current) {
                                mainAudioRef.current.currentTime = aStart/1000 + (targetMs-acc)/1000;
                                if (isMainPlaying) mainAudioRef.current.play().catch(()=>{});
                              }
                            }, 80);
                            break;
                          }
                          acc += ayatDurations[i];
                        }
                      }}>
                      {loopActive && <div style={{ position:'absolute', left:`${(loopStartMs/totalMs)*100}%`, width:`${((loopEndMs-loopStartMs)/totalMs)*100}%`, height:'100%', background:'rgba(62,184,160,.25)' }} />}
                      <div style={{ height:'100%', width:`${pct}%`, background:'var(--gold)', borderRadius:2, transition:'width .1s linear' }} />
                    </div>
                    <span style={{ fontSize:9, color:'var(--text3)', fontFamily:"'Cinzel',serif", letterSpacing:1, flexShrink:0 }}>{fmt(totalMs)}</span>
                  </div>
                );
              })()}
            </div>

            {/* LOOP CONFIG BAR */}
            {showLoopBar && (
              <div className="loop-bar">
                <span className="loop-label">BOUCLE</span>
                <div className="loop-inputs">
                  <span className="loop-rep-label">DE</span>
                  <input className="loop-input" value={loopStartInput}
                    onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 1) setLoopStartInput(n); }}
                    onBlur={applyLoopInputs}
                    onKeyDown={e => e.key === 'Enter' && applyLoopInputs()}
                    placeholder="1" />
                  <span className="loop-sep">→</span>
                  <input className="loop-input" value={loopEndInput}
                    onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 1) setLoopEndInput(n); }}
                    onBlur={applyLoopInputs}
                    onKeyDown={e => e.key === 'Enter' && applyLoopInputs()}
                    placeholder={ayats.length} />
                  <button className="btn-small" onClick={() => {
                    applyLoopInputs(); setLoopActive(true); setLoopCount(0);
                    playMainAyat(ayats.findIndex(a => a.numberInSurah === ((typeof loopStartInput === "number" ? loopStartInput : parseInt(loopStartInput)) || 1)));
                    setIsMainPlaying(true);
                  }}>▶ GO</button>
                </div>

                <div className="loop-rep-wrap">
                  <span className="loop-rep-label">RÉPÉTER</span>
                  <div className="loop-rep-btns">
                    {[0, 2, 3, 5, 10].map(n => (
                      <button key={n} className={`loop-rep-btn${loopMax === n ? ' sel' : ''}`}
                        onClick={() => { setLoopMax(n); setLoopCount(0); }}>
                        {n === 0 ? '∞' : `×${n}`}
                      </button>
                    ))}
                  </div>
                </div>

                {loopActive && (
                  <div className="loop-count-badge">
                    CYCLE <span>{loopCount + 1}{loopMax > 0 ? `/${loopMax}` : ''}</span>
                  </div>
                )}

                <button className="btn-small" style={{ marginLeft: "auto" }}
                  onClick={() => { setLoopActive(false); setLoopCount(0); setShowLoopBar(false); }}>
                  ✕ DÉSACTIVER
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <ArabicKeyboard
        show={showArabicKeyboard}
        onClose={() => { setShowArabicKeyboard(false); try { localStorage.setItem('quran_arabic_keyboard', '0'); } catch {} }}
      />
    </>
    </ArabicKeyboardContext.Provider>
  );
}

export default function App() {
  const [user, setUser]         = useState(undefined); // undefined = checking
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  if (!authReady) {
    return (
      <div style={{
        minHeight:"100vh", background:"var(--bg)",
        display:"flex", alignItems:"center", justifyContent:"center",
        flexDirection:"column", gap:16, fontFamily:"'Cinzel',serif",
      }}>
        <div style={{fontSize:40}}>☽</div>
        <div style={{fontSize:10, letterSpacing:5, color:"var(--text3)"}}>CHARGEMENT…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html:
          `:root{--bg:#0c0e14;--surface:#13161f;--surface2:#1a1e2a;--border:#2a2f40;--border2:#363c52;--gold:#c9a84c;--gold2:#e8c96e;--text:#e8e4d8;--text2:#a89f8c;--text3:#6e6659;--red:#e05a5a;}*{box-sizing:border-box;margin:0;padding:0;}` }}
        />
        <LoginScreen onLoggedIn={setUser} />
      </>
    );
  }

  return (
    <Provider store={store}>
      <HashRouter>
        <CloudSyncManager uid={user.uid} />
        <SyncConsole />
        <AppInner currentUser={user} onSignOut={() => signOut(firebaseAuth).then(() => setUser(null))} />
      </HashRouter>
    </Provider>
  );
}
