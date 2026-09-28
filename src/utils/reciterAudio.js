import { IS_ANDROID } from './audioRecorder.js';
import { splitArabicWords } from './arabicUtils.js';
import { safeGetItem, safeSetItem } from './safeStorage.js';

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

export const GLOBAL_RECITERS = [
  { key: 'alafasy', id: 'ar.alafasy', name: 'Mishary Al-Afasy', url: 'https://everyayah.com/data/Alafasy_128kbps' },
  { key: 'abdulbasit', id: 'ar.abdulbasitmurattal', name: 'Abdul Basit Murattal', url: 'https://everyayah.com/data/Abdul_Basit_Murattal_192kbps' },
  { key: 'husary', id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', url: 'https://everyayah.com/data/Husary_128kbps' },
  { key: 'minshawi', id: 'ar.minshawi', name: 'Mohamed Siddiq Al-Minshawi', url: 'https://everyayah.com/data/Minshawy_Murattal_128kbps' },
  { key: 'ghamadi', id: 'ar.ghamadi', name: 'Saad Al-Ghamadi', url: 'https://everyayah.com/data/Ghamadi_40kbps' },
  { key: 'sudais', id: 'ar.abdurrahmaansudais', name: 'Abdur-Rahman As-Sudais', url: 'https://everyayah.com/data/Abdurrahmaan_As-Sudais_192kbps' },
  { key: 'hudhaify', id: 'ar.hudhaify', name: 'Ali Al-Hudhaify', url: 'https://everyayah.com/data/Hudhaify_128kbps' },
];

export let _recitatorId = safeGetItem('quran_recitator', 'ar.alafasy') || 'ar.alafasy';

// Bitrate is automatic and per-reciter — not every reciter's audio is hosted at every bitrate.
// The official per-ayah API response (`audio` + `audioSecondary` fields) reports exactly which
// bitrate URLs actually exist for a given reciter — this is the same source data that backs
// cdn.islamic.network's info.json, fetched live via the API instead of parsing a static dump.
export const BITRATE_FALLBACK_ORDER = [128, 64, 192, 48, 40, 32]; // generic guess, used only until the official list arrives
export let _officialBitrates = safeGetItem('quran_official_bitrates', {}) || {};
export let _bitrateByReciter  = safeGetItem('quran_bitrate_by_reciter', {}) || {};

export const bitrateOrderFor  = (id) => (_officialBitrates[id]?.length ? _officialBitrates[id] : BITRATE_FALLBACK_ORDER);
export const getReciterBitrate = (id) => _bitrateByReciter[id] ?? bitrateOrderFor(id)[0];
export const setReciterBitrate = (id, kbps) => {
  _bitrateByReciter = { ..._bitrateByReciter, [id]: kbps };
  safeSetItem('quran_bitrate_by_reciter', _bitrateByReciter);
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
    safeSetItem('quran_official_bitrates', _officialBitrates);
    // if what we had remembered for this reciter turns out not to be real, snap to the true default
    if (!kbps.includes(getReciterBitrate(id))) setReciterBitrate(id, kbps[0]);
    return kbps;
  } catch { return null; }
}
export const getAudioBase = () => `${AUDIO_CDN_ROOT}/${getReciterBitrate(_recitatorId)}/${_recitatorId}`;
export const setGlobalRecitator = (id) => { _recitatorId = id; safeSetItem('quran_recitator', id); };
export const getGlobalRecitator = () => _recitatorId;

// AUDIO_BASE removed — use getAudioBase() (dynamic, follows the selected reciter, bitrate is automatic)



