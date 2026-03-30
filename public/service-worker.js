// Bump these when changing caching behavior to force clients onto a fresh cache.
const STATIC_CACHE = "newsapp-static-v10";
const RUNTIME_CACHE = "newsapp-runtime-v10";

const APP_SHELL = [
  "/",
  "/index.html",
  "/terms.html",
  "/styles.css",
  "/manifest.webmanifest",
  "/icons/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const OPTIONAL_APP_SHELL = [
  "/installers/README.txt",
  "/installers/install-linux.sh",
];

const INSTALLER_HELPER_PATHS = [
  "/installers/readme.txt",
  "/installers/install-linux.sh",
];

const INSTALLER_MANIFEST_PATHS = [
  "/installers/manifest",
  "/installers/update.json",
];

const INSTALLER_BINARY_EXTENSIONS = [
  ".apk",
  ".appimage",
  ".deb",
  ".dmg",
  ".exe",
  ".msi",
  ".pkg",
  ".zip",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(async (cache) => {
        await cache.addAll(APP_SHELL);
        await Promise.allSettled(
          OPTIONAL_APP_SHELL.map((asset) => cache.add(asset))
        );
      })
      .catch(() => undefined)
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
              key.startsWith("newsapp-") &&
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
    return;
  }
  if (type === "CLEAR_RUNTIME_CACHE") {
    event.waitUntil(caches.delete(RUNTIME_CACHE));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.status === 0)) {
    const copy = response.clone();
    caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

function cacheOnly(request) {
  return caches.match(request);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.status === 0)) {
      const copy = response.clone();
      caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    return await caches.match(request);
  }
}

function networkOnly(request) {
  return fetch(request);
}

self.addEventListener("sync", (event) => {
  if (event.tag === "clear-runtime-cache") {
    event.waitUntil(caches.delete(RUNTIME_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const host = String(url.hostname || "").toLowerCase();
  const pathname = String(url.pathname || "").toLowerCase();
  const isSameOrigin = url.origin === self.location.origin;

  if (
    isSameOrigin &&
    INSTALLER_HELPER_PATHS.includes(pathname)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (
    isSameOrigin &&
    INSTALLER_MANIFEST_PATHS.includes(pathname)
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    isSameOrigin &&
    pathname.startsWith("/installers/") &&
    INSTALLER_BINARY_EXTENSIONS.some((ext) => pathname.endsWith(ext))
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Never inspect/cache YouTube requests. This avoids any accidental CORB issues
  // from touching googlevideo/youtube responses in the service worker.
  if (
    host.includes("youtube.com") ||
    host.includes("youtube-nocookie.com") ||
    host.includes("googlevideo.com") ||
    pathname.includes("videoplayback")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  if (request.destination === "image") {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Avoid freezing the app on an old JS/CSS bundle. Always prefer the network for
  // same-origin scripts/styles, with cached fallback for offline.
  if (
    isSameOrigin &&
    ["script", "style", "font"].includes(request.destination)
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Do not cache third-party scripts/documents. They can break playback and
  // quickly bloat the cache.
  if (
    !isSameOrigin &&
    ["script", "document"].includes(request.destination)
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.startsWith("/articles") || url.pathname.startsWith("/stats")) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
