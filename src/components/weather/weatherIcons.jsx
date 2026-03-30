import React from "react";

const ICON_TINT_BY_TYPE = {
  snow: "wf-icon-snow",
  rain: "wf-icon-rain",
  cloud: "wf-icon-cloud",
  clear: "wf-icon-clear",
  mix: "wf-icon-mix",
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function resolveWeatherVisual(condition, isNight, precipType) {
  const normalizedCondition = normalizeText(condition);
  const normalizedPrecip = normalizeText(precipType);

  if (normalizedPrecip === "mix") {
    return { iconClass: "fa-cloud-meatball", tintClass: ICON_TINT_BY_TYPE.mix, tone: "mix" };
  }
  if (normalizedPrecip === "snow") {
    return { iconClass: "fa-snowflake", tintClass: ICON_TINT_BY_TYPE.snow, tone: "snow" };
  }
  if (normalizedPrecip === "rain") {
    return { iconClass: "fa-cloud-rain", tintClass: ICON_TINT_BY_TYPE.rain, tone: "rain" };
  }

  if (
    normalizedCondition.includes("snow") ||
    normalizedCondition.includes("blizzard") ||
    normalizedCondition.includes("flurr")
  ) {
    return { iconClass: "fa-snowflake", tintClass: ICON_TINT_BY_TYPE.snow, tone: "snow" };
  }
  if (
    normalizedCondition.includes("sleet") ||
    normalizedCondition.includes("hail") ||
    normalizedCondition.includes("freezing rain") ||
    normalizedCondition.includes("wintry")
  ) {
    return { iconClass: "fa-cloud-meatball", tintClass: ICON_TINT_BY_TYPE.mix, tone: "mix" };
  }
  if (
    normalizedCondition.includes("rain") ||
    normalizedCondition.includes("drizzle") ||
    normalizedCondition.includes("storm") ||
    normalizedCondition.includes("thunder")
  ) {
    return { iconClass: "fa-cloud-rain", tintClass: ICON_TINT_BY_TYPE.rain, tone: "rain" };
  }
  if (
    normalizedCondition.includes("partly") ||
    normalizedCondition.includes("mostly clear") ||
    normalizedCondition.includes("mostly sunny") ||
    normalizedCondition.includes("partly cloudy")
  ) {
    return {
      iconClass: isNight ? "fa-cloud-moon" : "fa-cloud-sun",
      tintClass: ICON_TINT_BY_TYPE.cloud,
      tone: "cloud",
    };
  }
  if (
    normalizedCondition.includes("cloud") ||
    normalizedCondition.includes("overcast") ||
    normalizedCondition.includes("fog") ||
    normalizedCondition.includes("mist")
  ) {
    return { iconClass: "fa-cloud", tintClass: ICON_TINT_BY_TYPE.cloud, tone: "cloud" };
  }
  return {
    iconClass: isNight ? "fa-moon" : "fa-sun",
    tintClass: ICON_TINT_BY_TYPE.clear,
    tone: "clear",
  };
}

export function getWeatherIcon(condition, isNight, precipType, options = {}) {
  const { className = "", size = 26, ariaHidden = true } = options;
  const visual = resolveWeatherVisual(condition, isNight, precipType);
  const composedClassName = [
    "fa-solid",
    visual.iconClass,
    "wf-weather-icon",
    visual.tintClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <i
      className={composedClassName}
      style={{ fontSize: `${Math.max(12, Number(size) || 26)}px` }}
      aria-hidden={ariaHidden}
    />
  );
}

export function inferPrecipType(condition, fallbackType = "none") {
  const normalizedCondition = normalizeText(condition);
  const normalizedFallback = normalizeText(fallbackType) || "none";
  if (["none", "rain", "snow", "mix"].includes(normalizedFallback)) {
    if (normalizedFallback !== "none") return normalizedFallback;
  }
  if (
    normalizedCondition.includes("sleet") ||
    normalizedCondition.includes("freezing rain") ||
    normalizedCondition.includes("hail") ||
    normalizedCondition.includes("wintry")
  ) {
    return "mix";
  }
  if (
    normalizedCondition.includes("snow") ||
    normalizedCondition.includes("flurr") ||
    normalizedCondition.includes("blizzard")
  ) {
    return "snow";
  }
  if (
    normalizedCondition.includes("rain") ||
    normalizedCondition.includes("drizzle") ||
    normalizedCondition.includes("storm") ||
    normalizedCondition.includes("thunder")
  ) {
    return "rain";
  }
  return "none";
}
