import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";


const YT_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
const YT_IFRAME_API_ID = "newsapp-yt-iframe-api";
const YT_EMBED_HOST = "https://www.youtube-nocookie.com";
const BLOCKED_EMBED_CODES = new Set([101, 150, 153]);
const HANDLED_ERROR_CODES = new Set([2, 100, 101, 150, 153]);
let ytApiLoadPromise = null;

function isHttpProtocol(protocol) {
  return protocol === "http:" || protocol === "https:";
}

function devLog(eventName, payload = {}) {
  if (!import.meta.env.DEV) return;
  try {
    // eslint-disable-next-line no-console
    console.info(`[YouTubePlayer] ${eventName}`, payload);
  } catch (err) {
    // Ignore logging failures.
  }
}

function resolveYouTubeOrigin() {
  if (typeof window === "undefined") return "";
  const protocol = window.location?.protocol || "";
  if (!isHttpProtocol(protocol)) return "";

  const envOrigin = String(import.meta.env.VITE_YT_ORIGIN || "").trim();
  if (envOrigin) {
    try {
      const parsed = new URL(envOrigin);
      if (isHttpProtocol(parsed.protocol)) {
        return parsed.origin;
      }
    } catch (err) {
      devLog("invalid_origin_override", { envOrigin });
    }
  }

  return window.location?.origin || "";
}

function loadYouTubeIframeApi(timeoutMs = 12000) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window_unavailable"));
  }
  if (window.YT && typeof window.YT.Player === "function") {
    return Promise.resolve(window.YT);
  }
  if (ytApiLoadPromise) {
    return ytApiLoadPromise;
  }

  ytApiLoadPromise = new Promise((resolve, reject) => {
    let settled = false;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      handler(value);
    };

    const ready = () => {
      if (window.YT && typeof window.YT.Player === "function") {
        finish(resolve, window.YT);
        return;
      }
      finish(reject, new Error("yt_player_unavailable"));
    };

    const onError = () => {
      finish(reject, new Error("yt_api_script_error"));
    };

    const timeoutId = window.setTimeout(() => {
      finish(reject, new Error("yt_api_timeout"));
    }, timeoutMs);

    const safeFinish = (handler) => (value) => {
      window.clearTimeout(timeoutId);
      handler(value);
    };

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        if (typeof previousReady === "function") {
          previousReady();
        }
      } catch (err) {
        // Ignore chained callback failures.
      }
      ready();
    };

    let script = document.getElementById(YT_IFRAME_API_ID);
    if (!script) {
      script = document.createElement("script");
      script.id = YT_IFRAME_API_ID;
      script.src = YT_IFRAME_API_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("error", onError, { once: true });
      document.body.appendChild(script);
    } else {
      script.addEventListener("error", onError, { once: true });
    }

    if (window.YT && typeof window.YT.Player === "function") {
      window.clearTimeout(timeoutId);
      finish(resolve, window.YT);
      return;
    }

    const baseResolve = resolve;
    const baseReject = reject;
    resolve = safeFinish(baseResolve);
    reject = safeFinish(baseReject);
  }).catch((error) => {
    ytApiLoadPromise = null;
    throw error;
  });

  return ytApiLoadPromise;
}

function mapPlayerError(code) {
  const numericCode = Number(code);
  if (!HANDLED_ERROR_CODES.has(numericCode)) {
    return { code: numericCode, reason: "playback_error", blocked: false };
  }
  if (BLOCKED_EMBED_CODES.has(numericCode)) {
    return { code: numericCode, reason: "embed_blocked", blocked: true };
  }
  if (numericCode === 100) {
    return { code: numericCode, reason: "video_unavailable", blocked: false };
  }
  if (numericCode === 2) {
    return { code: numericCode, reason: "invalid_video", blocked: false };
  }
  return { code: numericCode, reason: "playback_error", blocked: false };
}

function errorCopy(reason) {
  switch (reason) {
    case "unsupported_protocol":
      return "Inline playback is unavailable in this runtime protocol.";
    case "embed_blocked":
      return "The publisher disabled inline embedding for this video.";
    case "video_unavailable":
      return "This video is unavailable or has been removed.";
    case "invalid_video":
      return "This video identifier is invalid.";
    case "api_load_timeout":
      return "Timed out loading the YouTube player.";
    case "api_load_failed":
      return "Unable to load the YouTube player.";
    default:
      return "Inline playback is unavailable for this source.";
  }
}

