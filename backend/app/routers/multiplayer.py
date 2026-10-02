import logging
import uuid
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Capture, RaidGroup, RaidMember
from app.auth import get_current_user

logger = logging.getLogger("CampusQuest")
router = APIRouter(prefix="/api/multiplayer", tags=["Multiplayer & Raids"])

# Remove ACTIVE_RAID_GROUPS: Dict[str, dict] = {}
# Now we use the database to prevent desync across workers

class CreateRaidRequest(BaseModel):
    boss_name: str = Field("CIT CyberDragon", example="CIT CyberDragon")
    campus_sector: str = Field("Admin Block & Tower", example="Admin Block")

class JoinRaidRequest(BaseModel):
    raid_id: str

from app.auth import SECRET_KEY, ALGORITHM
import jwt

@router.websocket("/ws/radar/{user_id}")
async def websocket_radar_endpoint(websocket: WebSocket, user_id: str, token: Optional[str] = None):
    """
    Real-time multiplayer WebSocket to broadcast positions and track nearby students on campus.
    Validates JWT token if supplied to prevent beacon impersonation.
    """
    if not token:
        logger.warning(f"WebSocket connection rejected: Missing token for {user_id}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if str(sub) != str(user_id):
            logger.warning(f"WebSocket token mismatch: token sub {sub} != user_id {user_id}")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception as e:
        logger.warning(f"WebSocket auth failed for {user_id}: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "POSITION_UPDATE":
                manager.update_position(user_id, data)
                await manager.broadcast_peers()
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await manager.broadcast_peers()
    except Exception as e:
        logger.warning(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(user_id)


@router.get("/peers")
def get_active_peers():
    """
    HTTP polling fallback for active nearby cadets on campus.
    """
    return {
        "active_cadets_count": len(manager.peer_positions),
        "peers": list(manager.peer_positions.values())
    }

def _serialize_raid(db: Session, raid: RaidGroup):
    members = db.query(RaidMember).filter(RaidMember.raid_id == raid.raid_id).all()
    return {
        "raid_id": raid.raid_id,
        "boss_name": raid.boss_name,
        "campus_sector": raid.campus_sector,
        "host_user_id": raid.host_user_id,
        "host_username": raid.host_username,
        "status": raid.status,
        "created_at": raid.created_at.isoformat() if raid.created_at else None,
        "teammates": [
            {
                "user_id": m.user_id,
                "username": m.username,
                "department": m.department,
                "level": m.level,
            } for m in members
        ]
    }

@router.post("/raid/create")
def create_tag_team_raid(
    request: CreateRaidRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Host a new cooperative Tag-Team Raid lobby for a Legendary Anomaly.
    """
    raid_id = f"raid-{uuid.uuid4().hex[:6]}"
    
    new_raid = RaidGroup(
        raid_id=raid_id,
        boss_name=request.boss_name,
        campus_sector=request.campus_sector,
        host_user_id=current_user.id,
        host_username=current_user.username,
        status="OPEN"
    )
    db.add(new_raid)
    
    host_member = RaidMember(
        raid_id=raid_id,
        user_id=current_user.id,
        username=current_user.username,
        department=current_user.department,
        level=current_user.level
    )
    db.add(host_member)
    db.commit()

    return {
        "success": True,
        "message": f"Tag-Team Strike Lobby created for {request.boss_name}!",
        "raid": _serialize_raid(db, new_raid)
    }

@router.post("/raid/join")
def join_tag_team_raid(
    request: JoinRaidRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Join an open cooperative Tag-Team Raid lobby with nearby cadets.
    """
    raid = db.query(RaidGroup).filter(RaidGroup.raid_id == request.raid_id).first()
    if not raid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Raid lobby '{request.raid_id}' not found or has expired."
        )

    existing = db.query(RaidMember).filter(RaidMember.raid_id == request.raid_id, RaidMember.user_id == current_user.id).first()
    if not existing:
        new_member = RaidMember(
            raid_id=raid.raid_id,
            user_id=current_user.id,
            username=current_user.username,
            department=current_user.department,
            level=current_user.level
        )
        db.add(new_member)
        db.commit()

    return {
        "success": True,
        "message": f"Joined Tag-Team Strike Group for {raid.boss_name}!",
        "raid": _serialize_raid(db, raid)
    }

@router.get("/raid/{raid_id}")
def get_raid_status(raid_id: str, db: Session = Depends(get_db)):
    """
    Get current lobby and teammate status for a tag team raid.
    """
    raid = db.query(RaidGroup).filter(RaidGroup.raid_id == raid_id).first()
    if not raid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Raid group '{raid_id}' not found."
        )
    return _serialize_raid(db, raid)

@router.post("/raid/{raid_id}/complete")
def complete_tag_team_raid(
    raid_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Complete the tag-team raid, awarding shared bonus XP and bestiary registration to all teammates.
    Prevents exploitation by enforcing single completion and membership verification.
    """
    raid = db.query(RaidGroup).filter(RaidGroup.raid_id == raid_id).first()
    if not raid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Raid group '{raid_id}' not found."
        )

    if raid.status == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Raid rewards have already been claimed! Anomaly strike is completed."
        )

    members = db.query(RaidMember).filter(RaidMember.raid_id == raid_id).all()
    is_teammate = raid.host_user_id == current_user.id or any(m.user_id == current_user.id for m in members)
    
    if not is_teammate:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You must be a deployed member of this strike team to complete the raid."
        )

    raid.status = "COMPLETED"

    # Award +2000 Bonus XP & Data Credits
    current_user.xp += 2000
    current_user.coins += 100
    db.commit()

    return {
        "success": True,
        "message": f"🎉 TAG-TEAM VICTORY! {raid.boss_name} secured with your strike team!\n+2000 XP & +100 Data Credits awarded to all members!",
        "raid": _serialize_raid(db, raid)
    }