export async function fetchSurahs() {
  const idbKey = 'surahs';
  try {
    const c = await idbGetQuran(idbKey);
    if (Array.isArray(c) && c.length === 114) return c;
  } catch {}

  try {
    const r = await fetch(`${API}/surah`);
    if (r.ok) {
      const data = (await r.json())?.data || [];
      if (Array.isArray(data) && data.length > 0) {
        idbSetQuran(idbKey, data).catch(() => {});
        return data;
      }
    }
  } catch (err) {
    console.warn("fetchSurahs network error:", err);
  }

  const fallback = safeGetItem(`quran_fallback_surahs`, null);
  if (Array.isArray(fallback) && fallback.length > 0) return fallback;
  return [];
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
  try {
    const c = await idbGetQuran(idbKey);
    if (Array.isArray(c) && c.length > 0) return c;
  } catch {}

  try {
    const r = await fetch(`${API}/surah/${sn}/${edition}`);
    if (r.ok) {
      const ayahs = (await r.json())?.data?.ayahs || [];
      const result = ayahs.map(a => ({ numberInSurah: a.numberInSurah, text: a.text }));
      if (result.length > 0) {
        idbSetQuran(idbKey, result).catch(() => {});
        return result;
      }
    }
  } catch {}

  const fallback = safeGetItem(`quran_fallback_trans_${lang}_${sn}`, null);
  return Array.isArray(fallback) ? fallback : [];
}

// fetchSurahWbw(sn, lang) → { [numberInSurah]: [word1Trans, word2Trans, ...] } cached in IDB
export async function fetchSurahWbw(sn, lang = 'fr') {
  if (!lang) return {};
  const idbKey = `wbw:${lang}:${sn}`;
  try {
    const c = await idbGetQuran(idbKey);
    if (c && Object.keys(c).length > 0) return c;
  } catch {}

  try {
    const r = await fetch(`https://api.quran.com/api/v4/verses/by_chapter/${sn}?words=true&language=${encodeURIComponent(lang)}&word_translation_language=${encodeURIComponent(lang)}&per_page=300`);
    if (r.ok) {
      const j = await r.json();
      const verses = j.verses || [];
      const result = {};
      verses.forEach(v => {
        const realWords = (v.words || []).filter(w => w.char_type_name !== 'end');
        result[v.verse_number] = realWords.map(w => {
          const t = w.translation?.text || '';
          return t.replace(/<[^>]*>?/gm, '').trim();
        });
      });
      if (Object.keys(result).length > 0) {
        idbSetQuran(idbKey, result).catch(() => {});
        return result;
      }
    }
  } catch (err) {
    console.warn("fetchSurahWbw error:", err);
  }

  const fallback = safeGetItem(`quran_fallback_wbw_${lang}_${sn}`, null);
  return fallback && typeof fallback === 'object' ? fallback : {};
}

export async function fetchAyats(n) {
  const idbKey = `alafasy:${n}`;
  try {
    const c = await idbGetQuran(idbKey);
    if (c && Array.isArray(c.ayahs) && c.ayahs.length > 0) return c;
  } catch {}

  try {
    const r = await fetch(`${API}/surah/${n}/ar.alafasy`);
    if (r.ok) {
      const data = (await r.json())?.data || { ayahs: [] };
      if (Array.isArray(data.ayahs) && data.ayahs.length > 0) {
        idbSetQuran(idbKey, data).catch(() => {});
        return data;
      }
    }
  } catch (err) {
    console.warn(`fetchAyats(${n}) error, checking fallbacks:`, err);
  }

  // Resilient fallback: Try default uthmani text
  try {
    const defAyahs = await fetchSurahDefault(n);
    if (Array.isArray(defAyahs) && defAyahs.length > 0) {
      const constructed = { number: n, ayahs: defAyahs };
      idbSetQuran(idbKey, constructed).catch(() => {});
      return constructed;
    }
  } catch {}

  const fallback = safeGetItem(`quran_fallback_alafasy_${n}`, null);
  if (fallback && Array.isArray(fallback.ayahs) && fallback.ayahs.length > 0) return fallback;

  return { ayahs: [] };
}

// /surah/${n}/quran-simple  →  [{num, text}, …]
export async function fetchSurahSimple(n) {
  const idbKey = `text:${n}`;
  try {
    const c = await idbGetQuran(idbKey);
    if (Array.isArray(c) && c.length > 0) return c;
  } catch {}

  try {
    const r = await fetch(`${API}/surah/${n}/quran-simple`);
    if (r.ok) {
      const data = (await r.json())?.data?.ayahs || [];
      const ayats = data.map(a => ({ num: a.numberInSurah, text: a.text }));
      if (ayats.length > 0) {
        idbSetQuran(idbKey, ayats).catch(() => {});
        return ayats;
      }
    }
  } catch {}

  const fallback = safeGetItem(`quran_fallback_text_${n}`, null);
  return Array.isArray(fallback) ? fallback : [];
}

