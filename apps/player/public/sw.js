// ViewBoard Player - Service Worker para modo offline
const CACHE_NAME = 'viewboard-player-v1';
const MEDIA_CACHE_NAME = 'viewboard-media-v1';
const MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB default

// Assets estáticos do player
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

// ── Instalação ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Ativação ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== MEDIA_CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch interceptor ───────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Para mídias (imagens e vídeos), usar cache-first
  if (isMediaRequest(url)) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => {
            return new Response('Offline - media not cached', { status: 503 });
          });
        })
      )
    );
    return;
  }

  // Para assets estáticos (JS, CSS, HTML), usar stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => cached);

          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Para API calls, tentar network primeiro, fallback para cache
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cloned);
            });
          }
          return response;
        })
        .catch(() =>
          caches.open(CACHE_NAME).then((cache) => cache.match(event.request))
        )
    );
    return;
  }
});

// ── Mensagens do cliente ────────────────────────────────────
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'CACHE_MEDIA_URLS':
      cacheMediaUrls(payload.urls).then(() => {
        event.ports[0]?.postMessage({ type: 'CACHE_COMPLETE', success: true });
      }).catch((err) => {
        event.ports[0]?.postMessage({ type: 'CACHE_COMPLETE', success: false, error: err.message });
      });
      break;

    case 'CACHE_PLAYLIST':
      cachePlaylist(payload.playlist).then(() => {
        event.ports[0]?.postMessage({ type: 'PLAYLIST_CACHED', success: true });
      });
      break;

    case 'GET_CACHED_PLAYLIST':
      getCachedPlaylist().then((playlist) => {
        event.ports[0]?.postMessage({ type: 'CACHED_PLAYLIST', playlist });
      });
      break;

    case 'CLEANUP_OLD_MEDIA':
      cleanupOldMedia(payload.currentUrls).then((removed) => {
        event.ports[0]?.postMessage({ type: 'CLEANUP_COMPLETE', removed });
      });
      break;

    case 'GET_CACHE_STATUS':
      getCacheStatus().then((status) => {
        event.ports[0]?.postMessage({ type: 'CACHE_STATUS', status });
      });
      break;
  }
});

// ── Helpers ─────────────────────────────────────────────────

function isMediaRequest(url) {
  const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.svg'];
  const path = url.pathname.toLowerCase();
  return mediaExtensions.some((ext) => path.endsWith(ext)) ||
    url.hostname.includes('minio') ||
    path.includes('/media/') ||
    path.includes('/uploads/');
}

function isStaticAsset(url) {
  const path = url.pathname;
  return path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.html') ||
    path.endsWith('.woff2') || path.endsWith('.woff') || path === '/';
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

async function cacheMediaUrls(urls) {
  if (!urls || urls.length === 0) return;
  const cache = await caches.open(MEDIA_CACHE_NAME);

  // Baixar em paralelo com limite de concorrência
  const CONCURRENCY = 3;
  const queue = [...urls];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) continue;
      try {
        const existing = await cache.match(url);
        if (existing) continue; // Já está em cache
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (err) {
        console.warn('[SW] Failed to cache media:', url, err.message);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  // Verificar tamanho do cache
  await enforceMaxCacheSize();
}

async function cachePlaylist(playlist) {
  const cache = await caches.open(CACHE_NAME);
  const response = new Response(JSON.stringify(playlist), {
    headers: { 'Content-Type': 'application/json' },
  });
  await cache.put(new Request('/_viewboard/cached-playlist'), response);
}

async function getCachedPlaylist() {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(new Request('/_viewboard/cached-playlist'));
  if (!response) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function cleanupOldMedia(currentUrls) {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const keys = await cache.keys();
  const currentSet = new Set(currentUrls || []);
  let removed = 0;

  for (const request of keys) {
    if (!currentSet.has(request.url)) {
      await cache.delete(request);
      removed++;
    }
  }

  return removed;
}

async function enforceMaxCacheSize() {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const keys = await cache.keys();

  // Estimar tamanho total
  let totalSize = 0;
  const entries = [];

  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.clone().blob();
      entries.push({ request, size: blob.size });
      totalSize += blob.size;
    }
  }

  // Se exceder o limite, remover os mais antigos
  if (totalSize > MAX_CACHE_SIZE_BYTES) {
    // Remover do início (mais antigos) até ficar dentro do limite
    for (const entry of entries) {
      if (totalSize <= MAX_CACHE_SIZE_BYTES) break;
      await cache.delete(entry.request);
      totalSize -= entry.size;
    }
  }
}

async function getCacheStatus() {
  const mediaCache = await caches.open(MEDIA_CACHE_NAME);
  const keys = await mediaCache.keys();

  let totalSize = 0;
  for (const request of keys) {
    const response = await mediaCache.match(request);
    if (response) {
      const blob = await response.clone().blob();
      totalSize += blob.size;
    }
  }

  return {
    mediaCount: keys.length,
    totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
    maxSizeMB: MAX_CACHE_SIZE_BYTES / (1024 * 1024),
  };
}
