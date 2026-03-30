import { extractYouTubeVideoId } from "../youtube.mjs";

export function getVideoThumb(video) {
  if (!video) return "";
  return video.thumbnail_url || video.thumbnailUrl || "";
}

export function toUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch (err) {
    try {
      return new URL(`https://${raw}`);
    } catch (nestedError) {
      return null;
    }
  }
}

export function isYouTubeStreamUrl(value) {
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

export function extractDailymotionVideoId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const cleanCandidate = (candidate) => {
    const text = String(candidate || "")
      .trim()
      .split("?", 1)[0]
      .split("#", 1)[0]
      .split("_", 1)[0];
    return /^[A-Za-z0-9]+$/.test(text) ? text : "";
  };

  const parsed = toUrl(raw);
  if (!parsed) {
    return cleanCandidate(raw);
  }

  const host = String(parsed.hostname || "").toLowerCase();
  const segments = String(parsed.pathname || "")
    .split("/")
    .filter(Boolean);

  if (host === "dai.ly" || host.endsWith(".dai.ly")) {
    return cleanCandidate(segments[0] || "");
  }
  if (!host.includes("dailymotion.com")) {
    return "";
  }
  if (segments[0] === "video") {
    return cleanCandidate(segments[1] || "");
  }
  if (segments[0] === "embed" && segments[1] === "video") {
    return cleanCandidate(segments[2] || "");
  }
  return cleanCandidate(parsed.searchParams.get("video") || "");
}

export function isHttpMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  return /^https?:\/\//i.test(raw);
}

export function normalizeProviderName(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw.includes("YOUTUBE")) return "YOUTUBE";
  if (raw.includes("DAILYMOTION")) return "DAILYMOTION";
  if (raw.includes("CBS")) return "CBS";
  return raw;
}

