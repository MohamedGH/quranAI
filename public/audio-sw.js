// audio-sw.js — Quran Audio & Complete Offline App Shell Service Worker
// Serves at root scope in /public/
// Handles:
// 1. App Shell precaching (index.html, manifest, icons) for 100% offline reload capability
// 2. Navigation fallback (NetworkFirst -> Cache) so app loads anywhere offline
// 3. Audio caching & Range 206 responses via IndexedDB (Islamic Network & EveryAyah)
// 4. Runtime APIs & Fonts Stale-While-Revalidate caching

const APP_SHELL_CACHE = "quran-app-shell-v4";
const RUNTIME_CACHE   = "quran-runtime-v4";
const IDB_NAME        = "quran-ts-cache";
const IDB_VERSION     = 4;
const IDB_AUDIO_STORE = "audio";
const CDN_ORIGIN      = "https://cdn.islamic.network";
const PROXY_PATH      = "/audio-proxy/";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/pwa-maskable-512x512.png",
];

// ── IndexedDB Helpers ─────────────────────────────────────────────────────────
let _db = null;
function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("timestamps")) db.createObjectStore("timestamps");
      if (!db.objectStoreNames.contains("quran")) db.createObjectStore("quran");
      if (!db.objectStoreNames.contains(IDB_AUDIO_STORE)) db.createObjectStore(IDB_AUDIO_STORE);
    };
    req.onsuccess = (e) => {
      _db = e.target.result;
      res(_db);
    };
    req.onerror = (e) => rej(e.target.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const req = db.transaction(IDB_AUDIO_STORE, "readonly").objectStore(IDB_AUDIO_STORE).get(key);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror = (e) => rej(e.target.error);
  });
}

async function idbSet(key, buf) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_AUDIO_STORE, "readwrite");
    const req = tx.objectStore(IDB_AUDIO_STORE).put(buf, key);
    req.onerror = (e) => rej(e.target.error);
    tx.oncomplete = () => res();
    tx.onerror = (e) => rej(e.target.error);
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
  return (
    (url.includes(PROXY_PATH) ||
      url.startsWith(CDN_ORIGIN) ||
      url.includes("everyayah.com") ||
      url.includes("islamic.network")) &&
    url.includes(".mp3")
  );
}

function buildAudioResponse(buf, rangeHeader) {
  const totalLength = buf.byteLength || buf.size || 0;
  if (rangeHeader && buf.slice) {
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalLength - 1;
      if (start < totalLength && end < totalLength && start <= end) {
        const chunk = buf.slice(start, end + 1);
        return new Response(chunk, {
          status: 206,
          statusText: "Partial Content",
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Range": `bytes ${start}-${end}/${totalLength}`,
            "Content-Length": String(chunk.byteLength || chunk.size),
            "Accept-Ranges": "bytes",
          },
        });
      }
    }
  }
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(totalLength),
      "Accept-Ranges": "bytes",
    },
  });
}

function isCacheableRuntimeApi(url) {
  return (
    url.startsWith("https://api.alquran.cloud/v1/") ||
    url.startsWith("https://api.quran.com/api/v4/") ||
    url.startsWith("https://fonts.googleapis.com/") ||
    url.startsWith("https://fonts.gstatic.com/")
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("Pre-cache warning:", err);
      });
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== APP_SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch Interception ────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const isDevHost = self.location.hostname.includes("ais-dev") ||
                    self.location.hostname.includes("ais-pre") ||
                    self.location.hostname === "localhost" ||
                    self.location.hostname === "127.0.0.1";
  if (isDevHost) return;
  const reqUrl = e.request.url;

  // Never intercept dev server internal URLs, source files, or Vite HMR
  if (
    reqUrl.includes("/@vite/") ||
    reqUrl.includes("/@fs/") ||
    reqUrl.includes("/@id/") ||
    reqUrl.includes("/src/") ||
    reqUrl.includes("/node_modules/") ||
    reqUrl.includes("?t=") ||
    reqUrl.includes("&t=") ||
    reqUrl.includes("vite.svg")
  ) {
    return;
  }

  // 1. Navigation requests (HTML page loads / reloads)
  if (e.request.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          const fresh = await fetch(e.request);
          if (fresh && fresh.ok) {
            const cache = await caches.open(APP_SHELL_CACHE);
            cache.put(e.request, fresh.clone()).catch(() => {});
            return fresh;
          }
        } catch {}
        // Fallback to cached index.html or cached match
        const cached = await caches.match(e.request);
        if (cached) return cached;
        const shell = await caches.match("/index.html");
        return shell || new Response("Mode hors-ligne disponible", { status: 200, headers: { "Content-Type": "text/html" } });
      })()
    );
    return;
  }

  // 2. Audio requests -> IndexedDB + Range support
  if (isAudioRequest(reqUrl)) {
    const rangeHeader = e.request.headers.get("range");
    e.respondWith(
      (async () => {
        const key = urlToKey(reqUrl);

        // Serve from IndexedDB if cached
        try {
          const buf = await idbGet(key);
          if (buf && (buf.byteLength > 0 || buf.size > 0)) {
            return buildAudioResponse(buf, rangeHeader);
          }
        } catch {}

        // Fetch from network & store in IndexedDB
        try {
          const response = await fetch(e.request);
          if (response.ok && response.status === 200) {
            const buf = await response.arrayBuffer();
            if (buf && buf.byteLength > 0) {
              idbSet(key, buf).catch(() => {});
              return buildAudioResponse(buf, rangeHeader);
            }
          }
          return response;
        } catch {
          return new Response(null, { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  // 3. Quran API & Google Fonts -> Stale-While-Revalidate
  if (isCacheableRuntimeApi(reqUrl)) {
    e.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(e.request);
        const networkPromise = fetch(e.request)
          .then((res) => {
            if (res && res.ok) {
              cache.put(e.request, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => null);

        return cached || (await networkPromise) || new Response(null, { status: 503, statusText: "Offline" });
      })()
    );
    return;
  }

  // 4. Same-origin static assets (.js, .css, images, fonts) — Network-First for prompt updates
  if (reqUrl.startsWith(self.location.origin)) {
    e.respondWith(
      (async () => {
        try {
          const response = await fetch(e.request);
          if (response && response.ok) {
            const cache = await caches.open(APP_SHELL_CACHE);
            cache.put(e.request, response.clone()).catch(() => {});
            return response;
          }
        } catch {}
        const cached = await caches.match(e.request);
        if (cached) return cached;
        return new Response(null, { status: 503, statusText: "Offline" });
      })()
    );
  }
});

// ── Pre-cache on demand ───────────────────────────────────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type === "PRECACHE_AUDIO") {
    const urls = e.data.urls || [];
    (async () => {
      for (const url of urls) {
        try {
          const key = urlToKey(url);
          const existing = await idbGet(key);
          if (existing && (existing.byteLength > 0 || existing.size > 0)) continue;
          const r = await fetch(url);
          if (r.ok) {
            const buf = await r.arrayBuffer();
            if (buf && buf.byteLength > 0) await idbSet(key, buf);
          }
        } catch {}
      }
    })();
  }
});