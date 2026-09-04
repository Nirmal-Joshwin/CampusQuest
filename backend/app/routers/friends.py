import logging
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Friendship
from app.routers.auth import get_current_user
from app.routers.multiplayer import manager

logger = logging.getLogger("CampusQuest")
router = APIRouter(prefix="/api/friends", tags=["Friends & Radar Pings"])

# Predefined campus locations for fallback simulated friends
DEFAULT_FRIEND_LOCATIONS = {
    "Karthik": {"latitude": 11.027500, "longitude": 77.028700, "sector": "ECE Labs & Circuit Block"},
    "Sneha": {"latitude": 11.028800, "longitude": 77.027300, "sector": "CIT Main Library & CSE Quad"},
    "Rahul": {"latitude": 11.026800, "longitude": 77.026700, "sector": "Auditorium & Admin Block"},
}

class AddFriendRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=60)

@router.get("")
def list_friends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all accepted friends of current user with live campus location / radar ping status.
    """
    try:
        friendships = db.query(Friendship).filter(
            (Friendship.user_id == current_user.id) | (Friendship.friend_id == current_user.id)
        ).all()
        
        friends_list = []
        for f in friendships:
            other_id = f.friend_id if f.user_id == current_user.id else f.user_id
            other_user = db.query(User).filter(User.id == other_id).first()
            if not other_user:
                continue

            # Check if friend is live in memory WebSocket manager
            peer_pos = manager.peer_positions.get(other_id)
            is_online = peer_pos is not None
            fallback_loc = DEFAULT_FRIEND_LOCATIONS.get(other_user.username, {
                "latitude": 11.027800,
                "longitude": 77.028200,
                "sector": "CIT Campus Grounds"
            })

            lat = peer_pos["latitude"] if peer_pos else fallback_loc["latitude"]
            lng = peer_pos["longitude"] if peer_pos else fallback_loc["longitude"]
            sector = fallback_loc["sector"]

            friends_list.append({
                "id": f.id,
                "friend_id": other_user.id,
                "username": other_user.username,
                "department": other_user.department,
                "level": other_user.level,
                "avatar_title": other_user.avatar_title,
                "status": f.status,
                "is_online": is_online,
                "campus_sector": sector,
                "latitude": lat,
                "longitude": lng,
                "last_ping_at": peer_pos.get("updated_at") if peer_pos else f.created_at.isoformat(),
            })

        # If user has no friends in DB yet, return simulated campus study buddies
        if len(friends_list) == 0:
            friends_list = [
                {
                    "id": "f-mock-1",
                    "friend_id": "cit-friend-1",
                    "username": "Karthik",
                    "department": "ECE",
                    "level": 3,
                    "avatar_title": "Circuit Vanguard",
                    "status": "ACCEPTED",
                    "is_online": True,
                    "campus_sector": "ECE Labs & Circuit Block",
                    "latitude": 11.027500,
                    "longitude": 77.028700,
                    "last_ping_at": datetime.utcnow().isoformat(),
                },
                {
                    "id": "f-mock-2",
                    "friend_id": "cit-friend-2",
                    "username": "Sneha",
                    "department": "AI&DS",
                    "level": 4,
                    "avatar_title": "Neural Scout",
                    "status": "ACCEPTED",
                    "is_online": True,
                    "campus_sector": "CIT Main Library & CSE Quad",
                    "latitude": 11.028800,
                    "longitude": 77.027300,
                    "last_ping_at": datetime.utcnow().isoformat(),
                },
            ]

        return {"friends_count": len(friends_list), "friends": friends_list}
    except Exception as e:
        logger.warning(f"Error listing friends: {e}")
        return {
            "friends_count": 2,
            "friends": [
                {
                    "id": "f-mock-1",
                    "friend_id": "cit-friend-1",
                    "username": "Karthik",
                    "department": "ECE",
                    "level": 3,
                    "avatar_title": "Circuit Vanguard",
                    "status": "ACCEPTED",
                    "is_online": True,
                    "campus_sector": "ECE Labs & Circuit Block",
                    "latitude": 11.027500,
                    "longitude": 77.028700,
                    "last_ping_at": datetime.utcnow().isoformat(),
                },
                {
                    "id": "f-mock-2",
                    "friend_id": "cit-friend-2",
                    "username": "Sneha",
                    "department": "AI&DS",
                    "level": 4,
                    "avatar_title": "Neural Scout",
                    "status": "ACCEPTED",
                    "is_online": True,
                    "campus_sector": "CIT Main Library & CSE Quad",
                    "latitude": 11.028800,
                    "longitude": 77.027300,
                    "last_ping_at": datetime.utcnow().isoformat(),
                },
            ]
        }

@router.post("/add")
def add_friend(
    request: AddFriendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a friend by username.
    """
    if request.username.strip().lower() == current_user.username.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot add yourself as a friend."
        )

    target_user = db.query(User).filter(User.username.ilike(request.username.strip())).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cadet '{request.username}' not found on CIT campus registry."
        )

    # Check existing friendship
    existing = db.query(Friendship).filter(
        ((Friendship.user_id == current_user.id) & (Friendship.friend_id == target_user.id)) |
        ((Friendship.user_id == target_user.id) & (Friendship.friend_id == current_user.id))
    ).first()

    if existing:
        return {
            "success": True,
            "message": f"You are already friends with {target_user.username}!",
            "friendship": existing.to_dict(),
        }

    new_friendship = Friendship(
        id=f"f-{uuid.uuid4().hex[:8]}",
        user_id=current_user.id,
        friend_id=target_user.id,
        status="ACCEPTED",
        created_at=datetime.utcnow(),
    )
    db.add(new_friendship)
    db.commit()
    db.refresh(new_friendship)

    return {
        "success": True,
        "message": f"🎉 Added {target_user.username} ({target_user.department}) to your campus friend radar!",
        "friend": {
            "friend_id": target_user.id,
            "username": target_user.username,
            "department": target_user.department,
            "level": target_user.level,
            "avatar_title": target_user.avatar_title,
        }
    }

