import React from "react";

import TranslationDisclosure from "../translation/TranslationDisclosure";
import TranslationToggle from "../translation/TranslationToggle";

export default function CaptionTrackControls({
  mode = "original",
  onModeChange,
  targetLanguage = "",
  targetLanguageLabel = "",
  translatedDisabled = false,
  translatedDisabledReason = "",
  translatedAvailable = false,
  translatedActive = false,
  state,
  loading = false,
  emptyMessage = "Timed captions are not available for this source yet.",
  syncUnavailableMessage = "",
  groupLabel = "Caption language",
}) {
  const helperMessage =
    syncUnavailableMessage ||
    (translatedDisabled && translatedDisabledReason ? translatedDisabledReason : "") ||
    (!state?.metadata?.has_timing && !loading ? emptyMessage : "");

  return (
    <div className="caption-track-controls">
      <div className="caption-track-controls-row">
        <div className="caption-track-controls-copy">
          <strong>Timed captions</strong>
          <span>
            {translatedActive && translatedAvailable
              ? `Overlaying translated ${targetLanguageLabel || targetLanguage || "target"} captions`
              : "Overlaying original timed captions"}
          </span>
        </div>
        <TranslationToggle
          mode={mode}
          onChange={onModeChange}
          targetLanguageLabel={targetLanguageLabel}
          translatedDisabled={translatedDisabled}
          groupLabel={groupLabel}
        />
      </div>

      {loading ? <div className="translation-status">Loading timed captions...</div> : null}

      {translatedActive && translatedAvailable ? (
        <TranslationDisclosure
          sourceLanguage={state?.sourceLanguage}
          targetLanguage={targetLanguage}
          notice={state?.translationNotice}
        />
      ) : null}

      {helperMessage ? <div className="translation-status subtle">{helperMessage}</div> : null}
    </div>
  );
}
