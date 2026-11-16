import type {
  OverviewData,
  DataQualityReport,
  EdaData,
  PcaSweepData,
  PcaLoadingsData,
  ClusterProfilesData,
  ScatterPoint3D,
  MethodComparisonData,
  PredictResult,
  ReadingFormValues,
} from "./types";

const API_ORIGIN = (
  import.meta.env.VITE_API_BASE_URL ?? ""
).trim().replace(/\/+$/, "");

const BASE_URL = API_ORIGIN
  ? `${API_ORIGIN}/api`
  : "/api";

export async function fetchStatus(): Promise<{ status: string; dataset_loaded: boolean }> {
  const res = await fetch(`${BASE_URL}/status`);
  if (!res.ok) throw new Error("Failed to fetch API status");
  return res.json();
}

export async function fetchOverview(): Promise<OverviewData> {
  const res = await fetch(`${BASE_URL}/overview`);
  if (!res.ok) throw new Error("Failed to fetch project overview");
  return res.json();
}

export async function fetchQuality(): Promise<DataQualityReport> {
  const res = await fetch(`${BASE_URL}/data-quality`);
  if (!res.ok) throw new Error("Failed to fetch data quality audit");
  return res.json();
}

export async function fetchEda(): Promise<EdaData> {
  const res = await fetch(`${BASE_URL}/eda`);
  if (!res.ok) throw new Error("Failed to fetch exploratory data");
  return res.json();
}

export async function fetchPcaSweep(): Promise<PcaSweepData> {
  const res = await fetch(`${BASE_URL}/pca/sweep`);
  if (!res.ok) throw new Error("Failed to fetch PCA dimension sweep");
  return res.json();
}

export async function fetchPcaLoadings(): Promise<PcaLoadingsData> {
  const res = await fetch(`${BASE_URL}/pca/loadings`);
  if (!res.ok) throw new Error("Failed to fetch PCA loadings matrix");
  return res.json();
}

export async function fetchClusters(
  k: number = 2,
  season?: string,
  startDate?: string,
  endDate?: string
): Promise<ClusterProfilesData> {
  const params = new URLSearchParams();
  params.set("k", k.toString());
  if (season && season !== "All") params.set("season", season);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);

  const res = await fetch(`${BASE_URL}/clusters?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch cluster profiles");
  return res.json();
}

export async function fetchScatter(
  k: number = 2,
  season?: string,
  startDate?: string,
  endDate?: string
): Promise<{ points: ScatterPoint3D[]; note: string; count: number; k: number; c: number }> {
  const params = new URLSearchParams();
  params.set("k", k.toString());
  if (season && season !== "All") params.set("season", season);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);

  const res = await fetch(`${BASE_URL}/pca/scatter?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch 3D PCA scatter points");
  return res.json();
}

export async function fetchMethodComparison(): Promise<MethodComparisonData> {
  const res = await fetch(`${BASE_URL}/method-comparison`);
  if (!res.ok) throw new Error("Failed to fetch baseline method comparison");
  return res.json();
}

export async function submitReading(reading: ReadingFormValues, k: number = 2): Promise<PredictResult> {
  const res = await fetch(`${BASE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reading, k }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to process regime assignment");
  }
  return res.json();
}

export async function uploadCsvFile(fileText: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: fileText,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "CSV validation failed");
  }
  return res.json();
}
