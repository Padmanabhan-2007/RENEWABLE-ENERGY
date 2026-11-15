import React, { useEffect, useState } from "react";
import { Navbar } from "./components/Navbar";
import type { NavTab } from "./components/Navbar";
import { MetricCard } from "./components/MetricCard";
import { RenewableScene3D } from "./components/RenewableScene3D";
import { PcaScatter3D } from "./components/PcaScatter3D";
import { CorrelationHeatmap } from "./components/CorrelationHeatmap";
import { EdaCharts } from "./components/EdaCharts";
import { PcaLab } from "./components/PcaLab";
import { ClusterExplorer } from "./components/ClusterExplorer";
import { TryReadingForm } from "./components/TryReadingForm";
import { MethodComparison } from "./components/MethodComparison";
import { DataQualityView } from "./components/DataQualityView";
import { AboutSection } from "./components/AboutSection";

import {
  fetchOverview,
  fetchQuality,
  fetchEda,
  fetchPcaSweep,
  fetchPcaLoadings,
  fetchClusters,
  fetchScatter,
  fetchMethodComparison,
} from "./api";

import type {
  OverviewData,
  DataQualityReport,
  EdaData,
  PcaSweepData,
  PcaLoadingsData,
  ClusterProfilesData,
  ScatterPoint3D,
  MethodComparisonData,
} from "./types";

