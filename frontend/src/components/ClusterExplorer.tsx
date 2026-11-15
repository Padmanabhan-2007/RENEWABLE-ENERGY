import React, { useState } from "react";
import type { ClusterProfilesData } from "../types";
import { Download, Filter, Sun, Wind, Thermometer, Droplets, Calendar, Sliders, Info, RotateCcw } from "lucide-react";

interface Props {
  profiles: ClusterProfilesData;
  onFilterChange: (k: number, season: string, startDate?: string, endDate?: string) => void;
  selectedK: number;
  selectedSeason: string;
}

const CLUSTER_ACCENT_COLORS = [
  "#1A237E", // Cluster 1: Navy
  "#00695C", // Cluster 2: Teal
  "#B78B24", // Cluster 3: Warm Gold
  "#887BB0", // Cluster 4: Lavender
  "#D9534F", // Cluster 5: Terracotta
  "#3949AB",
  "#00897B",
  "#C0CA33"
];

export const ClusterExplorer: React.FC<Props> = ({
  profiles,
  onFilterChange,
  selectedK,
  selectedSeason,
}) => {
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    params.set("k", selectedK.toString());
    if (selectedSeason !== "All") params.set("season", selectedSeason);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    window.open(`/api/export/clusters?${params.toString()}`, "_blank");
  };

  const handleApplyDateFilter = () => {
    onFilterChange(selectedK, selectedSeason, startDate || undefined, endDate || undefined);
  };

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    onFilterChange(2, "All", undefined, undefined);
  };

  return (
    <div className="space-y-6">
      {/* Control Bar: k selector, Season filter, Date range, and CSV export */}
      <div className="bg-white border border-[#E5E1DA] rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Dimension Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-[#5F5F5F] flex items-center space-x-1">
              <Sliders className="w-3.5 h-3.5 text-[#1A237E]" />
              <span>Model Space:</span>
            </span>
            <div className="flex items-center space-x-1 bg-[#FAF9F6] p-1 rounded-lg border border-[#E5E1DA]">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((kVal) => (
                <button
                  key={kVal}
                  onClick={() => onFilterChange(kVal, selectedSeason, startDate || undefined, endDate || undefined)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition cursor-pointer ${
                    selectedK === kVal
                      ? "bg-[#1A237E] text-white shadow-2xs"
                      : "text-[#5F5F5F] hover:bg-white hover:text-[#1A237E]"
                  }`}
                  title={`Retained PCA dimension k=${kVal}`}
                >
                  k={kVal}{kVal === 2 ? "★" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Season Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-[#5F5F5F] flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-[#00695C]" />
              <span>Season:</span>
            </span>
            <div className="flex items-center space-x-1 bg-[#FAF9F6] p-1 rounded-lg border border-[#E5E1DA]">
              {["All", "Winter", "Spring", "Summer", "Fall"].map((s) => (
                <button
                  key={s}
                  onClick={() => onFilterChange(selectedK, s, startDate || undefined, endDate || undefined)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                    selectedSeason === s
                      ? "bg-[#00695C] text-white shadow-2xs"
                      : "text-[#5F5F5F] hover:text-[#1A237E] hover:bg-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Export Action */}
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#FAF9F6] hover:bg-white text-[#1A237E] border border-[#E5E1DA] rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
            title="Download cluster records as CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#00695C]" />
            <span>Export Filtered CSV</span>
          </button>
        </div>

        {/* Date Filter Row & Active Filter Chips */}
        <div className="pt-2 border-t border-[#E5E1DA]/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <Calendar className="w-3.5 h-3.5 text-[#887BB0]" />
            <span className="text-[#5F5F5F] font-medium">Validation Date Horizon:</span>
            <input
              type="date"
              min="2021-02-06"
              max="2021-07-20"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-0.5 border border-[#E5E1DA] rounded text-xs font-mono bg-white"
              placeholder="YYYY-MM-DD"
            />
            <span className="text-[#5F5F5F]">to</span>
            <input
              type="date"
              min="2021-02-06"
              max="2021-07-20"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-0.5 border border-[#E5E1DA] rounded text-xs font-mono bg-white"
              placeholder="YYYY-MM-DD"
            />
            <button
              onClick={handleApplyDateFilter}
              className="px-2.5 py-0.5 bg-[#1A237E] text-white rounded text-xs font-medium cursor-pointer hover:bg-[#283593]"
            >
              Apply
            </button>
            {(startDate || endDate || selectedSeason !== "All" || selectedK !== 2) && (
              <button
                onClick={handleResetFilters}
                className="flex items-center space-x-1 text-[#5F5F5F] hover:text-[#1A237E] text-xs underline cursor-pointer ml-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 font-mono text-[11px] text-[#5F5F5F]">
            <span>Hours Profiled: <strong className="text-[#1A237E]">{profiles.total_val_hours}</strong> / 3,945</span>
            <span>•</span>
            <span>Components: <strong className="text-[#00695C]">{profiles.c}</strong></span>
          </div>
        </div>
      </div>

      {/* Tooltip Definitions Bar */}
      <div className="p-3 bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg flex flex-wrap items-center justify-between text-xs gap-2">
        <span className="text-[#5F5F5F] font-semibold flex items-center space-x-1">
          <Info className="w-3.5 h-3.5 text-[#B78B24]" />
          <span>Metric Definitions:</span>
        </span>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span
            onMouseEnter={() => setShowTooltip("gmm")}
            onMouseLeave={() => setShowTooltip(null)}
            className="cursor-help underline text-[#1A237E]"
          >
            Gaussian Mixture Model
          </span>
          <span>•</span>
          <span
            onMouseEnter={() => setShowTooltip("bic")}
            onMouseLeave={() => setShowTooltip(null)}
            className="cursor-help underline text-[#00695C]"
          >
            Bayesian Information Criterion (BIC)
          </span>
          <span>•</span>
          <span
            onMouseEnter={() => setShowTooltip("sil")}
            onMouseLeave={() => setShowTooltip(null)}
            className="cursor-help underline text-[#887BB0]"
          >
            Silhouette Score
          </span>
          <span>•</span>
          <span
            onMouseEnter={() => setShowTooltip("dbi")}
            onMouseLeave={() => setShowTooltip(null)}
            className="cursor-help underline text-[#B78B24]"
          >
            Davies–Bouldin Index (DBI)
          </span>
        </div>
      </div>

      {showTooltip && (
        <div className="p-3 bg-white border border-[#E5E1DA] rounded-lg shadow-sm text-xs text-[#252525] leading-relaxed">
          {showTooltip === "gmm" && (
            <p><strong>GMM (Gaussian Mixture Model):</strong> Probabilistic unsupervised clustering that fits ellipsoidal Gaussian distributions with full covariance matrices, estimating soft posterior probabilities γ_ik for each record instead of rigid spherical boundaries.</p>
          )}
          {showTooltip === "bic" && (
            <p><strong>BIC (Bayesian Information Criterion):</strong> Penalized likelihood metric (BIC = -2 ln L + p ln n) used on a deterministic 10,000-row training sample to select component count C without overfitting.</p>
          )}
          {showTooltip === "sil" && (
            <p><strong>Silhouette Score:</strong> Measures within-cluster cohesion relative to nearest-neighbor separation (-1 to +1; higher is better). Computed in the common standardized 8-feature metric space.</p>
          )}
          {showTooltip === "dbi" && (
            <p><strong>Davies–Bouldin Index:</strong> Measures average cluster similarity and dispersion overlap (lower is preferred). Computed on the identical 3,000-row validation sample.</p>
          )}
        </div>
      )}

      {/* Cluster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {profiles.clusters.map((c) => {
          const accentColor = CLUSTER_ACCENT_COLORS[c.cluster_id % CLUSTER_ACCENT_COLORS.length];
          const isExpanded = expandedCluster === c.cluster_id;

          return (
            <div
              key={c.cluster_id}
              className="bg-white border border-[#E5E1DA] rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all flex flex-col justify-between"
              style={{ borderTop: `4px solid ${accentColor}` }}
            >
              <div className="p-5">
                {/* Cluster Title and Share */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: accentColor }}
                    />
                    <h4 className="text-base font-bold font-serif text-[#1A237E]">
                      {c.cluster_label}
                    </h4>
                  </div>
                  <span
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${accentColor}15`,
                      color: accentColor,
                    }}
                  >
                    {c.share_pct}% Share ({c.count} hrs)
                  </span>
                </div>

                {/* Evidence-Based Empirical Profile Label */}
                <div className="text-xs font-medium text-[#252525] mb-4 bg-[#FAF9F6] p-2 rounded-md border border-[#E5E1DA] leading-tight">
                  {c.name}
                </div>

                {/* Key Power Medians */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-2.5">
                    <div className="flex items-center space-x-1 text-[#B78B24] text-[11px] font-semibold mb-1">
                      <Sun className="w-3.5 h-3.5" />
                      <span>PV Median</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-[#1A237E]">
                      {Math.round(c.pv_median).toLocaleString()} MW
                    </div>
                    <div className="text-[10px] text-[#5F5F5F]">
                      Mean: {Math.round(c.feature_stats["PV_production"]?.mean || 0).toLocaleString()} MW
                    </div>
                  </div>

                  <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-2.5">
                    <div className="flex items-center space-x-1 text-[#00695C] text-[11px] font-semibold mb-1">
                      <Wind className="w-3.5 h-3.5" />
                      <span>Wind Median</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-[#00695C]">
                      {Math.round(c.wind_median).toLocaleString()} MW
                    </div>
                    <div className="text-[10px] text-[#5F5F5F]">
                      Mean: {Math.round(c.feature_stats["Wind_production"]?.mean || 0).toLocaleString()} MW
                    </div>
                  </div>
                </div>

                {/* Weather Characteristics in Original Units */}
                <div className="space-y-1.5 text-xs text-[#252525] border-t border-[#E5E1DA] pt-3">
                  <div className="flex justify-between">
                    <span className="text-[#5F5F5F] flex items-center space-x-1">
                      <Sun className="w-3 h-3 text-[#B78B24]" />
                      <span>GHI Median:</span>
                    </span>
                    <span className="font-mono font-medium">{c.ghi_median} W/m²</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[#5F5F5F] flex items-center space-x-1">
                      <Wind className="w-3 h-3 text-[#00695C]" />
                      <span>Wind Speed:</span>
                    </span>
                    <span className="font-mono font-medium">{c.wind_speed_median} m/s</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[#5F5F5F] flex items-center space-x-1">
                      <Thermometer className="w-3 h-3 text-[#887BB0]" />
                      <span>Temperature:</span>
                    </span>
                    <span className="font-mono font-medium">{c.feature_stats["Temperature"]?.median} °C</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[#5F5F5F] flex items-center space-x-1">
                      <Droplets className="w-3 h-3 text-[#1A237E]" />
                      <span>Humidity:</span>
                    </span>
                    <span className="font-mono font-medium">{c.feature_stats["Humidity"]?.median}%</span>
                  </div>
                </div>

                {/* Expanded Details Table */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-[#E5E1DA] text-[11px] space-y-2">
                    <div className="font-semibold text-[#1A237E]">Full IQR Range (25th – 75th percentile):</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#E5E1DA] text-[#5F5F5F]">
                            <th className="py-1">Feature</th>
                            <th className="py-1">Q25</th>
                            <th className="py-1">Median</th>
                            <th className="py-1">Q75</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(c.feature_stats).map(([feat, stat]) => (
                            <tr key={feat} className="border-b border-[#FAF9F6]">
                              <td className="py-0.5 text-[#252525] font-mono text-[10px]">{feat}</td>
                              <td className="py-0.5 font-mono text-[#5F5F5F]">{stat.q25}</td>
                              <td className="py-0.5 font-mono font-bold text-[#1A237E]">{stat.median}</td>
                              <td className="py-0.5 font-mono text-[#5F5F5F]">{stat.q75}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer toggle */}
              <div className="p-3 bg-[#FAF9F6] border-t border-[#E5E1DA] flex items-center justify-between">
                <button
                  onClick={() => setExpandedCluster(isExpanded ? null : c.cluster_id)}
                  className="text-xs text-[#1A237E] hover:underline font-medium cursor-pointer"
                >
                  {isExpanded ? "Collapse Details" : "Inspect Statistical Profile"}
                </button>
                <span className="text-[10px] text-[#5F5F5F] font-mono">
                  Gaussian Component {c.cluster_id + 1}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scope Disclaimer */}
      <div className="p-4 bg-white border border-[#E5E1DA] rounded-xl shadow-xs text-xs space-y-1.5">
        <h4 className="font-bold text-[#1A237E] font-serif text-sm">
          Grounded Physical Interpretation (Recomputed from Actual Records)
        </h4>
        <p className="text-[#5F5F5F] leading-relaxed">
          Cluster designations and descriptions above are dynamically derived from empirical medians of the filtered validation partition. Component numbers are arbitrary statistical identifiers from the EM algorithm and reflect operating conditions rather than pre-named categories.
        </p>
      </div>
    </div>
  );
};
