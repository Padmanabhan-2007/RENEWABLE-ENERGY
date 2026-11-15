import React, { useState } from "react";
import type { PcaSweepData, PcaLoadingsData } from "../types";
import { Sliders, Download } from "lucide-react";

interface Props {
  sweepData: PcaSweepData;
  loadingsData: PcaLoadingsData;
  selectedK: number;
  onSelectK: (k: number) => void;
}

export const PcaLab: React.FC<Props> = ({
  sweepData,
  loadingsData,
  selectedK,
  onSelectK,
}) => {
  const [activeTab, setActiveTab] = useState<"table" | "scree" | "loadings">("table");

  const currentEntry =
    sweepData.sweep.find((s) => s.k === selectedK) || sweepData.sweep[1]; // default k=2

  const handleExportSweep = () => {
    window.open("/api/export/sweep", "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Retained Dimension Interactive Controller */}
      <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-[#E5E1DA]">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-[#1A237E]/10 text-[#1A237E] rounded-md">
                <Sliders className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-[#1A237E] font-serif">
                PCA Dimension Laboratory (k = 1 … 8)
              </h3>
            </div>
            <p className="text-xs text-[#5F5F5F] mt-1">
              Select retained principal components to evaluate information retention vs clustering geometry
            </p>
          </div>

          {/* Quick Selector Pills & CSV Export */}
          <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
            <div className="flex items-center space-x-1 bg-[#FAF9F6] p-1 rounded-lg border border-[#E5E1DA]">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => {
                const isSelected = selectedK === k;
                const isRec = k === 2;
                return (
                  <button
                    key={k}
                    onClick={() => onSelectK(k)}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition cursor-pointer flex items-center space-x-1 ${
                      isSelected
                        ? "bg-[#1A237E] text-white shadow-xs"
                        : "text-[#5F5F5F] hover:bg-white hover:text-[#1A237E]"
                    }`}
                  >
                    <span>k={k}</span>
                    {isRec && <span className="text-[10px] text-[#B78B24]">★</span>}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleExportSweep}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#FAF9F6] hover:bg-white text-[#1A237E] border border-[#E5E1DA] rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
              title="Download full 8-dimension sweep table as CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#00695C]" />
              <span>Export Sweep CSV</span>
            </button>
          </div>
        </div>

        {/* Selected Dimension Metric Readout */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#5F5F5F] block">Retained PCs</span>
            <span className="text-xl font-bold font-mono text-[#1A237E]">k = {selectedK}</span>
            <span className="text-[10px] text-[#00695C] block mt-0.5">
              {selectedK === 2 ? "★ Recommended" : `${8 - selectedK} dimensions dropped`}
            </span>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#5F5F5F] block">Cumulative EVR</span>
            <span className="text-xl font-bold font-mono text-[#00695C]">{currentEntry.cum_evr}%</span>
            <span className="text-[10px] text-[#5F5F5F] block mt-0.5">Signal retained</span>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#5F5F5F] block">Reconstruction Error</span>
            <span className="text-xl font-bold font-mono text-[#B78B24]">{currentEntry.recon_error}%</span>
            <span className="text-[10px] text-[#5F5F5F] block mt-0.5">Frobenius residual</span>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#5F5F5F] block">Validation Silhouette</span>
            <span className={`text-xl font-bold font-mono ${selectedK === 2 ? "text-[#1A237E]" : "text-[#5F5F5F]"}`}>
              {currentEntry.silhouette.toFixed(3)}
            </span>
            <span className="text-[10px] text-[#5F5F5F] block mt-0.5">
              {selectedK === 2 ? "Peak separation" : "Lower cohesion"}
            </span>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#5F5F5F] block">Davies–Bouldin</span>
            <span className="text-xl font-bold font-mono text-[#252525]">
              {currentEntry.davies_bouldin.toFixed(3)}
            </span>
            <span className="text-[10px] text-[#5F5F5F] block mt-0.5">Lower is preferred</span>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#5F5F5F] block">GMM Components C</span>
            <span className="text-xl font-bold font-mono text-[#887BB0]">C = {currentEntry.c_selected}</span>
            <span className="text-[10px] text-[#5F5F5F] block mt-0.5">Chosen by train BIC</span>
          </div>
        </div>

        {/* Tradeoff Explanation Box */}
        <div className="mt-4 p-3.5 bg-[#FAF9F6] border-l-4 border-[#B78B24] rounded-r-lg text-xs leading-relaxed text-[#252525]">
          <strong className="text-[#1A237E] font-serif">Tradeoff Analysis (k=2 vs k=3):</strong>{" "}
          {sweepData.tradeoff_explanation}
        </div>
      </div>

      {/* View Tabs: Reference Table | Scree Plot | Loadings Matrix */}
      <div className="bg-white border border-[#E5E1DA] rounded-xl overflow-hidden shadow-xs">
        <div className="flex border-b border-[#E5E1DA] bg-[#FAF9F6] px-4 pt-3 space-x-4">
          <button
            onClick={() => setActiveTab("table")}
            className={`pb-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "table"
                ? "border-[#1A237E] text-[#1A237E]"
                : "border-transparent text-[#5F5F5F] hover:text-[#1A237E]"
            }`}
          >
            Dimension Sweep Table (Slide 08 Reference)
          </button>

          <button
            onClick={() => setActiveTab("scree")}
            className={`pb-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "scree"
                ? "border-[#1A237E] text-[#1A237E]"
                : "border-transparent text-[#5F5F5F] hover:text-[#1A237E]"
            }`}
          >
            Scree Plot & Eigenvalues
          </button>

          <button
            onClick={() => setActiveTab("loadings")}
            className={`pb-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "loadings"
                ? "border-[#1A237E] text-[#1A237E]"
                : "border-transparent text-[#5F5F5F] hover:text-[#1A237E]"
            }`}
          >
            PCA Loadings Matrix (Eigenvectors)
          </button>
        </div>

        <div className="p-5">
          {activeTab === "table" && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E1DA] bg-[#FAF9F6] text-[#1A237E] font-semibold">
                      <th className="py-2.5 px-3">PCs Retained (k)</th>
                      <th className="py-2.5 px-3">C by BIC</th>
                      <th className="py-2.5 px-3">Cumulative EVR</th>
                      <th className="py-2.5 px-3">Reconstruction Error</th>
                      <th className="py-2.5 px-3">Silhouette</th>
                      <th className="py-2.5 px-3">Davies–Bouldin</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sweepData.sweep.map((row) => {
                      const isCurrent = row.k === selectedK;
                      const isRec = row.k === 2;
                      return (
                        <tr
                          key={row.k}
                          onClick={() => onSelectK(row.k)}
                          className={`border-b border-[#E5E1DA] transition cursor-pointer ${
                            isCurrent
                              ? "bg-[#1A237E]/5 font-semibold text-[#1A237E]"
                              : "hover:bg-[#FAF9F6] text-[#252525]"
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold">
                            k = {row.k}
                          </td>
                          <td className="py-2.5 px-3 font-mono">{row.c_selected}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#00695C]">
                            {row.cum_evr.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#B78B24]">
                            {row.recon_error.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                isRec
                                  ? "bg-[#1A237E] text-white font-bold"
                                  : "text-[#252525]"
                              }`}
                            >
                              {row.silhouette.toFixed(3)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {row.davies_bouldin.toFixed(3)}
                          </td>
                          <td className="py-2.5 px-3">
                            {isRec ? (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#B78B24] bg-[#B78B24]/10 px-2 py-0.5 rounded-full">
                                <span>★ Selected Model</span>
                              </span>
                            ) : (
                              <span className="text-[#5F5F5F] text-[11px]">Evaluated</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-[#5F5F5F] mt-3">
                Evaluation metrics measured on the identical deterministic 3,000-point validation sample in common standardized 8-feature metric space. BIC computed on deterministic 10,000-point training sample.
              </p>
            </div>
          )}

          {activeTab === "scree" && (
            <div>
              <div className="flex items-center justify-between text-xs text-[#5F5F5F] mb-3">
                <span>Eigenvalues & Variance Ratio by Principal Component</span>
                <div className="flex items-center space-x-3">
                  <span className="flex items-center space-x-1">
                    <span className="w-3 h-3 bg-[#1A237E] rounded-xs" />
                    <span>Individual EVR</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-3 h-0.5 bg-[#B78B24]" />
                    <span>Cumulative EVR</span>
                  </span>
                </div>
              </div>

              {/* Scree SVG chart */}
              <div className="relative w-full h-[280px] bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-4 flex items-end">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 680 240">
                  {/* Horizontal grid lines */}
                  {[0, 60, 120, 180, 240].map((y) => (
                    <line
                      key={y}
                      x1="40"
                      y1={y}
                      x2="670"
                      y2={y}
                      stroke="#E5E1DA"
                      strokeDasharray="4 4"
                    />
                  ))}

                  <line x1="40" y1="240" x2="670" y2="240" stroke="#1A237E" strokeWidth="1.5" />
                  <line x1="40" y1="0" x2="40" y2="240" stroke="#1A237E" strokeWidth="1.5" />

                  {/* Y Axis percentage markers */}
                  <text x="32" y="10" fontSize="10" fill="#5F5F5F" textAnchor="end">100%</text>
                  <text x="32" y="70" fontSize="10" fill="#5F5F5F" textAnchor="end">75%</text>
                  <text x="32" y="130" fontSize="10" fill="#5F5F5F" textAnchor="end">50%</text>
                  <text x="32" y="190" fontSize="10" fill="#5F5F5F" textAnchor="end">25%</text>
                  <text x="32" y="238" fontSize="10" fill="#5F5F5F" textAnchor="end">0%</text>

                  {/* Bars for individual EVR */}
                  {loadingsData.evr.map((evr, i) => {
                    const x = 70 + i * 72;
                    const barHeight = evr * 240;
                    const y = 240 - barHeight;
                    const isSelected = i < selectedK;
                    return (
                      <g key={i}>
                        <rect
                          x={x - 18}
                          y={y}
                          width="36"
                          height={barHeight}
                          fill={isSelected ? "#1A237E" : "#887BB0"}
                          rx="3"
                          fillOpacity={isSelected ? 0.9 : 0.5}
                        />
                        <text
                          x={x}
                          y={y - 6}
                          fontSize="10"
                          fontFamily="monospace"
                          fill="#1A237E"
                          textAnchor="middle"
                          fontWeight="bold"
                        >
                          {(evr * 100).toFixed(1)}%
                        </text>
                        <text
                          x={x}
                          y="256"
                          fontSize="11"
                          fontFamily="monospace"
                          fill="#252525"
                          textAnchor="middle"
                        >
                          PC{i + 1}
                        </text>
                      </g>
                    );
                  })}

                  {/* Cumulative line path */}
                  <polyline
                    fill="none"
                    stroke="#B78B24"
                    strokeWidth="2.5"
                    points={loadingsData.cum_evr
                      .map((cum, i) => {
                        const x = 70 + i * 72;
                        const y = 240 - cum * 240;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />

                  {loadingsData.cum_evr.map((cum, i) => {
                    const x = 70 + i * 72;
                    const y = 240 - cum * 240;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="#B78B24"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      >
                        <title>{`PC1-PC${i + 1} Cumulative: ${(cum * 100).toFixed(1)}%`}</title>
                      </circle>
                    );
                  })}
                </svg>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-[#5F5F5F]">
                <span>
                  Elbow observed after PC2: PC1 (61.2%) + PC2 (16.2%) = <strong>77.4%</strong> cumulative explained variance.
                </span>
                <span className="font-mono text-[#00695C]">Eigenvalue λ₁ = {loadingsData.eigenvalues[0]}, λ₂ = {loadingsData.eigenvalues[1]}</span>
              </div>
            </div>
          )}

          {activeTab === "loadings" && (
            <div>
              <p className="text-xs text-[#5F5F5F] mb-3">
                Orthogonal loading vectors showing the projection weight of each standardized feature across principal components:
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E1DA] bg-[#FAF9F6] text-[#1A237E] font-semibold">
                      <th className="py-2 px-3">Original Feature</th>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <th
                          key={i}
                          className={`py-2 px-3 font-mono ${
                            i <= selectedK ? "text-[#1A237E] font-bold" : "text-[#5F5F5F]"
                          }`}
                        >
                          PC{i}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingsData.features.map((feat, fIdx) => (
                      <tr key={feat} className="border-b border-[#E5E1DA] hover:bg-[#FAF9F6]">
                        <td className="py-2 px-3 font-semibold text-[#252525]">{feat}</td>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
                          const val = loadingsData.loadings[`PC${i}`]?.[fIdx] ?? 0;
                          const isHigh = Math.abs(val) > 0.35;
                          return (
                            <td
                              key={i}
                              className={`py-2 px-3 font-mono ${
                                isHigh ? "font-bold text-[#00695C] bg-[#00695C]/5" : "text-[#5F5F5F]"
                              }`}
                            >
                              {val > 0 ? `+${val.toFixed(3)}` : val.toFixed(3)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 p-3 bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg text-xs text-[#5F5F5F]">
                <strong className="text-[#1A237E]">Factor Interpretation:</strong> PC1 is heavily loaded on solar irradiance and PV production (+0.41 to +0.44), representing daytime solar energy input. PC2 is heavily loaded on wind speed and wind generation (+0.54 to +0.58), isolating aerodynamic generation patterns.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
