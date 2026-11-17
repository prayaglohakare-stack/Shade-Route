const CACHE_NAME = 'shaderoute-static-v1';
const APP_ROOT = new URL('./', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(APP_ROOT, { cache: 'reload' });
    if (!response.ok) throw new Error('ShadeRoute shell could not be cached.');
    const html = await response.clone().text();
    await cache.put(APP_ROOT, response);
    const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map((match) => match[1]);
    await Promise.all(assetPaths.map(async (path) => {
      const assetUrl = new URL(path, APP_ROOT).href;
      const asset = await fetch(assetUrl, { cache: 'reload' });
      if (asset.ok) await cache.put(assetUrl, asset);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('shaderoute-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(APP_ROOT, response.clone());
      }
      return response;
    }).catch(async () => (await caches.match(request)) ?? (await caches.match(APP_ROOT)) ?? Response.error()));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })));
});
