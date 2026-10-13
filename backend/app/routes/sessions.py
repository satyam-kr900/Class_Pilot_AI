"""Phase 3 timetable — class_sessions with conflict detection."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api_deps import get_current_user, require_batch_access, require_staff, teacher_batch_ids
from app.database import first_row, get_supabase

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


class SessionCreate(BaseModel):
    institute_id: str
    batch_id: str
    title: str = Field(min_length=2, max_length=120)
    subject: str | None = None
    starts_at: str  # ISO timestamptz
    ends_at: str
    room: str | None = None
    teacher_id: str | None = None


def _parse(ts: str) -> datetime:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception as e:
        raise HTTPException(400, f"Invalid datetime {ts}") from e


@router.get("")
def list_sessions(
    institute_id: str = Query(...),
    from_date: str | None = None,
    to_date: str | None = None,
    batch_id: str | None = None,
    user: dict = Depends(get_current_user),
):
    sb = _sb_or_503()
    allowed = teacher_batch_ids(institute_id, user["id"])
    q = sb.table("class_sessions").select("*").eq("institute_id", institute_id).order("starts_at").limit(300)
    if batch_id:
        require_batch_access(institute_id, batch_id, user["id"])
        q = q.eq("batch_id", batch_id)
    elif allowed is not None:
        if not allowed:
            return []
        q = q.in_("batch_id", allowed)
    if from_date:
        q = q.gte("starts_at", from_date)
    if to_date:
        q = q.lte("starts_at", to_date)
    return q.execute().data or []


@router.post("", status_code=201)
def create_session(payload: SessionCreate, user: dict = Depends(get_current_user)):
    require_staff(payload.institute_id, user["id"])
    require_batch_access(payload.institute_id, payload.batch_id, user["id"])
    start, end = _parse(payload.starts_at), _parse(payload.ends_at)
    if end <= start:
        raise HTTPException(400, "ends_at must be after starts_at")
    sb = _sb_or_503()
    b = first_row(sb.table("batches").select("id").eq("id", payload.batch_id).eq("institute_id", payload.institute_id).execute())
    if not b:
        raise HTTPException(404, "Batch not found in this institute")
    # Conflict: same batch overlapping
    overlap = (
        sb.table("class_sessions")
        .select("id")
        .eq("batch_id", payload.batch_id)
        .neq("status", "cancelled")
        .lt("starts_at", payload.ends_at)
        .gt("ends_at", payload.starts_at)
        .limit(1)
        .execute()
        .data
        or []
    )
    if overlap:
        raise HTTPException(409, "Batch already has a session in this time slot")
    # Conflict: same teacher overlapping (if assigned)
    teacher = payload.teacher_id or (user["id"] if True else None)
    if teacher:
        tover = (
            sb.table("class_sessions")
            .select("id")
            .eq("institute_id", payload.institute_id)
            .eq("teacher_id", teacher)
            .neq("status", "cancelled")
            .lt("starts_at", payload.ends_at)
            .gt("ends_at", payload.starts_at)
            .limit(1)
            .execute()
            .data
            or []
        )
        if tover:
            raise HTTPException(409, "Teacher has another session in this time slot")
    row = payload.model_dump()
    row["teacher_id"] = teacher
    row["status"] = "scheduled"
    res = sb.table("class_sessions").insert(row).select().execute()
    created = first_row(res)
    if not created:
        raise HTTPException(400, "Create failed")
    return created


@router.post("/{session_id}/cancel")
def cancel_session(session_id: str, institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    sb = _sb_or_503()
    cur = first_row(sb.table("class_sessions").select("batch_id").eq("id", session_id).eq("institute_id", institute_id).execute())
    if not cur:
        raise HTTPException(404, "Session not found")
    require_batch_access(institute_id, cur["batch_id"], user["id"])
    res = sb.table("class_sessions").update({"status": "cancelled"}).eq("id", session_id).select().execute()
    return first_row(res)
