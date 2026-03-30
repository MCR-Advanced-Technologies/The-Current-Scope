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
const WEATHER_HOURLY_CAPABILITY_KEY = "newsapp_weather_hourly_capability_v1";
const WEATHER_DAILY_CAPABILITY_KEY = "newsapp_weather_daily_capability_v1";
const KNOWN_NO_HOURLY_ENDPOINT_HOSTS = new Set();
const KNOWN_NO_DAILY_ENDPOINT_HOSTS = new Set();

let buildHashCache = "";
let webTokenMemory = "";
const weatherHourlyEndpointSupportByBase = new Map();
const weatherDailyEndpointSupportByBase = new Map();

function getBaseHost(base) {
  try {
    return String(new URL(String(base || "")).hostname || "").toLowerCase();
  } catch (err) {
    return "";
  }
}

function loadHourlyCapabilityCache() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(WEATHER_HOURLY_CAPABILITY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    Object.entries(parsed).forEach(([base, supported]) => {
      if (typeof base !== "string") return;
      if (typeof supported !== "boolean") return;
      weatherHourlyEndpointSupportByBase.set(base, supported);
    });
  } catch (err) {
    // ignore storage parse errors
  }
}

function loadDailyCapabilityCache() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(WEATHER_DAILY_CAPABILITY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    Object.entries(parsed).forEach(([base, supported]) => {
      if (typeof base !== "string") return;
      if (typeof supported !== "boolean") return;
      weatherDailyEndpointSupportByBase.set(base, supported);
    });
  } catch (err) {
    // ignore storage parse errors
  }
}

function saveHourlyCapabilityCache() {
  if (typeof window === "undefined") return;
  try {
    const payload = {};
    weatherHourlyEndpointSupportByBase.forEach((supported, base) => {
      if (typeof base === "string" && typeof supported === "boolean") {
        payload[base] = supported;
      }
    });
    window.localStorage.setItem(WEATHER_HOURLY_CAPABILITY_KEY, JSON.stringify(payload));
  } catch (err) {
    // ignore storage write errors
  }
}

function saveDailyCapabilityCache() {
  if (typeof window === "undefined") return;
  try {
    const payload = {};
    weatherDailyEndpointSupportByBase.forEach((supported, base) => {
      if (typeof base === "string" && typeof supported === "boolean") {
        payload[base] = supported;
      }
    });
    window.localStorage.setItem(WEATHER_DAILY_CAPABILITY_KEY, JSON.stringify(payload));
  } catch (err) {
    // ignore storage write errors
  }
}

function seedHourlyCapability(base) {
  if (!base || weatherHourlyEndpointSupportByBase.has(base)) return;
  const host = getBaseHost(base);
  if (KNOWN_NO_HOURLY_ENDPOINT_HOSTS.has(host)) {
    weatherHourlyEndpointSupportByBase.set(base, false);
  }
}

function seedDailyCapability(base) {
  if (!base || weatherDailyEndpointSupportByBase.has(base)) return;
  const host = getBaseHost(base);
  if (KNOWN_NO_DAILY_ENDPOINT_HOSTS.has(host)) {
    weatherDailyEndpointSupportByBase.set(base, false);
  }
}

function setHourlyCapability(base, supported) {
  if (!base || typeof supported !== "boolean") return;
  weatherHourlyEndpointSupportByBase.set(base, supported);
  saveHourlyCapabilityCache();
}

function setDailyCapability(base, supported) {
  if (!base || typeof supported !== "boolean") return;
  weatherDailyEndpointSupportByBase.set(base, supported);
  saveDailyCapabilityCache();
}

