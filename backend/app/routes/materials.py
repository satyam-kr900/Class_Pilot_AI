"""Phase 4 materials — metadata in Postgres, files in private Storage bucket.

Flow: staff requests upload-url -> PUT file to signed URL -> confirm metadata.
Downloads via short-lived signed URLs. Service key never leaves backend.
"""
import time
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api_deps import get_current_user, require_batch_access, require_staff, teacher_batch_ids
from app.database import first_row, get_supabase

router = APIRouter(prefix="/materials", tags=["materials"])
BUCKET = "materials"


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


class UploadUrlIn(BaseModel):
    institute_id: str
    batch_id: str | None = None
    filename: str = Field(min_length=1, max_length=160)
    mime: str | None = None


class ConfirmIn(BaseModel):
    institute_id: str
    batch_id: str | None = None
    title: str = Field(min_length=2, max_length=160)
    file_path: str
    mime: str | None = None
    size_bytes: int | None = None


@router.post("/upload-url")
def upload_url(payload: UploadUrlIn, user: dict = Depends(get_current_user)):
    require_staff(payload.institute_id, user["id"])
    if payload.batch_id:
        require_batch_access(payload.institute_id, payload.batch_id, user["id"])
    sb = _sb_or_503()
    safe = "".join(c if c.isalnum() or c in ("-", "_", ".") else "_" for c in payload.filename)[:120]
    path = f"{payload.institute_id}/{int(time.time())}_{safe}"
    try:
        signed = sb.storage.from_(BUCKET).create_signed_upload_url(path)
        url = signed.get("signedUrl") or signed.get("signed_url") or ""
    except Exception as e:
        raise HTTPException(400, f"Signed URL failed — bucket 'materials' banao (006 migration): {e}") from e
    return {"file_path": path, "upload_url": url}


@router.post("", status_code=201)
def confirm(payload: ConfirmIn, user: dict = Depends(get_current_user)):
    require_staff(payload.institute_id, user["id"])
    if payload.batch_id:
        require_batch_access(payload.institute_id, payload.batch_id, user["id"])
    if not payload.file_path.startswith(payload.institute_id + "/"):
        raise HTTPException(400, "file_path must belong to this institute")
    sb = _sb_or_503()
    row = payload.model_dump() | {"created_by": user["id"]}
    res = sb.table("learning_materials").insert(row).select().execute()
    created = first_row(res)
    if not created:
        raise HTTPException(400, "Save failed")
    return created


@router.get("")
def list_materials(institute_id: str = Query(...), batch_id: str | None = None, user: dict = Depends(get_current_user)):
    from app.api_deps import require_institute_membership

    sb = _sb_or_503()
    mem = require_institute_membership(institute_id, user["id"])
    q = sb.table("learning_materials").select("*").eq("institute_id", institute_id).order("created_at", desc=True).limit(200)
    role = mem.get("role")
    if role == "teacher":
        allowed = teacher_batch_ids(institute_id, user["id"])
        if allowed is not None:
            if not allowed:
                return []
            q = q.in_("batch_id", allowed)
    elif role in ("student", "parent"):
        # Students: enrolled batches only. Parents: children's batches.
        bids = _visible_batch_ids(sb, institute_id, user["id"], role)
        if not bids:
            return []
        q = q.in_("batch_id", bids)
    if batch_id:
        q = q.eq("batch_id", batch_id)
    return q.execute().data or []


def _visible_batch_ids(sb, institute_id: str, user_id: str, role: str) -> list[str]:
    if role == "student":
        links = sb.table("students").select("id").eq("institute_id", institute_id).eq("user_id", user_id).execute().data or []
        sids = [s["id"] for s in links]
        if not sids:
            return []
        en = sb.table("batch_students").select("batch_id").in_("student_id", sids).execute().data or []
        return list({r["batch_id"] for r in en})
    # parent: guardians -> student_guardians -> batches
    g = sb.table("guardians").select("id").eq("institute_id", institute_id).eq("user_id", user_id).execute().data or []
    gids = [x["id"] for x in g]
    if not gids:
        return []
    sg = sb.table("student_guardians").select("student_id").in_("guardian_id", gids).execute().data or []
    sids = [x["student_id"] for x in sg]
    if not sids:
        return []
    en = sb.table("batch_students").select("batch_id").in_("student_id", sids).execute().data or []
    return list({r["batch_id"] for r in en})


@router.get("/{material_id}/download-url")
def download_url(material_id: str, institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    from app.api_deps import require_institute_membership

    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    row = first_row(sb.table("learning_materials").select("*").eq("id", material_id).eq("institute_id", institute_id).execute())
    if not row:
        raise HTTPException(404, "Material not found")
    try:
        url = sb.storage.from_(BUCKET).create_signed_url(row["file_path"], 600)
        dl = url.get("signedURL") or url.get("signedUrl") or (url if isinstance(url, str) else "")
    except Exception as e:
        raise HTTPException(400, f"Download URL failed: {e}") from e
    return {"download_url": dl, "title": row["title"]}
