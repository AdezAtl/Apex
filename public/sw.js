// Project Apex Service Worker — Offline & Instant Asset Cache
const CACHE_NAME = 'apex-assets-cache-v1';

const STATIC_EXTENSIONS = [
  '.glb',
  '.gltf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.woff2',
  '.woff',
  '.mp3',
  '.ogg',
  '.wav',
];

self.addEventListener('install', (event) => {
  // Activate worker immediately once downloaded
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge outdated caches
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Identify whether request is for game assets, 3D models, textures, or static bundles
  const isGameAsset =
    url.pathname.includes('/assets/') ||
    STATIC_EXTENSIONS.some((ext) => url.pathname.toLowerCase().endsWith(ext)) ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js');

  if (isGameAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Cache-first strategy: if locally stored, return immediately without network overhead
        const cached = await cache.match(req);
        if (cached) {
          return cached;
        }

        try {
          const networkRes = await fetch(req);
          if (networkRes && networkRes.status === 200) {
            // Store fetched asset locally in cache storage for all future loads
            cache.put(req, networkRes.clone());
          }
          return networkRes;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })
    );
  }
});