export default function YouTubePlayer({
  videoId,
  title = "",
  sourceUrl = "",
  thumbnail = "",
  onEnded = null,
  openExternal = null,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const onEndedRef = useRef(onEnded);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [started, setStarted] = useState(false);

  const protocol = typeof window !== "undefined" ? window.location?.protocol || "" : "";
  const origin = useMemo(() => resolveYouTubeOrigin(), []);
  const isHttp = isHttpProtocol(protocol);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const destroyPlayer = useCallback(() => {
    const instance = playerRef.current;
    if (!instance || typeof instance.destroy !== "function") return;
    try {
      instance.destroy();
    } catch (err) {
      // Ignore destroy errors.
    }
    playerRef.current = null;
  }, []);

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

  useEffect(() => {
    destroyPlayer();
    setReady(false);
    setError("");
    setErrorCode(0);
    setBlocked(false);
    setStarted(false);

    if (!videoId) {
      setError("invalid_video");
      return undefined;
    }

    if (!isHttp) {
      setError("unsupported_protocol");
      devLog("unsupported_protocol", {
        protocol,
        origin: typeof window !== "undefined" ? window.location?.origin || "" : "",
        host: YT_EMBED_HOST,
        videoId,
      });
      return undefined;
    }

    let cancelled = false;

    devLog("init", {
      protocol,
      origin: typeof window !== "undefined" ? window.location?.origin || "" : "",
      host: YT_EMBED_HOST,
      videoId,
      playerOrigin: origin,
    });

    loadYouTubeIframeApi(12000)
      .then(() => {
        if (cancelled || !containerRef.current || !window.YT?.Player) return;
        destroyPlayer();
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId,
          host: YT_EMBED_HOST,
          playerVars: {
            autoplay: 0,
            mute: 0,
            playsinline: 1,
            enablejsapi: 1,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            origin: origin || undefined,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              setError("");
              setErrorCode(0);
              setBlocked(false);
              setStarted(false);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event?.data === window.YT?.PlayerState?.PLAYING) {
                setStarted(true);
              }
              if (event?.data === window.YT?.PlayerState?.ENDED) {
                setStarted(false);
                if (typeof onEndedRef.current === "function") {
                  onEndedRef.current();
                }
              }
            },
            onError: (event) => {
              if (cancelled) return;
              const mapped = mapPlayerError(event?.data);
              setError(mapped.reason);
              setErrorCode(mapped.code);
              setBlocked(mapped.blocked);
              setReady(false);
              setStarted(false);
              if (mapped.blocked) {
                destroyPlayer();
              }
              devLog("player_error", {
                protocol,
                origin: typeof window !== "undefined" ? window.location?.origin || "" : "",
                host: YT_EMBED_HOST,
                videoId,
                code: mapped.code,
              });
            },
          },
        });
      })
      .catch((loadError) => {
        if (cancelled) return;
        const code = String(loadError?.message || "").includes("timeout")
          ? "api_load_timeout"
          : "api_load_failed";
        setError(code);
        setReady(false);
        setStarted(false);
        devLog("api_load_error", {
          protocol,
          origin: typeof window !== "undefined" ? window.location?.origin || "" : "",
          host: YT_EMBED_HOST,
          videoId,
          error: String(loadError?.message || loadError || "unknown"),
        });
      });

    return () => {
      cancelled = true;
      destroyPlayer();
    };
  }, [videoId, retryTick, isHttp, origin, destroyPlayer, protocol]);

  const youtubeUrl = useMemo(
    () => sourceUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ""),
    [sourceUrl, videoId]
  );

  const onPlayClick = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (typeof player.unMute === "function") {
        player.unMute();
      }
      if (typeof player.playVideo === "function") {
        player.playVideo();
      }
      setStarted(true);
      devLog("play_click", {
        protocol,
        origin: typeof window !== "undefined" ? window.location?.origin || "" : "",
        host: YT_EMBED_HOST,
        videoId,
      });
    } catch (err) {
      setError("playback_error");
      setStarted(false);
      devLog("play_click_error", {
        protocol,
        origin: typeof window !== "undefined" ? window.location?.origin || "" : "",
        host: YT_EMBED_HOST,
        videoId,
        error: String(err?.message || err || "unknown"),
      });
    }
  };

  const canRetryInline = Boolean(error) && !blocked && error !== "unsupported_protocol";

  if (error) {
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
              {youtubeUrl ? (
                <button type="button" className="primary" onClick={() => openExternalSafe(youtubeUrl)}>
                  Open on YouTube
                </button>
              ) : null}
              {youtubeUrl ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(youtubeUrl);
                    } catch (err) {
                      // ignore clipboard errors
                    }
                  }}
                >
                  Copy link
                </button>
              ) : null}
              {canRetryInline ? (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setErrorCode(0);
                    setBlocked(false);
                    setRetryTick((value) => value + 1);
                  }}
                >
                  Retry inline
                </button>
              ) : null}
            </div>
            <div className="media-player-fallback-note">
              {errorCopy(error)}
              {errorCode ? ` (Error ${errorCode})` : ""}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="youtube-player-shell">
      <div className="youtube-player-host" ref={containerRef} />
      {!ready ? (
        <div className="media-player-loading">Loading video...</div>
      ) : (
        <div className={`youtube-player-overlay${started ? " hidden" : ""}`}>
          <div className="youtube-player-overlay-card">
            <strong>Ready to play</strong>
            <div className="youtube-player-overlay-actions">
              <button type="button" className="primary" onClick={onPlayClick}>
                Play
              </button>
              {youtubeUrl ? (
                <button type="button" onClick={() => openExternalSafe(youtubeUrl)}>
                  Open on YouTube
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
