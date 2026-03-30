import React from "react";

function isAqiElevated(value) {
  return Number(value) >= 151;
}

export default function HeroCurrentConditions({ current, locationRegion }) {
  const aqiElevated = isAqiElevated(current?.aqi?.value);
  return (
    <section className="wx-hero" aria-label="Current weather conditions">
      <div className="wx-hero-temp" aria-label={`Current temperature ${current?.temp ?? "--"} degrees`}>
        {Number.isFinite(current?.temp) ? `${Math.round(current.temp)}°` : "--"}
      </div>
      <div className="wx-hero-condition">
        <h2>{current?.condition || "Unknown"}</h2>
        <p>
          Feels like {Number.isFinite(current?.feelsLike) ? `${Math.round(current.feelsLike)}°` : "--"}
          {" • "}
          Wind {Number.isFinite(current?.wind) ? `${Math.round(current.wind)} mph` : "--"}
          {locationRegion ? ` • ${locationRegion}` : ""}
        </p>
      </div>
      <div className="wx-hi-lo" aria-label={`High ${current?.hi ?? "--"} and low ${current?.lo ?? "--"}`}>
        <span className="wx-hi">H {Number.isFinite(current?.hi) ? `${Math.round(current.hi)}°` : "--"}</span>
        <span className="wx-lo">L {Number.isFinite(current?.lo) ? `${Math.round(current.lo)}°` : "--"}</span>
      </div>
      <div className={`wx-aqi-chip${aqiElevated ? " is-alert" : ""}`} aria-live="polite">
        <i className={`fa-solid ${aqiElevated ? "fa-triangle-exclamation" : "fa-wind"}`} aria-hidden="true"></i>
        <span>
          AQI {Number.isFinite(current?.aqi?.value) ? Math.round(current.aqi.value) : "--"}
          {" • "}
          {current?.aqi?.category || "Unknown"}
        </span>
      </div>
    </section>
  );
}
