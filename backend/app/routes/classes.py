from fastapi import APIRouter, Depends
from app.api_deps import get_current_user, teacher_batch_ids
from app.database import get_supabase

router = APIRouter(prefix="/classes", tags=["classes"])


@router.get("")
def list_classes(institute_id: str | None = None, user: dict | None = Depends(get_current_user)):
    """Legacy endpoint — now backed by real batches when institute_id given.
    Falls back to distinct student batch strings for old callers."""
    sb = None
    try:
        sb = get_supabase()
    except Exception:
        sb = None
    if sb is not None and institute_id:
        try:
            allowed = teacher_batch_ids(institute_id, user["id"]) if user else None
            q = sb.table("batches").select("id,name").eq("institute_id", institute_id)
            if allowed is not None:
                if not allowed:
                    return []
                q = q.in_("id", allowed)
            rows = q.execute().data or []
            return [{"id": r["id"], "name": r["name"], "students": 0} for r in rows]
        except Exception:
            pass
    # Fallback: distinct batch text from students
    try:
        assert sb is not None
        rows = (sb.table("students").select("batch").execute().data or [])
    except Exception:
        rows = []
    seen: dict[str, int] = {}
    for r in rows:
        b = (r.get("batch") or "General").strip() or "General"
        seen[b] = seen.get(b, 0) + 1
    # No fake entries — empty means empty. Use /api/v1/batches for real batches.
    return [{"id": k, "name": k, "students": v} for k, v in sorted(seen.items())]
