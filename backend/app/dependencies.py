from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from app.database import get_session
from app.models import User, UserRole
from app.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    subject = decode_access_token(token)
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = session.get(User, int(subject))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")
    return user


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return dependency


def forbid_order_booker(user: User) -> None:
    if user.role == UserRole.ORDER_BOOKER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


def scoped_warehouse_id(user: User, requested_warehouse_id: int | None) -> int | None:
    if user.role == UserRole.ORDER_BOOKER:
        return user.assigned_warehouse_id
    if user.role == UserRole.WAREHOUSE_MANAGER:
        return user.assigned_warehouse_id or requested_warehouse_id
    return requested_warehouse_id


def assert_warehouse_scope(user: User, warehouse_id: int) -> None:
    if user.role in {UserRole.ORDER_BOOKER, UserRole.WAREHOUSE_MANAGER}:
        if user.assigned_warehouse_id != warehouse_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Warehouse is outside your scope")


def username_exists(session: Session, username: str, exclude_user_id: int | None = None) -> bool:
    query = select(User).where(User.username == username)
    user = session.exec(query).first()
    return bool(user and user.id != exclude_user_id)