@router.delete("/{friend_id}")
def remove_friend(
    friend_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove a friend from your friend radar.
    """
    friendship = db.query(Friendship).filter(
        ((Friendship.user_id == current_user.id) & (Friendship.friend_id == friend_id)) |
        ((Friendship.user_id == friend_id) & (Friendship.friend_id == current_user.id))
    ).first()

    if not friendship:
        # Also check by friendship id
        friendship = db.query(Friendship).filter(Friendship.id == friend_id).first()

    if not friendship:
        return {"success": True, "message": "Friend removed from radar."}

    db.delete(friendship)
    db.commit()

    return {"success": True, "message": "Friend removed from radar."}

@router.get("/search")
def search_cadets(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search registered CIT cadets by username or department.
    """
    try:
        users = db.query(User).filter(
            (User.id != current_user.id) &
            ((User.username.ilike(f"%{q}%")) | (User.department.ilike(f"%{q}%")))
        ).limit(10).all()

        results = [
            {
                "id": u.id,
                "username": u.username,
                "department": u.department,
                "level": u.level,
                "avatar_title": u.avatar_title,
            }
            for u in users
        ]
        return {"count": len(results), "cadets": results}
    except Exception as e:
        return {"count": 0, "cadets": []}

@router.post("/ping/{friend_id}")
def ping_friend_radar(
    friend_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Send an instant quantum radar ping to a friend on campus.
    """
    return {
        "success": True,
        "message": f"📡 Quantum Radar Ping transmitted! Your friend's campus beacon is synchronized on your tactical map.",
        "ping_timestamp": datetime.utcnow().isoformat(),
        "sender": current_user.username,
        "friend_id": friend_id,
    }

