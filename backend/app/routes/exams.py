"""Phase 3 exams — draft/publish, marks entry, results."""
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api_deps import get_current_user, require_batch_access, require_staff, teacher_batch_ids
from app.database import first_row, get_supabase

router = APIRouter(prefix="/exams", tags=["exams"])


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


class ExamCreate(BaseModel):
    institute_id: str
    batch_id: str | None = None
    name: str = Field(min_length=2, max_length=160)
    exam_date: str | None = None


class MarkEntry(BaseModel):
    student_id: str
    score: Decimal = Field(ge=Decimal("0"))
    max_score: Decimal = Field(default=Decimal("100"), gt=Decimal("0"))


@router.get("")
def list_exams(institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    sb = _sb_or_503()
    allowed = teacher_batch_ids(institute_id, user["id"])
    q = sb.table("exams").select("*").eq("institute_id", institute_id).order("exam_date", desc=True).limit(200)
    if allowed is not None:
        if not allowed:
            return []
        q = q.in_("batch_id", allowed)
    rows = q.execute().data or []
    # Students/parents see published only — enforced here (RLS is member-read).
    from app.api_deps import require_institute_membership

    mem = require_institute_membership(institute_id, user["id"])
    if mem.get("role") in ("student", "parent"):
        rows = [r for r in rows if r.get("status") == "published"]
    return rows


@router.post("", status_code=201)
def create_exam(payload: ExamCreate, user: dict = Depends(get_current_user)):
    require_staff(payload.institute_id, user["id"])
    if payload.batch_id:
        require_batch_access(payload.institute_id, payload.batch_id, user["id"])
    sb = _sb_or_503()
    row = payload.model_dump() | {"status": "draft"}
    res = sb.table("exams").insert(row).select().execute()
    created = first_row(res)
    if not created:
        raise HTTPException(400, "Create failed")
    return created


@router.post("/{exam_id}/marks")
def enter_marks(exam_id: str, institute_id: str = Query(...), marks: list[MarkEntry] = [], user: dict = Depends(get_current_user)):
    if not marks or len(marks) > 300:
        raise HTTPException(400, "1-300 marks required")
    sb = _sb_or_503()
    exam = first_row(sb.table("exams").select("id,batch_id").eq("id", exam_id).eq("institute_id", institute_id).execute())
    if not exam:
        raise HTTPException(404, "Exam not found")
    if exam.get("batch_id"):
        require_batch_access(institute_id, exam["batch_id"], user["id"])
    else:
        require_staff(institute_id, user["id"])
    ids = [m.student_id for m in marks]
    valid = sb.table("students").select("id").eq("institute_id", institute_id).in_("id", ids).execute().data or []
    ok = {s["id"] for s in valid}
    bad = [i for i in ids if i not in ok]
    if bad:
        raise HTTPException(400, f"{len(bad)} students not in institute")
    for m in marks:
        if m.score > m.max_score:
            raise HTTPException(400, f"score > max_score for {m.student_id}")
    payload = [{"exam_id": exam_id, "student_id": m.student_id, "score": str(m.score), "max_score": str(m.max_score)} for m in marks]
    sb.table("marks").upsert(payload, on_conflict="exam_id,student_id").execute()
    # Audit trail
    try:
        sb.table("audit_logs").insert({"institute_id": institute_id, "actor": user["id"], "action": "marks_entered", "entity": "exam", "entity_id": exam_id}).execute()
    except Exception:
        pass
    return {"saved": len(payload)}


@router.post("/{exam_id}/publish")
def publish(exam_id: str, institute_id: str = Query(...), status: str = Query("published"), user: dict = Depends(get_current_user)):
    if status not in ("draft", "published"):
        raise HTTPException(400, "status must be draft|published")
    sb = _sb_or_503()
    exam = first_row(sb.table("exams").select("batch_id").eq("id", exam_id).eq("institute_id", institute_id).execute())
    if not exam:
        raise HTTPException(404, "Exam not found")
    if exam.get("batch_id"):
        require_batch_access(institute_id, exam["batch_id"], user["id"])
    else:
        require_staff(institute_id, user["id"])
    res = sb.table("exams").update({"status": status}).eq("id", exam_id).select().execute()
    return first_row(res)


@router.get("/{exam_id}/results")
def results(exam_id: str, institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    from app.api_deps import require_institute_membership

    sb = _sb_or_503()
    exam = first_row(sb.table("exams").select("*").eq("id", exam_id).eq("institute_id", institute_id).execute())
    if not exam:
        raise HTTPException(404, "Exam not found")
    mem = require_institute_membership(institute_id, user["id"])
    if mem.get("role") in ("student", "parent") and exam.get("status") != "published":
        raise HTTPException(403, "Results not published yet")
    if exam.get("batch_id") and mem.get("role") == "teacher":
        require_batch_access(institute_id, exam["batch_id"], user["id"])
    rows = sb.table("marks").select("*,students(id,name)").eq("exam_id", exam_id).limit(1000).execute().data or []
    return {"exam": exam, "marks": rows, "count": len(rows)}
