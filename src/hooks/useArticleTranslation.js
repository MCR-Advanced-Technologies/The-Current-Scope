import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildArticleTranslationCacheKey,
  loadArticleTranslation,
} from "../translation/translationService";
import {
  hasTranslatableText,
  normalizeTranslationLanguage,
} from "../translation/translationUtils";

export default function useArticleTranslation({
  article,
  articleUrl = "",
  titleText = "",
  summaryText = "",
  bodyText = "",
  targetLanguage = "",
  active = false,
}) {
  const cacheRef = useRef(new Map());
  const [mode, setMode] = useState("original");
  const [translation, setTranslation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedTargetLanguage = normalizeTranslationLanguage(targetLanguage);
  const contentKey = useMemo(
    () => `${article?.id || article?.url || articleUrl || ""}`,
    [article, articleUrl]
  );
  const cacheKey = useMemo(
    () =>
      buildArticleTranslationCacheKey(
        article,
        articleUrl,
        normalizedTargetLanguage
      ),
    [article, articleUrl, normalizedTargetLanguage]
  );

  const hasSourceText = useMemo(
    () =>
      hasTranslatableText(titleText) ||
      hasTranslatableText(summaryText) ||
      hasTranslatableText(bodyText),
    [titleText, summaryText, bodyText]
  );

  useEffect(() => {
    setMode("original");
    setTranslation(null);
    setError("");
    setLoading(false);
  }, [contentKey]);

  useEffect(() => {
    if (!active) return;
    if (mode !== "translated") return;
    if (!hasSourceText || !normalizedTargetLanguage) return;

    let cancelled = false;

    async function load() {
      if (cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey);
        if (!cancelled) {
          setTranslation(cached);
          setError(cached?.available ? "" : cached?.message || "");
        }
        return;
      }

      setLoading(true);
      setError("");
      try {
        const nextState = await loadArticleTranslation({
          article,
          articleUrl,
          titleText,
          summaryText,
          bodyText,
          targetLanguage: normalizedTargetLanguage,
        });
        cacheRef.current.set(cacheKey, nextState);
        if (!cancelled) {
          setTranslation(nextState);
          setError(nextState?.available ? "" : nextState?.message || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Translation request failed.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    active,
    article,
    articleUrl,
    bodyText,
    cacheKey,
    hasSourceText,
    mode,
    normalizedTargetLanguage,
    summaryText,
    titleText,
  ]);

  const translatedAvailable = Boolean(translation?.available);
  const translatedActive = mode === "translated" && translatedAvailable;
  const translatedRequested = mode === "translated";

  return {
    mode,
    setMode,
    translation,
    loading,
    error,
    hasSourceText,
    translatedAvailable,
    translatedActive,
    translatedRequested,
    displayTitle:
      (translatedActive ? translation?.title : "") || titleText || "Read-only",
    displaySummary:
      (translatedActive ? translation?.summary : "") || summaryText || "",
    displayBody:
      (translatedActive ? translation?.body : "") || bodyText || "",
  };
}
