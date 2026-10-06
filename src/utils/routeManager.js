// ─── Pure Functional Route Manager ───────────────────────────────────────────
import { SURAH_INFO } from "./arabicUtils.js";
import { clampHizbNumber, getHizbBounds, getSurahsForHizb } from "./hizbUtils.js";
import { ERROR_CODES, trySync } from "./errorManager.js";

export const VALID_PAGES = Object.freeze([
  "quran",
  "prononciation",
  "dashboard",
  "concordance",
  "collections",
  "revision",
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
    }),
    { code: ERROR_CODES.ROUTE_PARSE_ERROR, pathname, search }
  ).value;

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
} = {}) => {
  if (activePage && activePage !== "quran") {
    return `/${activePage}`;
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

  const query = new URLSearchParams();
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

  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
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
