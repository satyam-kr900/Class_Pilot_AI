"""Phase 4 SaaS — plans as config, usage from real counts. Manual activation for now."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api_deps import get_current_user, require_institute_membership
from app.database import first_row, get_supabase

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

PLANS = {
    "free": {"price": 0, "students": 20, "staff": 2, "batches": 3, "ai_per_day": 5, "reports": False},
    "tutor": {"price": 499, "students": 100, "staff": 3, "batches": 10, "ai_per_day": 15, "reports": True},
    "growth": {"price": 999, "students": 300, "staff": 10, "batches": 30, "ai_per_day": 30, "reports": True},
    "pro": {"price": 1499, "students": 1000, "staff": 30, "batches": 100, "ai_per_day": 100, "reports": True},
}


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/plans")
def plans():
    return PLANS


@router.get("/status")
def status(institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    inst = first_row(sb.table("institutes").select("id,name,plan").eq("id", institute_id).execute()) or {}
    plan = (inst.get("plan") or "free").lower()
    limits = PLANS.get(plan, PLANS["free"])
    students = sb.table("students").select("id", count="exact").eq("institute_id", institute_id).eq("status", "active").execute()
    staff = sb.table("institute_members").select("user_id", count="exact").eq("institute_id", institute_id).execute()
    batches = sb.table("batches").select("id", count="exact").eq("institute_id", institute_id).execute()
    usage = {
        "students": getattr(students, "count", None) or len(students.data or []),
        "staff": getattr(staff, "count", None) or len(staff.data or []),
        "batches": getattr(batches, "count", None) or len(batches.data or []),
    }
    return {
        "institute": inst,
        "plan": plan,
        "limits": limits,
        "usage": usage,
        "over_limits": {k: usage[k] > limits[k] for k in ("students", "staff", "batches")},
        "note": "Manual activation for now — Razorpay webhook verification Phase 5 me",
    }
