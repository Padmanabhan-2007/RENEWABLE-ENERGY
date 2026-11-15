import pandas as pd
import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.mixture import GaussianMixture
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, davies_bouldin_score

# 1. Load data
df = pd.read_csv("data/Database.csv")
if "Unnamed: 0" in df.columns:
    df = df.drop(columns=["Unnamed: 0"])

# 2. Clip negative values
df["PV_production"] = df["PV_production"].clip(lower=0)
df["Wind_production"] = df["Wind_production"].clip(lower=0)

# 3. Resample to hourly means
df["Timestamp"] = pd.to_datetime(df["Time"])
df_hourly = df.set_index("Timestamp").resample("1h").agg({
    "DHI": "mean",
    "DNI": "mean",
    "GHI": "mean",
    "Wind_speed": "mean",
    "Humidity": "mean",
    "Temperature": "mean",
    "PV_production": "mean",
    "Wind_production": "mean",
    "Electric_demand": "mean",
    "Season": "first",
    "Day_of_the_week": "first"
}).reset_index()

FEATURES = ["DHI", "DNI", "GHI", "Wind_speed", "Humidity", "Temperature", "PV_production", "Wind_production"]

# 4. Chronological Split
n_train = 18412
n_val = 3945
n_test = 3947

train_df = df_hourly.iloc[:n_train].copy()
val_df = df_hourly.iloc[n_train:n_train + n_val].copy()
test_df = df_hourly.iloc[n_train + n_val:].copy()

print(f"Train date range: {train_df['Timestamp'].min()} to {train_df['Timestamp'].max()}")
print(f"Val date range:   {val_df['Timestamp'].min()} to {val_df['Timestamp'].max()}")
print(f"Test date range:  {test_df['Timestamp'].min()} to {test_df['Timestamp'].max()}")

# 5. Imputer
imputer = SimpleImputer(strategy="median")
X_train_raw = train_df[FEATURES].values
imputer.fit(X_train_raw)
X_train_imp = imputer.transform(X_train_raw)
diff_imp = np.abs(X_train_raw - X_train_imp).max()
print(f"Max difference after median imputer: {diff_imp} (confirms no change)")

# 6. Scaler
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train_imp)
X_val_scaled = scaler.transform(imputer.transform(val_df[FEATURES].values))

# Deterministic samples
# Training 10,000 sample for BIC
# Check if train.sample(10000, random_state=42) or first 10000
rng_train = np.random.RandomState(42)
train_sample_idx = rng_train.choice(n_train, size=10000, replace=False)

# Validation 3,000 sample for silhouette & DBI
rng_val = np.random.RandomState(42)
val_sample_idx = rng_val.choice(n_val, size=3000, replace=False)
X_val_eval = X_val_scaled[val_sample_idx]

print("\n--- Running PCA & GMM Sweep (k=1..8) ---")
results = []
for k in range(1, 9):
    pca = PCA(n_components=k, random_state=42)
    Z_train = pca.fit_transform(X_train_scaled)
    Z_val = pca.transform(X_val_scaled)
    
    # Cumulative EVR
    cum_evr = float(np.sum(pca.explained_variance_ratio_))
    
    # Normalized reconstruction error on train: ||Z - Z_hat||_F^2 / ||Z||_F^2
    Z_reconstructed = pca.inverse_transform(Z_train)
    recon_error = float(np.sum((X_train_scaled - Z_reconstructed)**2) / np.sum(X_train_scaled**2))
    
    # BIC selection for C in 2..5 on 10,000 train sample
    Z_train_sample = Z_train[train_sample_idx]
    best_c = None
    best_bic = float("inf")
    bics = {}
    for c in range(2, 6):
        gmm_bic = GaussianMixture(n_components=c, covariance_type="full", reg_covar=1e-4, random_state=42)
        gmm_bic.fit(Z_train_sample)
        bic_val = gmm_bic.bic(Z_train_sample)
        bics[c] = bic_val
        if bic_val < best_bic:
            best_bic = bic_val
            best_c = c
            
    # Fit best GMM on full train
    gmm = GaussianMixture(n_components=best_c, covariance_type="full", reg_covar=1e-4, random_state=42)
    gmm.fit(Z_train)
    
    # Predict clusters on validation sample
    Z_val_sample = Z_val[val_sample_idx]
    val_preds = gmm.predict(Z_val_sample)
    
    # Silhouette and DBI in common standardized 8-feature space (X_val_eval)
    sil = float(silhouette_score(X_val_eval, val_preds))
    dbi = float(davies_bouldin_score(X_val_eval, val_preds))
    
    results.append({
        "k": k,
        "C": best_c,
        "cum_evr": cum_evr,
        "recon_error": recon_error,
        "sil": sil,
        "dbi": dbi,
        "bics": bics
    })
    print(f"k={k}: C={best_c}, EVR={cum_evr*100:.1f}%, ReconErr={recon_error*100:.1f}%, Sil={sil:.3f}, DBI={dbi:.3f}")

# Baselines at k=2, C=5:
# 1. PCA + KMeans
pca2 = PCA(n_components=2, random_state=42)
Z_train2 = pca2.fit_transform(X_train_scaled)
Z_val2 = pca2.transform(X_val_scaled)
km = KMeans(n_clusters=5, random_state=42, n_init=10)
km.fit(Z_train2)
km_val_preds = km.predict(Z_val2[val_sample_idx])
km_sil = float(silhouette_score(X_val_eval, km_val_preds))
km_dbi = float(davies_bouldin_score(X_val_eval, km_val_preds))
print(f"\nBaseline PCA + KMeans (k=2, C=5): Sil={km_sil:.3f}, DBI={km_dbi:.3f}")

# 2. Standardized GMM without PCA (k=8)
gmm_raw = GaussianMixture(n_components=5, covariance_type="full", reg_covar=1e-4, random_state=42)
gmm_raw.fit(X_train_scaled)
gmm_raw_preds = gmm_raw.predict(X_val_eval)
raw_sil = float(silhouette_score(X_val_eval, gmm_raw_preds))
raw_dbi = float(davies_bouldin_score(X_val_eval, gmm_raw_preds))
print(f"Baseline Standardized GMM no PCA: Sil={raw_sil:.3f}, DBI={raw_dbi:.3f}")

