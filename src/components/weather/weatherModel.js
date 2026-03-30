import { mockWeatherData } from "./mockWeatherData";

const AQI_CATEGORIES = [
  { max: 50, category: "Good" },
  { max: 100, category: "Moderate" },
  { max: 150, category: "Unhealthy for Sensitive Groups" },
  { max: 200, category: "Unhealthy" },
  { max: 300, category: "Very Unhealthy" },
  { max: Number.POSITIVE_INFINITY, category: "Hazardous" },
];

/**
 * @typedef {"snow"|"rain"|"cloud"|"clear"|"mix"} PrecipType
 */

/**
 * @typedef {Object} WeatherScreenModel
 * @property {{name:string, region?:string, lat?:number, lon?:number}} location
 * @property {{temp:number, condition:string, hi:number, lo:number, feelsLike:number, wind:number, humidity:number, aqi:{value:number, category:string}}} current
 * @property {Array<{id:string,type:string,title:string,message:string,severity:string,timeframe:string}>} alerts
 * @property {Array<{time:string,iso:string,temp:number,feelsLike:number,condition:string,precipType:PrecipType,precipChance:number,precipAmount:number,wind:number,humidity:number}>} hourly
 * @property {Array<{id:string,date:string,dayLabel:string,hi:number,lo:number,condition:string,precipChance:number,wind:number,sunrise:string,sunset:string,aqi:string}>} daily
 */

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function toDateMs(value) {
  if (!value) return 0;
  const raw = String(value).trim();
  const ts = Date.parse(raw);
  if (!Number.isNaN(ts)) return ts;
  const ts2 = Date.parse(raw.replace(" ", "T") + "Z");
  return Number.isNaN(ts2) ? 0 : ts2;
}

function formatHour(iso, nowTs) {
  const ts = toDateMs(iso);
  if (!ts) return "--";
  if (Math.abs(ts - nowTs) < 45 * 60 * 1000) return "Now";
  return new Date(ts).toLocaleTimeString([], { hour: "numeric" });
}

function formatDayLabel(dateIso, idx) {
  const ts = toDateMs(dateIso);
  if (!ts) return idx === 0 ? "Today" : `Day ${idx + 1}`;
  if (idx === 0) return "Today";
  return new Date(ts).toLocaleDateString([], { weekday: "short" });
}

function derivePrecipType(condition) {
  const text = normalizeText(condition).toLowerCase();
  if (!text) return "cloud";
  const hasSnow = /snow|sleet|ice|blizzard|flurr/.test(text);
  const hasRain = /rain|drizzle|storm|thunder|shower/.test(text);
  if (hasSnow && hasRain) return "mix";
  if (hasSnow) return "snow";
  if (hasRain) return "rain";
  if (/clear|sun|fair/.test(text)) return "clear";
  return "cloud";
}

function aqiCategory(value) {
  const safe = toNum(value, 67);
  return AQI_CATEGORIES.find((entry) => safe <= entry.max)?.category || "Moderate";
}

