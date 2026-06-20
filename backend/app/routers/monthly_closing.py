from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlmodel import Session

from app.database import get_session
from app.dependencies import require_roles
from app.models import MonthlyClosing, User, UserRole
from app.schemas import MonthlyClosingArchiveRequest, MonthlyClosingCloseRequest, MonthlyClosingMonthRequest
from app.services.monthly_closing import (
    archive_monthly_closing,
    build_monthly_preview,
    close_month,
    generate_monthly_backup,
    list_monthly_closings,
    regenerate_backup_for_closing,
)

router = APIRouter(prefix="/monthly-closing", tags=["monthly-closing"])


def _closing_row(closing: MonthlyClosing) -> dict:
    data = closing.model_dump()
    data["has_backup"] = bool(closing.backup_generated_at and closing.backup_filename)
    return data


@router.get("/preview")
def preview_monthly_closing(
    month: str,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)),
    session: Session = Depends(get_session),
):
    return build_monthly_preview(session, month)


@router.post("/generate-backup")
def generate_backup(
    payload: MonthlyClosingMonthRequest,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)),
    session: Session = Depends(get_session),
):
    closing, zip_bytes = generate_monthly_backup(session, payload.month, current_user)
    headers = {
        "Content-Disposition": f'attachment; filename="{closing.backup_filename}"',
        "Cache-Control": "no-store",
        "X-Backup-SHA256": closing.backup_checksum or "",
    }
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)


@router.post("/close")
def close_monthly_closing(
    payload: MonthlyClosingCloseRequest,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)),
    session: Session = Depends(get_session),
):
    if not payload.month and not payload.closing_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="month or closing_id is required")
    closing = close_month(session, month=payload.month, closing_id=payload.closing_id, user=current_user)
    return _closing_row(closing)


@router.post("/archive")
def archive_monthly_closing_endpoint(
    payload: MonthlyClosingArchiveRequest,
    current_user: User = Depends(require_roles(UserRole.OWNER)),
    session: Session = Depends(get_session),
):
    closing = archive_monthly_closing(
        session,
        payload.closing_id,
        current_user,
        confirm_downloaded_backup=payload.confirm_downloaded_backup,
        note=payload.note,
    )
    return _closing_row(closing)


@router.get("")
def list_closings(
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)),
    session: Session = Depends(get_session),
):
    return [_closing_row(closing) for closing in list_monthly_closings(session)]


@router.get("/{closing_id}/download-backup")
def download_backup(
    closing_id: int,
    current_user: User = Depends(require_roles(UserRole.OWNER, UserRole.ACCOUNTANT)),
    session: Session = Depends(get_session),
):
    closing = session.get(MonthlyClosing, closing_id)
    if not closing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monthly closing not found")
    if not closing.backup_generated_at or not closing.backup_filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generate backup before download")
    zip_bytes, checksum = regenerate_backup_for_closing(session, closing)
    headers = {
        "Content-Disposition": f'attachment; filename="{closing.backup_filename}"',
        "Cache-Control": "no-store",
        "X-Backup-SHA256": checksum,
        "X-Recorded-Backup-SHA256": closing.backup_checksum or "",
    }
    return Response(content=zip_bytes, media_type="application/zip", headers=headers)
