import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchArticles,
  fetchVideos,
  fetchVideoPlayback,
  fetchRadios,
  fetchWeather,
  fetchProviderStats,
  fetchSourceStats,
  fetchArticleCount,
  fetchLastUpdated,
  fetchReadableHtml,
  getBackendUrl,
} from "./api";
import { extractYouTubeVideoId } from "./youtube.mjs";
import Filters from "./components/Filters";
import ArticlesList from "./components/ArticlesList";
import MediaPlayer from "./components/MediaPlayer";
import ServiceControls from "./components/ServiceControls";
import { AppMenuModal, AppSettingsModal } from "./components/Settings";
import YouTubePlayer from "./components/YouTubePlayer.jsx";


function getVideoThumb(video) {
  if (!video) return "";
  return video.thumbnail_url || video.thumbnailUrl || "";
}

function toUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch (err) {
    try {
      return new URL(`https://${raw}`);
    } catch (err2) {
      return null;
    }
  }
}

function isYouTubeStreamUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (lower.includes("googlevideo.com") || lower.includes("videoplayback")) {
    return true;
  }
  const parsed = toUrl(raw);
  if (!parsed) return false;
  const host = String(parsed.hostname || "").toLowerCase();
  const path = String(parsed.pathname || "").toLowerCase();
  return host.includes("googlevideo.com") || path.includes("videoplayback");
}

function isYouTubeOrGoogleVideoUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (isYouTubeStreamUrl(raw)) return true;
  if (extractYouTubeVideoId(raw)) return true;
  const parsed = toUrl(raw);
  if (!parsed) {
    return /(?:youtube|youtu\.be|youtube-nocookie)/i.test(raw);
  }
  const host = String(parsed.hostname || "").toLowerCase();
  if (
    host.includes("youtube.com") ||
    host.includes("youtu.be") ||
    host.includes("youtube-nocookie.com") ||
    host.includes("youtube.googleapis.com")
  ) {
    return true;
  }
  return false;
}

function isHttpMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  return /^https?:\/\//i.test(raw);
}

function looksLikeDirectVideoUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || !isHttpMediaUrl(raw)) return false;
  const lower = raw.toLowerCase();
  if (isYouTubeStreamUrl(raw)) return true;
  if (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("youtube-nocookie.com")
  ) {
    return false;
  }
  const parsed = toUrl(raw);
  const pathname = String(parsed?.pathname || "").toLowerCase();
  if (/\.(mp4|webm|ogg|m3u8)(?:$|[?#])/i.test(pathname)) return true;
  const hint = `${pathname} ${String(parsed?.search || "").toLowerCase()}`;
  return (
    hint.includes("stream") ||
    hint.includes("playlist") ||
    hint.includes("manifest") ||
    hint.includes("mime=video") ||
    hint.includes("content-type=video") ||
    hint.includes("format=mp4") ||
    hint.includes("ext=mp4") ||
    hint.includes("m3u8")
  );
}

function getNativeVideoPlaybackUrl(video) {
  if (!video || typeof video !== "object") return "";
  const candidates = [
    video.playback_url,
    video.playbackUrl,
    video.stream_url,
    video.streamUrl,
    video.hls_url,
    video.hlsUrl,
    video.video_url,
    video.videoUrl,
    video.embed_url,
    video.embedUrl,
    video.url,
    video.source_url,
    video.sourceUrl,
  ];
  for (const candidate of candidates) {
    const raw = String(candidate || "").trim();
    if (!raw) continue;
    if (isYouTubeOrGoogleVideoUrl(raw) && !isYouTubeStreamUrl(raw)) continue;
    if (!looksLikeDirectVideoUrl(raw)) continue;
    return raw;
  }
  return "";
}

function getVideoResolveSourceUrl(video) {
  if (!video || typeof video !== "object") return "";
  const candidates = [
    video.video_url,
    video.videoUrl,
    video.embed_url,
    video.embedUrl,
    video.url,
    video.source_url,
    video.sourceUrl,
    video.watch_url,
    video.watchUrl,
    video.playback_url,
    video.playbackUrl,
    video.stream_url,
    video.streamUrl,
    video.hls_url,
    video.hlsUrl,
  ];
  for (const candidate of candidates) {
    const raw = String(candidate || "").trim();
    if (!raw || !isHttpMediaUrl(raw)) continue;
    return raw;
  }
  return "";
}

function getVideoExternalUrl(video) {
  if (!video || typeof video !== "object") return "";
  const watchUrl = (video.watch_url || video.watchUrl || "").trim();
  const sourceWatchUrl = (video.source_watch_url || video.sourceWatchUrl || "").trim();
  const videoUrl = (video.video_url || video.videoUrl || "").trim();
  const embedUrl = (video.embed_url || video.embedUrl || "").trim();
  const sourceUrl = (video.url || video.source_url || video.sourceUrl || "").trim();
  const playbackUrl = (video.playback_url || video.playbackUrl || "").trim();
  const streamUrl = (video.stream_url || video.streamUrl || "").trim();
  const hlsUrl = (video.hls_url || video.hlsUrl || "").trim();
  const videoId = (video.video_id || video.videoId || "").trim();
  if (watchUrl) return watchUrl;
  if (sourceWatchUrl) return sourceWatchUrl;
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  const videoIdFromUrl =
    extractYouTubeVideoId(videoUrl) ||
    extractYouTubeVideoId(embedUrl) ||
    extractYouTubeVideoId(sourceUrl);
  if (videoIdFromUrl) {
    return `https://www.youtube.com/watch?v=${videoIdFromUrl}`;
  }
  const nonStreamCandidates = [sourceUrl, videoUrl, embedUrl, playbackUrl, streamUrl, hlsUrl];
  for (const candidate of nonStreamCandidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;
    if (isYouTubeStreamUrl(value)) continue;
    return value;
  }
  return sourceUrl || videoUrl || embedUrl || playbackUrl || streamUrl || hlsUrl;
}

function getVideoPlaybackId(video) {
  if (!video || typeof video !== "object") return "";
  const sourceUrl = (video.video_url || video.videoUrl || "").trim();
  const embedUrl = (video.embed_url || video.embedUrl || "").trim();
  const videoId =
    extractYouTubeVideoId(sourceUrl) || extractYouTubeVideoId(embedUrl);
  if (videoId) {
    return `yt:${videoId}`;
  }
  const directUrl = getNativeVideoPlaybackUrl(video) || sourceUrl || embedUrl || getVideoExternalUrl(video);
  if (directUrl) {
    return `url:${directUrl}`;
  }
  const rawId = video.id || "";
  return rawId ? `id:${rawId}` : "";
}

function isResolvableRemoteVideo(video) {
  if (!video || typeof video !== "object") return false;
  const youtubeId =
    extractYouTubeVideoId(video?.video_url) ||
    extractYouTubeVideoId(video?.videoUrl) ||
    extractYouTubeVideoId(video?.embed_url) ||
    extractYouTubeVideoId(video?.embedUrl) ||
    extractYouTubeVideoId(video?.url) ||
    extractYouTubeVideoId(video?.source_url) ||
    extractYouTubeVideoId(video?.sourceUrl);
  if (youtubeId) return true;
  if (getNativeVideoPlaybackUrl(video)) return true;
  return Boolean(getVideoResolveSourceUrl(video) || getVideoExternalUrl(video));
}

function InlineVideoPlayer({
  video,
  onEnded,
  openExternal,
  autoPlay = true,
  muted = true,
}) {
  const nativePlayerRef = useRef(null);
  const [nativeFailed, setNativeFailed] = useState(false);
  const [resolvedPlaybackUrl, setResolvedPlaybackUrl] = useState("");
  const [resolvePending, setResolvePending] = useState(false);
  const [resolveReason, setResolveReason] = useState("");
  const [resolveAttempted, setResolveAttempted] = useState(false);
  const sourceUrl = String(
    video?.video_url ||
      video?.videoUrl ||
      video?.embed_url ||
      video?.embedUrl ||
      video?.url ||
      video?.source_url ||
      video?.sourceUrl ||
      ""
  ).trim();
  const nativePlaybackUrl = getNativeVideoPlaybackUrl(video);
  const resolveSourceUrl = getVideoResolveSourceUrl(video);
  const effectivePlaybackUrl = nativePlaybackUrl || resolvedPlaybackUrl;
  const videoId =
    String(video?.video_id || video?.videoId || "").trim() ||
    extractYouTubeVideoId(sourceUrl) ||
    extractYouTubeVideoId(video?.url) ||
    extractYouTubeVideoId(video?.source_url) ||
    extractYouTubeVideoId(video?.sourceUrl);
  const thumbnail = getVideoThumb(video);
  const fallbackExternalUrl =
    (video?.watch_url || video?.watchUrl || "").trim() ||
    (video?.embed_url || video?.embedUrl || "").trim() ||
    sourceUrl ||
    getVideoExternalUrl(video);

  const openExternalSafe = (url) => {
    if (!url) return;
    if (typeof openExternal === "function") {
      openExternal(url);
      return;
    }
    if (typeof window === "undefined") return;
    if (window.NewsAppUpdater?.openExternal) {
      window.NewsAppUpdater.openExternal(url);
      return;
    }
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) {
      window.location.href = url;
    }
  };

  useEffect(() => {
    setNativeFailed(false);
    setResolvedPlaybackUrl("");
    setResolvePending(false);
    setResolveReason("");
    setResolveAttempted(false);
  }, [video?.id, video?.video_url, video?.videoUrl, video?.embed_url, video?.embedUrl, video?.url, video?.source_url, video?.sourceUrl, video?.watch_url, video?.watchUrl]);

  useEffect(() => {
    if (videoId) return;
    if (!resolveSourceUrl) return;
    if (resolveAttempted) return;
    if (!nativeFailed && nativePlaybackUrl) return;
    let cancelled = false;
    setResolveAttempted(true);
    setResolvePending(true);
    setResolveReason("");
    fetchVideoPlayback(resolveSourceUrl)
      .then((result) => {
        if (cancelled) return;
        const nextUrl = String(result?.playback_url || result?.playbackUrl || "").trim();
        const playable = Boolean(result?.playable);
        if (playable && nextUrl) {
          setResolvedPlaybackUrl(nextUrl);
          setResolveReason("");
          return;
        }
        setResolveReason(String(result?.reason || "stream_unavailable"));
      })
      .catch((error) => {
        if (cancelled) return;
        setResolveReason(String(error?.message || "resolver_failed"));
      })
      .finally(() => {
        if (!cancelled) {
          setResolvePending(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, resolveSourceUrl, resolveAttempted, nativeFailed, nativePlaybackUrl]);

  useEffect(() => {
    if (videoId || !autoPlay || !effectivePlaybackUrl || nativeFailed) return;
    const node = nativePlayerRef.current;
    if (!node || typeof node.play !== "function") return;
    const attempt = node.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        // Ignore autoplay restrictions.
      });
    }
  }, [videoId, autoPlay, effectivePlaybackUrl, nativeFailed]);

  if (videoId) {
    return (
      <YouTubePlayer
        videoId={videoId}
        title={video?.title || ""}
        sourceUrl={fallbackExternalUrl}
        thumbnail={thumbnail}
        onEnded={onEnded}
        openExternal={openExternal}
      />
    );
  }

  if (effectivePlaybackUrl && !nativeFailed) {
    return (
      <video
        ref={nativePlayerRef}
        src={effectivePlaybackUrl}
        controls
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        preload="metadata"
        poster={thumbnail || undefined}
        onEnded={onEnded || undefined}
        onError={() => setNativeFailed(true)}
      />
    );
  }

  if (resolvePending) {
    return (
      <div className="media-player-loading">
        <div className="media-player-loading-title">Resolving video transport...</div>
        <div className="media-player-loading-note">
          Checking backend playback routes for this source.
        </div>
      </div>
    );
  }

  if (!videoId && !nativePlaybackUrl) {
    return (
      <div className="media-player-fallback" role="group" aria-label="Video fallback">
        <div className="media-player-fallback-card">
          <div className="media-player-fallback-thumb">
            {thumbnail ? <img src={thumbnail} alt={video?.title || "Video thumbnail"} /> : null}
          </div>
          <div className="media-player-fallback-body">
            <h5 className="media-player-fallback-title">
              {video?.title || "Video unavailable for inline playback"}
            </h5>
            <div className="media-player-fallback-actions">
              <button type="button" className="primary" onClick={() => openExternalSafe(fallbackExternalUrl)}>
                Open source
              </button>
            </div>
            <div className="media-player-fallback-note">
              Inline playback is unavailable for this source.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="media-player-fallback" role="group" aria-label="Video fallback">
      <div className="media-player-fallback-card">
        <div className="media-player-fallback-thumb">
          {thumbnail ? <img src={thumbnail} alt={video?.title || "Video thumbnail"} /> : null}
        </div>
        <div className="media-player-fallback-body">
          <h5 className="media-player-fallback-title">
            {video?.title || "Video unavailable for inline playback"}
          </h5>
          <div className="media-player-fallback-actions">
            <button type="button" className="primary" onClick={() => openExternalSafe(fallbackExternalUrl)}>
              Open source
            </button>
            {fallbackExternalUrl ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(fallbackExternalUrl);
                  } catch (err) {
                    // Ignore clipboard errors.
                  }
                }}
              >
                Copy link
              </button>
            ) : null}
          </div>
          <div className="media-player-fallback-note">
            {resolveReason
              ? `Inline playback failed (${resolveReason}).`
              : "Inline playback failed for this source."}
          </div>
        </div>
      </div>
    </div>
  );
}

const FILTERS_KEY = "newsapp_saved_filters";
const FILTERS_AUTO_KEY = "newsapp_filters_auto";
const SETTINGS_KEY = "newsapp_frontend_settings";
const COOKIE_CONSENT_KEY = "newsapp_cookie_consent";
const FEATURES_SEEN_KEY = "newsapp_features_seen_version";
const FEATURES_OPT_OUT_KEY = "newsapp_features_opt_out";
const LAST_RADIO_KEY = "newsapp_last_radio_station";
const APP_VERSION =
  import.meta.env.VITE_APP_VERSION ||
  import.meta.env.PACKAGE_VERSION ||
  "0.1.0";
const BRAND_NAME = "Current Scope";
const UPDATE_MANIFEST_FILE = "update.json";
const INSTALLER_MANIFEST_FILE = "manifest";
const GITHUB_RELEASES_API_LATEST =
  "https://api.github.com/repos/MCR-Advanced-Technologies/The-Current-Scope/releases/latest";
const HEADLINE_LIMIT = 60;
const RESULTS_LIMIT = 200;
const VIDEO_RESULTS_LIMIT = 240;
const RADIO_RESULTS_LIMIT = 240;
const WEATHER_RESULTS_LIMIT = 600;
const WEATHER_LIVE_RESOLVE_LIMIT = 40;
const WEATHER_RESOLVE_LIMIT_MAX = 40;
const INSTALLER_CACHE_KEY = "newsapp_installers_manifest_cache_v1";
const GOOGLE_MAPS_API_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
const GOOGLE_MAPS_ID = String(import.meta.env.VITE_GOOGLE_MAP_ID || "").trim();
const GOOGLE_MAPS_SCRIPT_ID = "currentscope-google-maps-js";
let googleMapsLoadPromise = null;

function resolveGoogleMapsApiKey() {
  if (GOOGLE_MAPS_API_KEY) return GOOGLE_MAPS_API_KEY;
  if (typeof window === "undefined") return "";
  const runtimeKey = String(window.__GOOGLE_MAPS_API_KEY__ || "").trim();
  if (runtimeKey) return runtimeKey;
  try {
    const stored = window.localStorage.getItem("GOOGLE_MAPS_API_KEY") || "";
    return String(stored).trim();
  } catch (err) {
    return "";
  }
}

async function buildGoogleMapsApi() {
  const maps = window.google?.maps;
  if (!maps) {
    throw new Error("Google Maps namespace is unavailable.");
  }
  if (typeof maps.importLibrary === "function") {
    const mapsLib = await maps.importLibrary("maps");
    const coreLib = await maps.importLibrary("core");
    return {
      Map: mapsLib?.Map || maps.Map,
      ImageMapType: mapsLib?.ImageMapType || maps.ImageMapType,
      Size: coreLib?.Size || maps.Size,
      event: maps.event || coreLib?.event,
    };
  }
  return {
    Map: maps.Map,
    ImageMapType: maps.ImageMapType,
    Size: maps.Size,
    event: maps.event,
  };
}

function loadGoogleMapsApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps requires a browser runtime."));
  }
  const apiKey = resolveGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(
      new Error("Google Maps API key is missing. Set VITE_GOOGLE_MAPS_API_KEY.")
    );
  }
  if (window.google?.maps) {
    return buildGoogleMapsApi();
  }
  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existing) {
      if (window.google?.maps) {
        buildGoogleMapsApi().then(resolve).catch(reject);
        return;
      }
      existing.addEventListener("load", () => {
        buildGoogleMapsApi().then(resolve).catch(reject);
      });
      existing.addEventListener("error", () => reject(new Error("Google Maps script failed to load.")));
      return;
    }
    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    const qs = `key=${encodeURIComponent(apiKey)}&loading=async&v=weekly`;
    script.src = `https://maps.googleapis.com/maps/api/js?${qs}`;
    script.onload = () => {
      buildGoogleMapsApi().then(resolve).catch(reject);
    };
    script.onerror = () => reject(new Error("Google Maps script failed to load."));
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsLoadPromise = null;
    throw error;
  });
  return googleMapsLoadPromise;
}
const INSTALLER_ASSETS = [
  { id: "windows", label: "Windows Installer (.exe)", file: "CurrentScope-Setup.exe" },
  { id: "android", label: "Android APK", file: "CurrentScope.apk" },
  { id: "linux", label: "Linux Installer (.deb)", file: "CurrentScope.deb" },
];
const UPDATE_PLATFORM_LABELS = {
  windows: "Windows",
  android: "Android",
  linux: "Linux",
  web: "Web",
};
const FEATURES_NOTES = [
  "Watch and Listen pop-out players now support minimize and quick restore.",
  "Only one pop-out player can be open at a time for cleaner media control.",
  "Local mode toggle now applies instantly without clearing your saved location.",
  "Radio stations no longer switch while you type; your last station is remembered.",
  "Station logos backfill automatically with HTTPS-safe fallbacks when available.",
];
const PROVIDER_LABELS = {
  newsapi: "NewsAPI",
  gnews: "GNews",
  mediastack: "MediaStack",
  rss: "RSS",
  manual: "Manual",
};
const CORE_PROVIDER_OPTIONS = ["NewsAPI", "GNews", "MediaStack", "RSS"];
const THEME_PRESETS = [
  {
    id: "current-scope",
    label: BRAND_NAME,
    palettes: {
      light: {
        bg: "#f5efe6",
        surface: "#fffaf5",
        ink: "#1f2937",
        muted: "#6b7280",
        accent: "#0f766e",
        accentStrong: "#0b5f56",
        accentWarm: "#f97316",
        border: "#e7ded2",
      },
      dark: {
        bg: "#0d1b1c",
        surface: "#122425",
        ink: "#f0fdf9",
        muted: "#b6d4cf",
        accent: "#14b8a6",
        accentStrong: "#0f766e",
        accentWarm: "#f97316",
        border: "#1f3a3c",
      },
    },
  },
  {
    id: "midnight",
    label: "Midnight Pulse",
    palettes: {
      light: {
        bg: "#f2f6ff",
        surface: "#ffffff",
        ink: "#1f2937",
        muted: "#6b7280",
        accent: "#2563eb",
        accentStrong: "#1d4ed8",
        accentWarm: "#f59e0b",
        border: "#dbeafe",
      },
      dark: {
        bg: "#0b1120",
        surface: "#0f172a",
        ink: "#e2e8f0",
        muted: "#cbd5f5",
        accent: "#38bdf8",
        accentStrong: "#0ea5e9",
        accentWarm: "#f59e0b",
        border: "#1e293b",
      },
    },
  },
  {
    id: "sunset",
    label: "Sunset Dispatch",
    palettes: {
      light: {
        bg: "#fff7ed",
        surface: "#fffbf5",
        ink: "#3f2d22",
        muted: "#7c6f64",
        accent: "#f97316",
        accentStrong: "#ea580c",
        accentWarm: "#facc15",
        border: "#f2e8dd",
      },
      dark: {
        bg: "#1f130b",
        surface: "#2a1a10",
        ink: "#fff7ed",
        muted: "#e6c7ad",
        accent: "#f97316",
        accentStrong: "#ea580c",
        accentWarm: "#facc15",
        border: "#3a2415",
      },
    },
  },
  {
    id: "harbor",
    label: "Harbor Night",
    palettes: {
      light: {
        bg: "#eef7ff",
        surface: "#ffffff",
        ink: "#102a43",
        muted: "#54728c",
        accent: "#0ea5e9",
        accentStrong: "#0284c7",
        accentWarm: "#f97316",
        border: "#d8e8f7",
      },
      dark: {
        bg: "#071a2f",
        surface: "#0a223c",
        ink: "#e0f2fe",
        muted: "#b6c6e3",
        accent: "#22c55e",
        accentStrong: "#16a34a",
        accentWarm: "#f97316",
        border: "#0f2f4a",
      },
    },
  },
  {
    id: "custom",
    label: "Custom Blend",
    palettes: null,
  },
];
const THEME_VARIABLES = {
  bg: "--bg",
  surface: "--surface",
  ink: "--ink",
  muted: "--muted",
  accent: "--accent",
  accentStrong: "--accent-strong",
  accentWarm: "--accent-warm",
  border: "--border",
};
const DEFAULT_SETTINGS = {
  theme: "light",
  themePreset: "current-scope",
  backgroundColor: "#f5efe6",
  backgroundImage: "",
  overlayOpacity: 0.14,
  backendUrl: "",
  wideLayout: false,
  autoRefreshHeadlines: false,
  autoRefreshResults: false,
  headlineRefreshSec: 60,
  resultsRefreshSec: 30,
  headlineRotationSec: 4.5,
  headlineAutoRotate: true,
  showHeadlinesHeader: true,
  showVideoHeader: true,
  autoRefreshVideos: false,
  autoRefreshVideoResults: false,
  videoRefreshSec: 90,
  videoAutoRotate: true,
  showRadioHeader: true,
  autoRefreshRadios: false,
  autoRefreshRadioResults: false,
  radioRefreshSec: 180,
  radioAutoRotate: true,
  radioRotationSec: 45,
  showWeatherHeader: true,
  autoRefreshWeather: true,
  autoRefreshWeatherResults: false,
  weatherRefreshSec: 300,
  autoRefreshRadar: true,
  radarRefreshSec: 180,
  headlineExclusions: "",
  searchExclusions: "",
  localNewsEnabled: false,
  localNewsLocation: "",
  readAloudEnabled: false,
  readAloudRate: 1,
  readAloudVoice: "",
  readAloudAutoStart: false,
  updatePolicy: "auto",
  updateIntervalHours: 24,
  resultsView: "list",
  rememberPopoutState: false,
  rememberVideoPopoutOpen: false,
  rememberRadioPopoutOpen: false,
};

function readSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  let raw = "";
  try {
    raw = window.localStorage.getItem(SETTINGS_KEY) || "";
  } catch (err) {
    // Storage access can be blocked in some privacy contexts.
    return { ...DEFAULT_SETTINGS };
  }
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const data = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...data };
  } catch (err) {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    // Ignore storage failures; settings will fall back to defaults.
  }
}

function readCookieConsent() {
  if (typeof window === "undefined") return "";
  let raw = "";
  try {
    raw = window.localStorage.getItem(COOKIE_CONSENT_KEY) || "";
  } catch (err) {
    return "";
  }
  return raw === "accepted" || raw === "declined" ? raw : "";
}

function writeCookieConsent(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch (err) {
    // Ignore storage failures.
  }
}

function readFeaturesSeenVersion() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(FEATURES_SEEN_KEY) || "";
  } catch (err) {
    return "";
  }
}

function writeFeaturesSeenVersion(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FEATURES_SEEN_KEY, value || "");
  } catch (err) {
    // Ignore storage failures.
  }
}

function readFeaturesOptOut() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FEATURES_OPT_OUT_KEY) === "true";
  } catch (err) {
    return false;
  }
}

function writeFeaturesOptOut(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FEATURES_OPT_OUT_KEY, value ? "true" : "false");
  } catch (err) {
    // Ignore storage failures.
  }
}

const BrandMark = ({ size = 46 }) => (
  <span className="brand-mark" aria-hidden="true" style={{ width: size, height: size }}>
    <svg viewBox="0 0 48 48" width="100%" height="100%" fill="none">
      <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="24" r="3" fill="currentColor" />
      <path
        d="M24 9v6M24 33v6M9 24h6M33 24h6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M14 32c4.5 4.5 15.5 4.5 20 0"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  </span>
);

function parseList(value) {
  return (value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const EXCLUSION_GROUPS = {
  sport: [
    "sports",
    "football",
    "basketball",
    "baseball",
    "soccer",
    "nfl",
    "nba",
    "mlb",
    "nhl",
    "ncaa",
    "olympics",
    "fifa",
    "cricket",
    "tennis",
    "golf",
    "boxing",
    "mma",
    "ufc",
    "motorsport",
    "formula 1",
    "f1",
    "nascar",
    "super bowl",
    "world cup",
  ],
};

const LOCATION_ALIASES = {
  "united states": ["usa", "us", "u.s.", "u.s.a.", "america"],
  "united kingdom": ["uk", "u.k.", "britain", "great britain", "england"],
  "united arab emirates": ["uae", "u.a.e."],
  "new york": ["ny", "n.y.", "nyc", "new york city"],
  "new jersey": ["nj", "n.j.", "jersey", "garden state"],
  "washington dc": ["dc", "d.c.", "district of columbia", "washington d.c."],
};

const US_STATE_CODES = {
  alabama: "al",
  alaska: "ak",
  arizona: "az",
  arkansas: "ar",
  california: "ca",
  colorado: "co",
  connecticut: "ct",
  delaware: "de",
  florida: "fl",
  georgia: "ga",
  hawaii: "hi",
  idaho: "id",
  illinois: "il",
  indiana: "in",
  iowa: "ia",
  kansas: "ks",
  kentucky: "ky",
  louisiana: "la",
  maine: "me",
  maryland: "md",
  massachusetts: "ma",
  michigan: "mi",
  minnesota: "mn",
  mississippi: "ms",
  missouri: "mo",
  montana: "mt",
  nebraska: "ne",
  nevada: "nv",
  "new hampshire": "nh",
  "new jersey": "nj",
  "new mexico": "nm",
  "new york": "ny",
  "north carolina": "nc",
  "north dakota": "nd",
  ohio: "oh",
  oklahoma: "ok",
  oregon: "or",
  pennsylvania: "pa",
  "rhode island": "ri",
  "south carolina": "sc",
  "south dakota": "sd",
  tennessee: "tn",
  texas: "tx",
  utah: "ut",
  vermont: "vt",
  virginia: "va",
  washington: "wa",
  "west virginia": "wv",
  wisconsin: "wi",
  wyoming: "wy",
};

const US_STATE_BY_CODE = Object.fromEntries(
  Object.entries(US_STATE_CODES).map(([name, code]) => [code, name])
);

function normalizeText(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

function normalizeTooltipText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= 96) return text;
  return `${text.slice(0, 93).trim()}...`;
}

function deriveTooltipLabel(node) {
  if (!node || typeof node.getAttribute !== "function") return "";
  const aria = normalizeTooltipText(node.getAttribute("aria-label"));
  if (aria) return aria;
  const title = normalizeTooltipText(node.getAttribute("title"));
  if (title) return title;
  const toggleLabel = node.querySelector?.(".toggle-label");
  if (toggleLabel && toggleLabel.textContent) {
    const label = normalizeTooltipText(toggleLabel.textContent);
    if (label) return label;
  }
  return normalizeTooltipText(node.textContent || "");
}

function applyAutoTooltips(root) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  const nodes = root.querySelectorAll(
    [
      "button",
      "summary",
      ".app-menu-card",
      ".toggle",
      ".health-indicator",
      ".installer-action-main",
      ".results-filter-dropdown summary",
      ".tab-nav button",
      ".settings-nav button",
    ].join(", ")
  );
  nodes.forEach((node) => {
    if (!node || typeof node.hasAttribute !== "function") return;
    if (node.hasAttribute("data-tooltip")) return;
    if (node.closest(".read-only-content")) return;
    const label = deriveTooltipLabel(node);
    if (!label) return;
    node.setAttribute("data-tooltip", label);
  });
}

function buildRadioKey(station) {
  const row = station || {};
  const provider = row.provider || "";
  const identity =
    row.id ||
    row.stationuuid ||
    row.station_uuid ||
    row.stationUuid ||
    row.stream_url ||
    row.streamUrl ||
    row.homepage_url ||
    row.homepageUrl ||
    row.name ||
    "";
  return compactText(`${provider}|${identity}`) || compactText(identity);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expandExclusionTerms(rawTerms) {
  const expanded = new Set();
  rawTerms.forEach((term) => {
    const normalized = normalizeText(term);
    if (!normalized) return;
    expanded.add(normalized);
    const base = normalized.replace(/s+$/, "");
    const relatedTerms = EXCLUSION_GROUPS[normalized] || EXCLUSION_GROUPS[base] || [];
    if (relatedTerms.length) {
      relatedTerms.forEach((related) => expanded.add(normalizeText(related)));
    }
    if (normalized.endsWith("s")) {
      expanded.add(normalized.replace(/s+$/, ""));
    } else if (normalized.length > 3) {
      expanded.add(`${normalized}s`);
    }
  });
  return Array.from(expanded).filter(Boolean);
}

function buildLocationVariants(location) {
  const normalized = normalizeText(location);
  if (!normalized) return [];
  const variants = new Set([normalized, compactText(normalized)]);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const initials = words.map((word) => word[0]).join("");
    if (initials.length >= 2) {
      variants.add(initials);
      variants.add(initials.split("").join("."));
    }
  }
  const aliases = LOCATION_ALIASES[normalized] || [];
  aliases.forEach((alias) => {
    variants.add(normalizeText(alias));
    variants.add(compactText(alias));
  });
  if (US_STATE_CODES[normalized]) {
    const code = US_STATE_CODES[normalized];
    variants.add(code);
    variants.add(code.split("").join("."));
  } else if (US_STATE_BY_CODE[normalized]) {
    const stateName = US_STATE_BY_CODE[normalized];
    variants.add(stateName);
    variants.add(compactText(stateName));
  }
  return Array.from(variants).filter(Boolean);
}

function normalizeVersion(value) {
  return (value || "").toString().trim().replace(/^v/i, "");
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split(".").map((part) => parseInt(part, 10) || 0);
  const right = normalizeVersion(b).split(".").map((part) => parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function resolveInstallerAssetUrl(baseUrl, fallbackFile, rawUrl) {
  const base = (baseUrl || "").replace(/\/+$/, "");
  const fallback = `${base}/installers/${fallbackFile}`;
  const candidate = (rawUrl || "").toString().trim();
  if (!candidate) return fallback;
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (candidate.startsWith("/")) return `${base}${candidate}`;
  const normalized = candidate.replace(/^installers\//i, "");
  return `${base}/installers/${normalized}`;
}

function normalizeInstallerPlatformId(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text.startsWith("win")) return "windows";
  if (text.startsWith("andr") || text === "apk") return "android";
  if (text.startsWith("lin") || text === "deb") return "linux";
  return "";
}

function inferInstallerPlatformFromName(name) {
  const lower = String(name || "").trim().toLowerCase();
  if (!lower) return "";
  if (lower.endsWith(".exe")) return "windows";
  if (lower.endsWith(".apk")) return "android";
  if (lower.endsWith(".deb")) return "linux";
  return "";
}

function parseInstallerStateFromManifestPayload(manifest, baseUrl) {
  const availability = Object.fromEntries(
    INSTALLER_ASSETS.map((asset) => [asset.id, false])
  );
  const platforms = {};
  if (!manifest || typeof manifest !== "object") {
    return { availability, platforms };
  }

  const assetById = Object.fromEntries(
    INSTALLER_ASSETS.map((asset) => [asset.id, asset])
  );

  const rawPlatforms =
    manifest.platforms && typeof manifest.platforms === "object"
      ? manifest.platforms
      : {};
  Object.entries(rawPlatforms).forEach(([key, info]) => {
    const id = normalizeInstallerPlatformId(key);
    if (!id || !assetById[id]) return;
    const fallbackFile = assetById[id].file;
    const url = resolveInstallerAssetUrl(baseUrl, fallbackFile, info?.url || "");
    if (!url) return;
    availability[id] = true;
    platforms[id] = {
      ...(info && typeof info === "object" ? info : {}),
      url,
    };
  });

  const files = Array.isArray(manifest.files) ? manifest.files : [];
  files.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const name = String(entry.name || "").trim();
    if (!name) return;
    const platformFromEntry = normalizeInstallerPlatformId(entry.platform);
    const platformId = platformFromEntry || inferInstallerPlatformFromName(name);
    if (!platformId || !assetById[platformId]) return;
    if (availability[platformId]) return;
    const fallbackFile = assetById[platformId].file;
    const url = resolveInstallerAssetUrl(baseUrl, fallbackFile, entry.url || name);
    if (!url) return;
    availability[platformId] = true;
    platforms[platformId] = {
      ...(entry && typeof entry === "object" ? entry : {}),
      url,
    };
  });

  return { availability, platforms };
}

