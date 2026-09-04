import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserRegister, UserLogin, UserResponse, UserProfileUpdate, AuthResponse
from app.auth import hash_password, verify_password, create_access_token, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new Student or Admin account.
    """
    # 1. Check existing email
    if db.query(User).filter(User.email == payload.email.lower().strip()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    # 2. Check existing username
    if db.query(User).filter(User.username == payload.username.strip()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This username callsign is already taken."
        )

    # 3. Create user
    new_user = User(
        email=payload.email.lower().strip(),
        username=payload.username.strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role.value if hasattr(payload.role, "value") else str(payload.role),
        department=payload.department.upper(),
        level=1,
        xp=0,
        energy=100,
        max_energy=100,
        avatar_title=f"CIT {payload.department.upper()} Cadet"
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        logger.error(f"Failed to register user: {e}")
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Registration database error")

    # 4. Generate JWT
    access_token = create_access_token(data={"sub": new_user.id, "email": new_user.email, "role": new_user.role})

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.from_orm(new_user)
    )

@router.post("/login", response_model=AuthResponse)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user via email and password, returning JWT access token.
    """
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.from_orm(user)
    )

@router.get("/me", response_model=UserResponse)
def get_current_player_profile(current_user: User = Depends(get_current_user)):
    """
    Retrieve currently authenticated player profile.
    """
    return UserResponse.from_orm(current_user)

@router.put("/profile", response_model=UserResponse)
def update_player_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update player avatar customization, department, or username.
    """
    if payload.username and payload.username.strip() != current_user.username:
        existing = db.query(User).filter(User.username == payload.username.strip()).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already in use")
        current_user.username = payload.username.strip()

    if payload.department:
        current_user.department = payload.department.upper()

    if payload.avatar_title:
        current_user.avatar_title = payload.avatar_title.strip()

    try:
        db.commit()
        db.refresh(current_user)
    except Exception as e:
        logger.error(f"Failed to update profile: {e}")
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Update failed")

    return UserResponse.from_orm(current_user)

