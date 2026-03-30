import React, { useEffect, useState } from "react";

import TimedCaptionPanel from "../captions/TimedCaptionPanel";

export default function RadioPlaybackSurface({
  radio,
  audioRef = null,
  onPlayStateChange = null,
  onPlaybackError = null,
  captionState = null,
  targetLanguage = "",
  targetLanguageLabel = "",
  compactCaptions = false,
}) {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setCurrentTime(0);
  }, [radio?.id, radio?.stream_url, radio?.homepage_url, radio?.name]);

  if (!radio?.stream_url) {
    return <div className="results-empty">No stream URL available for this station.</div>;
  }

  return (
    <>
      <audio
        ref={audioRef}
        controls
        preload="none"
        src={radio.stream_url}
        onLoadedMetadata={(event) => {
          setCurrentTime(Number(event.currentTarget.currentTime || 0));
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(Number(event.currentTarget.currentTime || 0));
        }}
        onError={() => {
          onPlayStateChange?.(false);
          onPlaybackError?.(
            "Audio playback failed. Some stations require HTTPS, a compatible codec, or an external player."
          );
        }}
        onPlay={() => onPlayStateChange?.(true)}
        onPause={() => onPlayStateChange?.(false)}
        onEnded={() => onPlayStateChange?.(false)}
      />
      {typeof window !== "undefined" &&
      window.location?.protocol === "https:" &&
      String(radio.stream_url || "").toLowerCase().startsWith("http://") ? (
        <div className="radio-warning">
          This station uses an HTTP stream. Browsers may block mixed-content playback over HTTPS.
        </div>
      ) : null}
      <TimedCaptionPanel
        compact={compactCaptions}
        heading="Live captions"
        mode={captionState?.mode}
        onModeChange={captionState?.setMode}
        targetLanguage={targetLanguage}
        targetLanguageLabel={targetLanguageLabel}
        translatedDisabled={captionState?.translatedDisabled}
        translatedDisabledReason={captionState?.translatedDisabledReason}
        translatedAvailable={captionState?.translatedAvailable}
        translatedActive={captionState?.translatedActive}
        state={captionState?.state}
        displaySegments={captionState?.displaySegments}
        currentTime={currentTime}
        loading={captionState?.loading}
        emptyMessage="Timed captions are not available for this station yet."
        groupLabel="Radio caption language"
      />
    </>
  );
}
