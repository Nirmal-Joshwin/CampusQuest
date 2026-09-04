import logging
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user

logger = logging.getLogger("CampusQuest")
router = APIRouter(prefix="/api/turf", tags=["Department Turf Wars & Strongholds"])

# In-memory CIT Campus Strongholds (Gym Control Points)
CIT_STRONGHOLDS = [
    {
        "id": "stronghold-1",
        "name": "Admin Tower & Council Hall",
        "landmark": "Admin Block & Tower Quad",
        "latitude": 11.0268,
        "longitude": 77.0265,
        "controlling_department": "CSE",
        "defense_score": 1450,
        "active_buff": "+15% Anomaly Capture XP Bonus",
        "top_defender": "Sneha (AI&DS/CSE)",
        "department_points": {"CSE": 1450, "ECE": 1100, "MECH": 820, "CIVIL": 450, "AI&DS": 980},
    },
    {
        "id": "stronghold-2",
        "name": "Central Library & Knowledge Hub",
        "landmark": "CIT Central Library Quad",
        "latitude": 11.0282,
        "longitude": 77.0264,
        "controlling_department": "AI&DS",
        "defense_score": 1620,
        "active_buff": "+20% Quantum Energy Regeneration",
        "top_defender": "Karthik (AI&DS)",
        "department_points": {"CSE": 1300, "ECE": 950, "MECH": 600, "CIVIL": 400, "AI&DS": 1620},
    },
    {
        "id": "stronghold-3",
        "name": "Sports Stadium & Athletic Arena",
        "landmark": "CIT Campus Stadium Grounds",
        "latitude": 11.0296,
        "longitude": 77.0288,
        "controlling_department": "MECH",
        "defense_score": 1280,
        "active_buff": "+25% Walking Buddy Data Credit Discovery",
        "top_defender": "Rahul (MECH)",
        "department_points": {"CSE": 800, "ECE": 850, "MECH": 1280, "CIVIL": 700, "AI&DS": 500},
    },
    {
        "id": "stronghold-4",
        "name": "Mechanical & Tech Labs Workshop",
        "landmark": "Heavy Machinery & Civil Quad",
        "latitude": 11.0275,
        "longitude": 77.0301,
        "controlling_department": "ECE",
        "defense_score": 1390,
        "active_buff": "+15% Challenge Decryption Speed",
        "top_defender": "Vignesh (ECE)",
        "department_points": {"CSE": 900, "ECE": 1390, "MECH": 1150, "CIVIL": 600, "AI&DS": 750},
    },
]

class DefendStrongholdRequest(BaseModel):
    stronghold_id: str
    creature_name: str
    defense_contribution: int = 150

@router.get("/strongholds")
def get_campus_strongholds():
    """
    Get live status of all 4 CIT Campus Strongholds.
    """
    return {
        "count": len(CIT_STRONGHOLDS),
        "strongholds": CIT_STRONGHOLDS
    }

@router.post("/defend")
def defend_stronghold(
    request: DefendStrongholdRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Station a player's creature at a stronghold to bolster their department's control.
    """
    stronghold = next((s for s in CIT_STRONGHOLDS if s["id"] == request.stronghold_id), None)
    if not stronghold:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stronghold not found."
        )

    dept = current_user.department.upper() if current_user.department else "CSE"
    
    # Increase department points
    current_pts = stronghold["department_points"].get(dept, 0)
    new_pts = current_pts + request.defense_contribution
    stronghold["department_points"][dept] = new_pts

    # Recalculate controlling department
    top_dept = max(stronghold["department_points"].items(), key=lambda x: x[1])[0]
    stronghold["controlling_department"] = top_dept
    stronghold["defense_score"] = stronghold["department_points"][top_dept]
    stronghold["top_defender"] = f"{current_user.username} ({dept})"

    # Award cadet personal reward
    current_user.xp += 100
    current_user.coins += 25
    db.commit()

    return {
        "success": True,
        "message": f"🛡️ Stationed {request.creature_name} at {stronghold['name']}!\n+{request.defense_contribution} Control Points added for {dept}!\n+100 XP & +25 Data Credits awarded.",
        "stronghold": stronghold
    }

@router.get("/leaderboard")
def get_department_leaderboard():
    """
    Get campus-wide department rankings for Turf Wars.
    """
    dept_totals = {"CSE": 0, "ECE": 0, "MECH": 0, "CIVIL": 0, "AI&DS": 0}
    dept_strongholds_held = {"CSE": 0, "ECE": 0, "MECH": 0, "CIVIL": 0, "AI&DS": 0}

    for s in CIT_STRONGHOLDS:
        controlling = s["controlling_department"]
        if controlling in dept_strongholds_held:
            dept_strongholds_held[controlling] += 1
        for d, pts in s["department_points"].items():
            if d in dept_totals:
                dept_totals[d] += pts

    rankings = []
    for d, total in dept_totals.items():
        rankings.append({
            "department": d,
            "total_points": total,
            "strongholds_controlled": dept_strongholds_held.get(d, 0),
        })

    rankings.sort(key=lambda x: (x["strongholds_controlled"], x["total_points"]), reverse=True)
    return {"leaderboard": rankings}

