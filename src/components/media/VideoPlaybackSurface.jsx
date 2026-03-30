import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import MediaPlayer from "../MediaPlayer";
import YouTubePlayer from "../YouTubePlayer";
import DailymotionPlayer from "../DailymotionPlayer";
import CaptionOverlay from "../captions/CaptionOverlay";
import CaptionTrackControls from "../captions/CaptionTrackControls";
import useResolvedVideoPlayback from "../../hooks/useResolvedVideoPlayback";
import {
  getCanonicalUrl,
  getDirectMediaUrl,
  getProviderVideoId,
  getVideoProvider,
  getVideoThumb,
} from "../../media/videoPlaybackUtils";

const HAS_DAILYMOTION_PLAYER_ID = Boolean(
  String(import.meta.env.VITE_DAILYMOTION_PLAYER_ID || "").trim()
);

function openExternalFallback(url, openExternal) {
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
}

function syncUnsupportedMessage(provider, reason = "") {
  if (provider === "DAILYMOTION") {
    if (reason === "stream_unavailable") {
      return "Timed captions are unavailable because this Dailymotion video does not expose a compatible inline stream.";
    }
    if (reason === "resolver_failed") {
      return "Timed captions are unavailable because the Dailymotion stream could not be prepared for inline playback.";
    }
    return "Timed captions are unavailable for this Dailymotion source right now.";
  }
  return "";
}

function renderUnavailableCard({ canonicalUrl, openExternal, title, note, thumbnail, providerLabel }) {
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
            {canonicalUrl ? (
              <button type="button" className="primary" onClick={() => openExternalFallback(canonicalUrl, openExternal)}>
                {providerLabel ? `Open on ${providerLabel}` : "Open source"}
              </button>
            ) : null}
          </div>
          <div className="media-player-fallback-note">{note}</div>
        </div>
      </div>
    </div>
  );
}

