import React, { useEffect, useMemo, useRef } from "react";
import { getWeatherIcon } from "./weatherIcons.jsx";
import { getHourlyForecastCardState } from "./hourlyCardState.mjs";

function formatHourLabel(timeISO, isNow) {
  if (isNow) return "Now";
  const time = Date.parse(timeISO || "");
  if (!Number.isFinite(time)) return "--";
  return new Date(time).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildHourAriaLabel(hour) {
  const label = formatHourLabel(hour?.timeISO, Boolean(hour?.isNow));
  const condition = String(hour?.condition || "Unknown conditions");
  const temp = Number.isFinite(Number(hour?.tempF))
    ? `${Math.round(Number(hour.tempF))} degrees`
    : "temperature unavailable";
  const precipChance = Number.isFinite(Number(hour?.precipChance))
    ? `${Math.round(Number(hour.precipChance))}% chance of ${hour?.precipType || "precipitation"}`
    : "precipitation unavailable";
  return `${label}, ${condition}, ${temp}, ${precipChance}`;
}

/**
 * @typedef {Object} HourlyForecastPoint
 * @property {string} timeISO
 * @property {boolean} [isNow]
 * @property {number} tempF
 * @property {string} condition
 * @property {boolean} isNight
 * @property {'none'|'rain'|'snow'|'mix'} [precipType]
 * @property {number} [precipChance]
 */

/**
 * @param {{
 *   hours: HourlyForecastPoint[],
 *   selectedIndex: number,
 *   onSelectHour: (index:number)=>void
 * }} props
 */
export default function HourlyForecastCardRow({
  hours,
  selectedIndex,
  onSelectHour,
  loading = false,
  error = "",
  onRetry,
  onInteractionStart,
  onInteractionEnd,
  onOpenHourDetail,
  autoScroll = false,
  onAutoScrollComplete,
}) {
  const safeHours = useMemo(() => (Array.isArray(hours) ? hours : []), [hours]);
  const tileRefs = useRef([]);
  const scrollIdleRef = useRef(null);
  const cardState = getHourlyForecastCardState({
    hours: safeHours,
    loading,
    error,
  });

  useEffect(() => {
    if (!autoScroll) return;
    if (!safeHours.length) return;
    const node = tileRefs.current[selectedIndex];
    if (!node || typeof node.scrollIntoView !== "function") return;
    node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    onAutoScrollComplete?.();
  }, [safeHours, selectedIndex, autoScroll, onAutoScrollComplete]);

  useEffect(
    () => () => {
      if (scrollIdleRef.current) {
        window.clearTimeout(scrollIdleRef.current);
        scrollIdleRef.current = null;
      }
    },
    []
  );

  function markInteractionStart() {
    onInteractionStart?.();
  }

  function markInteractionEnd() {
    onInteractionEnd?.();
  }

  function handleScroll() {
    markInteractionStart();
    if (scrollIdleRef.current) {
      window.clearTimeout(scrollIdleRef.current);
    }
    scrollIdleRef.current = window.setTimeout(() => {
      scrollIdleRef.current = null;
      markInteractionEnd();
    }, 180);
  }

  return (
    <section className="wf-card wf-hourly-card" aria-label="Hourly forecast">
      <header className="wf-card-head">
        <h4>Hourly Forecast</h4>
        <span>Next {Math.min(12, safeHours.length || 12)} hours</span>
      </header>
      {cardState === "loading" ? (
        <div className="wf-hourly-skeleton-grid" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`hourly-skeleton-${index}`} className="wf-hourly-skeleton-tile">
              <span className="wf-skeleton wf-skeleton-line short"></span>
              <span className="wf-skeleton wf-skeleton-circle"></span>
              <span className="wf-skeleton wf-skeleton-line"></span>
            </div>
          ))}
        </div>
      ) : cardState === "error" ? (
        <div className="wf-empty">
          <p>{error}</p>
          <button type="button" onClick={() => onRetry?.()}>Retry</button>
        </div>
      ) : cardState === "ready" ? (
        <div
          className="wf-hourly-scroll"
          role="listbox"
          aria-label="Hourly weather list"
          onScroll={handleScroll}
          onTouchStart={markInteractionStart}
          onTouchEnd={markInteractionEnd}
          onPointerDown={markInteractionStart}
          onPointerUp={markInteractionEnd}
          onPointerCancel={markInteractionEnd}
        >
          {safeHours.map((hour, index) => {
            const isNow = Boolean(hour?.isNow);
            const isSelected = index === selectedIndex;
            const label = formatHourLabel(hour?.timeISO, isNow);
            return (
              <button
                key={`${hour?.timeISO || "hour"}-${index}`}
                ref={(node) => {
                  tileRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-label={buildHourAriaLabel(hour)}
                className={`wf-hourly-tile${isNow ? " is-now" : ""}${
                  isSelected ? " is-selected" : ""
                }`}
                onClick={() => {
                  onSelectHour(index);
                  onOpenHourDetail?.(index);
                }}
              >
                <span className="wf-hourly-label">
                  {label}
                  {isNow ? <em className="wf-now-dot" aria-hidden="true"></em> : null}
                </span>
                <span className="wf-hourly-icon">
                  {getWeatherIcon(hour?.condition, hour?.isNight, hour?.precipType, {
                    size: 26,
                    className: "wf-hourly-icon-glyph",
                  })}
                </span>
                <span className="wf-hourly-temp">
                  {Number.isFinite(Number(hour?.tempF)) ? `${Math.round(Number(hour?.tempF))}°` : "--"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="wf-empty">Hourly forecast is unavailable.</div>
      )}
    </section>
  );
}
