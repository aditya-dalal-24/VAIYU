from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from app.models.vision_model import VisionModel
from app.models.trajectory_model import TrajectoryModel
from app.models.similarity_model import SimilarityModel
from app.services.report_generator import ReportGenerator

app = FastAPI(
    title="CycloVision AI Service",
    description="Stateless AI/ML Inference & Explainable Intelligence API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vision_model = VisionModel()
trajectory_model = TrajectoryModel()
similarity_model = SimilarityModel()
report_generator = ReportGenerator()

class VisionRequest(BaseModel):
    cyclone_id: str
    image_url: Optional[str] = None

class TrajectoryRequest(BaseModel):
    cyclone_id: str
    current_lat: float = 19.4
    current_long: float = 67.8
    wind_speed: float = 165.0

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "CycloVision AI Inference Service",
        "models_loaded": ["ResNet34-GradCAM-v1", "Kalman-XGBoost-v2.1", "KNN-Similarity-v1"]
    }

@app.post("/analyze-vision")
def analyze_vision(req: VisionRequest):
    return vision_model.analyze_image(req.image_url or "")

@app.post("/predict-trajectory")
def predict_trajectory(req: TrajectoryRequest):
    return trajectory_model.predict_trajectory(req.current_lat, req.current_long, req.wind_speed)

@app.get("/similar/{cyclone_id}")
def find_similar(cyclone_id: str):
    return similarity_model.find_similar(cyclone_id)

@app.get("/report/{cyclone_id}")
def generate_report(cyclone_id: str):
    return report_generator.generate_report(cyclone_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
