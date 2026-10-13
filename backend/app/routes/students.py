from fastapi import APIRouter, Depends, HTTPException, Query
from app.api_deps import get_current_user, require_institute_membership
from app.database import first_row, get_supabase
from app.schemas.student import StudentCreate, StudentOut, StudentUpdate, _clean_phone

router = APIRouter(prefix="/students", tags=["students"])


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("", response_model=list[StudentOut])
def list_students(
    institute_id: str = Query(...),
    status: str = "active",
    user: dict = Depends(get_current_user),
):
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    q = sb.table("students").select("*").eq("institute_id", institute_id).order("created_at", desc=True).limit(500)
    if status in ("active", "archived"):
        q = q.eq("status", status)
    return (q.execute().data or [])


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: str, institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    res = sb.table("students").select("*").eq("id", student_id).eq("institute_id", institute_id).execute()
    row = first_row(res)
    if not row:
        raise HTTPException(404, "Student not found in this institute")
    return row


@router.post("", response_model=StudentOut, status_code=201)
def create_student(payload: StudentCreate, user: dict = Depends(get_current_user)):
    require_institute_membership(payload.institute_id, user["id"])
    sb = _sb_or_503()
    row = {
        "institute_id": payload.institute_id,
        "owner_id": user["id"],
        "name": payload.name.strip(),
        "batch": (payload.batch or "").strip() or None,
        "monthly_fee": str(payload.monthly_fee),
        "guardian_name": (payload.guardian_name or "").strip() or None,
        "guardian_phone": _clean_phone(payload.guardian_phone),
        "student_phone": _clean_phone(payload.student_phone),
        "class_name": payload.class_name,
        "status": "active",
    }
    # Server-generated admission_no avoids client collisions
    import random
    import string

    row["admission_no"] = "ADM-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    try:
        res = sb.table("students").insert(row).select().execute()
    except Exception as e:
        # Unique violation on admission_no -> retry once with new number
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            row["admission_no"] = "ADM-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            res = sb.table("students").insert(row).select().execute()
        else:
            raise
    created = first_row(res)
    if not created:
        raise HTTPException(400, "Insert failed")
    return created


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: str,
    payload: StudentUpdate,
    institute_id: str = Query(...),
    user: dict = Depends(get_current_user),
):
    require_institute_membership(institute_id, user["id"])
    if payload.status is not None and payload.status not in ("active", "archived"):
        raise HTTPException(400, "status must be active|archived")
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "monthly_fee" in patch:
        patch["monthly_fee"] = str(patch["monthly_fee"])
    if "guardian_phone" in patch:
        patch["guardian_phone"] = _clean_phone(patch["guardian_phone"])
    if "student_phone" in patch:
        patch["student_phone"] = _clean_phone(patch["student_phone"])
    if not patch:
        raise HTTPException(400, "Kuch update karne ko bhejo")
    sb = _sb_or_503()
    res = (
        sb.table("students")
        .update(patch)
        .eq("id", student_id)
        .eq("institute_id", institute_id)
        .select()
        .execute()
    )
    updated = first_row(res)
    if not updated:
        raise HTTPException(404, "Student not found in this institute")
    return updated


@router.delete("/{student_id}")
def archive_student(student_id: str, institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    """Soft-delete: archive keeps fee/attendance history. Hard delete removed (audit)."""
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    res = (
        sb.table("students")
        .update({"status": "archived"})
        .eq("id", student_id)
        .eq("institute_id", institute_id)
        .select()
        .execute()
    )
    if not first_row(res):
        raise HTTPException(404, "Student not found in this institute")
    return {"archived": student_id}
