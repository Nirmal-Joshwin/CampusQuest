import logging
import random
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user

logger = logging.getLogger("CampusQuest")
router = APIRouter(prefix="/api/pvp", tags=["Cadet Proximity Duels"])

# Tactical moves
# OVERCLOCK beats FIREWALL, FIREWALL beats EMP, EMP beats OVERCLOCK
MOVE_ADVANTAGE = {
    "OVERCLOCK": "FIREWALL",
    "FIREWALL": "EMP",
    "EMP": "OVERCLOCK",
}

class DuelRequest(BaseModel):
    opponent_id: str
    opponent_name: str
    player_creature: str = "Campus Creature"
    rounds: List[str] = Field(..., example=["OVERCLOCK", "FIREWALL", "EMP"])

@router.post("/duel")
def execute_friend_duel(
    request: DuelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Execute a 3-turn tactical duel with a nearby campus friend.
    Validates moves, prevents self-dueling, and deducts tactical energy.
    """
    # 1. Prevent self-dueling exploit
    if request.opponent_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cadets cannot initiate duels against themselves."
        )

    # 2. Check energy requirement
    if current_user.energy < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient combat energy! Proximity duels require at least 5 Energy."
        )

    choices = ["OVERCLOCK", "FIREWALL", "EMP"]

    # 3. Validate tactical move inputs
    cleaned_moves = [m.upper().strip() for m in request.rounds[:3]]
    if not cleaned_moves or any(m not in choices for m in cleaned_moves):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid tactical moves. Allowed actions are: {', '.join(choices)}"
        )

    player_score = 0
    opponent_score = 0
    round_results = []

    for idx, p_move_upper in enumerate(cleaned_moves):
        o_move = random.choice(choices)


        if p_move_upper == o_move:
            outcome = "DRAW"
        elif MOVE_ADVANTAGE.get(p_move_upper) == o_move:
            outcome = "PLAYER_WIN"
            player_score += 1
        else:
            outcome = "OPPONENT_WIN"
            opponent_score += 1

        round_results.append({
            "round": idx + 1,
            "player_move": p_move_upper,
            "opponent_move": o_move,
            "result": outcome,
        })

    is_winner = player_score > opponent_score
    xp_earned = 150 if is_winner else 60
    coins_earned = 25 if is_winner else 10

    current_user.energy = max(0, current_user.energy - 5)
    current_user.xp += xp_earned
    current_user.coins += coins_earned
    db.commit()


    return {
        "success": True,
        "is_winner": is_winner,
        "player_score": player_score,
        "opponent_score": opponent_score,
        "xp_earned": xp_earned,
        "coins_earned": coins_earned,
        "message": "🏆 Victory! Your tactical command prevailed!" if is_winner else "🤝 Good Match! Well fought against your friend!",
        "rounds": round_results
    }

