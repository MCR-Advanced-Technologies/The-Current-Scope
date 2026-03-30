import React from "react";

export default function AppBar({ locationName, onLocationPress, onMenuPress, onSettingsPress }) {
  return (
    <header className="wx-appbar" aria-label="Weather top navigation">
      <button
        type="button"
        className="wx-location-btn"
        onClick={onLocationPress}
        aria-label={`Change location. Current location is ${locationName || "unknown"}`}
      >
        <i className="fa-solid fa-location-dot" aria-hidden="true"></i>
        <span>{locationName || "Select location"}</span>
      </button>
      <div className="wx-appbar-actions">
        <button
          type="button"
          className="wx-icon-btn"
          onClick={onMenuPress}
          aria-label="Open weather menu"
        >
          <i className="fa-solid fa-list" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          className="wx-icon-btn"
          onClick={onSettingsPress}
          aria-label="Open weather settings"
        >
          <i className="fa-solid fa-gear" aria-hidden="true"></i>
        </button>
      </div>
    </header>
  );
}
