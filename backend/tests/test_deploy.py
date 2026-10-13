"""Deploy readiness tests — pinned deps, prod guards, packaging (offline)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_requirements_match_tested_versions():
    req = (ROOT / "backend" / "requirements.txt").read_text()
    assert "supabase==2.32.0" in req, "pin tested supabase version for deploys"
    assert "pydantic-settings" not in req, "unused dep removed"
    assert "uvicorn" in req and "fastapi" in req


def test_render_blueprint_and_runtime():
    render = (ROOT / "render.yaml").read_text()
    assert "classpilot-api" in render
    assert "uvicorn app.main:app" in render
    assert "/api/v1/health" in render
    assert "ALLOWED_ORIGINS" in render and "SUPABASE_SERVICE_KEY" in render
    assert "APP_ENV" in render and "prod" in render
    runtime = (ROOT / "backend" / "runtime.txt").read_text()
    assert runtime.strip().startswith("python-3.12")


def test_prod_cors_guard_and_no_localhost_leaks():
    main = (ROOT / "backend" / "app" / "main.py").read_text()
    assert "ALLOWED_ORIGINS still localhost" in main or "allowed_origins_list" in main
    # Prod path must use explicit list (no regex/wildcard)
    assert "allow_origins=settings.allowed_origins_list" in main


def test_demo_gated():
    web = (ROOT / "frontend" / "src" / "app" / "login" / "page.tsx").read_text()
    assert "NEXT_PUBLIC_ALLOW_DEMO" in web
    mob = (ROOT / "mobile" / "src" / "app" / "(auth)" / "login.tsx").read_text()
    assert "EXPO_PUBLIC_ALLOW_DEMO" in mob
    assert "NEXT_PUBLIC_ALLOW_DEMO" in (ROOT / "frontend" / ".env.example").read_text()
    assert "EXPO_PUBLIC_ALLOW_DEMO" in (ROOT / "mobile" / ".env.example").read_text()
