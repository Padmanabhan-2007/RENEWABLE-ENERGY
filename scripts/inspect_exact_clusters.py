import os
os.environ["LOKY_MAX_CPU_COUNT"] = "4"
import json
import pandas as pd
import numpy as np

# Load cached artifacts or recompute
import sys
sys.path.insert(0, "backend")
from app.pipeline import pipeline_state, FEATURES_8

pipeline_state.load_or_compute()

val_df = pipeline_state.val_df
scaler = pipeline_state.scaler
imputer = pipeline_state.imputer

print("Validation partition rows:", len(val_df))
print("Date range:", val_df["Timestamp"].min(), "to", val_df["Timestamp"].max())

X_val_raw = val_df[FEATURES_8].values
X_val_scaled = scaler.transform(imputer.transform(X_val_raw))

for k in range(1, 9):
    pca_k = pipeline_state.pca_models[k]
    Z_val_k = pca_k.transform(X_val_scaled)
    sweep_item = next(s for s in pipeline_state.dimension_sweep if s["k"] == k)
    c_val = sweep_item["c_selected"]
    gmm = pipeline_state.gmm_models[(k, c_val)]
    preds = gmm.predict(Z_val_k)
    
    print(f"\n--- k={k}, C={c_val} Cluster Breakdown on Validation Rows ---")
    val_temp = val_df.copy()
    val_temp["cluster"] = preds
    for c in range(c_val):
        sub = val_temp[val_temp["cluster"] == c]
        share = len(sub) / len(val_temp) * 100
        pv_med = sub["PV_production"].median()
        wind_med = sub["Wind_production"].median()
        ghi_med = sub["GHI"].median()
        wind_spd_med = sub["Wind_speed"].median()
        temp_med = sub["Temperature"].median()
        rh_med = sub["Humidity"].median()
        print(f"  Cluster {c}: {share:5.1f}% ({len(sub):4d} hrs) | PV med: {pv_med:6.0f} MW, Wind med: {wind_med:5.0f} MW | GHI: {ghi_med:4.0f}, WindSpd: {wind_spd_med:4.1f}, Temp: {temp_med:4.1f}, RH: {rh_med:4.1f}")
