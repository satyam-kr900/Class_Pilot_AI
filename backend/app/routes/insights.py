"""Phase 2/4 insights — institute-scoped, auth required (legacy owner_id removed)."""
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from app.api_deps import get_current_user, require_institute_membership
from app.database import get_supabase
from app.services.supabase_client import fee_reminder_insight

router = APIRouter(prefix="/insights", tags=["insights"])


def _sb_or_503():
    from fastapi import HTTPException

    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/overview")
def overview(institute_id: str = Query(...), from_date: str | None = None, user: dict = Depends(get_current_user)):
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    students = (
        sb.table("students").select("id,name,monthly_fee").eq("institute_id", institute_id).eq("status", "active").execute().data or []
    )
    q = sb.table("fee_payments").select("student_id,amount").eq("institute_id", institute_id)
    if from_date:
        q = q.gte("payment_date", from_date)
    pays = q.execute().data or []
    paid_ids = {p["student_id"] for p in pays}
    pending_students = [s for s in students if s["id"] not in paid_ids]
    pending_amount = float(sum((Decimal(str(s.get("monthly_fee") or "0")) for s in pending_students), Decimal("0")))
    return {
        "total_students": len(students),
        "paid_count": len(paid_ids),
        "pending_count": len(pending_students),
        "pending_amount": pending_amount,
        "top_defaulters": sorted(pending_students, key=lambda s: float(s.get("monthly_fee") or 0), reverse=True)[:5],
        "insight": fee_reminder_insight(len(pending_students)),
    }