export function getVideoUrlCandidates(video) {
  if (!video || typeof video !== "object") return [];
  const candidates = [
    video.url,
    video.video_url,
    video.videoUrl,
    video.source_url,
    video.sourceUrl,
    video.watch_url,
    video.watchUrl,
    video.embed_url,
    video.embedUrl,
    video.playback_url,
    video.playbackUrl,
    video.stream_url,
    video.streamUrl,
    video.hls_url,
    video.hlsUrl,
  ];
  const seen = new Set();
  return candidates.filter((candidate) => {
    const value = String(candidate || "").trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function cleanProviderVideoId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw
    .split("?", 1)[0]
    .split("#", 1)[0]
    .split("/", 1)[0];
  return /^[A-Za-z0-9_-]+$/.test(cleaned) ? cleaned : "";
}

function getRawProviderVideoId(value, providerName = "") {
  const cleaned = cleanProviderVideoId(value);
  if (!cleaned) return "";
  const provider = normalizeProviderName(providerName);
  if (provider === "YOUTUBE") {
    return /^[A-Za-z0-9_-]{11}$/.test(cleaned) ? cleaned : "";
  }
  if (provider === "DAILYMOTION") {
    return /^[A-Za-z0-9]{6,}$/.test(cleaned) && /[A-Za-z]/.test(cleaned) ? cleaned : "";
  }
  return cleaned;
}

function resolveProviderVideoId(value, extractor, providerName = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const extracted = typeof extractor === "function" ? extractor(raw) : "";
  if (extracted) return extracted;
  return getRawProviderVideoId(raw, providerName);
}

export function looksLikeDirectMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || !isHttpMediaUrl(raw)) return false;
  const lower = raw.toLowerCase();
  if (isYouTubeStreamUrl(raw)) return true;
  if (extractYouTubeVideoId(raw) || extractDailymotionVideoId(raw)) {
    return false;
  }
  const parsed = toUrl(raw);
  const pathname = String(parsed?.pathname || "").toLowerCase();
  return /\.(mp4|m3u8|webm|ogg)(?:$|[?#])/i.test(pathname || lower);
}

export function getVideoProvider(video) {
  if (!video || typeof video !== "object") return "";
  const explicitProvider = normalizeProviderName(video.provider);
  if (explicitProvider) return explicitProvider;
  const candidates = getVideoUrlCandidates(video);
  for (const candidate of candidates) {
    if (extractYouTubeVideoId(candidate)) return "YOUTUBE";
    if (extractDailymotionVideoId(candidate)) return "DAILYMOTION";
  }
  if (
    looksLikeDirectMediaUrl(video?.url) ||
    looksLikeDirectMediaUrl(video?.video_url) ||
    looksLikeDirectMediaUrl(video?.videoUrl)
  ) {
    return "DIRECT";
  }
  return "";
}

export function getProviderVideoId(video, providerName = "") {
  if (!video || typeof video !== "object") return "";
  const provider = normalizeProviderName(providerName || getVideoProvider(video));
  const idCandidates = [video.id, video.video_id, video.videoId];
  const extractor =
    provider === "YOUTUBE"
      ? extractYouTubeVideoId
      : provider === "DAILYMOTION"
        ? extractDailymotionVideoId
        : null;
  const preferredIdCandidates = [video.video_id, video.videoId];

  for (const candidate of preferredIdCandidates) {
    const nextId = resolveProviderVideoId(candidate, extractor, provider);
    if (nextId) return nextId;
  }

  const urlCandidates = getVideoUrlCandidates(video);
  for (const candidate of urlCandidates) {
    const nextId = resolveProviderVideoId(candidate, extractor, provider);
    if (nextId) return nextId;
  }

  for (const candidate of idCandidates) {
    const nextId = resolveProviderVideoId(candidate, extractor, provider);
    if (nextId) return nextId;
  }

  return "";
}

export function getEmbedUrl(video) {
  if (!video || typeof video !== "object") return null;
  const provider = getVideoProvider(video);
  if (provider === "YOUTUBE") {
    const videoId = getProviderVideoId(video, provider);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  }
  if (provider === "DAILYMOTION") {
    const videoId = getProviderVideoId(video, provider);
    return videoId ? `https://www.dailymotion.com/embed/video/${videoId}` : null;
  }
  return null;
}

export function getCanonicalUrl(video) {
  if (!video || typeof video !== "object") return null;
  const provider = getVideoProvider(video);
  if (provider === "YOUTUBE") {
    const videoId = getProviderVideoId(video, provider);
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
  }
  if (provider === "DAILYMOTION") {
    const videoId = getProviderVideoId(video, provider);
    return videoId ? `https://www.dailymotion.com/video/${videoId}` : null;
  }
  const sourceUrl = String(video.url || video.source_url || video.sourceUrl || "").trim();
  if (!sourceUrl || !isHttpMediaUrl(sourceUrl)) return null;
  if (provider === "CBS") return sourceUrl;
  if (looksLikeDirectMediaUrl(sourceUrl)) return sourceUrl;
  return sourceUrl;
}

export function getDirectMediaUrl(video) {
  if (!video || typeof video !== "object") return null;
  const provider = getVideoProvider(video);
  const candidates = getVideoUrlCandidates(video);
  const primaryUrl = String(video.url || video.source_url || video.sourceUrl || "").trim();
  if (provider === "CBS") {
    if (isHttpMediaUrl(primaryUrl)) return primaryUrl;
    for (const candidate of candidates) {
      if (isHttpMediaUrl(candidate)) return candidate;
    }
    return null;
  }
  if (looksLikeDirectMediaUrl(primaryUrl)) return primaryUrl;
  for (const candidate of candidates) {
    if (looksLikeDirectMediaUrl(candidate)) return candidate;
  }
  return null;
}

export function getVideoExternalUrl(video) {
  return getCanonicalUrl(video) || "";
}

export function isResolvableRemoteVideo(video) {
  return Boolean(getEmbedUrl(video) || getDirectMediaUrl(video));
}
