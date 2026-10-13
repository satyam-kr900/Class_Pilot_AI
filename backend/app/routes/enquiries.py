"""Phase 4 enquiries — pipeline new/followup/admitted/dropped + convert without duplicates."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api_deps import get_current_user, require_staff
from app.database import first_row, get_supabase

router = APIRouter(prefix="/enquiries", tags=["enquiries"])
STAGES = {"new", "contacted", "followup", "trial", "admitted", "dropped"}


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


class EnquiryCreate(BaseModel):
    institute_id: str
    name: str = Field(min_length=1, max_length=120)
    phone: str | None = None
    course: str | None = None
    note: str | None = None


class EnquiryUpdate(BaseModel):
    status: str | None = None
    followup_note: str | None = None
    note: str | None = None


@router.get("")
def list_enquiries(institute_id: str = Query(...), status: str | None = None, user: dict = Depends(get_current_user)):
    require_staff(institute_id, user["id"])
    sb = _sb_or_503()
    q = sb.table("enquiries").select("*").eq("institute_id", institute_id).order("created_at", desc=True).limit(300)
    # Legacy rows may lack institute_id — staff with owner match still see via RLS.
    if status and status in STAGES:
        q = q.eq("status", status)
    return q.execute().data or []


@router.post("", status_code=201)
def create_enquiry(payload: EnquiryCreate, user: dict = Depends(get_current_user)):
    require_staff(payload.institute_id, user["id"])
    sb = _sb_or_503()
    row = payload.model_dump() | {"owner_id": user["id"], "status": "new"}
    res = sb.table("enquiries").insert(row).select().execute()
    created = first_row(res)
    if not created:
        raise HTTPException(400, "Create failed")
    return created


@router.put("/{enquiry_id}")
def update_enquiry(enquiry_id: str, institute_id: str = Query(...), payload: EnquiryUpdate = EnquiryUpdate(), user: dict = Depends(get_current_user)):
    require_staff(institute_id, user["id"])
    if payload.status is not None and payload.status not in STAGES:
        raise HTTPException(400, f"status one of {sorted(STAGES)}")
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    if payload.followup_note is not None:
        patch["note"] = payload.followup_note
        patch.pop("followup_note", None)
    if not patch:
        raise HTTPException(400, "Nothing to update")
    sb = _sb_or_503()
    res = sb.table("enquiries").update(patch).eq("id", enquiry_id).eq("institute_id", institute_id).select().execute()
    updated = first_row(res)
    if not updated:
        raise HTTPException(404, "Enquiry not found")
    return updated


@router.post("/{enquiry_id}/convert", status_code=201)
def convert(enquiry_id: str, institute_id: str = Query(...), monthly_fee: float = Query(0, ge=0), user: dict = Depends(get_current_user)):
    """Admitted -> student. Duplicate-safe: same phone+name returns existing student."""
    require_staff(institute_id, user["id"])
    sb = _sb_or_503()
    enq = first_row(sb.table("enquiries").select("*").eq("id", enquiry_id).eq("institute_id", institute_id).execute())
    if not enq:
        raise HTTPException(404, "Enquiry not found")
    e = enq
    if e.get("phone"):
        dup = sb.table("students").select("id").eq("institute_id", institute_id).eq("guardian_phone", e["phone"]).limit(1).execute().data or []
        if dup:
            sb.table("enquiries").update({"status": "admitted"}).eq("id", enquiry_id).execute()
            return {"student_id": dup[0]["id"], "deduped": True}
    import random
    import string

    student = {
        "institute_id": institute_id,
        "owner_id": user["id"],
        "name": e["name"],
        "monthly_fee": str(monthly_fee),
        "guardian_phone": e.get("phone"),
        "class_name": e.get("course"),
        "status": "active",
        "admission_no": "ADM-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6)),
    }
    created = sb.table("students").insert(student).select().execute()
    sb.table("enquiries").update({"status": "admitted"}).eq("id", enquiry_id).execute()
    new_student = first_row(created)
    return {"student_id": new_student["id"], "deduped": False}
