"""Cleanup regression — no dummy data, no dead code (offline)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_no_dummy_dashboard_numbers_in_landing():
    text = (ROOT / "frontend" / "src" / "app" / "page.tsx").read_text()
    for needle in ("248", "1,85,000", "1,25,000", "28,500", "32,500", "Sunrise Coaching", "78%"):
        assert needle not in text, f"dummy data still in landing: {needle}"


def test_no_fake_classes_fallback():
    text = (ROOT / "backend" / "app" / "routes" / "classes.py").read_text()
    assert "10th" not in text and "12th Science" not in text


def test_dead_code_removed():
    assert not (ROOT / "backend" / "app" / "models" / "student.py").exists()
    # NOTE: .pytest_cache/__pycache__ regenerate on any run — covered by .gitignore
    gi = (ROOT / ".gitignore").read_text()
    assert "__pycache__" in gi and ".pytest_cache" in gi and ".idea" in gi
