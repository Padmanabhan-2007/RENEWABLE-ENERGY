from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class ReadingInput(BaseModel):
    DHI: float = Field(..., description="Diffuse Horizontal Irradiance (W/m²)", ge=0.0)
    DNI: float = Field(..., description="Direct Normal Irradiance (W/m²)", ge=0.0)
    GHI: float = Field(..., description="Global Horizontal Irradiance (W/m²)", ge=0.0)
    Wind_speed: float = Field(..., description="Wind Speed at 10m height (m/s)", ge=0.0)
    Humidity: float = Field(..., description="Relative Humidity (%)", ge=0.0, le=100.0)
    Temperature: float = Field(..., description="Ambient Air Temperature (°C)")
    PV_production: float = Field(..., description="Solar PV Power Output (MW)", ge=0.0)
    Wind_production: float = Field(..., description="Wind Generation Output (MW)", ge=0.0)

class PredictRequest(BaseModel):
    reading: ReadingInput
    k: Optional[int] = Field(2, ge=1, le=8, description="Number of retained Principal Components (default 2)")

class ProbabilityItem(BaseModel):
    cluster_id: int
    cluster_label: str
    name: str
    probability: float
    is_assigned: bool

class PredictResponse(BaseModel):
    assigned_cluster: int
    assigned_cluster_label: str
    assigned_cluster_name: str
    confidence: float
    probabilities: List[ProbabilityItem]
    pca_coordinates: List[float]
    pc3_coordinates: List[float]
    k: int
    c: int
    disclaimer: str

class ClusterFilterRequest(BaseModel):
    season: Optional[str] = None
    k: Optional[int] = 2

