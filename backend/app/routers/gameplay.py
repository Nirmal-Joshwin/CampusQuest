import logging
import uuid
from typing import List, Dict
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
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
    "HomeSentinel": "🛡️",
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
        "name": "Sports Pavilion Energy Battery",
        "reward_type": "ENERGY",
        "reward_amount": 40,
        "campus_sector": "Southern Sports Pavilion",
        "latitude": 11.026350,
        "longitude": 77.027150,
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
    # HomeSentinel is permitted for field calibration and remote home testing
    if payload.creature_name != "HomeSentinel" and not is_coordinate_within_cit_bounds(payload.latitude, payload.longitude):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GPS coordinates rejected: Anomaly capture requires physical presence within the CIT Campus perimeter."
        )

    # SEC-HIGH-04 Fix: Server-side validation of spawn existence and proximity
    import math
    def get_distance_meters(lat1, lon1, lat2, lon2):
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi, dlam = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Retrieve valid spawns, injecting HomeSentinel at user's location to allow testing
    from app.geofence import get_cit_story_spawns
    valid_spawns = get_cit_story_spawns(user_lat=payload.latitude, user_lng=payload.longitude)
    target_spawn = next((s for s in valid_spawns if s["name"] == payload.creature_name), None)
    
    if not target_spawn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Validation failed: Creature '{payload.creature_name}' does not exist on campus."
        )
    
    dist = get_distance_meters(payload.latitude, payload.longitude, target_spawn["latitude"], target_spawn["longitude"])
    # 35m + 15m GPS drift tolerance
    if dist > 50:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Validation failed: You are {int(dist)}m away. Radar limit is 35m."
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

# Anti-farming In-Memory Tracking
USER_LOOT_CLAIMS: Dict[str, Dict[str, datetime]] = {} # user_id -> {crate_id: claim_timestamp}
USER_QR_LAST_SCAN: Dict[str, datetime] = {}          # user_id -> last_scan_timestamp

LOOT_COOLDOWN_HOURS = 4
QR_SCAN_COOLDOWN_SECONDS = 300 # 5 minutes

@router.post("/claim-loot", response_model=ClaimLootResponse)
def claim_loot_cache(
    payload: ClaimLootRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Claims a collectible campus loot cache reward (Energy, Coins, or XP).
    Enforces a 4-hour cooldown per user per crate to prevent infinite farming.
    """
    crate = next((c for c in CANONICAL_CAMPUS_LOOT if c["id"] == payload.crate_id), None)
    if not crate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loot crate not found")

    now = datetime.now(timezone.utc)
    user_claims = USER_LOOT_CLAIMS.setdefault(current_user.id, {})
    if payload.crate_id in user_claims:
        last_claimed = user_claims[payload.crate_id]
        elapsed = (now - last_claimed).total_seconds()
        cooldown_total = LOOT_COOLDOWN_HOURS * 3600
        if elapsed < cooldown_total:
            remaining_mins = max(1, int((cooldown_total - elapsed) // 60))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Supply cache already secured! Scanner recharging. Return in {remaining_mins} minutes."
            )

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
        user_claims[payload.crate_id] = now
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
    qr_code: str = Field(..., min_length=3, max_length=100)

VALID_QR_PREFIXES = ("CIT-", "CITQUEST-", "CAMPUS-", "STATION-")

@router.post("/qr-scan")
def scan_campus_qr(
    payload: QrScanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validates physical QR codes on campus bulletin boards and awards secret supply caches.
    Validates format and enforces rate limiting to prevent spamming.
    """
    code = payload.qr_code.strip()
    
    # 1. Signature check
    code_upper = code.upper()
    if not any(code_upper.startswith(prefix) for prefix in VALID_QR_PREFIXES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid QR beacon signature. Scan an authorized CIT CampusQuest station marker."
        )

    # 2. Rate limiting check (5-minute cooldown)
    now = datetime.now(timezone.utc)
    if current_user.id in USER_QR_LAST_SCAN:
        last_scan = USER_QR_LAST_SCAN[current_user.id]
        elapsed = (now - last_scan).total_seconds()
        if elapsed < QR_SCAN_COOLDOWN_SECONDS:
            remaining_secs = int(QR_SCAN_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Quantum scanner cooling down! Please wait {remaining_secs} seconds before decrypting another QR station."
            )

    # Award scavenger loot
    bonus_coins = 50
    bonus_energy = 30
    bonus_xp = 200

    current_user.coins += bonus_coins
    current_user.energy = min(current_user.max_energy, current_user.energy + bonus_energy)
    current_user.xp += bonus_xp
    current_user.level = 1 + (current_user.xp // 1000)

    try:
        db.commit()
        USER_QR_LAST_SCAN[current_user.id] = now
    except Exception as e:
        logger.error(f"Failed to commit QR reward: {e}")
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Reward recording error")

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



