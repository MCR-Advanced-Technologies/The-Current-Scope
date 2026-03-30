import { useMemo } from "react";

import {
  getActiveCaptionSegments,
  getActiveCaptionText,
  normalizeCaptionSegments,
} from "../captions/captionUtils";

export default function useTimedCaptionTrack({ segments, currentTime = 0 }) {
  const normalizedSegments = useMemo(
    () => normalizeCaptionSegments(segments),
    [segments]
  );
  const activeSegments = useMemo(
    () => getActiveCaptionSegments(normalizedSegments, currentTime),
    [normalizedSegments, currentTime]
  );
  const activeText = useMemo(
    () => getActiveCaptionText(normalizedSegments, currentTime),
    [normalizedSegments, currentTime]
  );

  return {
    segments: normalizedSegments,
    activeSegments,
    activeText,
    hasSegments: normalizedSegments.length > 0,
    hasActiveCaption: Boolean(activeText),
  };
}
