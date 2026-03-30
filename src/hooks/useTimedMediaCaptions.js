import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildMediaTranslationCacheKey,
  loadMediaTranslation,
} from "../translation/translationService";
import {
  buildTranslationContentId,
  normalizeTranslationLanguage,
} from "../translation/translationUtils";
import { normalizeCaptionSegments } from "../captions/captionUtils";

export default function useTimedMediaCaptions({
  kind,
  item,
  targetLanguage,
  sourceUrl = "",
  sourceLanguage = "",
  preferredLanguage = "",
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
      `${kind}:${defaultKind}:${
        item?.id ||
        item?.video_id ||
        item?.videoId ||
        item?.stream_url ||
        item?.homepage_url ||
        item?.url ||
        item?.name ||
        ""
      }`,
    [defaultKind, item, kind]
  );
  const cacheKey = useMemo(
    () => `${buildMediaTranslationCacheKey(kind, item, normalizedTargetLanguage)}:${defaultKind}`,
    [defaultKind, kind, item, normalizedTargetLanguage]
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
    [item, kind]
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
          fallbackText: "",
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
          setError(err?.message || "Unable to load timed captions.");
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
    item,
    kind,
    normalizedTargetLanguage,
    preferredLanguage,
    sourceLanguage,
    sourceUrl,
    unavailableReason,
  ]);

  const originalSegments = useMemo(
    () =>
      normalizeCaptionSegments(state?.originalSegments, {
        fallbackLanguage: state?.sourceLanguage || sourceLanguage,
      }),
    [sourceLanguage, state?.originalSegments, state?.sourceLanguage]
  );
  const translatedSegments = useMemo(
    () =>
      normalizeCaptionSegments(state?.translatedSegments, {
        fallbackLanguage: state?.targetLanguage || normalizedTargetLanguage,
      }),
    [normalizedTargetLanguage, state?.targetLanguage, state?.translatedSegments]
  );

  const translatedAvailable = translatedSegments.length > 0;
  const translatedDisabled = !loading && !translatedAvailable;
  const translatedActive = mode === "translated" && translatedAvailable;

  useEffect(() => {
    if (mode === "translated" && translatedDisabled) {
      setMode("original");
    }
  }, [mode, translatedDisabled]);

  return {
    mode,
    setMode,
    state,
    loading,
    error,
    originalSegments,
    translatedSegments,
    displaySegments: translatedActive ? translatedSegments : originalSegments,
    hasOriginalSegments: originalSegments.length > 0,
    translatedAvailable,
    translatedActive,
    translatedDisabled,
    translatedDisabledReason: translatedDisabled
      ? error || "Translated captions are unavailable right now."
      : "",
  };
}
