from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from app.api_deps import get_current_user, require_institute_membership
from app.database import get_supabase
from app.schemas.student import AttendanceUpsert

router = APIRouter(prefix="/attendance", tags=["attendance"])

ALLOWED = {"present", "absent", "late"}


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("")
def list_attendance(
    institute_id: str = Query(...),
    attendance_date: str | None = None,
    user: dict = Depends(get_current_user),
):
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    q = (
        sb.table("attendance")
        .select("*")
        .eq("institute_id", institute_id)
        .order("attendance_date", desc=True)
        .limit(500)
    )
    if attendance_date:
        q = q.eq("attendance_date", attendance_date)
    return q.execute().data or []


@router.post("/upsert")
def upsert_attendance(rows: list[AttendanceUpsert], user: dict = Depends(get_current_user)):
    if not rows:
        raise HTTPException(400, "Empty list")
    if len(rows) > 200:
        raise HTTPException(400, "Max 200 rows at once")
    institute_id = rows[0].institute_id
    if any(r.institute_id != institute_id for r in rows):
        raise HTTPException(400, "All rows must belong to same institute_id")
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    # Verify all students belong to this institute (cross-tenant block)
    student_ids = list({r.student_id for r in rows})
    valid = (
        sb.table("students")
        .select("id")
        .eq("institute_id", institute_id)
        .in_("id", student_ids)
        .execute()
        .data
        or []
    )
    valid_ids = {s["id"] for s in valid}
    invalid = [s for s in student_ids if s not in valid_ids]
    if invalid:
        raise HTTPException(400, f"{len(invalid)} students not in this institute")
    today = date.today().isoformat()
    payload = []
    for r in rows:
        if r.status not in ALLOWED:
            raise HTTPException(400, f"status one of {sorted(ALLOWED)}")
        payload.append(
            {
                "institute_id": institute_id,
                "owner_id": user["id"],
                "student_id": r.student_id,
                "attendance_date": r.attendance_date or today,
                "status": r.status,
            }
        )
    res = sb.table("attendance").upsert(payload, on_conflict="student_id,attendance_date").select().execute()
    return {"saved": len(res.data or [])}
