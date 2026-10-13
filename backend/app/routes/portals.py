"""Phase 4 portals — role-scoped My Learning for student/parent.

Student: own attendance %, homework of enrolled batches, published results, fee dues.
Parent: same per linked child. Staff blocked (use dashboards).
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api_deps import get_current_user, require_institute_membership
from app.database import first_row, get_supabase

router = APIRouter(prefix="/portals", tags=["portals"])


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


def _student_ids_for(sb, institute_id: str, user_id: str, role: str) -> list[str]:
    if role == "student":
        rows = sb.table("students").select("id").eq("institute_id", institute_id).eq("user_id", user_id).execute().data or []
        return [r["id"] for r in rows]
    if role == "parent":
        g = sb.table("guardians").select("id").eq("institute_id", institute_id).eq("user_id", user_id).execute().data or []
        gids = [x["id"] for x in g]
        if not gids:
            return []
        sg = sb.table("student_guardians").select("student_id").in_("guardian_id", gids).execute().data or []
        return [x["student_id"] for x in sg]
    return []


def _learning_for_student(sb, institute_id: str, student_id: str) -> dict:
    st = first_row(sb.table("students").select("id,name,batch,monthly_fee").eq("id", student_id).execute()) or {}
    att = sb.table("attendance").select("status").eq("institute_id", institute_id).eq("student_id", student_id).limit(1000).execute().data or []
    total = len(att)
    present = sum(1 for a in att if a.get("status") == "present")
    en = sb.table("batch_students").select("batch_id").eq("student_id", student_id).execute().data or []
    bids = [r["batch_id"] for r in en]
    hw = sb.table("assignments").select("id,title,due_date,batch_id").eq("institute_id", institute_id).in_("batch_id", bids).limit(50).execute().data if bids else []
    subs = sb.table("assignment_submissions").select("assignment_id,score").eq("student_id", student_id).execute().data or []
    done = {s["assignment_id"] for s in subs}
    exams = sb.table("exams").select("id,name").eq("institute_id", institute_id).eq("status", "published").limit(50).execute().data or []
    eids = [e["id"] for e in exams]
    marks = sb.table("marks").select("exam_id,score,max_score").eq("student_id", student_id).in_("exam_id", eids).execute().data if eids else []
    pays = sb.table("fee_payments").select("amount").eq("institute_id", institute_id).eq("student_id", student_id).execute().data or []
    from decimal import Decimal

    paid = sum((Decimal(str(p.get("amount") or "0")) for p in pays), Decimal("0"))
    due = max(Decimal("0"), Decimal(str(st.get("monthly_fee") or "0")) - paid)
    return {
        "student": st,
        "attendance": {"present": present, "total": total, "pct": round(present / total * 100) if total else None},
        "homework": {"pending": [h for h in (hw or []) if h["id"] not in done], "done_count": len(done)},
        "results": marks or [],
        "fees": {"paid": float(paid), "due": float(due)},
    }


@router.get("/my-learning")
def my_learning(institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    mem = require_institute_membership(institute_id, user["id"])
    role = mem.get("role")
    if role not in ("student", "parent"):
        raise HTTPException(403, "Student/parent only — staff use dashboards")
    sb = _sb_or_503()
    sids = _student_ids_for(sb, institute_id, user["id"], role)
    if not sids:
        return {"role": role, "linked": [], "note": "No linked student yet — ask institute to link your account (students.user_id / guardians.user_id)."}
    out = [_learning_for_student(sb, institute_id, sid) for sid in sids]
    return {"role": role, "linked": out}
