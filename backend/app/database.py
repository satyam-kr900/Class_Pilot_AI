from supabase import create_client, Client
from app.core.config import settings

_supabase: Client | None = None

def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        key = settings.SUPABASE_SERVICE_KEY or ""
        # Naya format sb_secret_... bhi chalta hai, purana JWT eyJ... bhi
        if not settings.SUPABASE_URL or (not key.startswith("eyJ") and not key.startswith("sb_secret_")):
            raise RuntimeError("SUPABASE_SERVICE_KEY set karo backend/.env me (service-role, frontend me kabhi nahi).")
        _supabase = create_client(settings.SUPABASE_URL, key)
    return _supabase


def first_row(res):
    """Version-safe .single(): first row or None.

    supabase-py >= ~2.3x me insert/upsert/update builders pe .single()
    nahi hai (sirf select-filter builder pe). Isliye kahin .single() mat
    lagao — .execute() karke first_row() lo. Response shape same rehti hai.
    """
    rows = (res.data if hasattr(res, "data") else res) or []
    if isinstance(rows, dict):
        return rows
    return rows[0] if rows else None
