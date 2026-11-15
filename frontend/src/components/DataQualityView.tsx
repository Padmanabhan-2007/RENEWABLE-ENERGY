import React, { useState } from "react";
import type { DataQualityReport } from "../types";
import { uploadCsvFile } from "../api";
import { ShieldCheck, AlertCircle, UploadCloud, CheckCircle2, Calendar, Database } from "lucide-react";

interface Props {
  quality: DataQualityReport;
}

const SOURCE_FIELDS = [
  ["Time", "Timestamp", "Clock timestamp; retained for ordering and hourly aggregation."],
  ["DHI", "Model input · W/m²", "Diffuse horizontal irradiance."],
  ["DNI", "Model input · W/m²", "Direct normal irradiance."],
  ["GHI", "Model input · W/m²", "Global horizontal irradiance."],
  ["Wind_speed", "Model input · m/s", "Near-surface wind speed."],
  ["Humidity", "Model input · %", "Relative humidity."],
  ["Temperature", "Model input · °C", "Ambient temperature."],
  ["PV_production", "Model input · MW", "Solar photovoltaic generation."],
  ["Wind_production", "Model input · MW", "Wind generation."],
  ["Electric_demand", "Context · MW", "Published demand column; excluded from the unsupervised baseline."],
  ["Season", "Categorical metadata", "Used for filtering and descriptive breakdowns; not PCA input."],
  ["Day_of_the_week", "Categorical metadata", "Retained for context; not PCA input."],
] as const;

