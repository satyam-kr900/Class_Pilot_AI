"""Phase 3 homework — assignments + submissions + grading."""
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api_deps import get_current_user, require_batch_access, require_staff, teacher_batch_ids
from app.database import first_row, get_supabase

router = APIRouter(prefix="/assignments", tags=["assignments"])


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


class AssignmentCreate(BaseModel):
    institute_id: str
    batch_id: str | None = None
    title: str = Field(min_length=2, max_length=160)
    description: str | None = None
    due_date: str | None = None


class SubmissionCreate(BaseModel):
    assignment_id: str
    student_id: str
    body: str | None = None


class GradeBody(BaseModel):
    score: Decimal | None = None
    feedback: str | None = None


@router.get("")
def list_assignments(institute_id: str = Query(...), batch_id: str | None = None, user: dict = Depends(get_current_user)):
    sb = _sb_or_503()
    allowed = teacher_batch_ids(institute_id, user["id"])
    q = sb.table("assignments").select("*").eq("institute_id", institute_id).order("created_at", desc=True).limit(200)
    if batch_id:
        require_batch_access(institute_id, batch_id, user["id"])
        q = q.eq("batch_id", batch_id)
    elif allowed is not None:
        if not allowed:
            return []
        # include unassigned-batch? No — teacher sees assigned only + null? Keep assigned only.
        q = q.in_("batch_id", allowed)
    return q.execute().data or []


@router.post("", status_code=201)
def create_assignment(payload: AssignmentCreate, user: dict = Depends(get_current_user)):
    require_staff(payload.institute_id, user["id"])
    if payload.batch_id:
        require_batch_access(payload.institute_id, payload.batch_id, user["id"])
    sb = _sb_or_503()
    res = sb.table("assignments").insert(payload.model_dump()).select().execute()
    created = first_row(res)
    if not created:
        raise HTTPException(400, "Create failed")
    return created


@router.post("/{assignment_id}/submit", status_code=201)
def submit(assignment_id: str, body: SubmissionCreate, user: dict = Depends(get_current_user)):
    sb = _sb_or_503()
    a = first_row(sb.table("assignments").select("id,institute_id,batch_id").eq("id", assignment_id).execute())
    if not a:
        raise HTTPException(404, "Assignment not found")
    # Student/parent self-submit allowed; staff path also allowed. Verify institute membership.
    from app.api_deps import require_institute_membership

    require_institute_membership(a["institute_id"], user["id"])
    st = first_row(sb.table("students").select("id,institute_id").eq("id", body.student_id).execute())
    if not st or st["institute_id"] != a["institute_id"]:
        raise HTTPException(404, "Student not in this institute")
    row = {"assignment_id": assignment_id, "student_id": body.student_id, "body": body.body}
    res = sb.table("assignment_submissions").upsert(row, on_conflict="assignment_id,student_id").select().execute()
    return first_row(res)


@router.get("/{assignment_id}/submissions")
def list_submissions(assignment_id: str, institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    sb = _sb_or_503()
    a = first_row(sb.table("assignments").select("batch_id").eq("id", assignment_id).eq("institute_id", institute_id).execute())
    if not a:
        raise HTTPException(404, "Assignment not found")
    if a.get("batch_id"):
        require_batch_access(institute_id, a["batch_id"], user["id"])
    else:
        require_staff(institute_id, user["id"])
    return sb.table("assignment_submissions").select("*").eq("assignment_id", assignment_id).limit(500).execute().data or []


@router.post("/submissions/{submission_id}/grade")
def grade(submission_id: str, institute_id: str = Query(...), body: GradeBody = GradeBody(), user: dict = Depends(get_current_user)):
    require_staff(institute_id, user["id"])
    sb = _sb_or_503()
    patch: dict = {}
    if body.score is not None:
        if body.score < 0:
            raise HTTPException(400, "score >= 0")
        patch["score"] = str(body.score)
    if body.feedback is not None:
        patch["feedback"] = body.feedback
    if not patch:
        raise HTTPException(400, "score or feedback required")
    res = sb.table("assignment_submissions").update(patch).eq("id", submission_id).select().execute()
    graded = first_row(res)
    if not graded:
        raise HTTPException(404, "Submission not found")
    return graded
