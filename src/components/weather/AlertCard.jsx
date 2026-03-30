import React from "react";

export default function AlertCard({ alert, onPress }) {
  if (!alert) {
    return <div className="wx-alert-placeholder" aria-hidden="true"></div>;
  }

  return (
    <button
      type="button"
      className={`wx-alert-card severity-${alert.severity || "low"}`}
      onClick={onPress}
      aria-label={`${alert.title}. ${alert.message}. View details.`}
    >
      <div className="wx-alert-left">
        <i className="fa-solid fa-snowflake" aria-hidden="true"></i>
        <div>
          <h3>{alert.title}</h3>
          <p>{alert.message}</p>
        </div>
      </div>
      <div className="wx-alert-right">
        <span>View details</span>
        <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </div>
    </button>
  );
}
