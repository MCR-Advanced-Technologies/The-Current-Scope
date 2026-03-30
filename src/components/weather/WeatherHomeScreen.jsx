import React, { useEffect, useMemo, useState } from "react";
import AppBar from "./AppBar";
import HeroCurrentConditions from "./HeroCurrentConditions";
import AlertCard from "./AlertCard";
import HourlyScroller from "./HourlyScroller";
import HourlyCharts from "./HourlyCharts";
import DailyList from "./DailyList";
import "./weatherScreen.css";

export default function WeatherHomeScreen({
  model,
  radar,
  onChangeLocation,
  onOpenMenu,
  onOpenSettings,
  onUseMyLocation,
}) {
  const [selectedHourIndex, setSelectedHourIndex] = useState(0);
  const [selectedChartTab, setSelectedChartTab] = useState("temp");
  const [expandedDailyRowId, setExpandedDailyRowId] = useState("");
  const [pinnedHourIndex, setPinnedHourIndex] = useState(null);
  const [showAlertDetails, setShowAlertDetails] = useState(false);

  const hourly = Array.isArray(model?.hourly) ? model.hourly : [];
  const daily = Array.isArray(model?.daily) ? model.daily : [];
  const activeHour = hourly[selectedHourIndex] || hourly[0] || null;
  const alert = model?.alerts?.[0] || null;

  useEffect(() => {
    if (!hourly.length) {
      setSelectedHourIndex(0);
      return;
    }
    if (selectedHourIndex >= hourly.length) {
      setSelectedHourIndex(0);
    }
  }, [hourly.length, selectedHourIndex]);

  useEffect(() => {
    if (!daily.length) {
      setExpandedDailyRowId("");
      return;
    }
    if (!expandedDailyRowId) return;
    if (!daily.some((item) => item.id === expandedDailyRowId)) {
      setExpandedDailyRowId("");
    }
  }, [daily, expandedDailyRowId]);

  const detailsLine = useMemo(() => {
    if (!activeHour) return "Select an hour to see details.";
    return `${activeHour.condition} • Precip ${activeHour.precipChance}% • Humidity ${activeHour.humidity}% • Wind ${activeHour.wind} mph`;
  }, [activeHour]);

  const toggleDailyRow = (id) => {
    setExpandedDailyRowId((prev) => (prev === id ? "" : id));
  };

  return (
    <section className="wx-screen" aria-label="Weather home and forecast">
      <AppBar
        locationName={model?.location?.name}
        onLocationPress={onChangeLocation}
        onMenuPress={onOpenMenu}
        onSettingsPress={onOpenSettings}
      />

      <HeroCurrentConditions current={model?.current} locationRegion={model?.location?.region} />

      <AlertCard alert={alert} onPress={() => setShowAlertDetails(true)} />

      <section className="wx-radar-card" aria-label="Weather radar">
        <div className="wx-section-header">
          <h3>Radar</h3>
          <div className="wx-radar-head-actions">
            <span>Updated {radar?.updatedAt || "--"}</span>
            <label className="wx-switch" aria-label="Toggle radar auto refresh">
              <input
                type="checkbox"
                checked={Boolean(radar?.autoRefresh)}
                onChange={(event) => radar?.onToggleAutoRefresh?.(event.target.checked)}
              />
              <span>Auto refresh</span>
            </label>
          </div>
        </div>

        <div className="wx-radar-frame" role="application" aria-label="Interactive radar map">
          <div className="wx-radar-map" ref={radar?.mapContainerRef} aria-hidden="true"></div>
          {radar?.loading ? <div className="wx-radar-overlay">Loading radar...</div> : null}
          {radar?.error ? <div className="wx-radar-error">{radar.error}</div> : null}
          <div className="wx-radar-controls" role="group" aria-label="Radar controls">
            <button type="button" onClick={radar?.onZoomOut} aria-label="Zoom out">
              <i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true"></i>
            </button>
            <span>Zoom {radar?.zoom ?? "--"}</span>
            <button type="button" onClick={radar?.onZoomIn} aria-label="Zoom in">
              <i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i>
            </button>
            <button type="button" onClick={radar?.onReset} aria-label="Reset radar view">
              <i className="fa-solid fa-crosshairs" aria-hidden="true"></i>
            </button>
            <button type="button" onClick={radar?.onFullscreen} aria-label="Toggle radar fullscreen">
              <i className={`fa-solid ${radar?.fullscreen ? "fa-compress" : "fa-expand"}`} aria-hidden="true"></i>
            </button>
          </div>
          <button type="button" className="wx-radar-use-location" onClick={onUseMyLocation}>
            Use my location
          </button>
        </div>
        {radar?.focusLabel ? <p className="wx-radar-focus">{radar.focusLabel}</p> : null}
      </section>

      <HourlyScroller
        hourly={hourly}
        selectedHourIndex={selectedHourIndex}
        onSelectHour={setSelectedHourIndex}
        pinnedHourIndex={pinnedHourIndex}
        onPinHour={(index) =>
          setPinnedHourIndex((prev) => (prev === index ? null : index))
        }
      />

      <div className="wx-hourly-details" aria-live="polite">
        <strong>{activeHour?.time || "Now"}</strong>
        <span>{detailsLine}</span>
      </div>

      <HourlyCharts
        hourly={hourly}
        selectedChartTab={selectedChartTab}
        onChangeChartTab={setSelectedChartTab}
        selectedHourIndex={selectedHourIndex}
        onSelectHour={setSelectedHourIndex}
      />

      <DailyList
        daily={daily}
        expandedDailyRowId={expandedDailyRowId}
        onToggleDailyRow={toggleDailyRow}
      />

      {showAlertDetails && alert ? (
        <div className="wx-modal-overlay" onClick={() => setShowAlertDetails(false)}>
          <div
            className="wx-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Weather alert details"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="wx-modal-close" onClick={() => setShowAlertDetails(false)}>
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
            <h3>{alert.title}</h3>
            <p>{alert.message}</p>
            <div className="wx-modal-meta">
              <span>Window: {alert.timeframe}</span>
              <span>Severity: {alert.severity}</span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
