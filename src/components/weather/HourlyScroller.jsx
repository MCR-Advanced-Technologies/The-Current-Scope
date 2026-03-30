import React, { useEffect, useMemo, useRef } from "react";

const ICON_BY_TYPE = {
  clear: "fa-moon",
  cloud: "fa-cloud",
  rain: "fa-cloud-rain",
  snow: "fa-snowflake",
  mix: "fa-cloud-meatball",
};

const CLASS_BY_TYPE = {
  clear: "wx-clear",
  cloud: "wx-cloud",
  rain: "wx-rain",
  snow: "wx-snow",
  mix: "wx-mix",
};

export default function HourlyScroller({
  hourly,
  selectedHourIndex,
  onSelectHour,
  pinnedHourIndex,
  onPinHour,
}) {
  const itemRefs = useRef([]);

  useEffect(() => {
    const node = itemRefs.current[selectedHourIndex];
    if (!node || typeof node.scrollIntoView !== "function") return;
    node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedHourIndex]);

  const tiles = useMemo(() => (Array.isArray(hourly) ? hourly : []), [hourly]);

  if (!tiles.length) {
    return (
      <section className="wx-hourly" aria-label="Hourly forecast loading">
        <div className="wx-hourly-skeleton-row">
          {new Array(6).fill(0).map((_, idx) => (
            <div className="wx-hourly-skeleton" key={`wx-skeleton-${idx}`}></div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="wx-hourly" aria-label="Hourly forecast">
      <div className="wx-section-header">
        <h3>Hourly Forecast</h3>
        <span>Next {Math.min(24, tiles.length)} hours</span>
      </div>
      <div className="wx-hourly-scroll" role="listbox" aria-label="Hourly forecast list">
        {tiles.map((item, idx) => {
          const isNow = idx === 0;
          const isActive = idx === selectedHourIndex;
          const isPinned = Number.isFinite(pinnedHourIndex) && pinnedHourIndex === idx;
          const icon = ICON_BY_TYPE[item.precipType] || ICON_BY_TYPE.cloud;
          const typeClass = CLASS_BY_TYPE[item.precipType] || CLASS_BY_TYPE.cloud;
          return (
            <button
              key={`${item.iso || item.time || "hr"}-${idx}`}
              ref={(node) => {
                itemRefs.current[idx] = node;
              }}
              type="button"
              role="option"
              aria-selected={isActive}
              className={`wx-hour-tile ${typeClass}${isNow ? " is-now" : ""}${
                isActive ? " is-active" : ""
              }${isPinned ? " is-pinned" : ""}`}
              onClick={() => onSelectHour(idx)}
              onDoubleClick={() => onPinHour?.(idx)}
              onContextMenu={(event) => {
                event.preventDefault();
                onPinHour?.(idx);
              }}
              aria-label={`${item.time}, ${item.temp} degrees, ${item.condition}. Precip ${item.precipChance}%`}
            >
              <span className="wx-hour-time">{item.time}</span>
              <span className="wx-hour-icon" aria-hidden="true">
                <i className={`fa-solid ${icon}`}></i>
              </span>
              <span className="wx-hour-temp">{item.temp}°</span>
              {isNow ? <span className="wx-now-dot" aria-hidden="true"></span> : null}
              {isPinned ? <span className="wx-pin-tag">Pinned</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
