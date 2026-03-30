import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildMediaTranslationCacheKey,
  loadMediaTranslation,
} from "../translation/translationService";
import {
  buildTranslationContentId,
  hasTranslatableText,
  normalizeTranslationLanguage,
} from "../translation/translationUtils";

export default function useMediaTranslation({
  kind,
  item,
  targetLanguage,
  sourceUrl = "",
  sourceLanguage = "",
  preferredLanguage = "",
  fallbackText = "",
  defaultKind = "caption",
  unavailableReason = "text_unavailable",
  active = true,
}) {
  const cacheRef = useRef(new Map());
  const [mode, setMode] = useState("original");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedTargetLanguage = normalizeTranslationLanguage(targetLanguage);
  const itemKey = useMemo(
    () =>
      `${kind}:${
        item?.id ||
        item?.video_id ||
        item?.videoId ||
        item?.stream_url ||
        item?.homepage_url ||
        item?.url ||
        item?.name ||
        ""
      }`,
    [item, kind]
  );
  const cacheKey = useMemo(
    () => buildMediaTranslationCacheKey(kind, item, normalizedTargetLanguage),
    [kind, item, normalizedTargetLanguage]
  );
  const contentId = useMemo(
    () =>
      buildTranslationContentId(
        kind,
        item?.id ||
          item?.video_id ||
          item?.videoId ||
          item?.stream_url ||
          item?.homepage_url ||
          item?.url ||
          item?.name
      ),
    [kind, item]
  );

  useEffect(() => {
    setMode("original");
    setState(null);
    setLoading(false);
    setError("");
  }, [itemKey]);

  useEffect(() => {
    if (!active) return;
    if (!item || !normalizedTargetLanguage || !contentId) return;

    let cancelled = false;

    async function load() {
      if (cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey);
        if (!cancelled) {
          setState(cached);
          setError(cached?.available ? "" : cached?.message || "");
        }
        return;
      }

      setLoading(true);
      setError("");
      try {
        const nextState = await loadMediaTranslation({
          kind,
          item,
          contentId,
          contentType: `${kind}_${defaultKind}`,
          targetLanguage: normalizedTargetLanguage,
          sourceUrl,
          sourceLanguage,
          preferredLanguage,
          fallbackText,
          defaultKind,
          unavailableReason,
        });
        cacheRef.current.set(cacheKey, nextState);
        if (!cancelled) {
          setState(nextState);
          setError(nextState?.available ? "" : nextState?.message || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Unable to load translated media text.");
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
    cacheKey,
    contentId,
    defaultKind,
    fallbackText,
    item,
    kind,
    normalizedTargetLanguage,
    preferredLanguage,
    sourceLanguage,
    sourceUrl,
    unavailableReason,
  ]);

  const originalText = state?.originalText || "";
  const translatedText = state?.translatedText || "";
  const translatedAvailable = Boolean(state?.available && translatedText);
  const translatedActive = mode === "translated" && translatedAvailable;
  const translatedRequested = mode === "translated";
  const hasOriginalText = hasTranslatableText(originalText);

  return {
    mode,
    setMode,
    state,
    loading,
    error,
    translatedAvailable,
    translatedActive,
    translatedRequested,
    hasOriginalText,
    displayText: translatedActive ? translatedText : originalText,
  };
}
