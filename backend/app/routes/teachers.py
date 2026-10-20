from fastapi import APIRouter, Depends, HTTPException, Query
from app.api_deps import get_current_user, require_institute_membership
from app.database import first_row, get_supabase
from app.schemas.student import _clean_phone

router = APIRouter(prefix="/teachers", tags=["teachers"])


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


def _check_teacher_access(institute_id: str, user_id: str, sb) -> dict:
    """Check that user has access to this institute and is a teacher."""
    mem = require_institute_membership(institute_id, user_id)
    if mem.get("role") not in ("owner", "teacher", "staff"):
        raise HTTPException(status_code=403, detail="Teacher access required")
    teacher = first_row(
        sb.table("teachers").select("*").eq("institute_id", institute_id).eq("user_id", user_id).execute()
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher record not found for this institute")
    return mem


@router.get("", response_model=dict)
def list_teachers(
    institute_id: str = Query(...),
    user: dict = Depends(get_current_user),
):
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    teachers = sb.table("teachers").select("*").eq("institute_id", institute_id).execute().data or []
    return {"teachers": teachers}


@router.get("/{teacher_id}", response_model=dict)
def get_teacher(
    teacher_id: str,
    institute_id: str = Query(...),
    user: dict = Depends(get_current_user),
):
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    teacher = first_row(
        sb.table("teachers").select("*").eq("id", teacher_id).eq("institute_id", institute_id).execute()
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found in this institute")
    return teacher


@router.post("", response_model=dict, status_code=201)
def create_teacher(
    payload,
    institute_id: str = Query(...),
    user: dict = Depends(get_current_user),
):
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()

    # Check if teacher record already exists for this user+institute
    existing = first_row(
        sb.table("teachers").select("id").eq("institute_id", institute_id).eq("user_id", user["id"]).execute()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Teacher record already exists for this user")

    row = {
        "institute_id": institute_id,
        "user_id": user["id"],
        "qualifications": (payload.qualifications or "").strip() or None,
        "subjects": (payload.subjects or "").strip() or None,
        "classes": (payload.classes or "").strip() or None,
        "experience": (payload.experience or "").strip() or None,
        "residential_address": (payload.residential_address or "").strip() or None,
        "pic_url": getattr(payload, "pic_url", None),
    }
    res = sb.table("teachers").insert(row).select().execute()
    created = first_row(res)
    if not created:
        raise HTTPException(status_code=400, detail="Insert failed")
    return created