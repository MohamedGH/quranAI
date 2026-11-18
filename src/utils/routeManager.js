// ─── Pure Functional Route Manager ───────────────────────────────────────────
import { SURAH_INFO } from "./arabicUtils.js";
import { clampHizbNumber, getHizbBounds, getSurahsForHizb } from "./hizbUtils.js";
import { ERROR_CODES, trySync } from "./errorManager.js";

export const VALID_PAGES = Object.freeze([
  "quran",
  "prononciation",
  "glossaire",
  "dashboard",
  "concordance",
  "collections",
  "revision",
  "offline",
  "recordings",
]);

/**
 * Purely parses a pathname and optional search query string into a normalized route state.
 */
export const parseQuranRoute = (pathname = "/quran", search = "") =>
  trySync(
    () => {
      const cleanPath = String(pathname || "/quran").replace(/^#/, "").trim() || "/quran";
      const segs = cleanPath.replace(/^\//, "").split("/").filter(Boolean);
      const activePage = segs[0] || "quran";

      const rawSurah = segs[1] != null ? parseInt(segs[1], 10) : null;
      const rawAyat = segs[2] != null ? parseInt(segs[2], 10) : null;

      const surahNum =
        rawSurah != null && Number.isFinite(rawSurah) && rawSurah >= 1 && rawSurah <= 114
          ? rawSurah
          : null;
      const maxAyat = surahNum ? SURAH_INFO[surahNum - 1]?.count || 286 : 286;
      const ayatNum =
        rawAyat != null && Number.isFinite(rawAyat) && rawAyat >= 1 && rawAyat <= maxAyat
          ? rawAyat
          : null;

      const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
      const modeParam = params.get("mode");
      const mode = ["page", "hizb", "juz"].includes(modeParam) ? modeParam : null;
      const hizbParam = params.get("hizb") || params.get("hizbNum");
      const hizb = hizbParam ? clampHizbNumber(hizbParam) : null;
      const isCrossSurah = params.get("cross") === "1" || params.get("cross") === "true";
      const juzRaw = params.get("juz") ? parseInt(params.get("juz"), 10) : null;
      const juz =
        juzRaw != null && Number.isFinite(juzRaw) ? Math.max(1, Math.min(30, juzRaw)) : null;
      const pageRaw = params.get("page") ? parseInt(params.get("page"), 10) : null;
      const page =
        pageRaw != null && Number.isFinite(pageRaw) ? Math.max(1, Math.min(604, pageRaw)) : null;

      const silenceReviseParam = params.get("silenceRevise") || params.get("silence");
      const silenceRevise = silenceReviseParam === "1" || silenceReviseParam === "true";
      const silenceModeParam = params.get("silenceMode");
      const silenceMode = silenceModeParam === "skip" ? "skip" : silenceModeParam === "mute" ? "mute" : null;

      const uxParam = params.get("ux") || params.get("uxMode");
      const uxMode = ["beginner", "standard", "expert", "child"].includes(uxParam) ? uxParam : null;

      const compactParam = params.get("compact") ?? params.get("compactMode");
      const compactMode =
        compactParam === "1" || compactParam === "true"
          ? true
          : compactParam === "0" || compactParam === "false"
          ? false
          : null;

      const uiPresetParam = params.get("uiPreset") || params.get("preset");
      const uiPreset = ["all", "zen", "minimal", "audioFocus"].includes(uiPresetParam) ? uiPresetParam : null;

      const uiEditParam = params.get("uiEdit");
      const uiEditMode =
        uiEditParam === "1" || uiEditParam === "true"
          ? true
          : uiEditParam === "0" || uiEditParam === "false"
          ? false
          : null;

      const glossaryTermId =
        activePage === "glossaire"
          ? (segs[1] ? decodeURIComponent(segs[1]) : params.get("term") || null)
          : null;
      const glossaryCategory = activePage === "glossaire" ? params.get("cat") || null : null;

      return Object.freeze({
        activePage,
        surahNum,
        ayatNum,
        mode,
        hizb,
        hizbNum: hizb,
        isCrossSurah,
        juz,
        page,
        silenceRevise,
        silenceMode,
        uxMode,
        compactMode,
        uiPreset,
        uiEditMode,
        glossaryTermId,
        glossaryCategory,
      });
    },
    Object.freeze({
      activePage: "quran",
      surahNum: null,
      ayatNum: null,
      mode: null,
      hizb: null,
      hizbNum: null,
      isCrossSurah: false,
      juz: null,
      page: null,
      silenceRevise: false,
      silenceMode: null,
      uxMode: null,
      compactMode: null,
      uiPreset: null,
      uiEditMode: null,
      glossaryTermId: null,
      glossaryCategory: null,
    }),
    { code: ERROR_CODES.ROUTE_PARSE_ERROR, pathname, search }
  ).value;

/**
 * Purely builds a canonical Glossary route path.
 */
export const buildGlossaryRoute = (termId = null, { category = null, query = null, uxMode = null, compactMode = null } = {}) => {
  const cleanId = termId ? encodeURIComponent(String(termId).trim()) : "";
  const basePath = cleanId ? `/glossaire/${cleanId}` : "/glossaire";
  const params = new URLSearchParams();
  if (category && category !== "all") params.set("cat", String(category));
  if (query && String(query).trim()) params.set("q", String(query).trim());
  if (uxMode && ["beginner", "standard", "expert", "child"].includes(uxMode)) params.set("ux", uxMode);
  if (compactMode === true) params.set("compact", "1");
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
};

/**
 * Purely builds a canonical Quran route path from route parameters.
 */
export const buildQuranRoute = ({
  activePage = "quran",
  surahNum = null,
  ayatNum = null,
  mode = null,
  hizb = null,
  hizbNum = null,
  isCrossSurah = false,
  juz = null,
  page = null,
  silenceRevise = false,
  silenceMode = null,
  uxMode = null,
  ux = null,
  compactMode = null,
  compact = null,
  uiPreset = null,
  uiEditMode = null,
  glossaryTermId = null,
  glossaryCategory = null,
} = {}) => {
  const query = new URLSearchParams();
  const effectiveUx = uxMode || ux;
  const effectiveCompact = compactMode ?? compact;
  if (effectiveUx && ["beginner", "standard", "expert", "child"].includes(effectiveUx)) {
    query.set("ux", effectiveUx);
  }
  if (effectiveCompact === true) {
    query.set("compact", "1");
  }
  if (uiPreset && ["all", "zen", "minimal", "audioFocus"].includes(uiPreset)) {
    query.set("uiPreset", uiPreset);
  }
  if (uiEditMode === true) {
    query.set("uiEdit", "1");
  }

  if (activePage === "glossaire") {
    return buildGlossaryRoute(glossaryTermId, {
      category: glossaryCategory,
      uxMode: effectiveUx,
      compactMode: effectiveCompact === true ? true : null,
    });
  }

  if (activePage && activePage !== "quran") {
    const qs = query.toString();
    return qs ? `/${activePage}?${qs}` : `/${activePage}`;
  }
  const sn = Number(surahNum);
  const hasSurah = Number.isFinite(sn) && sn >= 1 && sn <= 114;
  const maxAyat = hasSurah ? SURAH_INFO[sn - 1]?.count || 286 : 286;
  const an = Number(ayatNum);
  const hasAyat = hasSurah && Number.isFinite(an) && an >= 1 && an <= maxAyat;

  const basePath = hasSurah
    ? hasAyat
      ? `/quran/${sn}/${an}`
      : `/quran/${sn}`
    : "/quran";

  if (mode && ["page", "hizb", "juz"].includes(mode)) query.set("mode", mode);
  const targetHizb = hizb ?? hizbNum;
  if (targetHizb != null && clampHizbNumber(targetHizb)) query.set("hizb", String(clampHizbNumber(targetHizb)));
  if (isCrossSurah) query.set("cross", "1");
  if (juz != null && Number.isFinite(Number(juz))) {
    query.set("juz", String(Math.max(1, Math.min(30, Math.round(Number(juz))))));
  }
  if (page != null && Number.isFinite(Number(page))) {
    query.set("page", String(Math.max(1, Math.min(604, Math.round(Number(page))))));
  }
  if (silenceRevise) {
    query.set("silenceRevise", "1");
  }
  if (silenceMode && (silenceMode === "skip" || silenceMode === "mute")) {
    query.set("silenceMode", silenceMode);
  }

  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
};

/**
 * Purely updates or replaces UX mode parameter in a route URL.
 */
export const setRouteUxMode = (pathname = "/quran", search = "", uxMode = "standard") => {
  const parsed = parseQuranRoute(pathname, search);
  return buildQuranRoute({
    ...parsed,
    uxMode,
  });
};

/**
 * Purely updates or removes compact query parameter in a route URL.
 */
export const setRouteCompactMode = (pathname = "/quran", search = "", compactMode = false) => {
  const parsed = parseQuranRoute(pathname, search);
  return buildQuranRoute({
    ...parsed,
    compactMode: Boolean(compactMode),
  });
};

/**
 * Purely resolves the target Surah and starting Ayah when navigating to a Hizb (1..60).
 * If `preferredSurahNum` is already part of `hizbNum`, preserves `preferredSurahNum` and returns
 * its first verse in that Hizb; otherwise resolves to the Surah where `hizbNum` begins.
 */
export const resolveHizbRouteTarget = (hizbNum, preferredSurahNum = null) => {
  const bounds = getHizbBounds(hizbNum);
  if (!bounds) return null;
  const surahsInHizb = getSurahsForHizb(bounds.hizb);
  const pref = Number(preferredSurahNum);
  if (Number.isFinite(pref) && surahsInHizb.includes(pref)) {
    const startAyah = pref === bounds.startSurah ? bounds.startAyah : 1;
    return Object.freeze({
      hizb: bounds.hizb,
      surahNum: pref,
      ayatNum: startAyah,
      route: buildQuranRoute({ surahNum: pref, ayatNum: startAyah }),
    });
  }
  return Object.freeze({
    hizb: bounds.hizb,
    surahNum: bounds.startSurah,
    ayatNum: bounds.startAyah,
    route: buildQuranRoute({ surahNum: bounds.startSurah, ayatNum: bounds.startAyah }),
  });
};

/**
 * Purely resolves the route for a specific verse (including a verse from another Surah in a cross-surah Hizb).
 */
export const resolveCrossSurahVerseRoute = (ayat, fallbackSurahNum = 1) => {
  const surahNum = Number(ayat?.surahNumber ?? ayat?.surah?.number ?? fallbackSurahNum) || 1;
  const ayatNum = Number(ayat?.numberInSurah) || 1;
  return Object.freeze({
    surahNum,
    ayatNum,
    route: buildQuranRoute({ surahNum, ayatNum }),
  });
};

/**
 * Purely builds a canonical Quiz/Questions route path.
 */
export const buildQuizRoute = ({
  surahNum = null,
  sn: snAlias = null,
  rangeFrom = null,
  rf: rfAlias = null,
  rangeTo = null,
  rt: rtAlias = null,
  qIdx = null,
  qi: qiAlias = null,
  preset = null,
  timer = null,
  mode = null,
} = {}) => {
  const targetSurah = surahNum ?? snAlias;
  const targetFrom = rangeFrom ?? rfAlias;
  const targetTo = rangeTo ?? rtAlias;
  const targetIdx = qIdx ?? qiAlias;

  const sn = Number(targetSurah);
  const hasSurah = Number.isFinite(sn) && sn >= 1 && sn <= 114;
  const rf = targetFrom != null ? parseInt(targetFrom, 10) : null;
  const rt = targetTo != null ? parseInt(targetTo, 10) : null;
  const qi = targetIdx != null ? parseInt(targetIdx, 10) : null;

  let path = "/revision/questions";
  if (hasSurah && rf != null) {
    const toVal = rt != null ? rt : (SURAH_INFO[sn - 1]?.count || 286);
    const idxVal = qi != null ? qi : 0;
    path = `/revision/questions/${sn}/${rf}/${toVal}/${idxVal}`;
  }

  const query = new URLSearchParams();
  if (preset) query.set("preset", preset);
  if (timer) query.set("timer", timer);
  if (mode) query.set("mode", mode);

  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
};

/**
 * Purely parses a Quiz/Questions route path and search params.
 */
export const parseQuizRoute = (pathname = "/revision/questions", search = "") => {
  const cleanPath = String(pathname || "").replace(/^#/, "").trim();
  const segs = cleanPath.replace(/^\//, "").split("/").filter(Boolean);
  const isQuiz = segs[0] === "revision" && segs[1] === "questions";

  const rawSn = segs[2] != null ? parseInt(segs[2], 10) : null;
  const rawRf = segs[3] != null ? parseInt(segs[3], 10) : null;
  const rawRt = segs[4] != null ? parseInt(segs[4], 10) : null;
  const rawQi = segs[5] != null ? parseInt(segs[5], 10) : null;

  const surahNum = rawSn != null && Number.isFinite(rawSn) && rawSn >= 1 && rawSn <= 114 ? rawSn : null;
  const rangeFrom = rawRf != null && Number.isFinite(rawRf) && rawRf >= 1 ? rawRf : null;
  const rangeTo = rawRt != null && Number.isFinite(rawRt) && rawRt >= 1 ? rawRt : null;
  const qIdx = rawQi != null && Number.isFinite(rawQi) && rawQi >= 0 ? rawQi : 0;

  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const preset = params.get("preset") || null;
  const timer = params.get("timer") || null;
  const modeParam = params.get("mode");
  const mode = modeParam === "free" ? "free" : modeParam === "choice" ? "choice" : null;

  return Object.freeze({
    isQuiz,
    surahNum,
    rangeFrom,
    rangeTo,
    qIdx,
    preset,
    timer,
    mode,
  });
};

