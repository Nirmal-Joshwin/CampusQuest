import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user

logger = logging.getLogger("CampusQuest")

router = APIRouter(prefix="/api/shop", tags=["Reward Shop"])

class ShopItem(BaseModel):
    id: str
    name: str
    category: str # SUPPLIES, BUFFS, TITLES
    description: str
    icon: str
    cost_coins: int
    effect_type: str # ENERGY_RESTORE, TITLE, PERK
    effect_value: str

CATALOG_ITEMS = [
    {
        "id": "battery_50",
        "name": "Quantum Battery Pack",
        "category": "SUPPLIES",
        "description": "Recharges +50 Energy immediately to keep hunting campus anomalies.",
        "icon": "⚡",
        "cost_coins": 15,
        "effect_type": "ENERGY_RESTORE",
        "effect_value": "50",
    },
    {
        "id": "battery_full",
        "name": "Overcharged Supercell",
        "category": "SUPPLIES",
        "description": "Fully overcharges your sensor suit to maximum 100 HP/Energy.",
        "icon": "🔋",
        "cost_coins": 25,
        "effect_type": "ENERGY_RESTORE",
        "effect_value": "100",
    },
    {
        "id": "master_trap",
        "name": "CIT Master Containment Trap",
        "category": "SUPPLIES",
        "description": "Increases capture probability on Legendary and Epic anomalies by 50%.",
        "icon": "🎯",
        "cost_coins": 40,
        "effect_type": "BUFF",
        "effect_value": "CAPTURE_BOOST_50",
    },
    {
        "id": "radar_booster",
        "name": "CyberRadar Signal Amplifier",
        "category": "BUFFS",
        "description": "Doubles the radar sensor sweep range across CIT grounds for 30 minutes.",
        "icon": "📡",
        "cost_coins": 30,
        "effect_type": "BUFF",
        "effect_value": "RADAR_BOOST_30M",
    },
    {
        "id": "title_pioneer",
        "name": "Badge: CIT Cyber Pioneer",
        "category": "TITLES",
        "description": "Exclusive holographic badge shown on your Cadet Dossier & Radar.",
        "icon": "🎖️",
        "cost_coins": 50,
        "effect_type": "TITLE",
        "effect_value": "CIT Cyber Pioneer",
    },
    {
        "id": "title_legend",
        "name": "Badge: CIT Sovereign Legend",
        "category": "TITLES",
        "description": "Highest collegiate honor for master campus explorers & anomaly hunters.",
        "icon": "👑",
        "cost_coins": 100,
        "effect_type": "TITLE",
        "effect_value": "CIT Sovereign Legend",
    },
]

class BuyRequest(BaseModel):
    item_id: str

@router.get("/items", response_model=List[ShopItem])
def get_shop_catalog():
    """
    Get all redeemable items in the Campus Reward Armory.
    """
    return CATALOG_ITEMS

@router.post("/buy")
def buy_shop_item(
    request: BuyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Redeem Data Credits (coins) for an item, title, or energy refill.
    """
    item = next((i for i in CATALOG_ITEMS if i["id"] == request.item_id), None)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id '{request.item_id}' not found in Armory.",
        )

    if current_user.coins < item["cost_coins"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient Data Credits! You have {current_user.coins}💎 but need {item['cost_coins']}💎.",
        )

    # Deduct credits
    current_user.coins -= item["cost_coins"]
    message = ""

    if item["effect_type"] == "ENERGY_RESTORE":
        add_amount = int(item["effect_value"])
        current_user.energy = min(current_user.max_energy, current_user.energy + add_amount)
        message = f"Recharged +{add_amount} HP! Current Energy: {current_user.energy}/100"
    elif item["effect_type"] == "TITLE":
        current_user.avatar_title = item["effect_value"]
        current_user.xp += 100
        message = f"Unlocked title '{item['effect_value']}'! +100 bonus XP awarded."
    else:
        current_user.xp += 50
        message = f"Acquired {item['name']}! Perk active."

    db.commit()
    db.refresh(current_user)

    logger.info(f"User {current_user.username} bought {item['name']} for {item['cost_coins']} credits.")

    return {
        "success": True,
        "message": message,
        "item": item,
        "user": current_user.to_dict(),
    }