loadHourlyCapabilityCache();
loadDailyCapabilityCache();

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
    "newsapp.backend.rousehouse.net",
    "newsapp-backend.rousehouse.net"
  );
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
    const currentHost = (window.location.hostname || "").toLowerCase();
    const currentPath = parsed.pathname.replace(/\/+$/, "") || "/";
    if (
      host === "newsapp-backend.rousehouse.net" ||
      host === "newsapp_backend.rousehouse.net" ||
      host === "newsapp.backend.rousehouse.net"
    ) {
      const protocol =
        window.location.protocol === "https:" || window.location.protocol === "http:"
          ? window.location.protocol
          : "https:";
      const hostWithPort = window.location.host || "";
      if (!hostWithPort) return baseUrl;
      return `${protocol}//${hostWithPort}/api`;
    }
    const usesLocalProxy =
      currentHost === "localhost" ||
      currentHost === "127.0.0.1" ||
      currentHost.endsWith(".local") ||
      currentHost.endsWith(".rousehouse.net");
    if (!usesLocalProxy && host === currentHost && currentPath === "/api") {
      return FALLBACK_BASE;
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
  if (typeof window !== "undefined") {
    const envBase = import.meta.env.VITE_BACKEND_URL;
    const envNormalized = normalizeBase(envBase);
    const protocol =
      window.location.protocol === "https:" || window.location.protocol === "http:"
        ? window.location.protocol
        : "https:";
    const host = window.location.hostname || "";
    const hostWithPort = window.location.host || "";
    const usesLocalProxy =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      host.endsWith(".rousehouse.net");
    if (!isAppRuntime() && usesLocalProxy && hostWithPort) {
      return `${protocol}//${hostWithPort}/api`;
    }
    if (envNormalized) {
      return mapLegacyBackendToProxy(envNormalized);
    }
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local");
    if (host && isLocal && import.meta.env.DEV) {
      const port = import.meta.env.VITE_BACKEND_PORT || "8001";
      return `${protocol}//${host}:${port}`;
    }
    if (!isAppRuntime()) {
      return FALLBACK_BASE;
    }
  }
  return FALLBACK_BASE;
}

export function getBackendUrl() {
  const value = readStoredBase() || buildDefaultBase() || LEGACY_FALLBACK_BASE;
  return mapLegacyBackendToProxy(value);
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
  const timeoutMs = Number(options?.timeoutMs || 0);
  const controller = options?.controller || null;
  const attempt = async () => {
    const headers = await getAuthHeaders();
    return fetchWithTimeout(
      url,
      {
        ...init,
        headers: { ...headers, ...(init.headers || {}) },
      },
      timeoutMs,
      controller
    );
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

function mapWeatherRowsToHourly(rows, options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];

  const latitude = Number(options.latitude);
  const longitude = Number(options.longitude);
  const search = String(options.search || "").trim().toLowerCase();
  const country = String(options.country || "").trim().toLowerCase();
  const hours = clampInt(options.hours, 1, 48, 12);
  const now = Date.now();

  const withTs = list
    .filter(Boolean)
    .map((row) => {
      const ts = Date.parse(
        String(
          row.weather_time ||
            row.time ||
            row.time_iso ||
            row.fetched_at ||
            row.created_at ||
            ""
        )
      );
      return { row, ts: Number.isFinite(ts) ? ts : 0 };
    })
    .filter((entry) => entry.ts > 0);

  if (!withTs.length) return [];

  const byLocation = withTs.filter(({ row }) => {
    const name = String(row.location_name || row.search || "").trim().toLowerCase();
    const rowCountry = String(row.country_code || row.country || "").trim().toLowerCase();
    if (search && name && name.includes(search)) return true;
    if (country && rowCountry && rowCountry === country) return true;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const rowLat = Number(row.latitude);
      const rowLon = Number(row.longitude);
      if (Number.isFinite(rowLat) && Number.isFinite(rowLon)) {
        const dLat = Math.abs(rowLat - latitude);
        const dLon = Math.abs(rowLon - longitude);
        return dLat <= 1.25 && dLon <= 1.25;
      }
    }
    return !search && !country;
  });

  const candidate = (byLocation.length ? byLocation : withTs).sort((a, b) => a.ts - b.ts);
  const future = candidate.filter((entry) => entry.ts >= now - 60 * 60 * 1000);
  const source = (future.length ? future : candidate).slice(0, hours);

  return source.map(({ row, ts }) => {
    const weatherCode = Number(row.weather_code);
    const precipAmount = Number(
      row.precipitation_amount ??
        row.precipitation ??
        row.precip_amount ??
        0
    );
    const precipType = String(
      row.precip_type ||
        row.precipType ||
        (Number.isFinite(precipAmount) && precipAmount > 0
          ? Number.isFinite(weatherCode) && weatherCode >= 71 && weatherCode <= 77
            ? "snow"
            : "rain"
          : "none")
    ).toLowerCase();
    const hour = new Date(ts).getHours();
    return {
      time: new Date(ts).toISOString(),
      temperature: Number(row.temperature ?? row.temp ?? row.apparent_temperature),
      condition: String(row.weather_label || row.condition || row.source || "Weather"),
      precip_chance: Number(
        row.precip_chance ??
          row.precip_probability ??
          row.precipitation_probability ??
          0
      ),
      precip_type: precipType,
      is_night:
        typeof row.is_night === "boolean"
          ? row.is_night
          : typeof row.isNight === "boolean"
          ? row.isNight
          : hour < 6 || hour >= 18,
    };
  });
}