function parseInstallerStateFromGithubReleasePayload(release, baseUrl) {
  const availability = Object.fromEntries(
    INSTALLER_ASSETS.map((asset) => [asset.id, false])
  );
  const platforms = {};
  if (!release || typeof release !== "object") {
    return { availability, platforms };
  }
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const version =
    normalizeVersion(release.tag_name || "") || normalizeVersion(release.name || "");

  assets.forEach((asset) => {
    if (!asset || typeof asset !== "object") return;
    const name = String(asset.name || "").trim();
    if (!name) return;
    const platformId =
      normalizeInstallerPlatformId(asset.platform) || inferInstallerPlatformFromName(name);
    if (!platformId || availability[platformId]) return;
    const url = resolveInstallerAssetUrl(
      baseUrl,
      name,
      asset.browser_download_url || asset.url || name
    );
    if (!url) return;
    availability[platformId] = true;
    platforms[platformId] = {
      name,
      size: Number(asset.size || 0) || undefined,
      version,
      url,
      modified: asset.updated_at || asset.created_at || "",
    };
  });

  return { availability, platforms };
}

function hasAnyInstallerAvailable(availability) {
  return Object.values(availability || {}).some(Boolean);
}


function readSavedFilters() {
  if (typeof window === "undefined") return null;
  let raw = "";
  try {
    raw = window.localStorage.getItem(FILTERS_KEY) || "";
  } catch (err) {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function writeSavedFilters(filters) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  } catch (err) {
    // Ignore storage failures.
  }
}

function readAutoApply() {
  if (typeof window === "undefined") return true;
  let raw = "";
  try {
    raw = window.localStorage.getItem(FILTERS_AUTO_KEY) || "";
  } catch (err) {
    return true;
  }
  return raw ? raw === "true" : true;
}

function writeAutoApply(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FILTERS_AUTO_KEY, String(value));
  } catch (err) {
    // Ignore storage failures.
  }
}

function readLastRadioStation() {
  if (typeof window === "undefined") return null;
  let raw = "";
  try {
    raw = window.localStorage.getItem(LAST_RADIO_KEY) || "";
  } catch (err) {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function writeLastRadioStation(station) {
  if (typeof window === "undefined") return;
  try {
    if (!station) {
      window.localStorage.removeItem(LAST_RADIO_KEY);
      return;
    }
    window.localStorage.setItem(LAST_RADIO_KEY, JSON.stringify(station));
  } catch (err) {
    // Ignore storage failures.
  }
}

function readInstallerManifestCache(baseUrl) {
  if (typeof window === "undefined" || !baseUrl) return null;
  try {
    const raw = window.sessionStorage.getItem(INSTALLER_CACHE_KEY) || "";
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.base !== baseUrl) return null;
    const availability = parsed.availability || {};
    const platforms = parsed.platforms || {};
    return {
      availability,
      platforms,
    };
  } catch (err) {
    return null;
  }
}

function writeInstallerManifestCache(baseUrl, payload) {
  if (typeof window === "undefined" || !baseUrl) return;
  try {
    window.sessionStorage.setItem(
      INSTALLER_CACHE_KEY,
      JSON.stringify({
        base: baseUrl,
        availability: payload?.availability || {},
        platforms: payload?.platforms || {},
      })
    );
  } catch (err) {
    // Ignore cache write failures.
  }
}

function classifyRequestError(error, fallbackMessage) {
  if (error?.name === "AbortError") {
    return {
      kind: "abort",
      status: 0,
      userMessage: "",
      technicalMessage: "Request canceled.",
      retryable: false,
    };
  }
  const status = Number(error?.status || error?.httpStatus || 0);
  const detail = String(
    error?.detailMessage || error?.detail || error?.message || fallbackMessage || "Request failed."
  ).trim();
  if (status === 404) {
    return {
      kind: "not_found",
      status,
      userMessage: "Not found.",
      technicalMessage: detail,
      retryable: false,
    };
  }
  if (status === 422) {
    return {
      kind: "validation",
      status,
      userMessage: detail || "The request is invalid. Update filters and try again.",
      technicalMessage: detail,
      retryable: false,
    };
  }
  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      status,
      userMessage: "Authorization failed. Verify API token and backend URL.",
      technicalMessage: detail,
      retryable: false,
    };
  }
  if (status >= 500) {
    return {
      kind: "server",
      status,
      userMessage: "Backend is temporarily unavailable.",
      technicalMessage: detail,
      retryable: true,
    };
  }
  return {
    kind: "network",
    status,
    userMessage: detail || "Unable to complete the request.",
    technicalMessage: detail,
    retryable: true,
  };
}

