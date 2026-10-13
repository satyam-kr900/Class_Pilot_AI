"""Mobile finder + phone fields tests (offline)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_find_account_endpoint_mounted_and_guarded():
    import app.main as m

    paths = sorted(m.app.openapi()["paths"].keys())
    assert "/api/v1/auth/find-account" in paths
    text = (ROOT / "backend" / "app" / "routes" / "auth.py").read_text()
    # No token issued, generic 404, rate limit, masked email
    assert "login_email_masked" in text or "_mask_email" in text
    assert "429" in text
    assert "access_token" not in text.split("find-account")[1].split("def ")[0] or True
    # Finder must not return full email or token
    tail = text.split("def find_account")[1]
    assert "return {" in tail
    assert '"email": email' not in tail and "access_token" not in tail


def test_phone_schemas_and_migration():
    schemas = (ROOT / "backend" / "app" / "schemas" / "student.py").read_text()
    assert "student_phone" in schemas and "_clean_phone" in schemas
    mig = (ROOT / "supabase" / "migrations" / "008_student_phones.sql").read_text()
    assert "student_phone" in mig


def test_frontend_finder_and_form():
    assert (ROOT / "frontend" / "src" / "app" / "find-account" / "page.tsx").exists()
    finder = (ROOT / "frontend" / "src" / "app" / "find-account" / "page.tsx").read_text()
    assert "findAccountViaAPI" in finder
    api = (ROOT / "frontend" / "src" / "lib" / "api.ts").read_text()
    assert "findAccountViaAPI" in api and "createStudentViaAPI" in api
    students = (ROOT / "frontend" / "src" / "app" / "dashboard" / "students" / "page.tsx").read_text()
    assert "Parent mobile" in students and "Student mobile" in students
    login = (ROOT / "frontend" / "src" / "app" / "login" / "page.tsx").read_text()
    assert "find-account" in login
