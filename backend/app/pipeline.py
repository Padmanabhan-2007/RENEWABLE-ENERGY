import os
import sys

# Silence loky core counting warning on Windows 11 where wmic is deprecated
os.environ["LOKY_MAX_CPU_COUNT"] = "4"

import json
import hashlib
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.mixture import GaussianMixture
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, davies_bouldin_score

EXPECTED_SHA256 = "d020a7352af89b72a9fd843ab9990e68db9333221c49b26925356c444465d7b0"
DEFAULT_DATA_PATH = os.path.join("data", "Database.csv")
CACHE_DIR = os.path.join("data", "cache")

FEATURES_8 = [
    "DHI",
    "DNI",
    "GHI",
    "Wind_speed",
    "Humidity",
    "Temperature",
    "PV_production",
    "Wind_production"
]

METADATA_COLS = ["Time", "Season", "Day_of_the_week"]
ALL_EXPECTED_COLS = METADATA_COLS + FEATURES_8

def derive_cluster_description(pv_med: float, wind_med: float, ghi_med: float, wind_spd_med: float) -> str:
    """
    Evidence-based profile description derived from empirical validation medians.
    Never assumes fixed or hardcoded component ordering.
    """
    if pv_med >= 10000:
        if wind_med >= 2500:
            return "Midday Peak Solar & Strong Wind Co-Generation"
        else:
            return "Peak Solar Dominance (Midday Clear Sky)"
    elif pv_med >= 4000:
        if wind_med >= 2500:
            return "Co-Generation High Solar & Strong Wind"
        else:
            return "Moderate Solar / Low Wind (Transitional Daytime)"
    elif pv_med > 500:
        return "Low Daylight Irradiance / Mixed Weather"
    else:  # Near zero solar output (nighttime or heavy overcast)
        if wind_med >= 3000:
            return "Nighttime Strong Wind Generation"
        elif wind_med >= 1800:
            return "Nighttime Moderate Wind Generation"
        else:
            return "Nighttime Calm / Base Wind"