function mapWeatherRowsToDaily(rows, options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];
  const search = String(options.search || "").trim().toLowerCase();
  const country = String(options.country || "").trim().toLowerCase();
  const days = clampInt(options.days, 1, 14, 7);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayTs = now.getTime();

  const normalized = list
    .filter(Boolean)
    .map((row) => {
      const ts = Date.parse(
        String(row.weather_time || row.time || row.time_iso || row.fetched_at || row.created_at || "")
      );
      return { row, ts: Number.isFinite(ts) ? ts : 0 };
    })
    .filter((entry) => entry.ts > 0);
  if (!normalized.length) return [];

  const filtered = normalized.filter(({ row }) => {
    const name = String(row.location_name || "").trim().toLowerCase();
    const rowCountry = String(row.country_code || row.country || "").trim().toLowerCase();
    if (search && name && name.includes(search)) return true;
    if (country && rowCountry && rowCountry === country) return true;
    return !search && !country;
  });
  const source = (filtered.length ? filtered : normalized).sort((a, b) => a.ts - b.ts);
  const grouped = new Map();
  source.forEach(({ row, ts }) => {
    if (ts < todayTs) return;
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    if (!grouped.has(key)) {
      grouped.set(key, {
        date: key,
        hi: Number.NEGATIVE_INFINITY,
        lo: Number.POSITIVE_INFINITY,
        precipChance: 0,
        precipAmount: 0,
        windMax: 0,
        condition: "",
        precipType: "none",
      });
    }
    const bucket = grouped.get(key);
    const temp = Number(row.temperature ?? row.temp ?? row.apparent_temperature);
    if (Number.isFinite(temp)) {
      bucket.hi = Math.max(bucket.hi, temp);
      bucket.lo = Math.min(bucket.lo, temp);
    }
    const precipChance = Number(
      row.precip_chance ?? row.precip_probability ?? row.precipitation_probability
    );
    if (Number.isFinite(precipChance)) {
      bucket.precipChance = Math.max(bucket.precipChance, precipChance);
    }
    const precipAmount = Number(row.precipitation_amount ?? row.precipitation ?? 0);
    if (Number.isFinite(precipAmount)) {
      bucket.precipAmount += Math.max(0, precipAmount);
    }
    const wind = Number(row.wind_speed ?? row.wind_speed_max ?? 0);
    if (Number.isFinite(wind)) {
      bucket.windMax = Math.max(bucket.windMax, wind);
    }
    if (!bucket.condition) {
      bucket.condition = String(row.weather_label || row.condition || row.source || "Weather");
    }
    const rowPrecipType = String(row.precip_type || row.precipType || "").toLowerCase();
    if (rowPrecipType && rowPrecipType !== "none") {
      bucket.precipType = rowPrecipType;
    } else if (bucket.precipAmount > 0 && bucket.precipType === "none") {
      bucket.precipType = "rain";
    }
  });

  return Array.from(grouped.values())
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, days)
    .map((row) => ({
      date: `${row.date}T00:00:00`,
      temp_max: Number.isFinite(row.hi) ? row.hi : null,
      temp_min: Number.isFinite(row.lo) ? row.lo : null,
      condition: String(row.condition || "Weather"),
      precip_chance: Number.isFinite(row.precipChance) ? row.precipChance : null,
      precip_type: String(row.precipType || "none"),
      wind_speed_max: Number.isFinite(row.windMax) ? row.windMax : null,
    }));
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
  const timeoutMs = Number(requestOptions.timeoutMs || 12000);
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const requestInit = {
    cache: "no-store",
    signal: requestOptions.signal || controller?.signal,
  };
  try {
    const res = await fetchWithAuth(
      `${base}/videos/playback?${qs.toString()}`,
      requestInit,
      { timeoutMs, controller }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    const message = String(err?.message || "");
    if (err?.name === "AbortError" || /timed out/i.test(message)) {
      throw new Error("Video playback resolution timed out.");
    }
    throw err;
  }
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

export async function fetchWeatherHourly(params = {}, requestOptions = {}) {
  const base = getBackendUrl();
  seedHourlyCapability(base);
  const qs = new URLSearchParams();
  const search = String(params.search || "").trim();
  const country = String(params.country || "").trim();
  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);
  const hours = clampInt(params.hours, 1, 48, 12);

  if (search) qs.set("search", search);
  if (country) qs.set("country", country);
  if (Number.isFinite(latitude)) qs.set("latitude", String(latitude));
  if (Number.isFinite(longitude)) qs.set("longitude", String(longitude));
  qs.set("hours", String(hours));

  const runFallback = async () => {
    const fallbackQs = new URLSearchParams();
    if (search) fallbackQs.set("search", search);
    if (country) fallbackQs.set("country", country);
    fallbackQs.set("sort_by", "weather_time");
    fallbackQs.set("sort_dir", "asc");
    fallbackQs.set("limit", "600");
    fallbackQs.set("offset", "0");
    fallbackQs.set("resolve", "true");
    fallbackQs.set("resolve_limit", String(Math.max(12, hours)));
    const fallbackRes = await fetchWithAuth(`${base}/weather?${fallbackQs.toString()}`, {
      cache: "no-store",
      signal: requestOptions.signal,
    });
    if (fallbackRes.ok) {
      const rows = await fallbackRes.json();
      return {
        hourly: mapWeatherRowsToHourly(rows, {
          latitude,
          longitude,
          search,
          country,
          hours,
        }),
      };
    }
    throw await buildHttpError(
      fallbackRes,
      "Hourly weather request failed and compatibility fallback failed"
    );
  };

  const hourlySupport = weatherHourlyEndpointSupportByBase.get(base);
  if (hourlySupport === false) {
    return runFallback();
  }

  const hourlyUrl = `${base}/weather/hourly?${qs.toString()}`;
  const res = await fetchWithAuth(hourlyUrl, {
    cache: "no-store",
    signal: requestOptions.signal,
  });
  if (res.ok) {
    setHourlyCapability(base, true);
    return res.json();
  }

  // Compatibility path for older backends that do not expose /weather/hourly yet.
  if (res.status === 404) {
    setHourlyCapability(base, false);
    return runFallback();
  }

  if (!res.ok) {
    throw await buildHttpError(res, "Hourly weather request failed");
  }
  return res.json();
}

