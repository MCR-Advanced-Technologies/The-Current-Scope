import React, { useMemo } from "react";
import { getWeatherIcon } from "./weatherIcons.jsx";

function formatDateLabel(dateISO) {
  const ts = Date.parse(dateISO || "");
  if (!Number.isFinite(ts)) return "--";
  return new Date(ts).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function buildDayAriaLabel(day) {
  const baseLabel = `${day?.dayLabel || "Day"}, ${day?.condition || "Unknown conditions"}`;
  const high = Number.isFinite(Number(day?.hiF)) ? `high ${Math.round(Number(day.hiF))}` : "high unavailable";
  const low = Number.isFinite(Number(day?.loF)) ? `low ${Math.round(Number(day.loF))}` : "low unavailable";
  return `${baseLabel}, ${high}, ${low}`;
}

/**
 * @typedef {Object} DailyForecastPoint
 * @property {string} dateISO
 * @property {string} dayLabel
 * @property {number} hiF
 * @property {number} loF
 * @property {string} condition
 * @property {boolean} [isNightIcon]
 * @property {'none'|'rain'|'snow'|'mix'} [precipType]
 * @property {number} [precipChance]
 * @property {number} [windMph]
 * @property {number} [humidity]
 * @property {boolean} [isToday]
 */

/**
 * @param {{
 *   days: DailyForecastPoint[],
 *   expandedIndex?: number | null,
 *   onToggleDay: (index:number)=>void
 * }} props
 */
export default function DailyForecastListCard({
  days,
  expandedIndex = null,
  onToggleDay,
}) {
  const safeDays = useMemo(() => (Array.isArray(days) ? days : []), [days]);

  return (
    <section className="wf-card wf-daily-card" aria-label="Daily forecast">
      <header className="wf-card-head">
        <h4>7-Day Forecast</h4>
        <span>Tap a row for details</span>
      </header>
      {safeDays.length ? (
        <div className="wf-daily-list">
          {safeDays.map((day, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <article
                key={`${day?.dateISO || "day"}-${index}`}
                className={`wf-daily-row${isExpanded ? " is-expanded" : ""}`}
              >
                <button
                  type="button"
                  className="wf-daily-row-head"
                  onClick={() => onToggleDay(index)}
                  aria-expanded={isExpanded}
                  aria-controls={`wf-daily-panel-${index}`}
                  aria-label={buildDayAriaLabel(day)}
                >
                  <div className="wf-daily-primary">
                    <div className="wf-daily-text">
                      <div className="wf-daily-meta">
                        <span className="wf-daily-date">{formatDateLabel(day?.dateISO)}</span>
                        {day?.isToday ? <span className="wf-today-chip">Today</span> : null}
                      </div>
                      <strong className="wf-daily-label">{day?.dayLabel || "--"}</strong>
                    </div>
                  </div>
                  <span className="wf-daily-condition-icon">
                    {getWeatherIcon(day?.condition, Boolean(day?.isNightIcon), day?.precipType, {
                      size: 24,
                    })}
                  </span>
                  <div className="wf-daily-hi-lo">
                    <strong className="wf-hi">
                      {Number.isFinite(Number(day?.hiF)) ? `${Math.round(Number(day?.hiF))}°` : "--"}
                    </strong>
                    <span className="wf-divider">/</span>
                    <span className="wf-lo">
                      {Number.isFinite(Number(day?.loF)) ? `${Math.round(Number(day?.loF))}°` : "--"}
                    </span>
                  </div>
                  <span className="wf-daily-chevron" aria-hidden="true">
                    <i className={`fa-solid ${isExpanded ? "fa-chevron-up" : "fa-chevron-down"}`}></i>
                  </span>
                </button>
                {isExpanded ? (
                  <div
                    id={`wf-daily-panel-${index}`}
                    className="wf-daily-row-body is-open"
                  >
                    <div className="wf-daily-row-body-grid">
                      <div>
                        <span>Condition</span>
                        <strong>{day?.condition || "--"}</strong>
                      </div>
                      <div>
                        <span>Precip chance</span>
                        <strong>
                          {Number.isFinite(Number(day?.precipChance))
                            ? `${Math.round(Number(day?.precipChance))}%`
                            : "--"}
                        </strong>
                      </div>
                      <div>
                        <span>Wind</span>
                        <strong>
                          {Number.isFinite(Number(day?.windMph))
                            ? `${Math.round(Number(day?.windMph))} mph`
                            : "--"}
                        </strong>
                      </div>
                      <div>
                        <span>Humidity</span>
                        <strong>
                          {Number.isFinite(Number(day?.humidity))
                            ? `${Math.round(Number(day?.humidity))}%`
                            : "--"}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="wf-empty">Daily forecast is unavailable.</div>
      )}
    </section>
  );
}
