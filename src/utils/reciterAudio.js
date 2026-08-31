import { IS_ANDROID } from './audioRecorder.js';
import { splitArabicWords } from './arabicUtils.js';

export const API = "https://api.alquran.cloud/v1";
export const AUDIO_CDN_ROOT = 'https://cdn.islamic.network/quran/audio'; // bitrate is appended dynamically, see getAudioBase()
// Bitrate list: see BITRATE_FALLBACK_ORDER below (auto-detected per reciter).

export const RECITATORS = [
  { id: 'ar.alafasy',            label: 'Mishary Al-Afasy',            flag: '🇰🇼' },
  { id: 'ar.abdulbasitmurattal', label: 'Abdul Basit (Murattal)',      flag: '🇪🇬' },
  { id: 'ar.abdullahbasfar',     label: 'Abdullah Basfar',             flag: '🇸🇦' },
  { id: 'ar.abdurrahmaansudais', label: 'Abdul Rahman Al-Sudais',      flag: '🇸🇦' },
  { id: 'ar.shaatree',           label: 'Abu Bakr Ash-Shaatree',       flag: '🇸🇦' },
  { id: 'ar.ahmedajamy',         label: 'Ahmed Al-Ajamy',              flag: '🇸🇦' },
  { id: 'ar.hanirifai',          label: 'Hani Ar-Rifai',               flag: '🇸🇦' },
  { id: 'ar.husary',             label: 'Mahmoud Khalil Al-Husary',    flag: '🇪🇬' },
  { id: 'ar.husarymujawwad',     label: 'Al-Husary (Mujawwad)',        flag: '🇪🇬' },
  { id: 'ar.hudhaify',           label: 'Ali Al-Hudhaify',             flag: '🇸🇦' },
  { id: 'ar.ibrahimakhbar',      label: 'Ibrahim Al-Akhdar',           flag: '🇸🇦' },
  { id: 'ar.mahermuaiqly',       label: 'Maher Al-Muaiqly',            flag: '🇸🇦' },
  { id: 'ar.minshawi',           label: 'Mohamed Siddiq Al-Minshawi',  flag: '🇪🇬' },
  { id: 'ar.minshawimujawwad',   label: 'Al-Minshawi (Mujawwad)',      flag: '🇪🇬' },
  { id: 'ar.muhammadayyoub',     label: 'Muhammad Ayyoub',             flag: '🇸🇦' },
  { id: 'ar.muhammadjibreel',    label: 'Muhammad Jibreel',            flag: '🇪🇬' },
  { id: 'ar.saoodshuraym',       label: 'Saud Al-Shuraim',             flag: '🇸🇦' },
  { id: 'ar.parhizgar',          label: 'Shahriar Parhizgar',          flag: '🇮🇷' },
  { id: 'ar.aymanswoaid',        label: 'Ayman Sowaid',                flag: '🇸🇾' },
];

export let _recitatorId = (() => { try { return localStorage.getItem('quran_recitator') || 'ar.alafasy'; } catch { return 'ar.alafasy'; } })();

// Bitrate is automatic and per-reciter — not every reciter's audio is hosted at every bitrate.
// The official per-ayah API response (`audio` + `audioSecondary` fields) reports exactly which
// bitrate URLs actually exist for a given reciter — this is the same source data that backs
// cdn.islamic.network's info.json, fetched live via the API instead of parsing a static dump.
export const BITRATE_FALLBACK_ORDER = [128, 64, 192, 48, 40, 32]; // generic guess, used only until the official list arrives
export let _officialBitrates = (() => { try { return JSON.parse(localStorage.getItem('quran_official_bitrates')) || {}; } catch { return {}; } })();
export let _bitrateByReciter  = (() => { try { return JSON.parse(localStorage.getItem('quran_bitrate_by_reciter')) || {}; } catch { return {}; } })();

