"""One-time owner password recovery script.

Required environment variables:
    DATABASE_URL
    RESET_OWNER_USERNAME
    RESET_OWNER_PASSWORD

Optional:
    ALLOW_NON_OWNER_RESET=true

This script is intentionally not imported by application startup and does not
create users. It updates exactly one existing user selected by username.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, create_engine, select  # noqa: E402

from app.models import AuditLog, User, UserRole, utc_now  # noqa: E402
from app.security import hash_password  # noqa: E402

DEMO_PASSWORDS = {"admin123", "booker123"}
TRUE_VALUES = {"1", "true", "yes", "on"}


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        raise RuntimeError(f"{name} is required")
    return value.strip()


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return f"postgresql://{url.removeprefix('postgres://')}"
    return url


def _validate_password(password: str) -> None:
    if len(password) < 8:
        raise RuntimeError("RESET_OWNER_PASSWORD must be at least 8 characters")
    if password in DEMO_PASSWORDS:
        raise RuntimeError("RESET_OWNER_PASSWORD must not be a demo password")


def main() -> int:
    try:
        database_url = _normalize_database_url(_required_env("DATABASE_URL"))
        username = _required_env("RESET_OWNER_USERNAME")
        password = os.getenv("RESET_OWNER_PASSWORD") or ""
        if not password:
            raise RuntimeError("RESET_OWNER_PASSWORD is required")
        _validate_password(password)
        allow_non_owner = (os.getenv("ALLOW_NON_OWNER_RESET") or "").strip().lower() in TRUE_VALUES

        engine = create_engine(database_url)
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == username)).first()
            if not user:
                raise RuntimeError("Selected user was not found")
            if user.role != UserRole.OWNER and not allow_non_owner:
                raise RuntimeError("Selected user is not an OWNER. Set ALLOW_NON_OWNER_RESET=true only for approved maintenance.")

            old_active = user.is_active
            old_role = user.role
            user.hashed_password = hash_password(password)
            user.is_active = True
            user.updated_at = utc_now()
            session.add(user)
            session.add(
                AuditLog(
                    user_id=user.id,
                    action="RESET_OWNER_PASSWORD",
                    entity_type="user",
                    entity_id=user.id,
                    old_values={"role": old_role.value, "is_active": old_active},
                    new_values={"role": user.role.value, "is_active": user.is_active, "method": "script"},
                )
            )
            session.commit()
        print("Owner password recovery completed for the selected account. Password was not printed.")
        return 0
    except Exception as exc:
        print(f"Owner password recovery failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
