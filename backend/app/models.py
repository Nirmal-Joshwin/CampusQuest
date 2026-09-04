import uuid
from typing import Any
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Boolean
from app.database import Base

class User(Base):
    """
    Player / User Account entity (Students & Admins).
    """
    __tablename__ = "users"

    id: Any = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Any = Column(String(120), unique=True, index=True, nullable=False)
    username: Any = Column(String(60), unique=True, index=True, nullable=False)
    hashed_password: Any = Column(String(255), nullable=False)
    role: Any = Column(String(20), nullable=False, default="STUDENT") # STUDENT, ADMIN
    department: Any = Column(String(60), nullable=False, default="CSE") # CSE, ECE, MECH, CIVIL, IT, AI&DS
    level: Any = Column(Integer, nullable=False, default=1)
    xp: Any = Column(Integer, nullable=False, default=0)
    energy: Any = Column(Integer, nullable=False, default=100)
    max_energy: Any = Column(Integer, nullable=False, default=100)
    coins: Any = Column(Integer, nullable=False, default=50) # Campus Data Credits
    avatar_title: Any = Column(String(100), nullable=False, default="CIT Campus Explorer")
    created_at: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "role": self.role,
            "department": self.department,
            "level": self.level,
            "xp": self.xp,
            "energy": self.energy,
            "max_energy": self.max_energy,
            "coins": self.coins,
            "avatar_title": self.avatar_title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class Capture(Base):
    """
    Recorded creature captures in the player's Bestiary.
    """
    __tablename__ = "captures"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    creature_name = Column(String(100), nullable=False)
    rarity = Column(String(20), nullable=False)
    campus_sector = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    xp_earned = Column(Integer, nullable=False, default=100)
    captured_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "creature_name": self.creature_name,
            "rarity": self.rarity,
            "campus_sector": self.campus_sector,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "xp_earned": self.xp_earned,
            "captured_at": self.captured_at.isoformat() if self.captured_at else None,
        }

class LootCrate(Base):
    """
    Campus collectible loot boxes & quantum energy cells.
    """
    __tablename__ = "loot_crates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    reward_type = Column(String(20), nullable=False) # ENERGY, COINS, XP
    reward_amount = Column(Integer, nullable=False, default=25)
    campus_sector = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "reward_type": self.reward_type,
            "reward_amount": self.reward_amount,
            "campus_sector": self.campus_sector,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "is_active": self.is_active,
        }

class Spawn(Base):
    """
    Spawn entity representing a catchable creature or item on campus with rarity tier.
    """
    __tablename__ = "spawns"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    rarity = Column(String(20), nullable=False, default="COMMON") # COMMON, RARE, EPIC, LEGENDARY
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "rarity": self.rarity,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class Friendship(Base):
    """
    Friend relationship between two players.
    """
    __tablename__ = "friendships"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    friend_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="ACCEPTED") # ACCEPTED, PENDING
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "friend_id": self.friend_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

