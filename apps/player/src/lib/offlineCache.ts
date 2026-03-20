/**
 * Módulo de cache offline — coordena o Service Worker para
 * cachear playlists e mídias em IndexedDB/CacheAPI.
 */

const DB_NAME = "viewboard-offline";
const DB_VERSION = 1;
const PLAYLIST_STORE = "playlists";

// ── IndexedDB helpers ───────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PLAYLIST_STORE)) {
        db.createObjectStore(PLAYLIST_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePlaylistToIDB(playlist: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLIST_STORE, "readwrite");
    tx.objectStore(PLAYLIST_STORE).put({
      key: "current",
      playlist,
      savedAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPlaylistFromIDB(): Promise<unknown | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLIST_STORE, "readonly");
    const request = tx.objectStore(PLAYLIST_STORE).get("current");
    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.playlist ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

// ── Service Worker communication ────────────────────────────

function sendSWMessage(
  type: string,
  payload: Record<string, unknown> = {}
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker?.controller) {
      reject(new Error("No active service worker"));
      return;
    }

    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => resolve(event.data);

    navigator.serviceWorker.controller.postMessage(
      { type, payload },
      [channel.port2]
    );

    // Timeout após 30s
    setTimeout(() => reject(new Error("SW message timeout")), 30_000);
  });
}

/**
 * Extrai todas as URLs de mídias de uma playlist.
 */
export function extractMediaUrls(playlist: {
  items?: Array<{ content?: { url?: string; type?: string } }>;
}): string[] {
  if (!playlist?.items) return [];

  return playlist.items
    .filter((item) => {
      const type = item.content?.type;
      return (type === "IMAGE" || type === "VIDEO") && item.content?.url;
    })
    .map((item) => item.content!.url!)
    .filter((url, idx, arr) => arr.indexOf(url) === idx); // dedupe
}

/**
 * Cache proativo de mídias em background após receber playlist.
 */
export async function cachePlaylistMedia(playlist: unknown): Promise<void> {
  // 1. Salvar playlist em IndexedDB
  await savePlaylistToIDB(playlist);

  // 2. Enviar para o SW cachear a playlist
  try {
    await sendSWMessage("CACHE_PLAYLIST", { playlist });
  } catch {
    // SW pode não estar pronto, IndexedDB é o fallback
  }

  // 3. Extrair URLs de mídia e cachear proativamente
  const urls = extractMediaUrls(playlist as Parameters<typeof extractMediaUrls>[0]);
  if (urls.length > 0) {
    try {
      await sendSWMessage("CACHE_MEDIA_URLS", { urls });
    } catch (err) {
      console.warn("[OfflineCache] Failed to cache media via SW:", err);
    }
  }

  // 4. Limpar mídias antigas do cache
  try {
    await sendSWMessage("CLEANUP_OLD_MEDIA", { currentUrls: urls });
  } catch {
    // Silencioso
  }
}

/**
 * Carrega a playlist cacheada (IndexedDB primeiro, depois SW cache).
 */
export async function loadCachedPlaylist(): Promise<unknown | null> {
  // Tentar IndexedDB primeiro
  try {
    const playlist = await getPlaylistFromIDB();
    if (playlist) return playlist;
  } catch {
    // Fallback para SW cache
  }

  // Fallback: SW cache
  try {
    const response = (await sendSWMessage("GET_CACHED_PLAYLIST")) as {
      playlist: unknown;
    };
    return response?.playlist ?? null;
  } catch {
    return null;
  }
}

/**
 * Obtém status do cache de mídias.
 */
export async function getCacheStatus(): Promise<{
  mediaCount: number;
  totalSizeMB: number;
  maxSizeMB: number;
} | null> {
  try {
    const response = (await sendSWMessage("GET_CACHE_STATUS")) as {
      status: { mediaCount: number; totalSizeMB: number; maxSizeMB: number };
    };
    return response?.status ?? null;
  } catch {
    return null;
  }
}

// ── Service Worker Registration ─────────────────────────────

export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    console.warn("[OfflineCache] Service Workers not supported");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      newWorker?.addEventListener("statechange", () => {
        if (newWorker.state === "activated") {
          console.log("[OfflineCache] New service worker activated");
        }
      });
    });

    console.log("[OfflineCache] Service worker registered");
  } catch (err) {
    console.error("[OfflineCache] SW registration failed:", err);
  }
}
