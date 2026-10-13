"""Phase 2 offline tests — institute enforcement + payment safety."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_no_owner_id_trust_in_routes():
    for name in ("students.py", "fees.py", "attendance.py"):
        text = (ROOT / "backend" / "app" / "routes" / name).read_text()
        assert "get_current_user" in text, f"{name} must require auth"
        assert "require_institute_membership" in text, f"{name} must check membership"
    fees = (ROOT / "backend" / "app" / "routes" / "fees.py").read_text()
    assert "owner_id: str" not in fees or "Query" in fees, "fees must not take raw owner_id"
    assert "idempotency" in fees.lower()
    assert "410" in fees, "DELETE must be disabled with 410"


def test_decimal_money_not_float():
    text = (ROOT / "backend" / "app" / "schemas" / "student.py").read_text()
    assert "Decimal" in text
    assert "monthly_fee: float" not in text
    assert "amount: float" not in text


def test_migration_004_idempotency():
    text = (ROOT / "supabase" / "migrations" / "004_phase2_payments.sql").read_text()
    for needle in ("idempotency_key", "fee_payments_idempotency_unique", "fee_payments_institute_receipt_unique"):
        assert needle in text


def test_frontend_uses_backend_writes():
    api = (ROOT / "frontend" / "src" / "lib" / "api.ts").read_text()
    assert "createStudentViaAPI" in api
    assert "collectFeeViaAPI" in api
    assert "saveAttendanceViaAPI" in api
    assert "idempotency_key" in api
    for page in ("students/page.tsx", "fees/page.tsx", "attendance/page.tsx"):
        t = (ROOT / "frontend" / "src" / "app" / "dashboard" / page).read_text()
        assert "getSelectedInstituteId" in t, f"{page} must scope by institute"
        assert "institute_id" in t
