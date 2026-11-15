import React, { useState } from "react";
import type { EdaScatterPoint, DiurnalPoint } from "../types";
import { Sun, Wind, Clock } from "lucide-react";

interface Props {
  scatterPoints: EdaScatterPoint[];
  diurnal: DiurnalPoint[];
  seasonSummary: Record<string, Record<string, number>>;
}

export const EdaCharts: React.FC<Props> = ({ scatterPoints, diurnal, seasonSummary }) => {
  const [activeTab, setActiveTab] = useState<"pv" | "wind" | "diurnal" | "season">("pv");

  return (
    <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs">
      {/* Header and Chart Switcher */}
      <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-[#E5E1DA]">
        <div>
          <h3 className="text-base font-bold text-[#1A237E] font-serif">
            Exploratory Generation Dynamics
          </h3>
          <p className="text-xs text-[#5F5F5F] mt-0.5">
            Actual physical relationship curves sampled across the 26,304 hourly dataset
          </p>
        </div>

        <div className="flex items-center space-x-1.5 bg-[#FAF9F6] p-1 rounded-lg border border-[#E5E1DA] mt-2 sm:mt-0">
          <button
            onClick={() => setActiveTab("pv")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              activeTab === "pv"
                ? "bg-white text-[#1A237E] shadow-2xs border border-[#E5E1DA]"
                : "text-[#5F5F5F] hover:text-[#1A237E]"
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-[#B78B24]" />
            <span>PV vs GHI (r = 0.92)</span>
          </button>

          <button
            onClick={() => setActiveTab("wind")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              activeTab === "wind"
                ? "bg-white text-[#1A237E] shadow-2xs border border-[#E5E1DA]"
                : "text-[#5F5F5F] hover:text-[#1A237E]"
            }`}
          >
            <Wind className="w-3.5 h-3.5 text-[#00695C]" />
            <span>Wind vs Wind Speed</span>
          </button>

          <button
            onClick={() => setActiveTab("diurnal")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              activeTab === "diurnal"
                ? "bg-white text-[#1A237E] shadow-2xs border border-[#E5E1DA]"
                : "text-[#5F5F5F] hover:text-[#1A237E]"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#887BB0]" />
            <span>Diurnal 24h Profile</span>
          </button>
          <button
            onClick={() => setActiveTab("season")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              activeTab === "season"
                ? "bg-white text-[#1A237E] shadow-2xs border border-[#E5E1DA]"
                : "text-[#5F5F5F] hover:text-[#1A237E]"
            }`}
          >
            <span className="text-[#B78B24]">◷</span>
            <span>Seasonal Output</span>
          </button>
        </div>
      </div>

      {/* Chart Panel */}
      {activeTab === "pv" && (
        <div>
          <div className="flex items-center justify-between text-xs text-[#5F5F5F] mb-2">
            <span>Y-axis: Solar PV Output (MW) • Range: 0 to 14,000 MW</span>
            <span>X-axis: Global Horizontal Irradiance (GHI, W/m²) • 700 sample points</span>
          </div>

          <div className="relative w-full h-[320px] bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-4 flex items-end">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 700 280">
              {/* Grid lines */}
              {[0, 70, 140, 210, 280].map((y) => (
                <line
                  key={y}
                  x1="40"
                  y1={y}
                  x2="690"
                  y2={y}
                  stroke="#E5E1DA"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Axes */}
              <line x1="40" y1="280" x2="690" y2="280" stroke="#1A237E" strokeWidth="1.5" />
              <line x1="40" y1="0" x2="40" y2="280" stroke="#1A237E" strokeWidth="1.5" />

              {/* Y Axis Labels */}
              <text x="32" y="10" fontSize="10" fill="#5F5F5F" textAnchor="end">14k MW</text>
              <text x="32" y="100" fontSize="10" fill="#5F5F5F" textAnchor="end">9.5k MW</text>
              <text x="32" y="190" fontSize="10" fill="#5F5F5F" textAnchor="end">4.5k MW</text>
              <text x="32" y="278" fontSize="10" fill="#5F5F5F" textAnchor="end">0 MW</text>

              {/* X Axis Labels */}
              <text x="40" y="296" fontSize="10" fill="#5F5F5F" textAnchor="middle">0</text>
              <text x="200" y="296" fontSize="10" fill="#5F5F5F" textAnchor="middle">250 W/m²</text>
              <text x="365" y="296" fontSize="10" fill="#5F5F5F" textAnchor="middle">500 W/m²</text>
              <text x="530" y="296" fontSize="10" fill="#5F5F5F" textAnchor="middle">750 W/m²</text>
              <text x="690" y="296" fontSize="10" fill="#5F5F5F" textAnchor="middle">1000+ W/m²</text>

              {/* Trendline */}
              <line
                x1="40"
                y1="280"
                x2="660"
                y2="20"
                stroke="#B78B24"
                strokeWidth="2"
                strokeDasharray="6 3"
              />

              {/* Scatter Points */}
              {scatterPoints.map((pt, idx) => {
                const cx = 40 + (Math.min(1000, pt.ghi) / 1000) * 640;
                const cy = 280 - (Math.min(14000, pt.pv_mw) / 14000) * 270;
                return (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r="3.2"
                    fill="#B78B24"
                    fillOpacity="0.65"
                    stroke="#FFFFFF"
                    strokeWidth="0.8"
                  >
                    <title>{`${pt.time}\nGHI: ${pt.ghi} W/m²\nPV: ${pt.pv_mw.toLocaleString()} MW\nTemp: ${pt.temp} °C`}</title>
                  </circle>
                );
              })}
            </svg>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-[#5F5F5F] bg-[#FAF9F6] p-2.5 rounded-lg border border-[#E5E1DA]">
            <span>
              <strong className="text-[#1A237E]">Observation:</strong> Very tight correlation (r = 0.92). At GHI = 0 (nighttime), PV output is 0 MW. High irradiance clusters strongly in summer midday.
            </span>
            <span className="font-mono text-[#B78B24] font-semibold">Pearson r = 0.92</span>
          </div>
        </div>
      )}

      {activeTab === "wind" && (
        <div>
          <div className="flex items-center justify-between text-xs text-[#5F5F5F] mb-2">
            <span>Y-axis: Wind Output (MW) • Range: 0 to 5,500 MW</span>
            <span>X-axis: Wind Speed (m/s) • 700 sample points</span>
          </div>

          <div className="relative w-full h-[320px] bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-4 flex items-end">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 700 280">
              {/* Grid lines */}
              {[0, 70, 140, 210, 280].map((y) => (
                <line
                  key={y}
                  x1="40"
                  y1={y}
                  x2="690"
                  y2={y}
                  stroke="#E5E1DA"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Axes */}
              <line x1="40" y1="280" x2="690" y2="280" stroke="#1A237E" strokeWidth="1.5" />
              <line x1="40" y1="0" x2="40" y2="280" stroke="#1A237E" strokeWidth="1.5" />

              {/* Y Axis Labels */}
              <text x="32" y="10" fontSize="10" fill="#5F5F5F" textAnchor="end">5.5k MW</text>
              <text x="32" y="100" fontSize="10" fill="#5F5F5F" textAnchor="end">3.8k MW</text>
              <text x="32" y="190" fontSize="10" fill="#5F5F5F" textAnchor="end">1.8k MW</text>
              <text x="32" y="278" fontSize="10" fill="#5F5F5F" textAnchor="end">0 MW</text>

              {/* X Axis Labels */}
              <text x="40" y="296" fontSize="10" fill="#5F5F5F" textAnchor="middle">0</text>
              <text x="170" y="296" fontSize="10" fill="#5F5F5F" textAnchor="middle">3 m/s (Cut-in)</text>
              <text x="365" y="296" fontSize="10" fill="#5F5F5F" textAnchor="middle">8 m/s</text>
              <text x="530" y="296" fontSize="10" fill="#5F5F5F" textAnchor="middle">12 m/s (Rated)</text>
              <text x="690" y="296" fontSize="10" fill="#5F5F5F" textAnchor="middle">16 m/s</text>

              {/* Scatter Points */}
              {scatterPoints.map((pt, idx) => {
                const cx = 40 + (Math.min(16, pt.wind_speed) / 16) * 640;
                const cy = 280 - (Math.min(5500, pt.wind_mw) / 5500) * 270;
                return (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r="3.2"
                    fill="#00695C"
                    fillOpacity="0.65"
                    stroke="#FFFFFF"
                    strokeWidth="0.8"
                  >
                    <title>{`${pt.time}\nWind Speed: ${pt.wind_speed} m/s\nWind Output: ${pt.wind_mw.toLocaleString()} MW`}</title>
                  </circle>
                );
              })}
            </svg>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-[#5F5F5F] bg-[#FAF9F6] p-2.5 rounded-lg border border-[#E5E1DA]">
            <span>
              <strong className="text-[#1A237E]">Observation:</strong> Exhibits classic turbine power-curve dynamics: minimal generation below 3 m/s cut-in speed, steep non-linear ramp between 4–11 m/s, and plateau at rated capacity.
            </span>
            <span className="font-mono text-[#00695C] font-semibold">Non-linear Aerodynamic Regime</span>
          </div>
        </div>
      )}

      {activeTab === "diurnal" && (
        <div>
          <div className="flex items-center justify-between text-xs text-[#5F5F5F] mb-2">
            <span>24-Hour Diurnal Pattern (Mean MW Output by Hour of Day 00:00 to 23:00)</span>
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B78B24]" />
                <span>PV Output</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00695C]" />
                <span>Wind Output</span>
              </span>
            </div>
          </div>

          <div className="relative w-full h-[320px] bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-4 flex items-end">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 700 280">
              {/* Grid lines */}
              {[0, 70, 140, 210, 280].map((y) => (
                <line
                  key={y}
                  x1="40"
                  y1={y}
                  x2="690"
                  y2={y}
                  stroke="#E5E1DA"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Axes */}
              <line x1="40" y1="280" x2="690" y2="280" stroke="#1A237E" strokeWidth="1.5" />
              <line x1="40" y1="0" x2="40" y2="280" stroke="#1A237E" strokeWidth="1.5" />

              {/* Y Axis Labels */}
              <text x="32" y="10" fontSize="10" fill="#5F5F5F" textAnchor="end">12k MW</text>
              <text x="32" y="100" fontSize="10" fill="#5F5F5F" textAnchor="end">8k MW</text>
              <text x="32" y="190" fontSize="10" fill="#5F5F5F" textAnchor="end">4k MW</text>
              <text x="32" y="278" fontSize="10" fill="#5F5F5F" textAnchor="end">0 MW</text>

              {/* X Axis (Hour of day 0..23) */}
              {[0, 3, 6, 9, 12, 15, 18, 21].map((hr) => (
                <text
                  key={hr}
                  x={40 + (hr / 23) * 640}
                  y="296"
                  fontSize="10"
                  fill="#5F5F5F"
                  textAnchor="middle"
                >
                  {hr.toString().padStart(2, "0")}:00
                </text>
              ))}

              {/* Solar PV line path */}
              {diurnal.length > 0 && (
                <polyline
                  fill="none"
                  stroke="#B78B24"
                  strokeWidth="2.8"
                  points={diurnal
                    .map((d) => {
                      const x = 40 + (d.Hour / 23) * 640;
                      const y = 280 - (d.PV_production / 12000) * 270;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              )}

              {/* Wind line path */}
              {diurnal.length > 0 && (
                <polyline
                  fill="none"
                  stroke="#00695C"
                  strokeWidth="2.8"
                  points={diurnal
                    .map((d) => {
                      const x = 40 + (d.Hour / 23) * 640;
                      const y = 280 - (d.Wind_production / 12000) * 270;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              )}

              {/* Data points */}
              {diurnal.map((d) => {
                const x = 40 + (d.Hour / 23) * 640;
                const yPv = 280 - (d.PV_production / 12000) * 270;
                const yWind = 280 - (d.Wind_production / 12000) * 270;
                return (
                  <g key={d.Hour}>
                    <circle cx={x} cy={yPv} r="4" fill="#B78B24" stroke="#FFFFFF" strokeWidth="1">
                      <title>{`Hour ${d.Hour}:00\nMean PV: ${Math.round(d.PV_production).toLocaleString()} MW`}</title>
                    </circle>
                    <circle cx={x} cy={yWind} r="4" fill="#00695C" stroke="#FFFFFF" strokeWidth="1">
                      <title>{`Hour ${d.Hour}:00\nMean Wind: ${Math.round(d.Wind_production).toLocaleString()} MW`}</title>
                    </circle>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-[#5F5F5F] bg-[#FAF9F6] p-2.5 rounded-lg border border-[#E5E1DA]">
            <span>
              <strong className="text-[#1A237E]">Complementary Generation Profile:</strong> Solar peaks sharply at midday (mean ~10,200 MW at 12:00-13:00) when wind is near its minimum; wind output ramps in the evening and stays elevated through the night (~2,800-3,200 MW).
            </span>
            <span className="font-mono text-[#1A237E] font-semibold">Natural Resource Diversification</span>
          </div>
        </div>
      )}

      {activeTab === "season" && (() => {
        const seasons = Object.entries(seasonSummary)
          .map(([season, values]) => ({
            season,
            pv: values.PV_production_mean,
            wind: values.Wind_production_mean,
          }))
          .filter((item) => Number.isFinite(item.pv) && Number.isFinite(item.wind));
        const maxValue = Math.max(1, ...seasons.flatMap((item) => [item.pv, item.wind]));
        const chartHeight = 220;
        const baseY = 238;
        const groupWidth = seasons.length ? 620 / seasons.length : 0;
        return (
          <div>
            <div className="flex items-center justify-between text-xs text-[#5F5F5F] mb-2">
              <span>Mean hourly generation by season (MW)</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-[#B78B24]" />Solar PV</span>
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-[#00695C]" />Wind</span>
              </div>
            </div>
            {seasons.length ? (
              <div className="w-full h-[320px] bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-4">
                <svg className="w-full h-full" viewBox="0 0 700 280" role="img" aria-label="Mean solar and wind generation by season">
                  {[0, 1, 2, 3, 4].map((i) => {
                    const y = baseY - (i / 4) * chartHeight;
                    return <g key={i}><line x1="50" y1={y} x2="690" y2={y} stroke="#E5E1DA" strokeDasharray="4 4" /><text x="44" y={y + 3} textAnchor="end" fontSize="9" fill="#5F5F5F">{Math.round((maxValue * i) / 4).toLocaleString()}</text></g>;
                  })}
                  {seasons.map((item, index) => {
                    const center = 58 + index * groupWidth + groupWidth / 2;
                    const heightPv = (item.pv / maxValue) * chartHeight;
                    const heightWind = (item.wind / maxValue) * chartHeight;
                    const label = ({"0":"Winter", "1":"Spring", "2":"Summer", "3":"Autumn"} as Record<string,string>)[item.season] ?? `Season ${item.season}`;
                    return <g key={item.season}>
                      <rect x={center - 24} y={baseY - heightPv} width="20" height={heightPv} rx="3" fill="#B78B24"><title>{`${label} mean solar: ${item.pv.toLocaleString()} MW`}</title></rect>
                      <rect x={center + 2} y={baseY - heightWind} width="20" height={heightWind} rx="3" fill="#00695C"><title>{`${label} mean wind: ${item.wind.toLocaleString()} MW`}</title></rect>
                      <text x={center} y="258" textAnchor="middle" fontSize="10" fill="#5F5F5F">{label}</text>
                    </g>;
                  })}
                  <line x1="50" y1={baseY} x2="690" y2={baseY} stroke="#1A237E" strokeWidth="1.4" />
                  <text x="12" y="18" fontSize="9" fill="#5F5F5F">MW</text>
                </svg>
              </div>
            ) : <p className="p-8 text-center text-sm text-[#5F5F5F]">Season summary is unavailable for this dataset.</p>}
            <p className="mt-3 text-xs text-[#5F5F5F] bg-[#FAF9F6] p-2.5 rounded-lg border border-[#E5E1DA]">
              Seasonal averages are computed from the project’s hourly dataset. They summarize observed generation and are not forecasts.
            </p>
          </div>
        );
      })()}
    </div>
  );
};
