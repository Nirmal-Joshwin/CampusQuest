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

# Configure CORS safely for mobile app & web requests
raw_origins = settings.ALLOWED_ORIGINS.split(",") if hasattr(settings, "ALLOWED_ORIGINS") and settings.ALLOWED_ORIGINS else []
cors_origins = [o.strip() for o in raw_origins if o.strip()]

if settings.ENVIRONMENT == "development":
    allow_all = not cors_origins or "*" in cors_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if allow_all else cors_origins,
        allow_credentials=False if allow_all else True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins or ["https://campusquest.cit.edu.in"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )


# Security headers & Request Timing Middleware
@app.middleware("http")
async def production_security_and_timing_middleware(request, call_next):
    import time
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Response-Time"] = f"{duration_ms}ms"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.ENVIRONMENT != "development":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

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
    """Liveness probe: verifies that the HTTP server process is running."""
    return {"status": "healthy"}

@app.get("/health/ready", tags=["Health"])
def readiness_check():
    """Readiness probe: verifies database connectivity and core services."""
    from app.database import check_db_health
    from fastapi.responses import JSONResponse
    is_ready = check_db_health()
    if is_ready:
        return {"status": "ready", "database": "connected"}
    return JSONResponse(
        status_code=503,
        content={"status": "degraded", "database": "disconnected"}
    )


