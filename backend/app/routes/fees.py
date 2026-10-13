import uuid
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.api_deps import get_current_user, require_institute_membership
from app.database import first_row, get_supabase
from app.schemas.student import FeePaymentCreate

router = APIRouter(prefix="/fees", tags=["fees"])

ALLOWED_METHODS = {"cash", "upi", "bank", "other"}


class RefundIn(BaseModel):
    amount: Decimal
    reason: str | None = None


def _sb_or_503():
    try:
        return get_supabase()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


def _receipt_no() -> str:
    # R- + 8 upper alnum. Unique per institute enforced by DB constraint.
    import random
    import string

    return "R-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


@router.get("")
def list_payments(
    institute_id: str = Query(...),
    from_date: str | None = None,
    user: dict = Depends(get_current_user),
):
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    q = (
        sb.table("fee_payments")
        .select("*")
        .eq("institute_id", institute_id)
        .order("payment_date", desc=True)
        .limit(200)
    )
    if from_date:
        q = q.gte("payment_date", from_date)
    return q.execute().data or []


@router.post("", status_code=201)
def collect_fee(payload: FeePaymentCreate, user: dict = Depends(get_current_user)):
    if payload.payment_method not in ALLOWED_METHODS:
        raise HTTPException(400, f"payment_method one of {sorted(ALLOWED_METHODS)}")
    require_institute_membership(payload.institute_id, user["id"])
    sb = _sb_or_503()
    # Student MUST belong to same institute — cross-tenant collection blocked
    st = first_row(
        sb.table("students")
        .select("id")
        .eq("id", payload.student_id)
        .eq("institute_id", payload.institute_id)
        .execute()
    )
    if not st:
        raise HTTPException(404, "Student not found in this institute")

    key = (payload.idempotency_key or "").strip() or str(uuid.uuid4())
    # Idempotency: same key returns first payment, never duplicates
    existing = sb.table("fee_payments").select("*").eq("idempotency_key", key).limit(1).execute()
    if existing.data:
        return existing.data[0]

    row = {
        "institute_id": payload.institute_id,
        "owner_id": user["id"],
        "student_id": payload.student_id,
        "amount": str(payload.amount),
        "payment_date": date.today().isoformat(),
        "payment_method": payload.payment_method,
        "note": payload.note,
        "idempotency_key": key,
        "receipt_no": _receipt_no(),
    }
    try:
        res = sb.table("fee_payments").insert(row).select().execute()
    except Exception as e:
        msg = str(e).lower()
        if "idempotency" in msg or "duplicate" in msg or "unique" in msg:
            # Race: another request won — return it
            again = sb.table("fee_payments").select("*").eq("idempotency_key", key).limit(1).execute()
            if again.data:
                return again.data[0]
        if "receipt" in msg and "unique" in msg:
            row["receipt_no"] = _receipt_no()
            res = sb.table("fee_payments").insert(row).select().execute()
        else:
            raise HTTPException(400, f"Insert failed: {e}") from e
    created = first_row(res)
    if not created:
        raise HTTPException(400, "Insert failed")
    return created


@router.delete("/{payment_id}")
def delete_payment(payment_id: str):
    # Hard delete removed — refunds/reversals must preserve audit trail (Phase 3).
    raise HTTPException(
        status_code=410,
        detail="Payment delete disabled. Use refund/reversal (upcoming) — history must be preserved.",
    )


@router.post("/{payment_id}/refund", status_code=201)
def refund_payment(payment_id: str, institute_id: str = Query(...), payload: RefundIn = None, user: dict = Depends(get_current_user)):
    """Create refund row — original payment preserved. One refund per payment."""
    from app.api_deps import require_owner_or_staff

    require_owner_or_staff(institute_id, user["id"])
    if payload is None or payload.amount <= 0:
        raise HTTPException(400, "amount > 0")
    sb = _sb_or_503()
    pay = first_row(sb.table("fee_payments").select("id,amount").eq("id", payment_id).eq("institute_id", institute_id).execute())
    if not pay:
        raise HTTPException(404, "Payment not found in this institute")
    if Decimal(str(payload.amount)) > Decimal(str(pay["amount"])):
        raise HTTPException(400, "Refund cannot exceed payment amount")
    res = sb.table("refunds").insert(
        {"institute_id": institute_id, "payment_id": payment_id, "amount": str(payload.amount), "reason": payload.reason, "created_by": user["id"]}
    ).select().execute()
    created = first_row(res)
    if not created:
        raise HTTPException(400, "Refund failed (maybe already refunded — one per payment)")
    return created


@router.get("/summary")
def fee_summary(
    institute_id: str = Query(...),
    from_date: str | None = None,
    user: dict = Depends(get_current_user),
):
    require_institute_membership(institute_id, user["id"])
    sb = _sb_or_503()
    students = (
        sb.table("students")
        .select("id,monthly_fee")
        .eq("institute_id", institute_id)
        .eq("status", "active")
        .execute()
        .data
        or []
    )
    q = sb.table("fee_payments").select("student_id,amount").eq("institute_id", institute_id)
    if from_date:
        q = q.gte("payment_date", from_date)
    pays = q.execute().data or []
    paid_ids = {p["student_id"] for p in pays}
    # Decimal-safe math in Python: use float only for display sums of NUMERIC strings
    from decimal import Decimal

    expected = sum((Decimal(str(s.get("monthly_fee") or "0")) for s in students), Decimal("0"))
    collected = sum((Decimal(str(p.get("amount") or "0")) for p in pays), Decimal("0"))
    return {
        "expected": float(expected),
        "collected": float(collected),
        "pending": float(max(Decimal("0"), expected - collected)),
        "paid_count": len(paid_ids),
        "total_students": len(students),
    }
