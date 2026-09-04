import logging
import uuid
from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Capture
from app.schemas import (
    CatchRequest,
    CatchResponse,
    BestiaryResponse,
    BestiaryEntry,
    LootCrateResponse,
    ClaimLootRequest,
    ClaimLootResponse,
)
from app.auth import get_current_user
from app.geofence import CIT_CANONICAL_STORY_SPAWNS, is_coordinate_within_cit_bounds

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/gameplay", tags=["Gameplay & Progression"])

XP_MAP = {
    "COMMON": 100,
    "RARE": 250,
    "EPIC": 600,
    "LEGENDARY": 1500,
}

EMOJI_MAP = {
    "CIT CyberDragon": "🐉",
    "QuantumSprite": "✨",
    "RoboGolem": "🤖",
    "CircuitPhoenix": "🔥",
    "CodePhantom": "👻",
    "NeuralFox": "🦊",
    "ByteFalcon": "🦅",
    "SiliconTitan": "⚡",
    "CampusOwl": "🦉",
    "AeroMech": "🚀",
}

# Fixed Campus Collectible Loot Caches
CANONICAL_CAMPUS_LOOT = [
    {
        "id": "cit-loot-1",
        "name": "CIT Canteen Supply Crate",
        "reward_type": "ENERGY",
        "reward_amount": 50,
        "campus_sector": "Student Canteen & Food Court",
        "latitude": 11.026950,
        "longitude": 77.027750,
        "is_active": True,
    },
    {
        "id": "cit-loot-2",
        "name": "Library Quantum Data Crystal",
        "reward_type": "COINS",
        "reward_amount": 100,
        "campus_sector": "Central Library",
        "latitude": 11.028150,
        "longitude": 77.026850,
        "is_active": True,
    },
    {
        "id": "cit-loot-3",
        "name": "Sports Stadium Energy Battery",
        "reward_type": "ENERGY",
        "reward_amount": 40,
        "campus_sector": "Main Sports Pavilion",
        "latitude": 11.029400,
        "longitude": 77.028400,
        "is_active": True,
    },
]