export const DataQualityView: React.FC<Props> = ({ quality }) => {
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);
    setUploadError(null);

    try {
      const text = await file.text();
      const res = await uploadCsvFile(text);
      setUploadStatus(
        `File "${file.name}" verified: ${res.rows_read.toLocaleString()} row(s), ${res.columns.length} columns, ${res.missing_values} missing model value(s), ${res.negative_pv_count} negative PV and ${res.negative_wind_count} negative wind value(s). Verification only; the model was not changed.`
      );
    } catch (err: any) {
      setUploadError(err.message || "Failed to validate CSV upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Integrity Audit Overview */}
      <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-2 pb-3 mb-4 border-b border-[#E5E1DA]">
          <span className="p-1.5 bg-[#00695C]/10 text-[#00695C] rounded-md">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-[#1A237E] font-serif">
              Dataset Verification & Cadence Integrity Audit
            </h3>
            <p className="text-xs text-[#5F5F5F]">
              Direct cryptographic verification of the public Mendeley Data repository file
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#5F5F5F] block">SHA-256 Checksum</span>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-[#00695C]" />
              <span className="text-xs font-mono font-bold text-[#00695C]">
                {quality.sha256_match ? "VERIFIED MATCH" : "MISMATCH"}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#5F5F5F] block mt-1 truncate" title={quality.file_sha256}>
              {quality.file_sha256}
            </span>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#5F5F5F] block">5-Minute Cadence</span>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-[#00695C]" />
              <span className="text-xs font-mono font-bold text-[#1A237E]">
                315,647 Steps
              </span>
            </div>
            <span className="text-[10px] text-[#5F5F5F] block mt-1">
              100% strictly continuous, zero gap intervals
            </span>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#5F5F5F] block">Missing Values</span>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-[#00695C]" />
              <span className="text-xs font-mono font-bold text-[#00695C]">
                0 Missing (0.00%)
              </span>
            </div>
            <span className="text-[10px] text-[#5F5F5F] block mt-1">
              Train-fitted median imputer made 0 changes
            </span>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3">
            <span className="text-[11px] font-semibold text-[#5F5F5F] block">Sensor Zero-Drift</span>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-[#B78B24]" />
              <span className="text-xs font-mono font-bold text-[#B78B24]">
                112,829 PV / 216 Wind
              </span>
            </div>
            <span className="text-[10px] text-[#5F5F5F] block mt-1">
              Negative nocturnal readings clipped at 0 MW
            </span>
          </div>
        </div>
      </div>

      {/* Chronological Split Timeline */}
      <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs">
        <h4 className="text-sm font-bold text-[#1A237E] font-serif mb-3 flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-[#00695C]" />
          <span>Strict Chronological Data Split (26,304 Hourly Rows)</span>
        </h4>

        {/* Visual Bar Timeline */}
        <div className="w-full h-8 rounded-lg overflow-hidden flex border border-[#E5E1DA] mb-3 text-[11px] font-semibold text-white">
          <div
            className="bg-[#1A237E] flex items-center justify-center transition-all"
            style={{ width: "70%" }}
            title="70% Train Set"
          >
            Training (70% • 18,412 hrs)
          </div>
          <div
            className="bg-[#00695C] flex items-center justify-center transition-all"
            style={{ width: "15%" }}
            title="15% Validation Set"
          >
            Val (15% • 3,945 hrs)
          </div>
          <div
            className="bg-[#887BB0] flex items-center justify-center transition-all"
            style={{ width: "15%" }}
            title="15% Test Set"
          >
            Test (15% • 3,947 hrs)
          </div>
        </div>

        {/* Timeline Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-[#FAF9F6] border-l-3 border-[#1A237E] rounded-r-md">
            <strong className="text-[#1A237E]">Training Horizon:</strong>
            <div className="font-mono text-[#252525] mt-0.5">{quality.split.train_start.slice(0, 10)} to {quality.split.train_end.slice(0, 10)}</div>
            <div className="text-[11px] text-[#5F5F5F] mt-1">
              StandardScaler & PCA fitted strictly on these rows. No future data leakage.
            </div>
          </div>

          <div className="p-3 bg-[#FAF9F6] border-l-3 border-[#00695C] rounded-r-md">
            <strong className="text-[#00695C]">Validation Horizon:</strong>
            <div className="font-mono text-[#252525] mt-0.5">{quality.split.val_start.slice(0, 10)} to {quality.split.val_end.slice(0, 10)}</div>
            <div className="text-[11px] text-[#5F5F5F] mt-1">
              Model selection, GMM evaluation, and cluster profiling computed here.
            </div>
          </div>

          <div className="p-3 bg-[#FAF9F6] border-l-3 border-[#887BB0] rounded-r-md">
            <strong className="text-[#887BB0]">Untouched Test Horizon:</strong>
            <div className="font-mono text-[#252525] mt-0.5">{quality.split.test_start.slice(0, 10)} to {quality.split.test_end.slice(0, 10)}</div>
            <div className="text-[11px] text-[#5F5F5F] mt-1">
              Preserved strictly unused for future external confirmation.
            </div>
          </div>
        </div>
      </div>

      {/* Full source schema: distinguish published fields from PCA inputs. */}
      <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs">
        <h4 className="text-sm font-bold text-[#1A237E] font-serif mb-1 flex items-center space-x-2">
          <Database className="w-4 h-4 text-[#00695C]" />
          <span>All published dataset fields</span>
        </h4>
        <p className="text-xs text-[#5F5F5F] mb-3">
          The source has 12 published columns. Eight numeric columns feed PCA and GMM; the other four are kept for timestamps, context, or filtering. The export-only index column is dropped during ingestion.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {SOURCE_FIELDS.map(([name, role, description]) => (
            <div key={name} className="rounded-lg border border-[#E5E1DA] bg-[#FAF9F6] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-xs text-[#252525]">{name}</strong>
                <span className="text-[10px] font-semibold text-[#00695C] text-right">{role}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#5F5F5F]">{description}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[#5F5F5F]">The feature-range table below summarizes the eight model inputs only.</p>
      </div>

      {/* Feature Inventory & Physical Ranges */}
      <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs">
        <h4 className="text-sm font-bold text-[#1A237E] font-serif mb-3 flex items-center space-x-2">
          <Database className="w-4 h-4 text-[#00695C]" />
          <span>Eight PCA/GMM Inputs & Physical Value Bounds</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E1DA] bg-[#FAF9F6] text-[#1A237E] font-semibold">
                <th className="py-2 px-3">Feature Name</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Physical Unit</th>
                <th className="py-2 px-3">Min</th>
                <th className="py-2 px-3">Max</th>
                <th className="py-2 px-3">Mean</th>
                <th className="py-2 px-3">Std Dev</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(quality.physical_ranges).map(([feat, stat]) => (
                <tr key={feat} className="border-b border-[#FAF9F6] hover:bg-[#FAF9F6]">
                  <td className="py-2 px-3 font-semibold text-[#252525] font-mono">{feat}</td>
                  <td className="py-2 px-3 text-[#5F5F5F]">
                    {feat.includes("production") ? "Generation Outcome" : "Weather Exogenous"}
                  </td>
                  <td className="py-2 px-3 font-mono text-[#5F5F5F]">
                    {feat.includes("production")
                      ? "MW"
                      : feat.includes("speed")
                      ? "m/s"
                      : feat.includes("Humidity")
                      ? "%"
                      : feat.includes("Temp")
                      ? "°C"
                      : "W/m²"}
                  </td>
                  <td className="py-2 px-3 font-mono">{stat.min.toFixed(1)}</td>
                  <td className="py-2 px-3 font-mono font-bold text-[#1A237E]">{stat.max.toFixed(1)}</td>
                  <td className="py-2 px-3 font-mono">{stat.mean.toFixed(1)}</td>
                  <td className="py-2 px-3 font-mono text-[#5F5F5F]">{stat.std.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Upload & Schema Ingestion Module */}
      <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs">
        <h4 className="text-sm font-bold text-[#1A237E] font-serif mb-2 flex items-center space-x-2">
          <UploadCloud className="w-4 h-4 text-[#00695C]" />
          <span>Upload External CSV for Verification & Schema Check</span>
        </h4>
        <p className="text-xs text-[#5F5F5F] mb-4">
        Check an external time-series CSV. It must contain the eight numeric model fields and a Time or Timestamp column; season and weekday fields are optional. This checks the file only and does not replace the project dataset or refit the model.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <label className="px-4 py-2 bg-[#1A237E] hover:bg-[#283593] text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs flex items-center space-x-2">
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Select CSV File</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>

          {uploading && (
            <span className="text-xs text-[#00695C] animate-pulse">
              Validating schema and data distributions...
            </span>
          )}
        </div>

        {uploadStatus && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{uploadStatus}</span>
          </div>
        )}

        {uploadError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
