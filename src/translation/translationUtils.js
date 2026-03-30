export const TRANSLATION_LANGUAGE_OPTIONS = [
  { value: "ar", label: "Arabic" },
  { value: "de", label: "German" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "hi", label: "Hindi" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "zh", label: "Chinese" },
];

export function normalizeTranslationLanguage(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.split(/[-_]/)[0];
}

export function inferDefaultTranslationLanguage() {
  if (typeof window === "undefined") return "es";
  const browserLanguage = normalizeTranslationLanguage(
    window.navigator?.language || window.navigator?.languages?.[0] || ""
  );
  if (
    browserLanguage &&
    browserLanguage !== "en" &&
    TRANSLATION_LANGUAGE_OPTIONS.some((option) => option.value === browserLanguage)
  ) {
    return browserLanguage;
  }
  return "es";
}

export function formatTranslationLanguageLabel(value) {
  const normalized = normalizeTranslationLanguage(value);
  if (!normalized) return "";
  return (
    TRANSLATION_LANGUAGE_OPTIONS.find((option) => option.value === normalized)?.label ||
    normalized.toUpperCase()
  );
}

export function buildTranslationContentId(prefix, ...parts) {
  const values = [prefix, ...parts]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return values.join(":");
}

export function splitTranslatedText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function describeTranslationIssue(
  result,
  fallback = "Translation is unavailable right now."
) {
  const reason = String(result?.reason || "").trim().toLowerCase();
  if (reason === "provider_unavailable") {
    return "Machine translation is not configured on the backend yet.";
  }
  if (reason === "caption_unavailable") {
    return "No captions were available for this video source.";
  }
  if (reason === "transcript_unavailable") {
    return "No transcript was available for this audio source.";
  }
  if (reason === "empty_source_text") {
    return "There is no translatable text for this item yet.";
  }
  return String(result?.error || result?.message || fallback);
}

export function getTranslationDisclosure({
  sourceLanguage = "",
  targetLanguage = "",
  notice = "",
} = {}) {
  const normalizedSource = normalizeTranslationLanguage(sourceLanguage);
  const normalizedTarget = normalizeTranslationLanguage(targetLanguage);
  if (
    normalizedSource &&
    normalizedTarget &&
    normalizedSource !== normalizedTarget
  ) {
    const sourceLabel = formatTranslationLanguageLabel(normalizedSource);
    return `Machine translated from ${sourceLabel}. Verify against the original source when accuracy matters.`;
  }
  return String(notice || "").trim();
}

export function hasTranslatableText(value) {
  return Boolean(String(value || "").trim());
}
