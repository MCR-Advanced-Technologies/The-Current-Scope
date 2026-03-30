import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from "recharts";

const PRECIP_COLORS = {
  snow: "#7dc7ff",
  rain: "#53d6ff",
  cloud: "#94a3b8",
  clear: "#facc15",
  mix: "#7fb8ff",
};

const TAB_OPTIONS = [
  { id: "temp", label: "Temp" },
  { id: "precip", label: "Precip" },
  { id: "wind", label: "Wind" },
];

function HourlyTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="wx-chart-tooltip" role="status" aria-live="polite">
      <strong>{label || row.time}</strong>
      <div>Temp: {Number.isFinite(row.temp) ? `${Math.round(row.temp)}°` : "--"}</div>
      <div>Feels: {Number.isFinite(row.feelsLike) ? `${Math.round(row.feelsLike)}°` : "--"}</div>
      <div>Precip: {Number.isFinite(row.precipChance) ? `${Math.round(row.precipChance)}%` : "--"}</div>
      <div>Wind: {Number.isFinite(row.wind) ? `${Math.round(row.wind)} mph` : "--"}</div>
    </div>
  );
}

export default function HourlyCharts({
  hourly,
  selectedChartTab,
  onChangeChartTab,
  selectedHourIndex,
  onSelectHour,
}) {
  const tooltipPortal = typeof document !== "undefined" ? document.body : null;
  const chartData = useMemo(
    () =>
      (Array.isArray(hourly) ? hourly : []).map((item, index) => ({
        ...item,
        index,
        label: item.time,
        precipChance: Number(item.precipChance) || 0,
        temp: Number(item.temp),
        feelsLike: Number(item.feelsLike),
        wind: Number(item.wind),
      })),
    [hourly]
  );

  if (!chartData.length) {
    return (
      <section className="wx-hourly-charts" aria-label="Hourly chart loading">
        <div className="wx-section-header">
          <h3>Hourly Trends</h3>
          <span>Waiting for data</span>
        </div>
        <div className="wx-chart-empty">No hourly chart data yet.</div>
      </section>
    );
  }

  const moveCursor = (state) => {
    const idx = Number(state?.activeTooltipIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= chartData.length) return;
    onSelectHour(idx);
  };

  const tooltipProps = {
    content: <HourlyTooltip />,
    allowEscapeViewBox: { x: true, y: true },
    wrapperStyle: { zIndex: 2600, pointerEvents: "none" },
  };
  if (tooltipPortal) {
    tooltipProps.portal = tooltipPortal;
  }

  return (
    <section className="wx-hourly-charts" aria-label="Hourly weather charts">
      <div className="wx-section-header">
        <h3>Hourly Trends</h3>
        <div className="wx-segmented" role="tablist" aria-label="Select weather chart">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selectedChartTab === tab.id}
              className={selectedChartTab === tab.id ? "is-active" : ""}
              onClick={() => onChangeChartTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wx-chart-shell" aria-live="polite">
        {selectedChartTab === "temp" ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} onMouseMove={moveCursor} onClick={moveCursor}>
              <CartesianGrid stroke="rgba(148,163,184,0.24)" strokeDasharray="4 4" />
              <XAxis dataKey="label" tick={{ fill: "#a7b6d7", fontSize: 12 }} />
              <YAxis tick={{ fill: "#a7b6d7", fontSize: 12 }} width={34} />
              <Tooltip {...tooltipProps} />
              <ReferenceLine x={selectedHourIndex} stroke="rgba(226,232,240,0.75)" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="temp"
                stroke="#38bdf8"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
                name="Temp"
              />
              <Line
                type="monotone"
                dataKey="feelsLike"
                stroke="#f59e0b"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4 }}
                name="Feels"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : null}

        {selectedChartTab === "precip" ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} onMouseMove={moveCursor} onClick={moveCursor}>
              <CartesianGrid stroke="rgba(148,163,184,0.24)" strokeDasharray="4 4" />
              <XAxis dataKey="label" tick={{ fill: "#a7b6d7", fontSize: 12 }} />
              <YAxis tick={{ fill: "#a7b6d7", fontSize: 12 }} width={34} domain={[0, 100]} />
              <Tooltip {...tooltipProps} />
              <ReferenceLine x={selectedHourIndex} stroke="rgba(226,232,240,0.75)" strokeDasharray="3 3" />
              <Bar dataKey="precipChance" radius={[5, 5, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={`precip-cell-${entry.index}`}
                    fill={PRECIP_COLORS[entry.precipType] || PRECIP_COLORS.cloud}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : null}

        {selectedChartTab === "wind" ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} onMouseMove={moveCursor} onClick={moveCursor}>
              <CartesianGrid stroke="rgba(148,163,184,0.24)" strokeDasharray="4 4" />
              <XAxis dataKey="label" tick={{ fill: "#a7b6d7", fontSize: 12 }} />
              <YAxis tick={{ fill: "#a7b6d7", fontSize: 12 }} width={34} />
              <Tooltip {...tooltipProps} />
              <ReferenceLine x={selectedHourIndex} stroke="rgba(226,232,240,0.75)" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="wind"
                stroke="#a78bfa"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
                name="Wind"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </section>
  );
}
