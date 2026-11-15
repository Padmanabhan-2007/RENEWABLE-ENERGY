export interface KPIInfo {
  raw_records: number;
  hourly_records: number;
  features_count: number;
  coverage: string;
  selected_k: number;
  selected_c: number;
  explained_variance_pct: number;
  reconstruction_error_pct: number;
  validation_silhouette: number;
  validation_davies_bouldin: number;
  best_model_name: string;
}

export interface TeamMember {
  name: string;
  reg_no: string;
  role: string;
}

export interface TeamInfo {
  institution: string;
  department: string;
  course: string;
  batch: string;
  project_title: string;
  members: TeamMember[];
}

export interface OverviewData {
  kpis: KPIInfo;
  data_source: {
    title: string;
    repository: string;
    doi: string;
    cadence: string;
    scope: string;
    columns: string[];
  };
  project_team: TeamInfo;
}

export interface PhysicalRange {
  min: number;
  max: number;
  mean: number;
  std: number;
}

export interface DataQualityReport {
  source_file: string;
  file_sha256: string;
  sha256_match: boolean;
  n_raw_records: number;
  expected_raw_records: number;
  coverage_start: string;
  coverage_end: string;
  is_streaming: boolean;
  cadence_description: string;
  cadence_regular: boolean;
  cadence_five_min_count: number;
  missing_values_count: number;
  negative_pv_count: number;
  negative_wind_count: number;
  physical_ranges: Record<string, PhysicalRange>;
  imputer_changes: number;
  hourly_rows: number;
  expected_hourly_rows: number;
  split: {
    train_rows: number;
    train_start: string;
    train_end: string;
    val_rows: number;
    val_start: string;
    val_end: string;
    test_rows: number;
    test_start: string;
    test_end: string;
  };
}

export interface EdaScatterPoint {
  time: string;
  season: string;
  dhi: number;
  dni: number;
  ghi: number;
  wind_speed: number;
  humidity: number;
  temp: number;
  pv_mw: number;
  wind_mw: number;
}

export interface DiurnalPoint {
  Hour: number;
  PV_production: number;
  Wind_production: number;
  GHI: number;
  Temperature: number;
  Wind_speed: number;
}

export interface EdaData {
  correlation_matrix: Record<string, Record<string, number>>;
  scatter_sample_700: EdaScatterPoint[];
  diurnal_cycle: DiurnalPoint[];
  season_summary: Record<string, Record<string, number>>;
}

export interface PcaSweepEntry {
  k: number;
  c_selected: number;
  cum_evr: number;
  recon_error: number;
  silhouette: number;
  davies_bouldin: number;
  bic_by_c: Record<string, number>;
  is_recommended: boolean;
}

export interface PcaSweepData {
  sweep: PcaSweepEntry[];
  recommended_k: number;
  tradeoff_explanation: string;
}

export interface PcaLoadingsData {
  features: string[];
  eigenvalues: number[];
  evr: number[];
  cum_evr: number[];
  loadings: Record<string, number[]>;
}

export interface FeatureStats {
  median: number;
  mean: number;
  q25: number;
  q75: number;
}

export interface ClusterInfo {
  cluster_id: number;
  cluster_label: string;
  name: string;
  count: number;
  share_pct: number;
  feature_stats: Record<string, FeatureStats>;
  pv_median: number;
  wind_median: number;
  ghi_median: number;
  wind_speed_median: number;
  season_distribution: Record<string, number>;
}

export interface ClusterProfilesData {
  k: number;
  c: number;
  filter_applied?: {
    season: string;
    season_code?: number;
  };
  total_val_hours: number;
  clusters: ClusterInfo[];
}

export interface ScatterPoint3D {
  pc1: number;
  pc2: number;
  pc3: number;
  cluster: number;
  cluster_label: string;
  cluster_name: string;
  probability: number;
  all_probabilities: number[];
  timestamp: string;
  season: string;
  pv_mw: number;
  wind_mw: number;
  ghi: number;
  wind_speed: number;
  temperature: number;
}

export interface MethodItem {
  name: string;
  k: number;
  c: number;
  membership: string;
  cluster_shape: string;
  silhouette: number;
  davies_bouldin: number;
  rank_note: string;
}

export interface MethodComparisonData {
  k: number;
  components: number;
  validation_sample_size: number;
  metric_space: string;
  methods: MethodItem[];
}

export interface ProbabilityBreakdown {
  cluster_id: number;
  cluster_label: string;
  name: string;
  probability: number;
  is_assigned: boolean;
}

export interface PredictResult {
  assigned_cluster: number;
  assigned_cluster_label: string;
  assigned_cluster_name: string;
  confidence: number;
  probabilities: ProbabilityBreakdown[];
  pca_coordinates: number[];
  pc3_coordinates: number[];
  k: number;
  c: number;
  disclaimer: string;
}

export interface ReadingFormValues {
  DHI: number;
  DNI: number;
  GHI: number;
  Wind_speed: number;
  Humidity: number;
  Temperature: number;
  PV_production: number;
  Wind_production: number;
}

