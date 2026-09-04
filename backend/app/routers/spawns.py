import logging
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Spawn
from app.schemas import SpawnResponse
from app.geofence import get_cit_story_spawns

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/spawns", tags=["Spawns"])

@router.get("", response_model=List[SpawnResponse])
def get_spawns(
    count: int = Query(8, ge=1, le=50, description="Number of canonical story spawns to return"),
    persist: bool = Query(False, description="Whether to persist story spawns to PostgreSQL"),
    db: Session = Depends(get_db)
):
    """
    Returns the persistent canonical CIT campus story spawns.
    Coordinates remain fixed at their designated campus landmarks.
    """
    story_spawns = get_cit_story_spawns(count=count)
    
    if persist:
        try:
            for item in story_spawns:
                existing = db.query(Spawn).filter(Spawn.id == item["id"]).first()
                if not existing:
                    db_spawn = Spawn(
                        id=item["id"],
                        name=item["name"],
                        rarity=item.get("rarity", "COMMON"),
                        latitude=item["latitude"],
                        longitude=item["longitude"]
                    )
                    db.add(db_spawn)
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to persist spawns to database: {e}")
            db.rollback()

    return story_spawns
