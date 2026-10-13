"""Phase 1 institutes API — membership is source of truth."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api_deps import get_current_user, get_user_memberships, require_owner_or_staff
from app.database import first_row, get_supabase

router = APIRouter(prefix="/institutes", tags=["institutes"])


class InstituteCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    city: str | None = None
    phone: str | None = None
    timezone: str = "Asia/Kolkata"
    currency: str = "INR"


@router.get("/me")
def my_institutes(user: dict = Depends(get_current_user)):
    """List institutes the caller belongs to. Used by frontend switcher."""
    return {"user_id": user["id"], "memberships": get_user_memberships(user["id"])}


@router.post("", status_code=201)
def create_institute(payload: InstituteCreate, user: dict = Depends(get_current_user)):
    try:
        sb = get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    row: dict = {"name": payload.name.strip(), "owner_id": user["id"]}
    created = sb.table("institutes").insert(row).select().execute()
    inst = first_row(created)
    if not inst:
        raise HTTPException(status_code=400, detail="Institute create failed")
    sb.table("institute_members").insert(
        {"institute_id": inst["id"], "user_id": user["id"], "role": "owner"}
    ).execute()
    return inst


@router.get("/{institute_id}/members")
def list_members(institute_id: str, user: dict = Depends(get_current_user)):
    """Owner/staff: member list for teacher assignment. Teachers see only self."""
    from app.api_deps import require_institute_membership

    mem = require_institute_membership(institute_id, user["id"])
    try:
        sb = get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if mem.get("role") in ("owner", "staff"):
        rows = (
            sb.table("institute_members")
            .select("user_id,role,created_at")
            .eq("institute_id", institute_id)
            .limit(200)
            .execute()
            .data
            or []
        )
        return rows
    return [{"user_id": user["id"], "role": mem.get("role")}]


@router.get("/{institute_id}")
def get_institute(institute_id: str, user: dict = Depends(get_current_user)):
    """Verify membership + return institute with live counts. Used by onboarding."""
    from app.api_deps import require_institute_membership

    mem = require_institute_membership(institute_id, user["id"])
    try:
        sb = get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    inst = first_row(sb.table("institutes").select("*").eq("id", institute_id).execute())
    if not inst:
        raise HTTPException(404, "Institute not found")
    students = sb.table("students").select("id", count="exact").eq("institute_id", institute_id).execute()
    batches = sb.table("batches").select("id", count="exact").eq("institute_id", institute_id).execute()
    return {
        "verified": True,
        "institute": inst,
        "my_role": mem.get("role"),
        "stats": {
            "students": getattr(students, "count", None) or len(students.data or []),
            "batches": getattr(batches, "count", None) or len(batches.data or []),
        },
    }
