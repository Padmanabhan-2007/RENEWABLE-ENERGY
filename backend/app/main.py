import os
import io
import pandas as pd
import numpy as np
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any

# Silence loky warning
os.environ["LOKY_MAX_CPU_COUNT"] = "4"

from fastapi import FastAPI, HTTPException, Request, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.pipeline import pipeline_state, FEATURES_8, derive_cluster_description, EXPECTED_SHA256
from app.schemas import ReadingInput, PredictRequest, PredictResponse

SEASON_NAME_TO_INT = {
    "winter": 1,
    "spring": 2,
    "summer": 3,
    "fall": 4,
    "autumn": 4,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4
}
SEASON_INT_TO_NAME = {
    1: "Winter",
    2: "Spring",
    3: "Summer",
    4: "Fall"
}

TEAM_INFO = {
    "institution": "SRM Institute of Science & Technology",
    "department": "CTECH Department",
    "course": "21CSE305P Introduction to Machine Learning",
    "batch": "Batch 9",
    "project_title": "Renewable Energy Production Pattern Discovery Using PCA and Gaussian Mixture Models",
    "members": [
        {"name": "PADMANABHAN S", "reg_no": "RA2411003011917", "role": "Lead ML Engineering & Pipeline"},
        {"name": "BENIT D BINU", "reg_no": "RA2411003011939", "role": "Statistical Evaluation & GMM Modeling"},
        {"name": "MUHUNTHA VEL", "reg_no": "RA2411003011955", "role": "EDA, Preprocessing & Quality Verification"},
        {"name": "ABHISHEK R", "reg_no": "RA2411003011957", "role": "PCA Dimensionality & Interface Design"}
    ]
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load cached models and analysis on startup
    print("[Server] Initializing pipeline on startup...")
    try:
        pipeline_state.load_or_compute()
        print("[Server] Pipeline is ready to serve requests.")
    except Exception as e:
        print(f"[Server] Startup pipeline warning: {e}")
    yield

app = FastAPI(
    title="Renewable Energy Pattern Discovery API",
    description="Batch 9 Machine Learning Project - PCA & GMM Operational Regime Discovery",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/api/status")
def get_status():
    return {
        "status": "ready" if pipeline_state.is_ready else "initializing",
        "dataset_loaded": pipeline_state.is_ready,
        "dataset_name": "Database.csv",
        "expected_sha256": EXPECTED_SHA256,
        "actual_sha256": pipeline_state.quality_report.get("file_sha256", "pending"),
        "sha256_match": pipeline_state.quality_report.get("sha256_match", False),
        "total_hourly_records": pipeline_state.quality_report.get("hourly_rows", 26304),
        "total_raw_records": pipeline_state.quality_report.get("n_raw_records", 315648),
        "date_range": "2019-01-01 to 2021-12-31"
    }

@app.get("/api/overview")
def get_overview():
    if not pipeline_state.is_ready:
        raise HTTPException(status_code=503, detail="Pipeline data is still loading")
        
    return {
        "kpis": {
            "raw_records": pipeline_state.quality_report.get("n_raw_records", 315648),
            "hourly_records": pipeline_state.quality_report.get("hourly_rows", 26304),
            "features_count": 8,
            "coverage": "2019-01-01 to 2021-12-31 (3 Years)",
            "selected_k": 2,
            "selected_c": 5,
            "explained_variance_pct": 77.4,
            "reconstruction_error_pct": 22.6,
            "validation_silhouette": 0.242,
            "validation_davies_bouldin": 1.340,
            "best_model_name": "PCA (k=2) + GMM (C=5, Full Covariance)"
        },
        "data_source": {
            "title": "Renewable Energy and Electricity Demand Time Series Dataset with Exogenous Variables at 5-minute Interval",
            "repository": "Mendeley Data",
            "doi": "10.17632/fdfftr3tc2.1",
            "cadence": "5-minute raw interval resampled to hourly means",
            "scope": "Historical CAISO & NREL-derived solar, wind, and meteorology data (not a live feed)",
            "columns": FEATURES_8 + ["Time", "Season", "Day_of_the_week", "Electric_demand"]
        },
        "project_team": TEAM_INFO
    }

@app.get("/api/data-quality")
def get_data_quality():
    if not pipeline_state.is_ready:
        raise HTTPException(status_code=503, detail="Pipeline data is still loading")
    return pipeline_state.quality_report

@app.get("/api/eda")
def get_eda():
    if not pipeline_state.is_ready:
        raise HTTPException(status_code=503, detail="Pipeline data is still loading")
    return pipeline_state.eda_summary

@app.get("/api/pca/sweep")
def get_pca_sweep():
    if not pipeline_state.is_ready:
        raise HTTPException(status_code=503, detail="Pipeline data is still loading")
    return {
        "sweep": pipeline_state.dimension_sweep,
        "recommended_k": 2,
        "tradeoff_explanation": "k=2 achieves the highest validation Silhouette score (0.242) and lowest Davies-Bouldin index (1.340) within the GMM model suite, retaining 77.4% cumulative variance. While k=3 increases explained variance to 88.2%, the resulting cluster separation drops sharply to 0.149 silhouette."
    }

@app.get("/api/pca/loadings")
def get_pca_loadings():
    if not pipeline_state.is_ready:
        raise HTTPException(status_code=503, detail="Pipeline data is still loading")
    return pipeline_state.pca_loadings

@app.get("/api/clusters")
def get_clusters(
    k: Optional[int] = Query(2, ge=1, le=8, description="Number of retained PCA dimensions (1..8)"),
    season: Optional[str] = Query(None, description="Optional season filter: Winter, Spring, Summer, Fall, or 1-4"),
    start_date: Optional[str] = Query(None, description="Filter start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter end date YYYY-MM-DD")
):
    if not pipeline_state.is_ready:
        raise HTTPException(status_code=503, detail="Pipeline data is still loading")
    try:
        return pipeline_state.get_cluster_profiles(
            k=k or 2,
            season=season,
            start_date=start_date,
            end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/pca/scatter")
def get_scatter(
    k: Optional[int] = Query(2, ge=1, le=8, description="Number of retained PCA dimensions (1..8)"),
    season: Optional[str] = Query(None, description="Optional season filter: Winter, Spring, Summer, Fall, or 1-4"),
    start_date: Optional[str] = Query(None, description="Filter start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter end date YYYY-MM-DD")
):
    if not pipeline_state.is_ready:
        raise HTTPException(status_code=503, detail="Pipeline data is still loading")
    try:
        return pipeline_state.get_scatter_data(
            k=k or 2,
            season=season,
            start_date=start_date,
            end_date=end_date
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/export/sweep")
def export_sweep_csv():
    if not pipeline_state.is_ready:
        raise HTTPException(status_code=503, detail="Pipeline data is still loading")
    df_sweep = pd.DataFrame(pipeline_state.dimension_sweep)
    stream = io.StringIO()
    df_sweep.to_csv(stream, index=False)
    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pca_dimension_sweep_k1_8.csv"}
    )

@app.get("/api/method-comparison")
def get_method_comparison():
    if not pipeline_state.is_ready:
        raise HTTPException(status_code=503, detail="Pipeline data is still loading")
    return pipeline_state.method_comparison

@app.post("/api/predict", response_model=PredictResponse)
def predict_reading_endpoint(req: PredictRequest):
    if not pipeline_state.is_ready:
        raise HTTPException(status_code=503, detail="Pipeline data is still loading")
    try:
        result = pipeline_state.predict_reading(req.reading.model_dump(), k=req.k or 2)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/upload")
async def upload_csv(request: Request):
    try:
        contents = await request.body()
        if not contents or len(contents) == 0:
            raise HTTPException(status_code=400, detail="Empty request body. Please provide CSV data.")
            
        df_uploaded = pd.read_csv(io.BytesIO(contents))
        
        # Validate schema
        missing_feats = [f for f in FEATURES_8 if f not in df_uploaded.columns]
        if missing_feats:
            raise HTTPException(
                status_code=422,
                detail=f"Uploaded CSV is missing mandatory features: {missing_feats}. Required: {FEATURES_8}"
            )
            
        if "Time" not in df_uploaded.columns and "Timestamp" not in df_uploaded.columns:
            raise HTTPException(
                status_code=422,
                detail="Uploaded CSV must contain a 'Time' or 'Timestamp' column."
            )
            
        n_rows = len(df_uploaded)
        if n_rows < 1:
            raise HTTPException(
                status_code=422,
                detail="Uploaded CSV has no data rows. Add at least one observation and try again."
            )

        # Validate values without silently changing the uploaded file.
        numeric = df_uploaded[FEATURES_8].apply(pd.to_numeric, errors="coerce")
        invalid_numeric = int((df_uploaded[FEATURES_8].notna() & numeric.isna()).sum().sum())
        if invalid_numeric:
            raise HTTPException(
                status_code=422,
                detail=f"Found {invalid_numeric} non-numeric value(s) in the eight model columns. Correct those cells and upload again."
            )
        time_col = "Time" if "Time" in df_uploaded.columns else "Timestamp"
        parsed_time = pd.to_datetime(df_uploaded[time_col], errors="coerce")
        invalid_timestamps = int(parsed_time.isna().sum())
        if invalid_timestamps:
            raise HTTPException(
                status_code=422,
                detail=f"Found {invalid_timestamps} invalid or empty timestamp(s) in '{time_col}'."
            )

        neg_pv = int((numeric["PV_production"] < 0).sum())
        neg_wind = int((numeric["Wind_production"] < 0).sum())
        missing_vals = int(numeric.isna().sum().sum())
        
        return {
            "status": "validated",
            "rows_read": n_rows,
            "columns": df_uploaded.columns.tolist(),
            "model_features": FEATURES_8,
            "metadata_columns": [c for c in ["Time", "Timestamp", "Season", "Day_of_the_week"] if c in df_uploaded.columns],
            "negative_pv_count": neg_pv,
            "negative_wind_count": neg_wind,
            "negative_pv_clipped": neg_pv,
            "negative_wind_clipped": neg_wind,
            "missing_values": missing_vals,
            "invalid_timestamps": invalid_timestamps,
            "validation_only": True,
            "message": "CSV schema and values passed verification. The uploaded file was not ingested and did not change the fitted model."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")

@app.get("/api/export/clusters")
def export_clusters_csv(
    k: Optional[int] = Query(2, ge=1, le=8),
    season: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    if not pipeline_state.is_ready or pipeline_state.val_df is None:
        raise HTTPException(status_code=503, detail="Pipeline data is still loading")
        
    k = max(1, min(8, int(k or 2)))
    c_val = 5
    for sweep_entry in pipeline_state.dimension_sweep:
        if sweep_entry["k"] == k:
            c_val = sweep_entry["c_selected"]
            break
            
    pca_k = pipeline_state.pca_models.get(k)
    gmm = pipeline_state.gmm_models.get((k, c_val))
    
    df_exp = pipeline_state.val_df.copy()
    if season and season.lower() != "all":
        season_code = SEASON_NAME_TO_INT.get(season.lower())
        if season_code is not None:
            df_exp = df_exp[df_exp["Season"] == season_code]
        else:
            df_exp = df_exp[df_exp["Season"].astype(str).str.lower() == season.lower()]
            
    if start_date:
        try:
            df_exp = df_exp[df_exp["Timestamp"] >= pd.to_datetime(start_date)]
        except Exception:
            pass
    if end_date:
        try:
            df_exp = df_exp[df_exp["Timestamp"] <= pd.to_datetime(end_date)]
        except Exception:
            pass
            
    if len(df_exp) > 0 and pca_k and gmm:
        X_scaled = pipeline_state.scaler.transform(pipeline_state.imputer.transform(df_exp[FEATURES_8].values))
        df_exp["Cluster"] = gmm.predict(pca_k.transform(X_scaled)) + 1
        
    export_cols = ["Timestamp", "Season", "Day_of_the_week", "Cluster"] + FEATURES_8
    available_cols = [c for c in export_cols if c in df_exp.columns]
    
    stream = io.StringIO()
    df_exp[available_cols].to_csv(stream, index=False)
    
    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=validation_clusters_k{k}_c{c_val}.csv"}
    )

# Mount compiled frontend static build if available
dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend_dist")
