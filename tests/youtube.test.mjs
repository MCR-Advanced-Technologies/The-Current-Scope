import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractYouTubeVideoId,
  isYouTubeHardErrorCode,
  isYouTubeVideoEmbeddable,
} from "../src/youtube.mjs";

describe("extractYouTubeVideoId", () => {
  const id = "AiTobCzLslc";

  it("returns raw IDs", () => {
    assert.equal(extractYouTubeVideoId(id), id);
  });

  it("parses watch URLs", () => {
    assert.equal(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${id}`), id);
    assert.equal(extractYouTubeVideoId(`https://m.youtube.com/watch?v=${id}&t=42s`), id);
  });

  it("parses youtu.be URLs", () => {
    assert.equal(extractYouTubeVideoId(`https://youtu.be/${id}`), id);
    assert.equal(extractYouTubeVideoId(`https://youtu.be/${id}?si=abc`), id);
  });

  it("parses embed/shorts/live URLs", () => {
    assert.equal(extractYouTubeVideoId(`https://www.youtube.com/embed/${id}?start=3`), id);
    assert.equal(extractYouTubeVideoId(`https://www.youtube-nocookie.com/embed/${id}`), id);
    assert.equal(extractYouTubeVideoId(`https://www.youtube.com/shorts/${id}`), id);
    assert.equal(extractYouTubeVideoId(`https://www.youtube.com/live/${id}?feature=share`), id);
  });

  it("parses attribution links", () => {
    const url = `https://www.youtube.com/attribution_link?u=%2Fwatch%3Fv%3D${id}%26feature%3Dshare`;
    assert.equal(extractYouTubeVideoId(url), id);
  });

  it("handles inputs without a scheme", () => {
    assert.equal(extractYouTubeVideoId(`www.youtube.com/watch?v=${id}`), id);
  });

  it("rejects playlists and non-video URLs", () => {
    assert.equal(extractYouTubeVideoId("https://www.youtube.com/playlist?list=PL123"), "");
    assert.equal(extractYouTubeVideoId("https://www.youtube.com/channel/UC123"), "");
    assert.equal(extractYouTubeVideoId("https://example.com/watch?v=AiTobCzLslc"), "");
  });
});

describe("isYouTubeHardErrorCode", () => {
  it("flags invalid/not embeddable errors", () => {
    assert.equal(isYouTubeHardErrorCode(2), true);
    assert.equal(isYouTubeHardErrorCode(100), true);
    assert.equal(isYouTubeHardErrorCode(101), true);
    assert.equal(isYouTubeHardErrorCode(150), true);
  });

  it("does not treat HTML5 errors as hard", () => {
    assert.equal(isYouTubeHardErrorCode(5), false);
  });
});

describe("isYouTubeVideoEmbeddable", () => {
  it("treats non-embeddable videos as unplayable", () => {
    assert.equal(
      isYouTubeVideoEmbeddable({ status: { embeddable: false, privacyStatus: "public" } }, "US"),
      false,
    );
  });

  it("treats private videos as unplayable", () => {
    assert.equal(
      isYouTubeVideoEmbeddable({ status: { embeddable: true, privacyStatus: "private" } }, "US"),
      false,
    );
  });

  it("treats age-restricted videos as unplayable", () => {
    assert.equal(
      isYouTubeVideoEmbeddable(
        {
          status: { embeddable: true, privacyStatus: "public" },
          contentDetails: { contentRating: { ytRating: "ytAgeRestricted" } },
        },
        "US",
      ),
      false,
    );
  });

  it("respects region restrictions", () => {
    assert.equal(
      isYouTubeVideoEmbeddable(
        {
          status: { embeddable: true, privacyStatus: "public" },
          contentDetails: { regionRestriction: { blocked: ["US"] } },
        },
        "US",
      ),
      false,
    );
    assert.equal(
      isYouTubeVideoEmbeddable(
        {
          status: { embeddable: true, privacyStatus: "public" },
          contentDetails: { regionRestriction: { allowed: ["CA"] } },
        },
        "US",
      ),
      false,
    );
    assert.equal(
      isYouTubeVideoEmbeddable(
        {
          status: { embeddable: true, privacyStatus: "public" },
          contentDetails: { regionRestriction: { allowed: ["US"] } },
        },
        "US",
      ),
      true,
    );
  });
});

