import React from "react";
import type { MethodComparisonData } from "../types";
import { ShieldCheck, AlertTriangle } from "lucide-react";

interface Props {
  comparisonData: MethodComparisonData;
}

export const MethodComparison: React.FC<Props> = ({ comparisonData }) => {
  return (
    <div className="space-y-6">
      {/* Comparison Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {comparisonData.methods.map((m, idx) => {
          const isRecommended = idx === 0;
          return (
            <div
              key={m.name}
              className={`bg-white border rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                isRecommended
                  ? "border-[#1A237E] ring-1 ring-[#1A237E]/20"
                  : "border-[#E5E1DA]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      isRecommended
                        ? "bg-[#1A237E] text-white"
                        : "bg-[#FAF9F6] border border-[#E5E1DA] text-[#5F5F5F]"
                    }`}
                  >
                    {isRecommended ? "★ Recommended" : "Baseline"}
                  </span>
                  <span className="text-xs font-mono text-[#5F5F5F]">
                    {m.k === 8 ? "Full 8D" : `k=${m.k} PCs`}
                  </span>
                </div>

                <h4 className="text-base font-bold font-serif text-[#1A237E] mb-1">
                  {m.name}
                </h4>

                <div className="space-y-2 mt-4 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#FAF9F6]">
                    <span className="text-[#5F5F5F]">Membership:</span>
                    <strong className="text-[#252525]">{m.membership}</strong>
                  </div>

                  <div className="flex justify-between py-1 border-b border-[#FAF9F6]">
                    <span className="text-[#5F5F5F]">Cluster Geometry:</span>
                    <strong className="text-[#252525]">{m.cluster_shape}</strong>
                  </div>

                  <div className="flex justify-between py-1 border-b border-[#FAF9F6]">
                    <span className="text-[#5F5F5F]">Silhouette Score:</span>
                    <strong
                      className={`font-mono text-sm ${
                        isRecommended ? "text-[#00695C] font-bold" : "text-[#252525]"
                      }`}
                    >
                      {m.silhouette.toFixed(3)}
                    </strong>
                  </div>

                  <div className="flex justify-between py-1 border-b border-[#FAF9F6]">
                    <span className="text-[#5F5F5F]">Davies–Bouldin Index:</span>
                    <strong
                      className={`font-mono text-sm ${
                        isRecommended ? "text-[#1A237E] font-bold" : "text-[#252525]"
                      }`}
                    >
                      {m.davies_bouldin.toFixed(3)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E5E1DA] text-xs text-[#5F5F5F] leading-snug">
                {m.rank_note}
              </div>
            </div>
          );
        })}
      </div>

      {/* Algorithmic Decision Analysis */}
      <div className="bg-white border border-[#E5E1DA] rounded-xl p-6 shadow-xs space-y-4">
        <h4 className="text-base font-bold text-[#1A237E] font-serif">
          Methodological Rationale & Comparative Takeaways
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-[#252525] leading-relaxed">
          <div className="bg-[#FAF9F6] border border-[#E5E1DA] p-4 rounded-lg space-y-2">
            <div className="font-bold text-[#1A237E] flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-[#00695C]" />
              <span>Why GMM Over K-Means for Renewable Regimes?</span>
            </div>
            <p className="text-[#5F5F5F]">
              While PCA + K-Means yields a slightly higher validation silhouette (0.252 vs 0.242), K-Means enforces spherical clusters and hard Voronoi partitions. Operating weather states are rarely spherical and frequently overlap (e.g. morning sun with lingering nocturnal wind). GMM provides full covariance matrices that follow tilted distributions and outputs posterior probabilities (γ_ik), preserving operational uncertainty.
            </p>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E5E1DA] p-4 rounded-lg space-y-2">
            <div className="font-bold text-[#1A237E] flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-[#B78B24]" />
              <span>Why PCA Before GMM is Indispensable</span>
            </div>
            <p className="text-[#5F5F5F]">
              Directly fitting GMM on all 8 standardized features collapses the Silhouette score from 0.242 down to <strong>0.098</strong> and degrades the Davies-Bouldin index to <strong>2.423</strong>. In 8D, strong collinearity (GHI–DNI 0.92, PV–GHI 0.92) causes parameter inflation (180 covariance elements) and ill-conditioned covariance matrices. PCA eliminates collinearity, stabilizing full covariance estimation.
            </p>
          </div>
        </div>

        {/* Standard Evaluation Environment Notice */}
        <div className="p-3 bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg text-xs text-[#5F5F5F] flex items-center justify-between">
          <span>
            <strong>Evaluation Standard:</strong> All 3 baselines scored on the identical 3,000-point validation sample in the common standardized 8-feature metric space.
          </span>
          <span className="font-mono text-[#1A237E]">Deterministic Random Seed 42</span>
        </div>
      </div>
    </div>
  );
};
