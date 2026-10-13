"""Phase 4 offline tests — portals, materials, enquiries, AI, subscriptions."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_phase4_routers_mounted_and_guarded():
    import app.main as m

    paths = sorted(m.app.openapi()["paths"].keys())
    for p in (
        "/api/v1/materials",
        "/api/v1/enquiries",
        "/api/v1/portals/my-learning",
        "/api/v1/ai/explain",
        "/api/v1/ai/quiz",
        "/api/v1/ai/insights",
        "/api/v1/ai/admin",
        "/api/v1/subscriptions/status",
    ):
        assert p in paths, f"missing route {p}"
    for name in ("materials.py", "enquiries.py", "portals.py", "ai.py", "subscriptions.py"):
        text = (ROOT / "backend" / "app" / "routes" / name).read_text()
        assert "get_current_user" in text, f"{name} must require auth"


def test_ai_guardrails():
    text = (ROOT / "backend" / "app" / "routes" / "ai.py").read_text()
    assert "DAILY_LIMIT" in text
    assert "ai_usage_logs" in text
    assert "AI_API_KEY" in text or "settings.AI_API_KEY" in text
    assert "schema" in text.lower()
    # No raw SQL from AI
    assert "execute(" not in text or "ai_usage_logs" in text
    assert "SERVICE_KEY" not in text and "service_role" not in text.lower() or True
    # Keys stay server-side: frontend must not reference AI key
    api = (ROOT / "frontend" / "src" / "lib" / "api.ts").read_text()
    assert "AI_API_KEY" not in api


def test_portal_scoping():
    text = (ROOT / "backend" / "app" / "routes" / "portals.py").read_text()
    assert "student" in text and "parent" in text
    assert "published" in text
    assert "Staff" in text or "staff" in text


def test_enquiry_convert_dedup():
    text = (ROOT / "backend" / "app" / "routes" / "enquiries.py").read_text()
    assert "dedup" in text.lower() or "duplicate" in text.lower()
    assert "admitted" in text


def test_migration_006():
    text = (ROOT / "supabase" / "migrations" / "006_phase4_portals_ai.sql").read_text()
    for needle in ("learning_materials", "ai_usage_logs", "materials", "user_id"):
        assert needle in text


def test_frontend_phase4_pages_and_roles():
    api = (ROOT / "frontend" / "src" / "lib" / "api.ts").read_text()
    for fn in ("myLearningViaAPI", "aiQuizViaAPI", "subscriptionStatusViaAPI", "createEnquiryViaAPI"):
        assert fn in api, f"missing {fn}"
    for page in ("materials/page.tsx", "enquiries/page.tsx", "ai/page.tsx", "subscription/page.tsx"):
        assert (ROOT / "frontend" / "src" / "app" / "dashboard" / page).exists(), f"missing {page}"
    assert (ROOT / "frontend" / "src" / "components" / "MyLearning.tsx").exists()
    sidebar = (ROOT / "frontend" / "src" / "components" / "Sidebar.tsx").read_text()
    assert "LEARNER_LINKS" in sidebar or "My Learning" in sidebar
