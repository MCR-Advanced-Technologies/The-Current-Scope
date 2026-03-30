import React from "react";

import TranslationDisclosure from "./TranslationDisclosure";
import TranslationToggle from "./TranslationToggle";
import { splitTranslatedText } from "../../translation/translationUtils";

export default function MediaTranslationPanel({
  heading,
  mode = "original",
  onModeChange,
  targetLanguageLabel = "",
  targetLanguage = "",
  state,
  loading = false,
  error = "",
  compact = false,
  emptyMessage = "Translated text is not available for this item yet.",
  groupLabel = "Media translation",
}) {
  const translatedRequested = mode === "translated";
  const translatedAvailable = Boolean(state?.available && state?.translatedText);
  const originalText = String(state?.originalText || "").trim();
  const displayText = translatedAvailable && translatedRequested
    ? state?.translatedText
    : originalText;
  const paragraphs = splitTranslatedText(displayText);
  const showUnavailableNotice =
    translatedRequested && !translatedAvailable && Boolean(error);

  return (
    <div className={`translation-panel${compact ? " compact" : ""}`}>
      <div className="translation-panel-header">
        <h4>{heading}</h4>
        <TranslationToggle
          mode={mode}
          onChange={onModeChange}
          targetLanguageLabel={targetLanguageLabel}
          groupLabel={groupLabel}
        />
      </div>

      {loading ? (
        <div className="translation-status">Loading translated text...</div>
      ) : null}

      {showUnavailableNotice ? (
        <div className="translation-status error">{error}</div>
      ) : null}

      {!loading && !paragraphs.length ? (
        <div className="translation-status error">{error || emptyMessage}</div>
      ) : null}

      {translatedRequested && translatedAvailable ? (
        <TranslationDisclosure
          sourceLanguage={state?.sourceLanguage}
          targetLanguage={targetLanguage}
          notice={state?.translationNotice}
        />
      ) : null}

      {paragraphs.length ? (
        <>
          <div className="translation-status subtle">
            {state?.label || heading}
            {state?.metadata?.auto_generated ? " • auto-generated" : ""}
            {translatedRequested && !translatedAvailable
              ? " • showing original text"
              : ""}
          </div>
          <div className={`translation-panel-body${compact ? " compact" : ""}`}>
            {paragraphs.map((paragraph, index) => (
              <p key={`${heading}-${index}`}>{paragraph}</p>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