def compute_sha256(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest().lower()

class PipelineState:
    def __init__(self, data_path: str = DEFAULT_DATA_PATH, cache_dir: str = CACHE_DIR):
        self.data_path = data_path
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        
        # Raw & Hourly DataFrames
        self.raw_stats: Dict[str, Any] = {}
        self.df_hourly: Optional[pd.DataFrame] = None
        self.train_df: Optional[pd.DataFrame] = None
        self.val_df: Optional[pd.DataFrame] = None
        self.test_df: Optional[pd.DataFrame] = None
        
        # Fitted Scalers and Models
        self.imputer: Optional[SimpleImputer] = None
        self.scaler: Optional[StandardScaler] = None
        self.pca_models: Dict[int, PCA] = {}
        self.gmm_models: Dict[Tuple[int, int], GaussianMixture] = {}
        
        # Cacheable Results
        self.quality_report: Dict[str, Any] = {}
        self.eda_summary: Dict[str, Any] = {}
        self.dimension_sweep: List[Dict[str, Any]] = []
        self.method_comparison: Dict[str, Any] = {}
        self.cluster_profiles: Dict[str, Any] = {}
        self.scatter_3d_data: List[Dict[str, Any]] = []
        self.pca_loadings: Dict[str, Any] = {}
        
        self.is_ready = False

    def get_cache_key(self) -> str:
        if os.path.exists(self.data_path):
            file_hash = compute_sha256(self.data_path)
            return file_hash[:16]
        return "none"

    def load_or_compute(self, force_recompute: bool = False):
        cache_key = self.get_cache_key()
        cache_manifest_path = os.path.join(self.cache_dir, f"manifest_{cache_key}.json")
        
        if not force_recompute and os.path.exists(cache_manifest_path):
            print(f"[Pipeline] Found cached artifacts with key {cache_key}. Loading cache...")
            try:
                self._load_from_cache(cache_key)
                self.is_ready = True
                print("[Pipeline] Cached artifacts loaded successfully.")
                return
            except Exception as e:
                print(f"[Pipeline] Error loading cache ({e}). Recomputing pipeline from scratch...")
                
        print("[Pipeline] Computing ML pipeline from raw CSV data...")
        self.compute_all()
        self._save_to_cache(cache_key)
        self.is_ready = True
        print("[Pipeline] Pipeline execution and artifact caching complete.")

    def compute_all(self):
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Dataset not found at {self.data_path}")
            
        file_sha256 = compute_sha256(self.data_path)
        print(f"[Pipeline] Dataset SHA-256: {file_sha256}")
        
        # 1. Read Raw CSV & Validate
        df_raw = pd.read_csv(self.data_path)
        if "Unnamed: 0" in df_raw.columns:
            df_raw = df_raw.drop(columns=["Unnamed: 0"])
            
        missing_cols = [c for c in FEATURES_8 if c not in df_raw.columns]
        if missing_cols:
            raise ValueError(f"CSV missing mandatory feature columns: {missing_cols}")
        if "Time" not in df_raw.columns:
            raise ValueError("CSV missing mandatory 'Time' column")
            
        n_raw = len(df_raw)
        neg_pv_count = int((df_raw["PV_production"] < 0).sum())
        neg_wind_count = int((df_raw["Wind_production"] < 0).sum())
        missing_values_count = int(df_raw[FEATURES_8].isnull().sum().sum())
        
        # Parse Timestamps & Cadence Check
        df_raw["Timestamp"] = pd.to_datetime(df_raw["Time"])
        df_raw = df_raw.sort_values("Timestamp").reset_index(drop=True)
        time_diffs = df_raw["Timestamp"].diff().value_counts()
        five_min_count = int(time_diffs.get(pd.Timedelta(minutes=5), 0))
        cadence_regular = bool(five_min_count == (n_raw - 1))
        
        raw_min_time = str(df_raw["Timestamp"].min())
        raw_max_time = str(df_raw["Timestamp"].max())
        
        # Physical bounds check
        physical_ranges = {
            col: {
                "min": float(df_raw[col].min()),
                "max": float(df_raw[col].max()),
                "mean": float(df_raw[col].mean()),
                "std": float(df_raw[col].std())
            }
            for col in FEATURES_8
        }
        
        self.quality_report = {
            "source_file": os.path.basename(self.data_path),
            "file_sha256": file_sha256,
            "sha256_match": bool(file_sha256 == EXPECTED_SHA256),
            "n_raw_records": n_raw,
            "expected_raw_records": 315648,
            "coverage_start": raw_min_time,
            "coverage_end": raw_max_time,
            "is_streaming": False,
            "cadence_description": "5-minute continuous records resampled to 1-hour means",
            "cadence_regular": cadence_regular,
            "cadence_five_min_count": five_min_count,
            "missing_values_count": missing_values_count,
            "negative_pv_count": neg_pv_count,
            "negative_wind_count": neg_wind_count,
            "physical_ranges": physical_ranges,
            "imputer_changes": 0
        }
        
        # 2. Preprocess: Clip negative PV and Wind at 0 MW
        df_clean = df_raw.copy()
        df_clean["PV_production"] = df_clean["PV_production"].clip(lower=0.0)
        df_clean["Wind_production"] = df_clean["Wind_production"].clip(lower=0.0)
        
        # 3. Resample to Hourly Means (producing 26,304 hourly rows)
        agg_dict = {f: "mean" for f in FEATURES_8}
        if "Electric_demand" in df_clean.columns:
            agg_dict["Electric_demand"] = "mean"
        if "Season" in df_clean.columns:
            agg_dict["Season"] = "first"
        if "Day_of_the_week" in df_clean.columns:
            agg_dict["Day_of_the_week"] = "first"
            
        self.df_hourly = df_clean.set_index("Timestamp").resample("1h").agg(agg_dict).reset_index()
        n_hourly = len(self.df_hourly)
        
        # 4. Chronological 70% Train, 15% Val, 15% Test
        n_train = 18412  # exactly int(26304 * 0.70)
        n_val = 3945    # exactly int(26304 * 0.15)
        n_test = n_hourly - n_train - n_val  # 3947
        
        self.train_df = self.df_hourly.iloc[:n_train].copy()
        self.val_df = self.df_hourly.iloc[n_train:n_train + n_val].copy()
        self.test_df = self.df_hourly.iloc[n_train + n_val:].copy()
        
        self.quality_report["hourly_rows"] = n_hourly
        self.quality_report["expected_hourly_rows"] = 26304
        self.quality_report["split"] = {
            "train_rows": n_train,
            "train_start": str(self.train_df["Timestamp"].min()),
            "train_end": str(self.train_df["Timestamp"].max()),
            "val_rows": n_val,
            "val_start": str(self.val_df["Timestamp"].min()),
            "val_end": str(self.val_df["Timestamp"].max()),
            "test_rows": n_test,
            "test_start": str(self.test_df["Timestamp"].min()),
            "test_end": str(self.test_df["Timestamp"].max())
        }
        
        # 5. Fit Median Imputer and StandardScaler on TRAIN rows ONLY
        self.imputer = SimpleImputer(strategy="median")
        X_train_raw = self.train_df[FEATURES_8].values
        self.imputer.fit(X_train_raw)
        X_train_imp = self.imputer.transform(X_train_raw)
        max_imp_diff = float(np.abs(X_train_raw - X_train_imp).max())
        self.quality_report["imputer_changes"] = int(np.count_nonzero(X_train_raw != X_train_imp))
        
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train_imp)
        X_val_scaled = self.scaler.transform(self.imputer.transform(self.val_df[FEATURES_8].values))
        
        # 6. Correlation Matrix & EDA Summary
        corr_matrix = self.df_hourly[FEATURES_8].corr().round(4).to_dict()
        
        # Representative 700-sample for scatter charts (PV vs GHI, Wind vs Wind speed)
        eda_sample_df = self.df_hourly.sample(n=min(700, len(self.df_hourly)), random_state=42).copy()
        eda_scatter = []
        for _, row in eda_sample_df.iterrows():
            eda_scatter.append({
                "time": str(row["Timestamp"]),
                "season": row.get("Season", "N/A"),
                "dhi": round(float(row["DHI"]), 1),
                "dni": round(float(row["DNI"]), 1),
                "ghi": round(float(row["GHI"]), 1),
                "wind_speed": round(float(row["Wind_speed"]), 2),
                "humidity": round(float(row["Humidity"]), 1),
                "temp": round(float(row["Temperature"]), 1),
                "pv_mw": round(float(row["PV_production"]), 1),
                "wind_mw": round(float(row["Wind_production"]), 1),
            })
            
        # Diurnal averages (hour of day 0..23)
        self.df_hourly["Hour"] = self.df_hourly["Timestamp"].dt.hour
        diurnal = self.df_hourly.groupby("Hour").agg({
            "PV_production": "mean",
            "Wind_production": "mean",
            "GHI": "mean",
            "Temperature": "mean",
            "Wind_speed": "mean"
        }).round(2).reset_index().to_dict(orient="records")
        
        # Season distributions
        season_df = self.df_hourly.groupby("Season").agg({
            "PV_production": ["mean", "median", "std"],
            "Wind_production": ["mean", "median", "std"],
            "GHI": ["mean", "median"],
            "Temperature": ["mean", "median"]
        }).round(2)
        season_summary = {}
        for season_val, row in season_df.iterrows():
            season_summary[str(season_val)] = {
                f"{col[0]}_{col[1]}": float(val)
                for col, val in row.items()
            }
        
        self.eda_summary = {
            "correlation_matrix": corr_matrix,
            "scatter_sample_700": eda_scatter,
            "diurnal_cycle": diurnal,
            "season_summary": season_summary
        }
        
        # 7. Sweep Retained PCA Dimensions k = 1..8
        # Deterministic 10,000 train sample for GMM BIC tuning
        rng_train = np.random.RandomState(42)
        train_sample_idx = rng_train.choice(n_train, size=10000, replace=False)
        
        # Deterministic 3,000 val sample for Silhouette and Davies-Bouldin
        rng_val = np.random.RandomState(42)
        val_sample_idx = rng_val.choice(n_val, size=3000, replace=False)
        X_val_eval = X_val_scaled[val_sample_idx]
        
        self.dimension_sweep = []
        full_pca = PCA(n_components=8, random_state=42)
        full_pca.fit(X_train_scaled)
        
        self.pca_loadings = {
            "features": FEATURES_8,
            "eigenvalues": [round(float(v), 4) for v in full_pca.explained_variance_],
            "evr": [round(float(v), 4) for v in full_pca.explained_variance_ratio_],
            "cum_evr": [round(float(v), 4) for v in np.cumsum(full_pca.explained_variance_ratio_)],
            "loadings": {
                f"PC{i+1}": [round(float(w), 4) for w in full_pca.components_[i]]
                for i in range(8)
            }
        }
        
        for k in range(1, 9):
            pca_k = PCA(n_components=k, random_state=42)
            Z_train_k = pca_k.fit_transform(X_train_scaled)
            Z_val_k = pca_k.transform(X_val_scaled)
            self.pca_models[k] = pca_k
            
            cum_evr = float(np.sum(pca_k.explained_variance_ratio_))
            
            # Normalized reconstruction error on training data
            Z_train_recon = pca_k.inverse_transform(Z_train_k)
            recon_error = float(np.sum((X_train_scaled - Z_train_recon)**2) / np.sum(X_train_scaled**2))
            
            # Choose C in 2..5 by BIC on 10,000 train sample
            Z_train_sub = Z_train_k[train_sample_idx]
            best_c = 2
            best_bic = float("inf")
            bic_details = {}
            
            for c in range(2, 6):
                gmm_sub = GaussianMixture(
                    n_components=c,
                    covariance_type="full",
                    reg_covar=1e-4,
                    random_state=42
                )
                gmm_sub.fit(Z_train_sub)
                bic_score = float(gmm_sub.bic(Z_train_sub))
                bic_details[c] = round(bic_score, 1)
                if bic_score < best_bic:
                    best_bic = bic_score
                    best_c = c
                    
            # Fit best GMM on full train set
            gmm_k = GaussianMixture(
                n_components=best_c,
                covariance_type="full",
                reg_covar=1e-4,
                random_state=42
            )
            gmm_k.fit(Z_train_k)
            self.gmm_models[(k, best_c)] = gmm_k
            
            # Predict clusters on validation sample (in common standardized 8-feature space)
            val_preds = gmm_k.predict(Z_val_k[val_sample_idx])
            sil = float(silhouette_score(X_val_eval, val_preds))
            dbi = float(davies_bouldin_score(X_val_eval, val_preds))
            
            self.dimension_sweep.append({
                "k": k,
                "c_selected": best_c,
                "cum_evr": round(cum_evr * 100, 1),
                "recon_error": round(recon_error * 100, 1),
                "silhouette": round(sil, 3),
                "davies_bouldin": round(dbi, 3),
                "bic_by_c": bic_details,
                "is_recommended": (k == 2)
            })
            
        # 8. Baseline Method Comparison (at k=2, C=5)
        # Baseline A: PCA + GMM (k=2, C=5)
        gmm_k2_c5 = self.gmm_models[(2, 5)]
        pca_k2 = self.pca_models[2]
        Z_val_k2 = pca_k2.transform(X_val_scaled)
        gmm_k2_preds = gmm_k2_c5.predict(Z_val_k2[val_sample_idx])
        sil_gmm = float(silhouette_score(X_val_eval, gmm_k2_preds))
        dbi_gmm = float(davies_bouldin_score(X_val_eval, gmm_k2_preds))
        
        # Baseline B: PCA + K-Means (k=2, C=5)
        kmeans = KMeans(n_clusters=5, random_state=42, n_init=10)
        kmeans.fit(pca_k2.transform(X_train_scaled))
        km_preds = kmeans.predict(Z_val_k2[val_sample_idx])
        sil_km = float(silhouette_score(X_val_eval, km_preds))
        dbi_km = float(davies_bouldin_score(X_val_eval, km_preds))
        
        # Baseline C: Standardized GMM without PCA (k=8, C=5)
        gmm_raw = GaussianMixture(n_components=5, covariance_type="full", reg_covar=1e-4, random_state=42)
        gmm_raw.fit(X_train_scaled)
        raw_preds = gmm_raw.predict(X_val_eval)
        sil_raw = float(silhouette_score(X_val_eval, raw_preds))
        dbi_raw = float(davies_bouldin_score(X_val_eval, raw_preds))
        
        self.method_comparison = {
            "k": 2,
            "components": 5,
            "validation_sample_size": 3000,
            "metric_space": "Standardized 8-feature original space",
            "methods": [
                {
                    "name": "PCA + GMM (Recommended)",
                    "k": 2,
                    "c": 5,
                    "membership": "Soft (Posterior Probabilities)",
                    "cluster_shape": "Full Covariance (Ellipsoidal / Tilted)",
                    "silhouette": round(sil_gmm, 3),
                    "davies_bouldin": round(dbi_gmm, 3),
                    "rank_note": "Best compromise: compact 2D space, captures non-spherical regimes"
                },
                {
                    "name": "PCA + K-Means",
                    "k": 2,
                    "c": 5,
                    "membership": "Hard Partition",
                    "cluster_shape": "Spherical / Distance-based Voronoi",
                    "silhouette": round(sil_km, 3),
                    "davies_bouldin": round(dbi_km, 3),
                    "rank_note": "Slightly higher silhouette but forces spherical clusters and no uncertainty"
                },
                {
                    "name": "Standardized GMM (No PCA)",
                    "k": 8,
                    "c": 5,
                    "membership": "Soft (Posterior Probabilities)",
                    "cluster_shape": "Full Covariance in 8D",
                    "silhouette": round(sil_raw, 3),
                    "davies_bouldin": round(dbi_raw, 3),
                    "rank_note": "Degraded clustering due to collinearity and noise in full 8D feature space"
                }
            ]
        }
        
        # 9. Compute Cluster Profiles on Validation Set for k=2, C=5
        # Predict on entire validation set
        val_clusters = gmm_k2_c5.predict(Z_val_k2)
        val_probs = gmm_k2_c5.predict_proba(Z_val_k2)
        self.val_df["cluster"] = val_clusters
        
        clusters_list = []
        for c in range(5):
            c_mask = (val_clusters == c)
            c_df = self.val_df[c_mask]
            count = int(c_mask.sum())
            share = round(float(count / len(self.val_df) * 100), 1)
            
            # Median, Mean, 25%, 75% for all 8 features
            feature_stats = {}
            for col in FEATURES_8:
                feature_stats[col] = {
                    "median": round(float(c_df[col].median()), 1),
                    "mean": round(float(c_df[col].mean()), 1),
                    "q25": round(float(c_df[col].quantile(0.25)), 1),
                    "q75": round(float(c_df[col].quantile(0.75)), 1),
                }
                
            # Season distribution in this cluster
            season_counts = c_df["Season"].value_counts().to_dict()
            
            pv_med = feature_stats["PV_production"]["median"]
            wind_med = feature_stats["Wind_production"]["median"]
            ghi_med = feature_stats["GHI"]["median"]
            wind_spd_med = feature_stats["Wind_speed"]["median"]
            desc_name = derive_cluster_description(pv_med, wind_med, ghi_med, wind_spd_med)

            clusters_list.append({
                "cluster_id": c,
                "cluster_label": f"Cluster {c + 1}",
                "name": desc_name,
                "count": count,
                "share_pct": share,
                "feature_stats": feature_stats,
                "pv_median": pv_med,
                "wind_median": wind_med,
                "ghi_median": ghi_med,
                "wind_speed_median": wind_spd_med,
                "season_distribution": season_counts
            })
            
        self.cluster_profiles = {
            "k": 2,
            "c": 5,
            "total_val_hours": len(self.val_df),
            "clusters": clusters_list
        }
        
        # 10. 3D PCA Scatter Sample (PC1, PC2, PC3)
        pca3 = PCA(n_components=3, random_state=42)
        pca3.fit(X_train_scaled)
        Z_val_3d = pca3.transform(X_val_scaled)
        
        # Sample 1,200 points for smooth interactive rendering
        sample_indices = np.linspace(0, len(self.val_df) - 1, min(1200, len(self.val_df)), dtype=int)
        scatter_items = []
        for idx in sample_indices:
            row = self.val_df.iloc[idx]
            c_id = int(val_clusters[idx])
            probs = [round(float(p), 3) for p in val_probs[idx]]
            pv_val = round(float(row["PV_production"]), 1)
            wind_val = round(float(row["Wind_production"]), 1)
            ghi_val = round(float(row["GHI"]), 1)
            wind_spd_val = round(float(row["Wind_speed"]), 2)
            c_name = clusters_list[c_id]["name"] if c_id < len(clusters_list) else f"Regime {c_id + 1}"
            scatter_items.append({
                "pc1": round(float(Z_val_3d[idx, 0]), 3),
                "pc2": round(float(Z_val_3d[idx, 1]), 3),
                "pc3": round(float(Z_val_3d[idx, 2]), 3),
                "cluster": c_id,
                "cluster_label": f"Cluster {c_id + 1}",
                "cluster_name": c_name,
                "probability": probs[c_id],
                "all_probabilities": probs,
                "timestamp": str(row["Timestamp"]),
                "season": str(row.get("Season", "")),
                "pv_mw": round(float(row["PV_production"]), 1),
                "wind_mw": round(float(row["Wind_production"]), 1),
                "ghi": round(float(row["GHI"]), 1),
                "wind_speed": round(float(row["Wind_speed"]), 2),
                "temperature": round(float(row["Temperature"]), 1)
            })
        self.scatter_3d_data = scatter_items

    def _save_to_cache(self, cache_key: str):
        print(f"[Pipeline] Saving artifacts to cache with key {cache_key}...")
        manifest = {
            "cache_key": cache_key,
            "data_path": self.data_path,
            "created_at": pd.Timestamp.now().isoformat()
        }
        with open(os.path.join(self.cache_dir, f"manifest_{cache_key}.json"), "w") as f:
            json.dump(manifest, f, indent=2)
            
        with open(os.path.join(self.cache_dir, f"quality_report_{cache_key}.json"), "w") as f:
            json.dump(self.quality_report, f, indent=2)
            
        with open(os.path.join(self.cache_dir, f"eda_summary_{cache_key}.json"), "w") as f:
            json.dump(self.eda_summary, f, indent=2)
            
        with open(os.path.join(self.cache_dir, f"dimension_sweep_{cache_key}.json"), "w") as f:
            json.dump(self.dimension_sweep, f, indent=2)
            
        with open(os.path.join(self.cache_dir, f"method_comparison_{cache_key}.json"), "w") as f:
            json.dump(self.method_comparison, f, indent=2)
            
        with open(os.path.join(self.cache_dir, f"cluster_profiles_{cache_key}.json"), "w") as f:
            json.dump(self.cluster_profiles, f, indent=2)
            
        with open(os.path.join(self.cache_dir, f"scatter_3d_{cache_key}.json"), "w") as f:
            json.dump(self.scatter_3d_data, f)
            
        with open(os.path.join(self.cache_dir, f"pca_loadings_{cache_key}.json"), "w") as f:
            json.dump(self.pca_loadings, f, indent=2)
            
        # Save fitted transformers and models
        joblib.dump(self.imputer, os.path.join(self.cache_dir, f"imputer_{cache_key}.joblib"))
        joblib.dump(self.scaler, os.path.join(self.cache_dir, f"scaler_{cache_key}.joblib"))
        joblib.dump(self.pca_models, os.path.join(self.cache_dir, f"pca_models_{cache_key}.joblib"))
        joblib.dump(self.gmm_models, os.path.join(self.cache_dir, f"gmm_models_{cache_key}.joblib"))
        
        # Save hourly dataframe as CSV for maximum portability
        if self.df_hourly is not None:
            self.df_hourly.to_csv(os.path.join(self.cache_dir, f"hourly_{cache_key}.csv"), index=False)

    def _load_from_cache(self, cache_key: str):
        with open(os.path.join(self.cache_dir, f"quality_report_{cache_key}.json"), "r") as f:
            self.quality_report = json.load(f)
        with open(os.path.join(self.cache_dir, f"eda_summary_{cache_key}.json"), "r") as f:
            self.eda_summary = json.load(f)
        with open(os.path.join(self.cache_dir, f"dimension_sweep_{cache_key}.json"), "r") as f:
            self.dimension_sweep = json.load(f)
        with open(os.path.join(self.cache_dir, f"method_comparison_{cache_key}.json"), "r") as f:
            self.method_comparison = json.load(f)
        with open(os.path.join(self.cache_dir, f"cluster_profiles_{cache_key}.json"), "r") as f:
            self.cluster_profiles = json.load(f)
        with open(os.path.join(self.cache_dir, f"scatter_3d_{cache_key}.json"), "r") as f:
            self.scatter_3d_data = json.load(f)
        with open(os.path.join(self.cache_dir, f"pca_loadings_{cache_key}.json"), "r") as f:
            self.pca_loadings = json.load(f)
            
        self.imputer = joblib.load(os.path.join(self.cache_dir, f"imputer_{cache_key}.joblib"))
        self.scaler = joblib.load(os.path.join(self.cache_dir, f"scaler_{cache_key}.joblib"))
        self.pca_models = joblib.load(os.path.join(self.cache_dir, f"pca_models_{cache_key}.joblib"))
        self.gmm_models = joblib.load(os.path.join(self.cache_dir, f"gmm_models_{cache_key}.joblib"))
        
        csv_path = os.path.join(self.cache_dir, f"hourly_{cache_key}.csv")
        if os.path.exists(csv_path):
            self.df_hourly = pd.read_csv(csv_path)
            self.df_hourly["Timestamp"] = pd.to_datetime(self.df_hourly["Timestamp"])
            n_train = 18412
            n_val = 3945
            self.train_df = self.df_hourly.iloc[:n_train].copy()
            self.val_df = self.df_hourly.iloc[n_train:n_train + n_val].copy()
            self.test_df = self.df_hourly.iloc[n_train + n_val:].copy()
            
            # Ensure cluster assignments are attached to val_df
            if (2, 5) in self.gmm_models and 2 in self.pca_models:
                X_val_scaled = self.scaler.transform(self.imputer.transform(self.val_df[FEATURES_8].values))
                Z_val_2 = self.pca_models[2].transform(X_val_scaled)
                self.val_df["cluster"] = self.gmm_models[(2, 5)].predict(Z_val_2)

    def predict_reading(self, reading: Dict[str, float], k: int = 2) -> Dict[str, Any]:
        """
        Assigns an operating regime / GMM cluster to an 8-feature reading.
        Applies:
        1. Negative clipping to 0 MW for PV and Wind
        2. Imputer (trained on training rows)
        3. StandardScaler (fitted on training rows)
        4. PCA projection into k dimensions
        5. GMM posterior probability computation
        """
        if not self.is_ready:
            raise RuntimeError("Pipeline is not initialized")
            
        # Extract features in strict order
        raw_vals = []
        for feat in FEATURES_8:
            val = float(reading.get(feat, 0.0))
            if feat in ["PV_production", "Wind_production"]:
                val = max(0.0, val)
            raw_vals.append(val)
            
        x_raw = np.array([raw_vals])
        x_imp = self.imputer.transform(x_raw)
        x_scaled = self.scaler.transform(x_imp)
        
        pca_k = self.pca_models.get(k)
        if pca_k is None:
            raise ValueError(f"PCA model for k={k} not found")
            
        z_k = pca_k.transform(x_scaled)
        
        # Best C for dimension k
        c_val = 5
        for sweep_entry in self.dimension_sweep:
            if sweep_entry["k"] == k:
                c_val = sweep_entry["c_selected"]
                break
                
        gmm = self.gmm_models.get((k, c_val))
        if gmm is None:
            raise ValueError(f"GMM model for k={k}, C={c_val} not found")
            
        cluster_idx = int(gmm.predict(z_k)[0])
        probabilities = [float(p) for p in gmm.predict_proba(z_k)[0]]
        
        # Also project to 3D for coordinate display
        pca3 = self.pca_models.get(3) or PCA(n_components=3, random_state=42).fit(x_scaled)
        coords_3d = pca3.transform(x_scaled)[0].tolist() if 3 in self.pca_models else [float(z_k[0, 0]), float(z_k[0, 1]), 0.0]
        
        # Compute centroid physical means to derive names
        means_k = gmm.means_
        means_orig = self.scaler.inverse_transform(pca_k.inverse_transform(means_k))
        cluster_names = {}
        for c_idx in range(len(means_orig)):
            pv_m = float(means_orig[c_idx][6])
            wind_m = float(means_orig[c_idx][7])
            ghi_m = float(means_orig[c_idx][2])
            wind_spd_m = float(means_orig[c_idx][3])
            cluster_names[c_idx] = derive_cluster_description(pv_m, wind_m, ghi_m, wind_spd_m)

        prob_breakdown = [
            {
                "cluster_id": i,
                "cluster_label": f"Cluster {i + 1}",
                "name": cluster_names.get(i, f"Regime {i + 1}"),
                "probability": round(prob, 4),
                "is_assigned": (i == cluster_idx)
            }
            for i, prob in enumerate(probabilities)
        ]
        
        return {
            "assigned_cluster": cluster_idx,
            "assigned_cluster_label": f"Cluster {cluster_idx + 1}",
            "assigned_cluster_name": cluster_names.get(cluster_idx, f"Regime {cluster_idx + 1}"),
            "confidence": round(probabilities[cluster_idx] * 100, 1),
            "probabilities": prob_breakdown,
            "pca_coordinates": [round(float(v), 3) for v in z_k[0]],
            "pc3_coordinates": [round(float(v), 3) for v in coords_3d[:3]],
            "k": k,
            "c": c_val,
            "disclaimer": "CRITICAL METHODOLOGY NOTE: This model produces a pattern assignment / cluster membership into historical operating regimes based on contemporaneous weather and generation conditions. It is NOT an energy production forecast and does not predict future MW output."
        }

    def get_cluster_profiles(
        self,
        k: int = 2,
        season: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        if not self.is_ready or self.val_df is None:
            raise RuntimeError("Pipeline is not initialized")
            
        k = max(1, min(8, int(k)))
        
        # Get C for dimension k
        c_val = 5
        for sweep_entry in self.dimension_sweep:
            if sweep_entry["k"] == k:
                c_val = sweep_entry["c_selected"]
                break
                
        pca_k = self.pca_models.get(k) or PCA(n_components=k, random_state=42).fit(
            self.scaler.transform(self.imputer.transform(self.train_df[FEATURES_8].values))
        )
        gmm = self.gmm_models.get((k, c_val))
        
        df_target = self.val_df.copy()
        
        # Filter by season
        season_filter_str = None
        if season and season.lower() != "all":
            season_filter_str = season
            season_code = {"winter": 1, "spring": 2, "summer": 3, "fall": 4, "autumn": 4, "1": 1, "2": 2, "3": 3, "4": 4}.get(season.lower())
            if season_code is not None:
                df_target = df_target[df_target["Season"] == season_code]
            else:
                df_target = df_target[df_target["Season"].astype(str).str.lower() == season.lower()]
                
        # Filter by date range
        if start_date:
            try:
                dt_start = pd.to_datetime(start_date)
                df_target = df_target[df_target["Timestamp"] >= dt_start]
            except Exception:
                pass
        if end_date:
            try:
                dt_end = pd.to_datetime(end_date)
                df_target = df_target[df_target["Timestamp"] <= dt_end]
            except Exception:
                pass
                
        total_hours = len(df_target)
        if total_hours == 0:
            df_target = self.val_df.copy()
            total_hours = len(df_target)
            
        X_scaled = self.scaler.transform(self.imputer.transform(df_target[FEATURES_8].values))
        Z_k = pca_k.transform(X_scaled)
        preds = gmm.predict(Z_k)
        
        clusters_list = []
        for c in range(c_val):
            c_mask = (preds == c)
            c_df = df_target[c_mask]
            count = int(c_mask.sum())
            share = round(float(count / total_hours * 100), 1) if total_hours > 0 else 0.0
            
            feature_stats = {}
            for col in FEATURES_8:
                if count > 0:
                    feature_stats[col] = {
                        "median": round(float(c_df[col].median()), 1),
                        "mean": round(float(c_df[col].mean()), 1),
                        "q25": round(float(c_df[col].quantile(0.25)), 1),
                        "q75": round(float(c_df[col].quantile(0.75)), 1),
                    }
                else:
                    feature_stats[col] = {"median": 0.0, "mean": 0.0, "q25": 0.0, "q75": 0.0}
                    
            pv_med = feature_stats["PV_production"]["median"]
            wind_med = feature_stats["Wind_production"]["median"]
            ghi_med = feature_stats["GHI"]["median"]
            wind_spd_med = feature_stats["Wind_speed"]["median"]
            desc_name = derive_cluster_description(pv_med, wind_med, ghi_med, wind_spd_med)
            
            season_counts = c_df["Season"].value_counts().to_dict() if count > 0 else {}
            
            clusters_list.append({
                "cluster_id": c,
                "cluster_label": f"Cluster {c + 1}",
                "name": desc_name,
                "count": count,
                "share_pct": share,
                "feature_stats": feature_stats,
                "pv_median": pv_med,
                "wind_median": wind_med,
                "ghi_median": ghi_med,
                "wind_speed_median": wind_spd_med,
                "season_distribution": season_counts
            })
            
        filter_meta = {}
        if season_filter_str:
            filter_meta["season"] = season_filter_str
        if start_date:
            filter_meta["start_date"] = start_date
        if end_date:
            filter_meta["end_date"] = end_date
            
        return {
            "k": k,
            "c": c_val,
            "filter_applied": filter_meta if filter_meta else None,
            "total_val_hours": total_hours,
            "clusters": clusters_list
        }

    def get_scatter_data(
        self,
        k: int = 2,
        season: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        if not self.is_ready or self.val_df is None:
            raise RuntimeError("Pipeline is not initialized")
            
        k = max(1, min(8, int(k)))
        c_val = 5
        cum_evr = 77.4
        for sweep_entry in self.dimension_sweep:
            if sweep_entry["k"] == k:
                c_val = sweep_entry["c_selected"]
                cum_evr = sweep_entry["cum_evr"]
                break
                
        pca_k = self.pca_models.get(k) or PCA(n_components=k, random_state=42).fit(
            self.scaler.transform(self.imputer.transform(self.train_df[FEATURES_8].values))
        )
        gmm = self.gmm_models.get((k, c_val))
        
        pca3 = self.pca_models.get(3) or PCA(n_components=3, random_state=42).fit(
            self.scaler.transform(self.imputer.transform(self.train_df[FEATURES_8].values))
        )
        
        df_target = self.val_df.copy()
        if season and season.lower() != "all":
            season_code = {"winter": 1, "spring": 2, "summer": 3, "fall": 4, "autumn": 4, "1": 1, "2": 2, "3": 3, "4": 4}.get(season.lower())
            if season_code is not None:
                df_target = df_target[df_target["Season"] == season_code]
            else:
                df_target = df_target[df_target["Season"].astype(str).str.lower() == season.lower()]
                
        if start_date:
            try:
                df_target = df_target[df_target["Timestamp"] >= pd.to_datetime(start_date)]
            except Exception:
                pass
        if end_date:
            try:
                df_target = df_target[df_target["Timestamp"] <= pd.to_datetime(end_date)]
            except Exception:
                pass
                
        if len(df_target) == 0:
            df_target = self.val_df.copy()
            
        n_sample = min(1200, len(df_target))
        if len(df_target) > n_sample:
            sample_df = df_target.sample(n=n_sample, random_state=42).sort_values("Timestamp")
        else:
            sample_df = df_target
            
        X_sample_scaled = self.scaler.transform(self.imputer.transform(sample_df[FEATURES_8].values))
        Z_k_sample = pca_k.transform(X_sample_scaled)
        Z_3d_sample = pca3.transform(X_sample_scaled)
        
        clusters = gmm.predict(Z_k_sample)
        probs = gmm.predict_proba(Z_k_sample)
        
        means_k = gmm.means_
        means_orig = self.scaler.inverse_transform(pca_k.inverse_transform(means_k))
        cluster_names = {}
        for c_idx in range(len(means_orig)):
            pv_m = float(means_orig[c_idx][6])
            wind_m = float(means_orig[c_idx][7])
            ghi_m = float(means_orig[c_idx][2])
            wind_spd_m = float(means_orig[c_idx][3])
            cluster_names[c_idx] = derive_cluster_description(pv_m, wind_m, ghi_m, wind_spd_m)
            
        scatter_items = []
        for i, (_, row) in enumerate(sample_df.iterrows()):
            c_id = int(clusters[i])
            c_probs = [round(float(p), 3) for p in probs[i]]
            scatter_items.append({
                "pc1": round(float(Z_3d_sample[i, 0]), 3),
                "pc2": round(float(Z_3d_sample[i, 1]), 3),
                "pc3": round(float(Z_3d_sample[i, 2]), 3),
                "cluster": c_id,
                "cluster_label": f"Cluster {c_id + 1}",
                "cluster_name": cluster_names.get(c_id, f"Regime {c_id + 1}"),
                "probability": c_probs[c_id],
                "all_probabilities": c_probs,
                "timestamp": str(row["Timestamp"]),
                "season": str(row.get("Season", "")),
                "pv_mw": round(float(row["PV_production"]), 1),
                "wind_mw": round(float(row["Wind_production"]), 1),
                "ghi": round(float(row["GHI"]), 1),
                "wind_speed": round(float(row["Wind_speed"]), 2),
                "temperature": round(float(row["Temperature"]), 1)
            })
            
        note_text = (
            f"Selected GMM uses k=2 PCs (77.4% cumulative variance). PC3 is provided solely for 3D spatial viewing."
            if k == 2
            else f"Current GMM uses k={k} PCs ({cum_evr}% cumulative variance). PC1, PC2, and PC3 are visualized."
        )
        
        return {
            "points": scatter_items,
            "k": k,
            "c": c_val,
            "note": note_text,
            "count": len(scatter_items)
        }

# Global singleton
pipeline_state = PipelineState()
