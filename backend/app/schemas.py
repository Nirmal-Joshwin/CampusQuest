from typing import List, Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field

# --- Enums ---
class RarityTier(str, Enum):
    COMMON = "COMMON"
    RARE = "RARE"
    EPIC = "EPIC"
    LEGENDARY = "LEGENDARY"

class UserRole(str, Enum):
    STUDENT = "STUDENT"
    ADMIN = "ADMIN"

class RewardType(str, Enum):
    ENERGY = "ENERGY"
    COINS = "COINS"
    XP = "XP"

# --- User & Auth Schemas ---
class UserRegister(BaseModel):
    email: str = Field(..., description="Student or Admin email")
    username: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.-]+$", description="Unique player callsign")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    role: UserRole = Field(default=UserRole.STUDENT, description="Account role")
    department: str = Field(default="CSE", description="College Department (e.g. CSE, ECE, MECH, CIVIL, IT, AI&DS)")

class UserLogin(BaseModel):
    email: str = Field(..., description="Registered email")
    password: str = Field(..., description="Password")

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    role: str
    department: str
    level: int
    xp: int
    energy: int
    max_energy: int
    coins: int = 50
    avatar_title: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.-]+$")
    department: Optional[str] = None
    avatar_title: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# --- Bestiary & Gameplay Schemas ---
class CatchRequest(BaseModel):
    creature_name: str = Field(..., min_length=1, max_length=60)
    rarity: RarityTier
    campus_sector: Optional[str] = "CIT Campus"
    latitude: float = Field(..., ge=11.0, le=11.1, description="GPS Latitude within Coimbatore region")
    longitude: float = Field(..., ge=77.0, le=77.1, description="GPS Longitude within Coimbatore region")

class CatchResponse(BaseModel):
    success: bool = True
    message: str
    xp_gained: int
    level_up: bool
    new_level: int
    new_xp: int
    current_energy: int
    capture_id: str

class BestiaryEntry(BaseModel):
    creature_name: str
    rarity: str
    sector: str
    discovered: bool
    captured_count: int = 0
    first_caught_at: Optional[datetime] = None
    emoji: str
    xp_reward: int

class BestiaryResponse(BaseModel):
    total_discovered: int
    total_creatures: int
    entries: List[BestiaryEntry]

# --- Loot Crates ---
class LootCrateResponse(BaseModel):
    id: str
    name: str
    reward_type: str
    reward_amount: int
    campus_sector: str
    latitude: float
    longitude: float
    is_active: bool

    class Config:
        from_attributes = True

class ClaimLootRequest(BaseModel):
    crate_id: str

class ClaimLootResponse(BaseModel):
    success: bool
    reward_type: str
    reward_amount: int
    message: str
    new_energy: int
    new_coins: int
    new_xp: int

# --- Spawn Schemas ---
class SpawnBase(BaseModel):
    name: str = Field(..., description="Character/Creature or Item name")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate")
    rarity: RarityTier = Field(default=RarityTier.COMMON, description="Rarity tier")

class SpawnResponse(SpawnBase):
    id: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
