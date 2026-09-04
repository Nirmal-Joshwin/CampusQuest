import logging
import random
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
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
    """
    choices = ["OVERCLOCK", "FIREWALL", "EMP"]
    player_score = 0
    opponent_score = 0
    round_results = []

    for idx, p_move in enumerate(request.rounds[:3]):
        p_move_upper = p_move.upper()
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