import {
  Sun,
  Layers,
  Activity,
  Database,
  ArrowRight,
  Clock,
} from "lucide-react";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>("overview");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Core Data States
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [quality, setQuality] = useState<DataQualityReport | null>(null);
  const [eda, setEda] = useState<EdaData | null>(null);
  const [pcaSweep, setPcaSweep] = useState<PcaSweepData | null>(null);
  const [pcaLoadings, setPcaLoadings] = useState<PcaLoadingsData | null>(null);
  const [clusters, setClusters] = useState<ClusterProfilesData | null>(null);
  const [scatterPoints, setScatterPoints] = useState<ScatterPoint3D[]>([]);
  const [comparison, setComparison] = useState<MethodComparisonData | null>(null);

  // Interactive Filter States
  const [selectedK, setSelectedK] = useState<number>(2);
  const [selectedSeason, setSelectedSeason] = useState<string>("All");
  const [scatterNote, setScatterNote] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [
          ov,
          qu,
          ed,
          sw,
          ld,
          cl,
          sc,
          cm,
        ] = await Promise.all([
          fetchOverview(),
          fetchQuality(),
          fetchEda(),
          fetchPcaSweep(),
          fetchPcaLoadings(),
          fetchClusters(2),
          fetchScatter(2),
          fetchMethodComparison(),
        ]);

        setOverview(ov);
        setQuality(qu);
        setEda(ed);
        setPcaSweep(sw);
        setPcaLoadings(ld);
        setClusters(cl);
        setScatterPoints(sc.points);
        setScatterNote(sc.note);
        setComparison(cm);
      } catch (err: any) {
        console.error("Failed to load initial pipeline data:", err);
        setError(err.message || "Failed to connect to ML backend");
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  // Handle dynamic filters (k, season, date range)
  const handleFilterChange = async (
    k: number = selectedK,
    season: string = selectedSeason,
    startDate?: string,
    endDate?: string
  ) => {
    setSelectedK(k);
    setSelectedSeason(season);
    try {
      const [newCl, newSc] = await Promise.all([
        fetchClusters(k, season, startDate, endDate),
        fetchScatter(k, season, startDate, endDate),
      ]);
      setClusters(newCl);
      setScatterPoints(newSc.points);
      setScatterNote(newSc.note);
    } catch (err) {
      console.error("Error updating filters:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 text-white flex items-center justify-center font-bold text-base mb-5 animate-pulse" style={{ borderRadius: 22, background: "linear-gradient(160deg,#6cb6ff,#007aff 50%,#af52de 120%)", boxShadow: "inset 0 1.5px 0 rgb(255 255 255 / 70%), 0 14px 30px -10px rgb(0 100 255 / 60%)" }}>
          SRM
        </div>
        <h2 className="text-lg font-bold font-serif text-[#1A237E] mb-1">
          Renewable Energy Production Pattern Discovery
        </h2>
        <p className="text-xs text-[#5F5F5F] font-mono">
          Loading 315,648 records, fitting PCA eigenvectors & GMM regimes...
        </p>
      </div>
    );
  }

  if (error || !overview || !quality || !eda || !pcaSweep || !pcaLoadings || !clusters || !comparison) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white border border-red-200 p-8 rounded-xl max-w-md shadow-sm">
          <h3 className="text-base font-bold text-red-700 font-serif mb-2">Backend Connection Error</h3>
          <p className="text-xs text-[#5F5F5F] mb-4 leading-relaxed">
            {error || "Could not load pipeline data from http://localhost:8000/api."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#1A237E] text-white text-xs font-semibold rounded-lg hover:bg-[#283593] transition cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col font-sans text-[#252525]">
      <div className="lg-orbs" aria-hidden="true"><i /><i /><i /><i /></div>
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isReady={!loading && !error}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Project Hero Header */}
            <section className="fi-hero">
              <div className="fi-hero-grid">
                <div className="fi-hero-copy">
                  <div className="fi-eyebrow">
                    <span className="fi-chip">21CSE305P · BATCH 9</span>
                    <span>SRM Institute of Science &amp; Technology</span>
                  </div>
                  <h2 className="fi-title">
                    Renewable Energy <em>Production Pattern</em> Discovery
                  </h2>
                  <p className="fi-lede">
                    Unsupervised discovery of recurring operational regimes across 3 years of CAISO/NREL solar irradiance, wind dynamics, and contemporaneous electric generation using Principal Component Analysis and Gaussian Mixture Models.
                  </p>
                  <div className="fi-cta">
                    <button onClick={() => setActiveTab("pca")} className="fi-btn fi-btn-amber">
                      <span>Launch Dimension Lab</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => setActiveTab("try")} className="fi-btn fi-btn-ghost">
                      <span>Try a Reading</span>
                    </button>
                  </div>
                </div>

                <div className="fi-viz" aria-hidden="true">
                  <svg viewBox="0 0 640 380" fill="none" className="fi-viz-svg">
                    <defs>
                      <linearGradient id="fiArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#ffb52e" stopOpacity=".55" />
                        <stop offset="1" stopColor="#ffb52e" stopOpacity="0" />
                      </linearGradient>
                      <radialGradient id="fiSun" cx=".5" cy=".5" r=".5">
                        <stop offset="0" stopColor="#fff2b8" />
                        <stop offset=".55" stopColor="#ffc247" />
                        <stop offset="1" stopColor="#ff9d2e" />
                      </radialGradient>
                      <filter id="fiGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="7" />
                      </filter>
                    </defs>
                    <g stroke="#ffe9c2" strokeOpacity=".12">
                      <path d="M30 70H620M30 130H620M30 190H620M30 250H620" />
                      <path d="M30 70V310M180 70V310M330 70V310M480 70V310M620 70V310" strokeDasharray="2 6" />
                    </g>
                    <path d="M30 310H620" stroke="#ffe9c2" strokeOpacity=".4" />
                    <path d="M40 310 C150 310 190 96 330 96 S 510 310 610 310 V310 H40 Z" fill="url(#fiArea)" />
                    <path d="M40 310 C150 310 190 96 330 96 S 510 310 610 310" stroke="#ffb52e" strokeWidth="9" strokeLinecap="round" opacity=".55" filter="url(#fiGlow)" />
                    <path d="M40 310 C150 310 190 96 330 96 S 510 310 610 310" stroke="#ffd36e" strokeWidth="3" strokeLinecap="round" />
                    <path d="M40 232 C150 196 230 262 340 220 S 520 168 610 206" stroke="#5eead4" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 8" />
                    <path d="M40 252 C150 218 230 282 340 242 S 520 192 610 228" stroke="#5eead4" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 11" />
                    <circle cx="330" cy="96" r="58" fill="#ffb52e" opacity=".18" />
                    <circle cx="330" cy="96" r="38" stroke="#ffd36e" strokeOpacity=".5" strokeDasharray="3 5" />
                    <circle cx="330" cy="96" r="24" fill="url(#fiSun)" />
                    <path d="M330 96 V310" stroke="#ffd36e" strokeOpacity=".4" strokeDasharray="3 5" />
                    <g stroke="#fff4dc" strokeOpacity=".85" strokeWidth="2" strokeLinecap="round">
                      <path d="M520 310 V228 M520 228 l0 -34 M520 228 l29 17 M520 228 l-29 17" />
                      <path d="M580 310 V262 M580 262 l0 -22 M580 262 l19 11 M580 262 l-19 11" />
                    </g>
                    <g fontFamily="JetBrains Mono, monospace" fontSize="11" fill="#ffe9c2" fillOpacity=".6">
                      <text x="32" y="336">00:00</text>
                      <text x="168" y="336">06:00</text>
                      <text x="316" y="336">12:00</text>
                      <text x="466" y="336">18:00</text>
                      <text x="586" y="336">24:00</text>
                      <text x="32" y="62">PV OUTPUT · TYPICAL DAY</text>
                    </g>
                  </svg>
                  <div className="fi-tile fi-tile-a"><b>26,304</b><span>hourly means</span></div>
                  <div className="fi-tile fi-tile-b"><b>8</b><span>features</span></div>
                  <div className="fi-tile fi-tile-c"><b>5</b><span>GMM regimes</span></div>
                </div>
              </div>

              <div className="fi-foot">
                <Clock className="w-4 h-4" />
                <span>
                  <strong>Historical Dataset Coverage:</strong> 2019-01-01 through 2021-12-31 (315,648 five-minute observations resampled to 26,304 hourly means). Historical research scope, not a live streaming feed.
                </span>
              </div>
            </section>

            {/* Data ticker */}
            <div className="fi-ticker" aria-hidden="true">
              <div className="fi-ticker-track">
                {[0, 1].map((n) => (
                  <div className="fi-ticker-set" key={n}>
                    {[
                      "315,648 five-minute rows",
                      "26,304 hourly means",
                      "8 engineered features",
                      "2019 → 2021",
                      "PCA k=2 keeps 77.4% variance",
                      "GMM · 5 operating regimes",
                      "Silhouette 0.242",
                      "CAISO / NREL sources",
                    ].map((t) => (
                      <span key={t}>
                        <i />
                        {t}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Hourly Observations"
                value="26,304"
                subtitle="From 315,648 5-minute raw rows"
                tag="Zero Missing"
                accentColor="navy"
                icon={<Database className="w-4 h-4 text-[#1A237E]" />}
              />
              <MetricCard
                title="Selected Representation"
                value="k = 2 PCs"
                subtitle="Retains 77.4% cumulative variance"
                tag="Elbow Optimum"
                accentColor="teal"
                icon={<Layers className="w-4 h-4 text-[#00695C]" />}
              />
              <MetricCard
                title="GMM Regimes"
                value="C = 5"
                subtitle="BIC tuned on 10,000 train rows"
                tag="Full Covariance"
                accentColor="gold"
                icon={<Sun className="w-4 h-4 text-[#B78B24]" />}
              />
              <MetricCard
                title="Validation Silhouette"
                value="0.242"
                subtitle="Davies–Bouldin: 1.340"
                tag="Peak Cohesion"
                accentColor="lavender"
                icon={<Activity className="w-4 h-4 text-[#887BB0]" />}
              />
            </div>

            {/* 3D Renewable Energy Scene */}
            <RenewableScene3D />

            {/* Core Workflow Architecture Diagram (Slide 02) */}
            <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs">
              <h3 className="text-base font-bold text-[#1A237E] font-serif mb-4">
                Core Methodology Workflow (Slide 02)
              </h3>

              <div className="fi-steps grid grid-cols-1 sm:grid-cols-5 gap-3 text-center">
                <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
                  <span className="text-[10px] font-bold text-[#00695C] uppercase block mb-1">01 • Aligned Records</span>
                  <div className="text-xs font-bold text-[#1A237E]">Weather + Output</div>
                  <p className="text-[11px] text-[#5F5F5F] mt-1">315,648 5-min rows → 26,304 hourly means</p>
                </div>

                <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
                  <span className="text-[10px] font-bold text-[#00695C] uppercase block mb-1">02 • Preprocess</span>
                  <div className="text-xs font-bold text-[#1A237E]">Clip & Scale</div>
                  <p className="text-[11px] text-[#5F5F5F] mt-1">Negative MW at 0 • Chronological 70/15/15 split</p>
                </div>

                <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
                  <span className="text-[10px] font-bold text-[#00695C] uppercase block mb-1">03 • PCA</span>
                  <div className="text-xs font-bold text-[#1A237E]">Retain k PCs</div>
                  <p className="text-[11px] text-[#5F5F5F] mt-1">Orthogonal projection: k=2 retains 77.4% variance</p>
                </div>

                <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
                  <span className="text-[10px] font-bold text-[#00695C] uppercase block mb-1">04 • GMM</span>
                  <div className="text-xs font-bold text-[#1A237E]">Fit Regimes</div>
                  <p className="text-[11px] text-[#5F5F5F] mt-1">C=5 components • Full covariance • Train BIC</p>
                </div>

                <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
                  <span className="text-[10px] font-bold text-[#00695C] uppercase block mb-1">05 • Evaluate</span>
                  <div className="text-xs font-bold text-[#1A237E]">Compare k</div>
                  <p className="text-[11px] text-[#5F5F5F] mt-1">3,000 val hours: Silhouette 0.242, DBI 1.340</p>
                </div>
              </div>
            </div>

            {/* Quick Teaser Charts */}
            <EdaCharts scatterPoints={eda.scatter_sample_700} diurnal={eda.diurnal_cycle} seasonSummary={eda.season_summary} />
          </div>
        )}

        {/* Tab 2: Dataset & Data Quality */}
        {activeTab === "quality" && (
          <DataQualityView quality={quality} />
        )}

        {/* Tab 3: Explore the Data (EDA) */}
        {activeTab === "eda" && (
          <div className="space-y-6">
            <CorrelationHeatmap matrix={eda.correlation_matrix} />
            <EdaCharts scatterPoints={eda.scatter_sample_700} diurnal={eda.diurnal_cycle} seasonSummary={eda.season_summary} />
          </div>
        )}

        {/* Tab 4: PCA Dimension Lab */}
        {activeTab === "pca" && (
          <PcaLab
            sweepData={pcaSweep}
            loadingsData={pcaLoadings}
            selectedK={selectedK}
            onSelectK={(newK) => {
              setSelectedK(newK);
              handleFilterChange(newK, selectedSeason);
            }}
          />
        )}

        {/* Tab 5: Cluster Explorer */}
        {activeTab === "clusters" && (
          <div className="space-y-6">
            <ClusterExplorer
              profiles={clusters}
              onFilterChange={handleFilterChange}
              selectedK={selectedK}
              selectedSeason={selectedSeason}
            />
            <PcaScatter3D
              points={scatterPoints}
              selectedK={selectedK}
              note={scatterNote}
              selectedSeason={selectedSeason}
            />
          </div>
        )}

        {/* Tab 6: Try a Reading */}
        {activeTab === "try" && (
          <TryReadingForm defaultK={selectedK} />
        )}

        {/* Tab 7: Method Comparison */}
        {activeTab === "comparison" && (
          <MethodComparison comparisonData={comparison} />
        )}

        {/* Tab 8: About & Methodology */}
        {activeTab === "about" && (
          <AboutSection team={overview.project_team} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-[#E5E1DA] py-6 text-xs text-[#5F5F5F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-serif font-bold text-[#1A237E]">SRM Institute of Science & Technology</span>
            <span>•</span>
            <span>CTECH Department • Batch 9</span>
          </div>
          <div className="flex items-center space-x-4 font-mono text-[11px]">
            <span>PADMANABHAN S</span>
            <span>BENIT D BINU</span>
            <span>MUHUNTHA VEL</span>
            <span>ABHISHEK R</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