export const bitrateOrderFor  = (id) => (_officialBitrates[id]?.length ? _officialBitrates[id] : BITRATE_FALLBACK_ORDER);
export const getReciterBitrate = (id) => _bitrateByReciter[id] ?? bitrateOrderFor(id)[0];
export const setReciterBitrate = (id, kbps) => {
  _bitrateByReciter = { ..._bitrateByReciter, [id]: kbps };
  try { localStorage.setItem('quran_bitrate_by_reciter', JSON.stringify(_bitrateByReciter)); } catch {}
};
// Called when the current bitrate 404s for a reciter — advances to the next candidate in its
// (ideally official) list and remembers it, so this reciter "just works" from then on. Returns
// the new bitrate, or null if every candidate has already been exhausted.
export const markBitrateBad = (id) => {
  const order = bitrateOrderFor(id);
  const cur   = getReciterBitrate(id);
  const next  = order[order.indexOf(cur) + 1];
  if (next == null) return null;
  setReciterBitrate(id, next);
  return next;
};
// Queries the official API for the bitrates actually available for a reciter and caches the
// result. `data.audio` is the primary URL, `data.audioSecondary` lists the rest — together they
// enumerate every working `{bitrate}` for that edition, straight from the source.
export async function fetchOfficialBitrates(id) {
  if (_officialBitrates[id]) return _officialBitrates[id];
  try {
    const r = await fetch(`${API}/ayah/1/${id}`);
    const j = await r.json();
    const urls = [j?.data?.audio, ...(j?.data?.audioSecondary || [])].filter(Boolean);
    const kbps = [...new Set(urls
      .map(u => parseInt((u.match(/\/audio\/(\d+)\//) || [])[1], 10))
      .filter(n => !isNaN(n)))];
    if (!kbps.length) return null;
    kbps.sort((a, b) => (a === 128 ? -1 : b === 128 ? 1 : a - b)); // prefer 128 when it's an option
    _officialBitrates = { ..._officialBitrates, [id]: kbps };
    try { localStorage.setItem('quran_official_bitrates', JSON.stringify(_officialBitrates)); } catch {}
    // if what we had remembered for this reciter turns out not to be real, snap to the true default
    if (!kbps.includes(getReciterBitrate(id))) setReciterBitrate(id, kbps[0]);
    return kbps;
  } catch { return null; }
}
export const getAudioBase = () => `${AUDIO_CDN_ROOT}/${getReciterBitrate(_recitatorId)}/${_recitatorId}`;
export const setGlobalRecitator = (id) => { _recitatorId = id; try { localStorage.setItem('quran_recitator', id); } catch {} };
export const getGlobalRecitator = () => _recitatorId;

// AUDIO_BASE removed — use getAudioBase() (dynamic, follows the selected reciter, bitrate is automatic)



export async function fetchSurahs() {
  const idbKey = 'surahs';
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const r = await fetch(`${API}/surah`);
  const data = (await r.json()).data;
  idbSetQuran(idbKey, data).catch(() => {});
  return data;
}

// Translation editions keyed by lang code
export const TRANS_EDITIONS = {
  fr: 'fr.hamidullah',
  en: 'en.sahih',
  tr: 'tr.diyanet',
  ur: 'ur.jalandhry',
  de: 'de.aburida',
  es: 'es.asad',
  id: 'id.indonesian',
  ru: 'ru.kuliev',
};
export const TRANS_LABELS = { fr:'🇫🇷 FR', en:'🇬🇧 EN', tr:'🇹🇷 TR', ur:'🇵🇰 UR', de:'🇩🇪 DE', es:'🇪🇸 ES', id:'🇮🇩 ID', ru:'🇷🇺 RU' };

// fetchSurahTranslation(sn, lang) → [{numberInSurah, text}] cached in IDB
export async function fetchSurahTranslation(sn, lang) {
  const edition = TRANS_EDITIONS[lang];
  if (!edition) return [];
  const idbKey = `trans:${lang}:${sn}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const r = await fetch(`${API}/surah/${sn}/${edition}`);
  const ayahs = (await r.json()).data?.ayahs || [];
  const result = ayahs.map(a => ({ numberInSurah: a.numberInSurah, text: a.text }));
  idbSetQuran(idbKey, result).catch(() => {});
  return result;
}
export async function fetchAyats(n) {
  const idbKey = `alafasy:${n}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const r = await fetch(`${API}/surah/${n}/ar.alafasy`);
  const data = (await r.json()).data;
  idbSetQuran(idbKey, data).catch(() => {});
  return data;
}
// /surah/${n}/quran-simple  →  [{num, text}, …]
export async function fetchSurahSimple(n) {
  const idbKey = `text:${n}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const r = await fetch(`${API}/surah/${n}/quran-simple`);
  const data = (await r.json()).data?.ayahs || [];
  const ayats = data.map(a => ({ num: a.numberInSurah, text: a.text }));
  idbSetQuran(idbKey, ayats).catch(() => {});
  return ayats;
}
// /surah/${n}  (default edition — used for ayat texts in MemoriseMode etc.)
// Returns raw ayahs array from API data.ayahs
export async function fetchSurahDefault(n) {
  const idbKey = `simple:${n}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const r = await fetch(`${API}/surah/${n}`);
  const ayahs = (await r.json()).data?.ayahs || [];
  idbSetQuran(idbKey, ayahs).catch(() => {});
  return ayahs;
}
// Static surah metadata cache: hizb, juz, page (from ayat 1) + total word count
export async function fetchSurahMeta(n) {
  const idbKey = `smeta:${n}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const ayahs = await fetchSurahDefault(n);
  const a1 = ayahs[0] || {};
  const wordCount = ayahs.reduce((s, a) => s + splitArabicWords(a.text || '').length, 0);
  const meta = {
    hizb:      a1.hizbQuarter != null ? Math.ceil(a1.hizbQuarter / 4) : null,
    juz:       a1.juz  ?? null,
    page:      a1.page ?? null,
    wordCount,
  };
  idbSetQuran(idbKey, meta).catch(() => {});
  return meta;
}
// Single-ayah meta (page, juz, hizb, manzil, ruku, sajda) — cached per-surah
export async function fetchAyahMeta(sn, an) {
  const ayahs = await fetchSurahDefault(sn);
  return ayahs.find(a => a.numberInSurah === an) || null;
}
export const fetchAyatMeta = fetchAyahMeta;
export async function fetchQuranPage(pageNum) {
  const key = `mushaf_page:${pageNum}`;
  try { const c = await idbGetQuran(key); if (c) return c; } catch {}
  const r = await fetch(`${API}/page/${pageNum}/quran-uthmani`);
  const ayahs = (await r.json()).data?.ayahs || [];
  idbSetQuran(key, ayahs).catch(() => {});
  return ayahs;
}
// Static page-level metadata: hizb, juz, word count — cached in IDB as pmeta:N
export async function fetchPageMeta(pageNum) {
  const idbKey = `pmeta:${pageNum}`;
  try { const c = await idbGetQuran(idbKey); if (c) return c; } catch {}
  const ayahs = await fetchQuranPage(pageNum);
  const a1 = ayahs[0] || {};
  const wordCount = ayahs.reduce((s, a) => s + splitArabicWords(a.text || '').length, 0);
  const meta = {
    hizb:      a1.hizbQuarter != null ? Math.ceil(a1.hizbQuarter / 4) : null,
    juz:       a1.juz  ?? null,
    ayatCount: ayahs.length,
    wordCount,
  };
  idbSetQuran(idbKey, meta).catch(() => {});
  return meta;
}

export function _stripBasmalaWords(words, sn) {
  // Strip first 4 words (basmala) from ayat 1 timestamps for non-Fatiha/Tawba surahs
  if (!words || words.length <= 4 || sn === 1 || sn === 9) return words;
  const stripD = s => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '');
  const firstWord = words[0]?.chars?.map(c => c.char).join('') || '';
  if (stripD(firstWord).startsWith('بسم')) return words.slice(4);
  return words;
}

export function parseTimestampsFile(data, surahNum, keyPrefix) {
  const result = {};
  const pfx = keyPrefix ? `${keyPrefix}:` : '';
  const addEntry = (sn, ayatNum, words) => {
    const processedWords = ayatNum === 1 ? _stripBasmalaWords(words, sn) : words;
    result[`${pfx}${sn}:${ayatNum}`] = { words: processedWords };
  };
  if (Array.isArray(data)) {
    data.forEach(item => { if (item.ayat && item.words) addEntry(item.surah || surahNum, item.ayat, item.words); });
  } else if (data.ayat && data.words) {
    addEntry(data.surah || surahNum, data.ayat, data.words);
  }
  return result;
}

// ─── IndexedDB timestamps cache ───────────────────────────────────────────────
export const IDB_NAME        = 'quran-ts-cache';
export const IDB_STORE       = 'timestamps';
export const IDB_QURAN_STORE = 'quran';
export const tsMemCache    = {};
export const quranMemCache = {};
export let _tsDbPromise = null;
export function openTsDb() {
  if (!_tsDbPromise) {
    _tsDbPromise = new Promise((res, rej) => {
      const req = indexedDB.open(IDB_NAME, 3);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE))       db.createObjectStore(IDB_STORE);
        if (!db.objectStoreNames.contains(IDB_QURAN_STORE)) db.createObjectStore(IDB_QURAN_STORE);
        if (!db.objectStoreNames.contains('audio'))         db.createObjectStore('audio');
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror = e => { _tsDbPromise = null; rej(e.target.error); };
    });
  }
  return _tsDbPromise;
}
export async function idbGetQuran(key) {
  if (quranMemCache[key] !== undefined) return quranMemCache[key];
  const db = await openTsDb();
  return new Promise((res, rej) => {
    const tx  = db.transaction(IDB_QURAN_STORE, 'readonly');
    const req = tx.objectStore(IDB_QURAN_STORE).get(key);
    req.onsuccess = () => { quranMemCache[key] = req.result ?? null; res(req.result ?? null); };
    req.onerror   = e => rej(e.target.error);
  });
}
export async function idbSetQuran(key, val) {
  quranMemCache[key] = val;
  const db = await openTsDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_QURAN_STORE, 'readwrite');
    tx.objectStore(IDB_QURAN_STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror    = e => rej(e.target.error);
  });
}
export async function idbGet(key) {
  const db = await openTsDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = e => rej(e.target.error);
  });
}
export async function idbSet(key, val) {
  const db = await openTsDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = res;
    tx.onerror = e => rej(e.target.error);
  });
}

// ─── Auto-load timestamps for a surah (per reciter) ──────────────────────────
// Path scheme — one subfolder per reciter id, same file-naming pattern as before:
//   Android (bundled assets): public/assets/timestamps/{recitatorId}/surah_XXX.json
//   Web (server):              http://localhost:3000/sourate/{recitatorId}/surah_XXX.json
// e.g. for sourate 1 / ar.husary → public/assets/timestamps/ar.husary/surah_001.json
export const TS_SERVER_BASE   = 'http://localhost:3000/sourate';
export const TS_ANDROID_BASE  = 'public/assets/timestamps';
export async function loadTimestampsForSurah(surahNum, recitatorId = 'ar.alafasy') {
  const memKey = `${recitatorId}:${surahNum}`;
  if (tsMemCache[memKey]) return tsMemCache[memKey];
  const cacheKey = `ts:${recitatorId}:${surahNum}`;
  const file     = `surah_${String(surahNum).padStart(3,'0')}.json`;

  if (IS_ANDROID) {
    // Capacitor: load directly from bundled assets, no IDB needed
    const url = `${TS_ANDROID_BASE}/${recitatorId}/${file}`;
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const data = await r.json();
      const parsed = parseTimestampsFile(data, surahNum, recitatorId);
      if (parsed) tsMemCache[memKey] = parsed;
      return parsed;
    } catch { return null; }
  }

  // Web: try IDB cache first, then fetch from server and cache
  try {
    const cached = await idbGet(cacheKey);
    if (cached) { tsMemCache[memKey] = cached; return cached; }
  } catch {}

  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 5000); // 5s timeout — don't stall UI
    const r = await fetch(`${TS_SERVER_BASE}/${recitatorId}/${file}`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!r.ok) return null;
    const data   = await r.json();
    const parsed = parseTimestampsFile(data, surahNum, recitatorId);
    if (Object.keys(parsed).length > 0) {
      tsMemCache[memKey] = parsed;
      idbSet(cacheKey, parsed).catch(() => {});
    }
    return parsed;
  } catch { return null; }
}


// Fix degenerate timestamp chars where start===end by extending to next real boundary
export function fixChars(chars) {
  if (!chars?.length) return [];
  const wordEnd = chars[chars.length - 1].end;
  return chars.map((c, ci) => {
    if (c.start === c.end) {
      const nextReal = chars.slice(ci + 1).find(x => x.end > c.start);
      return { ...c, end: nextReal ? nextReal.start : wordEnd };
    }
    return c;
  });
}