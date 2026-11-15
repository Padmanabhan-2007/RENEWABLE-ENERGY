import React, { useState } from "react";
import type { ReadingFormValues, PredictResult } from "../types";
import { submitReading } from "../api";
import { AlertCircle, CheckCircle2, ArrowRight, Gauge } from "lucide-react";

interface Props {
  defaultK?: number;
}

const PRESETS: Record<string, { label: string; values: ReadingFormValues }> = {
  midday: {
    label: "Peak Summer Midday",
    values: {
      DHI: 140,
      DNI: 880,
      GHI: 920,
      Wind_speed: 4.2,
      Humidity: 32,
      Temperature: 33,
      PV_production: 11800,
      Wind_production: 1500,
    },
  },
  windy_night: {
    label: "Windy Winter Night",
    values: {
      DHI: 0,
      DNI: 0,
      GHI: 0,
      Wind_speed: 9.8,
      Humidity: 78,
      Temperature: 8,
      PV_production: 0,
      Wind_production: 4200,
    },
  },
  cogeneration: {
    label: "Energetic Co-Generation",
    values: {
      DHI: 160,
      DNI: 760,
      GHI: 840,
      Wind_speed: 8.5,
      Humidity: 44,
      Temperature: 22,
      PV_production: 9600,
      Wind_production: 3800,
    },
  },
  calm_overcast: {
    label: "Calm Overcast Winter",
    values: {
      DHI: 130,
      DNI: 40,
      GHI: 160,
      Wind_speed: 2.3,
      Humidity: 85,
      Temperature: 11,
      PV_production: 1100,
      Wind_production: 750,
    },
  },
};

