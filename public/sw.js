/*
 * Trade Buty service worker — R13.13 PWA offline fallback.
 *
 * Deliberately minimal: the ONLY precached entry is the static offline
 * guidance page. Page HTML, API responses and name-stable content products
 * (search-index.json, knowledge-assets) are never cached here, so the
 * knowledge-base freshness contract in docs/caching.md §4 is unchanged.
 *
 * Editing public/offline.html requires bumping CACHE_VERSION below, otherwise
 * returning visitors keep serving the previous copy from the old cache.
 * src/lib/service-worker.test.ts guards the structure of this file.
 */
// OFFLINE_PAGE_SHA256: 291b802fe023bcb6b5394c3265a1d5d926d468828dee486f427bbaaea857fe6c
const CACHE_VERSION = "trade-buty-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      // A failed precache must not brick the worker: requests fall through to
      // the network, and lastResortResponse() covers the offline navigation.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function lastResortResponse() {
  return new Response(
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      "<title>离线 · Trade Buty</title>" +
      '<body style="margin:0;padding:32px;background:#0a0d14;color:#e6eaf2;' +
      'font-family:system-ui,sans-serif;line-height:1.6">' +
      "<h1>离线 / Offline</h1>" +
      "<p>无法加载离线页，请检查网络后重试。<br>Check your connection and reload.</p>" +
      "</body></html>",
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only same-origin document navigations get a fallback. Everything else
  // (search index, knowledge assets, API routes, RSC payloads) goes straight
  // to the network so content freshness and personalisation are preserved.
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() =>
      caches
        .open(CACHE_VERSION)
        .then((cache) => cache.match(OFFLINE_URL))
        .then((cached) => cached || lastResortResponse())
    )
  );
});
