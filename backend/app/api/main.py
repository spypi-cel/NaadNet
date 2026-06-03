from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.nodes import router as nodes_router
from app.api.alerts import router as alerts_router
from app.api.analytics import router as analytics_router
from app.api.predictions import router as predictions_router
from app.api.heatmap import router as heatmap_router
from app.api.users import router as users_router

app = FastAPI(
    title="NaadNet API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(nodes_router)
app.include_router(alerts_router)
app.include_router(analytics_router)
app.include_router(predictions_router)
app.include_router(heatmap_router)
app.include_router(users_router)

@app.get("/")

def home():

    return {
        "status":"running",
        "project":"NaadNet"
    }