export const TryReadingForm: React.FC<Props> = ({ defaultK = 2 }) => {
  const [form, setForm] = useState<ReadingFormValues>(PRESETS.midday.values);
  const [k, setK] = useState<number>(defaultK);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResult | null>(null);

  const handleChange = (field: keyof ReadingFormValues, val: number) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleApplyPreset = (presetKey: string) => {
    setForm(PRESETS[presetKey].values);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await submitReading(form, k);
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to assign operating regime");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Input Form Column */}
      <div className="lg:col-span-7 bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-[#E5E1DA]">
          <div>
            <h3 className="text-base font-bold text-[#1A237E] font-serif">
              Try a Reading • Operating Regime Assignment
            </h3>
            <p className="text-xs text-[#5F5F5F] mt-0.5">
              Enter contemporaneous weather & generation readings to classify into a GMM cluster
            </p>
          </div>

          <div className="text-xs font-mono bg-[#FAF9F6] px-2.5 py-1 rounded-md border border-[#E5E1DA] text-[#00695C]">
            Model: PCA (k={k}) + GMM
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-4">
          <span className="text-xs font-semibold text-[#5F5F5F] block mb-2">
            Load Representative Scenario Preset:
          </span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRESETS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleApplyPreset(key)}
                className="px-2.5 py-1 bg-[#FAF9F6] hover:bg-white text-[#1A237E] border border-[#E5E1DA] rounded-md text-xs font-medium cursor-pointer transition shadow-2xs hover:border-[#1A237E]"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Irradiance Inputs */}
            <div>
              <label className="text-xs font-semibold text-[#252525] block mb-1">
                Global Horizontal Irradiance (GHI, W/m²)
              </label>
              <input
                type="number"
                min="0"
                max="1400"
                step="10"
                value={form.GHI}
                onChange={(e) => handleChange("GHI", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-[#E5E1DA] rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#1A237E]"
                required
              />
              <span className="text-[10px] text-[#5F5F5F]">Total surface sunlight (0 at night)</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#252525] block mb-1">
                Direct Normal Irradiance (DNI, W/m²)
              </label>
              <input
                type="number"
                min="0"
                max="1400"
                step="10"
                value={form.DNI}
                onChange={(e) => handleChange("DNI", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-[#E5E1DA] rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#1A237E]"
                required
              />
              <span className="text-[10px] text-[#5F5F5F]">Direct solar beam component</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#252525] block mb-1">
                Diffuse Horizontal Irradiance (DHI, W/m²)
              </label>
              <input
                type="number"
                min="0"
                max="800"
                step="10"
                value={form.DHI}
                onChange={(e) => handleChange("DHI", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-[#E5E1DA] rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#1A237E]"
                required
              />
              <span className="text-[10px] text-[#5F5F5F]">Scattered atmospheric daylight</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#252525] block mb-1">
                Wind Speed (m/s at 10m)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={form.Wind_speed}
                onChange={(e) => handleChange("Wind_speed", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-[#E5E1DA] rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#1A237E]"
                required
              />
              <span className="text-[10px] text-[#5F5F5F]">Turbine cut-in ~3 m/s, rated ~12 m/s</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#252525] block mb-1">
                Ambient Temperature (°C)
              </label>
              <input
                type="number"
                min="-20"
                max="55"
                step="0.5"
                value={form.Temperature}
                onChange={(e) => handleChange("Temperature", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-[#E5E1DA] rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#1A237E]"
                required
              />
              <span className="text-[10px] text-[#5F5F5F]">Inversely correlated with humidity</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#252525] block mb-1">
                Relative Humidity (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.Humidity}
                onChange={(e) => handleChange("Humidity", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-[#E5E1DA] rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#1A237E]"
                required
              />
              <span className="text-[10px] text-[#5F5F5F]">0% to 100% relative saturation</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#252525] block mb-1">
                Solar PV Output (MW)
              </label>
              <input
                type="number"
                min="0"
                max="16000"
                step="50"
                value={form.PV_production}
                onChange={(e) => handleChange("PV_production", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-[#E5E1DA] rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#1A237E]"
                required
              />
              <span className="text-[10px] text-[#5F5F5F]">Measured contemporaneous solar power</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#252525] block mb-1">
                Wind Generation Output (MW)
              </label>
              <input
                type="number"
                min="0"
                max="7000"
                step="50"
                value={form.Wind_production}
                onChange={(e) => handleChange("Wind_production", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 border border-[#E5E1DA] rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#1A237E]"
                required
              />
              <span className="text-[10px] text-[#5F5F5F]">Measured contemporaneous wind power</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-[#5F5F5F]">PCA Dimensions (k):</span>
              <select
                value={k}
                onChange={(e) => setK(parseInt(e.target.value, 10))}
                className="border border-[#E5E1DA] rounded px-2 py-1 text-xs font-mono bg-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((opt) => (
                  <option key={opt} value={opt}>
                    k = {opt} {opt === 2 ? "(Recommended)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#1A237E] hover:bg-[#283593] text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs flex items-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Assigning Regime...</span>
              ) : (
                <>
                  <span>Assign Pattern Regime</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Output / Assignment Card Column */}
      <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
        {result ? (
          <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1DA]">
              <div className="flex items-center space-x-2">
                <span className="p-1 bg-[#00695C]/10 text-[#00695C] rounded">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-[#1A237E] uppercase tracking-wider">
                  Pattern Classification Result
                </span>
              </div>
              <span className="text-xs font-mono text-[#5F5F5F]">PCA k={result.k} • C={result.c}</span>
            </div>

            {/* Assigned Cluster Hero */}
            <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-xl p-4 text-center">
              <span className="text-xs font-semibold text-[#00695C] uppercase tracking-wider block">
                Assigned Operating Regime
              </span>
              <div className="text-2xl font-bold font-serif text-[#1A237E] mt-1">
                {result.assigned_cluster_label}
              </div>
              <div className="text-xs font-medium text-[#252525] mt-1 max-w-xs mx-auto">
                {result.assigned_cluster_name}
              </div>

              <div className="mt-3 inline-flex items-center space-x-1.5 bg-white border border-[#E5E1DA] px-3 py-1 rounded-full text-xs font-mono font-semibold text-[#1A237E] shadow-2xs">
                <span>Posterior Probability:</span>
                <span className="text-[#00695C]">{result.confidence}%</span>
              </div>
            </div>

            {/* Posterior Probabilities Distribution */}
            <div>
              <span className="text-xs font-semibold text-[#5F5F5F] block mb-2">
                Gaussian Mixture Posterior Responsibilities (γ_ik):
              </span>
              <div className="space-y-2">
                {result.probabilities.map((p) => {
                  const pct = Math.round(p.probability * 100);
                  return (
                    <div key={p.cluster_id} className="text-xs">
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className={p.is_assigned ? "font-bold text-[#1A237E]" : "text-[#5F5F5F]"}>
                          {p.cluster_label} • {p.name}
                        </span>
                        <span className="font-mono font-semibold">
                          {(p.probability * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-[#FAF9F6] h-2 rounded-full overflow-hidden border border-[#E5E1DA]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            p.is_assigned ? "bg-[#1A237E]" : "bg-[#887BB0]"
                          }`}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PCA Coordinates */}
            <div className="p-3 bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg text-xs space-y-1">
              <span className="text-[11px] font-semibold text-[#5F5F5F] block">
                Projected Subspace Coordinates (T = Z · V):
              </span>
              <div className="flex space-x-4 font-mono text-xs text-[#1A237E]">
                <span>PC1: {result.pca_coordinates[0]}</span>
                {result.pca_coordinates.length > 1 && (
                  <span>PC2: {result.pca_coordinates[1]}</span>
                )}
                {result.pc3_coordinates.length > 2 && (
                  <span>PC3: {result.pc3_coordinates[2]}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#FAF9F6] border border-dashed border-[#E5E1DA] rounded-xl p-8 text-center flex flex-col items-center justify-center text-[#5F5F5F] h-full min-h-[300px]">
            <Gauge className="w-10 h-10 text-[#887BB0] mb-3 stroke-[1.5]" />
            <h4 className="font-serif font-bold text-sm text-[#1A237E] mb-1">
              Awaiting Input Reading
            </h4>
            <p className="text-xs max-w-xs leading-relaxed">
              Select a representative scenario preset or type manual values, then click "Assign Pattern Regime" to view soft GMM component responsibilities.
            </p>
          </div>
        )}

        {/* Mandatory Methodology Disclaimer */}
        <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed shadow-2xs">
          <div className="flex items-center space-x-1.5 font-bold mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
            <span>Essential Scope Distinction</span>
          </div>
          This model assigns contemporaneous weather and generation conditions to a historical operating regime discovered in the 2019–2021 CAISO/NREL dataset. <strong>It is NOT an energy generation forecast</strong> and does not predict future power output or grid ramp rates.
        </div>
      </div>
    </div>
  );
};
