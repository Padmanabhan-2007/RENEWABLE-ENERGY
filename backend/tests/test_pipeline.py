import os
import sys

# Ensure backend package is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["LOKY_MAX_CPU_COUNT"] = "4"

import pytest
import numpy as np
from fastapi.testclient import TestClient

from app.pipeline import pipeline_state, FEATURES_8, EXPECTED_SHA256
from app.main import app

@pytest.fixture(scope="session", autouse=True)
def init_pipeline():
    # Make sure cache is loaded or computed once for the entire test session
    pipeline_state.load_or_compute()
    assert pipeline_state.is_ready is True

def test_data_validation_and_cadence():
    report = pipeline_state.quality_report
    assert report["sha256_match"] is True
    assert report["n_raw_records"] == 315648
    assert report["expected_raw_records"] == 315648
    assert report["missing_values_count"] == 0
    assert report["negative_pv_count"] == 112829
    assert report["negative_wind_count"] == 216
    assert report["cadence_regular"] is True

def test_preprocessing_and_chronological_split():
    report = pipeline_state.quality_report
    assert report["hourly_rows"] == 26304
    split = report["split"]
    assert split["train_rows"] == 18412
    assert split["val_rows"] == 3945
    assert split["test_rows"] == 3947
    assert split["train_rows"] + split["val_rows"] + split["test_rows"] == 26304
    # Confirms no leakage and no median imputer changes
    assert report["imputer_changes"] == 0

def test_pca_variance_and_reconstruction():
    sweep = pipeline_state.dimension_sweep
    assert len(sweep) == 8
    
    # Check cumulative EVR progression matches published deck
    k1 = next(s for s in sweep if s["k"] == 1)
    k2 = next(s for s in sweep if s["k"] == 2)
    k3 = next(s for s in sweep if s["k"] == 3)
    k8 = next(s for s in sweep if s["k"] == 8)
    
    assert abs(k1["cum_evr"] - 61.2) < 0.5
    assert abs(k2["cum_evr"] - 77.4) < 0.5
    assert abs(k3["cum_evr"] - 88.2) < 0.5
    assert abs(k8["cum_evr"] - 100.0) < 0.1
    
    # Reconstruction error should strictly decrease
    for i in range(len(sweep) - 1):
        assert sweep[i]["recon_error"] >= sweep[i+1]["recon_error"]

def test_model_probability_sums_and_shape():
    reading = {
        "DHI": 150.0,
        "DNI": 800.0,
        "GHI": 850.0,
        "Wind_speed": 6.0,
        "Humidity": 40.0,
        "Temperature": 25.0,
        "PV_production": 10000.0,
        "Wind_production": 2500.0
    }
    result = pipeline_state.predict_reading(reading, k=2)
    
    assert "assigned_cluster" in result
    assert 0 <= result["assigned_cluster"] <= 4
    assert len(result["probabilities"]) == 5
    
    prob_sum = sum(p["probability"] for p in result["probabilities"])
    assert abs(prob_sum - 1.0) < 1e-3, f"Probabilities must sum to 1.0, got {prob_sum}"
    
    # Disclaimer check
    assert "CRITICAL METHODOLOGY NOTE" in result["disclaimer"]
    assert "NOT an energy production forecast" in result["disclaimer"]

def test_api_endpoints():
    client = TestClient(app)
    
    # GET /api/status
    res = client.get("/api/status")
    assert res.status_code == 200
    status_data = res.json()
    assert status_data["status"] == "ready"
    assert status_data["dataset_loaded"] is True
    
    # GET /api/overview
    res = client.get("/api/overview")
    assert res.status_code == 200
    overview_data = res.json()
    assert overview_data["kpis"]["selected_k"] == 2
    assert overview_data["kpis"]["selected_c"] == 5
    assert len(overview_data["project_team"]["members"]) == 4
    
    # GET /api/pca/sweep
    res = client.get("/api/pca/sweep")
    assert res.status_code == 200
    assert len(res.json()["sweep"]) == 8
    
    # GET /api/clusters
    res = client.get("/api/clusters")
    assert res.status_code == 200
    assert len(res.json()["clusters"]) == 5
    
    # GET /api/clusters with season filter
    res_winter = client.get("/api/clusters?season=Winter")
    assert res_winter.status_code == 200
    assert "filter_applied" in res_winter.json()
    
    # GET /api/method-comparison
    res = client.get("/api/method-comparison")
    assert res.status_code == 200
    assert len(res.json()["methods"]) == 3
    
    # POST /api/predict
    payload = {
        "reading": {
            "DHI": 50.0,
            "DNI": 200.0,
            "GHI": 220.0,
            "Wind_speed": 3.0,
            "Humidity": 70.0,
            "Temperature": 15.0,
            "PV_production": 1500.0,
            "Wind_production": 800.0
        },
        "k": 2
    }
    res = client.post("/api/predict", json=payload)
    assert res.status_code == 200
    pred = res.json()
    assert "assigned_cluster_label" in pred
    assert "confidence" in pred

def test_multidimension_clusters_and_scatter():
    client = TestClient(app)
    
    # Test k=3 clusters and scatter
    res_c3 = client.get("/api/clusters?k=3")
    assert res_c3.status_code == 200
    data_c3 = res_c3.json()
    assert data_c3["k"] == 3
    assert len(data_c3["clusters"]) == 5
    
    res_s3 = client.get("/api/pca/scatter?k=3")
    assert res_s3.status_code == 200
    data_s3 = res_s3.json()
    assert data_s3["k"] == 3
    assert len(data_s3["points"]) > 0

def test_date_and_season_filtering():
    client = TestClient(app)
    
    res = client.get("/api/clusters?k=2&season=Summer&start_date=2021-06-01&end_date=2021-07-01")
    assert res.status_code == 200
    data = res.json()
    assert data["filter_applied"] is not None
    assert "start_date" in data["filter_applied"]
    assert data["total_val_hours"] > 0

def test_csv_exports():
    client = TestClient(app)
    
    res_sweep = client.get("/api/export/sweep")
    assert res_sweep.status_code == 200
    assert "text/csv" in res_sweep.headers["content-type"]
    assert "k,c_selected,cum_evr" in res_sweep.text
    
    res_clusters = client.get("/api/export/clusters?k=2")
    assert res_clusters.status_code == 200
    assert "text/csv" in res_clusters.headers["content-type"]
    assert "Timestamp" in res_clusters.text

