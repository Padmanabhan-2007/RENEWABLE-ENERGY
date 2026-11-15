import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.mixture import GaussianMixture

df = pd.read_csv("data/Database.csv")
if "Unnamed: 0" in df.columns:
    df = df.drop(columns=["Unnamed: 0"])
df["PV_production"] = df["PV_production"].clip(lower=0)
df["Wind_production"] = df["Wind_production"].clip(lower=0)
df["Timestamp"] = pd.to_datetime(df["Time"])
df_hourly = df.set_index("Timestamp").resample("1h").agg({
    "DHI": "mean", "DNI": "mean", "GHI": "mean",
    "Wind_speed": "mean", "Humidity": "mean", "Temperature": "mean",
    "PV_production": "mean", "Wind_production": "mean",
    "Electric_demand": "mean", "Season": "first", "Day_of_the_week": "first"
}).reset_index()

FEATURES = ["DHI", "DNI", "GHI", "Wind_speed", "Humidity", "Temperature", "PV_production", "Wind_production"]
n_train = 18412
n_val = 3945

train_df = df_hourly.iloc[:n_train].copy()
val_df = df_hourly.iloc[n_train:n_train + n_val].copy()

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(train_df[FEATURES].values)
X_val_scaled = scaler.transform(val_df[FEATURES].values)

pca2 = PCA(n_components=2, random_state=42)
Z_train2 = pca2.fit_transform(X_train_scaled)
Z_val2 = pca2.transform(X_val_scaled)

gmm = GaussianMixture(n_components=5, covariance_type="full", reg_covar=1e-4, random_state=42)
gmm.fit(Z_train2)

val_df["cluster"] = gmm.predict(Z_val2)
summary = []
for c in range(5):
    sub = val_df[val_df["cluster"] == c]
    share = len(sub) / len(val_df) * 100
    pv_med = sub["PV_production"].median()
    wind_med = sub["Wind_production"].median()
    summary.append((c, share, pv_med, wind_med))

print("Validation Cluster Summary (k=2, C=5):")
for c, share, pv, wind in sorted(summary, key=lambda x: x[2]): # sort by pv
    print(f"Cluster {c}: Share={share:.1f}%, PV med={pv:.0f} MW, Wind med={wind:.0f} MW")

