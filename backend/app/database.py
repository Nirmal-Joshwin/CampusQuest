import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger(__name__)

# Primary database engine (PostgreSQL with PostGIS) or SQLite fallback
try:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        echo=False
    )
    with engine.connect() as conn:
        pass
except Exception as e:
    logger.warning(f"Could not connect to primary PostgreSQL database ({e}). Using SQLite fallback for local dev.")
    engine = create_engine("sqlite:///./campusquest.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency that yields an active database session and closes it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

