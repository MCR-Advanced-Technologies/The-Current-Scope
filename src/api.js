const SETTINGS_KEY = "newsapp_frontend_settings";
const AUTH_STATE_KEY = "NEWSAPP_AUTH_STATE";
const LEGACY_TOKEN_KEY = "NEWSAPP_API_TOKEN";
const FALLBACK_BASE = "https://api.thecurrentscope.com";
const LEGACY_FALLBACK_BASE = "https://api.thecurrentscope.com";
const BUILD_INFO_URL = (() => {
  if (typeof window === "undefined") return "build.json";
  try {
    return new URL("build.json", window.location.href).toString();
  } catch (err) {
    return "build.json";
  }
})();
const TOKEN_REFRESH_BUFFER_MS = 30 * 60 * 1000;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || "";
const ENV_BUILD_HASH = import.meta.env.VITE_BUILD_HASH || "";
const ENV_TOKEN =
  import.meta.env.VITE_FRONTEND_API_TOKEN ||
  import.meta.env.VITE_API_TOKEN ||
  "";
const CLIENT_TOKEN =
  import.meta.env.VITE_APP_CLIENT_TOKEN ||
  import.meta.env.VITE_FRONTEND_CLIENT_TOKEN ||
  "";

let buildHashCache = "";
let webTokenMemory = "";

function getClientHeaders() {
  if (typeof window === "undefined") return {};
  const ua = window.navigator?.userAgent || "";
  const isCapacitor =
    /Capacitor|Cordova/i.test(ua) ||
    (typeof window !== "undefined" && !!window.Capacitor);
  const isElectron =
    /Electron/i.test(ua) ||
    (typeof window !== "undefined" && !!window.NewsAppUpdater);
  const platform = isElectron ? "electron" : isCapacitor ? "android" : "web";
  const isApp = isElectron || isCapacitor;
  const headers = {
    "X-NewsApp-Client": isApp ? "app" : "web",
    "X-NewsApp-Platform": platform,
  };
  if (CLIENT_TOKEN) {
    headers["X-NewsApp-Client-Token"] = CLIENT_TOKEN;
  }
  return headers;
}


function isAppRuntime() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator?.userAgent || "";
  const protocol = window.location?.protocol || "";
  const isCapacitor =
    /Capacitor|Cordova/i.test(ua) ||
    (typeof window !== "undefined" && !!window.Capacitor) ||
    ["capacitor:", "ionic:", "app:"] .includes(protocol);
  const isElectron =
    /Electron/i.test(ua) ||
    (typeof window !== "undefined" && !!window.NewsAppUpdater);
  return isElectron || isCapacitor;
}

async function getPreferencesStore() {
  if (typeof window === "undefined" || !window.Capacitor) return null;
  try {
    const plugin =
      window.Capacitor?.Plugins?.Preferences ||
      window.Capacitor?.Preferences ||
      null;
    if (!plugin || typeof plugin.get !== "function" || typeof plugin.set !== "function") {
      return null;
    }
    return plugin;
  } catch (err) {
    return null;
  }
}