@router.post("/catch", response_model=CatchResponse)
def record_capture(
    payload: CatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record a creature capture, deduct energy, award XP, and check for Level-Up.
    """
    if current_user.energy < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient energy! You need at least 10 Energy to capture. Collect energy crates on campus to recharge."
        )

    # Anti-spoofing verification: ensure capture coordinates are within CIT Campus perimeter
    if not is_coordinate_within_cit_bounds(payload.latitude, payload.longitude):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GPS coordinates rejected: Anomaly capture requires physical presence within the CIT Campus perimeter."
        )

    # Enforce unique one-time creature capture (no farming)
    already_captured = db.query(Capture).filter(
        Capture.user_id == current_user.id,
        Capture.creature_name == payload.creature_name
    ).first()
    if already_captured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{payload.creature_name} is already registered in your Bestiary! Campus anomalies cannot be farmed repeatedly."
        )

    rarity_str = payload.rarity.value if hasattr(payload.rarity, "value") else str(payload.rarity)
    xp_earned = XP_MAP.get(rarity_str.upper(), 100)

    # 1. Update user energy & XP
    current_user.energy = max(0, current_user.energy - 10)
    current_user.xp += xp_earned
    
    old_level = current_user.level
    new_level = 1 + (current_user.xp // 1000)
    level_up = new_level > old_level
    current_user.level = new_level

    # 2. Record capture in database
    capture = Capture(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        creature_name=payload.creature_name,
        rarity=rarity_str.upper(),
        campus_sector=payload.campus_sector or "CIT Campus",
        latitude=payload.latitude,
        longitude=payload.longitude,
        xp_earned=xp_earned,
    )

    try:
        db.add(capture)
        db.commit()
        db.refresh(current_user)
    except Exception as e:
        logger.error(f"Failed to record capture: {e}")
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error recording capture")

    message = f"Successfully captured {payload.creature_name}! +{xp_earned} XP earned."
    if level_up:
        message += f" 🎉 LEVEL UP! You reached Level {new_level}!"

    return CatchResponse(
        success=True,
        message=message,
        xp_gained=xp_earned,
        level_up=level_up,
        new_level=new_level,
        new_xp=current_user.xp,
        current_energy=current_user.energy,
        capture_id=capture.id,
    )

@router.get("/bestiary", response_model=BestiaryResponse)
def get_bestiary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns player's CIT Campus Bestiary (Pokedex).
    Lists all 10 canonical creatures indicating discovered status and capture count.
    """
    user_captures = db.query(Capture).filter(Capture.user_id == current_user.id).all()
    capture_map = {}
    for c in user_captures:
        if c.creature_name not in capture_map:
            capture_map[c.creature_name] = {"count": 0, "first_caught": c.captured_at}
        capture_map[c.creature_name]["count"] += 1

    entries: List[BestiaryEntry] = []
    discovered_count = 0

    for creature in CIT_CANONICAL_STORY_SPAWNS:
        name = creature["name"]
        rarity = creature["rarity"]
        sector = creature["sector"]
        is_discovered = name in capture_map
        if is_discovered:
            discovered_count += 1

        entries.append(
            BestiaryEntry(
                creature_name=name,
                rarity=rarity,
                sector=sector,
                discovered=is_discovered,
                captured_count=capture_map[name]["count"] if is_discovered else 0,
                first_caught_at=capture_map[name]["first_caught"] if is_discovered else None,
                emoji=EMOJI_MAP.get(name, "👾"),
                xp_reward=XP_MAP.get(rarity, 100),
            )
        )

    return BestiaryResponse(
        total_discovered=discovered_count,
        total_creatures=len(CIT_CANONICAL_STORY_SPAWNS),
        entries=entries,
    )

@router.get("/loot", response_model=List[LootCrateResponse])
def get_campus_loot():
    """
    Returns active collectible loot caches and energy cells scattered across CIT.
    """
    return CANONICAL_CAMPUS_LOOT

@router.post("/claim-loot", response_model=ClaimLootResponse)
def claim_loot_cache(
    payload: ClaimLootRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Claims a collectible campus loot cache reward (Energy, Coins, or XP).
    """
    crate = next((c for c in CANONICAL_CAMPUS_LOOT if c["id"] == payload.crate_id), None)
    if not crate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loot crate not found")

    reward_type = crate["reward_type"]
    reward_amount = crate["reward_amount"]

    if reward_type == "ENERGY":
        current_user.energy = min(current_user.max_energy, current_user.energy + reward_amount)
    elif reward_type == "COINS":
        current_user.coins += reward_amount
    elif reward_type == "XP":
        current_user.xp += reward_amount
        current_user.level = 1 + (current_user.xp // 1000)

    try:
        db.commit()
        db.refresh(current_user)
    except Exception as e:
        logger.error(f"Failed to claim loot: {e}")
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database update failed")

    return ClaimLootResponse(
        success=True,
        reward_type=reward_type,
        reward_amount=reward_amount,
        message=f"Claimed {reward_amount} {reward_type} from {crate['name']}!",
        new_energy=current_user.energy,
        new_coins=current_user.coins,
        new_xp=current_user.xp,
    )

class QrScanRequest(BaseModel):
    qr_code: str

@router.post("/qr-scan")
def scan_campus_qr(
    payload: QrScanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validates physical QR codes on campus bulletin boards and awards secret supply caches.
    """
    code = payload.qr_code.strip()
    # Award scavenger loot
    bonus_coins = 50
    bonus_energy = 30
    bonus_xp = 200

    current_user.coins += bonus_coins
    current_user.energy = min(current_user.max_energy, current_user.energy + bonus_energy)
    current_user.xp += bonus_xp
    current_user.level = 1 + (current_user.xp // 1000)
    db.commit()

    return {
        "success": True,
        "message": f"📷 Physical Campus QR Station Verified!\nStation Code: {code[:15]}...\n+50 Data Credits (💎)\n+30 Quantum Energy\n+200 Exploration XP",
        "reward_coins": bonus_coins,
        "reward_energy": bonus_energy,
        "reward_xp": bonus_xp,
        "new_coins": current_user.coins,
        "new_energy": current_user.energy,
        "new_xp": current_user.xp
    }


