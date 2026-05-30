from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, verify_password
from app.config import settings
from app.database import get_db
from app.models import Reponedor, Supervisor
from app.schemas import LoginRequest, TokenResponse, UserOut


router = APIRouter(prefix="/auth", tags=["auth"])


def user_out(user: Supervisor | Reponedor, role: str) -> UserOut:
    return UserOut(
        id=user.id,
        nombre=user.nombre,
        email=user.email,
        rol=role,
        supervisor=getattr(user, "supervisor", None),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(Supervisor).filter(Supervisor.email == payload.email.lower()).one_or_none()
    role = "supervisor"
    if not user:
        user = db.query(Reponedor).filter(Reponedor.email == payload.email.lower()).one_or_none()
        role = "reponedor"

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email o password incorrecto")
    if not user.activo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")

    token = create_access_token(
        subject=str(user.id),
        role=role,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return TokenResponse(access_token=token, rol=role, user=user_out(user, role))


@router.get("/me", response_model=UserOut)
@router.post("/me", response_model=UserOut)
def me(user: Supervisor | Reponedor = Depends(get_current_user)) -> UserOut:
    return user_out(user, getattr(user, "_rol"))