async function readAuthState() {
  if (typeof window === "undefined") return {};
  try {
    if (window.NewsAppUpdater?.getAuthState) {
      const state = await window.NewsAppUpdater.getAuthState();
      return state || {};
    }
  } catch (err) {
    // ignore
  }
  const prefs = await getPreferencesStore();
  if (prefs) {
    try {
      const stored = await prefs.get({ key: AUTH_STATE_KEY });
      return stored?.value ? JSON.parse(stored.value) : {};
    } catch (err) {
      return {};
    }
  }
  try {
    const raw = window.localStorage.getItem(AUTH_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

async function writeAuthState(nextState) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(nextState || {});
  try {
    if (window.NewsAppUpdater?.setAuthState) {
      await window.NewsAppUpdater.setAuthState(nextState || {});
      return;
    }
  } catch (err) {
    // ignore
  }
  const prefs = await getPreferencesStore();
  if (prefs) {
    try {
      await prefs.set({ key: AUTH_STATE_KEY, value: payload });
      return;
    } catch (err) {
      // ignore
    }
  }
  try {
    window.localStorage.setItem(AUTH_STATE_KEY, payload);
  } catch (err) {
    // ignore
  }
}

async function updateAuthState(patch) {
  const current = await readAuthState();
  const nextState = { ...current, ...(patch || {}) };
  await writeAuthState(nextState);
  return nextState;
}

async function ensureDeviceId() {
  const current = await readAuthState();
  if (current.deviceId) return current.deviceId;
  let nextId = "";
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    nextId = crypto.randomUUID();
  } else {
    nextId = `device_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }
  await updateAuthState({ deviceId: nextId });
  return nextId;
}

function normalizeExpiry(value) {
  if (!value) return "";
  if (typeof value !== "string") return "";
  if (value.includes("T")) return value;
  return new Date(`${value.replace(" ", "T")}Z`).toISOString();
}

function isExpired(expiresAt) {
  if (!expiresAt) return true;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return true;
  return ts - TOKEN_REFRESH_BUFFER_MS <= Date.now();
}

async function getBuildHash() {
  if (buildHashCache) return buildHashCache;
  if (ENV_BUILD_HASH) {
    buildHashCache = ENV_BUILD_HASH;
    return buildHashCache;
  }
  if (typeof window === "undefined") return "";
  try {
    const res = await fetch(BUILD_INFO_URL, { cache: "no-store" });
    if (!res.ok) return "";
    const data = await res.json();
    const hash =
      data?.build_hash ||
      data?.buildHash ||
      data?.hash ||
      "";
    if (hash) {
      buildHashCache = String(hash);
      return buildHashCache;
    }
  } catch (err) {
    return "";
  }
  return "";
}

function normalizeBase(value) {
  if (!value) return "";
  let candidate = String(value).trim();
  if (!candidate) return "";
  candidate = candidate.replace(
    "newsapp_backend.rousehouse.net",
    "newsapp-backend.rousehouse.net"
  );
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${path}`;
  } catch (err) {
    return "";
  }
}

function mapLegacyBackendToProxy(baseUrl) {
  if (typeof window === "undefined" || isAppRuntime()) return baseUrl;
  if (!baseUrl) return "";
  try {
    const parsed = new URL(baseUrl);
    const host = (parsed.hostname || "").toLowerCase();
    if (
      host === "newsapp-backend.rousehouse.net" ||
      host === "newsapp_backend.rousehouse.net"
    ) {
      const protocol =
        window.location.protocol === "https:" || window.location.protocol === "http:"
          ? window.location.protocol
          : "https:";
      const hostWithPort = window.location.host || "";
      if (!hostWithPort) return baseUrl;
      return `${protocol}//${hostWithPort}/api`;
    }
    return baseUrl;
  } catch (err) {
    return baseUrl;
  }
}
function readStoredBase() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return "";
    const data = JSON.parse(raw);
    return mapLegacyBackendToProxy(normalizeBase(data?.backendUrl));
  } catch (err) {
    return "";
  }
}

function buildDefaultBase() {
  const envBase = import.meta.env.VITE_BACKEND_URL;
  const envNormalized = normalizeBase(envBase);
  if (envNormalized) {
    return envNormalized;
  }
  if (typeof window !== "undefined") {
    if (!isAppRuntime()) {
      const protocol =
        window.location.protocol === "https:" || window.location.protocol === "http:"
          ? window.location.protocol
          : "https:";
      const hostWithPort = window.location.host || "";
      if (hostWithPort) {
        return `${protocol}//${hostWithPort}/api`;
      }
    }
    const protocol =
      window.location.protocol === "https:" || window.location.protocol === "http:"
        ? window.location.protocol
        : "https:";
    const host = window.location.hostname || "";
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local");
    if (host && isLocal && import.meta.env.DEV) {
      const port = import.meta.env.VITE_BACKEND_PORT || "8001";
      return `${protocol}//${host}:${port}`;
    }
  }
  return FALLBACK_BASE;
}

export function getBackendUrl() {
  return readStoredBase() || buildDefaultBase() || LEGACY_FALLBACK_BASE;
}

async function readLegacyToken() {
  if (typeof window === "undefined") return "";
  try {
    const runtimeToken =
      window.__NEWSAPP_API_TOKEN__ ||
      window.NEWSAPP_API_TOKEN ||
      "";
    if (webTokenMemory) {
      return webTokenMemory;
    }
    // Migrate any previously persisted token into memory only, then remove it.
    const stored = window.localStorage.getItem(LEGACY_TOKEN_KEY) || "";
    if (stored) {
      webTokenMemory = stored;
      try {
        window.localStorage.removeItem(LEGACY_TOKEN_KEY);
      } catch (err) {
        // ignore migration cleanup failure
      }
      return webTokenMemory;
    }
    webTokenMemory = ENV_TOKEN || runtimeToken || "";
    return webTokenMemory;
  } catch (err) {
    return webTokenMemory || ENV_TOKEN || "";
  }
}

