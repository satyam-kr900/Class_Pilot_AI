"""Phase 3 batches — real batches table, teacher-scoped."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api_deps import (
    get_current_user,
    require_batch_access,
    require_owner_or_staff,
    require_staff,
    teacher_batch_ids,
)
from app.database import first_row, get_supabase

router = APIRouter(prefix="/batches", tags=["batches"])


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


class BatchCreate(BaseModel):
    institute_id: str
    name: str = Field(min_length=2, max_length=120)
    subject: str | None = None
    schedule: str | None = None
    capacity: int | None = Field(default=None, ge=1, le=1000)


@router.get("")
def list_batches(institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    sb = _sb_or_503()
    allowed = teacher_batch_ids(institute_id, user["id"])
    q = sb.table("batches").select("*").eq("institute_id", institute_id).order("created_at")
    if allowed is not None:
        if not allowed:
            return []
        q = q.in_("id", allowed)
    return q.execute().data or []


@router.post("", status_code=201)
def create_batch(payload: BatchCreate, user: dict = Depends(get_current_user)):
    require_owner_or_staff(payload.institute_id, user["id"])
    sb = _sb_or_503()
    res = sb.table("batches").insert(payload.model_dump()).select().execute()
    created = first_row(res)
    if not created:
        raise HTTPException(400, "Create failed")
    return created


@router.post("/{batch_id}/enrol")
def enrol_student(batch_id: str, institute_id: str = Query(...), student_id: str = Query(...), user: dict = Depends(get_current_user)):
    require_staff(institute_id, user["id"])
    sb = _sb_or_503()
    b = first_row(sb.table("batches").select("id,capacity").eq("id", batch_id).eq("institute_id", institute_id).execute())
    if not b:
        raise HTTPException(404, "Batch not found in this institute")
    st = first_row(sb.table("students").select("id").eq("id", student_id).eq("institute_id", institute_id).execute())
    if not st:
        raise HTTPException(404, "Student not found in this institute")
    if b.get("capacity"):
        count = sb.table("batch_students").select("student_id").eq("batch_id", batch_id).execute().data or []
        if len(count) >= int(b["capacity"]) and not any(r["student_id"] == student_id for r in count):
            raise HTTPException(400, "Batch capacity full")
    # Prevent duplicate active enrol in same batch (PK handles) + warn on multi-active?
    sb.table("batch_students").upsert({"batch_id": batch_id, "student_id": student_id}).execute()
    return {"enrolled": student_id, "batch_id": batch_id}


@router.post("/{batch_id}/teachers")
def assign_teacher(batch_id: str, institute_id: str = Query(...), user_id: str = Query(...), user: dict = Depends(get_current_user)):
    """Owner/staff assigns a teacher (must be institute member)."""
    require_owner_or_staff(institute_id, user["id"])
    sb = _sb_or_503()
    b = first_row(sb.table("batches").select("id").eq("id", batch_id).eq("institute_id", institute_id).execute())
    if not b:
        raise HTTPException(404, "Batch not found in this institute")
    m = first_row(sb.table("institute_members").select("role").eq("institute_id", institute_id).eq("user_id", user_id).execute())
    if not m:
        raise HTTPException(404, "User is not a member of this institute")
    sb.table("batch_teachers").upsert({"batch_id": batch_id, "user_id": user_id}).execute()
    return {"assigned": user_id, "batch_id": batch_id}


@router.get("/{batch_id}/roster")
def roster(batch_id: str, institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    require_batch_access(institute_id, batch_id, user["id"])
    sb = _sb_or_503()
    studs = sb.table("batch_students").select("student_id").eq("batch_id", batch_id).execute().data or []
    ids = [r["student_id"] for r in studs]
    students = sb.table("students").select("id,name,monthly_fee,status").in_("id", ids).execute().data if ids else []
    teachers = sb.table("batch_teachers").select("user_id").eq("batch_id", batch_id).execute().data or []
    return {"students": students or [], "teachers": teachers, "count": len(ids)}
