"""Phase 1 offline tests — no live Supabase creds needed."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_no_wildcard_cors_with_credentials():
    text = (ROOT / "backend" / "app" / "main.py").read_text()
    assert 'allow_origin_regex=".*"' not in text, "wildcard CORS must be removed"
    assert "ALLOWED_ORIGINS" in text or "allowed_origins" in text


def test_dev_cors_allows_local_network():
    """Regression: preflight 400s — dev must allow localhost/127/LAN/exp any port."""
    text = (ROOT / "backend" / "app" / "main.py").read_text()
    assert "allow_origin_regex" in text
    assert "192\\.168" in text or "192.168" in text
    assert "max_age" in text


def test_no_single_after_write():
    """Regression: supabase-py>=2.3x insert/upsert/update builders lack .single() — use first_row."""
    import re

    bad = []
    for p in (ROOT / "backend" / "app" / "routes").glob("*.py"):
        for i, line in enumerate(p.read_text().splitlines(), 1):
            if ".single()" in line:
                bad.append(f"{p.name}:{i}")
    assert not bad, f".single() crashes writes on supabase-py 2.32: {bad}"
    assert "def first_row" in (ROOT / "backend" / "app" / "database.py").read_text()


def test_versioned_api_mounted():
    text = (ROOT / "backend" / "app" / "main.py").read_text()
    assert 'prefix="/api/v1"' in text
    assert "/api/v1/health" in text


def test_auth_dep_rejects_missing_token():
    from fastapi import HTTPException

    from app.api_deps import verify_bearer_token

    try:
        verify_bearer_token(None)
    except HTTPException as e:
        assert e.status_code == 401
    else:
        raise AssertionError("missing token should 401")


def test_migration_003_has_phase1_tables_and_tight_rls():
    text = (ROOT / "supabase" / "migrations" / "003_phase1_foundation.sql").read_text()
    for needle in [
        "create table if not exists public.profiles",
        "create table if not exists public.invitations",
        "create table if not exists public.guardians",
        "create table if not exists public.student_guardians",
        "admission_no",
        "Members view batch_students",
        "Members view marks",
    ]:
        assert needle in text, f"missing in 003: {needle}"
    assert "using (\n  true\n)" not in text


def test_frontend_env_unified_and_switcher_exists():
    api = (ROOT / "frontend" / "src" / "lib" / "api.ts").read_text()
    assert "NEXT_PUBLIC_API_BASE_URL" in api
    assert "myInstitutes" in api
    assert (ROOT / "frontend" / "src" / "components" / "InstituteSwitcher.tsx").exists()
    assert (ROOT / "frontend" / ".env.example").exists()
    assert (ROOT / "backend" / ".env.example").exists()
