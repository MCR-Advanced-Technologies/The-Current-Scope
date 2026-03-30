import React from "react";

export default function TranslationToggle({
  mode = "original",
  onChange,
  targetLanguageLabel = "",
  groupLabel = "Translation language",
  translatedDisabled = false,
}) {
  return (
    <div className="translation-toggle-group" role="group" aria-label={groupLabel}>
      <button
        type="button"
        className={mode !== "translated" ? "active" : ""}
        onClick={() => onChange?.("original")}
      >
        Original
      </button>
      <button
        type="button"
        className={mode === "translated" ? "active" : ""}
        onClick={() => {
          if (translatedDisabled) return;
          onChange?.("translated");
        }}
        disabled={translatedDisabled}
        title={
          translatedDisabled
            ? "Machine translation is unavailable right now."
            : ""
        }
      >
        Translated ({targetLanguageLabel || "Target"})
      </button>
    </div>
  );
}
