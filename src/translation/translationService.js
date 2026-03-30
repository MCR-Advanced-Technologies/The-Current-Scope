import {
  fetchTranslationStatus,
  translateMediaText,
  translateTextBatch,
} from "../api";
import {
  buildTranslationContentId,
  describeTranslationIssue,
  normalizeTranslationLanguage,
} from "./translationUtils";

function ensureObject(value) {
  return value && typeof value === "object" ? value : {};
}

function mapTimedSegments(segments = []) {
  if (!Array.isArray(segments)) return [];
  return segments
    .filter((segment) => segment && typeof segment === "object")
    .map((segment, index) => ({
      id: String(segment.id || `seg_${index}`),
      start: Number(segment.start || 0),
      end: Number(segment.end || 0),
      text: String(segment.text || "").trim(),
      language: String(segment.language || "").trim(),
    }))
    .filter((segment) => segment.text);
}

export async function loadTranslationStatus(requestOptions = {}) {
  try {
    const response = ensureObject(await fetchTranslationStatus(requestOptions));
    const enabled = Boolean(response.enabled);
    return {
      enabled,
      provider: String(response.provider || "").trim(),
      disclosure: String(response.disclosure || "").trim(),
      defaultTargetLanguage: normalizeTranslationLanguage(
        response.default_target_language || response.defaultTargetLanguage || "en"
      ),
      message: enabled
        ? ""
        : String(
            response.message ||
              "Machine translation is not configured on the backend yet."
          ).trim(),
      reason: enabled
        ? ""
        : String(response.reason || "provider_unavailable").trim(),
    };
  } catch (err) {
    return {
      enabled: false,
      provider: "",
      disclosure: "",
      defaultTargetLanguage: "en",
      message: err?.message || "Unable to check translation status right now.",
      reason: "status_unavailable",
    };
  }
}

export function buildArticleTranslationCacheKey(article, fallbackUrl, targetLanguage) {
  return buildTranslationContentId(
    "article",
    article?.id || article?.url || fallbackUrl,
    normalizeTranslationLanguage(targetLanguage)
  );
}

export function buildMediaTranslationCacheKey(kind, item, targetLanguage) {
  return buildTranslationContentId(
    kind,
    item?.id ||
      item?.video_id ||
      item?.videoId ||
      item?.stream_url ||
      item?.homepage_url ||
      item?.url ||
      item?.name,
    normalizeTranslationLanguage(targetLanguage)
  );
}

export async function loadArticleTranslation({
  article,
  articleUrl = "",
  titleText = "",
  summaryText = "",
  bodyText = "",
  targetLanguage = "",
}) {
  const normalizedTargetLanguage = normalizeTranslationLanguage(targetLanguage);
  const articleKey = buildTranslationContentId(
    "article",
    article?.id || article?.url || articleUrl || titleText
  );
  const sourceLanguage = String(article?.language || "").trim();
  const items = [
    titleText
      ? {
          slot: "title",
          content_id: articleKey,
          content_type: "article_title",
          source_text: titleText,
          target_language: normalizedTargetLanguage,
          source_language: sourceLanguage,
        }
      : null,
    summaryText
      ? {
          slot: "summary",
          content_id: articleKey,
          content_type: "article_summary",
          source_text: summaryText,
          target_language: normalizedTargetLanguage,
          source_language: sourceLanguage,
        }
      : null,
    bodyText
      ? {
          slot: "body",
          content_id: articleKey,
          content_type: "article_body",
          source_text: bodyText,
          target_language: normalizedTargetLanguage,
          source_language: sourceLanguage,
        }
      : null,
  ].filter(Boolean);

  if (!items.length) {
    return {
      available: false,
      targetLanguage: normalizedTargetLanguage,
      sourceLanguage,
      title: "",
      summary: "",
      body: "",
      translationNotice: "",
      provider: "",
      message: "There is no article text available to translate.",
      reason: "empty_source_text",
    };
  }

  const response = ensureObject(await translateTextBatch(items));
  const byType = new Map(
    (Array.isArray(response.items) ? response.items : []).map((item) => [
      item.content_type,
      item,
    ])
  );
  const nextState = {
    available: false,
    targetLanguage: normalizedTargetLanguage,
    sourceLanguage,
    title: "",
    summary: "",
    body: "",
    translationNotice: "",
    provider: "",
    message: "",
    reason: "",
  };

  items.forEach((item) => {
    const result = ensureObject(byType.get(item.content_type));
    if (result.available && result.translated_text) {
      nextState[item.slot] = String(result.translated_text || "").trim();
      nextState.available = true;
      if (!nextState.translationNotice && result.translation_notice) {
        nextState.translationNotice = String(result.translation_notice).trim();
      }
      if (!nextState.provider && result.provider) {
        nextState.provider = String(result.provider).trim();
      }
      if (!nextState.sourceLanguage && result.source_language) {
        nextState.sourceLanguage = String(result.source_language).trim();
      }
      return;
    }
    if (!nextState.message && Object.keys(result).length) {
      nextState.message = describeTranslationIssue(result);
      nextState.reason = String(result.reason || "").trim();
      if (!nextState.sourceLanguage && result.source_language) {
        nextState.sourceLanguage = String(result.source_language).trim();
      }
    }
  });

  if (!nextState.available && !nextState.message) {
    nextState.message = "Translation is unavailable right now.";
  }

  return nextState;
}

export async function loadMediaTranslation({
  kind,
  item,
  contentId,
  contentType,
  targetLanguage,
  sourceUrl = "",
  sourceLanguage = "",
  preferredLanguage = "",
  fallbackText = "",
  defaultKind = "caption",
  unavailableReason = "text_unavailable",
}) {
  const response = ensureObject(
    await translateMediaText({
      content_id: contentId,
      content_type: contentType,
      target_language: normalizeTranslationLanguage(targetLanguage),
      source_url: sourceUrl,
      source_language: sourceLanguage,
      preferred_language: preferredLanguage,
      fallback_text: fallbackText,
      default_kind: defaultKind,
      unavailable_reason: unavailableReason,
    })
  );
  return {
    available: Boolean(response.available),
    reason: String(response.reason || "").trim(),
    message: describeTranslationIssue(response),
    targetLanguage: normalizeTranslationLanguage(
      response.target_language || targetLanguage
    ),
    sourceLanguage: String(response.source_language || sourceLanguage || "").trim(),
    originalText: String(response.original_text || "").trim(),
    translatedText: String(response.translated_text || "").trim(),
    translationNotice: String(response.translation_notice || "").trim(),
    provider: String(response.provider || "").trim(),
    textKind: String(response.text_kind || defaultKind).trim(),
    label: String(response.label || "").trim(),
    metadata: ensureObject(response.metadata),
    cached: Boolean(response.cached),
    originalSegments: mapTimedSegments(response.original_segments),
    translatedSegments: mapTimedSegments(response.translated_segments),
    hasTiming: Boolean(response.has_timing),
    kind,
  };
}
