"""Phase 5 notifications — in-app working now, WhatsApp via approved provider.

- In-app: staff create, members read (scoped).
- WhatsApp: template + consent (notification_preferences) + delivery logs
  pending/sent/failed with idempotency. Never fake sent status.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api_deps import get_current_user, require_institute_membership, require_staff
from app.database import first_row, get_supabase

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


class NotifyCreate(BaseModel):
    institute_id: str
    title: str = Field(min_length=2, max_length=160)
    body: str = Field(min_length=1, max_length=2000)
    audience: str = "all"


class WhatsAppSend(BaseModel):
    institute_id: str
    guardian_id: str
    template: str = Field(min_length=1, max_length=80)
    params: list[str] = Field(default_factory=list)
    idempotency_key: str | None = None


@router.get("")
def list_notifications(institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    mem = require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    q = sb.table("notifications").select("*").eq("institute_id", institute_id).order("created_at", desc=True).limit(100)
    role = mem.get("role")
    # Learners see all/audience-matched; user-targeted only for self (RLS double-enforces).
    rows = q.execute().data or []
    if role in ("student", "parent"):
        rows = [r for r in rows if r.get("audience") in ("all", "students", "parents") or r.get("user_id") == user["id"]]
    return rows


@router.post("", status_code=201)
def create_notification(payload: NotifyCreate, user: dict = Depends(get_current_user)):
    if payload.audience not in ("all", "teachers", "parents", "students", "user"):
        raise HTTPException(400, "Invalid audience")
    require_staff(payload.institute_id, user["id"])
    sb = _sb_or_503()
    res = sb.table("notifications").insert(payload.model_dump()).select().execute()
    created = first_row(res)
    if not created:
        raise HTTPException(400, "Create failed")
    return created


@router.post("/whatsapp")
def send_whatsapp(payload: WhatsAppSend, user: dict = Depends(get_current_user)):
    """Staff sends template to opted-in guardian. Logged pending->sent/failed."""
    require_staff(payload.institute_id, user["id"])
    sb = _sb_or_503()
    g = first_row(sb.table("guardians").select("id,phone").eq("id", payload.guardian_id).eq("institute_id", payload.institute_id).execute())
    if not g or not g.get("phone"):
        raise HTTPException(404, "Guardian with verified phone not found")
    pref = first_row(sb.table("notification_preferences").select("whatsapp_opt_in").eq("institute_id", payload.institute_id).eq("guardian_id", payload.guardian_id).execute())
    if pref and pref.get("whatsapp_opt_in") is False:
        raise HTTPException(403, "Guardian opted out — in-app notification bhejo")
    key = (payload.idempotency_key or "").strip() or str(uuid.uuid4())
    dup = sb.table("notification_delivery_logs").select("*").eq("idempotency_key", key).limit(1).execute().data or []
    if dup:
        return dup[0]
    log = first_row(sb.table("notification_delivery_logs").insert(
        {"institute_id": payload.institute_id, "channel": "whatsapp", "recipient": g["phone"], "status": "pending", "idempotency_key": key}
    ).select().execute())
    from app.integrations.whatsapp import is_configured, send_template

    if not is_configured():
        sb.table("notification_delivery_logs").update({"status": "failed", "error": "provider_unconfigured"}).eq("id", log["id"]).execute()
        raise HTTPException(503, "WhatsApp provider not configured — in-app notification use karo. Status logged as failed (not sent).")
    try:
        send_template(g["phone"], payload.template, params=payload.params)
        sb.table("notification_delivery_logs").update({"status": "sent"}).eq("id", log["id"]).execute()
        log["status"] = "sent"
    except HTTPException as e:
        sb.table("notification_delivery_logs").update({"status": "failed", "error": str(e.detail)[:500]}).eq("id", log["id"]).execute()
        raise
    return log


@router.post("/fee-reminder/{student_id}")
def fee_reminder(student_id: str, institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    """Draft a fee reminder (human review before send). Returns draft + guardian."""
    require_staff(institute_id, user["id"])
    sb = _sb_or_503()
    st = first_row(sb.table("students").select("id,name,monthly_fee").eq("id", student_id).eq("institute_id", institute_id).execute())
    if not st:
        raise HTTPException(404, "Student not found")
    links = sb.table("student_guardians").select("guardian_id").eq("student_id", student_id).execute().data or []
    gids = [x["guardian_id"] for x in links]
    guards = sb.table("guardians").select("id,name,phone").in_("id", gids).execute().data if gids else []
    s = st
    draft = f"Namaste! {s['name']} ki is mahine ki fee ₹{s.get('monthly_fee') or 0} pending hai. ClassPilot AI receipt ke saath pay karo. - {institute_id[:8]}"
    return {"draft": draft, "guardians": guards or [], "note": "Review karke WhatsApp tab se bhejo"}
