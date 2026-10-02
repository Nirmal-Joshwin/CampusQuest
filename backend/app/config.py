import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

DEFAULT_INSECURE_SECRET = "cit-campusquest-prod-secret-2026-secure-key-9823184"

class Settings(BaseSettings):
    APP_NAME: str = "CampusQuest API"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+psycopg2://postgres:postgres@localhost:5432/campusquest_db"
    )
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", DEFAULT_INSECURE_SECRET)
    ADMIN_REGISTRATION_KEY: str = os.getenv("ADMIN_REGISTRATION_KEY", "")
    ALLOWED_ORIGINS: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:8081,http://localhost:19006,exp://10.116.198.55:8081"
    )

    class Config:
        case_sensitive = True

    def validate_security(self):
        if self.ENVIRONMENT.lower() != "development":
            if self.JWT_SECRET_KEY == DEFAULT_INSECURE_SECRET or not self.JWT_SECRET_KEY:
                raise ValueError(
                    "CRITICAL SECURITY ERROR: Running in non-development mode with default or missing JWT_SECRET_KEY!"
                )
            if not self.ADMIN_REGISTRATION_KEY:
                raise ValueError(
                    "CRITICAL SECURITY ERROR: ADMIN_REGISTRATION_KEY must be set in non-development environments."
                )

settings = Settings()
settings.validate_security()


