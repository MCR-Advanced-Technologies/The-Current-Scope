const CACHE_PREFIX = "current-scope";
const CACHE_VERSION = "v9";
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`;

const SCOPE_URL = new URL(self.registration.scope);
const BASE_PATH = SCOPE_URL.pathname.endsWith("/")
  ? SCOPE_URL.pathname
  : `${SCOPE_URL.pathname}/`;
const DEBUG = new URL(self.location.href).searchParams.get("debug") === "1";

const APP_SHELL_FILES = [
  "",
  "index.html",
  "terms.html",
  "styles.css",
  "manifest.webmanifest",
  "icons/favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

const APP_SHELL_URLS = APP_SHELL_FILES.map((file) =>
  new URL(file, SCOPE_URL).toString()
);
const INDEX_FALLBACK_URL = new URL("index.html", SCOPE_URL).toString();

function logDebug(...args) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.info("[SW]", ...args);
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiRequest(url) {
  if (!isSameOrigin(url)) return false;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return true;
  }
  if (BASE_PATH === "/") {
    return url.pathname === "/api" || url.pathname.startsWith("/api/");
  }
  const apiBase = `${BASE_PATH}api`;
  return url.pathname === apiBase || url.pathname.startsWith(`${apiBase}/`);
}

function isYouTubeRequest(url) {
  const host = String(url.hostname || "").toLowerCase();
  const path = String(url.pathname || "").toLowerCase();
  return (
    host.includes("youtube.com") ||
    host.includes("youtube-nocookie.com") ||
    host.includes("googlevideo.com") ||
    path.includes("videoplayback")
  );
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (err) {
    return caches.match(request);
  }
}

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => null);

  if (event) {
    event.waitUntil(networkPromise);
  }

  if (cached) {
    return cached;
  }
  return networkPromise.then((response) => response || fetch(request));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(APP_SHELL_URLS.map((url) => cache.add(url)))
      )
      .catch((err) => {
        logDebug("precache failed", err);
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith(`${CACHE_PREFIX}-`) &&
              key !== STATIC_CACHE &&
              key !== RUNTIME_CACHE
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  const type = event?.data?.type || "";
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isYouTubeRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(INDEX_FALLBACK_URL);
        return cached || Response.error();
      })
    );
    return;
  }

  const sameOrigin = isSameOrigin(url);
  const pathname = url.pathname || "";
  const inAssetsPath =
    sameOrigin &&
    (BASE_PATH === "/"
      ? pathname.startsWith("/assets/")
      : pathname.startsWith(`${BASE_PATH}assets/`));

  if (
    inAssetsPath &&
    ["script", "style", "font", "image"].includes(request.destination)
  ) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE, event));
    return;
  }

  if (sameOrigin && request.destination === "image") {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (
    sameOrigin &&
    ["script", "style", "font"].includes(request.destination)
  ) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(fetch(request));
});
