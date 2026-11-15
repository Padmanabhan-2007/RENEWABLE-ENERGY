import os
import sys

# Silence loky warning
os.environ["LOKY_MAX_CPU_COUNT"] = "4"

from app.pipeline import pipeline_state

if __name__ == "__main__":
    print("Testing pipeline initialization and execution...")
    pipeline_state.load_or_compute()
    print("Pipeline ready:", pipeline_state.is_ready)
    print("Summary:")
    print("Dimension sweep count:", len(pipeline_state.dimension_sweep))
    for row in pipeline_state.dimension_sweep:
        print(f"k={row['k']}: EVR={row['cum_evr']}%, ReconErr={row['recon_error']}%, Sil={row['silhouette']}, DBI={row['davies_bouldin']}")
    
    print("\nTesting sample prediction:")
    test_reading = {
        "DHI": 120.0,
        "DNI": 750.0,
        "GHI": 820.0,
        "Wind_speed": 4.5,
        "Humidity": 35.0,
        "Temperature": 28.0,
        "PV_production": 11500.0,
        "Wind_production": 1200.0
    }
    pred = pipeline_state.predict_reading(test_reading, k=2)
    print("Assigned cluster:", pred["assigned_cluster_label"], "-", pred["assigned_cluster_name"])
    print("Confidence:", pred["confidence"])
    print("Probabilities:")
    for p in pred["probabilities"]:
        print(f"  {p['cluster_label']}: {p['probability']:.4f}")