// /surah/${n}  (default edition — used for ayat texts in MemoriseMode etc.)
export async function fetchSurahDefault(n) {
  const idbKey = `simple:${n}`;
  try {
    const c = await idbGetQuran(idbKey);
    if (Array.isArray(c) && c.length > 0) return c;
  } catch {}

  try {
    const r = await fetch(`${API}/surah/${n}`);
    if (r.ok) {
      const ayahs = (await r.json())?.data?.ayahs || [];
      if (ayahs.length > 0) {
        idbSetQuran(idbKey, ayahs).catch(() => {});
        return ayahs;
      }
    }
  } catch {}

  const fallback = safeGetItem(`quran_fallback_simple_${n}`, null);
  return Array.isArray(fallback) ? fallback : [];
}

// Static surah metadata cache: hizb, juz, page (from ayat 1) + total word count
export async function fetchSurahMeta(n) {
  const idbKey = `smeta:${n}`;
  try {
    const c = await idbGetQuran(idbKey);
    if (c && c.wordCount != null) return c;
  } catch {}

  const ayahs = await fetchSurahDefault(n);
  const a1 = ayahs[0] || {};
  const wordCount = ayahs.reduce((s, a) => s + splitArabicWords(a.text || '').length, 0);
  const meta = {
    hizb:      a1.hizbQuarter != null ? Math.ceil(a1.hizbQuarter / 4) : null,
    juz:       a1.juz  ?? null,
    page:      a1.page ?? null,
    wordCount,
  };
  if (wordCount > 0) idbSetQuran(idbKey, meta).catch(() => {});
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
  try {
    const c = await idbGetQuran(key);
    if (Array.isArray(c) && c.length > 0) return c;
  } catch {}

  try {
    const r = await fetch(`${API}/page/${pageNum}/quran-uthmani`);
    if (r.ok) {
      const ayahs = (await r.json())?.data?.ayahs || [];
      if (ayahs.length > 0) {
        idbSetQuran(key, ayahs).catch(() => {});
        return ayahs;
      }
    }
  } catch {}

  const fallback = safeGetItem(`quran_fallback_page_${pageNum}`, null);
  return Array.isArray(fallback) ? fallback : [];
}

// Static page-level metadata: hizb, juz, word count — cached in IDB as pmeta:N
export async function fetchPageMeta(pageNum) {
  const idbKey = `pmeta:${pageNum}`;
  try {
    const c = await idbGetQuran(idbKey);
    if (c && c.wordCount != null) return c;
  } catch {}

  const ayahs = await fetchQuranPage(pageNum);
  const a1 = ayahs[0] || {};
  const wordCount = ayahs.reduce((s, a) => s + splitArabicWords(a.text || '').length, 0);
  const meta = {
    hizb:      a1.hizbQuarter != null ? Math.ceil(a1.hizbQuarter / 4) : null,
    juz:       a1.juz  ?? null,
    ayatCount: ayahs.length,
    wordCount,
  };
  if (wordCount > 0) idbSetQuran(idbKey, meta).catch(() => {});
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
  } else if (data && data.ayat && data.words) {
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
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error("No indexedDB"));
  if (!_tsDbPromise) {
    _tsDbPromise = new Promise((res, rej) => {
      try {
        const req = indexedDB.open(IDB_NAME, 3);
        req.onupgradeneeded = e => {
          try {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE))       db.createObjectStore(IDB_STORE);
            if (!db.objectStoreNames.contains(IDB_QURAN_STORE)) db.createObjectStore(IDB_QURAN_STORE);
            if (!db.objectStoreNames.contains('audio'))         db.createObjectStore('audio');
          } catch (err) {
            rej(err);
          }
        };
        req.onsuccess = e => {
          const db = e.target.result;
          db.onversionchange = () => { db.close(); _tsDbPromise = null; };
          db.onclose = () => { _tsDbPromise = null; };
          res(db);
        };
        req.onerror = e => { _tsDbPromise = null; rej(e.target.error || new Error("IDB Open Error")); };
        req.onblocked = () => { _tsDbPromise = null; rej(new Error("IDB Blocked")); };
      } catch (err) {
        _tsDbPromise = null;
        rej(err);
      }
    });
  }
  return _tsDbPromise;
}

