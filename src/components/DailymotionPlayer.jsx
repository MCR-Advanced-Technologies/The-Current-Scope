import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DAILYMOTION_PLAYER_ID = String(import.meta.env.VITE_DAILYMOTION_PLAYER_ID || "").trim();
const DAILYMOTION_PLAYER_LIB_ID = "newsapp-dailymotion-player-lib";
const DAILYMOTION_PLAYER_LIB_SRC = DAILYMOTION_PLAYER_ID
  ? `https://geo.dailymotion.com/libs/player/${DAILYMOTION_PLAYER_ID}.js`
  : "";
let dailymotionApiLoadPromise = null;

function errorCopy(reason) {
  switch (reason) {
    case "invalid_video":
      return "This Dailymotion video identifier is invalid.";
    case "missing_player_id":
      return "Timed playback sync is unavailable for Dailymotion until a player configuration is provided.";
    case "embed_timeout":
      return "Timed out loading the Dailymotion player.";
    case "embed_failed":
      return "Unable to load the Dailymotion player.";
    default:
      return "Inline playback is unavailable for this source.";
  }
}

function loadDailymotionPlayerLibrary(timeoutMs = 12000) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window_unavailable"));
  }
  if (!DAILYMOTION_PLAYER_ID) {
    return Promise.reject(new Error("missing_player_id"));
  }
  if (window.dailymotion && typeof window.dailymotion.createPlayer === "function") {
    return Promise.resolve(window.dailymotion);
  }
  if (dailymotionApiLoadPromise) {
    return dailymotionApiLoadPromise;
  }

  dailymotionApiLoadPromise = new Promise((resolve, reject) => {
    let pollId = 0;
    let timeoutId = 0;
    const finish = (handler, value) => {
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
      handler(value);
    };

    const onError = () => {
      finish(reject, new Error("embed_failed"));
    };

    let script = document.getElementById(DAILYMOTION_PLAYER_LIB_ID);
    if (!script) {
      script = document.createElement("script");
      script.id = DAILYMOTION_PLAYER_LIB_ID;
      script.src = DAILYMOTION_PLAYER_LIB_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("error", onError, { once: true });
      document.body.appendChild(script);
    } else {
      script.addEventListener("error", onError, { once: true });
    }

    pollId = window.setInterval(() => {
      if (window.dailymotion && typeof window.dailymotion.createPlayer === "function") {
        finish(resolve, window.dailymotion);
      }
    }, 100);

    timeoutId = window.setTimeout(() => {
      finish(reject, new Error("embed_timeout"));
    }, timeoutMs);
  }).catch((error) => {
    dailymotionApiLoadPromise = null;
    throw error;
  });

  return dailymotionApiLoadPromise;
}

