import React, { useMemo } from "react";

const ICON_BY_CONDITION = [
  { test: /snow|sleet|ice/i, icon: "fa-snowflake", className: "wx-snow" },
  { test: /rain|drizzle|storm|thunder/i, icon: "fa-cloud-rain", className: "wx-rain" },
  { test: /clear|sun|fair/i, icon: "fa-moon", className: "wx-clear" },
  { test: /cloud|overcast|fog/i, icon: "fa-cloud", className: "wx-cloud" },
];

function resolveConditionIcon(condition) {
  const value = String(condition || "");
  const match = ICON_BY_CONDITION.find((item) => item.test.test(value));
  return match || { icon: "fa-cloud", className: "wx-cloud" };
}

export default function DailyList({ daily, expandedDailyRowId, onToggleDailyRow }) {
  const rows = useMemo(() => (Array.isArray(daily) ? daily : []), [daily]);

  if (!rows.length) {
    return (
      <section className="wx-daily-list" aria-label="Daily forecast loading">
        <div className="wx-section-header">
          <h3>7-Day Forecast</h3>
        </div>
        <div className="wx-chart-empty">No daily forecast available.</div>
      </section>
    );
  }

  const weeklyLow = Math.min(...rows.map((item) => Number(item.lo) || 0));
  const weeklyHigh = Math.max(...rows.map((item) => Number(item.hi) || 0));
  const weeklyRange = Math.max(1, weeklyHigh - weeklyLow);

  return (
    <section className="wx-daily-list" aria-label="7 day forecast">
      <div className="wx-section-header">
        <h3>7-Day Forecast</h3>
      </div>
      <div className="wx-daily-rows">
        {rows.map((item, idx) => {
          const iconInfo = resolveConditionIcon(item.condition);
          const isExpanded = expandedDailyRowId === item.id;
          const highOffset = ((Number(item.hi) - weeklyLow) / weeklyRange) * 100;
          const lowOffset = ((Number(item.lo) - weeklyLow) / weeklyRange) * 100;
          return (
            <article key={item.id || `${item.date}-${idx}`} className={`wx-daily-row${isExpanded ? " is-expanded" : ""}`}>
              <button
                type="button"
                className="wx-daily-head"
                onClick={() => onToggleDailyRow(item.id)}
                aria-expanded={isExpanded}
                aria-controls={`wx-daily-panel-${item.id}`}
              >
                <div className="wx-daily-main">
                  <strong>{item.dayLabel}</strong>
                  <span className="wx-daily-date">{item.date}</span>
                </div>
                <div className={`wx-daily-icon ${iconInfo.className}`} aria-hidden="true">
                  <i className={`fa-solid ${iconInfo.icon}`}></i>
                </div>
                <div className="wx-daily-hi-lo">
                  <span className="wx-hi">{item.hi}°</span>
                  <span className="wx-lo">{item.lo}°</span>
                </div>
                <i className={`fa-solid ${isExpanded ? "fa-chevron-up" : "fa-chevron-down"}`} aria-hidden="true"></i>
              </button>
              <div className="wx-range-track" aria-hidden="true">
                <span className="wx-range-fill" style={{ left: `${lowOffset}%`, width: `${Math.max(2, highOffset - lowOffset)}%` }}></span>
              </div>
              {isExpanded ? (
                <div id={`wx-daily-panel-${item.id}`} className="wx-daily-panel">
                  <div><span>Condition</span><strong>{item.condition || "--"}</strong></div>
                  <div><span>Precip</span><strong>{item.precipChance ?? "--"}%</strong></div>
                  <div><span>Wind</span><strong>{item.wind ?? "--"} mph</strong></div>
                  <div><span>Sunrise</span><strong>{item.sunrise || "--"}</strong></div>
                  <div><span>Sunset</span><strong>{item.sunset || "--"}</strong></div>
                  <div><span>AQI</span><strong>{item.aqi || "--"}</strong></div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
