/* GYAN RISE — Progressive Web App Service Worker
 *
 * Strategies used:
 *   - HTML pages           : network-first with offline fallback
 *   - JS / CSS / fonts     : stale-while-revalidate (fast loads, updates in bg)
 *   - Images / icons       : cache-first (with offline fallback)
 *   - /api/*               : NEVER cached (auth-gated, always live)
 *
 * Versioning: bump CACHE_VERSION on any breaking change to assets/strategy.
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE  = `gyanrise-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `gyanrise-runtime-${CACHE_VERSION}`;

// Precache the app shell so the PWA can launch offline-friendly.
const APP_SHELL = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {
        /* tolerate missing optional assets at install time */
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Allow the app to ask the SW to apply updates immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isNavigationRequest(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

function isStaticAsset(url) {
  return /\.(?:js|css|woff2?|ttf|otf|map)$/.test(url.pathname);
}

function isImage(url) {
  return /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1) NEVER cache API traffic. Auth-gated, always live.
  if (url.pathname.startsWith('/api/')) return;

  // 2) HTML navigations — network-first, fall back to cached shell.
  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/offline.html');
        }
      })()
    );
    return;
  }

  // 3) JS / CSS / fonts — stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })()
    );
    return;
  }

  // 4) Images / icons — cache-first.
  if (isImage(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return cached || Response.error();
        }
      })()
    );
  }
});
