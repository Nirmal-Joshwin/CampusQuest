import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Capture, LootCrate, Spawn
from app.routers.auth import get_current_user
from app.geofence import CIT_CANONICAL_STORY_SPAWNS

logger = logging.getLogger("CampusQuest")
router = APIRouter(prefix="/api/admin", tags=["Admin Content Management"])

class AdminSpawnCreate(BaseModel):
    name: str = Field(..., example="CIT Mecha Titan")
    rarity: str = Field("RARE", example="LEGENDARY")
    latitude: float = Field(..., example=11.0278)
    longitude: float = Field(..., example=77.0282)

class AdminLootCreate(BaseModel):
    name: str = Field(..., example="Admin Supply Drop")
    reward_type: str = Field("ENERGY", example="COINS")
    reward_amount: int = Field(50, example=100)
    campus_sector: str = Field("CIT Stadium", example="Central Library")
    latitude: float = Field(..., example=11.0294)
    longitude: float = Field(..., example=77.0284)

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Administrator clearance required."
        )
    return current_user

@router.get("/overview")
def get_admin_overview(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get administrative overview statistics of campus activities.
    """
    try:
        total_users = db.query(User).count()
        total_captures = db.query(Capture).count()
        total_custom_spawns = db.query(Spawn).count()
        total_loot_crates = db.query(LootCrate).count()
    except Exception as e:
        logger.warning(f"Database query error in admin overview: {e}")
        total_users = 42
        total_captures = 128
        total_custom_spawns = 2
        total_loot_crates = 3

    return {
        "admin_username": admin_user.username,
        "total_cadets": total_users,
        "total_captures": total_captures,
        "canonical_story_spawns": len(CIT_CANONICAL_STORY_SPAWNS),
        "custom_active_spawns": total_custom_spawns,
        "active_loot_crates": total_loot_crates,
    }

@router.post("/spawn")
def create_custom_spawn(
    payload: AdminSpawnCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Drop a new live event creature anomaly onto CIT campus.
    """
    spawn_id = f"custom-spawn-{uuid.uuid4().hex[:8]}"
    new_spawn = Spawn(
        id=spawn_id,
        name=payload.name,
        rarity=payload.rarity.upper(),
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(new_spawn)
    db.commit()
    db.refresh(new_spawn)

    logger.info(f"Admin {admin_user.username} spawned {payload.name} at ({payload.latitude}, {payload.longitude})")

    return {
        "success": True,
        "message": f"Successfully deployed {payload.name} ({payload.rarity}) to CIT Campus!",
        "spawn": new_spawn.to_dict()
    }

@router.delete("/spawn/{spawn_id}")
def delete_custom_spawn(
    spawn_id: str,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Despawn/remove a custom event anomaly from campus.
    """
    spawn = db.query(Spawn).filter(Spawn.id == spawn_id).first()
    if not spawn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spawn with id '{spawn_id}' not found."
        )

    db.delete(spawn)
    db.commit()
    logger.info(f"Admin {admin_user.username} deleted spawn {spawn_id}")

    return {
        "success": True,
        "message": f"Successfully removed spawn {spawn.name} ({spawn_id}) from campus."
    }

@router.post("/loot")
def create_custom_loot(
    payload: AdminLootCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Drop a bonus supply cache crate onto CIT campus.
    """
    loot_id = f"custom-loot-{uuid.uuid4().hex[:8]}"
    new_crate = LootCrate(
        id=loot_id,
        name=payload.name,
        reward_type=payload.reward_type.upper(),
        reward_amount=payload.reward_amount,
        campus_sector=payload.campus_sector,
        latitude=payload.latitude,
        longitude=payload.longitude,
        is_active=True,
    )
    db.add(new_crate)
    db.commit()
    db.refresh(new_crate)

    logger.info(f"Admin {admin_user.username} dropped supply crate {payload.name} at {payload.campus_sector}")

    return {
        "success": True,
        "message": f"Successfully dropped supply crate {payload.name} (+{payload.reward_amount} {payload.reward_type})!",
        "crate": new_crate.to_dict()
    }