export async function setToken(token) {
  if (isAppRuntime()) {
    const next = token ? String(token) : "";
    await updateAuthState({
      token: next,
      expiresAt: "",
      buildHash: "",
    });
    return;
  }
  if (typeof window === "undefined") return;
  webTokenMemory = token ? String(token) : "";
  try {
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch (err) {
    // ignore
  }
}

export async function getToken() {
  if (isAppRuntime()) {
    const state = await readAuthState();
    return state.token || "";
  }
  return readLegacyToken();
}

async function requestAppToken() {
  const buildHash = await getBuildHash();
  if (!buildHash) {
    throw new Error("Missing build hash for app authentication.");
  }
  const deviceId = await ensureDeviceId();
  const base = getBackendUrl();
  const platform = getClientHeaders()["X-NewsApp-Platform"] || "unknown";
  const payload = {
    build_hash: buildHash,
    device_id: deviceId,
    platform,
    app_version: APP_VERSION || "unknown",
  };
  const res = await fetch(`${base}/auth/app-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getClientHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Token request failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  const expiresAt = normalizeExpiry(data?.expires_at || "");
  await updateAuthState({
    token: data?.token || "",
    expiresAt,
    deviceId,
    buildHash,
  });
  return data?.token || "";
}

async function ensureAppToken(forceRefresh = false) {
  if (!isAppRuntime()) {
    return readLegacyToken();
  }
  const state = await readAuthState();
  const currentBuildHash = await getBuildHash();
  const buildMismatch =
    currentBuildHash &&
    state.buildHash &&
    currentBuildHash !== state.buildHash;
  const buildMissing = currentBuildHash && !state.buildHash;
  if (buildMismatch || buildMissing) {
    forceRefresh = true;
  }
  if (!forceRefresh && state.token && !isExpired(state.expiresAt)) {
    return state.token;
  }
  const legacy = await readLegacyToken();
  if (!forceRefresh && legacy && legacy.startsWith("news_")) {
    await updateAuthState({ token: legacy, expiresAt: "" });
    return legacy;
  }
  return requestAppToken();
}

async function getAuthHeaders() {
  const token = await ensureAppToken();
  const headers = { ...getClientHeaders() };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(url, init, timeoutMs, controller) {
  const safeTimeout = Number(timeoutMs);
  if (!safeTimeout || Number.isNaN(safeTimeout) || safeTimeout <= 0) {
    return fetch(url, init);
  }
  let timeoutId = null;
  let timedOut = false;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      if (controller) {
        try {
          controller.abort();
        } catch (err) {
          // Ignore abort errors for unsupported runtimes.
        }
      }
      reject(new Error("Read-only request timed out."));
    }, safeTimeout);
  });
  const fetchPromise = fetch(url, init);
  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    if (timedOut) {
      fetchPromise.catch(() => {});
    }
    throw err;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchWithAuth(url, init = {}, options = {}) {
  const attempt = async () => {
    const headers = await getAuthHeaders();
    return fetch(url, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
    });
  };
  let res = await attempt();
  if ((res.status === 401 || res.status === 403) && isAppRuntime()) {
    try {
      await ensureAppToken(true);
      res = await attempt();
    } catch (err) {
      // ignore refresh errors, fall through
    }
  }
  return res;
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.trunc(parsed);
  return Math.max(min, Math.min(max, rounded));
}

function normalizeWeatherParams(params = {}) {
  const allowedSortBy = new Set([
    "weather_time",
    "location_name",
    "temperature",
    "apparent_temperature",
  ]);
  const next = { ...(params || {}) };
  const sortBy = String(next.sort_by || "weather_time").trim().toLowerCase();
  const sortDir = String(next.sort_dir || "desc").trim().toLowerCase();
  const search = String(next.search || "").trim();
  const country = String(next.country || "").trim();
  const resolveRaw = String(next.resolve || "").trim().toLowerCase();
  const resolve =
    resolveRaw === "true" ||
    resolveRaw === "1" ||
    next.resolve === true;

  next.search = search || "all";
  if (country) {
    next.country = country;
  } else {
    delete next.country;
  }
  next.sort_by = allowedSortBy.has(sortBy) ? sortBy : "weather_time";
  next.sort_dir = sortDir === "asc" ? "asc" : "desc";
  next.limit = clampInt(next.limit, 1, 1000, 200);
  next.offset = clampInt(next.offset, 0, 1000000, 0);
  next.resolve = resolve ? "true" : undefined;
  if (resolve) {
    next.resolve_limit = clampInt(next.resolve_limit, 1, 40, 12);
  } else {
    delete next.resolve_limit;
  }
  return next;
}

async function buildHttpError(res, fallbackMessage) {
  let payload = null;
  let detail = "";
  try {
    const text = await res.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (err) {
        payload = text;
      }
    }
  } catch (err) {
    payload = null;
  }

  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.detail)) {
      detail = payload.detail
        .map((item) => {
          if (!item) return "";
          if (typeof item === "string") return item;
          if (item.msg) return String(item.msg);
          if (item.message) return String(item.message);
          return "";
        })
        .filter(Boolean)
        .join("; ");
    } else if (typeof payload.detail === "string") {
      detail = payload.detail;
    } else if (typeof payload.message === "string") {
      detail = payload.message;
    }
  } else if (typeof payload === "string") {
    detail = payload;
  }

  const message = detail
    ? `${fallbackMessage}: ${detail}`
    : `${fallbackMessage} (HTTP ${res.status})`;
  const error = new Error(message);
  error.status = res.status;
  error.httpStatus = res.status;
  error.detail = detail;
  error.detailMessage = detail;
  error.payload = payload;
  return error;
}

export async function fetchArticles(params = {}, requestOptions = {}) {
  const base = getBackendUrl();
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) qs.set(k, v);
  });
  const url = `${base}/articles?${qs.toString()}`;
  const res = await fetchWithAuth(url, {
    cache: "no-store",
    signal: requestOptions.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchVideos(params = {}, requestOptions = {}) {
  const base = getBackendUrl();
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, v);
  });
  const url = `${base}/videos?${qs.toString()}`;
  const res = await fetchWithAuth(url, {
    cache: "no-store",
    signal: requestOptions.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchVideoPlayback(sourceUrl, requestOptions = {}) {
  const base = getBackendUrl();
  const value = String(sourceUrl || "").trim();
  if (!value) {
    throw new Error("Missing video source URL.");
  }
  const qs = new URLSearchParams();
  qs.set("url", value);
  const res = await fetchWithAuth(`${base}/videos/playback?${qs.toString()}`, {
    cache: "no-store",
    signal: requestOptions.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchRadios(params = {}, requestOptions = {}) {
  const base = getBackendUrl();
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, v);
  });
  const url = `${base}/radios?${qs.toString()}`;
  const res = await fetchWithAuth(url, {
    cache: "no-store",
    signal: requestOptions.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchWeather(params = {}, requestOptions = {}) {
  const base = getBackendUrl();
  const normalized = normalizeWeatherParams(params);
  const qs = new URLSearchParams();
  Object.entries(normalized).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, v);
  });
  const url = `${base}/weather?${qs.toString()}`;
  const res = await fetchWithAuth(url, {
    cache: "no-store",
    signal: requestOptions.signal,
  });
  if (!res.ok) {
    throw await buildHttpError(res, "Weather request failed");
  }
  return res.json();
}

export async function fetchProviderStats() {
  const base = getBackendUrl();
  const res = await fetchWithAuth(`${base}/stats/providers`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchSourceStats() {
  const base = getBackendUrl();
  const res = await fetchWithAuth(`${base}/stats/sources`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchArticleCount() {
  const base = getBackendUrl();
  const res = await fetchWithAuth(`${base}/stats/article_count`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchLastUpdated() {
  const base = getBackendUrl();
  const res = await fetchWithAuth(`${base}/stats/last_updated`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchReadableHtml(articleUrl, options = {}) {
  const base = getBackendUrl();
  const params = new URLSearchParams();
  params.set("url", articleUrl);
  const appFlag =
    options.app !== undefined ? options.app : isAppRuntime();
  if (appFlag) {
    params.set("app", "1");
  }
  if (options.params && typeof options.params === "object") {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, value);
      }
    });
  }
  const timeoutMs = Number(options.timeoutMs || 20000);
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const headers = await getAuthHeaders();
  const requestInit = {
    headers,
    cache: "no-store",
  };
  if (controller) {
    requestInit.signal = controller.signal;
  }
  try {
    const res = await fetchWithTimeout(
      `${base}/articles/readable?${params.toString()}`,
      requestInit,
      timeoutMs,
      controller
    );
    if (res.ok) {
      return res.text();
    }
    if ((res.status === 401 || res.status === 403) && isAppRuntime()) {
      await ensureAppToken(true);
      const retryHeaders = await getAuthHeaders();
      const retry = await fetchWithTimeout(
        `${base}/articles/readable?${params.toString()}`,
        { headers: retryHeaders, cache: "no-store" },
        timeoutMs,
        null
      );
      if (retry.ok) return retry.text();
      throw new Error(`HTTP ${retry.status}`);
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error("Read-only request timed out.");
    }
    throw err;
  }
}

export async function fetchNow() {
  const base = getBackendUrl();
  const res = await fetchWithAuth(`${base}/service/fetch-now`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function serviceStart() {
  const base = getBackendUrl();
  const res = await fetchWithAuth(`${base}/service/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function serviceStop() {
  const base = getBackendUrl();
  const res = await fetchWithAuth(`${base}/service/stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default {
  fetchArticles,
  fetchVideos,
  fetchVideoPlayback,
  fetchRadios,
  fetchWeather,
  fetchProviderStats,
  fetchSourceStats,
  fetchNow,
  serviceStart,
  serviceStop,
  setToken,
  getToken,
  getBackendUrl,
  fetchReadableHtml,
};

