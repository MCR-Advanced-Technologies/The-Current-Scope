import React from "react";

import useTimedCaptionTrack from "../../hooks/useTimedCaptionTrack";

export default function CaptionOverlay({
  segments,
  currentTime = 0,
  visible = true,
}) {
  const { activeText, hasActiveCaption } = useTimedCaptionTrack({
    segments,
    currentTime,
  });

  if (!visible || !hasActiveCaption || !activeText) {
    return null;
  }

  return (
    <div className="caption-overlay" aria-live="polite">
      <div className="caption-overlay-card">{activeText}</div>
    </div>
  );
}
