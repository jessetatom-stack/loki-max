const BUILD = '20260320-v12';
const CACHE = `loki-max-${BUILD}`;
const CORE_ASSETS = [
  './',
  `./index.html?v=${BUILD}`,
  `./styles.css?v=${BUILD}`,
  `./app.js?v=${BUILD}`,
  `./manifest.webmanifest?v=${BUILD}`,
  `./icon-192.png?v=${BUILD}`,
  `./icon-512.png?v=${BUILD}`
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE_ASSETS)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('loki-max-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'APP_UPDATED', build: BUILD }));
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    const fallback = await cache.match('./index.html?v=' + BUILD);
    if (fallback) return fallback;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: false });
  const fetchPromise = fetch(request).then(response => {
    cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fetchPromise || fetch(request);
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';
  const isCoreAsset = ['.css', '.js', '.png', '.webmanifest'].some(ext => url.pathname.endsWith(ext));

  if (isNavigation) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isCoreAsset) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
});