export async function idbGetQuran(key) {
  if (quranMemCache[key] != null) return quranMemCache[key];
  try {
    const db = await openTsDb();
    const result = await new Promise((res) => {
      try {
        const tx  = db.transaction(IDB_QURAN_STORE, 'readonly');
        const req = tx.objectStore(IDB_QURAN_STORE).get(key);
        req.onsuccess = () => res(req.result ?? null);
        req.onerror   = () => res(null);
      } catch {
        res(null);
      }
    });
    if (result != null) {
      quranMemCache[key] = result;
      return result;
    }
  } catch {}

  // Local fallback
  try {
    const local = safeGetItem(`quran_fallback_${key}`, null);
    if (local != null) {
      quranMemCache[key] = local;
      return local;
    }
  } catch {}

  return null;
}

export async function idbSetQuran(key, val) {
  if (val == null) return;
  quranMemCache[key] = val;
  try {
    safeSetItem(`quran_fallback_${key}`, val);
  } catch {}
  try {
    const db = await openTsDb();
    await new Promise((res) => {
      try {
        const tx = db.transaction(IDB_QURAN_STORE, 'readwrite');
        tx.objectStore(IDB_QURAN_STORE).put(val, key);
        tx.oncomplete = () => res();
        tx.onerror    = () => res();
      } catch {
        res();
      }
    });
  } catch {}
}

export async function idbGet(key) {
  if (tsMemCache[key] != null) return tsMemCache[key];
  try {
    const db = await openTsDb();
    return await new Promise((res) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => res(req.result ?? null);
        req.onerror = () => res(null);
      } catch {
        res(null);
      }
    });
  } catch {
    return null;
  }
}

export async function idbSet(key, val) {
  if (val == null) return;
  tsMemCache[key] = val;
  try {
    const db = await openTsDb();
    await new Promise((res) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(val, key);
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      } catch {
        res();
      }
    });
  } catch {}
}

// ─── Auto-load timestamps for a surah (per reciter) ──────────────────────────
export const TS_SERVER_BASE   = 'http://localhost:3000/sourate';
export const TS_ANDROID_BASE  = 'public/assets/timestamps';

export async function loadTimestampsForSurah(surahNum, recitatorId = 'ar.alafasy') {
  const memKey = `${recitatorId}:${surahNum}`;
  if (tsMemCache[memKey] && Object.keys(tsMemCache[memKey]).length > 0) return tsMemCache[memKey];
  const cacheKey = `ts:${recitatorId}:${surahNum}`;
  const file     = `surah_${String(surahNum).padStart(3,'0')}.json`;

  if (IS_ANDROID) {
    const url = `${TS_ANDROID_BASE}/${recitatorId}/${file}`;
    try {
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        const parsed = parseTimestampsFile(data, surahNum, recitatorId);
        if (parsed && Object.keys(parsed).length > 0) {
          tsMemCache[memKey] = parsed;
          return parsed;
        }
      }
    } catch {}
  }

  // Web / Fallback: Try IDB cache first
  try {
    const cached = await idbGet(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      tsMemCache[memKey] = cached;
      return cached;
    }
  } catch {}

  const urlsToTry = [
    `/sourate/${recitatorId}/${file}`,
    `/assets/timestamps/${recitatorId}/${file}`,
    `${TS_SERVER_BASE}/${recitatorId}/${file}`
  ];

  for (const url of urlsToTry) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (r.ok) {
        const data = await r.json();
        const parsed = parseTimestampsFile(data, surahNum, recitatorId);
        if (parsed && Object.keys(parsed).length > 0) {
          tsMemCache[memKey] = parsed;
          idbSet(cacheKey, parsed).catch(() => {});
          return parsed;
        }
      }
    } catch {}
  }

  return null;
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