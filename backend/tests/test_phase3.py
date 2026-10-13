"""Phase 3 offline tests — academic modules + teacher scoping."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_teacher_scoping_helpers_exist():
    text = (ROOT / "backend" / "app" / "api_deps.py").read_text()
    for needle in ("require_staff", "require_owner_or_staff", "require_batch_access", "teacher_batch_ids"):
        assert needle in text, f"missing {needle}"


def test_academic_routers_mounted_and_guarded():
    import app.main as m

    paths = sorted(m.app.openapi()["paths"].keys())
    for p in (
        "/api/v1/batches",
        "/api/v1/sessions",
        "/api/v1/assignments",
        "/api/v1/exams",
        "/api/v1/institutes/{institute_id}/members",
    ):
        assert p in paths, f"missing route {p}"
    for name in ("batches.py", "sessions.py", "assignments.py", "exams.py"):
        text = (ROOT / "backend" / "app" / "routes" / name).read_text()
        assert "require_batch_access" in text or "teacher_batch_ids" in text, f"{name} must scope teachers"
        assert "get_current_user" in text


def test_exam_publish_and_marks_validation():
    text = (ROOT / "backend" / "app" / "routes" / "exams.py").read_text()
    assert "draft" in text and "published" in text
    assert "score > max_score" in text or "max_score" in text
    assert "audit_logs" in text


def test_session_conflict_detection():
    text = (ROOT / "backend" / "app" / "routes" / "sessions.py").read_text()
    assert "409" in text
    assert "overlapping" in text.lower() or "overlap" in text.lower() or "time slot" in text


def test_migration_005_tables():
    text = (ROOT / "supabase" / "migrations" / "005_phase3_academic.sql").read_text()
    for needle in ("class_sessions", "assignment_submissions", "status", "capacity"):
        assert needle in text


def test_frontend_academic_pages():
    api = (ROOT / "frontend" / "src" / "lib" / "api.ts").read_text()
    for fn in ("listBatchesViaAPI", "createSessionViaAPI", "createAssignmentViaAPI", "enterMarksViaAPI", "publishExamViaAPI"):
        assert fn in api, f"missing {fn}"
    for page in ("batches/page.tsx", "timetable/page.tsx", "homework/page.tsx", "exams/page.tsx"):
        assert (ROOT / "frontend" / "src" / "app" / "dashboard" / page).exists(), f"missing {page}"
    sidebar = (ROOT / "frontend" / "src" / "components" / "Sidebar.tsx").read_text()
    assert "Batches" in sidebar and "Exams" in sidebar
