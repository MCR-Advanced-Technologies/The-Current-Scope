function toNumber(value, fallback = null) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return fallback;
  return nextValue;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dedupeCaptionSegments(segments) {
  const deduped = [];
  segments.forEach((segment) => {
    const previous = deduped[deduped.length - 1];
    if (!previous) {
      deduped.push(segment);
      return;
    }
    const sameText = previous.text.toLowerCase() === segment.text.toLowerCase();
    const sameStart = Math.abs(previous.start - segment.start) <= 0.05;
    const adjacent = segment.start <= previous.end + 0.3;
    if (sameText && (sameStart || adjacent)) {
      previous.end = Math.max(previous.end, segment.end);
      return;
    }
    deduped.push(segment);
  });
  return deduped;
}

export function normalizeCaptionSegments(segments, { fallbackLanguage = "" } = {}) {
  const normalized = Array.isArray(segments)
    ? segments
        .map((segment, index) => {
          if (!segment || typeof segment !== "object") return null;
          const text = normalizeText(segment.text);
          const start = toNumber(segment.start);
          let end = toNumber(segment.end);
          if (!text || start === null || start < 0) return null;
          if (end === null || end <= start) {
            end = start + 4;
          }
          return {
            id: String(segment.id || `seg_${index}`),
            start: Number(start.toFixed(3)),
            end: Number(Math.max(end, start + 0.25).toFixed(3)),
            text,
            language: String(segment.language || fallbackLanguage || "").trim(),
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.start - right.start || left.end - right.end)
    : [];

  return dedupeCaptionSegments(normalized);
}

export function getActiveCaptionSegments(segments, currentTime) {
  const safeTime = Number.isFinite(Number(currentTime)) ? Number(currentTime) : 0;
  const normalized = normalizeCaptionSegments(segments);
  if (!normalized.length) return [];

  const active = normalized.filter(
    (segment) => safeTime >= segment.start - 0.05 && safeTime <= segment.end + 0.18
  );
  if (active.length) return active;

  const latestPast = normalized.findLast
    ? normalized.findLast(
        (segment) => safeTime > segment.end && safeTime - segment.end <= 0.2
      )
    : [...normalized]
        .reverse()
        .find((segment) => safeTime > segment.end && safeTime - segment.end <= 0.2);

  return latestPast ? [latestPast] : [];
}

export function getActiveCaptionText(segments, currentTime) {
  const lines = [];
  const seen = new Set();
  getActiveCaptionSegments(segments, currentTime).forEach((segment) => {
    const text = normalizeText(segment.text);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    lines.push(text);
  });
  return lines.join("\n");
}
