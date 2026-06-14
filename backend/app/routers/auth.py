from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.database import get_session
from app.dependencies import get_current_user
from app.models import User
from app.schemas import ChangePasswordRequest, TokenRead, UserRead
from app.security import create_access_token, hash_password, verify_password
from app.services.audit import write_audit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenRead)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
) -> TokenRead:
    user = session.exec(select(User).where(User.username == form.username)).first()
    if not user or not user.is_active or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    write_audit(session, user, "LOGIN", "user", user.id, None, {"username": user.username})
    session.commit()
    return TokenRead(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    session.add(current_user)
    write_audit(session, current_user, "CHANGE_PASSWORD", "user", current_user.id, None, {"changed": True})
    session.commit()
    return {"message": "Password changed"}
