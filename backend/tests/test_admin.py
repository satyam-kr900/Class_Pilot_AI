"""Admin panel tests — add teacher/student/parent + logins (offline)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_admin_routes_mounted_and_owner_guarded():
    import app.main as m

    paths = sorted(m.app.openapi()["paths"].keys())
    for p in (
        "/api/v1/admin/teacher",
        "/api/v1/admin/student-full",
        "/api/v1/admin/learner-account",
        "/api/v1/admin/members",
    ):
        assert p in paths, f"missing route {p}"
    text = (ROOT / "backend" / "app" / "routes" / "admin.py").read_text()
    assert text.count("require_owner_or_staff") >= 4
    assert "get_current_user" in text
    # Temp password shown once + rollback on failure
    assert "temp_password" in text
    assert "delete_user" in text


def test_admin_frontend():
    assert (ROOT / "frontend" / "src" / "app" / "dashboard" / "admin" / "page.tsx").exists()
    page = (ROOT / "frontend" / "src" / "app" / "dashboard" / "admin" / "page.tsx").read_text()
    assert "Create Teacher Login" in page
    assert "Create" in page and "Login" in page
    sidebar = (ROOT / "frontend" / "src" / "components" / "Sidebar.tsx").read_text()
    assert "/dashboard/admin" in sidebar
    api = (ROOT / "frontend" / "src" / "lib" / "api.ts").read_text()
    assert "adminCreateTeacherViaAPI" in api and "adminCreateLearnerAccountViaAPI" in api
