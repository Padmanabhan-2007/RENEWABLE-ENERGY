import React, { useState } from "react";

interface Props {
  matrix: Record<string, Record<string, number>>;
}

const FEATURE_LABELS: Record<string, string> = {
  DHI: "DHI",
  DNI: "DNI",
  GHI: "GHI",
  Wind_speed: "Wind",
  Humidity: "RH",
  Temperature: "Temp",
  PV_production: "PV",
  Wind_production: "WindGen",
};

export const CorrelationHeatmap: React.FC<Props> = ({ matrix }) => {
  const [hoveredCell, setHoveredCell] = useState<{
    f1: string;
    f2: string;
    val: number;
  } | null>(null);

  const features = Object.keys(matrix);
  if (features.length === 0) return null;

  const getColor = (val: number) => {
    if (val === 1) return "#1A237E"; // Navy for diagonal
    if (val > 0) {
      // Teal to Navy interpolation
      const intensity = Math.min(1, Math.max(0, val));
      if (intensity > 0.8) return `rgba(26, 35, 126, ${intensity})`; // deep navy
      if (intensity > 0.5) return `rgba(0, 105, 92, ${intensity})`;  // teal
      return `rgba(0, 105, 92, ${intensity * 0.7 + 0.15})`;
    } else {
      // Negative correlations (muted terracotta / rose)
      const intensity = Math.min(1, Math.abs(val));
      return `rgba(183, 139, 36, ${intensity * 0.8 + 0.15})`; // warm gold/amber
    }
  };

  const getTextColor = (val: number) => {
    return Math.abs(val) > 0.55 ? "#FFFFFF" : "#252525";
  };

  return (
    <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between mb-4 pb-3 border-b border-[#E5E1DA]">
        <div>
          <h3 className="text-base font-bold text-[#1A237E] font-serif">
            Empirical Feature Correlation Matrix (26,304 Hourly Means)
          </h3>
          <p className="text-xs text-[#5F5F5F] mt-0.5">
            Hourly means across full 2019–2021 dataset • Solar signals correlate at 0.92
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs mt-2 sm:mt-0">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#1A237E]" />
            <span className="text-[#5F5F5F]">Strong Positive (+0.8 to +1.0)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#00695C]" />
            <span className="text-[#5F5F5F]">Moderate (+0.4 to +0.8)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#B78B24]" />
            <span className="text-[#5F5F5F]">Negative (-0.2 to -0.8)</span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-xs font-semibold text-[#5F5F5F] text-left w-20">Feature</th>
              {features.map((f) => (
                <th key={f} className="p-2 text-xs font-bold text-[#1A237E] w-14">
                  {FEATURE_LABELS[f] || f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((f1) => (
              <tr key={f1}>
                <td className="p-2 text-xs font-bold text-[#1A237E] text-left font-mono">
                  {FEATURE_LABELS[f1] || f1}
                </td>
                {features.map((f2) => {
                  const val = matrix[f1]?.[f2] ?? 0;
                  const isHovered = hoveredCell?.f1 === f1 && hoveredCell?.f2 === f2;
                  return (
                    <td
                      key={f2}
                      className="p-1 transition-all"
                      onMouseEnter={() => setHoveredCell({ f1, f2, val })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div
                        className={`h-9 w-12 mx-auto rounded-md flex items-center justify-center text-xs font-mono font-semibold transition-all cursor-pointer ${
                          isHovered ? "ring-2 ring-[#1A237E] scale-105 shadow-sm" : ""
                        }`}
                        style={{
                          backgroundColor: getColor(val),
                          color: getTextColor(val),
                        }}
                      >
                        {val.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Active Cell Inspector */}
      <div className="mt-4 p-3 bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg flex items-center justify-between text-xs">
        {hoveredCell ? (
          <div>
            <strong className="text-[#1A237E]">
              {hoveredCell.f1} ↔ {hoveredCell.f2}:
            </strong>{" "}
            Pearson correlation coefficient r ={" "}
            <span className="font-mono font-bold text-[#00695C]">{hoveredCell.val.toFixed(4)}</span>
            <span className="text-[#5F5F5F] ml-2">
              {hoveredCell.val > 0.85
                ? "— Extreme collinearity justifies dimensionality reduction via PCA."
                : hoveredCell.val < -0.7
                ? "— Strong inverse thermodynamic relationship (temperature vs relative humidity)."
                : hoveredCell.val === 1
                ? "— Identity diagonal."
                : "— Distinct information component."}
            </span>
          </div>
        ) : (
          <div className="text-[#5F5F5F]">
            Hover over any correlation tile to inspect Pearson coefficient r and physical relationship interpretation.
          </div>
        )}

        <div className="text-[11px] font-mono text-[#1A237E] hidden md:block">
          GHI–DNI: 0.92 • PV–GHI: 0.92 • Temp–RH: -0.78
        </div>
      </div>
    </div>
  );
};

