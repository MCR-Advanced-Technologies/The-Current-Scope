import { useEffect, useMemo, useState } from "react";

import { fetchVideoPlayback } from "../api";

const playbackCache = new Map();
const inflightRequests = new Map();

function normalizeSourceUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).toString();
  } catch (err) {
    return "";
  }
}

function parseExpiry(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const stamp = Date.parse(raw);
  return Number.isFinite(stamp) ? stamp : 0;
}

function normalizePlaybackResponse(response) {
  const payload = response && typeof response === "object" ? response : {};
  const playbackUrl = String(payload.playback_url || "").trim();
  const expiresAt = parseExpiry(payload.expires_at);
  return {
    playable: Boolean(payload.playable && playbackUrl),
    playbackUrl,
    mimeType: String(payload.mime_type || "").trim(),
    provider: String(payload.provider || "").trim(),
    reason: String(payload.reason || "").trim(),
    expiresAt,
    watchUrl: String(payload.watch_url || "").trim(),
    embedUrl: String(payload.embed_url || "").trim(),
  };
}

function getCachedPlayback(cacheKey) {
  const cached = playbackCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt && cached.expiresAt <= Date.now()) {
    playbackCache.delete(cacheKey);
    return null;
  }
  return cached;
}

function putCachedPlayback(cacheKey, playback) {
  if (!cacheKey || !playback) return playback;
  const expiresAt =
    playback.expiresAt ||
    Date.now() + (playback.playable && playback.playbackUrl ? 5 * 60 * 1000 : 60 * 1000);
  const nextValue = {
    ...playback,
    expiresAt,
  };
  playbackCache.set(cacheKey, nextValue);
  return nextValue;
}

async function loadResolvedPlayback(cacheKey, sourceUrl) {
  const cached = getCachedPlayback(cacheKey);
  if (cached) return cached;

  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }

  const pending = fetchVideoPlayback(sourceUrl)
    .then((response) => putCachedPlayback(cacheKey, normalizePlaybackResponse(response)))
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, pending);
  return pending;
}

export default function useResolvedVideoPlayback({ sourceUrl = "", active = true }) {
  const normalizedSourceUrl = useMemo(() => normalizeSourceUrl(sourceUrl), [sourceUrl]);
  const cacheKey = useMemo(() => normalizedSourceUrl, [normalizedSourceUrl]);
  const [playback, setPlayback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPlayback(null);
    setLoading(false);
    setError("");
  }, [cacheKey]);

  useEffect(() => {
    if (!active || !cacheKey) return undefined;

    const cached = getCachedPlayback(cacheKey);
    if (cached) {
      setPlayback(cached);
      setLoading(false);
      setError("");
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    loadResolvedPlayback(cacheKey, normalizedSourceUrl)
      .then((nextPlayback) => {
        if (cancelled) return;
        setPlayback(nextPlayback);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Unable to resolve inline playback.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active, cacheKey, normalizedSourceUrl]);

  return {
    playback,
    loading,
    error,
    playable: Boolean(playback?.playable && playback?.playbackUrl),
    playbackUrl: playback?.playbackUrl || "",
    mimeType: playback?.mimeType || "",
    provider: playback?.provider || "",
    reason: playback?.reason || "",
  };
}
