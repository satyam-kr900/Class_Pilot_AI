"""Onboarding flow tests — name entry + verify + data (offline)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_institute_detail_endpoint_mounted():
    import app.main as m

    paths = sorted(m.app.openapi()["paths"].keys())
    assert "/api/v1/institutes/{institute_id}" in paths
    text = (ROOT / "backend" / "app" / "routes" / "institutes.py").read_text()
    assert "my_role" in text and "stats" in text


def test_onboarding_page_and_routing():
    page = ROOT / "frontend" / "src" / "app" / "onboarding" / "page.tsx"
    assert page.exists()
    text = page.read_text()
    assert "Institute name" in text or "Institute banao" in text
    assert "Verified" in text
    assert "Open Dashboard" in text
    login = (ROOT / "frontend" / "src" / "app" / "login" / "page.tsx").read_text()
    assert "/onboarding" in login
    assert "myInstitutes" in login
    api = (ROOT / "frontend" / "src" / "lib" / "api.ts").read_text()
    assert "createInstituteViaAPI" in api and "getInstituteViaAPI" in api
