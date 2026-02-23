import React from "react";

export default function MediaPlayer({ className = "media-player-frame", children }) {
  return <div className={className}>{children}</div>;
}
