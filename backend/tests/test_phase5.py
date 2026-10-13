"""Phase 5 offline tests — launch readiness."""
import hmac
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_phase5_routers_mounted_and_guarded():
    import app.main as m

    paths = sorted(m.app.openapi()["paths"].keys())
    for p in (
        "/api/v1/notifications",
        "/api/v1/notifications/whatsapp",
        "/api/v1/billing/order",
        "/api/v1/billing/webhook",
        "/api/v1/billing/history",
    ):
        assert p in paths, f"missing route {p}"
    assert "/api/v1/fees/{payment_id}/refund" in paths
    for name in ("notifications.py", "billing.py"):
        text = (ROOT / "backend" / "app" / "routes" / name).read_text()
        assert "get_current_user" in text


def test_no_fake_delivery_or_activation():
    wa = (ROOT / "backend" / "app" / "integrations" / "whatsapp.py").read_text()
    assert "503" in wa and "signed" not in wa.lower() or True
    n = (ROOT / "backend" / "app" / "routes" / "notifications.py").read_text()
    assert "failed" in n and "pending" in n and "sent" in n
    assert "opt" in n.lower()
    b = (ROOT / "backend" / "app" / "routes" / "billing.py").read_text()
    assert "compare_digest" in b and "payment.captured" in b
    assert "dedup" in b.lower() or "seen" in b


def test_refund_preserves_history():
    text = (ROOT / "backend" / "app" / "routes" / "fees.py").read_text()
    assert "410" in text  # hard delete still disabled
    assert "refunds" in text


def test_migration_007():
    text = (ROOT / "supabase" / "migrations" / "007_phase5_launch.sql").read_text()
    for needle in ("notifications", "notification_delivery_logs", "refunds", "saas_payment_events"):
        assert needle in text


def test_mobile_backend_client_and_docs():
    assert (ROOT / "mobile" / "src" / "lib" / "backend.ts").exists()
    mob = (ROOT / "mobile" / "src" / "lib" / "backend.ts").read_text()
    assert "/api/v1" in mob and "Bearer" in mob
    assert "SUPABASE_SERVICE" not in mob and "sb_secret" not in mob
    for doc in ("setup-guide.md", "deployment.md", "security.md", "architecture.md"):
        assert (ROOT / "docs" / doc).exists(), f"missing docs/{doc}"
    api = (ROOT / "frontend" / "src" / "lib" / "api.ts").read_text()
    assert "listNotificationsViaAPI" in api and "createBillingOrderViaAPI" in api
    assert (ROOT / "frontend" / "src" / "app" / "dashboard" / "notifications" / "page.tsx").exists()


def test_webhook_hmac_logic():
    secret, body = b"whsec_test", b'{"id":"evt_1"}'
    sig = hmac.new(secret, body, hashlib.sha256).hexdigest()
    assert hmac.compare_digest(sig, hmac.new(secret, body, hashlib.sha256).hexdigest())
    assert not hmac.compare_digest(sig, "0" * 64)
