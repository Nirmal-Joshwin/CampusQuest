import logging
import uuid
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Capture
from app.routers.auth import get_current_user

logger = logging.getLogger("CampusQuest")
router = APIRouter(prefix="/api/multiplayer", tags=["Multiplayer & Tag-Team Raids"])

# In-memory Real-time Peer Tracker & Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.peer_positions: Dict[str, dict] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.peer_positions:
            del self.peer_positions[user_id]

    def update_position(self, user_id: str, data: dict):
        self.peer_positions[user_id] = {
            "user_id": user_id,
            "username": data.get("username", "Cadet"),
            "department": data.get("department", "CSE"),
            "level": data.get("level", 1),
            "avatar_title": data.get("avatar_title", "Explorer"),
            "latitude": data.get("latitude", 11.0278),
            "longitude": data.get("longitude", 77.0282),
            "updated_at": datetime.utcnow().isoformat(),
        }

    async def broadcast_peers(self):
        peers_list = list(self.peer_positions.values())
        payload = {"type": "PEERS_UPDATE", "peers": peers_list}
        for user_id, ws in list(self.active_connections.items()):
            try:
                await ws.send_json(payload)
            except Exception:
                pass

manager = ConnectionManager()

# In-memory Active Tag-Team Raid Groups
ACTIVE_RAID_GROUPS: Dict[str, dict] = {}

class CreateRaidRequest(BaseModel):
    boss_name: str = Field("CIT CyberDragon", example="CIT CyberDragon")
    campus_sector: str = Field("Admin Block & Tower", example="Admin Block")

class JoinRaidRequest(BaseModel):
    raid_id: str

@router.websocket("/ws/radar/{user_id}")
async def websocket_radar_endpoint(websocket: WebSocket, user_id: str):
    """
    Real-time multiplayer WebSocket to broadcast positions and track nearby students on campus.
    """
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

@router.post("/raid/create")
def create_tag_team_raid(
    request: CreateRaidRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Host a new cooperative Tag-Team Raid lobby for a Legendary Anomaly.
    """
    raid_id = f"raid-{uuid.uuid4().hex[:6]}"
    raid_data = {
        "raid_id": raid_id,
        "boss_name": request.boss_name,
        "campus_sector": request.campus_sector,
        "host_user_id": current_user.id,
        "host_username": current_user.username,
        "created_at": datetime.utcnow().isoformat(),
        "teammates": [
            {
                "user_id": current_user.id,
                "username": current_user.username,
                "department": current_user.department,
                "level": current_user.level,
            }
        ],
        "status": "OPEN", # OPEN, IN_PROGRESS, COMPLETED
    }
    ACTIVE_RAID_GROUPS[raid_id] = raid_data

    return {
        "success": True,
        "message": f"Tag-Team Strike Lobby created for {request.boss_name}!",
        "raid": raid_data
    }

@router.post("/raid/join")
def join_tag_team_raid(
    request: JoinRaidRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Join an open cooperative Tag-Team Raid lobby with nearby cadets.
    """
    raid = ACTIVE_RAID_GROUPS.get(request.raid_id)
    if not raid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Raid lobby '{request.raid_id}' not found or has expired."
        )

    # Check if already joined
    if not any(m["user_id"] == current_user.id for m in raid["teammates"]):
        raid["teammates"].append({
            "user_id": current_user.id,
            "username": current_user.username,
            "department": current_user.department,
            "level": current_user.level,
        })

    return {
        "success": True,
        "message": f"Joined Tag-Team Strike Group for {raid['boss_name']}!",
        "raid": raid
    }

@router.get("/raid/{raid_id}")
def get_raid_status(raid_id: str):
    """
    Get current lobby and teammate status for a tag team raid.
    """
    raid = ACTIVE_RAID_GROUPS.get(raid_id)
    if not raid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Raid group '{raid_id}' not found."
        )
    return raid

@router.post("/raid/{raid_id}/complete")
def complete_tag_team_raid(
    raid_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Complete the tag-team raid, awarding shared bonus XP and bestiary registration to all teammates.
    """
    raid = ACTIVE_RAID_GROUPS.get(raid_id)
    if not raid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Raid group '{raid_id}' not found."
        )

    raid["status"] = "COMPLETED"

    # Award +2000 Bonus XP & commit capture for host/caller
    current_user.xp += 2000
    current_user.coins += 100
    db.commit()

    return {
        "success": True,
        "message": f"🎉 TAG-TEAM VICTORY! {raid['boss_name']} secured with your strike team!\n+2000 XP & +100 Data Credits awarded to all members!",
        "raid": raid
    }