export default function VideoPlaybackSurface({
  video,
  onEnded = null,
  openExternal = null,
  autoPlay = true,
  muted = true,
  captionState = null,
  targetLanguage = "",
  targetLanguageLabel = "",
  showCaptionPanel = true,
  playerClassName = "media-player-frame",
}) {
  const nativePlayerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [nativePlaybackFailed, setNativePlaybackFailed] = useState(false);
  const [syncSupported, setSyncSupported] = useState(true);
  const provider = getVideoProvider(video);
  const videoId = getProviderVideoId(video, provider);
  const directMediaUrl = getDirectMediaUrl(video);
  const canonicalUrl = getCanonicalUrl(video);
  const thumbnail = getVideoThumb(video);
  const shouldResolvePlayback =
    provider === "DAILYMOTION" && !directMediaUrl && Boolean(canonicalUrl);
  const resolvedPlayback = useResolvedVideoPlayback({
    sourceUrl: canonicalUrl,
    active: shouldResolvePlayback,
  });
  const effectiveDirectMediaUrl = directMediaUrl || resolvedPlayback.playbackUrl;

  useEffect(() => {
    setCurrentTime(0);
    setNativePlaybackFailed(false);
    setSyncSupported(
      provider !== "DAILYMOTION" ||
        HAS_DAILYMOTION_PLAYER_ID ||
        Boolean(effectiveDirectMediaUrl)
    );
  }, [
    effectiveDirectMediaUrl,
    provider,
    video?.id,
    video?.video_id,
    video?.videoId,
    video?.url,
  ]);

  useEffect(() => {
    if (!autoPlay || !effectiveDirectMediaUrl || nativePlaybackFailed) return;
    const node = nativePlayerRef.current;
    if (!node || typeof node.play !== "function") return;
    const attempt = node.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        // Ignore autoplay restrictions.
      });
    }
  }, [autoPlay, effectiveDirectMediaUrl, nativePlaybackFailed]);

  const handlePlayerStateChange = useCallback((nextState = {}) => {
    if (Number.isFinite(Number(nextState.currentTime))) {
      setCurrentTime(Number(nextState.currentTime));
    }
    if (typeof nextState.syncSupported === "boolean") {
      setSyncSupported(nextState.syncSupported);
    }
  }, []);

  const playerSurface = useMemo(() => {
    if (!video) {
      return renderUnavailableCard({
        canonicalUrl,
        openExternal,
        title: "Video unavailable for inline playback",
        note: "No video data is available.",
        thumbnail,
        providerLabel: "",
      });
    }

    if (shouldResolvePlayback && resolvedPlayback.loading && !effectiveDirectMediaUrl) {
      return (
        <div className="youtube-player-shell">
          <div className="media-player-loading">Preparing inline playback...</div>
        </div>
      );
    }

    if (provider === "YOUTUBE" && videoId) {
      return (
        <YouTubePlayer
          videoId={videoId}
          title={video?.title || ""}
          sourceUrl={canonicalUrl || ""}
          thumbnail={thumbnail}
          onEnded={onEnded}
          openExternal={openExternal}
          onTimeChange={setCurrentTime}
          onPlaybackStateChange={handlePlayerStateChange}
        />
      );
    }

    if (effectiveDirectMediaUrl && !nativePlaybackFailed) {
      return (
        <div className="youtube-player-shell">
          <video
            ref={nativePlayerRef}
            src={effectiveDirectMediaUrl}
            controls
            playsInline
            preload="metadata"
            autoPlay={autoPlay}
            muted={muted}
            onLoadedMetadata={(event) => {
              setSyncSupported(true);
              setCurrentTime(Number(event.currentTarget.currentTime || 0));
            }}
            onTimeUpdate={(event) => {
              setCurrentTime(Number(event.currentTarget.currentTime || 0));
            }}
            onEnded={(event) => {
              setCurrentTime(Number(event.currentTarget.currentTime || 0));
              onEnded?.();
            }}
            onError={() => {
              setNativePlaybackFailed(true);
              setSyncSupported(provider === "DAILYMOTION" ? HAS_DAILYMOTION_PLAYER_ID : false);
            }}
          />
        </div>
      );
    }

    if (provider === "DAILYMOTION" && videoId) {
      return (
        <DailymotionPlayer
          videoId={videoId}
          title={video?.title || ""}
          sourceUrl={canonicalUrl || ""}
          thumbnail={thumbnail}
          openExternal={openExternal}
          autoPlay={autoPlay}
          muted={muted}
          onEnded={onEnded}
          onTimeChange={setCurrentTime}
          onPlaybackStateChange={handlePlayerStateChange}
        />
      );
    }

    return renderUnavailableCard({
      canonicalUrl,
      openExternal,
      title: video?.title || "Video unavailable for inline playback",
      note: "This source does not provide a compatible inline stream.",
      thumbnail,
      providerLabel:
        provider === "YOUTUBE"
          ? "YouTube"
          : provider === "DAILYMOTION"
            ? "Dailymotion"
            : "",
    });
  }, [
    autoPlay,
    canonicalUrl,
    effectiveDirectMediaUrl,
    handlePlayerStateChange,
    muted,
    nativePlaybackFailed,
    onEnded,
    openExternal,
    provider,
    resolvedPlayback.loading,
    shouldResolvePlayback,
    thumbnail,
    video,
    videoId,
  ]);

  const captionSyncWarning =
    captionState?.hasOriginalSegments &&
    !syncSupported &&
    !resolvedPlayback.loading
      ? resolvedPlayback.error ||
        syncUnsupportedMessage(provider, resolvedPlayback.reason)
      : "";

  return (
    <div className="video-playback-surface">
      <MediaPlayer className={playerClassName}>
        {playerSurface}
        <CaptionOverlay
          segments={captionState?.displaySegments}
          currentTime={currentTime}
          visible={!captionSyncWarning}
        />
      </MediaPlayer>
      {showCaptionPanel ? (
        <CaptionTrackControls
          mode={captionState?.mode}
          onModeChange={captionState?.setMode}
          targetLanguage={targetLanguage}
          targetLanguageLabel={targetLanguageLabel}
          translatedDisabled={captionState?.translatedDisabled}
          translatedDisabledReason={captionState?.translatedDisabledReason}
          translatedAvailable={captionState?.translatedAvailable}
          translatedActive={captionState?.translatedActive}
          state={captionState?.state}
          loading={captionState?.loading}
          emptyMessage="Timed captions are not available for this source yet."
          syncUnavailableMessage={captionSyncWarning}
          groupLabel="Video caption language"
        />
      ) : null}
    </div>
  );
}