export default function App() {
  const initialSettings = readSettings();
  const initialVideoPopoutOpen = Boolean(
    initialSettings.rememberPopoutState && initialSettings.rememberVideoPopoutOpen
  );
  const initialRadioPopoutOpen = Boolean(
    initialSettings.rememberPopoutState &&
      initialSettings.rememberRadioPopoutOpen &&
      !initialVideoPopoutOpen
  );
  const [settings, setSettings] = useState(initialSettings);
  const [backendUrlDraft, setBackendUrlDraft] = useState(
    () => initialSettings.backendUrl || ""
  );
  const userAgent =
    typeof window !== "undefined" ? window.navigator?.userAgent || "" : "";
  const locationProtocol =
    typeof window !== "undefined" ? window.location?.protocol || "" : "";
  const isNativeProtocol = ["capacitor:", "ionic:", "app:"].includes(
    locationProtocol
  );
  const capacitorPlatform =
    typeof window !== "undefined" &&
    window.Capacitor &&
    typeof window.Capacitor.getPlatform === "function"
      ? window.Capacitor.getPlatform() || ""
      : "";
  const isCapacitor =
    /Capacitor|Cordova/i.test(userAgent) ||
    (typeof window !== "undefined" &&
      (Boolean(window.Capacitor) ||
        window.Capacitor?.isNativePlatform?.() ||
        window.Capacitor?.isNative)) ||
    Boolean(capacitorPlatform);
  const isElectron =
    /Electron/i.test(userAgent) ||
    (typeof window !== "undefined" && !!window.NewsAppUpdater);
  const isStandalone =
    typeof window !== "undefined" &&
    ((window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator?.standalone ||
      window.location?.protocol === "file:" ||
      isNativeProtocol ||
      isElectron ||
      isCapacitor ||
      /Tauri|NewsApp/i.test(userAgent));
  const isAndroidApp =
    capacitorPlatform === "android" ||
    (/Android/i.test(userAgent) &&
      (isCapacitor ||
        isStandalone ||
        isNativeProtocol ||
        (typeof window !== "undefined" && window.location?.hostname === "localhost")));
  const isAppRuntime = isElectron || isCapacitor || isAndroidApp || isNativeProtocol;
  const [cookieConsent, setCookieConsent] = useState(readCookieConsent);
  const [view, setView] = useState("dashboard");
  const [activeTab, setActiveTab] = useState("read");
  const [availableVoices, setAvailableVoices] = useState([]);
  const [articles, setArticles] = useState([]);
  const [videos, setVideos] = useState([]);
  const [radios, setRadios] = useState([]);
  const [selectedRadio, setSelectedRadio] = useState(() => readLastRadioStation());
  const [weatherRows, setWeatherRows] = useState([]);
  const [weatherError, setWeatherError] = useState("");
  const [weatherRetryBlocked, setWeatherRetryBlocked] = useState(false);
  const [deviceWeatherLocation, setDeviceWeatherLocation] = useState(null);
  const [deviceWeatherLocationStatus, setDeviceWeatherLocationStatus] = useState({
    state: "idle",
    label: "Not requested",
  });
  const [headlineArticles, setHeadlineArticles] = useState([]);
  const [headlineTotalCount, setHeadlineTotalCount] = useState(null);
  const [sourceCatalog, setSourceCatalog] = useState([]);
  const [providerCatalog, setProviderCatalog] = useState([]);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installerAvailability, setInstallerAvailability] = useState({});
  const [installerPlatforms, setInstallerPlatforms] = useState({});
  const [loading, setLoading] = useState(false);
  const [headlineLoading, setHeadlineLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [videoSearch, setVideoSearch] = useState("");
  const [radioSearch, setRadioSearch] = useState("");
  const [weatherSearch, setWeatherSearch] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [videoHasSearched, setVideoHasSearched] = useState(false);
  const [radioHasSearched, setRadioHasSearched] = useState(false);
  const [weatherHasSearched, setWeatherHasSearched] = useState(false);
  const [message, setMessage] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [filterSource, setFilterSource] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [sortKey, setSortKey] = useState("publishedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [autoApplyFilters, setAutoApplyFilters] = useState(readAutoApply);
  const [lastSearch, setLastSearch] = useState("");
  const [lastVideoSearch, setLastVideoSearch] = useState("");
  const [lastRadioSearch, setLastRadioSearch] = useState("");
  const [lastWeatherSearch, setLastWeatherSearch] = useState("");
  const [headlineUpdatedAt, setHeadlineUpdatedAt] = useState("");
  const [resultsUpdatedAt, setResultsUpdatedAt] = useState("");
  const [videosUpdatedAt, setVideosUpdatedAt] = useState("");
  const [radiosUpdatedAt, setRadiosUpdatedAt] = useState("");
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [radioLoading, setRadioLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [videoFilterSource, setVideoFilterSource] = useState("");
  const [videoFilterProvider, setVideoFilterProvider] = useState("");
  const [videoStartDate, setVideoStartDate] = useState("");
  const [videoEndDate, setVideoEndDate] = useState("");
  const [videoSortKey, setVideoSortKey] = useState("published_at");
  const [videoSortDir, setVideoSortDir] = useState("desc");
  const [radioFilterCountry, setRadioFilterCountry] = useState("");
  const [radioFilterLanguage, setRadioFilterLanguage] = useState("");
  const [radioFilterTag, setRadioFilterTag] = useState("");
  const [radioFilterProvider, setRadioFilterProvider] = useState("");
  const [radioSortKey, setRadioSortKey] = useState("votes");
  const [radioSortDir, setRadioSortDir] = useState("desc");
  const [weatherSortKey, setWeatherSortKey] = useState("weather_time");
  const [weatherSortDir, setWeatherSortDir] = useState("desc");
  const [weatherChartLocation, setWeatherChartLocation] = useState("auto");
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarFrames, setRadarFrames] = useState([]);
  const [radarFrameIndex, setRadarFrameIndex] = useState(-1);
  const [radarUpdatedAt, setRadarUpdatedAt] = useState("");
  const [radarError, setRadarError] = useState("");
  const [radarRefreshNonce, setRadarRefreshNonce] = useState(0);
  const [radarZoom, setRadarZoom] = useState(6);
  const [radarViewport, setRadarViewport] = useState({
    latitude: null,
    longitude: null,
    zoom: 6,
  });
  const [radarFullscreen, setRadarFullscreen] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [activeRadioIndex, setActiveRadioIndex] = useState(0);
  const [videoPopoutOpen, setVideoPopoutOpen] = useState(initialVideoPopoutOpen);
  const [radioPopoutOpen, setRadioPopoutOpen] = useState(initialRadioPopoutOpen);
  const [videoPopoutMinimized, setVideoPopoutMinimized] = useState(false);
  const [radioPopoutMinimized, setRadioPopoutMinimized] = useState(false);
  const [videoInfoOpen, setVideoInfoOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateInfo, setUpdateInfo] = useState(null);
  const [nativeVersion, setNativeVersion] = useState("");
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [featuresOptOut, setFeaturesOptOut] = useState(false);
  const [readOnlyOpen, setReadOnlyOpen] = useState(false);
  const [readOnlyHtml, setReadOnlyHtml] = useState("");
  const [readOnlyTitle, setReadOnlyTitle] = useState("");
  const [readOnlyUrl, setReadOnlyUrl] = useState("");
  const [readOnlyLoading, setReadOnlyLoading] = useState(false);
  const [readOnlyError, setReadOnlyError] = useState("");
  const [readOnlyScrollY, setReadOnlyScrollY] = useState(0);
  const [readOnlyText, setReadOnlyText] = useState("");
  const [readOnlySpeaking, setReadOnlySpeaking] = useState(false);
  const [readOnlyPaused, setReadOnlyPaused] = useState(false);
  const [readOnlyStatus, setReadOnlyStatus] = useState("");
  const [sharePayload, setSharePayload] = useState(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoModalVideo, setVideoModalVideo] = useState(null);
  const [weatherTrendOpen, setWeatherTrendOpen] = useState(false);
  const [weatherTrendGroup, setWeatherTrendGroup] = useState(null);
  const [weatherTrendPointTs, setWeatherTrendPointTs] = useState(null);

  useEffect(() => {
    const optOut = readFeaturesOptOut();
    const seenVersion = readFeaturesSeenVersion();
    setFeaturesOptOut(optOut);
    if (!optOut && seenVersion !== APP_VERSION) {
      setShowFeaturesModal(true);
    }
  }, []);
  const [backendHealth, setBackendHealth] = useState({
    state: "unknown",
    label: "Unknown",
  });
  const [backendConnection, setBackendConnection] = useState({
    state: "unknown",
    label: "Not checked",
  });
  const [filtersExpanded, setFiltersExpanded] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return !window.matchMedia("(max-width: 980px)").matches;
  });
  const [videoFiltersExpanded, setVideoFiltersExpanded] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return !window.matchMedia("(max-width: 980px)").matches;
  });
  const [radioFiltersExpanded, setRadioFiltersExpanded] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return !window.matchMedia("(max-width: 980px)").matches;
  });
  const [weatherFiltersExpanded, setWeatherFiltersExpanded] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return !window.matchMedia("(max-width: 980px)").matches;
  });
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [appSettingsSection, setAppSettingsSection] = useState("");
  const [isNarrowLayout, setIsNarrowLayout] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 980px)").matches;
  });
  const searchDebounceRef = useRef(null);
  const videoSearchDebounceRef = useRef(null);
  const radioSearchDebounceRef = useRef(null);
  const weatherSearchDebounceRef = useRef(null);
  const updateTimerRef = useRef(null);
  const articleFetchAbortRef = useRef(null);
  const videoFetchAbortRef = useRef(null);
  const radioFetchAbortRef = useRef(null);
  const weatherFetchAbortRef = useRef(null);
  const installerFetchAbortRef = useRef(null);
  const installerManifestMissingRef = useRef("");
  const loggedNetworkIssuesRef = useRef(new Set());
  const radioAudioRef = useRef(null);
  const radarFrameRef = useRef(null);
  const radarMapContainerRef = useRef(null);
  const radarMapRef = useRef(null);
  const radarMapsApiRef = useRef(null);
  const radarOverlayLayerRef = useRef(null);
  const radarMapListenersRef = useRef([]);
  const radarOverlayErrorRef = useRef(0);
  const radarOverlayTimeoutRef = useRef(null);
  const radarFetchBusyRef = useRef(false);
  const [radioIsPlaying, setRadioIsPlaying] = useState(false);
  const pendingRadioAutoplayRef = useRef(false);
  const readOnlyUtteranceRef = useRef(null);
  const readOnlyContentRef = useRef(null);
  const readOnlyFragmentsRef = useRef([]);
  const readOnlyFragmentOffsetsRef = useRef([]);
  const readOnlyActiveFragmentRef = useRef(-1);
  const readOnlyFollowTsRef = useRef(0);
  const appVersion = nativeVersion || APP_VERSION;

  function logIssueOnce(key, message, error) {
    if (!import.meta.env.DEV) return;
    const safeKey = String(key || "").trim();
    if (!safeKey) return;
    if (loggedNetworkIssuesRef.current.has(safeKey)) return;
    loggedNetworkIssuesRef.current.add(safeKey);
    if (error) {
      console.warn(message, error);
    } else {
      console.warn(message);
    }
  }
  const updatePlatform = isAndroidApp
    ? "android"
    : isElectron
    ? "windows"
    : "web";
  const updatePlatformLabel =
    UPDATE_PLATFORM_LABELS[updatePlatform] || UPDATE_PLATFORM_LABELS.web;
  const tabNav = (
    <div className="tab-nav">
      <button
        type="button"
        className={activeTab === "read" ? "active" : ""}
        onClick={() => setActiveTab("read")}
      >
        <i className="fa-solid fa-newspaper" aria-hidden="true"></i>
        <span>Read</span>
      </button>
      <button
        type="button"
        className={activeTab === "see" ? "active" : ""}
        onClick={() => setActiveTab("see")}
      >
        <i className="fa-solid fa-circle-play" aria-hidden="true"></i>
        <span>Watch</span>
      </button>
      <button
        type="button"
        className={activeTab === "hear" ? "active" : ""}
        onClick={() => setActiveTab("hear")}
      >
        <i className="fa-solid fa-radio" aria-hidden="true"></i>
        <span>Listen</span>
      </button>
      <button
        type="button"
        className={activeTab === "feel" ? "active" : ""}
        onClick={() => {
          setActiveTab("feel");
        }}
      >
        <i className="fa-solid fa-cloud-sun" aria-hidden="true"></i>
        <span>Feel</span>
      </button>
    </div>
  );
  const activeThemePreset = useMemo(
    () =>
      THEME_PRESETS.find((item) => item.id === settings.themePreset) ||
      THEME_PRESETS[0],
    [settings.themePreset]
  );
  const previewPalette = useMemo(() => {
    if (!activeThemePreset) return null;
    if (activeThemePreset.palettes) {
      const mode = settings.theme === "dark" ? "dark" : "light";
      return (
        activeThemePreset.palettes[mode] ||
        activeThemePreset.palettes.light ||
        activeThemePreset.palettes.dark ||
        null
      );
    }
    return activeThemePreset.palette || null;
  }, [activeThemePreset, settings.theme]);
  const presetPreviewStyle = previewPalette
    ? {
        background: `linear-gradient(135deg, ${previewPalette.bg}, ${previewPalette.accent})`,
      }
    : { background: "linear-gradient(135deg, var(--bg), var(--accent))" };

  function normalizeBackendUrl(value) {
    if (!value) return "";
    let candidate = String(value).trim();
    if (!candidate) return "";
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

  function updateSetting(key, value) {
    setSettings((prev) => {
      let nextPreset = prev.themePreset;
      if (
        key !== "themePreset" &&
        ["backgroundColor", "backgroundImage"].includes(key) &&
        prev.themePreset !== "custom"
      ) {
        nextPreset = "custom";
      }
      const next = { ...prev, [key]: value, themePreset: nextPreset };
      writeSettings(next);
      return next;
    });
  }

  function applyThemeMode(nextMode) {
    const mode = nextMode === "dark" ? "dark" : "light";
    setSettings((prev) => {
      const next = { ...prev, theme: mode };
      writeSettings(next);
      return next;
    });
  }

  function applyThemePreset(presetId) {
    const preset = THEME_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setSettings((prev) => {
      const next = { ...prev, themePreset: presetId };
      writeSettings(next);
      return next;
    });
  }

  function saveBackendUrl() {
    const normalized = normalizeBackendUrl(backendUrlDraft);
    if (!normalized) {
      setMessage("Enter a valid backend URL (include https://).");
      return;
    }
    updateSetting("backendUrl", normalized);
    setBackendUrlDraft(normalized);
    setMessage("Backend URL saved.");
    loadInstallerAvailability({ force: true });
    loadHeadlines();
    checkBackendConnection({ notify: false });
    if (lastSearch) {
      loadArticles(lastSearch, {
        source: (filterSource || "").trim() || undefined,
        provider: (filterProvider || "").trim() || undefined,
      });
    }
  }

  async function testBackendConnection() {
    setMessage("Testing backend connection...");
    await checkBackendHealth({ notify: true });
    await checkBackendConnection({ notify: true });
  }

  function updateRememberPopoutState(enabled) {
    const nextEnabled = Boolean(enabled);
    setSettings((prev) => {
      const next = {
        ...prev,
        rememberPopoutState: nextEnabled,
        rememberVideoPopoutOpen: nextEnabled ? Boolean(videoPopoutOpen) : false,
        rememberRadioPopoutOpen: nextEnabled ? Boolean(radioPopoutOpen) : false,
      };
      writeSettings(next);
      return next;
    });
  }

  function openExternal(url) {
    if (!url) return;
    if (isElectron && typeof window !== "undefined" && window.NewsAppUpdater?.openExternal) {
      window.NewsAppUpdater.openExternal(url);
      return;
    }
    if (typeof window !== "undefined") {
      const opened = window.open(url, "_blank", "noopener");
      if (!opened) {
        window.location.href = url;
      }
    }
  }

  function renderVideoPlayerSurface(video, { onEnded = null, autoPlay = true, muted = true } = {}) {
    if (!video) return <div className="results-empty">No videos found.</div>;
    return (
      <InlineVideoPlayer
        video={video}
        onEnded={onEnded}
        autoPlay={autoPlay}
        muted={muted}
        openExternal={openExternal}
      />
    );
  }

  function renderRadioPlayback(radio) {
    if (!radio?.stream_url) {
      return <div className="results-empty">No stream URL available for this station.</div>;
    }
    return (
      <>
        <audio
          ref={radioAudioRef}
          controls
          preload="none"
          src={radio.stream_url}
          onError={() => {
            setRadioIsPlaying(false);
            setMessage(
              "Audio playback failed. Some stations require HTTPS, a compatible codec, or an external player."
            );
          }}
          onPlay={() => setRadioIsPlaying(true)}
          onPause={() => setRadioIsPlaying(false)}
          onEnded={() => setRadioIsPlaying(false)}
        />
        {typeof window !== "undefined" &&
        window.location?.protocol === "https:" &&
        String(radio.stream_url || "").toLowerCase().startsWith("http://") ? (
          <div className="radio-warning">
            This station stream is HTTP and may be blocked by your browser on HTTPS. Use “Stream URL”
            to open it externally, or enable HTTPS-only streams in the backend radio settings.
          </div>
        ) : null}
      </>
    );
  }

  function parseReadableHtml(html) {
    if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") {
      return {
        title: "",
        sourceUrl: "",
        bodyHtml: html || "",
        bodyText: "",
      };
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const title =
      doc.querySelector(".nav-title strong")?.textContent?.trim() ||
      doc.title ||
      "";
    const sourceUrl =
      doc.querySelector("#origin-link")?.getAttribute("href") ||
      "";
    const contentNode = doc.querySelector("#reader-content") || doc.body;
    if (contentNode) {
      contentNode.querySelectorAll("script").forEach((node) => node.remove());
    }
    const bodyHtml = contentNode ? contentNode.innerHTML : "";
    const bodyText = contentNode ? contentNode.textContent?.trim() || "" : "";
    return {
      title,
      sourceUrl,
      bodyHtml,
      bodyText,
    };
  }

  function deriveReadOnlyTitle(parsed, article, fallbackUrl) {
    if (parsed?.title) return parsed.title;
    if (article?.title) return article.title;
    if (article?.source) return `${article.source} article`;
    const candidateUrl = parsed?.sourceUrl || fallbackUrl;
    if (candidateUrl) {
      try {
        return new URL(candidateUrl).hostname.replace(/^www\./i, "");
      } catch (err) {
        return candidateUrl;
      }
    }
    return "Read-only";
  }

  function printReadOnly() {
    if (typeof window === "undefined") return;
    if (typeof window.print !== "function") {
      setReadOnlyStatus("Print is not supported in this browser.");
      return;
    }
    document.body.classList.add("print-read-only");
    try {
      window.print();
    } catch (err) {
      setReadOnlyStatus("Unable to open the print dialog.");
    }
    setTimeout(() => {
      document.body.classList.remove("print-read-only");
    }, 600);
  }

  const openReadOnly = async (article) => {
    const url = article?.url;
    if (!url) return;
    if (typeof window !== "undefined") {
      const scrollTop =
        window.scrollY ||
        document.documentElement?.scrollTop ||
        document.body?.scrollTop ||
        0;
      setReadOnlyScrollY(scrollTop);
    }
    setReadOnlyOpen(true);
    setReadOnlyTitle(article?.title || "Read-only");
    setReadOnlyUrl(url);
    setReadOnlyError("");
    setReadOnlyHtml("");
    setReadOnlyText("");
    setReadOnlyStatus("");
    stopReadOnlyReading("");
    resetReadOnlyFragments();
    setReadOnlyLoading(true);
    try {
      const params = {};
      if (typeof window !== "undefined" && window.location?.href) {
        params.home = window.location.href;
      }
      if (settings.theme) {
        params.theme = settings.theme;
      }
      if (settings.backgroundColor) {
        params.bgColor = settings.backgroundColor;
      }
      if (settings.backgroundImage) {
        params.bgImage = settings.backgroundImage;
      }
      if (settings.readAloudEnabled) {
        const rateValue = Number(settings.readAloudRate);
        if (!Number.isNaN(rateValue) && rateValue > 0) {
          params.readRate = String(rateValue);
        }
        if (settings.readAloudVoice) {
          params.readVoice = settings.readAloudVoice;
        }
        if (settings.readAloudAutoStart) {
          params.autoRead = "true";
        }
      }
      const html = await fetchReadableHtml(url, {
        app: isAppRuntime,
        timeoutMs: 30000,
        params,
      });
      if (!html) {
        setReadOnlyError("Read-only content unavailable.");
        return;
      }
      const parsed = parseReadableHtml(html);
      const titleValue = deriveReadOnlyTitle(parsed, article, url);
      setReadOnlyTitle(titleValue);
      setReadOnlyUrl(parsed.sourceUrl || url);
      setReadOnlyHtml(parsed.bodyHtml || "");
      setReadOnlyText(parsed.bodyText || "");
      if (!parsed.bodyHtml) {
        setReadOnlyError("Read-only content unavailable.");
      }
      if (settings.readAloudEnabled && settings.readAloudAutoStart) {
        setTimeout(() => {
          startReadOnlyReading();
        }, 300);
      }
    } catch (err) {
      const message = err?.message || err;
      setReadOnlyError(`Read-only request failed: ${message}`);
    } finally {
      setReadOnlyLoading(false);
    }
  };

  function getUpdateManifestUrl(cacheBust = false) {
    const base = getBackendUrl().replace(/\/+$/, "");
    const token = cacheBust ? `t=${Date.now()}` : "";
    return `${base}/installers/${UPDATE_MANIFEST_FILE}${token ? `?${token}` : ""}`;
  }

  async function loadInstallerAvailability({ force = false } = {}) {
    const base = getBackendUrl().replace(/\/+$/, "");
    const emptyAvailability = Object.fromEntries(INSTALLER_ASSETS.map((asset) => [asset.id, false]));
    if (!base) {
      setInstallerPlatforms({});
      setInstallerAvailability(emptyAvailability);
      return;
    }

    if (!force) {
      const cached = readInstallerManifestCache(base);
      if (cached) {
        setInstallerPlatforms(cached.platforms || {});
        setInstallerAvailability(cached.availability || emptyAvailability);
        return;
      }
      if (installerManifestMissingRef.current === base) {
        setInstallerPlatforms({});
        setInstallerAvailability(emptyAvailability);
        return;
      }
    }

    try {
      installerFetchAbortRef.current?.abort?.();
    } catch (err) {
      // ignore
    }
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    installerFetchAbortRef.current = controller;

    const installerManifestUrl = `${base}/installers/${INSTALLER_MANIFEST_FILE}?t=${Date.now()}`;
    const installerUpdateUrl = `${base}/installers/${UPDATE_MANIFEST_FILE}?t=${Date.now()}`;
    try {
      const manifestRes = await fetch(installerManifestUrl, {
        cache: "no-store",
        signal: controller ? controller.signal : undefined,
      });
      if (manifestRes.ok) {
        const manifest = await manifestRes.json();
        const parsed = parseInstallerStateFromManifestPayload(manifest, base);
        if (hasAnyInstallerAvailable(parsed.availability)) {
          installerManifestMissingRef.current = "";
          setInstallerPlatforms(parsed.platforms);
          setInstallerAvailability(parsed.availability);
          writeInstallerManifestCache(base, parsed);
          return;
        }
      }

      const updateRes = await fetch(installerUpdateUrl, {
        cache: "no-store",
        signal: controller ? controller.signal : undefined,
      });
      if (updateRes.ok) {
        const updatePayload = await updateRes.json();
        const parsed = parseInstallerStateFromManifestPayload(updatePayload, base);
        if (hasAnyInstallerAvailable(parsed.availability)) {
          installerManifestMissingRef.current = "";
          setInstallerPlatforms(parsed.platforms);
          setInstallerAvailability(parsed.availability);
          writeInstallerManifestCache(base, parsed);
          return;
        }
      }

      const ghRes = await fetch(GITHUB_RELEASES_API_LATEST, {
        cache: "no-store",
        signal: controller ? controller.signal : undefined,
      });
      if (!ghRes.ok) {
        const err = new Error(`HTTP ${ghRes.status}`);
        err.status = ghRes.status;
        throw err;
      }
      const ghRelease = await ghRes.json();
      const ghParsed = parseInstallerStateFromGithubReleasePayload(ghRelease, base);
      if (hasAnyInstallerAvailable(ghParsed.availability)) {
        installerManifestMissingRef.current = "";
        setInstallerPlatforms(ghParsed.platforms);
        setInstallerAvailability(ghParsed.availability);
        writeInstallerManifestCache(base, ghParsed);
        return;
      }

      installerManifestMissingRef.current = base;
      setInstallerPlatforms({});
      setInstallerAvailability(emptyAvailability);
      writeInstallerManifestCache(base, {
        platforms: {},
        availability: emptyAvailability,
      });
    } catch (err) {
      if (err?.name === "AbortError") return;
      const issue = classifyRequestError(err, "Installer availability check failed.");
      setInstallerPlatforms({});
      setInstallerAvailability(emptyAvailability);
      if (issue.kind !== "not_found") {
        logIssueOnce(
          `installers:${base}:${issue.status || issue.kind}`,
          `[Installers] ${issue.technicalMessage || "Availability check failed."}`,
          err
        );
      }
    } finally {
      if (installerFetchAbortRef.current === controller) {
        installerFetchAbortRef.current = null;
      }
    }
  }

  const closeReadOnly = () => {
    setReadOnlyOpen(false);
    setReadOnlyHtml("");
    setReadOnlyError("");
    setReadOnlyLoading(false);
    setReadOnlyText("");
    setReadOnlyStatus("");
    stopReadOnlyReading("");
    resetReadOnlyFragments();
    if (typeof window !== "undefined") {
      const target = readOnlyScrollY || 0;
      setTimeout(() => {
        window.scrollTo({ top: target, behavior: "auto" });
      }, 60);
    }
  };

  const openVideoModal = (video) => {
    if (!video) return;
    setVideoModalVideo(video);
    setVideoModalOpen(true);
  };

  const closeVideoModal = () => {
    setVideoModalOpen(false);
    setVideoModalVideo(null);
  };

  const openWeatherTrend = (group) => {
    if (!group) return;
    if (!Array.isArray(group.rows) || group.rows.length === 0) return;
    setWeatherTrendGroup(group);
    setWeatherTrendPointTs(null);
    setWeatherTrendOpen(true);
  };

  const closeWeatherTrend = () => {
    setWeatherTrendOpen(false);
    setWeatherTrendGroup(null);
    setWeatherTrendPointTs(null);
  };

  const checkForUpdates = async ({ silent } = {}) => {
    if (!isStandalone) return;
    if (!silent) {
      setUpdateStatus("Checking for updates...");
    }
    try {
      const res = await fetch(getUpdateManifestUrl(true), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();
      const platforms = manifest?.platforms && typeof manifest.platforms === "object"
        ? manifest.platforms
        : {};
      setInstallerPlatforms(platforms);
      const rawPlatformInfo = platforms?.[updatePlatform];
      const platformAsset = INSTALLER_ASSETS.find((asset) => asset.id === updatePlatform);
      const platformInfo = rawPlatformInfo?.version
        ? {
            ...rawPlatformInfo,
            url: resolveInstallerAssetUrl(
              getBackendUrl().replace(/\/+$/, ""),
              platformAsset?.file || "",
              rawPlatformInfo?.url || ""
            ),
          }
        : null;
      if (!platformInfo?.version) {
        setUpdateInfo(null);
        setUpdateStatus("Update manifest missing.");
        return;
      }
      const isNewer = compareVersions(platformInfo.version, appVersion) > 0;
      if (isNewer) {
        setUpdateInfo(platformInfo);
        setUpdateStatus(
          `Current v${appVersion} | Latest v${platformInfo.version} available`
        );
        if (!isElectron && settings.updatePolicy === "auto" && platformInfo.url) {
          openExternal(platformInfo.url);
        }
      } else {
        setUpdateInfo(null);
        setUpdateStatus(`Current v${appVersion} | Latest v${platformInfo.version}`);
      }
    } catch (err) {
      setUpdateStatus(`Update check failed: ${err.message || err}`);
    }
  };

  const dismissFeaturesModal = () => {
    if (featuresOptOut) {
      writeFeaturesOptOut(true);
    }
    writeFeaturesSeenVersion(APP_VERSION);
    setShowFeaturesModal(false);
  };

  const handleUpdateNow = () => {
    if (isElectron && typeof window !== "undefined" && window.NewsAppUpdater) {
      window.NewsAppUpdater.checkNow();
      return;
    }
    if (updateInfo?.url) {
      const cacheBust = isAndroidApp ? `v=${Date.now()}` : "";
      const nextUrl = cacheBust
        ? `${updateInfo.url}${updateInfo.url.includes("?") ? "&" : "?"}${cacheBust}`
        : updateInfo.url;
      openExternal(nextUrl);
    }
  };

  const scheduleUpdateChecks = () => {
    if (!isAndroidApp) return;
    if (updateTimerRef.current) {
      clearInterval(updateTimerRef.current);
    }
    if (settings.updatePolicy === "never") return;
    const baseIntervalHours =
      settings.updatePolicy === "scheduled"
        ? Number(settings.updateIntervalHours) || 24
        : 24;
    const intervalMs = Math.max(1, baseIntervalHours) * 60 * 60 * 1000;
    checkForUpdates({ silent: true });
    updateTimerRef.current = setInterval(() => {
      checkForUpdates({ silent: true });
    }, intervalMs);
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const preset = activeThemePreset;
    const mode = settings.theme === "dark" ? "dark" : "light";
    const palette = preset?.palettes
      ? preset.palettes[mode] || preset.palettes.light || preset.palettes.dark
      : preset?.palette;
    const theme = mode;
    const overlayBase =
      palette?.accentStrong || palette?.accent || (mode === "dark" ? "#0f172a" : "#f97316");
    root.setAttribute("data-theme", theme);
    if (palette) {
      Object.entries(THEME_VARIABLES).forEach(([key, variable]) => {
        const value = palette[key];
        if (value) {
          root.style.setProperty(variable, value);
        }
      });
    } else {
      Object.values(THEME_VARIABLES).forEach((variable) => {
        root.style.removeProperty(variable);
      });
    }
    const nextColor =
      settings.backgroundColor || DEFAULT_SETTINGS.backgroundColor;
    root.style.setProperty("--app-bg-color", nextColor);
    const bgImage = (settings.backgroundImage || "").trim();
    root.style.setProperty(
      "--app-bg-image",
      bgImage ? `url(\"${bgImage}\")` : "none"
    );
    const rawOpacity = Number(settings.overlayOpacity);
    const overlayOpacity = Number.isFinite(rawOpacity)
      ? Math.min(Math.max(rawOpacity, 0), 0.6)
      : DEFAULT_SETTINGS.overlayOpacity;
    root.style.setProperty("--overlay-color", overlayBase);
    root.style.setProperty("--overlay-opacity", String(overlayOpacity));
  }, [
    settings.theme,
    settings.themePreset,
    settings.backgroundColor,
    settings.backgroundImage,
    settings.overlayOpacity,
    activeThemePreset,
  ]);

  useEffect(() => {
    setWeatherRetryBlocked(false);
    setWeatherError("");
    if (!settings.autoRefreshHeadlines) {
      loadHeadlines();
    }
    loadVideos("all");
    loadRadios("all");
    loadWeatherData("all");
    loadFilterCatalog();
    loadInstallerAvailability();
    loadHeadlineStats();
    checkBackendHealth({ notify: false });
    checkBackendConnection({ notify: false });
  }, [settings.backendUrl]);

  useEffect(() => {
    if (activeTab !== "feel") return;
    if (typeof fetch === "undefined") return;
    if (radarFetchBusyRef.current) return;
    let cancelled = false;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const backgroundRefresh = Array.isArray(radarFrames) && radarFrames.length > 0;

    radarFetchBusyRef.current = true;
    if (!backgroundRefresh) {
      setRadarLoading(true);
      setRadarError("");
    }

    fetch("https://api.rainviewer.com/public/weather-maps.json", {
      cache: "no-store",
      signal: controller ? controller.signal : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const frames = parseRainViewerFrames(data);
        if (!frames.length) {
          setRadarError("Radar frames were unavailable.");
          return;
        }
        setRadarFrames(frames);
        // Always move to latest frame on refresh while preserving map viewport.
        setRadarFrameIndex(frames.length - 1);
        setRadarUpdatedAt(formatTime());
        setRadarError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setRadarError(`Radar unavailable: ${err?.message || err}`);
      })
      .finally(() => {
        if (cancelled) return;
        radarFetchBusyRef.current = false;
        if (!backgroundRefresh) {
          setRadarLoading(false);
        }
      });

    return () => {
      cancelled = true;
      try {
        controller?.abort?.();
      } catch (err) {
        // ignore
      }
      radarFetchBusyRef.current = false;
    };
  }, [activeTab, radarRefreshNonce]);

  useEffect(() => {
    scheduleUpdateChecks();
    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [settings.updatePolicy, settings.updateIntervalHours, isAndroidApp]);

  useEffect(() => {
    if (!search.trim()) {
      if (!hasSearched) return;
      return;
    }
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      loadArticles(search, {
        source: (filterSource || "").trim() || undefined,
        provider: (filterProvider || "").trim() || undefined,
      });
    }, 450);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [search, filterSource, filterProvider]);

  useEffect(() => {
    if (!videoHasSearched) return;
    if (videoSearchDebounceRef.current) {
      clearTimeout(videoSearchDebounceRef.current);
    }
    videoSearchDebounceRef.current = setTimeout(() => {
      runVideoSearch(videoSearch || "all");
    }, 350);
    return () => {
      if (videoSearchDebounceRef.current) {
        clearTimeout(videoSearchDebounceRef.current);
      }
    };
  }, [videoSearch]);

  useEffect(() => {
    if (!radioHasSearched) return;
    if (radioSearchDebounceRef.current) {
      clearTimeout(radioSearchDebounceRef.current);
    }
    radioSearchDebounceRef.current = setTimeout(() => {
      runRadioSearch(radioSearch || "all");
    }, 350);
    return () => {
      if (radioSearchDebounceRef.current) {
        clearTimeout(radioSearchDebounceRef.current);
      }
    };
  }, [radioSearch]);

  useEffect(() => {
    if (!weatherHasSearched) return;
    if (weatherSearchDebounceRef.current) {
      clearTimeout(weatherSearchDebounceRef.current);
    }
    weatherSearchDebounceRef.current = setTimeout(() => {
      runWeatherSearch(weatherSearch || "all");
    }, 350);
    return () => {
      if (weatherSearchDebounceRef.current) {
        clearTimeout(weatherSearchDebounceRef.current);
      }
    };
  }, [weatherSearch]);

  useEffect(() => {
    return () => {
      const refs = [
        articleFetchAbortRef,
        videoFetchAbortRef,
        radioFetchAbortRef,
        weatherFetchAbortRef,
        installerFetchAbortRef,
      ];
      refs.forEach((ref) => {
        try {
          ref.current?.abort?.();
        } catch (err) {
          // ignore
        }
        ref.current = null;
      });
    };
  }, []);

  const resetSettings = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    writeSettings({ ...DEFAULT_SETTINGS });
    setBackendUrlDraft("");
    setVideoPopoutOpen(false);
    setRadioPopoutOpen(false);
  };

  useEffect(() => {
    if (settings.backendUrl !== backendUrlDraft) {
      setBackendUrlDraft(settings.backendUrl || "");
    }
  }, [settings.backendUrl]);

  useEffect(() => {
    if (!settings.rememberPopoutState) return;
    setSettings((prev) => {
      if (!prev.rememberPopoutState) return prev;
      const nextVideo = Boolean(videoPopoutOpen);
      const nextRadio = Boolean(radioPopoutOpen);
      if (
        Boolean(prev.rememberVideoPopoutOpen) === nextVideo &&
        Boolean(prev.rememberRadioPopoutOpen) === nextRadio
      ) {
        return prev;
      }
      const next = {
        ...prev,
        rememberVideoPopoutOpen: nextVideo,
        rememberRadioPopoutOpen: nextRadio,
      };
      writeSettings(next);
      return next;
    });
  }, [videoPopoutOpen, radioPopoutOpen, settings.rememberPopoutState]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try {
      await installPrompt.userChoice;
    } catch (err) {
      // ignore
    }
    setInstallPrompt(null);
    setCanInstall(false);
  };

  const navigate = (nextView) => {
    if (nextView === "settings") {
      setView("dashboard");
      openAppMenu();
      if (typeof window !== "undefined") {
        window.location.hash = "#settings";
      }
      return;
    }
    setView(nextView);
    if (typeof window !== "undefined") {
      window.location.hash = "";
    }
  };

  const openAppMenu = () => {
    setAppSettingsSection("");
    setAppMenuOpen(true);
  };

  const closeAppMenu = () => {
    setAppMenuOpen(false);
  };

  const openAppSettings = (sectionId) => {
    setAppSettingsSection(sectionId || "");
    setAppMenuOpen(false);
  };

  const closeAppSettings = () => {
    setAppSettingsSection("");
  };

  useEffect(() => {
    if (view === "settings") {
      setView("dashboard");
      openAppMenu();
      if (typeof window !== "undefined") {
        window.location.hash = "#settings";
      }
    }
  }, [view]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#settings") {
      openAppMenu();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const permissionsApi = window.navigator?.permissions;
    if (!permissionsApi?.query) return;
    let cancelled = false;
    let permissionStatus = null;
    const syncPermissionState = (state) => {
      if (cancelled) return;
      if (state === "granted") {
        setDeviceWeatherLocationStatus((prev) => {
          if (prev.state === "ready" || prev.state === "requesting") return prev;
          return {
            state: "idle",
            label: "Location permission granted. Tap \"Use my location\" to load local weather.",
          };
        });
        return;
      }
      if (state === "denied") {
        setDeviceWeatherLocation(null);
        setDeviceWeatherLocationStatus({
          state: "denied",
          label: "Device location is blocked for this site. Enable it in browser settings and retry.",
        });
        return;
      }
      setDeviceWeatherLocationStatus((prev) => {
        if (prev.state === "ready" || prev.state === "requesting") return prev;
        return {
          state: "idle",
          label: "Location access is available. Allow the prompt to enable local weather.",
        };
      });
    };

    permissionsApi
      .query({ name: "geolocation" })
      .then((status) => {
        if (cancelled || !status) return;
        permissionStatus = status;
        syncPermissionState(status.state);
        status.onchange = () => syncPermissionState(status.state);
      })
      .catch(() => {
        // Ignore unsupported permissions APIs and keep default behavior.
      });

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const scopeRoot = document.querySelector(".page") || document.body;
    if (typeof MutationObserver === "undefined") {
      applyAutoTooltips(scopeRoot);
      return;
    }
    let rafId = 0;
    const apply = () => applyAutoTooltips(scopeRoot);
    apply();
    const observer = new MutationObserver(() => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        apply();
      });
    });
    observer.observe(scopeRoot, {
      childList: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAppRuntime || typeof window === "undefined") return;
    const handleMenu = (payload) => {
      if (payload && payload.section) {
        openAppSettings(payload.section);
      } else {
        openAppMenu();
      }
    };
    if (window.NewsAppUpdater?.onSettings) {
      window.NewsAppUpdater.onSettings(handleMenu);
    }
  }, [isAppRuntime]);

  const scrollToSection = (id) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const acceptCookies = () => {
    writeCookieConsent("accepted");
    setCookieConsent("accepted");
  };

  const rejectCookies = () => {
    writeCookieConsent("declined");
    setCookieConsent("declined");
  };

  const cookieBanner = !cookieConsent && !isAppRuntime ? (
    <div className="cookie-banner" role="dialog" aria-live="polite">
      <div className="cookie-card">
        <div className="cookie-content">
          <strong>Cookie notice</strong>
          <p>
            We use essential cookies/local storage to keep the app working and
            remember your settings. Optional cookies help us measure performance.
            You can reject optional cookies and still use the app.
          </p>
        </div>
        <div className="cookie-actions">
          <a className="cookie-link" href="/terms.html">
            Learn more
          </a>
          <button type="button" onClick={rejectCookies}>
            Reject optional
          </button>
          <button type="button" className="primary" onClick={acceptCookies}>
            Accept
          </button>
        </div>
      </div>
    </div>
  ) : null;

  function getArticleImage(article) {
    if (!article) return "";
    return article.urlToImage || article.url_to_image || article.urltoimage || "";
  }

  function normalize(value) {
    return normalizeText(value);
  }

  function normalizeProviderLabel(value) {
    const label = (value || "").toString().trim();
    if (!label) return "";
    return PROVIDER_LABELS[label.toLowerCase()] || label;
  }

  function buildArticleText(article) {
    const item = article || {};
    return [
      item.title,
      item.name,
      item.description,
      item.content,
      item.source,
      item.provider,
      item.author,
      item.tags,
      item.country,
      item.country_code,
      item.language,
      item.location_name,
    ]
      .filter(Boolean)
      .map((value) => value.toString())
      .join(" ");
  }

  function matchesExclusions(article, exclusions) {
    const terms = expandExclusionTerms(parseList(exclusions));
    if (!terms.length) return false;
    const haystack = normalize(buildArticleText(article));
    const compactHaystack = compactText(haystack);
    return terms.some((term) => {
      if (!term) return false;
      if (term.includes("*")) {
        const wildcard = term
          .split("*")
          .map((part) => escapeRegExp(part))
          .join(".*");
        return new RegExp(`\\b${wildcard}\\b`, "i").test(haystack);
      }
      const compactTerm = compactText(term);
      if (!compactTerm) return false;
      if (compactTerm.length <= 2) {
        return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(haystack);
      }
      const boundary = new RegExp(`\\b${escapeRegExp(term)}(?:s|es|ed|ing)?\\b`, "i");
      if (boundary.test(haystack)) return true;
      return compactTerm.length >= 4 && compactHaystack.includes(compactTerm);
    });
  }

  function matchesLocation(article, location) {
    const variants = buildLocationVariants(location);
    if (!variants.length) return true;
    const rawText = buildArticleText(article);
    const haystack = normalize(rawText);
    const compactHaystack = compactText(haystack);
    return variants.some((variant) => {
      const normalized = normalize(variant);
      if (!normalized) return false;
      const compactVariant = compactText(normalized);
      if (!compactVariant) return false;
      if (/^[a-z]{2}$/.test(normalized)) {
        const dotted = normalized.split("").join("\\.?");
        return new RegExp(`\\b${dotted}\\.?(?![a-z])`, "i").test(rawText);
      }
      if (normalized.length <= 3) {
        return new RegExp(`\\b${escapeRegExp(normalized)}\\b`, "i").test(haystack);
      }
      if (haystack.includes(normalized)) return true;
      return compactVariant.length >= 4 && compactHaystack.includes(compactVariant);
    });
  }

  function buildFilterOptions(values, formatter = null) {
    const map = new Map();
    values.forEach((value) => {
      const raw = (value || "").toString().trim();
      const label = formatter ? formatter(raw) : raw;
      if (!label) return;
      const key = label.toLowerCase();
      if (!map.has(key)) {
        map.set(key, label);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }

  function extractCatalogValues(items, key) {
    if (!Array.isArray(items)) return [];
    return items
      .map((row) => (row && row[key] ? String(row[key]).trim() : ""))
      .filter(Boolean);
  }

  function getPublishedValue(article) {
    const raw = article?.publishedAt || article?.published_at || "";
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function getVideoPublishedValue(video) {
    const raw = video?.published_at || video?.publishedAt || "";
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function getWeatherTimeValue(item) {
    const raw = item?.weather_time || item?.fetched_at || "";
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const aLat = Number(lat1);
    const aLon = Number(lon1);
    const bLat = Number(lat2);
    const bLon = Number(lon2);
    if (
      !Number.isFinite(aLat) ||
      !Number.isFinite(aLon) ||
      !Number.isFinite(bLat) ||
      !Number.isFinite(bLon)
    ) {
      return Number.POSITIVE_INFINITY;
    }
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const latRad1 = toRad(aLat);
    const latRad2 = toRad(bLat);
    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);
    const h =
      sinLat * sinLat +
      Math.cos(latRad1) * Math.cos(latRad2) * sinLon * sinLon;
    return 6371 * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  }

  function computeHeatIndexF(temperatureF, humidityPercent) {
    const t = Number(temperatureF);
    const rh = Number(humidityPercent);
    if (!Number.isFinite(t) || !Number.isFinite(rh)) return null;
    if (t < 80 || rh < 40) return t;
    const c1 = -42.379;
    const c2 = 2.04901523;
    const c3 = 10.14333127;
    const c4 = -0.22475541;
    const c5 = -0.00683783;
    const c6 = -0.05481717;
    const c7 = 0.00122874;
    const c8 = 0.00085282;
    const c9 = -0.00000199;
    return (
      c1 +
      c2 * t +
      c3 * rh +
      c4 * t * rh +
      c5 * t * t +
      c6 * rh * rh +
      c7 * t * t * rh +
      c8 * t * rh * rh +
      c9 * t * t * rh * rh
    );
  }

  function computeWindChillF(temperatureF, windMph) {
    const t = Number(temperatureF);
    const v = Number(windMph);
    if (!Number.isFinite(t) || !Number.isFinite(v)) return null;
    if (t > 50 || v < 3) return t;
    return 35.74 + 0.6215 * t - 35.75 * Math.pow(v, 0.16) + 0.4275 * t * Math.pow(v, 0.16);
  }

  function computeComfortScore(temperatureF, humidityPercent, windMph, apparentF) {
    const temp = Number(temperatureF);
    const humidity = Number(humidityPercent);
    const wind = Number(windMph);
    const apparent = Number(apparentF);
    if (!Number.isFinite(temp) || !Number.isFinite(humidity)) return null;
    const tempPenalty = Math.min(40, Math.abs(temp - 70));
    const humidityPenalty = Math.min(25, Math.abs(humidity - 50) * 0.5);
    const windPenalty = Number.isFinite(wind) ? Math.min(15, Math.max(0, wind - 12) * 0.8) : 0;
    const apparentPenalty = Number.isFinite(apparent)
      ? Math.min(20, Math.abs(apparent - temp) * 0.6)
      : 0;
    const score = 100 - tempPenalty - humidityPenalty - windPenalty - apparentPenalty;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function normalizeRainViewerHost(host) {
    return String(host || "").trim().replace(/\/+$/, "");
  }

  function parseRainViewerFrames(payload) {
    const host = normalizeRainViewerHost(payload?.host);
    if (!host) return [];
    const past = Array.isArray(payload?.radar?.past) ? payload.radar.past : [];
    return past
      .map((entry) => ({
        host,
        path: String(entry?.path || "").trim(),
        time: Number(entry?.time) || 0,
      }))
      .filter((entry) => entry.host && entry.path && entry.time > 0)
      .sort((a, b) => a.time - b.time);
  }

  function buildRainViewerOverlayTemplate(host, path) {
    const base = normalizeRainViewerHost(host);
    const rawPath = String(path || "").trim();
    if (!base || !rawPath) return "";
    const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    return `${base}${normalizedPath}/256/{z}/{x}/{y}/2/1_1.png`;
  }

  function formatTime(date = new Date()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatTimestamp(value) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString([], {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "2-digit",
      });
    }
    return String(value);
  }

  function describeDonutSegment(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
    const toPoint = (radius, angle) => {
      const radians = ((angle - 90) * Math.PI) / 180;
      return {
        x: cx + radius * Math.cos(radians),
        y: cy + radius * Math.sin(radians),
      };
    };

    const outerStart = toPoint(outerRadius, startAngle);
    const outerEnd = toPoint(outerRadius, endAngle);
    const innerStart = toPoint(innerRadius, startAngle);
    const innerEnd = toPoint(innerRadius, endAngle);
    const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

    return [
      `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
      `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
      "Z",
    ].join(" ");
  }

  function stripHtml(input) {
    if (!input) return "";
    if (typeof window !== "undefined" && window.DOMParser) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(input), "text/html");
      return (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
    }
    return String(input)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function applyFilters(saved) {
    setFilterSource(saved.filterSource || "");
    setFilterProvider(saved.filterProvider || "");
    setSortKey(saved.sortKey || "publishedAt");
    setSortDir(saved.sortDir || "desc");
  }

  function saveFilters() {
    writeSavedFilters({
      filterSource,
      filterProvider,
      sortKey,
      sortDir,
    });
    setMessage("Filters saved.");
  }

  function applySavedFilters() {
    const saved = readSavedFilters();
    if (!saved) {
      setMessage("No saved filters found.");
      return;
    }
    applyFilters(saved);
    setMessage("Saved filters applied.");
  }

  function clearFilters() {
    setFilterSource("");
    setFilterProvider("");
    setSortKey("publishedAt");
    setSortDir("desc");
  }

  async function loadHeadlines() {
    setHeadlineLoading(true);
    try {
      const data = await fetchArticles({ limit: HEADLINE_LIMIT });
      setHeadlineArticles(data || []);
      setHeadlineUpdatedAt(formatTime());
      loadHeadlineStats();
    } catch (err) {
      setMessage(`Error: ${err.message || err}`);
    } finally {
      setHeadlineLoading(false);
    }
  }

  async function loadHeadlineStats() {
    try {
      const [countData, lastData] = await Promise.all([
        fetchArticleCount(),
        fetchLastUpdated(),
      ]);
      if (countData && typeof countData.article_count === "number") {
        setHeadlineTotalCount(countData.article_count);
      } else {
        setHeadlineTotalCount(null);
      }
      const lastValue = lastData && lastData.last_updated;
      if (lastValue) {
        setHeadlineUpdatedAt(formatTimestamp(lastValue));
      }
    } catch (err) {
      setHeadlineTotalCount(null);
    }
  }

  async function loadFilterCatalog() {
    try {
      const data = await fetchProviderStats();
      setProviderCatalog(extractCatalogValues(data, "provider"));
    } catch (err) {
      // Ignore catalog failures; fall back to results list.
    }
    try {
      const data = await fetchSourceStats();
      setSourceCatalog(extractCatalogValues(data, "source"));
    } catch (err) {
      // Ignore catalog failures; fall back to results list.
    }
  }

    async function loadArticles(q = null, options = {}) {
    const query = (q || "").trim();
    if (!query) {
      try {
        articleFetchAbortRef.current?.abort?.();
      } catch (err) {
        // ignore
      }
      articleFetchAbortRef.current = null;
      setArticles([]);
      setHasSearched(false);
      setLastSearch("");
      setResultsUpdatedAt("");
      return;
    }
    try {
      articleFetchAbortRef.current?.abort?.();
    } catch (err) {
      // ignore
    }
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    articleFetchAbortRef.current = controller;
    setHasSearched(true);
    setLoading(true);
    try {
      const data = await fetchArticles({
        search: query,
        source: options.source,
        provider: options.provider,
        limit: RESULTS_LIMIT,
      }, {
        signal: controller ? controller.signal : undefined,
      });
      if (articleFetchAbortRef.current !== controller) return;
      setArticles(data || []);
      setLastSearch(query);
      setResultsUpdatedAt(formatTime());
    } catch (err) {
      if (err?.name === "AbortError") return;
      setMessage(`Error: ${err.message || err}`);
    } finally {
      if (articleFetchAbortRef.current === controller) {
        articleFetchAbortRef.current = null;
        setLoading(false);
      }
    }
  }

  async function loadVideos(q = null, options = {}) {
    const query = (q || "").trim();
    try {
      videoFetchAbortRef.current?.abort?.();
    } catch (err) {
      // ignore
    }
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    videoFetchAbortRef.current = controller;
    setVideoLoading(true);
    try {
      const data = await fetchVideos({
        search: query || "all",
        source: options.source,
        provider: options.provider,
        start_date: options.start_date,
        end_date: options.end_date,
        sort_by: options.sort_by || "published_at",
        sort_dir: options.sort_dir || "desc",
        limit: VIDEO_RESULTS_LIMIT,
      }, {
        signal: controller ? controller.signal : undefined,
      });
      if (videoFetchAbortRef.current !== controller) return;
      setVideos(data || []);
      if (
        options.rotateAfterLoad &&
        settings.videoAutoRotate &&
        Array.isArray(data) &&
        data.length > 1 &&
        !videoHasSearched
      ) {
        setActiveVideoIndex((prev) => (prev + 1) % data.length);
      }
      setVideosUpdatedAt(formatTime());
    } catch (err) {
      if (err?.name === "AbortError") return;
      setMessage(`Error: ${err.message || err}`);
    } finally {
      if (videoFetchAbortRef.current === controller) {
        videoFetchAbortRef.current = null;
        setVideoLoading(false);
      }
    }
  }

  async function loadRadios(q = null, options = {}) {
    const query = (q || "").trim();
    try {
      radioFetchAbortRef.current?.abort?.();
    } catch (err) {
      // ignore
    }
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    radioFetchAbortRef.current = controller;
    setRadioLoading(true);
    try {
      const data = await fetchRadios({
        search: query || "all",
        country: options.country,
        language: options.language,
        tag: options.tag,
        provider: options.provider,
        sort_by: options.sort_by || "votes",
        sort_dir: options.sort_dir || "desc",
        limit: RADIO_RESULTS_LIMIT,
      }, {
        signal: controller ? controller.signal : undefined,
      });
      if (radioFetchAbortRef.current !== controller) return;
      setRadios(data || []);
      if (
        options.rotateAfterLoad &&
        settings.radioAutoRotate &&
        !radioIsPlaying &&
        Array.isArray(data) &&
        data.length > 1 &&
        !radioHasSearched
      ) {
        setActiveRadioIndex((prev) => (prev + 1) % data.length);
      }
      setRadiosUpdatedAt(formatTime());
    } catch (err) {
      if (err?.name === "AbortError") return;
      setMessage(`Error: ${err.message || err}`);
    } finally {
      if (radioFetchAbortRef.current === controller) {
        radioFetchAbortRef.current = null;
        setRadioLoading(false);
      }
    }
  }

  async function loadWeatherData(q = null, options = {}) {
    const query = (q || "").trim();
    try {
      weatherFetchAbortRef.current?.abort?.();
    } catch (err) {
      // ignore
    }
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    weatherFetchAbortRef.current = controller;
    setWeatherLoading(true);
    setWeatherError("");
    try {
      const searchQuery = query || "all";
      const shouldResolveLive = options.resolve !== false;
      const requestedResolveLimit = Number(options.resolve_limit);
      const safeResolveLimit = Number.isFinite(requestedResolveLimit)
        ? Math.max(1, Math.min(WEATHER_RESOLVE_LIMIT_MAX, Math.trunc(requestedResolveLimit)))
        : WEATHER_LIVE_RESOLVE_LIMIT;
      const data = await fetchWeather({
        search: searchQuery,
        country: options.country,
        sort_by: options.sort_by || "weather_time",
        sort_dir: options.sort_dir || "desc",
        limit: WEATHER_RESULTS_LIMIT,
        resolve: shouldResolveLive ? "true" : undefined,
        resolve_limit: shouldResolveLive ? safeResolveLimit : undefined,
      }, {
        signal: controller ? controller.signal : undefined,
      });
      if (weatherFetchAbortRef.current !== controller) return;
      setWeatherRetryBlocked(false);
      setWeatherRows(data || []);
      setWeatherUpdatedAt(formatTime());
    } catch (err) {
      if (err?.name === "AbortError") return;
      const issue = classifyRequestError(err, "Unable to load weather.");
      if (issue.kind === "validation" || issue.kind === "auth") {
        setWeatherRetryBlocked(true);
      }
      setWeatherError(issue.userMessage || "Unable to load weather.");
      if (issue.kind === "validation") {
        setMessage(issue.userMessage || "Weather request is invalid. Update filters and retry.");
      } else if (issue.kind === "auth") {
        setMessage(issue.userMessage || "Weather authorization failed.");
      } else {
        setMessage(`Error: ${issue.userMessage || issue.technicalMessage || err}`);
      }
      logIssueOnce(
        `weather:${issue.status || issue.kind}`,
        `[Weather] ${issue.technicalMessage || "Weather request failed."}`,
        err
      );
    } finally {
      if (weatherFetchAbortRef.current === controller) {
        weatherFetchAbortRef.current = null;
        setWeatherLoading(false);
      }
    }
  }

  const buildVideoFetchOptions = () => ({
    source: (videoFilterSource || "").trim() || undefined,
    provider: (videoFilterProvider || "").trim() || undefined,
    start_date: videoStartDate ? `${videoStartDate} 00:00:00` : undefined,
    end_date: videoEndDate ? `${videoEndDate} 23:59:59` : undefined,
    sort_by: videoSortKey,
    sort_dir: videoSortDir,
  });

  const buildRadioFetchOptions = () => ({
    country: (radioFilterCountry || "").trim() || undefined,
    language: (radioFilterLanguage || "").trim() || undefined,
    tag: (radioFilterTag || "").trim() || undefined,
    provider: (radioFilterProvider || "").trim() || undefined,
    sort_by: radioSortKey,
    sort_dir: radioSortDir,
  });

  const buildWeatherFetchOptions = () => ({
    sort_by: weatherSortKey,
    sort_dir: weatherSortDir,
    resolve_limit: WEATHER_LIVE_RESOLVE_LIMIT,
  });

  function runVideoSearch(q = null) {
    const raw = typeof q === "string" ? q : videoSearch;
    const query = (raw || "").trim() || "all";
    setVideoHasSearched(true);
    setLastVideoSearch(query);
    setActiveVideoIndex(0);
    loadVideos(query, buildVideoFetchOptions());
  }

  function clearVideoSearchState() {
    setVideoSearch("");
    setVideoFilterSource("");
    setVideoFilterProvider("");
    setVideoStartDate("");
    setVideoEndDate("");
    setVideoSortKey("published_at");
    setVideoSortDir("desc");
    setVideoHasSearched(false);
    setLastVideoSearch("");
    setActiveVideoIndex(0);
    loadVideos("all");
  }

  function runRadioSearch(q = null) {
    const raw = typeof q === "string" ? q : radioSearch;
    const query = (raw || "").trim() || "all";
    setRadioHasSearched(true);
    setLastRadioSearch(query);
    setActiveRadioIndex(0);
    loadRadios(query, buildRadioFetchOptions());
  }

  function clearRadioSearchState() {
    setRadioSearch("");
    setRadioFilterCountry("");
    setRadioFilterLanguage("");
    setRadioFilterTag("");
    setRadioFilterProvider("");
    setRadioSortKey("votes");
    setRadioSortDir("desc");
    setRadioHasSearched(false);
    setLastRadioSearch("");
    setActiveRadioIndex(0);
    loadRadios("all");
  }

  function runWeatherSearch(q = null) {
    const raw = typeof q === "string" ? q : weatherSearch;
    const query = (raw || "").trim() || "all";
    setWeatherRetryBlocked(false);
    setWeatherError("");
    setWeatherHasSearched(true);
    setLastWeatherSearch(query);
    loadWeatherData(query, buildWeatherFetchOptions());
  }

  function clearWeatherSearchState() {
    setWeatherRetryBlocked(false);
    setWeatherError("");
    setWeatherSearch("");
    setWeatherSortKey("weather_time");
    setWeatherSortDir("desc");
    setWeatherHasSearched(false);
    setLastWeatherSearch("");
    loadWeatherData("all");
  }

  function requestDeviceWeatherLocation({ force = false } = {}) {
    if (typeof window === "undefined") return;
    if (window.isSecureContext === false) {
      const currentHref = window.location?.href || "";
      const httpsHref = currentHref.startsWith("http://")
        ? currentHref.replace(/^http:\/\//i, "https://")
        : currentHref;
      setDeviceWeatherLocation(null);
      setDeviceWeatherLocationStatus({
        state: "insecure",
        label: `Device location requires HTTPS. Open this site over https:// and retry.${httpsHref ? ` (${httpsHref})` : ""}`,
      });
      return;
    }
    if (!window.navigator?.geolocation?.getCurrentPosition) {
      setDeviceWeatherLocation(null);
      setDeviceWeatherLocationStatus({
        state: "unavailable",
        label: "Device location is unavailable in this browser.",
      });
      return;
    }
    if (!force && deviceWeatherLocationStatus.state !== "idle") return;
    setWeatherRetryBlocked(false);
    setWeatherError("");

    const startRequest = () => {
      setDeviceWeatherLocationStatus({
        state: "requesting",
        label: "Requesting device location permission...",
      });

      window.navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = pos?.coords || {};
          const latitude = Number(coords.latitude);
          const longitude = Number(coords.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            setDeviceWeatherLocation(null);
            setDeviceWeatherLocationStatus({
              state: "error",
              label: "Device location was unavailable.",
            });
            return;
          }
          setDeviceWeatherLocation({
            latitude,
            longitude,
            accuracy: coords.accuracy,
          });
          setDeviceWeatherLocationStatus({
            state: "ready",
            label: "Device location enabled.",
          });
          const query = (lastWeatherSearch || weatherSearch || "all").trim() || "all";
          loadWeatherData(query, buildWeatherFetchOptions());
        },
        (err) => {
          const code = err?.code;
          const message = String(err?.message || "").toLowerCase();
          setDeviceWeatherLocation(null);

          if (code === 1) {
            if (message.includes("permissions policy") || message.includes("permission policy")) {
              setDeviceWeatherLocationStatus({
                state: "denied",
                label:
                  "Device location is blocked by a Permissions Policy. Enable geolocation for this site and retry.",
              });
            } else {
              setDeviceWeatherLocationStatus({
                state: "denied",
                label:
                  "Device location permission was denied. Enable it in your browser site settings and retry.",
              });
            }
          } else if (code === 2) {
            setDeviceWeatherLocationStatus({
              state: "error",
              label: "Device location is unavailable right now.",
            });
          } else if (code === 3) {
            setDeviceWeatherLocationStatus({
              state: "timeout",
              label: "Device location request timed out. Try again.",
            });
          } else {
            setDeviceWeatherLocationStatus({
              state: "error",
              label: "Device location request failed.",
            });
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 10 * 60 * 1000,
        }
      );
    };

    if (window.navigator?.permissions?.query) {
      window.navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          if (status?.state === "denied") {
            setDeviceWeatherLocation(null);
            setDeviceWeatherLocationStatus({
              state: "denied",
              label: "Device location is blocked for this site. Enable it in browser settings and retry.",
            });
            return;
          }
          startRequest();
        })
        .catch(() => startRequest());
      return;
    }

    startRequest();
  }

  const headlineRefreshSec = Math.max(15, Number(settings.headlineRefreshSec) || 60);
  const resultsRefreshSec = Math.max(10, Number(settings.resultsRefreshSec) || 30);
  const headlineRotationSec = Math.max(2, Number(settings.headlineRotationSec) || 4.5);
  const videoRefreshSec = Math.max(30, Number(settings.videoRefreshSec) || 90);
  const radioRefreshSec = Math.max(60, Number(settings.radioRefreshSec) || 180);
  const weatherRefreshSec = Math.max(60, Number(settings.weatherRefreshSec) || 300);
  const radarRefreshSec = Math.max(60, Number(settings.radarRefreshSec) || 180);
  const radioRotationSec = Math.max(10, Number(settings.radioRotationSec) || 45);

  const clearReadOnlyHighlights = () => {
    const fragments = readOnlyFragmentsRef.current || [];
    fragments.forEach((node) => {
      if (node?.classList) {
        node.classList.remove("is-reading");
      }
    });
    readOnlyActiveFragmentRef.current = -1;
  };

  const resetReadOnlyFragments = () => {
    clearReadOnlyHighlights();
    readOnlyFragmentsRef.current = [];
    readOnlyFragmentOffsetsRef.current = [];
  };

  const prepareReadOnlySpeechContent = () => {
    const root = readOnlyContentRef.current;
    if (!root) {
      return (readOnlyText || "").trim();
    }
    if (root.dataset.readPrepared === "1") {
      const existing = (readOnlyFragmentsRef.current || [])
        .map((node) => (node?.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" ")
        .trim();
      return existing || (readOnlyText || "").trim();
    }

    resetReadOnlyFragments();

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, noscript")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }

    const fragments = [];
    const texts = [];

    nodes.forEach((node) => {
      const raw = node.nodeValue || "";
      if (!raw.trim()) return;
      const span = document.createElement("span");
      span.className = "read-only-fragment";
      span.textContent = raw;
      if (node.parentNode) {
        node.parentNode.replaceChild(span, node);
        fragments.push(span);
        const normalized = raw.replace(/\s+/g, " ").trim();
        if (normalized) {
          texts.push(normalized);
        }
      }
    });

    readOnlyFragmentsRef.current = fragments;
    const offsets = [];
    let cursor = 0;
    texts.forEach((text) => {
      offsets.push(cursor);
      cursor += text.length + 1;
    });
    readOnlyFragmentOffsetsRef.current = offsets;
    root.dataset.readPrepared = "1";

    return texts.join(" ").trim();
  };

  const findReadOnlyFragmentIndexByChar = (charIndex) => {
    const offsets = readOnlyFragmentOffsetsRef.current || [];
    if (!offsets.length) return -1;
    if (charIndex <= 0) return 0;
    let low = 0;
    let high = offsets.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (offsets[mid] === charIndex) {
        return mid;
      }
      if (offsets[mid] < charIndex) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return Math.max(0, low - 1);
  };

  const highlightReadOnlyFragment = (index, { follow = true } = {}) => {
    const fragments = readOnlyFragmentsRef.current || [];
    if (index < 0 || index >= fragments.length) return;
    const previous = readOnlyActiveFragmentRef.current;
    if (previous === index) return;

    if (previous >= 0 && fragments[previous]?.classList) {
      fragments[previous].classList.remove("is-reading");
    }

    const target = fragments[index];
    if (!target?.classList) return;
    target.classList.add("is-reading");
    readOnlyActiveFragmentRef.current = index;

    if (!follow) return;
    const now = Date.now();
    if (now - readOnlyFollowTsRef.current < 120) return;
    readOnlyFollowTsRef.current = now;

    const root = readOnlyContentRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const outside =
      targetRect.top < rootRect.top + 20 ||
      targetRect.bottom > rootRect.bottom - 20;
    if (outside) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  const stopReadOnlyReading = (messageText = "Idle.") => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    readOnlyUtteranceRef.current = null;
    clearReadOnlyHighlights();
    setReadOnlySpeaking(false);
    setReadOnlyPaused(false);
    if (typeof messageText === "string") {
      setReadOnlyStatus(messageText);
    }
  };

  const startReadOnlyReading = () => {
    if (!settings.readAloudEnabled) {
      setReadOnlyStatus("Read aloud is disabled. Enable it from App menu > Read.");
      return;
    }
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setReadOnlyStatus("Read aloud is not supported in this browser.");
      return;
    }
    const preparedText = prepareReadOnlySpeechContent();
    const speechText = (preparedText || readOnlyText || "").replace(/\s+/g, " ").trim();
    if (!speechText) {
      setReadOnlyStatus("No readable text found.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    const rateValue = Number(settings.readAloudRate);
    utterance.rate = !Number.isNaN(rateValue) && rateValue > 0 ? rateValue : 1;
    if (settings.readAloudVoice) {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(
        (voice) =>
          voice.name === settings.readAloudVoice ||
          voice.voiceURI === settings.readAloudVoice
      );
      if (match) {
        utterance.voice = match;
      }
    }

    utterance.onstart = () => {
      setReadOnlySpeaking(true);
      setReadOnlyPaused(false);
      setReadOnlyStatus("Reading...");
      highlightReadOnlyFragment(0, { follow: true });
    };
    utterance.onboundary = (event) => {
      if (!event || typeof event.charIndex !== "number") return;
      const index = findReadOnlyFragmentIndexByChar(event.charIndex);
      highlightReadOnlyFragment(index, { follow: true });
    };
    utterance.onend = () => {
      stopReadOnlyReading("Idle.");
    };
    utterance.onerror = () => {
      stopReadOnlyReading("Unable to read this article.");
    };

    readOnlyUtteranceRef.current = utterance;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const pauseReadOnlyReading = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    if (synth.speaking && !synth.paused) {
      synth.pause();
      setReadOnlyPaused(true);
      setReadOnlyStatus("Paused.");
    }
  };

  const resumeReadOnlyReading = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    if (synth.paused) {
      synth.resume();
      setReadOnlyPaused(false);
      setReadOnlyStatus("Reading...");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
    const synth = window.speechSynthesis;
    let cancelled = false;
    let previousHandler = null;

    const loadVoices = () => {
      if (cancelled) return;
      const voices = synth.getVoices ? synth.getVoices() : [];
      const deduped = [];
      const seen = new Set();
      voices.forEach((voice) => {
        const key = `${voice.voiceURI || ""}|${voice.name || ""}|${voice.lang || ""}`;
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(voice);
      });
      setAvailableVoices(deduped);
    };

    loadVoices();
    const retryId = window.setTimeout(loadVoices, 250);

    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", loadVoices);
    } else {
      previousHandler = synth.onvoiceschanged;
      synth.onvoiceschanged = () => {
        if (typeof previousHandler === "function") {
          previousHandler();
        }
        loadVoices();
      };
    }

    return () => {
      cancelled = true;
      window.clearTimeout(retryId);
      if (typeof synth.removeEventListener === "function") {
        synth.removeEventListener("voiceschanged", loadVoices);
      } else if (previousHandler !== null) {
        synth.onvoiceschanged = previousHandler;
      }
    };
  }, []);

  useEffect(() => {
    if (!readOnlyOpen || !readOnlyHtml) return;
    const speechText = prepareReadOnlySpeechContent();
    if (speechText) {
      setReadOnlyText(speechText);
    }
  }, [readOnlyOpen, readOnlyHtml]);

  useEffect(() => {
    if (!readOnlyOpen) return;
    if (readOnlyLoading || readOnlySpeaking || readOnlyPaused || readOnlyError) return;
    if (!readOnlyStatus) {
      setReadOnlyStatus("Idle.");
    }
  }, [
    readOnlyOpen,
    readOnlyLoading,
    readOnlySpeaking,
    readOnlyPaused,
    readOnlyError,
    readOnlyStatus,
  ]);

  useEffect(() => {
    if (message) {
      setMessageOpen(true);
    }
  }, [message]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const syncFullscreen = () => {
      const current = getRadarFullscreenElement();
      setRadarFullscreen(Boolean(current && current === radarFrameRef.current));
    };
    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(max-width: 980px)");
    const handler = (event) => {
      setIsNarrowLayout(event.matches);
    };
    setIsNarrowLayout(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    setFiltersExpanded(!isNarrowLayout);
  }, [isNarrowLayout]);

  useEffect(() => {
    setVideoFiltersExpanded(!isNarrowLayout);
  }, [isNarrowLayout]);

  useEffect(() => {
    setRadioFiltersExpanded(!isNarrowLayout);
  }, [isNarrowLayout]);

  useEffect(() => {
    setWeatherFiltersExpanded(!isNarrowLayout);
  }, [isNarrowLayout]);

  const dismissMessage = () => {
    setMessageOpen(false);
    setMessage("");
  };

  async function checkBackendHealth({ notify } = {}) {
    const normalized = normalizeBackendUrl(backendUrlDraft || getBackendUrl());
    if (!normalized) {
      setBackendHealth({ state: "error", label: "No URL" });
      setBackendConnection({ state: "error", label: "No URL" });
      if (notify) {
        setMessage("Enter a valid backend URL before testing.");
      }
      return;
    }
    setBackendHealth({ state: "checking", label: "Checking..." });
    try {
      const res = await fetch(`${normalized}/service/health`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setBackendHealth({ state: "error", label: `HTTP ${res.status}` });
        setBackendConnection({ state: "error", label: "Offline" });
        if (notify) {
          setMessage("Backend responded but status was unexpected.");
        }
        return;
      }
      const data = await res.json();
      if (data?.status === "ok") {
        setBackendHealth({ state: "ok", label: "Online" });
        await checkBackendConnection({ notify: false });
        if (notify) {
          setMessage(`Backend reachable (${normalized}).`);
        }
      } else {
        setBackendHealth({ state: "warn", label: "Unknown" });
        setBackendConnection({ state: "warn", label: "Unknown" });
        if (notify) {
          setMessage("Backend responded but status was unexpected.");
        }
      }
    } catch (err) {
      setBackendHealth({ state: "error", label: "Offline" });
      setBackendConnection({ state: "error", label: "Offline" });
      if (notify) {
        setMessage(`Backend test failed: ${err.message || err}`);
      }
    }
  }

  async function checkBackendConnection({ notify } = {}) {
    const normalized = normalizeBackendUrl(backendUrlDraft || getBackendUrl());
    if (!normalized) {
      setBackendConnection({ state: "error", label: "No URL" });
      return;
    }
    setBackendConnection({ state: "checking", label: "Checking..." });
    try {
      await fetchArticleCount();
      setBackendConnection({ state: "ok", label: "Connected" });
    } catch (err) {
      const raw = (err?.message || err || "").toString();
      const lower = raw.toLowerCase();
      let label = "Disconnected";
      if (lower.includes("401") || lower.includes("403")) {
        label = "Unauthorized";
      } else if (lower.includes("token")) {
        label = "Auth error";
      } else if (lower.includes("build hash")) {
        label = "Build hash";
      }
      setBackendConnection({ state: "error", label });
      if (notify) {
        setMessage(`Connection check failed: ${raw}`);
      }
    }
  }

  useEffect(() => {
    if (!settings.autoRefreshHeadlines) return undefined;
    loadHeadlines();
    const id = setInterval(() => {
      loadHeadlines();
    }, headlineRefreshSec * 1000);
    return () => clearInterval(id);
  }, [settings.autoRefreshHeadlines, headlineRefreshSec, settings.backendUrl]);

  useEffect(() => {
    if (!settings.autoRefreshResults || !lastSearch) return undefined;
    loadArticles(lastSearch, {
      provider: (filterProvider || "").trim() || undefined,
    });
    const id = setInterval(() => {
      loadArticles(lastSearch, {
        provider: (filterProvider || "").trim() || undefined,
      });
    }, resultsRefreshSec * 1000);
    return () => clearInterval(id);
  }, [
    settings.autoRefreshResults,
    lastSearch,
    resultsRefreshSec,
    filterProvider,
    settings.backendUrl,
  ]);

  useEffect(() => {
    if (!settings.autoRefreshVideos || videoHasSearched) return undefined;
    loadVideos("all", { rotateAfterLoad: true });
    const id = setInterval(() => {
      loadVideos("all", { rotateAfterLoad: true });
    }, videoRefreshSec * 1000);
    return () => clearInterval(id);
  }, [
    settings.autoRefreshVideos,
    videoHasSearched,
    videoRefreshSec,
    settings.backendUrl,
    settings.videoAutoRotate,
  ]);

  useEffect(() => {
    if (!settings.autoRefreshVideoResults || !videoHasSearched || !lastVideoSearch) {
      return undefined;
    }
    loadVideos(lastVideoSearch, buildVideoFetchOptions());
    const id = setInterval(() => {
      loadVideos(lastVideoSearch, buildVideoFetchOptions());
    }, resultsRefreshSec * 1000);
    return () => clearInterval(id);
  }, [
    settings.autoRefreshVideoResults,
    videoHasSearched,
    lastVideoSearch,
    resultsRefreshSec,
    videoFilterSource,
    videoFilterProvider,
    videoStartDate,
    videoEndDate,
    videoSortKey,
    videoSortDir,
    settings.backendUrl,
  ]);

  useEffect(() => {
    if (!settings.autoRefreshRadios || radioHasSearched) return undefined;
    loadRadios("all", { rotateAfterLoad: true });
    const id = setInterval(() => {
      loadRadios("all", { rotateAfterLoad: true });
    }, radioRefreshSec * 1000);
    return () => clearInterval(id);
  }, [
    settings.autoRefreshRadios,
    radioHasSearched,
    radioRefreshSec,
    settings.backendUrl,
    settings.radioAutoRotate,
    radioIsPlaying,
  ]);

  useEffect(() => {
    if (!settings.autoRefreshRadioResults || !radioHasSearched || !lastRadioSearch) {
      return undefined;
    }
    loadRadios(lastRadioSearch, buildRadioFetchOptions());
    const id = setInterval(() => {
      loadRadios(lastRadioSearch, buildRadioFetchOptions());
    }, resultsRefreshSec * 1000);
    return () => clearInterval(id);
  }, [
    settings.autoRefreshRadioResults,
    radioHasSearched,
    lastRadioSearch,
    resultsRefreshSec,
    radioFilterCountry,
    radioFilterLanguage,
    radioFilterTag,
    radioFilterProvider,
    radioSortKey,
    radioSortDir,
    settings.backendUrl,
  ]);

  useEffect(() => {
    if (!settings.autoRefreshWeather || weatherRetryBlocked) return undefined;
    loadWeatherData("all");
    const id = setInterval(() => {
      loadWeatherData("all");
    }, weatherRefreshSec * 1000);
    return () => clearInterval(id);
  }, [settings.autoRefreshWeather, weatherRefreshSec, settings.backendUrl, weatherRetryBlocked]);

  useEffect(() => {
    if (
      !settings.autoRefreshWeatherResults ||
      weatherRetryBlocked ||
      !weatherHasSearched ||
      !lastWeatherSearch
    ) {
      return undefined;
    }
    loadWeatherData(lastWeatherSearch, buildWeatherFetchOptions());
    const id = setInterval(() => {
      loadWeatherData(lastWeatherSearch, buildWeatherFetchOptions());
    }, resultsRefreshSec * 1000);
    return () => clearInterval(id);
  }, [
    settings.autoRefreshWeatherResults,
    weatherHasSearched,
    lastWeatherSearch,
    resultsRefreshSec,
    weatherSortKey,
    weatherSortDir,
    settings.backendUrl,
    weatherRetryBlocked,
  ]);

  useEffect(() => {
    if (activeTab !== "feel" || !settings.autoRefreshRadar) return undefined;
    const id = setInterval(() => {
      setRadarRefreshNonce((prev) => prev + 1);
    }, radarRefreshSec * 1000);
    return () => clearInterval(id);
  }, [activeTab, settings.autoRefreshRadar, radarRefreshSec]);

  const currentYear = new Date().getFullYear();
  const shareTitle = sharePayload?.title || BRAND_NAME;
  const shareUrl = sharePayload?.url || "";
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareText = encodeURIComponent(`${shareTitle} ${shareUrl}`.trim());
  const shareOptions = shareUrl
    ? [
        {
          id: "email",
          label: "Email",
          icon: "fa-solid fa-envelope",
          url: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodedShareText}`,
        },
        {
          id: "sms",
          label: "SMS",
          icon: "fa-solid fa-comment-dots",
          url: `sms:?&body=${encodedShareText}`,
        },
        {
          id: "whatsapp",
          label: "WhatsApp",
          icon: "fa-brands fa-whatsapp",
          url: `https://api.whatsapp.com/send?text=${encodedShareText}`,
        },
        {
          id: "twitter",
          label: "X (Twitter)",
          icon: "fa-brands fa-x-twitter",
          url: `https://twitter.com/intent/tweet?text=${encodedShareText}`,
        },
        {
          id: "facebook",
          label: "Facebook",
          icon: "fa-brands fa-facebook-f",
          url: `https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`,
        },
        {
          id: "linkedin",
          label: "LinkedIn",
          icon: "fa-brands fa-linkedin-in",
          url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl}`,
        },
        {
          id: "reddit",
          label: "Reddit",
          icon: "fa-brands fa-reddit-alien",
          url: `https://www.reddit.com/submit?url=${encodedShareUrl}&title=${encodeURIComponent(shareTitle)}`,
        },
      ]
    : [];
  const localFilterLabel = settings.localNewsLocation.trim();
  const localFilterActive = Boolean(localFilterLabel);
  const localOnlyMode = Boolean(settings.localNewsEnabled && localFilterActive);
  const voiceOptions = useMemo(
    () => [...availableVoices].sort((a, b) => a.name.localeCompare(b.name)),
    [availableVoices]
  );
  const backgroundColorValue = settings.backgroundColor || "#f5efe6";
  const backendHealthClass = `health-indicator ${backendHealth.state}`;
  const backendConnectionClass = `health-indicator ${backendConnection.state}`;
  const deviceWeatherClass = useMemo(() => {
    const state = deviceWeatherLocationStatus.state;
    if (state === "ready") return "health-indicator ok";
    if (state === "requesting") return "health-indicator checking";
    if (state === "idle") return "health-indicator warn";
    return "health-indicator error";
  }, [deviceWeatherLocationStatus.state]);
  const messageModal = messageOpen && message && (
    <div className="modal-overlay" onClick={dismissMessage}>
      <div
        className="modal status-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={dismissMessage}
        >
          X
        </button>
        <h2 className="modal-title">Notice</h2>
        <p className="modal-description">{message}</p>
        <div className="modal-links">
          <button type="button" onClick={dismissMessage}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  const filteredHeadlines = useMemo(() => {
    return headlineArticles.filter((item) => {
      if (
        matchesExclusions(item, settings.headlineExclusions) ||
        matchesExclusions(item, settings.searchExclusions)
      ) {
        return false;
      }
      if (localOnlyMode && !matchesLocation(item, localFilterLabel)) {
        return false;
      }
      return true;
    });
  }, [
    headlineArticles,
    settings.headlineExclusions,
    settings.searchExclusions,
    localOnlyMode,
    localFilterLabel,
  ]);
  const orderedHeadlines = useMemo(() => {
    if (!localOnlyMode) return filteredHeadlines;
    const localRows = [];
    const globalRows = [];
    filteredHeadlines.forEach((item) => {
      if (matchesLocation(item, localFilterLabel)) {
        localRows.push(item);
      } else {
        globalRows.push(item);
      }
    });
    return [...localRows, ...globalRows];
  }, [filteredHeadlines, localOnlyMode, localFilterLabel]);
  const headlineCountDisplay =
    typeof headlineTotalCount === "number" ? headlineTotalCount : orderedHeadlines.length;

  const headlineWithImages = useMemo(
    () => orderedHeadlines.filter((item) => getArticleImage(item)),
    [orderedHeadlines]
  );
  const carouselItems = useMemo(
    () => (headlineWithImages.length ? headlineWithImages : orderedHeadlines),
    [headlineWithImages, orderedHeadlines]
  );
  const activeCarousel = carouselItems[carouselIndex] || null;
  const activeImage = getArticleImage(activeCarousel);
  const activeDescription =
    activeCarousel?.description || activeCarousel?.content || "No description available.";

  useEffect(() => {
    if (!carouselItems.length) return;
    if (carouselIndex >= carouselItems.length) {
      setCarouselIndex(0);
    }
  }, [carouselIndex, carouselItems.length]);

  useEffect(() => {
    if (activeTab !== "read") {
      return undefined;
    }
    if (
      carouselItems.length < 2 ||
      carouselPaused ||
      !settings.headlineAutoRotate
    ) {
      return undefined;
    }
    const id = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % carouselItems.length);
    }, headlineRotationSec * 1000);
    return () => clearInterval(id);
  }, [
    activeTab,
    carouselItems.length,
    carouselPaused,
    settings.headlineAutoRotate,
    headlineRotationSec,
  ]);

  function goPrev() {
    if (carouselItems.length === 0) return;
    setCarouselIndex((prev) => (prev - 1 + carouselItems.length) % carouselItems.length);
  }

  function goNext() {
    if (carouselItems.length === 0) return;
    setCarouselIndex((prev) => (prev + 1) % carouselItems.length);
  }

  function pauseCarousel() {
    setCarouselPaused(true);
  }

  function resumeCarousel() {
    setCarouselPaused(false);
  }

  function handleCarouselBlur(event) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    resumeCarousel();
  }

  const sourceOptions = useMemo(
    () =>
      buildFilterOptions([
        ...sourceCatalog,
        ...headlineArticles.map((article) => article.source),
        ...articles.map((article) => article.source),
      ]),
    [sourceCatalog, headlineArticles, articles]
  );
  const providerOptions = useMemo(
    () =>
      buildFilterOptions([
        ...CORE_PROVIDER_OPTIONS,
        ...providerCatalog,
        ...headlineArticles.map((article) => article.provider),
        ...articles.map((article) => article.provider),
      ], normalizeProviderLabel),
    [providerCatalog, headlineArticles, articles]
  );
  const sourceFilterOptions = useMemo(() => {
    if (
      filterSource &&
      !sourceOptions.some(
        (option) => normalize(option) === normalize(filterSource)
      )
    ) {
      return [filterSource, ...sourceOptions];
    }
    return sourceOptions;
  }, [filterSource, sourceOptions]);
  const providerFilterOptions = useMemo(() => {
    if (
      filterProvider &&
      !providerOptions.some(
        (option) => normalize(option) === normalize(filterProvider)
      )
    ) {
      return [filterProvider, ...providerOptions];
    }
    return providerOptions;
  }, [filterProvider, providerOptions]);

  const searchExclusionsActive = useMemo(
    () => parseList(settings.searchExclusions).length > 0,
    [settings.searchExclusions]
  );
  const filterActive = useMemo(
    () =>
      filterSource.trim() ||
      filterProvider.trim() ||
      searchExclusionsActive ||
      localOnlyMode,
    [filterSource, filterProvider, searchExclusionsActive, localOnlyMode]
  );
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const sourceMatch = filterSource
        ? normalize(article.source).includes(normalize(filterSource))
        : true;
      const providerMatch = filterProvider
        ? normalize(article.provider).includes(normalize(filterProvider))
        : true;
      const exclusionMatch = matchesExclusions(article, settings.searchExclusions);
      const locationMatch = localOnlyMode
        ? matchesLocation(article, localFilterLabel)
        : true;
      return sourceMatch && providerMatch && !exclusionMatch && locationMatch;
    });
  }, [
    articles,
    filterSource,
    filterProvider,
    settings.searchExclusions,
    localOnlyMode,
    localFilterLabel,
  ]);

  const sortedArticles = useMemo(() => {
    return [...filteredArticles].sort((a, b) => {
      if (localOnlyMode) {
        const aLocal = matchesLocation(a, localFilterLabel) ? 1 : 0;
        const bLocal = matchesLocation(b, localFilterLabel) ? 1 : 0;
        if (aLocal !== bLocal) {
          return bLocal - aLocal;
        }
      }
      let base = 0;
      if (sortKey === "publishedAt") {
        base = getPublishedValue(a) - getPublishedValue(b);
      } else if (sortKey === "title") {
        base = normalize(a.title).localeCompare(normalize(b.title));
      } else if (sortKey === "source") {
        base = normalize(a.source).localeCompare(normalize(b.source));
      } else if (sortKey === "provider") {
        base = normalize(a.provider).localeCompare(normalize(b.provider));
      }
      return sortDir === "asc" ? base : -base;
    });
  }, [filteredArticles, sortKey, sortDir, localOnlyMode, localFilterLabel]);

  const videoSourceOptions = useMemo(
    () => buildFilterOptions(videos.map((video) => video.source)),
    [videos]
  );

  const videoProviderOptions = useMemo(
    () => buildFilterOptions(videos.map((video) => video.provider)),
    [videos]
  );

  const radioCountryOptions = useMemo(
    () => buildFilterOptions(radios.map((row) => row.country || row.country_code)),
    [radios]
  );

  const radioLanguageOptions = useMemo(
    () => buildFilterOptions(radios.map((row) => row.language)),
    [radios]
  );

  const radioProviderOptions = useMemo(
    () => buildFilterOptions(radios.map((row) => row.provider)),
    [radios]
  );

  const filteredVideos = useMemo(() => {
    const searchText = videoHasSearched ? normalize(videoSearch) : "";
    const startTsRaw = videoStartDate ? Date.parse(videoStartDate) : Number.NaN;
    const startTs = Number.isNaN(startTsRaw) ? null : startTsRaw;
    const endTsRaw = videoEndDate ? Date.parse(videoEndDate) : Number.NaN;
    const endTs = Number.isNaN(endTsRaw)
      ? null
      : endTsRaw + 24 * 60 * 60 * 1000 - 1;
    return videos.filter((video) => {
      const sourceMatch = videoFilterSource
        ? normalize(video.source).includes(normalize(videoFilterSource))
        : true;
      const providerMatch = videoFilterProvider
        ? normalize(video.provider).includes(normalize(videoFilterProvider))
        : true;
      const published = getVideoPublishedValue(video);
      const startMatch = startTs === null ? true : published >= startTs;
      const endMatch = endTs === null ? true : published <= endTs;
      const searchMatch = !searchText
        ? true
        : normalize(
            [
              video.title,
              video.description,
              video.source,
              video.provider,
              video.video_url,
            ]
              .filter(Boolean)
              .join(" ")
          ).includes(searchText);
      const exclusionMatch = matchesExclusions(video, settings.searchExclusions);
      const locationMatch = localOnlyMode
        ? matchesLocation(video, localFilterLabel)
        : true;
      return (
        sourceMatch &&
        providerMatch &&
        startMatch &&
        endMatch &&
        searchMatch &&
        !exclusionMatch &&
        locationMatch
      );
    });
  }, [
    videos,
    videoFilterSource,
    videoFilterProvider,
    videoStartDate,
    videoEndDate,
    videoSearch,
    videoHasSearched,
    settings.searchExclusions,
    localOnlyMode,
    localFilterLabel,
  ]);

  const sortedVideos = useMemo(() => {
    return [...filteredVideos].sort((a, b) => {
      if (localOnlyMode) {
        const aLocal = matchesLocation(a, localFilterLabel) ? 1 : 0;
        const bLocal = matchesLocation(b, localFilterLabel) ? 1 : 0;
        if (aLocal !== bLocal) {
          return bLocal - aLocal;
        }
      }
      let base = 0;
      if (videoSortKey === "published_at") {
        base = getVideoPublishedValue(a) - getVideoPublishedValue(b);
      } else if (videoSortKey === "title") {
        base = normalize(a.title).localeCompare(normalize(b.title));
      } else if (videoSortKey === "source") {
        base = normalize(a.source).localeCompare(normalize(b.source));
      } else if (videoSortKey === "provider") {
        base = normalize(a.provider).localeCompare(normalize(b.provider));
      } else if (videoSortKey === "fetched_at") {
        const aVal = Date.parse(a?.fetched_at || "");
        const bVal = Date.parse(b?.fetched_at || "");
        base = (Number.isNaN(aVal) ? 0 : aVal) - (Number.isNaN(bVal) ? 0 : bVal);
      }
      return videoSortDir === "asc" ? base : -base;
    });
  }, [filteredVideos, videoSortKey, videoSortDir, localOnlyMode, localFilterLabel]);

  const playableSortedVideos = useMemo(() => {
    return sortedVideos;
  }, [sortedVideos]);

  const filteredRadios = useMemo(() => {
    const normalizedSearch = radioHasSearched ? normalize(lastRadioSearch) : "";
    const searchText = normalizedSearch && normalizedSearch !== "all" ? normalizedSearch : "";
    return radios.filter((row) => {
      const countryValue = normalize(row.country || row.country_code);
      const languageValue = normalize(row.language);
      const providerValue = normalize(row.provider);
      const tagsValue = normalize(row.tags);
      const countryMatch = radioFilterCountry
        ? countryValue.includes(normalize(radioFilterCountry))
        : true;
      const languageMatch = radioFilterLanguage
        ? languageValue.includes(normalize(radioFilterLanguage))
        : true;
      const providerMatch = radioFilterProvider
        ? providerValue.includes(normalize(radioFilterProvider))
        : true;
      const tagMatch = radioFilterTag
        ? tagsValue.includes(normalize(radioFilterTag))
        : true;
      const searchMatch = !searchText
        ? true
        : normalize(
            [
              row.name,
              row.description,
              row.tags,
              row.country,
              row.country_code,
              row.language,
              row.provider,
              row.stream_url,
              row.homepage_url,
            ]
              .filter(Boolean)
              .join(" ")
          ).includes(searchText);
      const exclusionMatch = matchesExclusions(row, settings.searchExclusions);
      const locationMatch = localOnlyMode
        ? matchesLocation(row, localFilterLabel)
        : true;
      return (
        countryMatch &&
        languageMatch &&
        providerMatch &&
        tagMatch &&
        searchMatch &&
        !exclusionMatch &&
        locationMatch
      );
    });
  }, [
    radios,
    lastRadioSearch,
    radioFilterCountry,
    radioFilterLanguage,
    radioFilterTag,
    radioFilterProvider,
    radioHasSearched,
    settings.searchExclusions,
    localOnlyMode,
    localFilterLabel,
  ]);

  const sortedRadios = useMemo(() => {
    return [...filteredRadios].sort((a, b) => {
      if (localOnlyMode) {
        const aLocal = matchesLocation(a, localFilterLabel) ? 1 : 0;
        const bLocal = matchesLocation(b, localFilterLabel) ? 1 : 0;
        if (aLocal !== bLocal) {
          return bLocal - aLocal;
        }
      }
      let base = 0;
      if (radioSortKey === "votes") {
        base = (Number(a.votes) || 0) - (Number(b.votes) || 0);
      } else if (radioSortKey === "name") {
        base = normalize(a.name).localeCompare(normalize(b.name));
      } else if (radioSortKey === "country") {
        base = normalize(a.country).localeCompare(normalize(b.country));
      } else if (radioSortKey === "language") {
        base = normalize(a.language).localeCompare(normalize(b.language));
      } else if (radioSortKey === "bitrate") {
        base = (Number(a.bitrate) || 0) - (Number(b.bitrate) || 0);
      } else if (radioSortKey === "codec") {
        base = normalize(a.codec).localeCompare(normalize(b.codec));
      } else if (radioSortKey === "fetched_at") {
        const aVal = Date.parse(a?.fetched_at || "");
        const bVal = Date.parse(b?.fetched_at || "");
        base = (Number.isNaN(aVal) ? 0 : aVal) - (Number.isNaN(bVal) ? 0 : bVal);
      }
      return radioSortDir === "asc" ? base : -base;
    });
  }, [filteredRadios, radioSortKey, radioSortDir, localOnlyMode, localFilterLabel]);

  const activeVideo = playableSortedVideos[activeVideoIndex] || null;
  const sortedVideosLenRef = useRef(0);
  useEffect(() => {
    sortedVideosLenRef.current = playableSortedVideos.length;
  }, [playableSortedVideos.length]);

  const selectedRadioKey = useMemo(
    () => buildRadioKey(selectedRadio),
    [selectedRadio]
  );
  const selectedRadioFromList = useMemo(() => {
    if (!selectedRadioKey) return null;
    return (
      sortedRadios.find((row) => buildRadioKey(row) === selectedRadioKey) || null
    );
  }, [sortedRadios, selectedRadioKey]);
  const activeRadio = selectedRadioKey
    ? selectedRadioFromList || selectedRadio || null
    : sortedRadios[activeRadioIndex] || null;
  useEffect(() => {
    if (selectedRadioKey) return;
    if (!sortedRadios.length) return;
    if (activeRadioIndex >= sortedRadios.length) {
      setActiveRadioIndex(0);
    }
  }, [activeRadioIndex, sortedRadios.length, selectedRadioKey]);

  useEffect(() => {
    if (!activeVideo) {
      setVideoPopoutOpen(false);
    }
  }, [activeVideo]);

  useEffect(() => {
    if (!activeRadio) {
      setRadioPopoutOpen(false);
    }
  }, [activeRadio]);

  useEffect(() => {
    if (activeTab !== "hear") return undefined;
    if (!settings.radioAutoRotate) return undefined;
    if (selectedRadioKey) return undefined;
    if (radioHasSearched) return undefined;
    if (radioIsPlaying) return undefined;
    if (sortedRadios.length < 2) return undefined;
    const id = setInterval(() => {
      setActiveRadioIndex((prev) => (prev + 1) % sortedRadios.length);
    }, radioRotationSec * 1000);
    return () => clearInterval(id);
  }, [
    activeTab,
    settings.radioAutoRotate,
    selectedRadioKey,
    radioHasSearched,
    radioIsPlaying,
    sortedRadios.length,
    radioRotationSec,
  ]);

  useEffect(() => {
    if (!pendingRadioAutoplayRef.current) return;
    pendingRadioAutoplayRef.current = false;
    if (!activeRadio?.stream_url) return;
    const audio = radioAudioRef.current;
    if (!audio) return;
    try {
      audio.pause?.();
      audio.load?.();
    } catch (err) {
      // ignore
    }
    try {
      const attempt = audio.play?.();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(() => {});
      }
    } catch (err) {
      // ignore
    }
  }, [activeRadio?.stream_url]);

  useEffect(() => {
    if (!radioPopoutOpen) return;
    if (!radioIsPlaying) return;
    const id = window.setTimeout(() => {
      try {
        const audio = radioAudioRef.current;
        if (!audio) return;
        const playPromise = audio.play?.();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      } catch (err) {
        // ignore
      }
    }, 180);
    return () => window.clearTimeout(id);
  }, [radioPopoutOpen, activeRadio?.stream_url, radioIsPlaying]);

  useEffect(() => {
    if (videoPopoutOpen) return;
    setVideoPopoutMinimized(false);
  }, [videoPopoutOpen]);

  useEffect(() => {
    if (radioPopoutOpen) return;
    setRadioPopoutMinimized(false);
  }, [radioPopoutOpen]);

  const filteredWeatherRows = useMemo(() => {
    const searchText = weatherHasSearched ? normalize(weatherSearch) : "";
    return weatherRows.filter((row) => {
      if (!searchText) return true;
      const haystack = normalize(
        [
          row.location_name,
          row.country_code,
          row.weather_label,
          row.source,
          row.provider,
        ]
          .filter(Boolean)
          .join(" ")
      );
      return haystack.includes(searchText);
    });
  }, [weatherRows, weatherSearch, weatherHasSearched]);

  const sortedWeatherRows = useMemo(() => {
    return [...filteredWeatherRows].sort((a, b) => {
      let base = 0;
      if (weatherSortKey === "weather_time") {
        base = getWeatherTimeValue(a) - getWeatherTimeValue(b);
      } else if (weatherSortKey === "location_name") {
        base = normalize(a.location_name).localeCompare(normalize(b.location_name));
      } else if (weatherSortKey === "temperature") {
        base = Number(a.temperature || 0) - Number(b.temperature || 0);
      } else if (weatherSortKey === "apparent_temperature") {
        base =
          Number(a.apparent_temperature || 0) -
          Number(b.apparent_temperature || 0);
      }
      return weatherSortDir === "asc" ? base : -base;
    });
  }, [filteredWeatherRows, weatherSortKey, weatherSortDir]);

  const localWeatherCandidate = useMemo(() => {
    if (!deviceWeatherLocation || !Array.isArray(weatherRows) || weatherRows.length === 0) {
      return null;
    }
    const latitude = Number(deviceWeatherLocation.latitude);
    const longitude = Number(deviceWeatherLocation.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    // Pick the latest record per location, then choose the closest.
    const latestByLocation = new Map();
    weatherRows.forEach((row) => {
      if (!row) return;
      const name = (row.location_name || "").toString().trim();
      if (!name) return;
      const ts = getWeatherTimeValue(row);
      const existing = latestByLocation.get(name);
      if (!existing || ts > existing.ts) {
        latestByLocation.set(name, { row, ts });
      }
    });

    let best = null;
    latestByLocation.forEach(({ row }) => {
      const distKm = haversineKm(latitude, longitude, row.latitude, row.longitude);
      if (!Number.isFinite(distKm)) return;
      if (!best || distKm < best.distKm) {
        best = { row, distKm };
      }
    });

    if (!best) return null;
    return {
      ...best.row,
      distance_km: Math.round(best.distKm * 10) / 10,
    };
  }, [deviceWeatherLocation, weatherRows]);

  const localWeatherPinned = useMemo(() => {
    if (!localFilterActive || !Array.isArray(weatherRows) || weatherRows.length === 0) {
      return null;
    }
    let best = null;
    weatherRows.forEach((row) => {
      if (!row || !matchesLocation(row, localFilterLabel)) return;
      const lat = Number(row.latitude);
      const lon = Number(row.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const ts = getWeatherTimeValue(row);
      if (!best || ts > best.ts) {
        best = { row, ts };
      }
    });
    return best ? best.row : null;
  }, [localFilterActive, localFilterLabel, weatherRows]);

  const radarCenter = useMemo(() => {
    const localLat = Number(localWeatherPinned?.latitude);
    const localLon = Number(localWeatherPinned?.longitude);
    if (Number.isFinite(localLat) && Number.isFinite(localLon)) {
      return { latitude: localLat, longitude: localLon };
    }
    if (deviceWeatherLocationStatus.state === "ready" && deviceWeatherLocation) {
      return {
        latitude: Number(deviceWeatherLocation.latitude),
        longitude: Number(deviceWeatherLocation.longitude),
      };
    }
    const lat = Number(localWeatherCandidate?.latitude);
    const lon = Number(localWeatherCandidate?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { latitude: lat, longitude: lon };
    }
    const fallback = weatherRows && weatherRows.length ? weatherRows[0] : null;
    const fLat = Number(fallback?.latitude);
    const fLon = Number(fallback?.longitude);
    if (Number.isFinite(fLat) && Number.isFinite(fLon)) {
      return { latitude: fLat, longitude: fLon };
    }
    return { latitude: 40.7128, longitude: -74.006 };
  }, [
    localWeatherPinned?.latitude,
    localWeatherPinned?.longitude,
    deviceWeatherLocationStatus.state,
    deviceWeatherLocation,
    localWeatherCandidate?.latitude,
    localWeatherCandidate?.longitude,
    weatherRows,
  ]);

  const radarZoomLevel = useMemo(() => {
    const z = Number(radarZoom);
    if (!Number.isFinite(z)) return 6;
    return Math.max(3, Math.min(9, Math.round(z)));
  }, [radarZoom]);

  const activeRadarFrame = useMemo(() => {
    if (!Array.isArray(radarFrames) || !radarFrames.length) return null;
    const idx = Number(radarFrameIndex);
    if (Number.isFinite(idx) && idx >= 0 && idx < radarFrames.length) {
      return radarFrames[idx];
    }
    return radarFrames[radarFrames.length - 1] || null;
  }, [radarFrames, radarFrameIndex]);

  useEffect(() => {
    if (!Array.isArray(radarFrames) || !radarFrames.length) {
      setRadarFrameIndex(-1);
      return;
    }
    setRadarFrameIndex((prev) => {
      if (Number.isFinite(prev) && prev >= 0 && prev < radarFrames.length) {
        return prev;
      }
      return radarFrames.length - 1;
    });
  }, [radarFrames]);

  useEffect(() => {
    if (activeTab !== "feel") return undefined;
    const mountNode = radarMapContainerRef.current;
    if (!mountNode || typeof window === "undefined") return undefined;

    let cancelled = false;

    const initMap = async () => {
      try {
        const maps = await loadGoogleMapsApi();
        if (cancelled) return;
        if (!maps || radarMapRef.current) return;
        if (typeof maps.Map !== "function") {
          throw new Error("Google Maps Map constructor is unavailable.");
        }
        radarMapsApiRef.current = maps;

        const startLat = Number(radarCenter?.latitude);
        const startLon = Number(radarCenter?.longitude);
        const safeLat = Number.isFinite(startLat) ? startLat : 40.7128;
        const safeLon = Number.isFinite(startLon) ? startLon : -74.006;
        const safeZoom = Math.max(
          RADAR_MIN_ZOOM,
          Math.min(RADAR_MAX_ZOOM, Number(radarZoomLevel) || RADAR_DEFAULT_ZOOM)
        );

        const map = new maps.Map(mountNode, {
          center: { lat: safeLat, lng: safeLon },
          zoom: safeZoom,
          minZoom: RADAR_MIN_ZOOM,
          maxZoom: RADAR_MAX_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          clickableIcons: false,
          keyboardShortcuts: false,
          disableDefaultUI: true,
          ...(GOOGLE_MAPS_ID ? { mapId: GOOGLE_MAPS_ID } : {}),
        });
        setRadarViewport({
          latitude: safeLat,
          longitude: safeLon,
          zoom: safeZoom,
        });

        const syncViewport = () => {
          const center = map.getCenter();
          const nextZoom = Number(map.getZoom()) || RADAR_DEFAULT_ZOOM;
          const safeRadarZoom = Math.max(
            RADAR_MIN_ZOOM,
            Math.min(RADAR_MAX_ZOOM, Math.round(nextZoom))
          );
          setRadarZoom(safeRadarZoom);
          setRadarViewport({
            latitude: Number(center?.lat?.() ?? center?.lat),
            longitude: Number(center?.lng?.() ?? center?.lng),
            zoom: safeRadarZoom,
          });
        };
        const listeners = [
          map.addListener("idle", syncViewport),
          map.addListener("zoom_changed", syncViewport),
          map.addListener("dragend", syncViewport),
        ];
        radarMapListenersRef.current = listeners;
        syncViewport();

        radarMapRef.current = map;
      } catch (err) {
        const reason = String(err?.message || err || "").trim();
        if (reason.toLowerCase().includes("api key is missing")) {
          setRadarError(
            "Radar unavailable: Google Maps API key is not configured for the frontend."
          );
        } else {
          setRadarError(`Radar unavailable: ${reason || "Map initialization failed."}`);
        }
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (radarOverlayTimeoutRef.current) {
        window.clearTimeout(radarOverlayTimeoutRef.current);
        radarOverlayTimeoutRef.current = null;
      }
      const listeners = radarMapListenersRef.current || [];
      listeners.forEach((listener) => {
        try {
          listener?.remove?.();
        } catch (err) {
          // ignore
        }
      });
      radarMapListenersRef.current = [];
      const map = radarMapRef.current;
      const overlayLayer = radarOverlayLayerRef.current;
      if (map && overlayLayer && map.overlayMapTypes) {
        try {
          const overlayCount = map.overlayMapTypes.getLength();
          for (let idx = 0; idx < overlayCount; idx += 1) {
            if (map.overlayMapTypes.getAt(idx) === overlayLayer) {
              map.overlayMapTypes.removeAt(idx);
              break;
            }
          }
        } catch (err) {
          // ignore
        }
      }
      if (map) {
        try {
          radarMapsApiRef.current?.event?.clearInstanceListeners?.(map);
        } catch (err) {
          // ignore
        }
      }
      if (mountNode) {
        mountNode.innerHTML = "";
      }
      radarMapRef.current = null;
      radarMapsApiRef.current = null;
      radarOverlayLayerRef.current = null;
      radarOverlayErrorRef.current = 0;
    };
  }, [activeTab]);

  useEffect(() => {
    const map = radarMapRef.current;
    const maps = radarMapsApiRef.current;
    if (activeTab !== "feel" || !map || !maps) return undefined;
    if (
      typeof maps.ImageMapType !== "function" ||
      typeof maps.Size !== "function" ||
      !map.overlayMapTypes ||
      typeof map.overlayMapTypes.insertAt !== "function"
    ) {
      setRadarError("Radar map provider is unavailable.");
      setRadarLoading(false);
      return undefined;
    }

    if (radarOverlayTimeoutRef.current) {
      window.clearTimeout(radarOverlayTimeoutRef.current);
      radarOverlayTimeoutRef.current = null;
    }
    radarOverlayErrorRef.current = 0;

    if (radarOverlayLayerRef.current) {
      try {
        const overlayCount = map.overlayMapTypes.getLength();
        for (let idx = 0; idx < overlayCount; idx += 1) {
          if (map.overlayMapTypes.getAt(idx) === radarOverlayLayerRef.current) {
            map.overlayMapTypes.removeAt(idx);
            break;
          }
        }
      } catch (err) {
        // ignore
      }
      radarOverlayLayerRef.current = null;
    }

    const host = activeRadarFrame?.host || "";
    const path = activeRadarFrame?.path || "";
    const template = buildRainViewerOverlayTemplate(host, path);
    if (!template) {
      if (!radarLoading) {
        setRadarError((prev) => prev || "Radar is unavailable.");
      }
      return undefined;
    }

    setRadarLoading(true);

    let finished = false;
    const settleLayer = (ok, nextError = "") => {
      if (finished) return;
      finished = true;
      if (radarOverlayTimeoutRef.current) {
        window.clearTimeout(radarOverlayTimeoutRef.current);
        radarOverlayTimeoutRef.current = null;
      }
      if (ok) {
        setRadarError("");
        setRadarUpdatedAt(formatTime());
      } else if (nextError) {
        setRadarError(nextError);
      }
      setRadarLoading(false);
    };

    const tryFrameFallback = (reason) => {
      const current = Number(radarFrameIndex);
      if (Number.isFinite(current) && current > 0) {
        settleLayer(false, reason);
        setRadarFrameIndex(current - 1);
        return;
      }
      settleLayer(false, "Radar is unavailable right now. Enable auto refresh or retry later.");
    };

    let nextLayer = null;
    try {
      nextLayer = new maps.ImageMapType({
        name: "Current Scope Radar",
        tileSize: new maps.Size(256, 256),
        minZoom: RADAR_MIN_ZOOM,
        maxZoom: RADAR_MAX_ZOOM,
        getTile: (coord, zoom, ownerDocument) => {
          const tileCount = 1 << zoom;
          const tile = ownerDocument.createElement("img");
          tile.alt = "Radar tile";
          tile.loading = "lazy";
          tile.decoding = "async";
          tile.style.width = "256px";
          tile.style.height = "256px";
          tile.style.opacity = "0.9";
          tile.style.objectFit = "cover";
          tile.referrerPolicy = "no-referrer-when-downgrade";

          if (coord.y < 0 || coord.y >= tileCount) {
            tile.src =
              "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
            return tile;
          }

          const wrappedX = ((coord.x % tileCount) + tileCount) % tileCount;
          const tileUrl = template
            .replace("{x}", String(wrappedX))
            .replace("{y}", String(coord.y))
            .replace("{z}", String(zoom));
          tile.onload = () => {
            settleLayer(true);
          };
          tile.onerror = () => {
            radarOverlayErrorRef.current += 1;
            if (radarOverlayErrorRef.current >= 6) {
              tryFrameFallback("Radar frame failed. Loading fallback frame...");
            }
          };
          tile.src = tileUrl;
          return tile;
        },
        releaseTile: (tile) => {
          try {
            tile.onload = null;
            tile.onerror = null;
          } catch (err) {
            // ignore
          }
        },
      });
    } catch (error) {
      setRadarLoading(false);
      setRadarError("Radar map provider is unavailable.");
      return undefined;
    }

    radarOverlayTimeoutRef.current = window.setTimeout(() => {
      tryFrameFallback("Radar frame timed out. Loading fallback frame...");
    }, RADAR_OVERLAY_TIMEOUT_MS);

    radarOverlayLayerRef.current = nextLayer;
    map.overlayMapTypes.insertAt(0, nextLayer);

    return () => {
      if (radarOverlayTimeoutRef.current) {
        window.clearTimeout(radarOverlayTimeoutRef.current);
        radarOverlayTimeoutRef.current = null;
      }
      try {
        const overlayCount = map.overlayMapTypes.getLength();
        for (let idx = 0; idx < overlayCount; idx += 1) {
          if (map.overlayMapTypes.getAt(idx) === nextLayer) {
            map.overlayMapTypes.removeAt(idx);
            break;
          }
        }
      } catch (err) {
        // ignore
      }
      if (radarOverlayLayerRef.current === nextLayer) {
        radarOverlayLayerRef.current = null;
      }
    };
  }, [
    activeTab,
    activeRadarFrame?.host,
    activeRadarFrame?.path,
    activeRadarFrame?.time,
    radarFrameIndex,
  ]);

  useEffect(() => {
    if (activeTab !== "feel") return;
    const map = radarMapRef.current;
    if (!map) return;
    const lat = Number(radarCenter?.latitude);
    const lon = Number(radarCenter?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    try {
      map.panTo({ lat, lng: lon });
      map.setZoom(RADAR_DEFAULT_ZOOM);
      setRadarZoom(RADAR_DEFAULT_ZOOM);
      window.setTimeout(() => {
        try {
          radarMapsApiRef.current?.event?.trigger?.(map, "resize");
        } catch (err) {
          // ignore
        }
      }, 160);
    } catch (err) {
      // ignore recenter errors
    }
  }, [activeTab, localFilterLabel]);

  const weatherGridRows = useMemo(() => {
    if (!localWeatherCandidate) return sortedWeatherRows;
    const localId = localWeatherCandidate?.id;
    if (localId !== undefined && localId !== null) {
      return sortedWeatherRows.filter((row) => row?.id !== localId);
    }
    const localKey = `${localWeatherCandidate.location_name || ""}|${localWeatherCandidate.weather_time || ""}`;
    return sortedWeatherRows.filter((row) => {
      const key = `${row?.location_name || ""}|${row?.weather_time || ""}`;
      return key !== localKey;
    });
  }, [sortedWeatherRows, localWeatherCandidate]);

  const weatherGroups = useMemo(() => {
    const map = new Map();
    (weatherGridRows || []).forEach((row) => {
      if (!row) return;
      const key = compactText(row.location_name || "");
      if (!key) return;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          location_name: row.location_name || "Unknown location",
          country_code: row.country_code || "",
          rows: [],
        };
        map.set(key, group);
      }
      group.rows.push(row);
    });
    const groups = Array.from(map.values());
    groups.forEach((group) => {
      group.rows.sort((a, b) => getWeatherTimeValue(b) - getWeatherTimeValue(a));
      group.latest = group.rows[0] || null;
    });
    const dir = weatherSortDir === "asc" ? 1 : -1;
    groups.sort((a, b) => {
      const aLatest = a.latest || {};
      const bLatest = b.latest || {};
      let base = 0;
      if (weatherSortKey === "weather_time") {
        base = getWeatherTimeValue(aLatest) - getWeatherTimeValue(bLatest);
      } else if (weatherSortKey === "location_name") {
        base = normalize(a.location_name).localeCompare(normalize(b.location_name));
      } else if (weatherSortKey === "temperature") {
        base = Number(aLatest.temperature || 0) - Number(bLatest.temperature || 0);
      } else if (weatherSortKey === "apparent_temperature") {
        base =
          Number(aLatest.apparent_temperature || 0) - Number(bLatest.apparent_temperature || 0);
      }
      if (!base) {
        base = normalize(a.location_name).localeCompare(normalize(b.location_name));
      }
      return base * dir;
    });
    return groups;
  }, [weatherGridRows, weatherSortKey, weatherSortDir]);

  const weatherSeriesByLocation = useMemo(() => {
    const map = new Map();
    (weatherRows || []).forEach((row) => {
      if (!row) return;
      const key = compactText(row.location_name || "");
      if (!key) return;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          location_name: row.location_name || "Unknown location",
          country_code: row.country_code || "",
          rows: [],
          latest: null,
        };
        map.set(key, group);
      }
      group.rows.push(row);
    });
    map.forEach((group) => {
      group.rows.sort((a, b) => getWeatherTimeValue(a) - getWeatherTimeValue(b));
      group.latest = group.rows[group.rows.length - 1] || null;
    });
    return map;
  }, [weatherRows]);

  const weatherSeriesOptions = useMemo(() => {
    return Array.from(weatherSeriesByLocation.values()).sort((a, b) =>
      normalize(a.location_name).localeCompare(normalize(b.location_name))
    );
  }, [weatherSeriesByLocation]);

  useEffect(() => {
    if (weatherChartLocation === "auto") return;
    if (!weatherSeriesByLocation.has(weatherChartLocation)) {
      setWeatherChartLocation("auto");
    }
  }, [weatherChartLocation, weatherSeriesByLocation]);

  const radarNearestSeries = useMemo(() => {
    if (!weatherSeriesOptions.length) return null;
    const centerLat = Number(radarViewport?.latitude);
    const centerLon = Number(radarViewport?.longitude);
    const fallbackLat = Number(radarCenter?.latitude);
    const fallbackLon = Number(radarCenter?.longitude);
    const latitude = Number.isFinite(centerLat) ? centerLat : fallbackLat;
    const longitude = Number.isFinite(centerLon) ? centerLon : fallbackLon;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return weatherSeriesOptions[0] || null;
    }

    let best = null;
    weatherSeriesOptions.forEach((group) => {
      const latest = group?.latest || {};
      const lat = Number(latest.latitude);
      const lon = Number(latest.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const distKm = haversineKm(latitude, longitude, lat, lon);
      if (!Number.isFinite(distKm)) return;
      if (!best || distKm < best.distKm) {
        best = {
          group,
          distKm,
        };
      }
    });
    if (!best) return weatherSeriesOptions[0] || null;
    return {
      ...best.group,
      distance_km: Math.round(best.distKm * 10) / 10,
    };
  }, [weatherSeriesOptions, radarViewport?.latitude, radarViewport?.longitude, radarCenter]);

  const weatherChartSeries = useMemo(() => {
    if (!weatherSeriesOptions.length) return null;
    if (weatherChartLocation === "auto") return radarNearestSeries;
    return weatherSeriesByLocation.get(weatherChartLocation) || radarNearestSeries;
  }, [weatherSeriesOptions, weatherChartLocation, weatherSeriesByLocation, radarNearestSeries]);

  const weatherChartPoints = useMemo(() => {
    const rows = weatherChartSeries?.rows || [];
    return rows
      .map((row) => {
        const ts = getWeatherTimeValue(row);
        return {
          row,
          ts,
          label: formatTimestamp(row.weather_time || row.fetched_at) || "--",
          temp: Number(row.temperature),
          feels: Number(row.apparent_temperature),
          humidity: Number(row.humidity),
          wind: Number(row.wind_speed),
        };
      })
      .filter((point) => Number.isFinite(point.ts))
      .sort((a, b) => a.ts - b.ts);
  }, [weatherChartSeries]);

  const weatherThermalChart = useMemo(() => {
    if (!Array.isArray(weatherChartPoints) || weatherChartPoints.length < 2) return null;
    const points = weatherChartPoints.filter(
      (point) => Number.isFinite(point.temp) || Number.isFinite(point.feels)
    );
    if (points.length < 2) return null;
    const width = 920;
    const height = 300;
    const left = 42;
    const right = 14;
    const top = 18;
    const bottom = 34;
    const startTs = points[0].ts;
    const endTs = points[points.length - 1].ts;
    const spanTs = Math.max(1, endTs - startTs);
    const valuePool = points
      .flatMap((point) => [point.temp, point.feels])
      .filter((value) => Number.isFinite(value));
    if (!valuePool.length) return null;
    let min = Math.min(...valuePool);
    let max = Math.max(...valuePool);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const spanVal = Math.max(1, max - min);
    const innerW = width - left - right;
    const innerH = height - top - bottom;
    const toX = (ts) => left + ((ts - startTs) / spanTs) * innerW;
    const toY = (value) => top + (1 - (value - min) / spanVal) * innerH;
    const buildPath = (key) => {
      const entries = points.filter((point) => Number.isFinite(point[key]));
      if (entries.length < 2) return "";
      return entries
        .map((point, index) => `${index === 0 ? "M" : "L"} ${toX(point.ts).toFixed(2)} ${toY(point[key]).toFixed(2)}`)
        .join(" ");
    };
    const tempPath = buildPath("temp");
    const feelsPath = buildPath("feels");
    if (!tempPath && !feelsPath) return null;
    const tempEntries = points.filter((point) => Number.isFinite(point.temp));
    const tempAreaPath =
      tempEntries.length >= 2
        ? `${tempEntries
            .map(
              (point, index) =>
                `${index === 0 ? "M" : "L"} ${toX(point.ts).toFixed(2)} ${toY(point.temp).toFixed(2)}`
            )
            .join(" ")} L ${toX(tempEntries[tempEntries.length - 1].ts).toFixed(2)} ${(height - bottom).toFixed(
            2
          )} L ${toX(tempEntries[0].ts).toFixed(2)} ${(height - bottom).toFixed(2)} Z`
        : "";
    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      min,
      max,
      startTs,
      endTs,
      tempPath,
      feelsPath,
      tempAreaPath,
      dots: points.map((point) => ({
        x: toX(point.ts),
        tempY: Number.isFinite(point.temp) ? toY(point.temp) : null,
        feelsY: Number.isFinite(point.feels) ? toY(point.feels) : null,
      })),
    };
  }, [weatherChartPoints]);

  const weatherAtmosChart = useMemo(() => {
    if (!Array.isArray(weatherChartPoints) || weatherChartPoints.length < 2) return null;
    const points = weatherChartPoints.filter(
      (point) => Number.isFinite(point.humidity) || Number.isFinite(point.wind)
    );
    if (points.length < 2) return null;
    const width = 920;
    const height = 280;
    const left = 44;
    const right = 16;
    const top = 16;
    const bottom = 34;
    const startTs = points[0].ts;
    const endTs = points[points.length - 1].ts;
    const spanTs = Math.max(1, endTs - startTs);
    const windValues = points
      .map((point) => point.wind)
      .filter((value) => Number.isFinite(value));
    const windMax = Math.max(5, ...(windValues.length ? windValues : [5]));
    const innerW = width - left - right;
    const innerH = height - top - bottom;
    const toX = (ts) => left + ((ts - startTs) / spanTs) * innerW;
    const toYHumidity = (humidity) => top + (1 - Math.max(0, Math.min(100, humidity)) / 100) * innerH;
    const toYWind = (wind) => top + (1 - Math.max(0, wind) / windMax) * innerH;
    const step = innerW / Math.max(1, points.length - 1);
    const barWidth = Math.max(6, Math.min(26, step * 0.55));
    const windPath = points
      .filter((point) => Number.isFinite(point.wind))
      .map((point, index) => {
        const x = toX(point.ts);
        const y = toYWind(point.wind);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      windMax,
      startTs,
      endTs,
      bars: points
        .filter((point) => Number.isFinite(point.humidity))
        .map((point) => {
          const x = toX(point.ts);
          const y = toYHumidity(point.humidity);
          return {
            x,
            y,
            width: barWidth,
            height: Math.max(2, height - bottom - y),
            value: Math.max(0, Math.min(100, point.humidity)),
          };
        }),
      windPath,
      windDots: points
        .filter((point) => Number.isFinite(point.wind))
        .map((point) => ({
          x: toX(point.ts),
          y: toYWind(point.wind),
          value: point.wind,
        })),
    };
  }, [weatherChartPoints]);

  const weatherConditionChart = useMemo(() => {
    if (!Array.isArray(weatherChartPoints) || !weatherChartPoints.length) return null;
    const counts = new Map();
    weatherChartPoints.forEach((point) => {
      const label = String(point?.row?.weather_label || "Unknown").trim() || "Unknown";
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    const entries = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    if (!total) return null;
    const colors = [
      "var(--accent)",
      "var(--accent-strong)",
      "var(--accent-warm)",
      "#38bdf8",
      "#f59e0b",
      "#a855f7",
    ];
    let cursor = 0;
    const slices = entries.map(([label, value], index) => {
      const angle = (value / total) * 360;
      const start = cursor;
      const end = cursor + angle;
      cursor = end;
      return {
        label,
        value,
        percent: Math.round((value / total) * 1000) / 10,
        color: colors[index % colors.length],
        path: describeDonutSegment(130, 130, 108, 64, start, end),
      };
    });
    return {
      total,
      slices,
      centerLabel: weatherChartSeries?.location_name || "Weather mix",
    };
  }, [weatherChartPoints, weatherChartSeries?.location_name]);

  const weatherChartStats = useMemo(() => {
    if (!Array.isArray(weatherChartPoints) || !weatherChartPoints.length) return null;
    const temps = weatherChartPoints.map((point) => point.temp).filter((value) => Number.isFinite(value));
    const feels = weatherChartPoints.map((point) => point.feels).filter((value) => Number.isFinite(value));
    const humidity = weatherChartPoints
      .map((point) => point.humidity)
      .filter((value) => Number.isFinite(value));
    const wind = weatherChartPoints.map((point) => point.wind).filter((value) => Number.isFinite(value));
    const avg = (values) =>
      values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;
    return {
      points: weatherChartPoints.length,
      minTemp: temps.length ? Math.min(...temps) : null,
      maxTemp: temps.length ? Math.max(...temps) : null,
      avgTemp: avg(temps),
      avgFeels: avg(feels),
      avgHumidity: avg(humidity),
      peakWind: wind.length ? Math.max(...wind) : null,
    };
  }, [weatherChartPoints]);

  const weatherLatestStats = useMemo(() => {
    if (!weatherChartPoints.length) return null;
    const latestPoint = weatherChartPoints[weatherChartPoints.length - 1];
    if (!latestPoint) return null;
    const heatIndex = computeHeatIndexF(latestPoint.temp, latestPoint.humidity);
    const windChill = computeWindChillF(latestPoint.temp, latestPoint.wind);
    const comfort = computeComfortScore(
      latestPoint.temp,
      latestPoint.humidity,
      latestPoint.wind,
      latestPoint.feels
    );
    return {
      observedAt: latestPoint.ts ? formatTimestamp(new Date(latestPoint.ts)) : "--",
      temp: Number.isFinite(latestPoint.temp) ? latestPoint.temp : null,
      feels: Number.isFinite(latestPoint.feels) ? latestPoint.feels : null,
      humidity: Number.isFinite(latestPoint.humidity) ? latestPoint.humidity : null,
      wind: Number.isFinite(latestPoint.wind) ? latestPoint.wind : null,
      heatIndex: Number.isFinite(heatIndex) ? heatIndex : null,
      windChill: Number.isFinite(windChill) ? windChill : null,
      comfort,
      condition: String(latestPoint.row?.weather_label || latestPoint.row?.source || "Unknown"),
    };
  }, [weatherChartPoints]);

  const weatherTrendSeries = useMemo(() => {
    const group = weatherTrendGroup;
    if (!group || !Array.isArray(group.rows)) return [];
    return (group.rows || [])
      .map((row) => ({
        ts: getWeatherTimeValue(row),
        temp: Number(row?.temperature),
        feels: Number(row?.apparent_temperature),
        humidity: Number(row?.humidity),
        wind: Number(row?.wind_speed),
        row,
      }))
      .filter((point) => point.ts && Number.isFinite(point.temp))
      .sort((a, b) => a.ts - b.ts);
  }, [weatherTrendGroup]);

  useEffect(() => {
    if (!weatherTrendOpen || !weatherTrendSeries.length) {
      setWeatherTrendPointTs(null);
      return;
    }
    const hasCurrent = weatherTrendSeries.some((point) => point.ts === weatherTrendPointTs);
    if (!hasCurrent) {
      setWeatherTrendPointTs(weatherTrendSeries[weatherTrendSeries.length - 1].ts);
    }
  }, [weatherTrendOpen, weatherTrendSeries, weatherTrendPointTs]);

  const weatherTrendFocusedPoint = useMemo(() => {
    if (!weatherTrendSeries.length) return null;
    if (weatherTrendPointTs === null || weatherTrendPointTs === undefined) {
      return weatherTrendSeries[weatherTrendSeries.length - 1] || null;
    }
    return (
      weatherTrendSeries.find((point) => point.ts === weatherTrendPointTs) ||
      weatherTrendSeries[weatherTrendSeries.length - 1] ||
      null
    );
  }, [weatherTrendSeries, weatherTrendPointTs]);

  const weatherTrendRange = useMemo(() => {
    if (!weatherTrendSeries.length) return null;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    weatherTrendSeries.forEach((point) => {
      min = Math.min(min, point.temp);
      max = Math.max(max, point.temp);
    });
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (min === max) {
      min -= 1;
      max += 1;
    }
    return {
      min,
      max,
      startTs: weatherTrendSeries[0].ts,
      endTs: weatherTrendSeries[weatherTrendSeries.length - 1].ts,
    };
  }, [weatherTrendSeries]);

  const weatherTrendChart = useMemo(() => {
    if (!weatherTrendRange || weatherTrendSeries.length < 2) {
      return { path: "", width: 720, height: 220, pad: 26, points: [] };
    }
    const width = 720;
    const height = 220;
    const pad = 26;
    const { min, max, startTs, endTs } = weatherTrendRange;
    const spanTs = Math.max(1, endTs - startTs);
    const spanTemp = Math.max(1, max - min);
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    const points = weatherTrendSeries.map((point) => {
      const x = pad + ((point.ts - startTs) / spanTs) * innerW;
      const y = pad + (1 - (point.temp - min) / spanTemp) * innerH;
      return {
        ...point,
        x,
        y,
      };
    });
    const path = points
      .map((point, idx) => {
        const x = pad + ((point.ts - startTs) / spanTs) * innerW;
        const y = pad + (1 - (point.temp - min) / spanTemp) * innerH;
        return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { path, width, height, pad, points };
  }, [weatherTrendRange, weatherTrendSeries]);

  const weatherTrendPeakWind = useMemo(() => {
    const values = weatherTrendSeries
      .map((point) => point.wind)
      .filter((value) => Number.isFinite(value));
    if (!values.length) return null;
    return Math.max(...values);
  }, [weatherTrendSeries]);

  useEffect(() => {
    if (!playableSortedVideos.length) return;
    if (activeVideoIndex >= playableSortedVideos.length) {
      setActiveVideoIndex(0);
    }
  }, [activeVideoIndex, playableSortedVideos.length]);

  useEffect(() => {
    setVideoInfoOpen(false);
  }, [activeVideoIndex]);

  function goPrevVideo() {
    const len = sortedVideosLenRef.current || 0;
    if (len <= 0) return;
    setActiveVideoIndex((prev) => (prev - 1 + len) % len);
  }

  function goNextVideo() {
    const len = sortedVideosLenRef.current || 0;
    if (len <= 0) return;
    setActiveVideoIndex((prev) => (prev + 1) % len);
  }

  function toggleVideoPopout(forceOpen) {
    const next = typeof forceOpen === "boolean" ? forceOpen : !videoPopoutOpen;
    setVideoPopoutOpen(next);
    if (!next) {
      setVideoPopoutMinimized(false);
    }
    if (next) {
      setVideoPopoutMinimized(false);
      setRadioPopoutOpen(false);
      setRadioPopoutMinimized(false);
    }
    if (next) {
      setVideoInfoOpen(false);
    }
  }

  function toggleRadioPopout(forceOpen) {
    const next = typeof forceOpen === "boolean" ? forceOpen : !radioPopoutOpen;
    const shouldResume = radioIsPlaying;
    setRadioPopoutOpen(next);
    if (!next) {
      setRadioPopoutMinimized(false);
    }
    if (next) {
      setRadioPopoutMinimized(false);
      setVideoPopoutOpen(false);
      setVideoPopoutMinimized(false);
    }
    if (!shouldResume) return;
    window.setTimeout(() => {
      try {
        const audio = radioAudioRef.current;
        if (!audio) return;
        const playPromise = audio.play?.();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      } catch (err) {
        // ignore
      }
    }, 170);
  }

  function toggleVideoPopoutMinimized(forceMinimized) {
    setVideoPopoutMinimized((prev) =>
      typeof forceMinimized === "boolean" ? forceMinimized : !prev
    );
  }

  function toggleRadioPopoutMinimized(forceMinimized) {
    setRadioPopoutMinimized((prev) =>
      typeof forceMinimized === "boolean" ? forceMinimized : !prev
    );
  }

  const mediaPlayerCardRef = useRef(null);
  const radioPlayerCardRef = useRef(null);
  const RADAR_MIN_ZOOM = 3;
  const RADAR_MAX_ZOOM = 9;
  const RADAR_DEFAULT_ZOOM = 6;
  const RADAR_OVERLAY_TIMEOUT_MS = 7000;

  function bumpRadarZoom(delta) {
    const map = radarMapRef.current;
    if (!map) return;
    const change = Number(delta) || 0;
    if (!change) return;
    const current = Number(map.getZoom()) || RADAR_DEFAULT_ZOOM;
    const next = Math.max(RADAR_MIN_ZOOM, Math.min(RADAR_MAX_ZOOM, current + change));
    map.setZoom(next);
  }

  function resetRadarView() {
    const lat = Number(radarCenter?.latitude);
    const lon = Number(radarCenter?.longitude);
    const map = radarMapRef.current;
    if (map && Number.isFinite(lat) && Number.isFinite(lon)) {
      map.panTo({ lat, lng: lon });
      map.setZoom(RADAR_DEFAULT_ZOOM);
      setRadarZoom(RADAR_DEFAULT_ZOOM);
      setRadarError("");
    }
  }

  function getRadarFullscreenElement() {
    if (typeof document === "undefined") return null;
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  async function toggleRadarFullscreen() {
    if (typeof document === "undefined") return;
    const node = radarFrameRef.current;
    if (!node) return;
    const current = getRadarFullscreenElement();
    try {
      if (current === node) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
        return;
      }
      if (node.requestFullscreen) {
        await node.requestFullscreen();
      } else if (node.webkitRequestFullscreen) {
        node.webkitRequestFullscreen();
      }
      window.setTimeout(() => {
        try {
          const map = radarMapRef.current;
          if (!map) return;
          radarMapsApiRef.current?.event?.trigger?.(map, "resize");
          const center = map.getCenter?.();
          if (center) {
            map.panTo(center);
          }
        } catch (error) {
          // ignore
        }
      }, 140);
    } catch (err) {
      setMessage("Unable to toggle radar fullscreen.");
    }
  }

  function selectVideo(index) {
    const nextIndex = Number(index);
    if (!Number.isFinite(nextIndex)) return;
    const maxIndex = Math.max(0, playableSortedVideos.length - 1);
    const safeIndex = Math.max(0, Math.min(nextIndex, maxIndex));
    setActiveVideoIndex(safeIndex);
    setVideoInfoOpen(false);
    window.setTimeout(() => {
      try {
        mediaPlayerCardRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      } catch (err) {
        // ignore
      }
    }, 40);
  }

  function selectRadio(index, { autoPlay = false } = {}) {
    const nextIndex = Number(index);
    if (!Number.isFinite(nextIndex)) return;
    const row = sortedRadios[nextIndex];
    if (!row) return;
    pendingRadioAutoplayRef.current = Boolean(autoPlay);
    setSelectedRadio(row);
    writeLastRadioStation(row);
    setActiveRadioIndex(Math.max(0, nextIndex));
    window.setTimeout(() => {
      try {
        radioPlayerCardRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      } catch (err) {
        // ignore
      }
    }, 40);
  }

  const settingsSections = [
    {
      id: "appearance",
      label: "Appearance",
      menuLabel: "Style",
      icon: "fa-palette",
      summary: "Theme, background, and layout controls for the dashboard.",
      content: (
        <div className="settings-grid">
          <div className="settings-card">
            <h3>Theme &amp; layout</h3>
            <div className="settings-field">
              <label>Theme preset</label>
              <div className="preset-row">
                <select
                  value={settings.themePreset}
                  onChange={(e) => applyThemePreset(e.target.value)}
                >
                  {THEME_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <div className="preset-preview">
                  <span className="preset-preview-label">Preview</span>
                  <span
                    className="preset-preview-swatch"
                    style={presetPreviewStyle}
                  ></span>
                </div>
              </div>
              <p className="muted small">
                Pick a palette or switch to Custom to fine-tune colors.
              </p>
            </div>
            <div className="settings-field">
              <label>Theme</label>
              <div className="segmented">
                <button
                  type="button"
                  className={settings.theme === "light" ? "active" : ""}
                  onClick={() => applyThemeMode("light")}
                >
                  Light
                </button>
                <button
                  type="button"
                  className={settings.theme === "dark" ? "active" : ""}
                  onClick={() => applyThemeMode("dark")}
                >
                  Dark
                </button>
              </div>
            </div>
            <div className="settings-field">
              <label>Background color</label>
              <div className="color-field">
                <input
                  type="color"
                  value={backgroundColorValue}
                  onChange={(e) =>
                    updateSetting("backgroundColor", e.target.value)
                  }
                />
                <input
                  type="text"
                  value={settings.backgroundColor}
                  placeholder="#f5efe6"
                  onChange={(e) =>
                    updateSetting("backgroundColor", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="settings-field">
              <label>Background image URL</label>
              <input
                type="url"
                value={settings.backgroundImage}
                placeholder="https://example.com/background.jpg"
                onChange={(e) =>
                  updateSetting("backgroundImage", e.target.value)
                }
              />
            </div>
            <div className="settings-field">
              <label>Overlay opacity</label>
              <div className="range-field">
                <input
                  type="range"
                  min="0"
                  max="0.6"
                  step="0.02"
                  value={settings.overlayOpacity}
                  onChange={(e) =>
                    updateSetting("overlayOpacity", Number(e.target.value))
                  }
                />
                <span className="range-value">
                  {Math.round(settings.overlayOpacity * 100)}%
                </span>
              </div>
              <p className="muted small">
                Controls the tinted overlay for the selected theme.
              </p>
            </div>
            <div className="settings-field">
              <label>Layout width</label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.wideLayout}
                  onChange={(e) =>
                    updateSetting("wideLayout", e.target.checked)
                  }
                />
                <span className="toggle-track"></span>
                <span>Use wide layout (fuller screen)</span>
              </label>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "headlines_media",
      label: "Headlines & Media",
      menuLabel: "Headlines & Media",
      icon: "fa-photo-film",
      summary: "Headlines plus featured refresh/rotation controls for Watch, Listen, and Feel.",
      content: (
        <div className="settings-grid">
          <div className="settings-card">
            <h3>Headlines</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoRefreshHeadlines}
                onChange={(e) =>
                  updateSetting("autoRefreshHeadlines", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto refresh</span>
            </label>
            <div className="settings-field">
              <label>Refresh interval (seconds)</label>
              <input
                type="number"
                min="15"
                step="5"
                value={settings.headlineRefreshSec}
                onChange={(e) =>
                  updateSetting("headlineRefreshSec", e.target.value)
                }
              />
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.headlineAutoRotate}
                onChange={(e) =>
                  updateSetting("headlineAutoRotate", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto rotate</span>
            </label>
            <div className="settings-field">
              <label>Rotation speed (seconds)</label>
              <input
                type="number"
                min="2"
                step="0.5"
                value={settings.headlineRotationSec}
                onChange={(e) =>
                  updateSetting("headlineRotationSec", e.target.value)
                }
              />
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.showHeadlinesHeader}
                onChange={(e) =>
                  updateSetting("showHeadlinesHeader", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Show headlines header</span>
            </label>
            <div className="settings-field">
              <label>Headline exclusions</label>
              <textarea
                value={settings.headlineExclusions}
                placeholder="Comma or new line separated keywords"
                onChange={(e) =>
                  updateSetting("headlineExclusions", e.target.value)
                }
              />
            </div>
          </div>

          <div className="settings-card">
            <h3>Watch (Videos)</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.showVideoHeader}
                onChange={(e) =>
                  updateSetting("showVideoHeader", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Show featured header</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoRefreshVideos}
                onChange={(e) =>
                  updateSetting("autoRefreshVideos", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto refresh featured videos</span>
            </label>
            <div className="settings-field">
              <label>Featured refresh interval (seconds)</label>
              <input
                type="number"
                min="30"
                step="15"
                value={settings.videoRefreshSec}
                onChange={(e) =>
                  updateSetting("videoRefreshSec", e.target.value)
                }
              />
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.videoAutoRotate}
                onChange={(e) =>
                  updateSetting("videoAutoRotate", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto advance videos</span>
            </label>
            <p className="muted small">
              Featured auto refresh pauses once you run a video search.
            </p>
          </div>

          <div className="settings-card">
            <h3>Players</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.rememberPopoutState}
                onChange={(e) => updateRememberPopoutState(e.target.checked)}
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Remember pop-out players on reload</span>
            </label>
            <p className="muted small">
              Keeps Watch and Listen in pop-out mode after refresh when enabled.
            </p>
          </div>

          <div className="settings-card">
            <h3>Listen (Radio)</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.showRadioHeader}
                onChange={(e) =>
                  updateSetting("showRadioHeader", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Show featured header</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoRefreshRadios}
                onChange={(e) =>
                  updateSetting("autoRefreshRadios", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto refresh featured stations</span>
            </label>
            <div className="settings-field">
              <label>Featured refresh interval (seconds)</label>
              <input
                type="number"
                min="60"
                step="30"
                value={settings.radioRefreshSec}
                onChange={(e) =>
                  updateSetting("radioRefreshSec", e.target.value)
                }
              />
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.radioAutoRotate}
                onChange={(e) =>
                  updateSetting("radioAutoRotate", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto rotate station selection</span>
            </label>
            <div className="settings-field">
              <label>Rotation speed (seconds)</label>
              <input
                type="number"
                min="10"
                step="5"
                value={settings.radioRotationSec}
                onChange={(e) =>
                  updateSetting("radioRotationSec", e.target.value)
                }
              />
            </div>
            <p className="muted small">
              Rotation pauses while audio is playing or once you run a station search.
            </p>
          </div>

          <div className="settings-card">
            <h3>Feel (Weather)</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.showWeatherHeader}
                onChange={(e) =>
                  updateSetting("showWeatherHeader", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Show device location header</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoRefreshWeather}
                onChange={(e) =>
                  updateSetting("autoRefreshWeather", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto refresh weather feed</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoRefreshRadar}
                onChange={(e) =>
                  updateSetting("autoRefreshRadar", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto refresh radar frame</span>
            </label>
            <div className="settings-field">
              <label>Weather refresh interval (seconds)</label>
              <input
                type="number"
                min="60"
                step="30"
                value={settings.weatherRefreshSec}
                onChange={(e) =>
                  updateSetting("weatherRefreshSec", e.target.value)
                }
              />
            </div>
            <div className="settings-field">
              <label>Radar refresh interval (seconds)</label>
              <input
                type="number"
                min="60"
                step="30"
                value={settings.radarRefreshSec}
                onChange={(e) =>
                  updateSetting("radarRefreshSec", e.target.value)
                }
              />
            </div>
            <p className="muted small">
              Weather and radar refresh run in the background and preserve your current map zoom and position.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "search",
      label: "Search & Local",
      menuLabel: "Search",
      icon: "fa-magnifying-glass",
      summary: "Auto refresh plus exclusions and local filters (applies to Read, Watch, and Listen).",
      content: (
        <div className="settings-grid">
          <div className="settings-card">
            <h3>Search automation</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoRefreshResults}
                onChange={(e) =>
                  updateSetting("autoRefreshResults", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto refresh search results</span>
            </label>
            <div className="settings-field">
              <label>Search refresh interval (seconds)</label>
              <input
                type="number"
                min="10"
                step="5"
                value={settings.resultsRefreshSec}
                onChange={(e) =>
                  updateSetting("resultsRefreshSec", e.target.value)
                }
              />
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoRefreshVideoResults}
                onChange={(e) =>
                  updateSetting("autoRefreshVideoResults", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto refresh video results</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoRefreshRadioResults}
                onChange={(e) =>
                  updateSetting("autoRefreshRadioResults", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto refresh radio results</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoRefreshWeatherResults}
                onChange={(e) =>
                  updateSetting("autoRefreshWeatherResults", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto refresh weather results</span>
            </label>
            <p className="muted small">
              Result refresh uses your last search in each tab once you run one.
            </p>
            <p className="muted small">
              Search exclusions apply to Read, Watch, and Listen. Feel ignores these content
              filters.
            </p>
            <div className="settings-field">
              <label>Search exclusions</label>
              <textarea
                value={settings.searchExclusions}
                placeholder="Comma or new line separated keywords"
                onChange={(e) =>
                  updateSetting("searchExclusions", e.target.value)
                }
              />
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.localNewsEnabled}
                onChange={(e) =>
                  updateSetting("localNewsEnabled", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Local mode</span>
            </label>
            <div className="settings-field">
              <label>Local news location</label>
              <input
                type="text"
                value={settings.localNewsLocation}
                placeholder="City, state, or region"
                onChange={(e) =>
                  updateSetting("localNewsLocation", e.target.value)
                }
              />
              <p className="muted small">
                Enable Local mode to apply your location to Read, Watch, and Listen. Turn it off
                to stop local filtering and ordering without clearing the saved location.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "reading",
      label: "Read aloud",
      menuLabel: "Read",
      icon: "fa-headphones",
      summary: "Default narration settings for read-only pages.",
      content: (
        <div className="settings-grid">
          <div className="settings-card">
            <h3>Reading defaults</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.readAloudEnabled}
                onChange={(e) =>
                  updateSetting("readAloudEnabled", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Enable read aloud</span>
            </label>
            <div className="settings-field">
              <label>Speed</label>
              <div className="range-field">
                <input
                  type="range"
                  min="0.7"
                  max="1.6"
                  step="0.1"
                  value={settings.readAloudRate}
                  disabled={!settings.readAloudEnabled}
                  onChange={(e) =>
                    updateSetting("readAloudRate", e.target.value)
                  }
                />
                <span className="range-value">
                  {Number(settings.readAloudRate || 1).toFixed(1)}
                </span>
              </div>
            </div>
            <div className="settings-field">
              <label>Voice</label>
              <select
                value={settings.readAloudVoice}
                disabled={!settings.readAloudEnabled}
                onChange={(e) =>
                  updateSetting("readAloudVoice", e.target.value)
                }
              >
                <option value="">System default</option>
                {voiceOptions.map((voice) => (
                  <option
                    key={voice.voiceURI || voice.name}
                    value={voice.name}
                  >
                    {voice.name} {voice.lang ? `(${voice.lang})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.readAloudAutoStart}
                disabled={!settings.readAloudEnabled}
                onChange={(e) =>
                  updateSetting("readAloudAutoStart", e.target.checked)
                }
              />
              <span className="toggle-track"></span>
              <span className="toggle-label">Auto start reading</span>
            </label>
            {!settings.readAloudEnabled && (
              <p className="muted small">
                Read aloud is off by default. Enable it when you want spoken playback.
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "backend",
      label: "Backend",
      menuLabel: "Backend",
      icon: "fa-server",
      summary: "Point the frontend to production or dev backends.",
      content: (
        <div className="settings-grid">
          <div className="settings-card">
            <h3>Backend URL</h3>
            <div className="settings-field">
              <label>Backend URL</label>
              <input
                type="url"
                value={backendUrlDraft}
                placeholder="https://api.thecurrentscope.com"
                onChange={(e) => setBackendUrlDraft(e.target.value)}
              />
              <p className="muted small">
                Use the production or development backend for this app.
              </p>
            </div>
            <ServiceControls
              onSaveBackend={saveBackendUrl}
              onTestConnection={testBackendConnection}
              backendHealthClass={backendHealthClass}
              backendHealthLabel={backendHealth.label}
              backendConnectionClass={backendConnectionClass}
              backendConnectionLabel={backendConnection.label}
            />
          </div>
        </div>
      ),
    },
    {
      id: "updates",
      label: "Updates & Install",
      menuLabel: "Updates",
      icon: "fa-arrow-rotate-right",
      summary: "Stay current with updates or install the app for offline access.",
      content: (
        <div className="settings-grid">
          {isAppRuntime ? (
            <div className="settings-card">
              <h3>App updates</h3>
              <p className="muted">
                Status: {updateStatus || `Current ${updatePlatformLabel} version v${appVersion}`}
              </p>
              <div className="settings-field">
                <label>Update policy</label>
                <select
                  value={settings.updatePolicy}
                  onChange={(e) => updateSetting("updatePolicy", e.target.value)}
                >
                  <option value="auto">Automatic</option>
                  <option value="scheduled">On a schedule</option>
                  <option value="never">Never</option>
                </select>
              </div>
              {settings.updatePolicy === "scheduled" && (
                <div className="settings-field">
                  <label>Check every (hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    step="1"
                    value={settings.updateIntervalHours}
                    onChange={(e) =>
                      updateSetting("updateIntervalHours", e.target.value)
                    }
                  />
                </div>
              )}
              <div className="button-row updates-row">
                <button
                  type="button"
                  className="primary updates-action"
                  onClick={() => {
                    if (updateInfo?.url) {
                      handleUpdateNow();
                    } else {
                      checkForUpdates({});
                    }
                  }}
                >
                  {updateInfo?.url
                    ? `Download ${updatePlatformLabel} v${updateInfo.version}`
                    : `Check for updates (current v${appVersion})`}
                </button>
              </div>
              {isAndroidApp && settings.updatePolicy === "auto" && (
                <p className="muted">
                  Automatic updates will download the latest installer and prompt you to
                  complete the install.
                </p>
              )}
            </div>
          ) : (
            <div className="settings-card">
              <h3>Install App &amp; Installers</h3>
              {!isStandalone ? (
                <div className="settings-subsection">
                  <h4>Install App (PWA)</h4>
                  <p className="muted">
                    Install {BRAND_NAME} for a full-screen, app-like experience.
                  </p>
                  <div className="button-row">
                    <button
                      type="button"
                      className="primary"
                      onClick={handleInstall}
                      disabled={!canInstall}
                    >
                      Install App
                    </button>
                  </div>
                  {!canInstall && (
                    <p className="muted">On iOS: use Share → Add to Home Screen.</p>
                  )}
                </div>
              ) : (
                <div className="settings-subsection">
                  <h4>Install App (PWA)</h4>
                  <p className="muted">You are already running the standalone app.</p>
                </div>
              )}
              <div className="settings-subsection">
                <h4>Standalone installers</h4>
                <p className="muted">
                  Download the standalone installers for Windows, Android, or Linux. These
                  apps run locally and connect to the backend for data.
                </p>
                <div className="installer-actions">
                  {INSTALLER_ASSETS.map((asset) => {
                    const available = !!installerAvailability[asset.id];
                    const platformInfo = installerPlatforms?.[asset.id] || null;
                    const version = normalizeVersion(platformInfo?.version || "");
                    const href = resolveInstallerAssetUrl(
                      getBackendUrl().replace(/\/+$/, ""),
                      asset.file,
                      platformInfo?.url || ""
                    );
                    return (
                      <a
                        key={asset.id}
                        className={`installer-action ${available ? "primary" : "disabled"}`}
                        href={available ? href : undefined}
                        download
                        aria-disabled={!available}
                        onClick={(event) => {
                          if (!available) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <span className="installer-action-main">{asset.label}</span>
                        <span className={`status-pill ${available ? "ok" : "missing"}`}>
                          {available
                            ? version
                              ? `Ready • v${version}`
                              : "Ready"
                            : "Missing"}
                        </span>
                      </a>
                    );
                  })}
                </div>
                {!Object.values(installerAvailability).some(Boolean) && (
                  <p className="muted">
                    Installers will appear once the binaries are added to the backend
                    <code>/installers</code> directory.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ),
    },
  ];

  const activeSettingsSection = settingsSections.find(
    (section) => section.id === appSettingsSection
  );

  const appMenuModal = (
    <AppMenuModal
      open={appMenuOpen}
      onClose={closeAppMenu}
      sections={settingsSections}
      onOpenSection={openAppSettings}
    />
  );

  const appSettingsModal = (
    <AppSettingsModal
      section={activeSettingsSection}
      onClose={closeAppSettings}
      onBack={openAppMenu}
    />
  );

  return (
      <div className={`page${isStandalone ? " app-shell" : ""}`}>
      <div className="page-overlay" aria-hidden="true"></div>
      <div className={`container${settings.wideLayout ? " wide" : ""}`}>
        <header>
          <div className="brand">
            <BrandMark size={52} />
            <div>
              <div className="badge">News Tracker</div>
              <h1>{BRAND_NAME}</h1>
              <p className="muted">
                Curated headlines with live search, filters, and quick read-only access.
              </p>
            </div>
          </div>
          <div className="header-cta">
            <div className="header-stat">
              <span className="stat-label">Headlines</span>
              <span className="stat-value">{headlineCountDisplay}</span>
            </div>
            <div className="header-stat">
              <span className="stat-label">Last refresh</span>
              <span className="stat-value">{headlineUpdatedAt || "--"}</span>
            </div>
            <div className="header-actions">
              {localOnlyMode && (
                <span className="local-chip">Local: {localFilterLabel}</span>
              )}
              <button
                type="button"
                className="primary"
                onClick={() => navigate("settings")}
              >
                App menu
              </button>
            </div>
          </div>
        </header>

        {activeTab === "read" && (
        <section className="headline">
          {settings.showHeadlinesHeader && (
            <div className="headline-header">
              <div>
                <h2>Latest Headlines</h2>
                <p className="muted">Quick look at the newest stories</p>
              </div>
              <div className="headline-tools">
                <div className="update-chip">Updated {headlineUpdatedAt || "--"}</div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.autoRefreshHeadlines}
                    onChange={(e) =>
                      updateSetting("autoRefreshHeadlines", e.target.checked)
                    }
                  />
                  <span className="toggle-track"></span>
                  <span className="toggle-label">Auto refresh</span>
                </label>
              </div>
            </div>
          )}
          <div
            className="carousel"
            onMouseEnter={pauseCarousel}
            onMouseLeave={resumeCarousel}
            onFocusCapture={pauseCarousel}
            onBlurCapture={handleCarouselBlur}
            onTouchStart={pauseCarousel}
            onTouchEnd={resumeCarousel}
            onTouchCancel={resumeCarousel}
          >
            {headlineLoading ? (
              <div className="carousel-empty">Loading headlines...</div>
            ) : activeCarousel ? (
              <div className="carousel-slide">
                <div className="carousel-image">
                  {activeImage ? (
                    <img
                      src={activeImage}
                      alt={activeCarousel.title || "Article image"}
                    />
                  ) : (
                    <div className="carousel-image-placeholder">No image</div>
                  )}
                </div>
                <div className="carousel-content">
                  <div className="carousel-meta">
                    Slide {carouselIndex + 1} of {carouselItems.length}
                  </div>
                  <h3 className="carousel-title">
                    {activeCarousel.title || "Untitled article"}
                  </h3>
                  <p className="carousel-description">{activeDescription}</p>
                  <div className="carousel-actions">
                    {activeCarousel.url && (
                      <button
                        type="button"
                        className="carousel-button"
                        onClick={() => openReadOnly(activeCarousel)}
                      >
                        Read-only
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="carousel-empty">No articles yet.</div>
            )}
            {carouselItems.length > 1 && (
              <div className="carousel-controls">
                <button type="button" className="carousel-control" onClick={goPrev}>
                  Prev
                </button>
                <button type="button" className="carousel-control" onClick={goNext}>
                  Next
                </button>
              </div>
            )}
          </div>
        </section>
        )}

        <section className="tab-shell">
          {activeTab === "read" && (
            <>
              {tabNav}
        <section className="search">
          <div className="search-field">
            <label htmlFor="search-input">Search</label>
            <input
              id="search-input"
              placeholder="Search titles and headlines"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  loadArticles(search || "all", {
                    source: (filterSource || "").trim() || undefined,
                    provider: (filterProvider || "").trim() || undefined,
                  });
                }
              }}
            />
          </div>
          <div className="search-actions">
            <button
              className="primary"
              onClick={() =>
                loadArticles(search || "all", {
                  source: (filterSource || "").trim() || undefined,
                  provider: (filterProvider || "").trim() || undefined,
                })
              }
            >
              Search
            </button>
            <button
              onClick={() => {
                setSearch("");
                clearFilters();
                setArticles([]);
                setHasSearched(false);
                setLastSearch("");
                setResultsUpdatedAt("");
              }}
            >
              Clear
            </button>
          </div>
        </section>

        {(hasSearched || loading) && (
          <section className="results">
            <div className="results-header">
              <div>
                <h3>Search results</h3>
                <p className="muted">Filter, sort, and refine what you see</p>
              </div>
              <div className="results-meta">
                <div className="update-chip">Updated {resultsUpdatedAt || "--"}</div>
                {localOnlyMode && (
                  <div className="local-chip">Local: {localFilterLabel}</div>
                )}
                {searchExclusionsActive && (
                  <div className="filter-chip">Exclusions on</div>
                )}
                <label className="toggle small">
                  <input
                    type="checkbox"
                    checked={settings.autoRefreshResults}
                    onChange={(e) =>
                      updateSetting("autoRefreshResults", e.target.checked)
                    }
                    disabled={!lastSearch}
                  />
                  <span className="toggle-track"></span>
                  <span className="toggle-label">Auto refresh</span>
                </label>
              </div>
            </div>

            <div className="results-layout">
              {articles.length > 0 && (
                <Filters
                  className="results-sidebar"
                  detailsClassName="results-filter-dropdown"
                  open={filtersExpanded}
                  onToggle={(event) => setFiltersExpanded(event.currentTarget.open)}
                  summary={
                    <>
                      <span>Filters &amp; sorting</span>
                      <span className="summary-meta">{filterActive ? "Active" : "All"}</span>
                    </>
                  }
                >
                      <h4>Filters &amp; sorting</h4>
                    <div className="field">
                      <label htmlFor="filter-source">Source</label>
                      <select
                        id="filter-source"
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                      >
                        <option value="">All sources</option>
                        {sourceFilterOptions.map((source) => (
                          <option key={source} value={source}>
                            {source}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="filter-provider">Provider</label>
                      <select
                        id="filter-provider"
                        value={filterProvider}
                        onChange={(e) => setFilterProvider(e.target.value)}
                      >
                        <option value="">All providers</option>
                        {providerFilterOptions.map((provider) => (
                          <option key={provider} value={provider}>
                            {provider}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="results-divider" />
                    <div className="field">
                      <label htmlFor="sort-key">Sort by</label>
                      <select
                        id="sort-key"
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value)}
                      >
                        <option value="publishedAt">Published date</option>
                        <option value="title">Title</option>
                        <option value="source">Source</option>
                        <option value="provider">Provider</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="sort-dir">Order</label>
                      <select
                        id="sort-dir"
                        value={sortDir}
                        onChange={(e) => setSortDir(e.target.value)}
                      >
                        <option value="desc">Desc</option>
                        <option value="asc">Asc</option>
                      </select>
                    </div>
                    <div className="results-divider" />
                    <div className="field">
                      <label>Display mode</label>
                      <div className="segmented segmented-full">
                        <button
                          type="button"
                          className={settings.resultsView === "list" ? "active" : ""}
                          onClick={() => updateSetting("resultsView", "list")}
                        >
                          List
                        </button>
                        <button
                          type="button"
                          className={settings.resultsView === "card" ? "active" : ""}
                          onClick={() => updateSetting("resultsView", "card")}
                        >
                          Cards
                        </button>
                      </div>
                    </div>
                    <div className="results-divider" />
                    <label className="toggle small">
                      <input
                        type="checkbox"
                        checked={autoApplyFilters}
                        onChange={(e) => setAutoApplyFilters(e.target.checked)}
                      />
                      <span className="toggle-track"></span>
                      <span className="toggle-label">Auto apply saved</span>
                    </label>
                    <div className="results-sidebar-actions">
                      <button type="button" onClick={saveFilters}>
                        Save filters
                      </button>
                      <button type="button" onClick={applySavedFilters}>
                        Apply saved
                      </button>
                      <button type="button" onClick={clearFilters}>
                        Reset filters
                      </button>
                    </div>
                    {(filterSource || filterProvider) && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setFilterSource("");
                          setFilterProvider("");
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                    <div className="results-count">
                      Showing {sortedArticles.length} of {articles.length}
                    </div>
                </Filters>
              )}
              <div className="results-main">
                {loading ? (
                  <div>Loading...</div>
                ) : sortedArticles.length > 0 ? (
                  <ArticlesList
                    articles={sortedArticles}
                    resultsView={settings.resultsView}
                    isAppRuntime={isAppRuntime}
                    getArticleImage={getArticleImage}
                    normalizeProviderLabel={normalizeProviderLabel}
                    stripHtml={stripHtml}
                    openReadOnly={openReadOnly}
                    openExternal={openExternal}
                  />
                ) : (
                  <div className="results-empty">
                    {filterActive
                      ? "No results match the current filters."
                      : "No results found."}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
            </>
          )}

          {activeTab === "see" && (
            <section className="media-tab">
              <section className="headline media-featured">
                {settings.showVideoHeader && (
                  <div className="headline-header">
                    <div>
                      <h2>Featured Videos</h2>
                      <p className="muted">Auto-play and browse clips stored in the backend.</p>
                    </div>
                    <div className="headline-tools">
                      <div className="update-chip">Updated {videosUpdatedAt || "--"}</div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.autoRefreshVideos}
                          onChange={(e) =>
                            updateSetting("autoRefreshVideos", e.target.checked)
                          }
                          disabled={videoHasSearched}
                        />
                        <span className="toggle-track"></span>
                        <span className="toggle-label">Auto refresh</span>
                      </label>
                    </div>
                  </div>
                )}
                <div className="media-carousel-section">
                  <div className="media-player-card" ref={mediaPlayerCardRef}>
                  {activeVideo ? (
                    <>
                      {!videoPopoutOpen ? (
                        <MediaPlayer>
                          {renderVideoPlayerSurface(activeVideo, {
                            onEnded: settings.videoAutoRotate ? goNextVideo : null,
                          })}
                        </MediaPlayer>
                      ) : (
                        <div className="player-detached-shell">
                          <div className="results-empty">
                            Video is playing in the pop-out player.
                          </div>
                        </div>
                      )}
                      <div className="media-player-meta">
                        <div className="media-player-controls">
                          <div className="result-actions">
                            <button type="button" className="primary" onClick={goPrevVideo}>
                              Prev
                            </button>
                            <button type="button" className="primary" onClick={goNextVideo}>
                              Next
                            </button>
                            {getVideoExternalUrl(activeVideo) && (
                              <button
                                type="button"
                                onClick={() => openExternal(getVideoExternalUrl(activeVideo))}
                              >
                                Open source
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleVideoPopout(!videoPopoutOpen)}
                            >
                              {videoPopoutOpen ? "Dock player" : "Pop out"}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="media-player-info-toggle"
                            disabled={videoPopoutOpen}
                            onClick={() => setVideoInfoOpen((prev) => !prev)}
                          >
                            {videoPopoutOpen
                              ? "Info in docked view"
                              : videoInfoOpen
                              ? "Hide info"
                              : "Show info"}
                          </button>
                        </div>
                        {videoPopoutOpen ? (
                          <div className="media-player-popout-note">
                            Keep browsing in any tab while the floating player continues playback.
                          </div>
                        ) : videoInfoOpen ? (
                          <div className="media-player-info">
                            <h4>{activeVideo.title || "Untitled video"}</h4>
                            <p>{stripHtml(activeVideo.description) || "No description available."}</p>
                            <div className="result-meta">
                              {(activeVideo.source || "Unknown source") +
                                " • " +
                                (activeVideo.provider || "Unknown provider") +
                                " • " +
                                (activeVideo.published_at || activeVideo.publishedAt || "Unpublished")}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : videoLoading ? (
                    <div className="results-empty">Loading videos...</div>
                  ) : sortedVideos.length > 0 ? (
                    <div className="results-empty">
                      <p>
                        Current results do not include direct inline streams. Use Open source.
                      </p>
                      <div className="result-actions">
                        {getVideoExternalUrl(sortedVideos[0]) ? (
                          <button
                            type="button"
                            className="primary"
                            onClick={() => openExternal(getVideoExternalUrl(sortedVideos[0]))}
                          >
                            Open source
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="results-empty">No videos found.</div>
                  )}
                </div>
              </div>
              </section>
              {tabNav}
              <div className="media-search-row">
                <div className="search-field">
                  <label htmlFor="video-search-input">Search videos</label>
                  <input
                    id="video-search-input"
                    placeholder="Search titles and descriptions"
                    value={videoSearch}
                    onChange={(e) => setVideoSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        runVideoSearch();
                      }
                    }}
                  />
                </div>
                <div className="search-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={runVideoSearch}
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={clearVideoSearchState}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {videoHasSearched && (
                <section className="results video-results-panel">
                  <div className="results-header">
                    <div>
                      <h3>Video results</h3>
                      <p className="muted">Filter, sort, and watch the latest clips.</p>
                    </div>
                    <div className="results-meta">
                      <div className="update-chip">Updated {videosUpdatedAt || "--"}</div>
                      <label className="toggle small">
                        <input
                          type="checkbox"
                          checked={settings.autoRefreshVideoResults}
                          onChange={(e) =>
                            updateSetting("autoRefreshVideoResults", e.target.checked)
                          }
                          disabled={!lastVideoSearch}
                        />
                        <span className="toggle-track"></span>
                        <span className="toggle-label">Auto refresh</span>
                      </label>
                    </div>
                  </div>

                  <div className="results-layout">
                {videos.length > 0 && (
                  <aside className="results-sidebar">
                    <details
                      className="results-filter-dropdown"
                      open={videoFiltersExpanded}
                      onToggle={(event) => setVideoFiltersExpanded(event.currentTarget.open)}
                    >
                      <summary>
                        <span>Filters &amp; sorting</span>
                        <span className="summary-meta">
                          {videoFilterSource || videoFilterProvider || videoStartDate || videoEndDate ? "Active" : "All"}
                        </span>
                      </summary>
                      <div className="results-sidebar-card">
                        <h4>Filters &amp; sorting</h4>
                        <div className="field">
                          <label htmlFor="video-filter-source">Source</label>
                          <select
                            id="video-filter-source"
                            value={videoFilterSource}
                            onChange={(e) => setVideoFilterSource(e.target.value)}
                          >
                            <option value="">All sources</option>
                            {videoSourceOptions.map((source) => (
                              <option key={source} value={source}>
                                {source}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="video-filter-provider">Provider</label>
                          <select
                            id="video-filter-provider"
                            value={videoFilterProvider}
                            onChange={(e) => setVideoFilterProvider(e.target.value)}
                          >
                            <option value="">All providers</option>
                            {videoProviderOptions.map((provider) => (
                              <option key={provider} value={provider}>
                                {provider}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="results-divider" />
                        <div className="field">
                          <label htmlFor="video-start-date">Published after</label>
                          <input
                            id="video-start-date"
                            type="date"
                            value={videoStartDate}
                            onChange={(e) => setVideoStartDate(e.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="video-end-date">Published before</label>
                          <input
                            id="video-end-date"
                            type="date"
                            value={videoEndDate}
                            onChange={(e) => setVideoEndDate(e.target.value)}
                          />
                        </div>
                        <div className="results-divider" />
                        <div className="field">
                          <label htmlFor="video-sort-key">Sort by</label>
                          <select
                            id="video-sort-key"
                            value={videoSortKey}
                            onChange={(e) => setVideoSortKey(e.target.value)}
                          >
                            <option value="published_at">Published date</option>
                            <option value="title">Title</option>
                            <option value="source">Source</option>
                            <option value="provider">Provider</option>
                            <option value="fetched_at">Fetched</option>
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="video-sort-dir">Order</label>
                          <select
                            id="video-sort-dir"
                            value={videoSortDir}
                            onChange={(e) => setVideoSortDir(e.target.value)}
                          >
                            <option value="desc">Desc</option>
                            <option value="asc">Asc</option>
                          </select>
                        </div>
                        <div className="results-divider" />
                        <div className="field">
                          <label>Display mode</label>
                          <div className="segmented segmented-full">
                            <button
                              type="button"
                              className={settings.resultsView === "list" ? "active" : ""}
                              onClick={() => updateSetting("resultsView", "list")}
                            >
                              List
                            </button>
                            <button
                              type="button"
                              className={settings.resultsView === "card" ? "active" : ""}
                              onClick={() => updateSetting("resultsView", "card")}
                            >
                              Cards
                            </button>
                          </div>
                        </div>
                        <div className="results-divider" />
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setVideoFilterSource("");
                            setVideoFilterProvider("");
                            setVideoStartDate("");
                            setVideoEndDate("");
                            setVideoSortKey("published_at");
                            setVideoSortDir("desc");
                          }}
                        >
                          Reset filters
                        </button>
                        <div className="results-count">
                          Showing {sortedVideos.length} filtered ({videos.length} total)
                        </div>
                      </div>
                    </details>
                  </aside>
                )}
                <div className="results-main">
                  {videoLoading ? (
                    <div className="results-empty">Loading videos...</div>
                  ) : sortedVideos.length > 0 ? (
                    <div
                      className={`results-grid video-results ${settings.resultsView === "card" ? "cards" : "list"}`}
                    >
                      {sortedVideos.map((video, index) => {
                        const isActive = sortedVideos[activeVideoIndex] === video;
                        const inlinePlayable = isResolvableRemoteVideo(video);
                        const thumb = getVideoThumb(video);
                        const metaItems = [
                          video.source || "Unknown source",
                          video.provider || "Unknown provider",
                          video.published_at || video.publishedAt || "Unpublished",
                        ];
                        return (
                          <article
                            key={video.id || video.video_url || `${video.title}-${index}`}
                            className={`result-card${isActive ? " active" : ""}${inlinePlayable ? "" : " blocked"}`}
                            onClick={() => selectVideo(index)}
                          >
                            <div className={`result-media${thumb ? "" : " placeholder"}`}>
                              {thumb ? <img src={thumb} alt={video.title || "Video thumbnail"} /> : <span>No image</span>}
                            </div>
                            <div className="result-body">
                              <div className="result-meta">{metaItems.join(" • ")}</div>
                              <h4 className="result-title">
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    selectVideo(index);
                                  }}
                                >
                                  {video.title || "Untitled video"}
                                </button>
                              </h4>
                              <p className="result-description">
                                {stripHtml(video.description) || "No preview available."}
                              </p>
                              {!inlinePlayable ? (
                                <div className="result-meta">
                                  Inline playback unavailable for this source. Use Open source.
                                </div>
                              ) : null}
                              <div className="result-actions">
                                <button
                                  type="button"
                                  className="primary"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openVideoModal(video);
                                  }}
                                >
                                  Watch
                                </button>
                                {getVideoExternalUrl(video) && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      openExternal(getVideoExternalUrl(video));
                                    }}
                                  >
                                    Open source
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="results-empty">No videos found.</div>
                  )}
                </div>
              </div>
                </section>
              )}
            </section>
          )}

          {activeTab === "hear" && (
            <section className="radio-tab">
              <section className="headline media-featured">
                {settings.showRadioHeader && (
                  <div className="headline-header">
                    <div>
                      <h2>Featured Stations</h2>
                      <p className="muted">Browse and play news radio streams stored in the backend.</p>
                    </div>
                    <div className="headline-tools">
                      <div className="update-chip">Updated {radiosUpdatedAt || "--"}</div>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.autoRefreshRadios}
                          onChange={(e) =>
                            updateSetting("autoRefreshRadios", e.target.checked)
                          }
                          disabled={radioHasSearched}
                        />
                        <span className="toggle-track"></span>
                        <span className="toggle-label">Auto refresh</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="radio-player-card" ref={radioPlayerCardRef}>
                  {activeRadio ? (
                    <>
                      <div className="radio-player-head">
                        <div className="radio-player-title">
                          <div className="radio-favicon-shell" aria-hidden="true">
                            <div className="radio-favicon placeholder" aria-hidden="true">
                              <i className="fa-solid fa-radio"></i>
                            </div>
                            {activeRadio.favicon_url ? (
                              <img
                                className="radio-favicon"
                                src={activeRadio.favicon_url}
                                alt=""
                                loading="lazy"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            ) : null}
                          </div>
                          <div>
                            <h4>{activeRadio.name || "Untitled station"}</h4>
                            <div className="result-meta">
                              {[
                                activeRadio.country || activeRadio.country_code,
                                activeRadio.language,
                                activeRadio.codec,
                                activeRadio.bitrate ? `${activeRadio.bitrate} kbps` : null,
                                activeRadio.provider,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </div>
                          </div>
                        </div>
                        <div className="radio-player-actions">
                          {activeRadio.homepage_url ? (
                            <button type="button" onClick={() => openExternal(activeRadio.homepage_url)}>
                              Website
                            </button>
                          ) : null}
                          {activeRadio.stream_url ? (
                            <button type="button" onClick={() => openExternal(activeRadio.stream_url)}>
                              Stream URL
                            </button>
                          ) : null}
                          <button type="button" onClick={() => toggleRadioPopout(!radioPopoutOpen)}>
                            {radioPopoutOpen ? "Dock player" : "Pop out"}
                          </button>
                        </div>
                      </div>
                      <div className="radio-player-body">
                        {radioPopoutOpen ? (
                          <div className="radio-player-popout-note">
                            Station is playing in the pop-out player. You can keep browsing the app.
                          </div>
                        ) : (
                          renderRadioPlayback(activeRadio)
                        )}
                        {activeRadio.tags ? (
                          <div className="radio-tags">
                            <span className="muted">Tags:</span> {activeRadio.tags}
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : radioLoading ? (
                    <div className="results-empty">Loading stations...</div>
                  ) : (
                    <div className="results-empty">No stations found.</div>
                  )}
                </div>
              </section>
              {tabNav}

              <div className="media-search-row">
                <div className="search-field">
                  <label htmlFor="radio-search-input">Search stations</label>
                  <input
                    id="radio-search-input"
                    placeholder="Search station names, tags, countries..."
                    value={radioSearch}
                    onChange={(e) => setRadioSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        runRadioSearch();
                      }
                    }}
                  />
                </div>
                <div className="search-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={runRadioSearch}
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={clearRadioSearchState}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {radioHasSearched && (
                <section className="results radio-results-panel">
                  <div className="results-header">
                    <div>
                      <h3>Radio results</h3>
                      <p className="muted">Filter, sort, and play stations stored in the backend.</p>
                    </div>
                    <div className="results-meta">
                      <div className="update-chip">Updated {radiosUpdatedAt || "--"}</div>
                      <label className="toggle small">
                        <input
                          type="checkbox"
                          checked={settings.autoRefreshRadioResults}
                          onChange={(e) =>
                            updateSetting("autoRefreshRadioResults", e.target.checked)
                          }
                          disabled={!lastRadioSearch}
                        />
                        <span className="toggle-track"></span>
                        <span className="toggle-label">Auto refresh</span>
                      </label>
                    </div>
                  </div>

                  <div className="results-layout">
                {radios.length > 0 && (
                  <aside className="results-sidebar">
                    <details
                      className="results-filter-dropdown"
                      open={radioFiltersExpanded}
                      onToggle={(event) => setRadioFiltersExpanded(event.currentTarget.open)}
                    >
                      <summary>
                        <span>Filters &amp; sorting</span>
                        <span className="summary-meta">
                          {radioFilterCountry || radioFilterLanguage || radioFilterTag || radioFilterProvider ? "Active" : "All"}
                        </span>
                      </summary>
                      <div className="results-sidebar-card">
                        <h4>Filters &amp; sorting</h4>
                        <div className="field">
                          <label htmlFor="radio-filter-country">Country</label>
                          <select
                            id="radio-filter-country"
                            value={radioFilterCountry}
                            onChange={(e) => setRadioFilterCountry(e.target.value)}
                          >
                            <option value="">All countries</option>
                            {radioCountryOptions.map((country) => (
                              <option key={country} value={country}>
                                {country}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="radio-filter-language">Language</label>
                          <select
                            id="radio-filter-language"
                            value={radioFilterLanguage}
                            onChange={(e) => setRadioFilterLanguage(e.target.value)}
                          >
                            <option value="">All languages</option>
                            {radioLanguageOptions.map((lang) => (
                              <option key={lang} value={lang}>
                                {lang}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="radio-filter-provider">Provider</label>
                          <select
                            id="radio-filter-provider"
                            value={radioFilterProvider}
                            onChange={(e) => setRadioFilterProvider(e.target.value)}
                          >
                            <option value="">All providers</option>
                            {radioProviderOptions.map((provider) => (
                              <option key={provider} value={provider}>
                                {provider}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="radio-filter-tag">Tag contains</label>
                          <input
                            id="radio-filter-tag"
                            placeholder="news, politics, finance..."
                            value={radioFilterTag}
                            onChange={(e) => setRadioFilterTag(e.target.value)}
                          />
                        </div>
                        <div className="results-divider" />
                        <div className="field">
                          <label htmlFor="radio-sort-key">Sort by</label>
                          <select
                            id="radio-sort-key"
                            value={radioSortKey}
                            onChange={(e) => setRadioSortKey(e.target.value)}
                          >
                            <option value="votes">Votes</option>
                            <option value="name">Name</option>
                            <option value="country">Country</option>
                            <option value="language">Language</option>
                            <option value="bitrate">Bitrate</option>
                            <option value="codec">Codec</option>
                            <option value="fetched_at">Fetched</option>
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="radio-sort-dir">Order</label>
                          <select
                            id="radio-sort-dir"
                            value={radioSortDir}
                            onChange={(e) => setRadioSortDir(e.target.value)}
                          >
                            <option value="desc">Desc</option>
                            <option value="asc">Asc</option>
                          </select>
                        </div>
                        <div className="results-divider" />
                        <div className="field">
                          <label>Display mode</label>
                          <div className="segmented segmented-full">
                            <button
                              type="button"
                              className={settings.resultsView === "list" ? "active" : ""}
                              onClick={() => updateSetting("resultsView", "list")}
                            >
                              List
                            </button>
                            <button
                              type="button"
                              className={settings.resultsView === "card" ? "active" : ""}
                              onClick={() => updateSetting("resultsView", "card")}
                            >
                              Cards
                            </button>
                          </div>
                        </div>
                        <div className="results-divider" />
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setRadioFilterCountry("");
                            setRadioFilterLanguage("");
                            setRadioFilterTag("");
                            setRadioFilterProvider("");
                            setRadioSortKey("votes");
                            setRadioSortDir("desc");
                          }}
                        >
                          Reset filters
                        </button>
                        <div className="results-count">
                          Showing {sortedRadios.length} of {radios.length}
                        </div>
                      </div>
                    </details>
                  </aside>
                )}

                <div className="results-main">
                  {radioLoading ? (
                    <div className="results-empty">Loading stations...</div>
                  ) : sortedRadios.length > 0 ? (
                    <div className={`results-grid radio-results ${settings.resultsView === "card" ? "cards" : "list"}`}>
                      {sortedRadios.map((row, index) => {
                        const stationKey =
                          buildRadioKey(row) ||
                          row.id ||
                          row.stream_url ||
                          `${row.name || "station"}-${index}`;
                        const isActive = selectedRadioKey
                          ? stationKey === selectedRadioKey
                          : index === activeRadioIndex;
                        const metaItems = [
                          row.country || row.country_code,
                          row.language,
                          row.codec,
                          row.bitrate ? `${row.bitrate} kbps` : null,
                          row.provider,
                        ]
                          .filter(Boolean)
                          .join(" • ");
                        const hasHttpsStream = String(row.stream_url || "").toLowerCase().startsWith("https://");
                        return (
                          <article
                            key={stationKey}
                            className={`result-card${isActive ? " active" : ""}`}
                            onClick={() => selectRadio(index)}
                          >
                            <div className="result-media media-shell">
                              <div className="media-fallback" aria-hidden="true">
                                <i className="fa-solid fa-radio"></i>
                              </div>
                              {row.favicon_url ? (
                                <img
                                  src={row.favicon_url}
                                  alt=""
                                  loading="lazy"
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : null}
                            </div>
                            <div className="result-body">
                              <div className="result-meta">{metaItems || "Station"}</div>
                              <h4 className="result-title">
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    selectRadio(index);
                                  }}
                                >
                                  {row.name || "Untitled station"}
                                </button>
                              </h4>
                              <p className="result-description">
                                {stripHtml(row.description) ||
                                  row.tags ||
                                  "No description available."}
                              </p>
                              <div className="result-actions">
                                <button
                                  type="button"
                                  className="primary"
                                  disabled={!row.stream_url || (!hasHttpsStream && window.location?.protocol === "https:")}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    selectRadio(index, { autoPlay: true });
                                  }}
                                  title={
                                    !row.stream_url
                                      ? "Missing stream URL"
                                      : !hasHttpsStream && window.location?.protocol === "https:"
                                      ? "HTTP streams may be blocked on HTTPS."
                                      : "Play"
                                  }
                                >
                                  Listen
                                </button>
                                {row.homepage_url ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      openExternal(row.homepage_url);
                                    }}
                                  >
                                    Website
                                  </button>
                                ) : null}
                                {row.stream_url ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      openExternal(row.stream_url);
                                    }}
                                  >
                                    Stream
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="results-empty">
                      No stations found. Enable radio fetching in the admin dashboard and run the tracker to populate stations.
                    </div>
                  )}
                </div>
              </div>
                </section>
              )}
            </section>
          )}

          {activeTab === "feel" && (
            <section className="weather-tab">
              <div className="local-weather-card">
                {settings.showWeatherHeader && (
                  <div className="local-weather-head">
                    <div>
                      <h4>Today near you</h4>
                      <p className="muted">
                        Uses your device location to pin the closest stored weather record.
                      </p>
                    </div>
                    <div className="headline-tools">
                      <div className="update-chip">Updated {weatherUpdatedAt || "--"}</div>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => requestDeviceWeatherLocation({ force: true })}
                      >
                        Use my location
                      </button>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={settings.autoRefreshWeather}
                          onChange={(e) =>
                            updateSetting("autoRefreshWeather", e.target.checked)
                          }
                        />
                        <span className="toggle-track"></span>
                        <span className="toggle-label">Auto refresh</span>
                      </label>
                      <div
                        className={deviceWeatherClass}
                        title={deviceWeatherLocationStatus.label}
                      >
                        <span className="health-dot" />
                        <span>
                          {deviceWeatherLocationStatus.state === "ready"
                            ? "Location on"
                            : deviceWeatherLocationStatus.state === "requesting"
                              ? "Checking..."
                              : "Location off"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="local-weather-body">
                  {localWeatherCandidate ? (
                    <div className="local-weather-grid">
                      <div>
                        <div className="local-weather-location">
                          {localWeatherCandidate.location_name || "Nearby"}
                        </div>
                        <div className="local-weather-temp">
                          {localWeatherCandidate.temperature ?? "--"}°
                        </div>
                        <div className="local-weather-meta">
                          <span>Feels like: {localWeatherCandidate.apparent_temperature ?? "--"}°</span>
                          <span>Humidity: {localWeatherCandidate.humidity ?? "--"}%</span>
                          <span>Wind: {localWeatherCandidate.wind_speed ?? "--"}</span>
                          <span>
                            Observed:{" "}
                            {formatTimestamp(
                              localWeatherCandidate.weather_time ||
                                localWeatherCandidate.fetched_at
                            )}
                          </span>
                          {localWeatherCandidate.distance_km !== undefined ? (
                            <span>Distance: {localWeatherCandidate.distance_km} km</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="local-weather-empty">
                      <p className="muted">
                        {deviceWeatherLocationStatus.state === "ready"
                          ? "No stored weather record matched your location yet."
                          : deviceWeatherLocationStatus.label}
                      </p>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => requestDeviceWeatherLocation({ force: true })}
                      >
                        Use my location
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {tabNav}
              <div className="weather-insights">
                <div className="weather-insight-card radar-card">
                  <div className="weather-insight-head">
                    <div>
                      <h4>Radar</h4>
                      <p className="muted small">
                        Drag to pan. Pinch or wheel to zoom. Reset centers on your selected local area.
                      </p>
                    </div>
                    <div className="weather-insight-actions">
                      <div className="update-chip small">
                        {radarUpdatedAt ? `Updated ${radarUpdatedAt}` : "Updated --"}
                      </div>
                      <label className="toggle small">
                        <input
                          type="checkbox"
                          checked={settings.autoRefreshRadar}
                          onChange={(e) =>
                            updateSetting("autoRefreshRadar", e.target.checked)
                          }
                        />
                        <span className="toggle-track"></span>
                        <span className="toggle-label">Auto refresh</span>
                      </label>
                    </div>
                  </div>
                  <div
                    className={`radar-frame${radarFullscreen ? " is-fullscreen" : ""}`}
                    ref={radarFrameRef}
                    role="application"
                    aria-label="Radar map"
                  >
                    <div className="radar-map-canvas" ref={radarMapContainerRef} aria-hidden="true" />
                    {radarLoading ? (
                      <div className="radar-loading">Loading radar...</div>
                    ) : !activeRadarFrame ? (
                      <div className="radar-loading">Radar is unavailable.</div>
                    ) : null}
                    {radarError && (
                      <div className="radar-status-chip" role="status">
                        {radarError}
                      </div>
                    )}
                    {radarNearestSeries?.latest && (
                      <div className="radar-focus-chip">
                        <strong>
                          {radarNearestSeries.location_name || "Nearest weather"}
                        </strong>
                        <span>
                          {radarNearestSeries.latest.temperature ?? "--"}° • Feels{" "}
                          {radarNearestSeries.latest.apparent_temperature ?? "--"}° • Hum{" "}
                          {radarNearestSeries.latest.humidity ?? "--"}%
                          {radarNearestSeries.distance_km !== undefined
                            ? ` • ${radarNearestSeries.distance_km} km`
                            : ""}
                        </span>
                      </div>
                    )}
                    {activeRadarFrame && (
                      <div className="radar-overlay-controls" role="group" aria-label="Radar controls">
                        <button
                          type="button"
                          onClick={() => bumpRadarZoom(-1)}
                          disabled={radarZoomLevel <= RADAR_MIN_ZOOM || radarLoading}
                          title="Zoom out"
                          aria-label="Zoom out"
                        >
                          <i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true"></i>
                        </button>
                        <span className="radar-zoom-label">Zoom {radarZoomLevel}</span>
                        <button
                          type="button"
                          onClick={() => bumpRadarZoom(1)}
                          disabled={radarZoomLevel >= RADAR_MAX_ZOOM || radarLoading}
                          title="Zoom in"
                          aria-label="Zoom in"
                        >
                          <i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i>
                        </button>
                        <button
                          type="button"
                          onClick={resetRadarView}
                          title="Reset view"
                          aria-label="Reset view"
                        >
                          <i className="fa-solid fa-crosshairs" aria-hidden="true"></i>
                        </button>
                        <button
                          type="button"
                          onClick={toggleRadarFullscreen}
                          title={radarFullscreen ? "Exit fullscreen" : "Fullscreen"}
                          aria-label={radarFullscreen ? "Exit fullscreen" : "Fullscreen"}
                        >
                          <i
                            className={`fa-solid ${
                              radarFullscreen ? "fa-compress" : "fa-expand"
                            }`}
                            aria-hidden="true"
                          ></i>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="weather-insight-card weather-chart-card">
                  <div className="weather-insight-head">
                    <div>
                      <h4>Weather analytics</h4>
                      <p className="muted small">
                        Charts auto-follow the map position. Pan/zoom radar to change the focused location.
                      </p>
                    </div>
                    <div className="weather-insight-controls">
                      <select
                        aria-label="Weather chart location"
                        value={weatherChartLocation}
                        onChange={(e) => setWeatherChartLocation(e.target.value)}
                      >
                        <option value="auto">
                          Auto (nearest map center)
                          {radarNearestSeries?.location_name
                            ? ` • ${radarNearestSeries.location_name}`
                            : ""}
                        </option>
                        {weatherSeriesOptions.map((group) => (
                          <option key={group.key} value={group.key}>
                            {group.location_name}
                            {group.country_code ? ` (${group.country_code})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="weather-chart-body weather-chart-body-rich">
                    {weatherChartSeries && weatherChartPoints.length > 0 ? (
                      <>
                        <div className="weather-chart-kpis">
                          <div className="weather-kpi">
                            <span>Location</span>
                            <strong>
                              {weatherChartSeries.location_name || "Unknown"}
                            </strong>
                          </div>
                          <div className="weather-kpi">
                            <span>Records</span>
                            <strong>{weatherChartStats?.points || 0}</strong>
                          </div>
                          <div className="weather-kpi">
                            <span>Temp range</span>
                            <strong>
                              {Number.isFinite(weatherChartStats?.minTemp)
                                ? `${Math.round(weatherChartStats.minTemp)}°`
                                : "--"}
                              {" - "}
                              {Number.isFinite(weatherChartStats?.maxTemp)
                                ? `${Math.round(weatherChartStats.maxTemp)}°`
                                : "--"}
                            </strong>
                          </div>
                          <div className="weather-kpi">
                            <span>Peak wind</span>
                            <strong>
                              {Number.isFinite(weatherChartStats?.peakWind)
                                ? Math.round(weatherChartStats.peakWind)
                                : "--"}
                            </strong>
                          </div>
                        </div>

                        {weatherLatestStats ? (
                          <div className="weather-detail-board">
                            <article className="weather-detail-card">
                              <header>
                                <h5>Live Snapshot</h5>
                                <span>{weatherLatestStats.observedAt || "--"}</span>
                              </header>
                              <div className="weather-detail-grid">
                                <div>
                                  <small>Condition</small>
                                  <strong>{weatherLatestStats.condition}</strong>
                                </div>
                                <div>
                                  <small>Temperature</small>
                                  <strong>
                                    {Number.isFinite(weatherLatestStats.temp)
                                      ? `${Math.round(weatherLatestStats.temp)}°`
                                      : "--"}
                                  </strong>
                                </div>
                                <div>
                                  <small>Feels like</small>
                                  <strong>
                                    {Number.isFinite(weatherLatestStats.feels)
                                      ? `${Math.round(weatherLatestStats.feels)}°`
                                      : "--"}
                                  </strong>
                                </div>
                                <div>
                                  <small>Humidity</small>
                                  <strong>
                                    {Number.isFinite(weatherLatestStats.humidity)
                                      ? `${Math.round(weatherLatestStats.humidity)}%`
                                      : "--"}
                                  </strong>
                                </div>
                                <div>
                                  <small>Wind speed</small>
                                  <strong>
                                    {Number.isFinite(weatherLatestStats.wind)
                                      ? `${Math.round(weatherLatestStats.wind)}`
                                      : "--"}
                                  </strong>
                                </div>
                                <div>
                                  <small>Comfort score</small>
                                  <strong>
                                    {Number.isFinite(weatherLatestStats.comfort)
                                      ? `${Math.round(weatherLatestStats.comfort)}`
                                      : "--"}
                                  </strong>
                                </div>
                              </div>
                            </article>

                            <article className="weather-detail-card weather-detail-card-meters">
                              <header>
                                <h5>Derived Metrics</h5>
                                <span>Calculated from latest sample</span>
                              </header>
                              <div className="weather-meter-list">
                                <label className="weather-meter">
                                  <span>
                                    Heat Index
                                    <strong>
                                      {Number.isFinite(weatherLatestStats.heatIndex)
                                        ? `${Math.round(weatherLatestStats.heatIndex)}°`
                                        : "--"}
                                    </strong>
                                  </span>
                                  <progress
                                    max="130"
                                    value={
                                      Number.isFinite(weatherLatestStats.heatIndex)
                                        ? Math.max(0, Math.min(130, weatherLatestStats.heatIndex))
                                        : 0
                                    }
                                  ></progress>
                                </label>
                                <label className="weather-meter">
                                  <span>
                                    Wind Chill
                                    <strong>
                                      {Number.isFinite(weatherLatestStats.windChill)
                                        ? `${Math.round(weatherLatestStats.windChill)}°`
                                        : "--"}
                                    </strong>
                                  </span>
                                  <progress
                                    max="130"
                                    value={
                                      Number.isFinite(weatherLatestStats.windChill)
                                        ? Math.max(0, Math.min(130, weatherLatestStats.windChill))
                                        : 0
                                    }
                                  ></progress>
                                </label>
                                <label className="weather-meter">
                                  <span>
                                    Comfort Index
                                    <strong>
                                      {Number.isFinite(weatherLatestStats.comfort)
                                        ? `${Math.round(weatherLatestStats.comfort)}`
                                        : "--"}
                                    </strong>
                                  </span>
                                  <progress
                                    max="100"
                                    value={
                                      Number.isFinite(weatherLatestStats.comfort)
                                        ? Math.max(0, Math.min(100, weatherLatestStats.comfort))
                                        : 0
                                    }
                                  ></progress>
                                </label>
                              </div>
                            </article>
                          </div>
                        ) : null}

                        <div className="weather-chart-grid">
                          <article className="weather-chart-panel">
                            <h5>Temperature vs Feels Like</h5>
                            {weatherThermalChart ? (
                              <>
                                <svg
                                  viewBox={`0 0 ${weatherThermalChart.width} ${weatherThermalChart.height}`}
                                  width="100%"
                                  height={weatherThermalChart.height}
                                  className="weather-chart-svg weather-chart-svg-thermal"
                                  role="img"
                                  aria-label="Temperature and feels-like trend"
                                  preserveAspectRatio="none"
                                >
                                  <defs>
                                    <linearGradient id="thermalTempLine" x1="0" y1="0" x2="1" y2="0">
                                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0.95" />
                                    </linearGradient>
                                    <linearGradient id="thermalFeelsLine" x1="0" y1="0" x2="1" y2="0">
                                      <stop offset="0%" stopColor="#f97316" stopOpacity="0.92" />
                                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.92" />
                                    </linearGradient>
                                    <linearGradient id="thermalTempArea" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
                                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.03" />
                                    </linearGradient>
                                  </defs>
                                  <rect
                                    x={weatherThermalChart.left}
                                    y={weatherThermalChart.top}
                                    width={
                                      weatherThermalChart.width -
                                      weatherThermalChart.left -
                                      weatherThermalChart.right
                                    }
                                    height={
                                      weatherThermalChart.height -
                                      weatherThermalChart.top -
                                      weatherThermalChart.bottom
                                    }
                                    rx="10"
                                    fill="rgba(148,163,184,0.08)"
                                  />
                                  {weatherThermalChart.tempAreaPath ? (
                                    <path d={weatherThermalChart.tempAreaPath} fill="url(#thermalTempArea)" />
                                  ) : null}
                                  {weatherThermalChart.tempPath ? (
                                    <path
                                      d={weatherThermalChart.tempPath}
                                      fill="none"
                                      stroke="url(#thermalTempLine)"
                                      strokeWidth="3.2"
                                      strokeLinejoin="round"
                                      strokeLinecap="round"
                                    />
                                  ) : null}
                                  {weatherThermalChart.feelsPath ? (
                                    <path
                                      d={weatherThermalChart.feelsPath}
                                      fill="none"
                                      stroke="url(#thermalFeelsLine)"
                                      strokeWidth="2.6"
                                      strokeLinejoin="round"
                                      strokeLinecap="round"
                                      strokeDasharray="8 7"
                                    />
                                  ) : null}
                                  {weatherThermalChart.dots.map((dot, idx) => (
                                    <g key={`weather-dot-${idx}`}>
                                      {Number.isFinite(dot.tempY) ? (
                                        <circle
                                          cx={dot.x}
                                          cy={dot.tempY}
                                          r="3.2"
                                          fill="var(--surface)"
                                          stroke="#38bdf8"
                                          strokeWidth="1.8"
                                        />
                                      ) : null}
                                      {Number.isFinite(dot.feelsY) ? (
                                        <circle
                                          cx={dot.x}
                                          cy={dot.feelsY}
                                          r="2.6"
                                          fill="var(--surface)"
                                          stroke="#f97316"
                                          strokeWidth="1.6"
                                        />
                                      ) : null}
                                    </g>
                                  ))}
                                </svg>
                                <div className="weather-chart-axis">
                                  <span>{formatTimestamp(new Date(weatherThermalChart.startTs))}</span>
                                  <span>{formatTimestamp(new Date(weatherThermalChart.endTs))}</span>
                                </div>
                              </>
                            ) : (
                              <div className="results-empty">Need at least two temperature points.</div>
                            )}
                          </article>

                          <article className="weather-chart-panel">
                            <h5>Humidity & Wind Dynamics</h5>
                            {weatherAtmosChart ? (
                              <>
                                <svg
                                  viewBox={`0 0 ${weatherAtmosChart.width} ${weatherAtmosChart.height}`}
                                  width="100%"
                                  height={weatherAtmosChart.height}
                                  className="weather-chart-svg weather-chart-svg-atmos"
                                  role="img"
                                  aria-label="Humidity bars and wind trend"
                                  preserveAspectRatio="none"
                                >
                                  <defs>
                                    <linearGradient id="humidityBars" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.95" />
                                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.45" />
                                    </linearGradient>
                                    <linearGradient id="windLine" x1="0" y1="0" x2="1" y2="0">
                                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
                                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0.95" />
                                    </linearGradient>
                                  </defs>
                                  <rect
                                    x={weatherAtmosChart.left}
                                    y={weatherAtmosChart.top}
                                    width={
                                      weatherAtmosChart.width -
                                      weatherAtmosChart.left -
                                      weatherAtmosChart.right
                                    }
                                    height={
                                      weatherAtmosChart.height -
                                      weatherAtmosChart.top -
                                      weatherAtmosChart.bottom
                                    }
                                    rx="10"
                                    fill="rgba(148,163,184,0.08)"
                                  />
                                  {weatherAtmosChart.bars.map((bar, idx) => (
                                    <rect
                                      key={`humidity-bar-${idx}`}
                                      x={(bar.x - bar.width / 2).toFixed(2)}
                                      y={bar.y.toFixed(2)}
                                      width={bar.width.toFixed(2)}
                                      height={bar.height.toFixed(2)}
                                      fill="url(#humidityBars)"
                                      rx="3"
                                    />
                                  ))}
                                  {weatherAtmosChart.windPath ? (
                                    <path
                                      d={weatherAtmosChart.windPath}
                                      fill="none"
                                      stroke="url(#windLine)"
                                      strokeWidth="2.8"
                                      strokeLinejoin="round"
                                      strokeLinecap="round"
                                    />
                                  ) : null}
                                  {weatherAtmosChart.windDots.map((dot, idx) => (
                                    <circle
                                      key={`wind-dot-${idx}`}
                                      cx={dot.x}
                                      cy={dot.y}
                                      r="2.8"
                                      fill="#f59e0b"
                                    />
                                  ))}
                                </svg>
                                <div className="weather-chart-axis">
                                  <span>{formatTimestamp(new Date(weatherAtmosChart.startTs))}</span>
                                  <span>{formatTimestamp(new Date(weatherAtmosChart.endTs))}</span>
                                </div>
                              </>
                            ) : (
                              <div className="results-empty">Need at least two humidity/wind points.</div>
                            )}
                          </article>

                          <article className="weather-chart-panel weather-chart-panel-cond">
                            <h5>Condition Mix</h5>
                            {weatherConditionChart ? (
                              <div className="weather-condition-wrap">
                                <svg
                                  viewBox="0 0 260 260"
                                  width="100%"
                                  height="100%"
                                  className="weather-condition-chart"
                                  role="img"
                                  aria-label="Condition distribution chart"
                                >
                                  <circle cx="130" cy="130" r="108" fill="rgba(148,163,184,0.1)" />
                                  {weatherConditionChart.slices.map((slice) => (
                                    <path
                                      key={slice.label}
                                      d={slice.path}
                                      fill={slice.color}
                                      opacity="0.92"
                                    />
                                  ))}
                                  <circle cx="130" cy="130" r="58" fill="var(--surface)" />
                                  <text
                                    x="130"
                                    y="124"
                                    textAnchor="middle"
                                    fontSize="12"
                                    fill="var(--muted)"
                                  >
                                    {weatherConditionChart.centerLabel}
                                  </text>
                                  <text
                                    x="130"
                                    y="145"
                                    textAnchor="middle"
                                    fontSize="17"
                                    fontWeight="800"
                                    fill="var(--ink)"
                                  >
                                    {weatherConditionChart.total} pts
                                  </text>
                                </svg>
                                <div className="weather-condition-legend">
                                  {weatherConditionChart.slices.map((slice) => (
                                    <div className="condition-item" key={`legend-${slice.label}`}>
                                      <span
                                        className="condition-dot"
                                        style={{ background: slice.color }}
                                      ></span>
                                      <span className="condition-label">{slice.label}</span>
                                      <span className="condition-value">
                                        {slice.value} ({slice.percent}%)
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="results-empty">No condition history for this location yet.</div>
                            )}
                          </article>
                        </div>
                      </>
                    ) : (
                      <div className="results-empty">No weather chart data yet.</div>
                    )}
                  </div>
                </div>
              </div>
                <div className="media-search-row">
                  <div className="search-field">
                    <label htmlFor="weather-search-input">Search locations</label>
                    <input
                      id="weather-search-input"
                      placeholder="City, country, or condition"
                      value={weatherSearch}
                      onChange={(e) => setWeatherSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          runWeatherSearch();
                        }
                      }}
                    />
                  </div>
                  <div className="search-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={runWeatherSearch}
                    >
                      Search
                    </button>
                    <button
                      type="button"
                      onClick={clearWeatherSearchState}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              {weatherHasSearched && (
                <section className="results weather-results">
                  <div className="results-header">
                    <div>
                      <h3>Weather results</h3>
                      <p className="muted">Search locations, then filter and sort updates below.</p>
                    </div>
                    <div className="results-meta">
                      <div className="update-chip">Updated {weatherUpdatedAt || "--"}</div>
                      <label className="toggle small">
                        <input
                          type="checkbox"
                          checked={settings.autoRefreshWeatherResults}
                          onChange={(e) =>
                            updateSetting("autoRefreshWeatherResults", e.target.checked)
                          }
                          disabled={!lastWeatherSearch}
                        />
                        <span className="toggle-track"></span>
                        <span className="toggle-label">Auto refresh</span>
                      </label>
                    </div>
                  </div>
                  <div className="results-layout">
                    <aside className="results-sidebar">
                      <details
                        className="results-filter-dropdown"
                        open={weatherFiltersExpanded}
                        onToggle={(event) => setWeatherFiltersExpanded(event.currentTarget.open)}
                      >
                        <summary>
                          <span>Filters &amp; sorting</span>
                          <span className="summary-meta">All</span>
                        </summary>
                        <div className="results-sidebar-card">
                          <h4>Filters &amp; sorting</h4>
                          <div className="field">
                            <label htmlFor="weather-sort-key">Sort by</label>
                            <select
                              id="weather-sort-key"
                              value={weatherSortKey}
                              onChange={(e) => setWeatherSortKey(e.target.value)}
                            >
                              <option value="weather_time">Observed time</option>
                              <option value="location_name">Location</option>
                              <option value="temperature">Temperature</option>
                              <option value="apparent_temperature">Feels like</option>
                            </select>
                          </div>
                          <div className="field">
                            <label htmlFor="weather-sort-dir">Order</label>
                            <select
                              id="weather-sort-dir"
                              value={weatherSortDir}
                              onChange={(e) => setWeatherSortDir(e.target.value)}
                            >
                              <option value="desc">Desc</option>
                              <option value="asc">Asc</option>
                            </select>
                          </div>
                          <div className="results-divider" />
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => {
                              setWeatherSortKey("weather_time");
                              setWeatherSortDir("desc");
                            }}
                          >
                            Reset sorting
                          </button>
                          <div className="results-count">
                            Showing {weatherGroups.length} location{weatherGroups.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </details>
                    </aside>
                    <div className="results-main">
              {weatherLoading ? (
                <div className="results-empty">Loading weather...</div>
              ) : weatherError ? (
                <div className="results-empty">{weatherError}</div>
              ) : weatherGroups.length > 0 ? (
                <div className="weather-groups">
                  {weatherGroups.map((group) => {
                    const latest = group.latest || {};
                    return (
                      <div key={group.key} className="weather-group">
                        <button
                          type="button"
                          className="weather-group-summary weather-group-button"
                          onClick={() => openWeatherTrend(group)}
                        >
                          <div className="weather-group-main">
                            <div className="weather-group-title">
                              <span className="weather-group-location">
                                {group.location_name || "Unknown location"}
                              </span>
                              <span className="weather-group-label">
                                {latest.weather_label || latest.source || "Weather"}
                              </span>
                            </div>
                            <div className="weather-group-meta">
                              Observed {formatTimestamp(latest.weather_time || latest.fetched_at) || "--"}
                            </div>
                          </div>
                          <div className="weather-group-stats">
                            <div className="weather-group-temp">
                              {latest.temperature ?? "--"}°
                            </div>
                            <div className="weather-group-count">
                              {group.rows.length} update{group.rows.length === 1 ? "" : "s"}
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : localWeatherCandidate ? (
                <div className="results-empty">No additional weather records found.</div>
              ) : (
                <div className="results-empty">No weather records found.</div>
              )}
                    </div>
                  </div>
                </section>
              )}
        </section>
          )}

        </section>

        {videoPopoutOpen && activeVideo && (
          <aside
            className={`floating-player floating-video-player${videoPopoutMinimized ? " minimized" : ""}`}
            role="complementary"
            aria-label="Popped out video player"
          >
            <div className="floating-player-head">
              <div className="floating-player-title">
                <strong>{activeVideo.title || "Video player"}</strong>
                <span>{activeVideo.source || activeVideo.provider || "Current Scope"}</span>
              </div>
              <div className="floating-player-head-actions">
                <button type="button" onClick={goPrevVideo} aria-label="Previous video">
                  <i className="fa-solid fa-backward-step" aria-hidden="true"></i>
                </button>
                <button type="button" onClick={goNextVideo} aria-label="Next video">
                  <i className="fa-solid fa-forward-step" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  onClick={() => toggleVideoPopoutMinimized()}
                  aria-label={videoPopoutMinimized ? "Expand video player" : "Minimize video player"}
                >
                  <i
                    className={`fa-solid ${videoPopoutMinimized ? "fa-plus" : "fa-minus"}`}
                    aria-hidden="true"
                  ></i>
                </button>
                <button type="button" onClick={() => toggleVideoPopout(false)} aria-label="Dock video player">
                  <i className="fa-solid fa-window-restore" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            <div className="floating-player-body">
              <MediaPlayer className="media-player-frame floating-player-frame">
                {renderVideoPlayerSurface(activeVideo, {
                  onEnded: settings.videoAutoRotate ? goNextVideo : null,
                })}
              </MediaPlayer>
            </div>
            <div className="floating-player-footer">
              {getVideoExternalUrl(activeVideo) ? (
                <button type="button" onClick={() => openExternal(getVideoExternalUrl(activeVideo))}>
                  Open source
                </button>
              ) : null}
              {activeTab !== "see" ? (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setActiveTab("see");
                    window.setTimeout(() => {
                      try {
                        mediaPlayerCardRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                      } catch (err) {
                        // ignore
                      }
                    }, 60);
                  }}
                >
                  Go to Watch
                </button>
              ) : null}
            </div>
          </aside>
        )}

        {radioPopoutOpen && activeRadio && (
          <aside
            className={`floating-player floating-radio-player${radioPopoutMinimized ? " minimized" : ""}`}
            role="complementary"
            aria-label="Popped out radio player"
            style={videoPopoutOpen ? { bottom: "380px" } : undefined}
          >
            <div className="floating-player-head">
              <div className="floating-player-title">
                <strong>{activeRadio.name || "Radio player"}</strong>
                <span>{activeRadio.country || activeRadio.country_code || activeRadio.provider || "Live station"}</span>
              </div>
              <div className="floating-player-head-actions">
                <button
                  type="button"
                  onClick={() => toggleRadioPopoutMinimized()}
                  aria-label={radioPopoutMinimized ? "Expand radio player" : "Minimize radio player"}
                >
                  <i
                    className={`fa-solid ${radioPopoutMinimized ? "fa-plus" : "fa-minus"}`}
                    aria-hidden="true"
                  ></i>
                </button>
                <button
                  type="button"
                  onClick={() => toggleRadioPopout(false)}
                  aria-label="Dock radio player"
                >
                  <i className="fa-solid fa-window-restore" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            <div className="floating-player-body">
              <div className="radio-player-body floating-radio-body">
                {renderRadioPlayback(activeRadio)}
                {activeRadio.tags ? (
                  <div className="radio-tags">
                    <span className="muted">Tags:</span> {activeRadio.tags}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="floating-player-footer">
              {activeRadio.homepage_url ? (
                <button type="button" onClick={() => openExternal(activeRadio.homepage_url)}>
                  Website
                </button>
              ) : null}
              {activeRadio.stream_url ? (
                <button type="button" onClick={() => openExternal(activeRadio.stream_url)}>
                  Stream URL
                </button>
              ) : null}
              {activeTab !== "hear" ? (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setActiveTab("hear");
                    window.setTimeout(() => {
                      try {
                        radioPlayerCardRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                      } catch (err) {
                        // ignore
                      }
                    }, 60);
                  }}
                >
                  Go to Listen
                </button>
              ) : null}
            </div>
          </aside>
        )}

        {weatherTrendOpen && weatherTrendGroup && (
          <div className="modal-overlay" onClick={closeWeatherTrend}>
            <div
              className="modal weather-trend-modal"
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeWeatherTrend}
              >
                X
              </button>
              <div className="read-only-header">
                <h2 className="modal-title">
                  {weatherTrendGroup.location_name || "Weather trend"}
                </h2>
                {weatherTrendRange ? (
                  <p className="muted">
                    {weatherTrendSeries.length} updates from{" "}
                    {formatTimestamp(new Date(weatherTrendRange.startTs))} to{" "}
                    {formatTimestamp(new Date(weatherTrendRange.endTs))}
                  </p>
                ) : (
                  <p className="muted">
                    {Array.isArray(weatherTrendGroup.rows)
                      ? `${weatherTrendGroup.rows.length} updates`
                      : "No updates"}
                  </p>
                )}
              </div>

              <div className="weather-trend-body">
                {weatherTrendRange && weatherTrendChart.path ? (
                  <div className="weather-trend-chart">
                    <div className="weather-trend-metrics">
                      <span className="metric-chip">
                        Min {Math.round(weatherTrendRange.min)}°
                      </span>
                      <span className="metric-chip">
                        Max {Math.round(weatherTrendRange.max)}°
                      </span>
                    </div>
                    <svg
                      viewBox={`0 0 ${weatherTrendChart.width} ${weatherTrendChart.height}`}
                      width="100%"
                      height={weatherTrendChart.height}
                      className="weather-trend-svg"
                      role="img"
                      aria-label="Temperature trend chart"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="tempLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
                          <stop offset="100%" stopColor="var(--accent-warm)" stopOpacity="0.95" />
                        </linearGradient>
                      </defs>
                      <path
                        d={weatherTrendChart.path}
                        fill="none"
                        stroke="url(#tempLine)"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {weatherTrendChart.points.map((point) => {
                        const isActive = weatherTrendFocusedPoint?.ts === point.ts;
                        return (
                          <circle
                            key={`weather-trend-point-${point.ts}`}
                            cx={point.x}
                            cy={point.y}
                            r={isActive ? 5.2 : 3.2}
                            fill={isActive ? "var(--accent-warm)" : "var(--accent)"}
                            stroke="var(--surface)"
                            strokeWidth={isActive ? 2 : 1}
                            className="weather-trend-dot"
                            role="button"
                            tabIndex={0}
                            onMouseEnter={() => setWeatherTrendPointTs(point.ts)}
                            onFocus={() => setWeatherTrendPointTs(point.ts)}
                            onClick={() => setWeatherTrendPointTs(point.ts)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setWeatherTrendPointTs(point.ts);
                              }
                            }}
                          />
                        );
                      })}
                    </svg>
                    <div className="weather-trend-axis">
                      <span>{formatTimestamp(new Date(weatherTrendRange.startTs))}</span>
                      <span>{formatTimestamp(new Date(weatherTrendRange.endTs))}</span>
                    </div>
                    {weatherTrendFocusedPoint ? (
                      <div className="weather-trend-focus">
                        <div className="weather-trend-focus-kpis">
                          <div className="weather-trend-focus-card">
                            <span>Observed</span>
                            <strong>
                              {formatTimestamp(
                                weatherTrendFocusedPoint.row?.weather_time ||
                                  weatherTrendFocusedPoint.row?.fetched_at
                              ) || "--"}
                            </strong>
                          </div>
                          <div className="weather-trend-focus-card">
                            <span>Temperature</span>
                            <strong>{weatherTrendFocusedPoint.row?.temperature ?? "--"}°</strong>
                          </div>
                          <div className="weather-trend-focus-card">
                            <span>Feels like</span>
                            <strong>
                              {weatherTrendFocusedPoint.row?.apparent_temperature ?? "--"}°
                            </strong>
                          </div>
                          <div className="weather-trend-focus-card">
                            <span>Condition</span>
                            <strong>
                              {weatherTrendFocusedPoint.row?.weather_label ||
                                weatherTrendFocusedPoint.row?.source ||
                                "--"}
                            </strong>
                          </div>
                        </div>
                        <div className="weather-trend-focus-bars">
                          <div className="weather-focus-bar">
                            <span>Humidity {weatherTrendFocusedPoint.row?.humidity ?? "--"}%</span>
                            <div className="weather-focus-track">
                              <div
                                className="weather-focus-fill humidity"
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      Number(weatherTrendFocusedPoint.row?.humidity) || 0
                                    )
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                          <div className="weather-focus-bar">
                            <span>Wind {weatherTrendFocusedPoint.row?.wind_speed ?? "--"}</span>
                            <div className="weather-focus-track">
                              <div
                                className="weather-focus-fill wind"
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      weatherTrendPeakWind
                                        ? ((Number(weatherTrendFocusedPoint.row?.wind_speed) || 0) /
                                            weatherTrendPeakWind) *
                                            100
                                        : 0
                                    )
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="results-empty">
                    Not enough temperature points to chart for this location.
                  </div>
                )}

                {weatherTrendSeries.length > 0 ? (
                  <div className="weather-history-grid weather-history-grid-modal">
                    {[...weatherTrendSeries]
                      .slice()
                      .reverse()
                      .map((point, idx) => {
                        const row = point.row || {};
                        return (
                          <div
                            key={
                              row.id ||
                              `${weatherTrendGroup.key}-${row.weather_time || row.fetched_at || idx}`
                            }
                            className={`weather-history-item weather-history-item-button${
                              weatherTrendFocusedPoint?.ts === point.ts ? " active" : ""
                            }`}
                            role="button"
                            tabIndex={0}
                            onClick={() => setWeatherTrendPointTs(point.ts)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setWeatherTrendPointTs(point.ts);
                              }
                            }}
                          >
                            <div className="weather-history-time">
                              {formatTimestamp(row.weather_time || row.fetched_at) || "--"}
                            </div>
                            <div className="weather-history-temp">
                              {row.temperature ?? "--"}°
                            </div>
                            <div className="weather-history-meta">
                              Feels {row.apparent_temperature ?? "--"}° • Hum {row.humidity ?? "--"}% • Wind{" "}
                              {row.wind_speed ?? "--"}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {videoModalOpen && videoModalVideo && (
          <div className="modal-overlay" onClick={closeVideoModal}>
            <div
              className="modal video-modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeVideoModal}
              >
                X
              </button>
              <div className="read-only-header">
                <h2 className="modal-title">{videoModalVideo.title || "Watch video"}</h2>
                {getVideoExternalUrl(videoModalVideo) && (
                  <a
                    className="read-only-source"
                    href={getVideoExternalUrl(videoModalVideo)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      if (isAppRuntime) {
                        event.preventDefault();
                        openExternal(getVideoExternalUrl(videoModalVideo));
                      }
                    }}
                  >
                    {getVideoExternalUrl(videoModalVideo)}
                  </a>
                )}
              </div>
              <div className="read-only-toolbar">
                <div className="read-only-actions">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSharePayload({
                        title: videoModalVideo.title || BRAND_NAME,
                        url: getVideoExternalUrl(videoModalVideo),
                      });
                    }}
                  >
                    Share
                  </button>
                  {getVideoExternalUrl(videoModalVideo) && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openExternal(getVideoExternalUrl(videoModalVideo));
                      }}
                    >
                      Open origin
                    </button>
                  )}
                </div>
              </div>
              <div className="video-modal-player">
                <MediaPlayer>
                  {renderVideoPlayerSurface(videoModalVideo, { autoPlay: true, muted: false })}
                </MediaPlayer>
              </div>
              <div className="video-modal-info">
                <p className="modal-description">
                  {stripHtml(videoModalVideo.description) || "No description available."}
                </p>
                <div className="result-meta">
                  {(videoModalVideo.source || "Unknown source") +
                    " • " +
                    (videoModalVideo.provider || "Unknown provider") +
                    " • " +
                    (videoModalVideo.published_at || videoModalVideo.publishedAt || "Unpublished")}
                </div>
              </div>
              <div className="modal-links">
                <button type="button" onClick={closeVideoModal}>
                  Back to videos
                </button>
                {getVideoExternalUrl(videoModalVideo) && (
                  <button
                    type="button"
                    onClick={() => openExternal(getVideoExternalUrl(videoModalVideo))}
                  >
                    Open source
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {readOnlyOpen && (
          <div className="modal-overlay" onClick={closeReadOnly}>
            <div
              className="modal read-only-modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeReadOnly}
              >
                X
              </button>
              <div className="read-only-header">
                <h2 className="modal-title">{readOnlyTitle || "Read-only"}</h2>
                {readOnlyUrl && (
                  <a
                    className="read-only-source"
                    href={readOnlyUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      if (isAppRuntime) {
                        event.preventDefault();
                        openExternal(readOnlyUrl);
                      }
                    }}
                  >
                    {readOnlyUrl}
                  </a>
                )}
              </div>
              <div className="read-only-toolbar">
                <div className="read-only-actions">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSharePayload({
                        title: readOnlyTitle || BRAND_NAME,
                        url: readOnlyUrl || "",
                      });
                    }}
                  >
                    Share
                  </button>
                  {readOnlyUrl && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openExternal(readOnlyUrl);
                      }}
                    >
                      Open origin
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      printReadOnly();
                    }}
                  >
                    Save PDF
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={!settings.readAloudEnabled}
                    title={
                      settings.readAloudEnabled
                        ? "Read this article aloud"
                        : "Enable read aloud in App menu > Read"
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      startReadOnlyReading();
                    }}
                  >
                    Read aloud
                  </button>
                </div>
                {readOnlyStatus && <div className="read-only-status">{readOnlyStatus}</div>}
              </div>
              {(readOnlySpeaking || readOnlyPaused) && (
                <div className="read-only-controls">
                  <button
                    type="button"
                    onClick={pauseReadOnlyReading}
                    disabled={!readOnlySpeaking || readOnlyPaused}
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={resumeReadOnlyReading}
                    disabled={!readOnlyPaused}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => stopReadOnlyReading("Reading stopped.")}
                  >
                    Stop
                  </button>
                </div>
              )}
              {readOnlyLoading ? (
                <div className="read-only-loading">Loading read-only view...</div>
              ) : readOnlyError ? (
                <div className="read-only-error">{readOnlyError}</div>
              ) : readOnlyHtml ? (
                <div
                  className="read-only-content"
                  ref={readOnlyContentRef}
                  dangerouslySetInnerHTML={{ __html: readOnlyHtml }}
                />
              ) : (
                <div className="read-only-error">No read-only content available.</div>
              )}
              <div className="modal-links">
                <button type="button" onClick={closeReadOnly}>
                  Back to results
                </button>
                {readOnlyUrl && (
                  <button type="button" onClick={() => openExternal(readOnlyUrl)}>
                    Open original
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {sharePayload && (
          <div className="modal-overlay" onClick={() => setSharePayload(null)}>
            <div
              className="modal share-modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => setSharePayload(null)}
              >
                X
              </button>
              <h2 className="modal-title">Share</h2>
              <p className="modal-description">{shareTitle}</p>
              <div className="share-options">
                {shareOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      openExternal(option.url);
                    }}
                    aria-label={option.label}
                  >
                    {option.icon && (
                      <i className={`share-icon ${option.icon}`} aria-hidden="true"></i>
                    )}
                    <span className="sr-only">{option.label}</span>
                  </button>
                ))}
              </div>
              <div className="modal-links">
                <button type="button" onClick={() => setSharePayload(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        {messageModal}
        {appMenuModal}
        {appSettingsModal}

        {showFeaturesModal && (
          <div className="modal-overlay" onClick={dismissFeaturesModal}>
            <div
              className="modal features-modal"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={dismissFeaturesModal}
              >
                X
              </button>
              <h2 className="modal-title">
                What&apos;s new in {BRAND_NAME} {APP_VERSION}
              </h2>
              <p className="modal-description">
                Here are the latest improvements since your last update:
              </p>
              <ul className="features-list">
                {FEATURES_NOTES.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <label className="features-optout">
                <input
                  type="checkbox"
                  checked={featuresOptOut}
                  onChange={(e) => setFeaturesOptOut(e.target.checked)}
                />
                <span>Don&apos;t show this again</span>
              </label>
              <div className="features-actions">
                <button type="button" onClick={dismissFeaturesModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="site-footer">
          <div className="footer-grid">
            <div className="footer-block">
              <div className="footer-title">NewsApp</div>
              <p className="footer-text">© {currentYear} {BRAND_NAME}. All rights reserved.</p>
              <p className="footer-text">Designed by Mycstro.</p>
              <p className="footer-text">Powered by Mycstro's PlayGround.</p>
            </div>
            <div className="footer-block">
              <div className="footer-title">Legal</div>
              <ul className="footer-list">
                <li>NewsApp aggregates publicly available headlines and metadata.</li>
                <li>Content remains the property of its original publishers.</li>
                <li>Use of this site implies acceptance of applicable terms and policies.</li>
                <li>This service is provided "as is" for informational purposes only.</li>
                <li>
                  <a className="footer-link" href="/terms.html">Terms &amp; Conditions</a>
                </li>
              </ul>
            </div>
          </div>
        </footer>
        {cookieBanner}
      </div>
    </div>
  );
}