function getDailyGroupKey(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function summarizeConditions(rows) {
  if (!rows.length) return "Cloudy";
  const bucket = new Map();
  rows.forEach((row) => {
    const condition = normalizeText(row.condition || row.weather_label || row.source || "Cloudy") || "Cloudy";
    bucket.set(condition, (bucket.get(condition) || 0) + 1);
  });
  return [...bucket.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function summarizeAlert(hourly) {
  const next48 = hourly.slice(0, 48);
  const snowCandidates = next48.filter((item) => item.precipType === "snow" || item.precipType === "mix");
  if (!snowCandidates.length) return null;
  const totalAmount = snowCandidates.reduce((sum, item) => sum + toNum(item.precipAmount, 0), 0);
  let message = "Less than 1 inch expected";
  if (totalAmount >= 1 && totalAmount < 3) {
    message = "Around 1 to 3 inches expected";
  } else if (totalAmount >= 3) {
    message = `Around ${Math.round(totalAmount)} inches expected`;
  }
  return {
    id: "snow-48h",
    type: "snow",
    title: "Snowfall next 48 hours",
    message,
    severity: totalAmount >= 3 ? "high" : totalAmount >= 1 ? "medium" : "low",
    timeframe: "48h",
  };
}

/**
 * Build weather home model from backend rows with mock fallback.
 * @param {{weatherRows?:Array<any>, localWeatherCandidate?:any, localLabel?:string}} input
 * @returns {WeatherScreenModel}
 */
export function buildWeatherScreenModel(input = {}) {
  const weatherRows = Array.isArray(input.weatherRows) ? input.weatherRows : [];
  if (!weatherRows.length) return mockWeatherData;

  const candidateLocation = normalizeText(
    input.localWeatherCandidate?.location_name || input.localLabel || ""
  );

  const sortedRows = [...weatherRows]
    .filter((row) => row && (row.weather_time || row.fetched_at))
    .sort((a, b) => toDateMs(a.weather_time || a.fetched_at) - toDateMs(b.weather_time || b.fetched_at));

  const locationName =
    candidateLocation ||
    normalizeText(sortedRows[sortedRows.length - 1]?.location_name) ||
    "Current location";

  const locationRows = sortedRows.filter(
    (row) => normalizeText(row.location_name).toLowerCase() === locationName.toLowerCase()
  );
  const targetRows = locationRows.length ? locationRows : sortedRows;

  const nowTs = Date.now();
  const latest = targetRows[targetRows.length - 1] || {};
  const todayKey = getDailyGroupKey(nowTs);
  const todayRows = targetRows.filter(
    (row) => getDailyGroupKey(toDateMs(row.weather_time || row.fetched_at)) === todayKey
  );
  const tempPool = todayRows.map((row) => toNum(row.temperature, NaN)).filter(Number.isFinite);
  const hi = tempPool.length ? Math.round(Math.max(...tempPool)) : Math.round(toNum(latest.temperature, 0) + 4);
  const lo = tempPool.length ? Math.round(Math.min(...tempPool)) : Math.round(toNum(latest.temperature, 0) - 6);
  const aqiValue = toNum(latest.aqi_value ?? latest.aqi, 67);

  const hourlySource = targetRows
    .filter((row) => {
      const ts = toDateMs(row.weather_time || row.fetched_at);
      return ts >= nowTs - 60 * 60 * 1000;
    })
    .slice(0, 24);

  const hourlyRaw = (hourlySource.length ? hourlySource : targetRows.slice(-24)).map((row, idx) => {
    const iso = row.weather_time || row.fetched_at || new Date(nowTs + idx * 60 * 60 * 1000).toISOString();
    const condition = normalizeText(row.weather_label || row.condition || row.source || "Cloudy") || "Cloudy";
    const precipChance = toNum(
      row.precip_chance ?? row.precip_probability ?? row.precipitation_probability,
      Math.round(Math.max(4, Math.min(95, toNum(row.humidity, 50) * 0.45)))
    );
    return {
      time: formatHour(iso, nowTs),
      iso,
      temp: Math.round(toNum(row.temperature, 0)),
      feelsLike: Math.round(toNum(row.apparent_temperature, row.temperature)),
      condition,
      precipType: derivePrecipType(condition),
      precipChance: Math.round(Math.max(0, Math.min(100, precipChance))),
      precipAmount: Math.max(0, toNum(row.precipitation_amount ?? row.precipitation, 0)),
      wind: Math.round(toNum(row.wind_speed, 0)),
      humidity: Math.round(Math.max(0, Math.min(100, toNum(row.humidity, 0)))),
    };
  });

  if (hourlyRaw.length) {
    hourlyRaw[0].time = "Now";
  }

  const dailyMap = new Map();
  targetRows.forEach((row) => {
    const ts = toDateMs(row.weather_time || row.fetched_at);
    if (!ts) return;
    const key = getDailyGroupKey(ts);
    if (!key) return;
    if (!dailyMap.has(key)) dailyMap.set(key, []);
    dailyMap.get(key).push(row);
  });

  const daily = [...dailyMap.entries()]
    .sort((a, b) => toDateMs(a[0]) - toDateMs(b[0]))
    .slice(0, 7)
    .map(([date, rows], idx) => {
      const temps = rows.map((row) => toNum(row.temperature, NaN)).filter(Number.isFinite);
      const hiTemp = temps.length ? Math.round(Math.max(...temps)) : Math.round(toNum(latest.temperature, 0) + 3);
      const loTemp = temps.length ? Math.round(Math.min(...temps)) : Math.round(toNum(latest.temperature, 0) - 5);
      const precip = rows.map((row) => toNum(row.precip_chance ?? row.precip_probability, 0));
      const winds = rows.map((row) => toNum(row.wind_speed, 0));
      const aqiValues = rows.map((row) => toNum(row.aqi_value ?? row.aqi, aqiValue));
      const precipChance = precip.length ? Math.round(Math.max(...precip)) : 0;
      const wind = winds.length ? Math.round(Math.max(...winds)) : 0;
      const aqiAvg = aqiValues.length
        ? Math.round(aqiValues.reduce((sum, value) => sum + value, 0) / aqiValues.length)
        : aqiValue;
      return {
        id: date,
        date,
        dayLabel: formatDayLabel(date, idx),
        hi: hiTemp,
        lo: loTemp,
        condition: summarizeConditions(rows),
        precipChance,
        wind,
        sunrise: "6:28 AM",
        sunset: "5:52 PM",
        aqi: `${aqiAvg} (${aqiCategory(aqiAvg)})`,
      };
    });

  const alert = summarizeAlert(hourlyRaw);

  return {
    location: {
      name: locationName,
      region: normalizeText(latest.country_code || ""),
      lat: toNum(latest.latitude, NaN),
      lon: toNum(latest.longitude, NaN),
    },
    current: {
      temp: Math.round(toNum(latest.temperature, 0)),
      condition: normalizeText(latest.weather_label || latest.condition || latest.source || "Cloudy") || "Cloudy",
      hi,
      lo,
      feelsLike: Math.round(toNum(latest.apparent_temperature, latest.temperature)),
      wind: Math.round(toNum(latest.wind_speed, 0)),
      humidity: Math.round(Math.max(0, Math.min(100, toNum(latest.humidity, 0)))),
      aqi: {
        value: aqiValue,
        category: aqiCategory(aqiValue),
      },
    },
    alerts: alert ? [alert] : [],
    hourly: hourlyRaw.length ? hourlyRaw : mockWeatherData.hourly,
    daily: daily.length ? daily : mockWeatherData.daily,
  };
}
