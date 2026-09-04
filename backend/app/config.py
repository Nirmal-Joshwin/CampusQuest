import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    APP_NAME: str = "CampusQuest API"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+psycopg2://postgres:postgres@localhost:5432/campusquest_db"
    )
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY",
        "cit-campusquest-prod-secret-2026-secure-key-9823184"
    )
    ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:8081,http://localhost:19006,exp://10.116.198.55:8081"
    )

    class Config:
        case_sensitive = True

settings = Settings()

