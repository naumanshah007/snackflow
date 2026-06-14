from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlmodel import Session

from app.models import AuditLog, User


def model_snapshot(obj: Any) -> dict[str, Any]:
    if obj is None:
        return {}
    if hasattr(obj, "model_dump"):
        return jsonable_encoder(obj.model_dump())
    return jsonable_encoder(obj)


def write_audit(
    session: Session,
    user: User | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
    ip_device: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=user.id if user else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=jsonable_encoder(old_values) if old_values is not None else None,
        new_values=jsonable_encoder(new_values) if new_values is not None else None,
        ip_device=ip_device,
    )
    session.add(entry)
    return entry
