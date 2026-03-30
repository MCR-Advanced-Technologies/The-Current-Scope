import React from "react";

import TranslationDisclosure from "../translation/TranslationDisclosure";
import TranslationToggle from "../translation/TranslationToggle";
import useTimedCaptionTrack from "../../hooks/useTimedCaptionTrack";

export default function TimedCaptionPanel({
  heading = "Captions",
  mode = "original",
  onModeChange,
  targetLanguage = "",
  targetLanguageLabel = "",
  translatedDisabled = false,
  translatedDisabledReason = "",
  translatedAvailable = false,
  translatedActive = false,
  state,
  displaySegments,
  currentTime = 0,
  loading = false,
  emptyMessage = "Timed captions are not available for this source yet.",
  syncUnavailableMessage = "",
  groupLabel = "Caption language",
  compact = false,
}) {
  const { activeText, hasSegments } = useTimedCaptionTrack({
    segments: displaySegments,
    currentTime,
  });
  const idleMessage =
    mode === "translated" && translatedAvailable
      ? "Translated captions will appear here as playback advances."
      : "Captions will appear here as playback advances.";

  const helperMessage =
    syncUnavailableMessage ||
    (!hasSegments ? emptyMessage : "") ||
    (translatedDisabled && translatedDisabledReason ? translatedDisabledReason : "");

  return (
    <div className={`translation-panel timed-caption-panel${compact ? " compact" : ""}`}>
      <div className="translation-panel-header">
        <h4>{heading}</h4>
        <TranslationToggle
          mode={mode}
          onChange={onModeChange}
          targetLanguageLabel={targetLanguageLabel}
          translatedDisabled={translatedDisabled}
          groupLabel={groupLabel}
        />
      </div>

      {loading ? (
        <div className="translation-status">Loading timed captions...</div>
      ) : null}

      {translatedActive && translatedAvailable ? (
        <TranslationDisclosure
          sourceLanguage={state?.sourceLanguage}
          targetLanguage={targetLanguage}
          notice={state?.translationNotice}
        />
      ) : null}

      {helperMessage && !loading && !hasSegments ? (
        <div className="translation-status error">{helperMessage}</div>
      ) : null}

      {hasSegments ? (
        <div
          className={`timed-caption-current${activeText ? " active" : ""}${compact ? " compact" : ""}`}
        >
          {activeText || idleMessage}
        </div>
      ) : null}

      {hasSegments ? (
        <div className="translation-status subtle">
          {state?.label || heading}
          {state?.metadata?.auto_generated ? " • auto-generated" : ""}
          {translatedDisabled && translatedDisabledReason ? " • showing original captions" : ""}
        </div>
      ) : null}
    </div>
  );
}