export async function fetchWeatherDaily(params = {}, requestOptions = {}) {
  const base = getBackendUrl();
  seedDailyCapability(base);
  const qs = new URLSearchParams();
  const search = String(params.search || "").trim();
  const country = String(params.country || "").trim();
  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);
  const days = clampInt(params.days, 1, 14, 7);

  if (search) qs.set("search", search);
  if (country) qs.set("country", country);
  if (Number.isFinite(latitude)) qs.set("latitude", String(latitude));
  if (Number.isFinite(longitude)) qs.set("longitude", String(longitude));
  qs.set("days", String(days));

  const runOpenMeteoDailyFallback = async () => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    const direct = new URL("https://api.open-meteo.com/v1/forecast");
    direct.searchParams.set("latitude", String(latitude));
    direct.searchParams.set("longitude", String(longitude));
    direct.searchParams.set(
      "daily",
      [
        "temperature_2m_max",
        "temperature_2m_min",
        "weather_code",
        "precipitation_probability_max",
        "precipitation_sum",
        "wind_speed_10m_max",
      ].join(",")
    );
    direct.searchParams.set("forecast_days", String(days));
    direct.searchParams.set("timezone", "auto");
    direct.searchParams.set("temperature_unit", "fahrenheit");
    direct.searchParams.set("wind_speed_unit", "mph");
    const directRes = await fetch(direct.toString(), {
      cache: "no-store",
      signal: requestOptions.signal,
    });
    if (!directRes.ok) return null;
    const payload = await directRes.json();
    const daily = payload?.daily || {};
    const times = Array.isArray(daily.time) ? daily.time : [];
    if (!times.length) return { daily: [] };
    const highs = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max : [];
    const lows = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min : [];
    const codes = Array.isArray(daily.weather_code) ? daily.weather_code : [];
    const precipChance = Array.isArray(daily.precipitation_probability_max)
      ? daily.precipitation_probability_max
      : [];
    const precipSum = Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum : [];
    const windMax = Array.isArray(daily.wind_speed_10m_max) ? daily.wind_speed_10m_max : [];
    const mapped = times.slice(0, days).map((t, idx) => {
      const code = Number(codes[idx]);
      const sum = Number(precipSum[idx]);
      const type =
        sum > 0
          ? Number.isFinite(code) && code >= 71 && code <= 77
            ? "snow"
            : Number.isFinite(code) && (code === 96 || code === 99)
            ? "mix"
            : "rain"
          : "none";
      return {
        date: `${String(t)}T00:00:00`,
        temp_max: Number(highs[idx]),
        temp_min: Number(lows[idx]),
        condition: Number.isFinite(code) ? `Code ${code}` : "Weather",
        precip_chance: Number(precipChance[idx]),
        precip_type: type,
        wind_speed_max: Number(windMax[idx]),
      };
    });
    return { daily: mapped };
  };

  const runFallback = async () => {
    const direct = await runOpenMeteoDailyFallback();
    if (direct && Array.isArray(direct.daily) && direct.daily.length) {
      return direct;
    }
    const fallbackQs = new URLSearchParams();
    if (search) fallbackQs.set("search", search);
    if (country) fallbackQs.set("country", country);
    fallbackQs.set("sort_by", "weather_time");
    fallbackQs.set("sort_dir", "asc");
    fallbackQs.set("limit", "1200");
    fallbackQs.set("offset", "0");
    fallbackQs.set("resolve", "true");
    fallbackQs.set("resolve_limit", String(Math.max(14, days)));
    const fallbackRes = await fetchWithAuth(`${base}/weather?${fallbackQs.toString()}`, {
      cache: "no-store",
      signal: requestOptions.signal,
    });
    if (fallbackRes.ok) {
      const rows = await fallbackRes.json();
      return {
        daily: mapWeatherRowsToDaily(rows, {
          search,
          country,
          days,
        }),
      };
    }
    throw await buildHttpError(
      fallbackRes,
      "Daily weather request failed and compatibility fallback failed"
    );
  };

  const dailySupport = weatherDailyEndpointSupportByBase.get(base);
  if (dailySupport === false) {
    return runFallback();
  }

  const res = await fetchWithAuth(`${base}/weather/daily?${qs.toString()}`, {
    cache: "no-store",
    signal: requestOptions.signal,
  });
  if (res.ok) {
    setDailyCapability(base, true);
    return res.json();
  }
  if (res.status === 404) {
    setDailyCapability(base, false);
    return runFallback();
  }
  throw await buildHttpError(res, "Daily weather request failed");
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


