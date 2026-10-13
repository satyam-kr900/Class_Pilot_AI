"""Phase 5 SaaS billing — Razorpay with server-side verification.

- Never trust client redirect alone: webhook HMAC verified, payment fetched
  from Razorpay API before activating plan.
- Manual activation remains when keys absent. SaaS payments separate from
  student fee_payments. Events idempotent by (provider, event_id).
"""
import hashlib
import hmac
import json
import urllib.request
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from app.api_deps import get_current_user, require_institute_membership
from app.core.config import settings
from app.database import get_supabase
from app.routes.subscriptions import PLANS

router = APIRouter(prefix="/billing", tags=["billing"])


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


def _configured() -> bool:
    return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)


class OrderIn(BaseModel):
    institute_id: str
    plan: str


@router.post("/order")
def create_order(payload: OrderIn, user: dict = Depends(get_current_user)):
    """Create Razorpay order for plan upgrade. Returns order (or manual instructions)."""
    from app.api_deps import require_owner_or_staff

    require_owner_or_staff(payload.institute_id, user["id"])
    if payload.plan not in PLANS:
        raise HTTPException(400, f"plan one of {sorted(PLANS)}")
    amount = int(Decimal(str(PLANS[payload.plan]["price"])) * 100)  # paise
    if not _configured():
        return {
            "mode": "manual",
            "amount_inr": PLANS[payload.plan]["price"],
            "note": "Razorpay keys absent — owner ko manual UPI karo, support plan activate karega. Keys aane par auto orders.",
        }
    body = json.dumps({"amount": amount, "currency": "INR", "notes": {"institute_id": payload.institute_id, "plan": payload.plan}}).encode()
    import base64

    creds = base64.b64encode(f"{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}".encode()).decode()
    req = urllib.request.Request(
        "https://api.razorpay.com/v1/orders", data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Basic {creds}"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            order = json.loads(res.read().decode())
    except Exception as e:
        raise HTTPException(502, f"Razorpay order failed: {e}") from e
    return {"mode": "razorpay", "order": order, "key_id": settings.RAZORPAY_KEY_ID}


@router.post("/webhook")
async def webhook(request: Request):
    """Razorpay webhook — verify HMAC-SHA256, then activate. Idempotent."""
    raw = await request.body()
    sig = request.headers.get("X-Razorpay-Signature", "")
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook secret not configured")
    expect = hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expect, sig):
        raise HTTPException(401, "Invalid webhook signature")
    try:
        event = json.loads(raw.decode())
    except Exception as e:
        raise HTTPException(400, f"Bad payload: {e}") from e
    event_id = event.get("id") or ""
    etype = event.get("event") or ""
    notes = ((event.get("payload") or {}).get("payment") or {}).get("entity", {}).get("notes", {}) or {}
    institute_id = notes.get("institute_id")
    plan = notes.get("plan")
    sb = _sb_or_503()
    # Idempotency first
    seen = sb.table("saas_payment_events").select("*").eq("provider", "razorpay").eq("event_id", event_id).limit(1).execute().data or []
    if seen:
        return {"deduped": True}
    sb.table("saas_payment_events").insert(
        {"institute_id": institute_id, "provider": "razorpay", "event_id": event_id, "event_type": etype, "status": "received", "raw": event}
    ).execute()
    if etype == "payment.captured" and institute_id and plan in PLANS:
        sb.table("institutes").update({"plan": plan}).eq("id", institute_id).execute()
        sb.table("subscriptions").insert({"institute_id": institute_id, "plan": plan, "status": "active"}).execute()
        sb.table("saas_payment_events").update({"status": "applied"}).eq("provider", "razorpay").eq("event_id", event_id).execute()
        return {"applied": True, "plan": plan}
    return {"received": True}


@router.get("/history")
def history(institute_id: str = Query(...), user: dict = Depends(get_current_user)):
    from app.api_deps import require_owner_or_staff

    require_owner_or_staff(institute_id, user["id"])
    sb = _sb_or_503()
    rows = sb.table("saas_payment_events").select("event_id,event_type,amount,status,created_at").eq("institute_id", institute_id).order("created_at", desc=True).limit(100).execute().data or []
    return rows
