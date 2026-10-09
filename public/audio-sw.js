// audio-sw.js — Quran audio cache via IndexedDB
// Place in /public/ — Vite serves it at root scope.
//
// In dev:  intercepts /audio-proxy/*.mp3  (Vite proxies these to CDN, no CORS)
// In prod: intercepts cdn.islamic.network/*.mp3 directly (no CORS on Android)
// Both paths → fetch succeeds → ArrayBuffer readable → stored in IDB.

const IDB_NAME        = 'quran-ts-cache';
const IDB_VERSION     = 3;
const IDB_AUDIO_STORE = 'audio';
const CDN_ORIGIN      = 'https://cdn.islamic.network';
const PROXY_PATH      = '/audio-proxy/';

// ── IDB ──────────────────────────────────────────────────────────────────────
let _db = null;
function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('timestamps')) db.createObjectStore('timestamps');
      if (!db.objectStoreNames.contains('quran'))      db.createObjectStore('quran');
      if (!db.objectStoreNames.contains(IDB_AUDIO_STORE)) db.createObjectStore(IDB_AUDIO_STORE);
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror   = e => rej(e.target.error);
  });
}
async function idbGet(key) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const req = db.transaction(IDB_AUDIO_STORE, 'readonly')
                  .objectStore(IDB_AUDIO_STORE).get(key);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror   = e => rej(e.target.error);
  });
}
async function idbSet(key, buf) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx  = db.transaction(IDB_AUDIO_STORE, 'readwrite');
    const req = tx.objectStore(IDB_AUDIO_STORE).put(buf, key);
    req.onerror   = e => rej(e.target.error);
    tx.oncomplete = () => res();
    tx.onerror    = e => rej(e.target.error);
  });
}

const urlToKey = (url) => {
  if (!url) return "";
  try {
    const parts = url.split("/").filter(Boolean);
    if (parts.length === 1) return parts[0];
    const filename = parts.pop() || "";
    const reciter = parts.pop() || "default";
    const bitrate = parts.pop() || "128";
    if (filename.endsWith(".mp3")) {
      return `${reciter}_${bitrate}_${filename}`;
    }
    return filename;
  } catch {
    return url.split("/").pop() || url;
  }
};

function isAudioRequest(url) {
  return (url.includes(PROXY_PATH) || url.startsWith(CDN_ORIGIN)) && url.endsWith('.mp3');
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
const RUNTIME_CACHE = 'quran-runtime-v1';

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

function buildAudioResponse(buf, rangeHeader) {
  const totalLength = buf.byteLength;
  if (rangeHeader) {
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalLength - 1;
      if (start < totalLength && end < totalLength && start <= end) {
        const chunk = buf.slice(start, end + 1);
        return new Response(chunk, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Range': `bytes ${start}-${end}/${totalLength}`,
            'Content-Length': String(chunk.byteLength),
            'Accept-Ranges': 'bytes',
          },
        });
      }
    }
  }
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type':   'audio/mpeg',
      'Content-Length': String(totalLength),
      'Accept-Ranges':  'bytes',
    },
  });
}

function isCacheableRuntimeApi(url) {
  return (
    url.startsWith('https://api.alquran.cloud/v1/') ||
    url.startsWith('https://api.quran.com/api/v4/') ||
    url.startsWith('https://fonts.googleapis.com/') ||
    url.startsWith('https://fonts.gstatic.com/')
  );
}

// ── Fetch interception ────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const reqUrl = e.request.url;

  // 1. Audio requests -> IndexedDB + Range support
  if (isAudioRequest(reqUrl)) {
    const rangeHeader = e.request.headers.get('range');
    e.respondWith((async () => {
      const key = urlToKey(reqUrl);

      // Serve from IDB
      try {
        const buf = await idbGet(key);
        if (buf && buf.byteLength > 0) {
          return buildAudioResponse(buf, rangeHeader);
        }
      } catch {}

      // Fetch from network & cache in IDB
      try {
        const response = await fetch(e.request);
        if (response.ok && response.status === 200) {
          const buf = await response.arrayBuffer();
          if (buf.byteLength > 0) {
            idbSet(key, buf).catch(() => {});
            return buildAudioResponse(buf, rangeHeader);
          }
        }
        return response;
      } catch {
        return new Response(null, { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // 2. Quran API & Google Fonts -> Stale-While-Revalidate / Cache Fallback
  if (isCacheableRuntimeApi(reqUrl)) {
    e.respondWith((async () => {
      try {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(e.request);
        const networkPromise = fetch(e.request).then(res => {
          if (res && res.ok) {
            cache.put(e.request, res.clone()).catch(() => {});
          }
          return res;
        });
        return cached || (await networkPromise);
      } catch {
        const cache = await caches.open(RUNTIME_CACHE).catch(() => null);
        const cached = await cache?.match(e.request);
        return cached || new Response(null, { status: 503, statusText: 'Offline' });
      }
    })());
  }
});

// ── Pre-cache on demand ───────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type !== 'PRECACHE_AUDIO') return;
  const urls = e.data.urls || [];
  (async () => {
    for (const url of urls) {
      try {
        const key = urlToKey(url);
        const existing = await idbGet(key);
        if (existing && existing.byteLength > 0) continue;
        const r = await fetch(url);
        if (r.ok) {
          const buf = await r.arrayBuffer();
          if (buf.byteLength > 0) await idbSet(key, buf);
        }
      } catch {}
    }
  })();
});