export default function DailymotionPlayer({
  videoId,
  title = "",
  sourceUrl = "",
  thumbnail = "",
  openExternal = null,
  autoPlay = true,
  muted = true,
  onEnded = null,
  onTimeChange = null,
  onPlaybackStateChange = null,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const onEndedRef = useRef(onEnded);
  const onTimeChangeRef = useRef(onTimeChange);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  const lastPlaybackRef = useRef({ isPlaying: false, ended: false });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const [sdkReady, setSdkReady] = useState(Boolean(DAILYMOTION_PLAYER_ID));

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    onTimeChangeRef.current = onTimeChange;
  }, [onTimeChange]);

  useEffect(() => {
    onPlaybackStateChangeRef.current = onPlaybackStateChange;
  }, [onPlaybackStateChange]);

  const openExternalSafe = useCallback(
    (url) => {
      if (!url) return;
      if (typeof openExternal === "function") {
        openExternal(url);
        return;
      }
      if (typeof window === "undefined") return;
      const opened = window.open(url, "_blank", "noopener");
      if (!opened) {
        window.location.href = url;
      }
    },
    [openExternal]
  );

  const destroyPlayer = useCallback(() => {
    const instance = playerRef.current;
    playerRef.current = null;
    if (instance && typeof instance.delete === "function") {
      try {
        instance.delete();
      } catch (err) {
        // Ignore teardown issues.
      }
    }
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }
  }, []);

  const dailymotionUrl = useMemo(
    () => sourceUrl || (videoId ? `https://www.dailymotion.com/video/${videoId}` : ""),
    [sourceUrl, videoId]
  );

  const fallbackEmbedUrl = useMemo(() => {
    if (!videoId) return "";
    const base = "https://geo.dailymotion.com/player.html";
    const url = new URL(base);
    url.searchParams.set("video", videoId);
    if (autoPlay) {
      url.searchParams.set("autoplay", "1");
    }
    if (muted) {
      url.searchParams.set("mute", "1");
    }
    url.searchParams.set("queue-enable", "0");
    url.searchParams.set("ui-start-screen-info", "0");
    return url.toString();
  }, [autoPlay, muted, videoId]);

  const publishState = useCallback(async () => {
    const player = playerRef.current;
    if (!player || typeof player.getState !== "function") {
      onPlaybackStateChangeRef.current?.({
        provider: "dailymotion",
        syncSupported: false,
        currentTime: 0,
      });
      return;
    }

    try {
      const state = await player.getState();
      const currentTime = Number(state?.videoTime || 0);
      const duration = Number(state?.videoDuration || 0);
      const isPlaying = Boolean(state?.playerIsPlaying);

      onTimeChangeRef.current?.(currentTime);
      onPlaybackStateChangeRef.current?.({
        provider: "dailymotion",
        syncSupported: true,
        currentTime,
        duration,
        isPlaying,
      });

      if (
        duration > 0 &&
        currentTime >= duration - 0.25 &&
        lastPlaybackRef.current.isPlaying &&
        !isPlaying &&
        !lastPlaybackRef.current.ended
      ) {
        lastPlaybackRef.current.ended = true;
        onEndedRef.current?.();
      }

      if (isPlaying) {
        lastPlaybackRef.current.ended = false;
      }
      lastPlaybackRef.current.isPlaying = isPlaying;
    } catch (err) {
      // Ignore transient state polling failures.
    }
  }, []);

  useEffect(() => {
    destroyPlayer();
    setReady(false);
    setError("");
    setSdkReady(Boolean(DAILYMOTION_PLAYER_ID));
    lastPlaybackRef.current = { isPlaying: false, ended: false };

    if (!videoId) {
      setError("invalid_video");
      return undefined;
    }

    if (!DAILYMOTION_PLAYER_ID) {
      onPlaybackStateChangeRef.current?.({
        provider: "dailymotion",
        syncSupported: false,
        currentTime: 0,
      });
      setSdkReady(false);
      return undefined;
    }

    let cancelled = false;

    loadDailymotionPlayerLibrary(12000)
      .then((sdk) => {
        if (cancelled || !containerRef.current || typeof sdk.createPlayer !== "function") return null;
        return sdk.createPlayer(containerRef.current, {
          video: videoId,
          params: {
            autoplay: autoPlay ? 1 : 0,
            mute: muted ? 1 : 0,
            controls: 1,
            "queue-enable": 0,
            "ui-start-screen-info": 0,
          },
        });
      })
      .then((player) => {
        if (cancelled || !player) return;
        playerRef.current = player;
        setReady(true);
        setSdkReady(true);
        setError("");
        publishState();
      })
      .catch((loadError) => {
        if (cancelled) return;
        const code = String(loadError?.message || "embed_failed");
        setError(code);
        setSdkReady(false);
        onPlaybackStateChangeRef.current?.({
          provider: "dailymotion",
          syncSupported: false,
          currentTime: 0,
        });
      });

    return () => {
      cancelled = true;
      destroyPlayer();
    };
  }, [autoPlay, destroyPlayer, muted, publishState, retryTick, videoId]);

  useEffect(() => {
    if (!ready || !playerRef.current) return undefined;
    publishState();
    const intervalId = window.setInterval(() => {
      publishState();
    }, 350);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [publishState, ready, retryTick, videoId]);

  if (error && error !== "missing_player_id") {
    return (
      <div className="media-player-fallback" role="group" aria-label="Video fallback">
        <div className="media-player-fallback-card">
          <div className="media-player-fallback-thumb">
            {thumbnail ? <img src={thumbnail} alt={title || "Video thumbnail"} /> : null}
          </div>
          <div className="media-player-fallback-body">
            <h5 className="media-player-fallback-title">
              {title || "Video unavailable for inline playback"}
            </h5>
            <div className="media-player-fallback-actions">
              {dailymotionUrl ? (
                <button type="button" className="primary" onClick={() => openExternalSafe(dailymotionUrl)}>
                  Open on Dailymotion
                </button>
              ) : null}
              {videoId ? (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setReady(false);
                    setRetryTick((value) => value + 1);
                  }}
                >
                  Retry inline
                </button>
              ) : null}
            </div>
            <div className="media-player-fallback-note">{errorCopy(error)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="youtube-player-shell">
      {sdkReady ? <div className="youtube-player-host" ref={containerRef} /> : null}
      {!sdkReady ? (
        <div className="youtube-player-host">
          <iframe
            key={`${videoId}:${retryTick}`}
            src={fallbackEmbedUrl}
            title={title || "Dailymotion video"}
            allow="autoplay; fullscreen; encrypted-media; web-share"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => {
              setReady(true);
              setError("");
              onPlaybackStateChangeRef.current?.({
                provider: "dailymotion",
                syncSupported: false,
                currentTime: 0,
              });
            }}
            onError={() => {
              setReady(false);
              setError("embed_failed");
            }}
          />
        </div>
      ) : null}
      {!ready ? <div className="media-player-loading">Loading video...</div> : null}
    </div>
  );
}
