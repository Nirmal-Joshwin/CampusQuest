import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.routers import spawns, auth, gameplay, shop, admin, multiplayer, friends, turf, pvp
# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("CampusQuest")

# Create database tables if supported
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema initialized successfully.")
except Exception as e:
    logger.warning(f"Could not automatically create database tables: {e}")

app = FastAPI(
    title=settings.APP_NAME,
    description="CampusQuest MVP Backend - Location-based campus exploration API for CIT",
    version="1.0.0",
)

# Enable CORS for mobile app requests (Expo Go, simulators, devices)
raw_origins = settings.ALLOWED_ORIGINS.split(",") if hasattr(settings, "ALLOWED_ORIGINS") and settings.ALLOWED_ORIGINS else []
cors_origins = [o.strip() for o in raw_origins if o.strip()]
if settings.ENVIRONMENT == "development" or not cors_origins:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount endpoints
app.include_router(spawns.router)
app.include_router(auth.router)
app.include_router(gameplay.router)
app.include_router(shop.router)
app.include_router(admin.router)
app.include_router(multiplayer.router)
app.include_router(friends.router)
app.include_router(turf.router)
app.include_router(pvp.router)
@app.get("/", tags=["Health"])
def root():
    return {
        "status": "online",
        "service": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "cit_geofence": {
            "bounds": {
                "min_lat": 11.0250,
                "max_lat": 11.0300,
                "min_lng": 77.0250,
                "max_lng": 77.0300,
            },
            "location": "Coimbatore Institute of Technology (CIT)"
        },
        "docs_url": "/docs"
    }

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}