export async function fetchTranslationStatus(requestOptions = {}) {
  const base = getBackendUrl();
  const res = await fetchWithAuth(`${base}/translations/status`, {
    cache: "no-store",
    signal: requestOptions.signal,
  });
  if (!res.ok) {
    throw await buildHttpError(res, "Translation status request failed");
  }
  return res.json();
}

export async function translateContent(payload = {}, requestOptions = {}) {
  const base = getBackendUrl();
  const timeoutMs = Number(requestOptions.timeoutMs || 45000);
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const res = await fetchWithAuth(
    `${base}/translations`,
    {
      method: "POST",
      cache: "no-store",
      signal: requestOptions.signal || controller?.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    },
    { timeoutMs, controller }
  );
  if (!res.ok) {
    throw await buildHttpError(res, "Translation request failed");
  }
  return res.json();
}

export async function translateTextBatch(items = [], requestOptions = {}) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) {
    return { items: [] };
  }
  const base = getBackendUrl();
  const res = await fetchWithAuth(
    `${base}/translations/text`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items: list }),
      cache: "no-store",
      signal: requestOptions.signal,
    },
    {
      timeoutMs: Number(requestOptions.timeoutMs || 30000),
      controller: requestOptions.controller,
    }
  );
  if (!res.ok) {
    throw await buildHttpError(res, "Translation request failed");
  }
  return res.json();
}

export async function translateMediaText(payload = {}, requestOptions = {}) {
  const body = payload && typeof payload === "object" ? payload : {};
  const base = getBackendUrl();
  const res = await fetchWithAuth(
    `${base}/translations/media`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: requestOptions.signal,
    },
    {
      timeoutMs: Number(requestOptions.timeoutMs || 30000),
      controller: requestOptions.controller,
    }
  );
  if (!res.ok) {
    throw await buildHttpError(res, "Media translation request failed");
  }
  return res.json();
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
  fetchWeatherHourly,
  fetchWeatherDaily,
  fetchProviderStats,
  fetchSourceStats,
  fetchNow,
  serviceStart,
  serviceStop,
  setToken,
  getToken,
  getBackendUrl,
  fetchReadableHtml,
  translateTextBatch,
  translateMediaText,
};

