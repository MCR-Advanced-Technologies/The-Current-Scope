function isYouTubeId(value) {
  return /^[a-zA-Z0-9_-]{11}$/.test(String(value || "").trim());
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (err) {
    return String(value || "");
  }
}

function maybeUrl(raw) {
  const candidate = String(raw || "").trim();
  if (!candidate) return null;
  try {
    return new URL(candidate);
  } catch (err) {
    // Support inputs without a scheme, e.g. "www.youtube.com/watch?v=..."
    try {
      return new URL(`https://${candidate}`);
    } catch (err2) {
      return null;
    }
  }
}

export function extractYouTubeVideoId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  // Raw ID (common when the backend stores IDs directly).
  if (isYouTubeId(raw)) return raw;

  const url = maybeUrl(raw);
  if (!url) {
    // As a last resort, extract common query forms from non-URL strings.
    const match = raw.match(/(?:^|[?&])v=([a-zA-Z0-9_-]{11})(?:$|[&#?])/);
    return match ? match[1] : "";
  }

  const host = String(url.hostname || "").toLowerCase();
  const path = String(url.pathname || "");

  if (host.includes("youtu.be")) {
    const id = path.replace(/^\/+/, "").split("/")[0] || "";
    return isYouTubeId(id) ? id : "";
  }

  const isYouTubeHost =
    host.includes("youtube.com") ||
    host.includes("youtube-nocookie.com") ||
    host.includes("youtube.googleapis.com");
  if (!isYouTubeHost) return "";

  // Some links use attribution redirects:
  // https://www.youtube.com/attribution_link?u=/watch%3Fv%3D<id>%26...
  if (path.startsWith("/attribution_link")) {
    const u = url.searchParams.get("u") || "";
    const decoded = safeDecodeURIComponent(u);
    const nested = maybeUrl(decoded.startsWith("/") ? `https://www.youtube.com${decoded}` : decoded);
    return nested ? extractYouTubeVideoId(nested.toString()) : "";
  }

  if (path.startsWith("/watch")) {
    const id = url.searchParams.get("v") || url.searchParams.get("vi") || "";
    return isYouTubeId(id) ? id : "";
  }

  const prefixes = ["/shorts/", "/embed/", "/v/", "/live/"];
  for (const prefix of prefixes) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length).replace(/^\/+/, "");
    const id = rest.split("/")[0] || "";
    return isYouTubeId(id) ? id : "";
  }

  return "";
}

export function isYouTubeHardErrorCode(code) {
  const numeric = Number(code);
  // 2: invalid parameter
  // 5: HTML5 player error (often transient; don't treat as "hard")
  // 100: removed / not found
  // 101/150: embedding disabled by owner
  // 153: missing/invalid client identification (often blocked embed context)
  return numeric === 2 || numeric === 100 || numeric === 101 || numeric === 150 || numeric === 153;
}

export function isYouTubeVideoEmbeddable(apiItem, regionCode) {
  const item = apiItem && typeof apiItem === "object" ? apiItem : {};
  const status = item.status && typeof item.status === "object" ? item.status : {};
  const content = item.contentDetails && typeof item.contentDetails === "object" ? item.contentDetails : {};

  if (status.embeddable === false) return false;
  const privacy = String(status.privacyStatus || "").toLowerCase();
  if (privacy && privacy !== "public") return false;

  const rating = content.contentRating && typeof content.contentRating === "object" ? content.contentRating : {};
  if (String(rating.ytRating || "") === "ytAgeRestricted") return false;

  const region = String(regionCode || "").trim().toUpperCase();
  const restriction =
    content.regionRestriction && typeof content.regionRestriction === "object"
      ? content.regionRestriction
      : {};

  if (region) {
    const blocked = Array.isArray(restriction.blocked)
      ? restriction.blocked.map((value) => String(value || "").toUpperCase()).filter(Boolean)
      : [];
    if (blocked.includes(region)) return false;

    const allowed = Array.isArray(restriction.allowed)
      ? restriction.allowed.map((value) => String(value || "").toUpperCase()).filter(Boolean)
      : [];
    if (allowed.length > 0 && !allowed.includes(region)) return false;
  }

  return true;
}
